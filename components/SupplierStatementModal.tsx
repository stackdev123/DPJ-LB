import React, { useMemo, useState } from 'react';
import { PurchaseRecord, SaleRecord, SupplierPayment, User } from '../types';
import { X, Printer, ImageDown, Plus, Trash2 } from 'lucide-react';
import { formatDate, formatCurrency, downloadAsImage } from '../utils';
import * as Storage from '../services/storageService';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { logActivity } from '../services/logService';

interface SupplierStatementModalProps {
  supplierName: string;
  purchases: PurchaseRecord[];
  payments: SupplierPayment[];
  sales: SaleRecord[];
  startDate?: string;
  endDate?: string;
  onClose: () => void;
  onOpenPayment: () => void;
  user: User;
  onRefresh: () => void;
}

const SupplierStatementModal: React.FC<SupplierStatementModalProps> = ({ 
  supplierName, 
  purchases, 
  payments, 
  sales,
  startDate, 
  endDate, 
  onClose,
  onOpenPayment,
  user,
  onRefresh
}) => {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Generate Chronological Data
  const { rows, openingBalance, closingBalance, totalDebit, totalCredit } = useMemo(() => {
    const txs: Array<{
        id: string;
        date: string;
        type: 'PURCHASE' | 'PAYMENT';
        description: string;
        debit: number; // Hutang Bertambah (Beli)
        credit: number; // Hutang Berkurang (Bayar)
    }> = [];

    // 1. Add Purchases (Increase Debt)
    purchases.forEach(p => {
        // Find linked sales to get mortality info
        const linkedSales = sales.filter(s => s.purchaseId === p.id);
        const totalMortalityHeads = linkedSales.reduce((acc, s) => acc + (s.mortalityHeads || 0), 0);
        const totalMortalityKg = linkedSales.reduce((acc, s) => acc + (s.mortalityKg || 0), 0);

        // Remove "PO :" or "PO:" if present, case insensitive
        const cleanCoop = (p.coop || 'Kdg Umum').replace(/PO\s*:?/gi, '').trim();
        let desc = `${cleanCoop} | ${p.kg.toLocaleString()} Kg`;
        
        if (totalMortalityKg > 0) {
            desc += ` | Mati: ${totalMortalityHeads}E (${totalMortalityKg}Kg)`;
        }

        txs.push({
            id: p.id,
            date: p.date,
            type: 'PURCHASE',
            description: desc,
            debit: p.totalBuyCost,
            credit: 0
        });
    });

    // 2. Add Payments (Decrease Debt)
    payments.forEach(p => {
        txs.push({
            id: p.id,
            date: p.date,
            type: 'PAYMENT',
            description: `BYR: ${p.method} - ${p.notes || ''}`,
            debit: 0,
            credit: p.amount
        });
    });

    // 3. Sort Chronologically
    txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 4. Calculate Balances & Filter by Date
    let runningBalance = 0;
    let openBal = 0;
    
    let tDebit = 0;
    let tCredit = 0;

    const startTs = startDate ? new Date(startDate).getTime() : 0;
    const endTs = endDate ? new Date(endDate).getTime() : Number.MAX_SAFE_INTEGER;

    const finalRows: Array<typeof txs[0] & { balance: number }> = [];

    txs.forEach(tx => {
        const txTs = new Date(tx.date).getTime();
        
        // REVISI LOGIC: Balance = Credit (Bayar) - Debit (Beli)
        // If Beli > Bayar, result is Negative (Hutang)
        const netChange = tx.credit - tx.debit;

        if (txTs < startTs) {
            openBal += netChange;
            runningBalance += netChange;
        } else if (txTs <= endTs) {
            runningBalance += netChange;
            tDebit += tx.debit;
            tCredit += tx.credit;
            
            finalRows.push({
                ...tx,
                balance: runningBalance
            });
        }
    });

    return { 
        rows: finalRows, 
        openingBalance: openBal, 
        closingBalance: runningBalance,
        totalDebit: tDebit,
        totalCredit: tCredit
    };
  }, [purchases, payments, sales, startDate, endDate]);

  const handlePrint = () => window.print();
  const handleDownload = () => downloadAsImage('supplier-statement-area', `Hutang_${supplierName}`);

  const initiateDelete = (id: string) => {
      setItemToDelete(id);
      setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if(itemToDelete) {
        await Storage.deleteSupplierPayment(itemToDelete);
        
        // Log Activity
        await logActivity(user, 'DELETE', 'SUPPLIER_PAYMENT', `Deleted payment to ${supplierName}`, itemToDelete);

        setItemToDelete(null);
        onRefresh();
    }
  }

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 backdrop-blur-sm print:bg-white print:p-0 print:static print:block">
      
      {/* Floating Action Buttons */}
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-[101]">
        <button 
            onClick={onOpenPayment}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2 text-sm font-bold"
        >
            <Plus className="w-4 h-4" /> Input Bayar
        </button>
        <button 
          onClick={handleDownload}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2 text-sm font-bold"
        >
          <ImageDown className="w-4 h-4" /> Save JPG
        </button>
        <button 
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2 text-sm font-bold"
        >
          <Printer className="w-4 h-4" /> Print
        </button>
        <button 
          onClick={onClose}
          className="bg-white hover:bg-gray-100 text-gray-800 px-4 py-2 rounded shadow-lg flex items-center gap-2 text-sm font-bold"
        >
          <X className="w-4 h-4" /> Close
        </button>
      </div>

      <div className="flex min-h-full items-center justify-center p-4">
        <div 
            id="supplier-statement-area"
            className="bg-white w-full max-w-5xl p-6 md:p-10 shadow-2xl rounded-lg mx-auto my-8 relative print:shadow-none print:m-0 print:w-full print:max-w-none print:p-0"
        >
             {/* Header Section */}
             <div className="mb-6 pb-6 border-b-2 border-slate-800">
                <div className="flex justify-between items-start">
                    <div className="flex gap-4 items-center">
                    <img src="/logo.png" alt="Logo" className="h-16 w-auto object-contain" />
                    <div>
                        <h1 className="text-2xl font-bold uppercase text-slate-800">KARTU HUTANG SUPPLIER</h1>
                        <h2 className="text-xl font-bold text-indigo-700 mt-1">{supplierName}</h2>
                        <div className="text-xs text-slate-500 mt-1">CV. DPJ Berkah Unggas</div>
                    </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-slate-500 uppercase font-bold">Periode Laporan</div>
                        <div className="font-mono text-sm font-bold bg-slate-100 px-2 py-1 rounded">
                            {startDate ? formatDate(startDate) : 'Awal'} s/d {endDate ? formatDate(endDate) : 'Sekarang'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                    <div className="text-xs text-slate-500 uppercase font-bold">Saldo Awal</div>
                    <div className={`font-bold ${openingBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(openingBalance)}
                    </div>
                </div>
                <div className="p-3 bg-white rounded border border-slate-200">
                    <div className="text-xs text-slate-500 uppercase font-bold">Beli</div>
                    <div className="font-bold text-slate-800">{formatCurrency(totalDebit)}</div>
                </div>
                <div className="p-3 bg-white rounded border border-slate-200">
                    <div className="text-xs text-slate-500 uppercase font-bold">Bayar</div>
                    <div className="font-bold text-green-700">{formatCurrency(totalCredit)}</div>
                </div>
                <div className="p-3 bg-indigo-50 rounded border border-indigo-200">
                    <div className="text-xs text-indigo-800 uppercase font-bold">Sisa Hutang Akhir</div>
                    <div className={`text-lg font-bold ${closingBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(closingBalance)}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-lg border border-slate-200 print:border-black">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs print:bg-slate-200 print:text-black">
                        <tr>
                            <th className="p-3 border-b text-center">Tanggal</th>
                            <th className="p-3 border-b">Keterangan / Ref</th>
                            <th className="p-3 border-b text-right">Tagihan (Debit)</th>
                            <th className="p-3 border-b text-right">Pembayaran (Credit)</th>
                            <th className="p-3 border-b text-right bg-slate-200 print:bg-slate-300">Saldo Hutang</th>
                            <th className="p-3 border-b w-10 print:hidden"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Opening Balance Row */}
                        <tr className="bg-slate-50 italic text-slate-500">
                            <td className="p-3 text-center" colSpan={2}>Saldo Awal (Brought Forward)</td>
                            <td className="p-3 text-center">-</td>
                            <td className="p-3 text-center">-</td>
                            <td className={`p-3 text-right font-mono font-bold ${openingBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(openingBalance)}
                            </td>
                            <td className="print:hidden"></td>
                        </tr>
                        
                        {rows.map(row => (
                            <tr key={row.id} className="hover:bg-slate-50 border-b border-slate-100">
                                <td className="p-3 whitespace-nowrap text-center">{formatDate(row.date)}</td>
                                <td className="p-3">
                                    <div className="font-medium text-slate-800">{row.description}</div>
                                    <div className={`text-[10px] font-bold uppercase tracking-wide inline-block px-1 rounded ${row.type === 'PURCHASE' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                        {row.type === 'PURCHASE' ? 'BELI' : 'BAYAR'}
                                    </div>
                                </td>
                                <td className="p-3 text-right font-mono text-slate-700">
                                    {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                                </td>
                                <td className="p-3 text-right font-mono text-green-700 font-semibold">
                                    {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                                </td>
                                <td className={`p-3 text-right font-mono font-bold bg-slate-50/50 ${row.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(row.balance)}
                                </td>
                                <td className="p-3 text-center print:hidden">
                                    {/* Only allow deleting payments for now, as deleting purchase is complex */}
                                    {isSuperAdmin && row.type === 'PAYMENT' && (
                                        <button 
                                            onClick={() => initiateDelete(row.id)}
                                            className="text-slate-300 hover:text-red-600"
                                            title="Hapus Pembayaran"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}

                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-400 italic">Tidak ada transaksi pada periode ini.</td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                        <tr>
                            <td colSpan={2} className="p-3 text-right uppercase text-xs text-slate-500">Total Periode</td>
                            <td className="p-3 text-right font-mono">{formatCurrency(totalDebit)}</td>
                            <td className="p-3 text-right font-mono text-green-700">{formatCurrency(totalCredit)}</td>
                            <td className={`p-3 text-right font-mono ${closingBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(closingBalance)}
                            </td>
                            <td className="print:hidden"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="mt-8 text-xs text-slate-400 text-center print:block hidden">
                Dicetak pada: {new Date().toLocaleString('id-ID')}
            </div>

        </div>
      </div>
      
      <DeleteConfirmationModal 
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Hapus Pembayaran Supplier"
        message="Anda yakin ingin menghapus data pembayaran ini? Saldo hutang supplier akan kembali bertambah."
        username={user.username}
      />
    </div>
  );
};

export default SupplierStatementModal;