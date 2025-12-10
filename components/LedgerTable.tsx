
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
  const [viewMode, setViewMode] = useState<'SUMMARY' | 'DETAIL'>('SUMMARY');

  // Extract unique customers based on ID if available, or Name if not
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
      
      // Match ID or Name
      const matchCustomer = selectedCustomer === 'ALL' || 
                            (row.customerId === selectedCustomer) || 
                            (row.customer === selectedCustomer);
                            
      const matchStart = !start || rowDate >= start;
      const matchEnd = !end || rowDate <= end;
      return matchCustomer && matchStart && matchEnd;
    });
  }, [data, startDate, endDate, selectedCustomer]);

  // NEW CALCULATION LOGIC:
  // Group by ID to ensure payments match invoices
  const customerSummary = useMemo(() => {
    // 1. Determine which customers to process
    let targetCustomers = uniqueCustomers;
    if (selectedCustomer !== 'ALL') {
        targetCustomers = uniqueCustomers.filter(c => (c.id === selectedCustomer) || (c.name === selectedCustomer));
    }

    return targetCustomers.map(cust => {
        // Robust Filtering by ID primarily, Name fallback
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

        // Current Filtered View (for "Total Sales in this period")
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
  const totalMortalityKg = filteredData.reduce((acc, row) => acc + row.mortalityKg, 0);

  const handlePrintRecap = () => {
    window.print();
  };

  const handleDownloadImage = () => {
    downloadAsImage('ledger-content', `Ledger_Recap_${selectedCustomer}`);
  };

  const clearFilters = () => {
      setStartDate('');
      setEndDate('');
      setSelectedCustomer('ALL');
  };

  const handleDrillDown = (customerName: string, customerId: string) => {
      // Pass ID if available
      const key = customerId || customerName;
      setSelectedCustomer(key);
      onShowCustomerStatement(customerName, customerId, '', '');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 print:hidden">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">Ledger Piutang (A/R)</h2>
            <p className="text-sm text-slate-500">Monitor pembayaran dan sisa tagihan customer (Sistem Saldo Berjalan)</p>
        </div>
        <div className="flex flex-wrap gap-2">
             <button 
                onClick={handleDownloadImage}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-sm text-sm"
            >
                <ImageDown className="w-4 h-4" />
                Download JPG
            </button>
            <button 
                onClick={handlePrintRecap}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition-colors shadow-sm text-sm"
                title="Save as PDF using the browser print dialog"
            >
                <FileText className="w-4 h-4" />
                Print / Save PDF View
            </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 print:hidden">
        <div className="flex items-center justify-between mb-3">
             <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <Filter className="w-4 h-4" /> Filter Data
            </div>
            {viewMode === 'DETAIL' && (
                 <button 
                    onClick={() => {
                        setViewMode('SUMMARY');
                        setSelectedCustomer('ALL');
                    }}
                    className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 px-3 py-1 rounded bg-slate-100 border border-slate-300"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Summary
                </button>
            )}
        </div>
       
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Dari Tanggal</label>
                <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-md border-slate-300 text-sm p-2 border"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Sampai Tanggal</label>
                <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-md border-slate-300 text-sm p-2 border"
                />
            </div>
            <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Customer</label>
                <select 
                    value={selectedCustomer}
                    onChange={(e) => {
                        setSelectedCustomer(e.target.value);
                    }}
                    className="w-full rounded-md border-slate-300 text-sm p-2 border"
                >
                    <option value="ALL">-- Semua Customer --</option>
                    {uniqueCustomers.map(c => (
                        <option key={c.id || c.name} value={c.id || c.name}>{c.name}</option>
                    ))}
                </select>
            </div>
            <div>
                {selectedCustomer !== 'ALL' ? (
                     <button 
                        onClick={() => {
                            const custObj = uniqueCustomers.find(c => c.id === selectedCustomer || c.name === selectedCustomer);
                            if(custObj) onShowCustomerStatement(custObj.name, custObj.id, startDate, endDate);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded-md hover:bg-primary/90 text-sm shadow-sm animate-pulse"
                    >
                        <BookOpen className="w-4 h-4" />
                        Lihat Kartu Piutang
                    </button>
                ) : (
                     <button 
                        onClick={clearFilters}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-slate-300 rounded-md text-slate-600 hover:bg-slate-50 text-sm"
                    >
                        Clear Filters
                    </button>
                )}
               
            </div>
        </div>
      </div>

      <div id="ledger-content" className="space-y-6 print:p-0 bg-white p-4">
          <div className="hidden print:block mb-8 border-b-2 border-slate-800 pb-4">
              <h1 className="text-3xl font-bold text-slate-900 uppercase">
                  {viewMode === 'SUMMARY' ? 'Rekapitulasi Piutang Customer' : 'Detail Transaksi Piutang'}
              </h1>
              <div className="flex justify-between mt-2">
                <div className="text-sm text-slate-600">
                    <span className="font-bold">Periode:</span> {startDate ? formatDate(startDate) : 'Awal'} s/d {endDate ? formatDate(endDate) : 'Sekarang'}
                </div>
              </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:gap-4 print:mb-6">
            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500 print:border print:shadow-none print:bg-slate-50 text-center md:text-left">
                <div className="text-slate-500 text-xs uppercase font-bold">Sales Periode Ini</div>
                <div className="text-xl font-bold text-slate-800">{formatCurrency(totalSales)}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500 print:border print:shadow-none print:bg-slate-50 text-center md:text-left">
                <div className="text-slate-500 text-xs uppercase font-bold">Total Sisa Piutang</div>
                <div className={`text-xl font-bold ${totalReceivable < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalReceivable < 0 ? `+${formatCurrency(Math.abs(totalReceivable))} (Deposit)` : formatCurrency(totalReceivable)}
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500 print:border print:shadow-none print:bg-slate-50 text-center md:text-left">
                <div className="text-slate-500 text-xs uppercase font-bold">Nilai Kematian ({totalMortalityKg.toFixed(1)}kg)</div>
                <div className="text-xl font-bold text-orange-600">{formatCurrency(totalMortalityVal)}</div>
            </div>
          </div>

          {viewMode === 'SUMMARY' && (
            <div className="bg-white rounded-lg shadow overflow-hidden border border-slate-200 print:shadow-none print:border-black">
                <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-500" />
                    <h3 className="font-bold text-slate-700 uppercase text-sm">Rekap Customer (Balance Summary)</h3>
                </div>
                <div className="overflow-auto max-h-[75vh] relative">
                    <table className="min-w-full divide-y divide-slate-200 text-sm print:divide-black">
                        <thead className="bg-slate-50 print:bg-slate-200 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 text-left font-bold text-slate-800 uppercase border-b w-1/3">Customer Name</th>
                                <th className="px-4 py-3 text-right font-bold text-slate-600 uppercase border-b">Period Sales</th>
                                <th className="px-4 py-3 text-right font-bold text-slate-900 uppercase border-b">Total Tagihan (All Time)</th>
                                <th className="px-4 py-3 text-right font-bold text-green-700 uppercase border-b">Total Bayar (All Time)</th>
                                <th className="px-4 py-3 text-right font-bold text-red-600 uppercase border-b">Sisa / Balance</th>
                                <th className="px-4 py-3 text-center font-bold text-slate-600 uppercase border-b print:hidden">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200 print:divide-black">
                            {customerSummary.map((row) => (
                                <tr key={row.id || row.customer} className="hover:bg-blue-50 transition-colors">
                                    <td className="px-4 py-4 font-bold text-blue-800 text-base">
                                        {row.customer}
                                        <div className="text-xs font-normal text-slate-500">{row.transactionCount} Transaksi Periode Ini</div>
                                    </td>
                                    <td className="px-4 py-4 text-right text-slate-500">{formatCurrency(row.periodSales)}</td>
                                    <td className="px-4 py-4 text-right font-semibold">{formatCurrency(row.remainingBalance + row.totalPaid)}</td>
                                    <td className="px-4 py-4 text-right font-semibold text-green-700">{formatCurrency(row.totalPaid)}</td>
                                    <td className={`px-4 py-4 text-right font-bold ${row.remainingBalance < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {row.remainingBalance < 0 ? `+${formatCurrency(Math.abs(row.remainingBalance))}` : formatCurrency(row.remainingBalance)}
                                    </td>
                                    <td className="px-4 py-4 text-center print:hidden">
                                        <button 
                                            onClick={() => handleDrillDown(row.customer, row.id)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded text-slate-600 hover:text-blue-600 hover:border-blue-300 text-xs font-medium shadow-sm transition-all"
                                        >
                                            Kartu Piutang <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {customerSummary.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                                        No data found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          )}

          {viewMode === 'DETAIL' && (
             <div className="p-10 text-center text-slate-500 bg-slate-50 rounded border border-dashed">
                 <p className="mb-2 font-bold">Tampilan Detail Invoice sudah digantikan dengan Kartu Piutang.</p>
                 <button onClick={() => setViewMode('SUMMARY')} className="text-blue-600 underline">Kembali ke Summary</button>
             </div>
          )}
      </div>
    </div>
  );
};

export default LedgerTable;
