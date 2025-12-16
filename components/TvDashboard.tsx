
import React, { useState, useEffect, useMemo } from 'react';
import { PurchaseRecord, SaleRecord, CustomerPayment, SupplierPayment } from '../types';
import { formatCurrency } from '../utils';
import { 
  Clock, TrendingUp, ShoppingCart, 
  Wallet, LogOut, Activity, ArrowUpRight, ArrowDownLeft 
} from 'lucide-react';
import Logo from './Logo';

interface TvDashboardProps {
  purchases: PurchaseRecord[];
  sales: SaleRecord[];
  customerPayments: CustomerPayment[];
  supplierPayments: SupplierPayment[];
  onExit: () => void;
}

const TvDashboard: React.FC<TvDashboardProps> = ({ 
    purchases, 
    sales, 
    customerPayments, 
    supplierPayments,
    onExit 
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock Update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- REALTIME DATA CALCULATION ---
  const today = new Date().toISOString().split('T')[0];

  const todayStats = useMemo(() => {
      const todaySales = sales.filter(s => s.date === today);
      const todayPurchases = purchases.filter(p => p.date === today);
      
      const revenue = todaySales.reduce((sum, s) => {
          const net = Math.max(0, s.soldKg - s.mortalityKg);
          return sum + (net * s.sellPrice);
      }, 0);

      const soldKg = todaySales.reduce((sum, s) => sum + s.soldKg, 0);
      const buyKg = todayPurchases.reduce((sum, p) => sum + p.kg, 0);
      
      // Estimated Profit Today (Simplified: Revenue - COGS based on avg buy price)
      // We use average buy price from today's purchases or fallback to last known
      const avgBuyPrice = todayPurchases.length > 0 
        ? (todayPurchases.reduce((sum, p) => sum + p.totalBuyCost, 0) / buyKg)
        : (purchases.length > 0 ? purchases[0].buyPrice : 0);

      const cogs = soldKg * avgBuyPrice;
      const profit = revenue - cogs;

      return { revenue, soldKg, buyKg, profit, txCount: todaySales.length };
  }, [sales, purchases, today]);

  // Global Financials
  const globalStats = useMemo(() => {
      // 1. Total Receivables (Piutang)
      const customerMap = new Map<string, number>();
      sales.forEach(s => {
          const net = Math.max(0, s.soldKg - s.mortalityKg);
          const val = net * s.sellPrice;
          customerMap.set(s.customerName, (customerMap.get(s.customerName) || 0) + val);
      });
      customerPayments.forEach(p => {
          customerMap.set(p.customerName, (customerMap.get(p.customerName) || 0) - p.totalPaid);
      });
      const totalAR = Array.from(customerMap.values()).reduce((sum, val) => sum + val, 0);

      // Top Debtors
      const topDebtors = Array.from(customerMap.entries())
        .map(([name, balance]) => ({ name, balance }))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 5);

      // 2. Recent Transactions (Ticker)
      const recentSales = [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);

      return { totalAR, topDebtors, recentSales };
  }, [sales, customerPayments]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white overflow-hidden flex flex-col font-sans">
      
      {/* --- HEADER --- */}
      <div className="h-24 bg-slate-900 border-b border-slate-800 flex justify-between items-center px-8 shadow-2xl relative z-20">
          <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-900 rounded-xl flex items-center justify-center shadow-lg border border-white/10">
                  <Logo className="w-10 h-10 text-white" />
              </div>
              <div>
                  <h1 className="text-3xl font-black tracking-tight text-white uppercase">DPJ Live Monitor</h1>
                  <p className="text-slate-400 font-medium tracking-widest text-sm">REALTIME TRADING DASHBOARD</p>
              </div>
          </div>

          <div className="flex items-center gap-8">
              <div className="text-right">
                  <div className="text-5xl font-black font-mono tracking-widest text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]">
                      {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      <span className="text-2xl ml-2 text-slate-500">{currentTime.toLocaleTimeString('id-ID', { second: '2-digit' })}</span>
                  </div>
                  <div className="text-slate-400 font-bold uppercase tracking-wide mt-1">
                      {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
              </div>
              <button 
                onClick={onExit}
                className="p-3 bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-700 text-slate-400 transition-colors"
              >
                  <LogOut className="w-6 h-6" />
              </button>
          </div>
      </div>

      {/* --- RUNNING TEXT (MARQUEE) --- */}
      <div className="bg-blue-900/20 border-y border-blue-900/30 h-12 flex items-center relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 bg-blue-600 px-4 flex items-center z-10 font-bold text-xs uppercase tracking-widest shadow-xl">
              <Activity className="w-4 h-4 mr-2 animate-pulse" /> Live Feed
          </div>
          <div className="whitespace-nowrap animate-marquee flex items-center gap-8 pl-40">
              {globalStats.recentSales.map((s, idx) => (
                  <span key={s.id} className="text-slate-300 text-sm font-medium flex items-center gap-2">
                      <span className="text-blue-400">●</span> {s.customerName} memborong <span className="text-white font-bold">{s.soldKg.toLocaleString()} Kg</span> 
                      <span className="text-slate-500">({formatCurrency(s.sellPrice)}/kg)</span>
                  </span>
              ))}
              <span className="text-slate-500 mx-4">|</span>
              <span className="text-yellow-400 font-bold">INFO: Pastikan input data realtime untuk akurasi monitor.</span>
          </div>
      </div>

      {/* --- MAIN CONTENT GRID --- */}
      <div className="flex-1 p-6 grid grid-cols-12 gap-6 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
          
          {/* LEFT: BIG STATS (8 Columns) */}
          <div className="col-span-8 flex flex-col gap-6">
              
              {/* Row 1: Today's Metrics */}
              <div className="grid grid-cols-2 gap-6 h-64">
                  {/* Revenue Today */}
                  <div className="bg-gradient-to-br from-blue-900 to-slate-900 rounded-3xl p-8 border border-blue-800/30 shadow-2xl relative overflow-hidden group">
                      <div className="absolute right-0 top-0 p-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-all duration-700"></div>
                      <div className="relative z-10 flex flex-col h-full justify-between">
                          <div className="flex items-center gap-3">
                              <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400">
                                  <TrendingUp className="w-8 h-8" />
                              </div>
                              <span className="text-xl font-bold text-blue-200 uppercase tracking-widest">Omzet Hari Ini</span>
                          </div>
                          <div>
                              <div className="text-6xl font-black text-white tracking-tight drop-shadow-lg">
                                  {formatCurrency(todayStats.revenue)}
                              </div>
                              <div className="mt-4 text-blue-300 font-medium flex items-center gap-2">
                                  <span className="bg-blue-950/50 px-3 py-1 rounded-lg border border-blue-800/50">
                                      {todayStats.txCount} Transaksi
                                  </span>
                                  <span className="bg-blue-950/50 px-3 py-1 rounded-lg border border-blue-800/50">
                                      {todayStats.soldKg.toLocaleString()} Kg Terjual
                                  </span>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Profit Today */}
                  <div className="bg-gradient-to-br from-emerald-900 to-slate-900 rounded-3xl p-8 border border-emerald-800/30 shadow-2xl relative overflow-hidden group">
                      <div className="absolute right-0 top-0 p-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-all duration-700"></div>
                      <div className="relative z-10 flex flex-col h-full justify-between">
                          <div className="flex items-center gap-3">
                              <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
                                  <Wallet className="w-8 h-8" />
                              </div>
                              <span className="text-xl font-bold text-emerald-200 uppercase tracking-widest">Est. Profit Hari Ini</span>
                          </div>
                          <div>
                              <div className="text-6xl font-black text-white tracking-tight drop-shadow-lg">
                                  {formatCurrency(todayStats.profit)}
                              </div>
                              <div className="mt-4 text-emerald-300 font-medium">
                                  <span className="bg-emerald-950/50 px-3 py-1 rounded-lg border border-emerald-800/50">
                                      Margin Sehat
                                  </span>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Row 2: Secondary Metrics */}
              <div className="grid grid-cols-3 gap-6 flex-1">
                  {/* Incoming Stock */}
                  <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col justify-between">
                      <span className="text-slate-400 font-bold uppercase text-sm">Pembelian Masuk (Hari Ini)</span>
                      <div className="text-4xl font-black text-white flex items-end gap-2">
                          {todayStats.buyKg.toLocaleString()} <span className="text-xl text-slate-500 mb-1">Kg</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
                          <div className="h-full bg-indigo-500 w-3/4 animate-pulse"></div>
                      </div>
                  </div>

                  {/* Total Receivables */}
                  <div className="col-span-2 bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl flex items-center justify-between relative overflow-hidden">
                      <div className="absolute -right-10 -bottom-10 opacity-10">
                          <ArrowDownLeft className="w-40 h-40 text-red-500" />
                      </div>
                      <div>
                          <span className="text-red-400 font-bold uppercase text-sm tracking-widest">Total Piutang Berjalan</span>
                          <div className="text-5xl font-black text-white mt-2">
                              {formatCurrency(globalStats.totalAR)}
                          </div>
                      </div>
                      <div className="bg-red-500/20 p-4 rounded-full">
                          <ArrowUpRight className="w-10 h-10 text-red-500" />
                      </div>
                  </div>
              </div>
          </div>

          {/* RIGHT: LEADERBOARD (4 Columns) */}
          <div className="col-span-4 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
              <div className="p-6 bg-slate-800/50 border-b border-slate-700">
                  <h3 className="text-lg font-black text-white uppercase flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-purple-400" />
                      Top 5 Piutang Tertinggi
                  </h3>
              </div>
              <div className="flex-1 p-4 overflow-hidden">
                  <div className="flex flex-col gap-3">
                      {globalStats.topDebtors.map((d, idx) => (
                          <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between relative overflow-hidden">
                              <div className="flex items-center gap-4 z-10">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                      {idx + 1}
                                  </div>
                                  <span className="font-bold text-slate-200 text-lg">{d.name}</span>
                              </div>
                              <div className="z-10 text-right">
                                  <div className="font-mono font-bold text-red-400 text-lg">{formatCurrency(d.balance)}</div>
                              </div>
                              {/* Progress Bar Background */}
                              <div 
                                className="absolute left-0 top-0 bottom-0 bg-purple-600/10 z-0" 
                                style={{ width: `${Math.min((d.balance / globalStats.topDebtors[0].balance) * 100, 100)}%` }}
                              ></div>
                          </div>
                      ))}
                  </div>
              </div>
              <div className="p-4 bg-slate-950/50 text-center text-slate-500 text-xs font-mono uppercase tracking-widest border-t border-slate-800">
                  Auto-refreshing every 10s
              </div>
          </div>

      </div>

      <style>{`
        @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-100%); }
        }
        .animate-marquee {
            animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default TvDashboard;
