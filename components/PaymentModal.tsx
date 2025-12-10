import React, { useState } from 'react';
import { SaleRecord, Payment } from '../types';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils';

interface PaymentModalProps {
  sale: SaleRecord | null;
  onClose: () => void;
  onAddPayment: (saleId: string, amount: number, date: string, method: 'CASH' | 'TRANSFER') => void;
  onDeletePayment?: (saleId: string, paymentId: string) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ sale, onClose, onAddPayment, onDeletePayment }) => {
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<'CASH' | 'TRANSFER'>('TRANSFER');

  if (!sale) return null;

  // Calculate totals
  const netKg = Math.max(0, sale.soldKg - sale.mortalityKg);
  const totalInvoice = netKg * sale.sellPrice;
  const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalInvoice - totalPaid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount && amount > 0) {
        onAddPayment(sale.id, Number(amount), date, method);
        setAmount(''); // Reset form
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 print:hidden">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-800 text-white p-6 flex justify-between items-start">
            <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                   💳 Rincian Pembayaran
                </h2>
                <div className="text-slate-300 text-sm mt-1">
                    Customer: <span className="font-bold text-white">{sale.customerName}</span>
                </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>

        <div className="p-6 overflow-y-auto">
            {/* Invoice Summary */}
            <div className="grid grid-cols-3 gap-4 mb-8 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                    <div className="text-xs text-slate-500 uppercase font-bold">Total Tagihan</div>
                    <div className="text-lg font-bold text-slate-800">{formatCurrency(totalInvoice)}</div>
                </div>
                <div>
                    <div className="text-xs text-slate-500 uppercase font-bold">Sudah Dibayar</div>
                    <div className="text-lg font-bold text-green-600">{formatCurrency(totalPaid)}</div>
                </div>
                <div>
                    <div className="text-xs text-slate-500 uppercase font-bold">
                        {remaining < 0 ? 'Deposit / Simpanan' : 'Sisa Piutang'}
                    </div>
                    <div className={`text-lg font-bold ${remaining < 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {remaining < 0 ? `+${formatCurrency(Math.abs(remaining))}` : formatCurrency(remaining)}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Input Payment */}
                <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">Input Pembayaran Baru</h3>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal Bayar</label>
                            <input 
                                type="date" 
                                required
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full border-slate-300 rounded-md text-sm p-2 border"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Metode</label>
                            <select 
                                value={method}
                                onChange={(e) => setMethod(e.target.value as any)}
                                className="w-full border-slate-300 rounded-md text-sm p-2 border"
                            >
                                <option value="TRANSFER">TRANSFER</option>
                                <option value="CASH">CASH</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Jumlah (Rp)</label>
                            <input 
                                type="number" 
                                required
                                min="1"
                                // Removed max={remaining} to allow overpayment/deposit
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value))}
                                className="w-full border-slate-300 rounded-md text-sm p-2 border"
                                placeholder="Input amount..."
                            />
                            {remaining < 0 && (
                                <p className="text-xs text-green-600 mt-1 italic">
                                    * Menambah deposit (Tabungan)
                                </p>
                            )}
                        </div>
                        <button 
                            type="submit"
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" /> Simpan Pembayaran
                        </button>
                    </form>
                </div>

                {/* Right: Payment History */}
                <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">Riwayat Transaksi (History)</h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {sale.payments.length === 0 ? (
                            <div className="text-sm text-slate-400 italic">Belum ada pembayaran.</div>
                        ) : (
                            sale.payments.map((payment, idx) => (
                                <div key={payment.id} className="flex justify-between items-center bg-white border border-slate-200 p-2 rounded hover:shadow-sm">
                                    <div>
                                        <div className="text-xs font-bold text-slate-700">{formatDate(payment.date)}</div>
                                        <div className="text-[10px] text-slate-500 uppercase tracking-wide">{payment.method}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-mono font-bold text-green-700">
                                            {formatCurrency(payment.amount)}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;