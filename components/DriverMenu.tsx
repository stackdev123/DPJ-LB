
import React, { useState, useMemo, useEffect } from 'react';
import { PurchaseRecord, SaleRecord, DriverTransaction } from '../types';
import { saveDriverTransaction, getDriverTransactions } from '../services/storageService';
import { User, Wallet, PlusCircle, ArrowUpRight, ArrowDownLeft, Search, ArrowLeft } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils';
import { v4 as uuidv4 } from 'uuid';

interface DriverMenuProps {
  purchases: PurchaseRecord[];
  sales: SaleRecord[];
}

const DriverMenu: React.FC<DriverMenuProps> = ({ purchases, sales }) => {
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDetailMobile, setShowDetailMobile] = useState(false);
  
  // Transaction Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [txType, setTxType] = useState<'PAYMENT' | 'MANUAL_BON'>('PAYMENT');
  const [txAmount, setTxAmount] = useState<number | ''>('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txNotes, setTxNotes] = useState('');

  // Load manual transactions
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [driverTxList, setDriverTxList] = useState<DriverTransaction[]>([]);

  useEffect(() => {
    const loadTx = async () => {
        setDriverTxList(await getDriverTransactions());
    };
    loadTx();
  }, [refreshTrigger]);

  // 1. Get List of Unique Drivers from Purchases
  // We also check driverTxList for drivers who might not be in purchases (rare but possible with manual data)
  const driversSummary = useMemo(() => {
    const drivers = new Set<string>();
    purchases.forEach(p => { if (p.driver) drivers.add(p.driver) });
    driverTxList.forEach(tx => drivers.add(tx.driverName));

    const summaryList = Array.from(drivers).map(driverName => {
      // A. Calculate Debt from Trips (Bon Sopir from Sales)
      // Find purchases by this driver
      const driverPurchases = purchases.filter(p => p.driver === driverName);
      // Find sales linked to those purchases
      let tripBonTotal = 0;
      driverPurchases.forEach(p => {
        const linkedSales = sales.filter(s => s.purchaseId === p.id);
        linkedSales.forEach(s => {
          tripBonTotal += (s.driverBonus || 0);
        });
      });

      // B. Calculate Manual Debt/Payments
      const txs = driverTxList.filter(tx => tx.driverName === driverName);
      const manualBonTotal = txs.filter(t => t.type === 'MANUAL_BON').reduce((acc, t) => acc + t.amount, 0);
      const paidTotal = txs.filter(t => t.type === 'PAYMENT').reduce((acc, t) => acc + t.amount, 0);

      const totalDebt = tripBonTotal + manualBonTotal;
      const balance = totalDebt - paidTotal; // Positive means driver owes money

      return {
        name: driverName,
        totalDebt,
        totalPaid: paidTotal,
        balance,
        tripCount: driverPurchases.length
      };
    });

    return summaryList.sort((a, b) => b.balance - a.balance); // Highest debt first
  }, [purchases, sales, driverTxList]);

  const filteredDrivers = driversSummary.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeDriverData = selectedDriver 
    ? driversSummary.find(d => d.name === selectedDriver) 
    : null;

  // Generate Chronological History for Selected Driver
  const driverHistory = useMemo(() => {
    if (!selectedDriver) return [];
    const history: Array<{
        date: string;
        type: 'TRIP_BON' | 'MANUAL_BON' | 'PAYMENT';
        description: string;
        amount: number;
        originalRef?: any;
    }> = [];

    // 1. Trip Bons
    const driverPurchases = purchases.filter(p => p.driver === selectedDriver);
    driverPurchases.forEach(p => {
        const linkedSales = sales.filter(s => s.purchaseId === p.id);
        linkedSales.forEach(s => {
            if (s.driverBonus && s.driverBonus > 0) {
                history.push({
                    date: s.date,
                    type: 'TRIP_BON',
                    description: `Bon Trip: ${p.plate} -> ${s.customerName}`,
                    amount: s.driverBonus,
                    originalRef: s
                });
            }
        });
    });

    // 2. Manual Tx
    const txs = driverTxList.filter(tx => tx.driverName === selectedDriver);
    txs.forEach(tx => {
        history.push({
            date: tx.date,
            type: tx.type,
            description: tx.notes || (tx.type === 'PAYMENT' ? 'Pembayaran Pelunasan' : 'Pinjaman Manual'),
            amount: tx.amount,
            originalRef: tx
        });
    });

    // Sort Descending Date
    return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedDriver, purchases, sales, driverTxList]);

  const handleSaveTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDriver && txAmount && txAmount > 0) {
        const newTx: DriverTransaction = {
            id: uuidv4(),
            driverName: selectedDriver,
            date: txDate,
            amount: Number(txAmount),
            type: txType,
            notes: txNotes
        };
        saveDriverTransaction(newTx);
        setRefreshTrigger(prev => prev + 1); // Trigger re-render
        setIsFormOpen(false);
        setTxAmount('');
        setTxNotes('');
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[calc(100vh-150px)] relative">
        {/* Left: Driver List */}
        <div className={`md:col-span-4 bg-white rounded-xl shadow border border-slate-200 flex flex-col overflow-hidden absolute md:relative inset-0 z-10 transition-transform duration-300 ${showDetailMobile ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
            <div className="p-4 border-b border-slate-200 bg-slate-50">
                <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                    <User className="w-5 h-5 text-purple-600" /> Driver List
                </h2>
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input 
                    type="text" 
                    placeholder="Cari Supir..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {filteredDrivers.map(d => (
                    <button
                        key={d.name}
                        onClick={() => { 
                            setSelectedDriver(d.name); 
                            setIsFormOpen(false);
                            setShowDetailMobile(true);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-md
                            ${selectedDriver === d.name 
                            ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-300' 
                            : 'bg-white border-slate-100 hover:border-slate-300'
                            }
                        `}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className={`font-bold ${selectedDriver === d.name ? 'text-purple-800' : 'text-slate-700'}`}>
                                {d.name}
                            </span>
                            {d.balance > 0 && (
                                <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    Hutang
                                </span>
                            )}
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 text-xs">{d.tripCount} Perjalanan</span>
                            <span className={`font-mono font-bold ${d.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {d.balance === 0 ? 'Lunas' : formatCurrency(d.balance)}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {/* Right: Driver Details & History */}
        <div className={`md:col-span-8 bg-white rounded-xl shadow border border-slate-200 flex flex-col overflow-hidden absolute md:relative inset-0 z-20 transition-transform duration-300 bg-white ${showDetailMobile ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
            {activeDriverData ? (
                <>
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setShowDetailMobile(false)}
                                className="md:hidden p-1 bg-white border rounded shadow-sm text-slate-600 mr-2"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h2 className="text-lg md:text-xl font-bold text-slate-800 leading-tight">{activeDriverData.name}</h2>
                                <p className="text-xs text-slate-500">Rekapan Bon</p>
                            </div>
                        </div>
                        <div className="text-right">
                             <div className="text-[10px] text-slate-500 uppercase font-bold">Total Sisa Bon</div>
                             <div className={`text-xl md:text-2xl font-bold ${activeDriverData.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {activeDriverData.balance === 0 ? 'Lunas' : formatCurrency(activeDriverData.balance)}
                             </div>
                        </div>
                    </div>

                    <div className="p-4 border-b border-slate-200 bg-white grid grid-cols-2 gap-4">
                         <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3 p-3 rounded bg-red-50 border border-red-100">
                             <div className="p-1.5 md:p-2 bg-red-100 rounded-full text-red-600">
                                 <ArrowDownLeft className="w-4 h-4 md:w-5 md:h-5" />
                             </div>
                             <div>
                                 <div className="text-[10px] md:text-xs text-slate-500 font-bold uppercase">Pinjaman</div>
                                 <div className="font-bold text-sm md:text-base text-red-700">{formatCurrency(activeDriverData.totalDebt)}</div>
                             </div>
                         </div>
                         <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3 p-3 rounded bg-green-50 border border-green-100">
                             <div className="p-1.5 md:p-2 bg-green-100 rounded-full text-green-600">
                                 <ArrowUpRight className="w-4 h-4 md:w-5 md:h-5" />
                             </div>
                             <div>
                                 <div className="text-[10px] md:text-xs text-slate-500 font-bold uppercase">Dibayar</div>
                                 <div className="font-bold text-sm md:text-base text-green-700">{formatCurrency(activeDriverData.totalPaid)}</div>
                             </div>
                         </div>
                    </div>

                    {/* Action Bar */}
                    <div className="p-4 flex flex-col md:flex-row justify-end gap-2 bg-slate-50 border-b border-slate-200">
                         <button 
                            onClick={() => { setIsFormOpen(true); setTxType('PAYMENT'); }}
                            className="flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-bold shadow-sm w-full md:w-auto"
                         >
                             <Wallet className="w-4 h-4" /> Bayar (Lunas)
                         </button>
                         <button 
                            onClick={() => { setIsFormOpen(true); setTxType('MANUAL_BON'); }}
                            className="flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded text-sm font-bold shadow-sm w-full md:w-auto"
                         >
                             <PlusCircle className="w-4 h-4" /> Pinjaman (Bon)
                         </button>
                    </div>
                    
                    {/* Transaction Form Modal / Inline */}
                    {isFormOpen && (
                        <div className="p-4 bg-yellow-50 border-b border-yellow-200 animate-in slide-in-from-top-2">
                             <h3 className="font-bold text-yellow-800 mb-3 text-sm uppercase">
                                 {txType === 'PAYMENT' ? 'Input Pelunasan Sopir' : 'Input Pinjaman Manual'}
                             </h3>
                             <form onSubmit={handleSaveTx} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                 <div>
                                     <label className="block text-xs font-bold text-slate-600 mb-1">Tanggal</label>
                                     <input type="date" required value={txDate} onChange={e => setTxDate(e.target.value)} className="w-full text-sm border-slate-300 rounded p-2" />
                                 </div>
                                 <div>
                                     <label className="block text-xs font-bold text-slate-600 mb-1">Jumlah (Rp)</label>
                                     <input type="number" required min="1" value={txAmount} onChange={e => setTxAmount(parseFloat(e.target.value))} className="w-full text-sm border-slate-300 rounded p-2" placeholder="0" />
                                 </div>
                                 <div className="md:col-span-2">
                                     <label className="block text-xs font-bold text-slate-600 mb-1">Keterangan / Notes</label>
                                     <div className="flex gap-2">
                                         <input type="text" value={txNotes} onChange={e => setTxNotes(e.target.value)} className="w-full text-sm border-slate-300 rounded p-2" placeholder="Keterangan..." />
                                         <button type="submit" className="bg-slate-800 text-white px-4 rounded hover:bg-slate-700 text-sm whitespace-nowrap">Simpan</button>
                                         <button type="button" onClick={() => setIsFormOpen(false)} className="bg-white border text-slate-600 px-3 rounded hover:bg-slate-50 text-sm">Batal</button>
                                     </div>
                                 </div>
                             </form>
                        </div>
                    )}

                    {/* Transaction History List */}
                    <div className="flex-1 overflow-y-auto p-2 md:p-4 bg-slate-50/30">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-slate-500 uppercase border-b border-slate-200 text-left">
                                <tr>
                                    <th className="py-2 pl-2">Tanggal</th>
                                    <th className="py-2 hidden md:table-cell">Tipe</th>
                                    <th className="py-2">Detail</th>
                                    <th className="py-2 text-right pr-2">Jumlah</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {driverHistory.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-400 italic">Belum ada history transaksi.</td>
                                    </tr>
                                ) : (
                                    driverHistory.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-white transition-colors">
                                            <td className="py-3 pl-2 text-slate-700 whitespace-nowrap align-top">
                                                {formatDate(row.date)}
                                                {/* Mobile Type Badge */}
                                                <div className="md:hidden mt-1">
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                                        row.type === 'PAYMENT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                        {row.type === 'TRIP_BON' ? 'TRIP' : (row.type === 'PAYMENT' ? 'BYR' : 'BON')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 hidden md:table-cell align-top">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                    row.type === 'PAYMENT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {row.type.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="py-3 text-slate-600 max-w-[150px] md:max-w-[200px] align-top text-xs md:text-sm">
                                                <div className="line-clamp-2">{row.description}</div>
                                            </td>
                                            <td className={`py-3 text-right pr-2 font-mono font-bold align-top ${
                                                row.type === 'PAYMENT' ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                                {row.type === 'PAYMENT' ? '-' : '+'} {formatCurrency(row.amount)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                    <User className="w-16 h-16 text-slate-300 mb-4" />
                    <p>Pilih driver di sebelah kiri untuk melihat rincian.</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default DriverMenu;
