import React, { useState, useMemo } from 'react';
import { LedgerRow, CustomerPayment } from '../types';
import { Printer, Filter, FileText, Files, Wallet, BookOpen, ChevronRight, ArrowLeft, Users, Edit, ImageDown } from 'lucide-react';
import { formatDate, formatCurrency, downloadAsImage } from '../utils';

interface LedgerTableProps {
  data: LedgerRow[];
  payments: CustomerPayment[]; 
  onViewPayment: (saleId: string) => void;
  onPrintInvoice: (row: LedgerRow) => void;
  onPrintBulkInvoices: (rows: LedgerRow[]) => void;
  onShowCustomerStatement: (customerName: string, customerId: string, startDate: string, endDate: string) => void;
  onEditSale: (saleId: string) => void;
}

const LedgerTable: React.FC<LedgerTableProps> = ({ 
    data, 
    payments,
    onViewPayment, 
    onPrintInvoice, 
    onPrintBulkInvoices,
    onShowCustomerStatement,
    onEditSale
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('ALL');

  const uniqueCustomers = useMemo(() => {
    const map = new Map();
    data.forEach(d => {
        const key = d.customerId || d.customer;
        if(!map.has(key)) map.set(key, { id: d.customerId, name: d.customer });
    });
    return Array.from(map.values()).sort((a,b) => a.name.localeCompare(b.name));
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(row => {
      const rowDate = new Date(row.date);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      const matchCustomer = selectedCustomer === 'ALL' || (row.customerId === selectedCustomer) || (row.customer === selectedCustomer);     
      const matchStart = !start || rowDate >= start;
      const matchEnd = !end || rowDate <= end;
      return matchCustomer && matchStart && matchEnd;
    });
  }, [data, startDate, endDate, selectedCustomer]);

  const customerSummary = useMemo(() => {
    let targetCustomers = uniqueCustomers;
    if (selectedCustomer !== 'ALL') {
        targetCustomers = uniqueCustomers.filter(c => (c.id === selectedCustomer) || (c.name === selectedCustomer));
    }

    return targetCustomers.map(cust => {
        const isMatch = (item: { customerId?: string, customer?: string, customerName?: string }) => {
             if (cust.id && item.customerId) return item.customerId === cust.id;
             const itemName = item.customer || item.customerName;
             return itemName === cust.name;
        };

        const allCustomerSales = data.filter(r => isMatch(r));
        const allCustomerPayments = payments.filter(p => isMatch(p));
        
        const absoluteDebt = allCustomerSales.reduce((a,b) => a + b.totalSales, 0);
        const absolutePaid = allCustomerPayments.reduce((a,b) => a + b.totalPaid, 0);
        const absoluteBalance = absoluteDebt - absolutePaid;

        const filteredRows = filteredData.filter(r => isMatch(r));
        const periodSales = filteredRows.reduce((a, b) => a + b.totalSales, 0);
        
        return {
            id: cust.id,
            customer: cust.name,
            totalKg: filteredRows.reduce((a, b) => a + b.soldKg, 0),
            periodSales: periodSales,
            totalPaid: absolutePaid, 
            remainingBalance: absoluteBalance,
            transactionCount: filteredRows.length
        };
    }).sort((a, b) => b.remainingBalance - a.remainingBalance);
  }, [filteredData, selectedCustomer, data, payments, uniqueCustomers]);

  const totalSales = customerSummary.reduce((acc, row) => acc + row.periodSales, 0);
  const totalReceivable = customerSummary.reduce((acc, row) => acc + row.remainingBalance, 0);
  const totalMortalityVal = filteredData.reduce((acc, row) => acc + row.mortalityValue, 0);

  const handlePrintRecap = () => window.print();
  
  // Menggunakan ID baru 'ledger-capture-area' agar hasil download selalu tabel (PC view)
  const handleDownloadImage = () => {
    // Memberikan sedikit waktu render ulang jika diperlukan sebelum capture
    setTimeout(() => {
      downloadAsImage('ledger-capture-area', `Ledger_Recap_${selectedCustomer}`);
    }, 100);
  };

  const clearFilters = () => {
      setStartDate('');
      setEndDate('');
      setSelectedCustomer('ALL');
  };

  // Helper untuk merender komponen ringkasan (digunakan dua kali: di UI dan di area capture)
  const SummaryCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="bg-slate-50 p-2 rounded border-l-4 border-blue-500">
            <div className="text-slate-400 text-[9px] uppercase font-bold">Sales Periode</div>
            <div className="text-lg font-bold text-slate-800">{formatCurrency(totalSales)}</div>
        </div>
        <div className="bg-slate-50 p-2 rounded border-l-4 border-red-500">
            <div className="text-slate-400 text-[9px] uppercase font-bold">Total Sisa Piutang</div>
            <div className={`text-lg font-bold ${totalReceivable < 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalReceivable < 0 ? `+${formatCurrency(Math.abs(totalReceivable))}` : formatCurrency(totalReceivable)}
            </div>
        </div>
        <div className="bg-slate-50 p-2 rounded border-l-4 border-orange-500">
            <div className="text-slate-400 text-[9px] uppercase font-bold">Nilai Kematian</div>
            <div className="text-lg font-bold text-orange-600">{formatCurrency(totalMortalityVal)}</div>
        </div>
    </div>
  );

  // Helper untuk merender tabel desktop (digunakan dua kali)
  const DesktopTable = ({ isForCapture = false }) => (
    <div className={`rounded border border-slate-200 ${!isForCapture ? 'hidden md:block overflow-x-auto' : 'overflow-visible'}`}>
        <table className="w-full text-[11px] text-left whitespace-nowrap bg-white">
            <thead className={`bg-slate-100 text-slate-600 font-bold uppercase text-[10px] ${!isForCapture ? 'sticky top-0 z-10 shadow-sm' : ''}`}>
                <tr>
                    <th className="py-2 px-2 border-b min-w-[200px]">Customer Name</th>
                    <th className="py-2 px-2 text-right border-b">Sales (Periode)</th>
                    <th className="py-2 px-2 text-right border-b bg-slate-50">Total Tagihan</th>
                    <th className="py-2 px-2 text-right border-b bg-green-50 text-green-800">Total Bayar</th>
                    <th className="py-2 px-2 text-right border-b bg-red-50 text-red-800">Sisa / Balance</th>
                    {!isForCapture && <th className="py-2 px-2 text-center border-b print:hidden w-20">Action</th>}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {customerSummary.map((row) => (
                    <tr key={row.id || row.customer} className="hover:bg-blue-50 transition-colors">
                        <td className="py-1 px-2 font-bold text-blue-800">
                            {row.customer}
                            <span className="text-[9px] font-normal text-slate-400 ml-2">({row.transactionCount})</span>
                        </td>
                        <td className="py-1 px-2 text-right text-slate-500 font-mono">{formatCurrency(row.periodSales)}</td>
                        <td className="py-1 px-2 text-right font-semibold font-mono bg-slate-50/50">{formatCurrency(row.remainingBalance + row.totalPaid)}</td>
                        <td className="py-1 px-2 text-right font-semibold text-green-700 font-mono bg-green-50/30">{formatCurrency(row.totalPaid)}</td>
                        <td className={`py-1 px-2 text-right font-bold font-mono text-xs bg-red-50/20 ${row.remainingBalance < 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {row.remainingBalance < 0 ? `+${formatCurrency(Math.abs(row.remainingBalance))}` : formatCurrency(row.remainingBalance)}
                        </td>
                        {!isForCapture && (
                            <td className="py-1 px-2 text-center print:hidden">
                                <button 
                                    onClick={() => {
                                        const custObj = uniqueCustomers.find(c => c.id === row.id || c.name === row.customer);
                                        if(custObj) onShowCustomerStatement(custObj.name, custObj.id, startDate, endDate);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:text-blue-600 hover:border-blue-300 text-[10px] font-bold shadow-sm"
                                >
                                    Kartu <ChevronRight className="w-3 h-3" />
                                </button>
                            </td>
                        )}
                    </tr>
                ))}
                {customerSummary.length === 0 && (
                    <tr><td colSpan={isForCapture ? 5 : 6} className="p-6 text-center text-slate-400 italic">No data found.</td></tr>
                )}
            </tbody>
        </table>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* AREA TERSEMBUNYI UNTUK CAPTURE (DOWNLOAD) - Selalu dalam format PC/Tabel */}
      {/* w-[1280px] memastikan lebar cukup lebar untuk tabel penuh tanpa terpotong */}
      <div 
        id="ledger-capture-area" 
        className="absolute -top-[99999px] -left-[99999px] w-[1200px] bg-white p-10 pointer-events-none z-[-1] overflow-visible"
        aria-hidden="true"
      >
          <div className="mb-6 border-b-2 border-slate-800 pb-4">
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-black uppercase text-slate-800 tracking-tight">Rekap Ledger Piutang</h1>
                  <p className="text-base text-slate-500 font-bold">CV. DPJ Berkah Unggas</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-700">Periode: {startDate || 'Awal'} s/d {endDate || 'Sekarang'}</p>
                  <p className="text-xs text-slate-400">Dicetak pada: {new Date().toLocaleString('id-ID')}</p>
                </div>
              </div>
          </div>
          <SummaryCards />
          <DesktopTable isForCapture={true} />
          <div className="mt-10 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400">
            System generated report - CV DPJ Berkah Unggas
          </div>
      </div>

      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 print:hidden">
        <div>
            <h2 className="text-xl font-bold text-slate-800">Ledger Piutang</h2>
        </div>
        <div className="flex flex-wrap gap-2">
             <button onClick={handleDownloadImage} className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs font-bold"><ImageDown className="w-3.5 h-3.5" /> JPG</button>
            <button onClick={handlePrintRecap} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-700 text-xs font-bold"><FileText className="w-3.5 h-3.5" /> PDF</button>
        </div>
      </div>

      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 print:hidden">
        <div className="flex items-center justify-between mb-2">
             <div className="flex items-center gap-2 text-slate-700 text-xs font-bold uppercase"><Filter className="w-3 h-3" /> Filter Data</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded border-slate-300 text-xs p-1.5"/>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded border-slate-300 text-xs p-1.5"/>
            <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} className="w-full rounded border-slate-300 text-xs p-1.5">
                <option value="ALL">-- Semua Customer --</option>
                {uniqueCustomers.map(c => <option key={c.id || c.name} value={c.id || c.name}>{c.name}</option>)}
            </select>
            {selectedCustomer !== 'ALL' ? (
                <button onClick={() => {
                    const custObj = uniqueCustomers.find(c => c.id === selectedCustomer || c.name === selectedCustomer);
                    if(custObj) onShowCustomerStatement(custObj.name, custObj.id, startDate, endDate);
                }} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-primary text-white rounded hover:bg-primary/90 text-xs font-bold shadow-sm">
                    <BookOpen className="w-3 h-3" /> Buka Kartu Piutang
                </button>
            ) : (
                <button onClick={clearFilters} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 text-xs">Clear Filters</button>
            )}
        </div>
      </div>

      <div id="ledger-content" className="bg-white p-2">
          <SummaryCards />

          {/* Mobile View: Card Layout (Tetap Tampil di Layar Mobile) */}
          <div className="md:hidden space-y-3">
            {customerSummary.map((row) => (
                <div key={row.id || row.customer} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                    <div className="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
                        <div>
                            <div className="font-bold text-blue-800 text-sm">{row.customer}</div>
                            <div className="text-[10px] text-slate-400">{row.transactionCount} Transaksi</div>
                        </div>
                        <button 
                            onClick={() => {
                                const custObj = uniqueCustomers.find(c => c.id === row.id || c.name === row.customer);
                                if(custObj) onShowCustomerStatement(custObj.name, custObj.id, startDate, endDate);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:text-blue-600 text-[10px] font-bold shadow-sm"
                        >
                            Kartu <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                        <div>
                            <div className="text-[10px] text-slate-500 uppercase">Sales (Periode)</div>
                            <div className="font-mono text-slate-700">{formatCurrency(row.periodSales)}</div>
                        </div>
                        
                        <div className="text-right">
                            <div className="text-[10px] text-slate-500 uppercase">Total Tagihan</div>
                            <div className="font-mono font-semibold text-slate-800">{formatCurrency(row.remainingBalance + row.totalPaid)}</div>
                        </div>

                        <div>
                            <div className="text-[10px] text-green-600 uppercase">Total Bayar</div>
                            <div className="font-mono font-bold text-green-700">{formatCurrency(row.totalPaid)}</div>
                        </div>

                        <div className="text-right">
                            <div className="text-[10px] text-red-600 uppercase">Sisa / Balance</div>
                            <div className={`font-mono font-bold text-base ${row.remainingBalance < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {row.remainingBalance < 0 ? `+${formatCurrency(Math.abs(row.remainingBalance))}` : formatCurrency(row.remainingBalance)}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
            {customerSummary.length === 0 && (
                <div className="p-6 text-center text-slate-400 italic">No data found.</div>
            )}
          </div>

          {/* Desktop View: Compact Table Layout (Tetap Tampil di Layar PC) */}
          <DesktopTable />
      </div>
    </div>
  );
};

export default LedgerTable;