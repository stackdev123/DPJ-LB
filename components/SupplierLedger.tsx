
import React, { useState, useMemo } from 'react';
import { PurchaseRecord, SaleRecord, SupplierPayment, User } from '../types';
import { formatCurrency, formatDate, downloadAsImage } from '../utils';
import { Search, ChevronRight, Truck, Wallet, Plus, Save, ArrowLeft, Printer, ImageDown, Filter, FileText } from 'lucide-react';
import * as Storage from '../services/storageService';
import { v4 as uuidv4 } from 'uuid';
import SupplierStatementModal from './SupplierStatementModal';
import { logActivity } from '../services/logService';

interface SupplierLedgerProps {
  purchases: PurchaseRecord[];
  payments: SupplierPayment[];
  sales: SaleRecord[];
  onPaymentSaved: () => void;
  user: User;
}

const SupplierLedger: React.FC<SupplierLedgerProps> = ({ purchases, payments, sales, onPaymentSaved, user }) => {
  const [selectedSupplierName, setSelectedSupplierName] = useState<string | null>(null);
  
  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Payment Form State (Modal)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState<'TRANSFER' | 'CASH'>('TRANSFER');
  const [payNotes, setPayNotes] = useState('');

  // --- 1. CALCULATE SUMMARY DATA ---
  const supplierSummary = useMemo(() => {
    const summary: Record<string, { 
      name: string; 
      totalPurchase: number; 
      totalPaid: number;
      purchaseCount: number;
      periodPurchase: number;
      periodPaid: number;
    }> = {};

    // Get all unique names first
    const allNames = new Set([
        ...purchases.map(p => p.supplier || 'Tanpa Supplier'),
        ...payments.map(p => p.supplierName || 'Tanpa Supplier')
    ]);

    allNames.forEach(name => {
        summary[name] = { 
            name, 
            totalPurchase: 0, 
            totalPaid: 0, 
            purchaseCount: 0,
            periodPurchase: 0,
            periodPaid: 0
        };
    });

    // Process Purchases
    purchases.forEach(p => {
        const name = p.supplier || 'Tanpa Supplier';
        const pDate = new Date(p.date);
        const start = startDate ? new Date(startDate) : new Date('1900-01-01');
        const end = endDate ? new Date(endDate) : new Date('2100-01-01');
        
        // All Time Accumulation
        summary[name].totalPurchase += (p.totalBuyCost || 0);
        summary[name].purchaseCount += 1;

        // Period Accumulation
        if (pDate >= start && pDate <= end) {
            summary[name].periodPurchase += (p.totalBuyCost || 0);
        }
    });

    // Process Payments
    payments.forEach(pay => {
        const name = pay.supplierName || 'Tanpa Supplier';
        const pDate = new Date(pay.date);
        const start = startDate ? new Date(startDate) : new Date('1900-01-01');
        const end = endDate ? new Date(endDate) : new Date('2100-01-01');

        summary[name].totalPaid += (pay.amount || 0);

        if (pDate >= start && pDate <= end) {
            summary[name].periodPaid += (pay.amount || 0);
        }
    });

    // Convert to Array and Filter by Search
    return Object.values(summary)
        .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            const balA = a.totalPurchase - a.totalPaid;
            const balB = b.totalPurchase - b.totalPaid;
            return balB - balA; // Sort by Debt Amount Descending
        });
  }, [purchases, payments, startDate, endDate, searchTerm]);

  const handleSavePayment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (selectedSupplierName && payAmount && payAmount > 0) {
          const newPayment: SupplierPayment = {
              id: uuidv4(),
              date: payDate,
              supplierName: selectedSupplierName,
              amount: Number(payAmount),
              method: payMethod,
              notes: payNotes
          };
          
          await Storage.saveSupplierPayment(newPayment);

          // Log Activity
          await logActivity(user, 'CREATE', 'SUPPLIER_PAYMENT', `Paid ${formatCurrency(Number(payAmount))} to ${selectedSupplierName}`, newPayment.id);
          
          onPaymentSaved();
          
          setPayAmount('');
          setPayNotes('');
          setIsPaymentModalOpen(false);
          alert('Pembayaran berhasil disimpan');
      }
  };

  const handleDownloadSummary = () => {
    downloadAsImage('supplier-summary-table', 'Rekap_Hutang_Supplier');
  }

  return (
    <div className="space-y-6">
       {/* Header Section */}
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 print:hidden">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Truck className="w-6 h-6 text-indigo-600" />
                Hutang Supplier (Accounts Payable)
            </h2>
            <p className="text-sm text-slate-500">Monitor hutang dagang ke supplier ayam.</p>
        </div>
        
        <div className="flex gap-2">
             <button onClick={handleDownloadSummary} className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 shadow-sm">
                <ImageDown className="w-4 h-4" /> Save Recap JPG
             </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 print:hidden">
          <div className="flex items-center gap-2 text-slate-700 font-semibold mb-3">
                <Filter className="w-4 h-4" /> Filter & Periode
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Dari Tanggal</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full text-sm border-slate-300 rounded p-2" />
              </div>
              <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Sampai Tanggal</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full text-sm border-slate-300 rounded p-2" />
              </div>
              <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Cari Supplier</label>
                  <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Nama Supplier..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="w-full pl-9 pr-4 py-2 border-slate-300 rounded text-sm"
                      />
                  </div>
              </div>
          </div>
      </div>

      <div id="supplier-summary-table" className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 print:border-none print:shadow-none">
          {/* SUMMARY TABLE */}
          <div className="overflow-auto max-h-[75vh] border-b border-slate-200 relative">
                <div className="hidden print:block mb-4 text-center">
                    <h1 className="text-xl font-bold uppercase">Rekap Saldo Hutang Supplier</h1>
                    <p className="text-sm">Periode: {startDate || 'Awal'} s/d {endDate || 'Sekarang'}</p>
                </div>
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-indigo-900 text-white uppercase text-xs font-bold sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="p-3">Nama Supplier</th>
                            <th className="p-3 text-right">Beli (Periode)</th>
                            <th className="p-3 text-right">Bayar (Periode)</th>
                            <th className="p-3 text-right">Total Beli (All Time)</th>
                            <th className="p-3 text-right">Total Bayar (All Time)</th>
                            <th className="p-3 text-right bg-indigo-800">Sisa Hutang</th>
                            <th className="p-3 text-center print:hidden">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {supplierSummary.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-400 italic">Data tidak ditemukan.</td></tr>
                        ) : (
                            supplierSummary.map((s, idx) => {
                                const balance = s.totalPurchase - s.totalPaid;
                                return (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="p-3 font-bold text-slate-700">{s.name}</td>
                                    <td className="p-3 text-right text-slate-500">{formatCurrency(s.periodPurchase)}</td>
                                    <td className="p-3 text-right text-green-600">{formatCurrency(s.periodPaid)}</td>
                                    <td className="p-3 text-right font-mono">{formatCurrency(s.totalPurchase)}</td>
                                    <td className="p-3 text-right font-mono text-green-700">{formatCurrency(s.totalPaid)}</td>
                                    <td className={`p-3 text-right font-mono font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {formatCurrency(balance)}
                                    </td>
                                    <td className="p-3 text-center print:hidden">
                                        <button 
                                            onClick={() => setSelectedSupplierName(s.name)}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-indigo-600 hover:bg-indigo-50 shadow-sm"
                                        >
                                            Kartu Hutang <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </td>
                                </tr>
                                );
                            })
                        )}
                    </tbody>
                    {supplierSummary.length > 0 && (
                    <tfoot className="bg-slate-100 font-bold text-xs uppercase border-t-2 border-slate-300">
                        <tr>
                            <td className="p-3 text-right">Grand Total:</td>
                            <td className="p-3 text-right">{formatCurrency(supplierSummary.reduce((a,b)=>a+b.periodPurchase,0))}</td>
                            <td className="p-3 text-right">{formatCurrency(supplierSummary.reduce((a,b)=>a+b.periodPaid,0))}</td>
                            <td className="p-3 text-right">{formatCurrency(supplierSummary.reduce((a,b)=>a+b.totalPurchase,0))}</td>
                            <td className="p-3 text-right">{formatCurrency(supplierSummary.reduce((a,b)=>a+b.totalPaid,0))}</td>
                            <td className="p-3 text-right text-red-600">{formatCurrency(supplierSummary.reduce((a,b)=>a+(b.totalPurchase-b.totalPaid),0))}</td>
                            <td className="print:hidden"></td>
                        </tr>
                    </tfoot>
                    )}
                </table>
          </div>
      </div>

      {/* POPUP: DETAIL STATEMENT MODAL */}
      {selectedSupplierName && (
        <SupplierStatementModal
            supplierName={selectedSupplierName}
            purchases={purchases.filter(p => (p.supplier || 'Tanpa Supplier') === selectedSupplierName)}
            payments={payments.filter(p => (p.supplierName || 'Tanpa Supplier') === selectedSupplierName)}
            sales={sales}
            startDate={startDate}
            endDate={endDate}
            onClose={() => setSelectedSupplierName(null)}
            onOpenPayment={() => setIsPaymentModalOpen(true)}
            user={user}
            onRefresh={onPaymentSaved}
        />
      )}

      {/* POPUP: PAYMENT FORM MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-indigo-600" />
                    Input Pembayaran ke Supplier
                </h3>
                <div className="mb-4 p-3 bg-indigo-50 rounded text-sm text-indigo-900 border border-indigo-100">
                    Supplier: <strong>{selectedSupplierName}</strong>
                </div>
                <form onSubmit={handleSavePayment} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal Bayar</label>
                        <input type="date" required value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full border-slate-300 rounded p-2 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Jumlah Bayar (Rp)</label>
                        <input type="number" required min="1" value={payAmount} onChange={e => setPayAmount(parseFloat(e.target.value))} className="w-full border-slate-300 rounded p-2 font-bold text-lg" placeholder="0" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Metode Pembayaran</label>
                        <select value={payMethod} onChange={e => setPayMethod(e.target.value as any)} className="w-full border-slate-300 rounded p-2 text-sm">
                            <option value="TRANSFER">Transfer Bank</option>
                            <option value="CASH">Tunai (Cash)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Catatan / Keterangan</label>
                        <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} className="w-full border-slate-300 rounded p-2 text-sm" placeholder="Contoh: Lunas PO tgl..." />
                    </div>
                    <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 mt-4">
                        <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 border rounded hover:bg-slate-50 text-sm font-medium">Batal</button>
                        <button type="submit" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-md text-sm font-bold flex items-center gap-2">
                            <Save className="w-4 h-4" /> Simpan Pembayaran
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default SupplierLedger;
