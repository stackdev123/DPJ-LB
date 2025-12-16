
import React, { useMemo, useState } from 'react';
import { PurchaseRecord, SaleRecord, CustomerPayment, SupplierPayment } from '../types';
import { formatCurrency } from '../utils';
import { 
  TrendingUp, ShoppingCart, 
  Users, Package, Calendar, Wallet, ArrowDownCircle, 
  ArrowUpRight, AlertCircle, Banknote, 
  Percent, Layers, Calculator, X, CheckCircle2, Filter,
  Truck, ArrowRight, Info, Search
} from 'lucide-react';

interface DashboardProps {
  purchases: PurchaseRecord[];
  sales: SaleRecord[];
  customerPayments: CustomerPayment[];
  supplierPayments: SupplierPayment[];
}

const Dashboard: React.FC<DashboardProps> = ({ purchases, sales, customerPayments, supplierPayments }) => {
  
  // Helper to get local date string YYYY-MM-DD to fix timezone issues
  const getLocalDateString = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
  };

  // --- STATE ---
  // Default to This Month (1st to Current Date)
  const [startDate, setStartDate] = useState<string>(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  
  const [endDate, setEndDate] = useState<string>(() => {
      return getLocalDateString(new Date());
  });

  const [filterLabel, setFilterLabel] = useState('Bulan Ini');
  const [showFinishedOnly, setShowFinishedOnly] = useState(false);
  const [showProfitDetail, setShowProfitDetail] = useState(false);

  // --- FILTERS ---
  const applyPreset = (type: 'TODAY' | 'THIS_MONTH' | 'LAST_MONTH' | 'ALL') => {
      const today = new Date();
      
      if (type === 'TODAY') {
          const s = getLocalDateString(today);
          setStartDate(s);
          setEndDate(s);
          setFilterLabel('Hari Ini');
      } else if (type === 'THIS_MONTH') {
          // Fix: Manually construct 1st of month to avoid timezone shifts
          const firstDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
          
          // Last day of current month
          const lastDayObj = new Date(today.getFullYear(), today.getMonth() + 1, 0);
          const lastDay = getLocalDateString(lastDayObj);
          
          setStartDate(firstDay);
          setEndDate(lastDay);
          setFilterLabel('Bulan Ini');
      } else if (type === 'LAST_MONTH') {
          // First day of last month
          const firstDayObj = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const firstDay = getLocalDateString(firstDayObj);

          // Last day of last month
          const lastDayObj = new Date(today.getFullYear(), today.getMonth(), 0);
          const lastDay = getLocalDateString(lastDayObj);

          setStartDate(firstDay);
          setEndDate(lastDay);
          setFilterLabel('Bulan Lalu');
      } else {
          setStartDate('');
          setEndDate('');
          setFilterLabel('Semua Waktu');
      }
  }

  const handleManualDateChange = (type: 'START' | 'END', value: string) => {
      if (type === 'START') setStartDate(value);
      else setEndDate(value);
      setFilterLabel('Custom Range');
  };

  // 1. Filter Purchases First
  const filteredPurchases = useMemo(() => {
      let filtered = purchases;

      // Date Filter
      if (startDate || endDate) {
          filtered = filtered.filter(p => {
              const d = new Date(p.date);
              const start = startDate ? new Date(startDate) : new Date('1900-01-01');
              const end = endDate ? new Date(endDate) : new Date('2100-01-01');
              return d >= start && d <= end;
          });
      }

      // "Finished Only" Filter
      if (showFinishedOnly) {
          filtered = filtered.filter(p => {
              const relatedSales = sales.filter(s => s.purchaseId === p.id);
              const soldKg = relatedSales.reduce((sum, s) => sum + (s.soldKg || 0), 0);
              const mortKg = relatedSales.reduce((sum, s) => sum + (s.mortalityKg || 0), 0);
              
              const shrinkageKg = Math.max(0, p.kg - (soldKg + mortKg));
              const shrinkagePct = p.kg > 0 ? (shrinkageKg / p.kg) * 100 : 0;
              
              return shrinkagePct < 20; 
          });
      }

      return filtered;
  }, [purchases, sales, startDate, endDate, showFinishedOnly]);

  // 2. Filter Sales based on the filtered Purchases (if specific filter active) or Date
  const filteredSales = useMemo(() => {
      if (showFinishedOnly) {
          const validPurchaseIds = new Set(filteredPurchases.map(p => p.id));
          return sales.filter(s => validPurchaseIds.has(s.purchaseId));
      }

      if (!startDate && !endDate) return sales;
      return sales.filter(s => {
          const d = new Date(s.date);
          const start = startDate ? new Date(startDate) : new Date('1900-01-01');
          const end = endDate ? new Date(endDate) : new Date('2100-01-01');
          return d >= start && d <= end;
      });
  }, [sales, filteredPurchases, showFinishedOnly, startDate, endDate]);
  
  // --- METRICS CALCULATION ---
  const metrics = useMemo(() => {
    // Totals from Sales
    const totalSalesRevenue = filteredSales.reduce((sum, s) => {
        const netKg = Math.max(0, s.soldKg - s.mortalityKg);
        return sum + (netKg * s.sellPrice);
    }, 0);

    const totalSoldKg = filteredSales.reduce((sum, s) => sum + s.soldKg, 0);
    const totalMortalityKg = filteredSales.reduce((sum, s) => sum + s.mortalityKg, 0);
    
    // Operational Expenses
    const totalUnloading = filteredSales.reduce((sum, s) => sum + (s.unloadingCost || 0), 0);
    const totalTruck = filteredSales.reduce((sum, s) => sum + (s.truckCost || 0), 0);
    const totalOps = filteredSales.reduce((sum, s) => sum + (s.operationalCost || 0), 0);
    
    const totalOpsCost = totalUnloading + totalTruck + totalOps;

    // Totals from Purchases (Cash Flow)
    const totalBuyCostCashFlow = filteredPurchases.reduce((sum, p) => sum + p.totalBuyCost, 0);
    const totalBuyKg = filteredPurchases.reduce((sum, p) => sum + p.kg, 0);

    // COGS Calculation (Accrual)
    // Estimate cost of birds sold/died based on their original purchase price
    const totalCOGS = filteredSales.reduce((sum, s) => {
        const p = purchases.find(p => p.id === s.purchaseId);
        const buyPrice = p ? p.buyPrice : 0;
        // Cost includes Sold + Died birds
        return sum + ((s.soldKg + s.mortalityKg) * buyPrice);
    }, 0);

    // Shrinkage
    const shrinkageKg = Math.max(0, totalBuyKg - (totalSoldKg + totalMortalityKg));
    const shrinkagePct = totalBuyKg > 0 ? (shrinkageKg / totalBuyKg) * 100 : 0;
    
    // Net Profit (Accrual Basis)
    const netProfit = totalSalesRevenue - totalCOGS - totalOpsCost;
    const marginPct = totalSalesRevenue > 0 ? (netProfit / totalSalesRevenue) * 100 : 0;

    // Derived per Unit
    const profitPerKg = totalSoldKg > 0 ? netProfit / totalSoldKg : 0;
    const costPerKg = totalSoldKg > 0 ? totalOpsCost / totalSoldKg : 0;

    // Mortality Pct
    const mortalityPct = totalBuyKg > 0 ? (totalMortalityKg / totalBuyKg) * 100 : 0;

    return {
        revenue: totalSalesRevenue,
        buyCost: totalBuyCostCashFlow, // Displayed in "Total Pembelian" card
        cogs: totalCOGS, // Used for Profit Calculation
        opsCost: totalOpsCost,
        breakdownOps: { totalUnloading, totalTruck, totalOps },
        profit: netProfit,
        marginPct,
        profitPerKg,
        costPerKg,
        volSold: totalSoldKg,
        volBuy: totalBuyKg,
        mortality: totalMortalityKg,
        mortalityPct,
        shrinkage: shrinkageKg,
        shrinkagePct: shrinkagePct
    };
  }, [filteredPurchases, filteredSales, purchases]);

  // Top Customers (Volume/Sales) - TOP 10
  const topCustomers = useMemo(() => {
      const map = new Map<string, { name: string, kg: number, count: number, totalVal: number }>();
      let maxKg = 0;
      filteredSales.forEach(s => {
          const key = s.customerName;
          const netKg = Math.max(0, s.soldKg - s.mortalityKg);
          const val = netKg * s.sellPrice;
          
          if (!map.has(key)) map.set(key, { name: key, kg: 0, count: 0, totalVal: 0 });
          const entry = map.get(key)!;
          entry.kg += s.soldKg;
          entry.count += 1;
          entry.totalVal += val;
          
          if(entry.kg > maxKg) maxKg = entry.kg;
      });
      // Sort by Value (Revenue) instead of Kg for "Top Penjualan"
      return {
          data: Array.from(map.values()).sort((a, b) => b.totalVal - a.totalVal).slice(0, 10),
          maxVal: maxKg
      };
  }, [filteredSales]);

  // Top Debtors (Piutang) - TOP 10
  const topDebtors = useMemo(() => {
      const map = new Map<string, { name: string, balance: number }>();
      
      // Calculate All-Time Sales
      sales.forEach(s => {
          const key = s.customerId || s.customerName;
          const netKg = Math.max(0, s.soldKg - s.mortalityKg);
          const amount = netKg * s.sellPrice;
          
          if (!map.has(key)) map.set(key, { name: s.customerName, balance: 0 });
          map.get(key)!.balance += amount;
      });

      // Calculate All-Time Payments
      customerPayments.forEach(p => {
          const key = p.customerId || p.customerName;
          if (!map.has(key)) map.set(key, { name: p.customerName, balance: 0 });
          map.get(key)!.balance -= p.totalPaid;
      });

      const allDebtors = Array.from(map.values())
        .filter(c => c.balance > 1000) // Filter only positive debt
        .sort((a, b) => b.balance - a.balance);

      const maxDebt = allDebtors.length > 0 ? allDebtors[0].balance : 0;

      return {
          data: allDebtors.slice(0, 10),
          totalAR: Array.from(map.values()).reduce((acc, curr) => acc + curr.balance, 0),
          maxVal: maxDebt
      };
  }, [sales, customerPayments]);

  // Top Suppliers - TOP 10
  const topSuppliers = useMemo(() => {
      const map = new Map<string, { name: string, totalBuy: number, count: number, kg: number }>();
      
      filteredPurchases.forEach(p => {
          const key = p.supplier || 'Tanpa Supplier';
          if (!map.has(key)) map.set(key, { name: key, totalBuy: 0, count: 0, kg: 0 });
          const entry = map.get(key)!;
          entry.totalBuy += p.totalBuyCost;
          entry.kg += p.kg;
          entry.count += 1;
      });

      return Array.from(map.values()).sort((a, b) => b.totalBuy - a.totalBuy).slice(0, 10);
  }, [filteredPurchases]);

  return (
    <div className="space-y-6">
       {/* Filter Header */}
       <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
           <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
               <div>
                   <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                       <Filter className="w-5 h-5 text-primary" />
                       Dashboard & Analytics
                   </h2>
                   <p className="text-xs text-slate-500">
                       Mode: <b>{filterLabel}</b> 
                       {startDate && endDate ? ` (${startDate} s/d ${endDate})` : ' (Semua Data)'}
                   </p>
               </div>
               
               <div className="flex flex-col lg:flex-row gap-3 w-full xl:w-auto items-start lg:items-center">
                   
                   {/* Date Range Inputs */}
                   <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 pl-2">Dari</span>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => handleManualDateChange('START', e.target.value)} 
                                className="bg-white border-none text-xs font-bold text-slate-700 rounded p-1 focus:ring-0"
                            />
                        </div>
                        <div className="w-px h-4 bg-slate-300"></div>
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Sampai</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => handleManualDateChange('END', e.target.value)} 
                                className="bg-white border-none text-xs font-bold text-slate-700 rounded p-1 focus:ring-0"
                            />
                        </div>
                   </div>

                   {/* Presets */}
                   <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto">
                       <button onClick={() => applyPreset('TODAY')} className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${filterLabel === 'Hari Ini' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}>Hari Ini</button>
                       <button onClick={() => applyPreset('THIS_MONTH')} className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${filterLabel === 'Bulan Ini' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}>Bulan Ini</button>
                       <button onClick={() => applyPreset('LAST_MONTH')} className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${filterLabel === 'Bulan Lalu' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}>Bulan Lalu</button>
                       <button onClick={() => applyPreset('ALL')} className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all ${filterLabel === 'Semua Waktu' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}>Semua</button>
                   </div>
                   
                   {/* Checkbox */}
                   <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 select-none hover:bg-slate-100 transition-colors h-[38px]">
                       <input 
                            type="checkbox" 
                            checked={showFinishedOnly} 
                            onChange={e => setShowFinishedOnly(e.target.checked)}
                            className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                       />
                       <span className="text-xs font-bold text-slate-600">Finished Only</span>
                   </label>
               </div>
           </div>
       </div>

       {/* MAIN KPI CARDS */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           
           {/* Revenue Card */}
           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute right-0 top-0 p-8 bg-blue-500/5 rounded-full blur-2xl -mr-4 -mt-4 transition-all group-hover:bg-blue-500/10"></div>
                <div className="flex justify-between items-start mb-2 relative z-10">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <TrendingUp className="w-6 h-6 text-blue-600" />
                    </div>
                </div>
                <div className="relative z-10">
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Penjualan</div>
                    {/* Non-linear font scaling: XL on mobile/tablet, Shrinks on Large Desktop (4-col), then Grows on Extra Large */}
                    <div className="text-xl sm:text-2xl md:text-3xl lg:text-xl xl:text-2xl font-bold text-slate-800 break-words leading-none tracking-tight">
                        {formatCurrency(metrics.revenue)}
                    </div>
                    <div className="flex items-center gap-1 mt-3 text-xs font-medium text-slate-400">
                        <CheckCircle2 className="w-3 h-3" />
                        {metrics.volSold.toLocaleString()} Kg Terjual
                    </div>
                </div>
           </div>

           {/* Profit Card (CLICKABLE) */}
           <div 
                onClick={() => setShowProfitDetail(true)}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md hover:ring-2 hover:ring-green-400 transition-all cursor-pointer"
           >
                <div className={`absolute right-0 top-0 p-8 rounded-full blur-2xl -mr-4 -mt-4 transition-all opacity-20 ${metrics.profit >= 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div className="flex justify-between items-start mb-2 relative z-10">
                    <div className={`p-2 rounded-lg ${metrics.profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                        <Wallet className={`w-6 h-6 ${metrics.profit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${metrics.profit >= 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                        {metrics.marginPct.toFixed(1)}% Margin
                    </span>
                </div>
                <div className="relative z-10">
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        Net Profit <Info className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className={`text-xl sm:text-2xl md:text-3xl lg:text-xl xl:text-2xl font-bold break-words leading-none tracking-tight ${metrics.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(metrics.profit)}
                    </div>
                    <div className="flex items-center gap-1 mt-3 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded w-fit group-hover:bg-slate-200 transition-colors">
                        <ArrowRight className="w-3 h-3" /> Klik untuk detail
                    </div>
                </div>
           </div>

           {/* Purchase Cost Card */}
           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute right-0 top-0 p-8 bg-slate-500/5 rounded-full blur-2xl -mr-4 -mt-4 transition-all group-hover:bg-slate-500/10"></div>
                <div className="flex justify-between items-start mb-2 relative z-10">
                    <div className="p-2 bg-slate-100 rounded-lg">
                        <Package className="w-6 h-6 text-slate-600" />
                    </div>
                </div>
                <div className="relative z-10">
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Pembelian</div>
                    <div className="text-xl sm:text-2xl md:text-3xl lg:text-xl xl:text-2xl font-bold text-slate-800 break-words leading-none tracking-tight">
                        {formatCurrency(metrics.buyCost)}
                    </div>
                    <div className="flex items-center gap-1 mt-3 text-xs font-medium text-slate-400">
                         <Layers className="w-3 h-3" />
                         {metrics.volBuy.toLocaleString()} Kg Masuk
                    </div>
                </div>
           </div>

           {/* Expenses Card */}
           <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute right-0 top-0 p-8 bg-orange-500/5 rounded-full blur-2xl -mr-4 -mt-4 transition-all group-hover:bg-orange-500/10"></div>
                <div className="flex justify-between items-start mb-2 relative z-10">
                    <div className="p-2 bg-orange-50 rounded-lg">
                        <Banknote className="w-6 h-6 text-orange-600" />
                    </div>
                </div>
                <div className="relative z-10">
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Expenses</div>
                    <div className="text-xl sm:text-2xl md:text-3xl lg:text-xl xl:text-2xl font-bold text-orange-600 break-words leading-none tracking-tight">
                        {formatCurrency(metrics.opsCost)}
                    </div>
                    <div className="flex items-center gap-1 mt-3 text-xs font-medium text-slate-400">
                        <span className="text-[10px]">Ops + Truk + Bongkar</span>
                    </div>
                </div>
           </div>
       </div>

       {/* OPERATIONAL INDICATORS GRID */}
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                <div className="p-2 sm:p-3 bg-blue-50 rounded-full text-blue-600 shrink-0">
                    <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0 w-full">
                    <div className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase truncate">Volume Jual</div>
                    <div className="text-lg sm:text-xl md:text-2xl lg:text-lg xl:text-xl font-bold text-slate-800 break-words leading-tight">
                        {metrics.volSold.toLocaleString()} <span className="text-xs sm:text-sm font-normal text-slate-500">Kg</span>
                    </div>
                </div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                 <div className="p-2 sm:p-3 bg-slate-100 rounded-full text-slate-600 shrink-0">
                    <Package className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0 w-full">
                    <div className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase truncate">Volume Beli</div>
                    <div className="text-lg sm:text-xl md:text-2xl lg:text-lg xl:text-xl font-bold text-slate-800 break-words leading-tight">
                        {metrics.volBuy.toLocaleString()} <span className="text-xs sm:text-sm font-normal text-slate-500">Kg</span>
                    </div>
                </div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                 <div className="p-2 sm:p-3 bg-red-50 rounded-full text-red-600 shrink-0">
                    <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0 w-full">
                    <div className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase truncate">Total Kematian</div>
                    <div className="text-lg sm:text-xl md:text-2xl lg:text-lg xl:text-xl font-bold text-red-600 break-words leading-tight">
                        {metrics.mortality.toLocaleString()} <span className="text-xs sm:text-sm font-normal text-red-400">Kg</span>
                    </div>
                    <div className="text-[10px] text-slate-400 hidden sm:block">{metrics.mortalityPct.toFixed(2)}% dari total</div>
                </div>
            </div>

            <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                 <div className="p-2 sm:p-3 bg-yellow-50 rounded-full text-yellow-600 shrink-0">
                    <Percent className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0 w-full">
                    <div className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase truncate">Susut</div>
                    <div className="text-lg sm:text-xl md:text-2xl lg:text-lg xl:text-xl font-bold text-yellow-700 break-words leading-tight">
                        {metrics.shrinkage.toFixed(1)} <span className="text-xs sm:text-sm font-normal text-yellow-600">Kg</span>
                    </div>
                    <div className="text-[10px] text-slate-400 hidden sm:block">{metrics.shrinkagePct.toFixed(2)}% dari total</div>
                </div>
            </div>
       </div>

       {/* BOTTOM SECTION: 3 COLUMN TOP 10 LISTS */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. Top 10 Piutang (Receivables) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[400px]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-red-50/50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" /> Top 10 Piutang
                    </h3>
                    <div className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                        Total: {formatCurrency(topDebtors.totalAR)}
                    </div>
                </div>
                <div className="p-2 flex-1 overflow-y-auto">
                     {topDebtors.data.map((c, i) => (
                         <div key={i} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded text-sm border-b border-slate-50 last:border-0">
                             <div className="flex items-center gap-3">
                                 <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-600">
                                     {i+1}
                                 </div>
                                 <div className="font-bold text-slate-700 truncate max-w-[120px]">{c.name}</div>
                             </div>
                             <div className="font-mono font-bold text-red-600">
                                 {formatCurrency(c.balance)}
                             </div>
                         </div>
                    ))}
                     {topDebtors.data.length === 0 && <div className="p-4 text-center text-slate-400 text-xs italic">Tidak ada piutang.</div>}
                </div>
            </div>

            {/* 2. Top 10 Sales (Penjualan) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[400px]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" /> Top 10 Penjualan
                    </h3>
                </div>
                <div className="p-2 flex-1 overflow-y-auto">
                    {topCustomers.data.map((c, i) => (
                         <div key={i} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded text-sm border-b border-slate-50 last:border-0">
                             <div className="flex items-center gap-3">
                                 <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                                     {i+1}
                                 </div>
                                 <div>
                                     <div className="font-bold text-slate-700 truncate max-w-[120px]">{c.name}</div>
                                     <div className="text-[10px] text-slate-400">{c.count} Transaksi</div>
                                 </div>
                             </div>
                             <div className="text-right">
                                 <div className="font-bold text-slate-800">{formatCurrency(c.totalVal)}</div>
                                 <div className="text-[10px] text-blue-600 font-bold">{c.kg.toLocaleString()} Kg</div>
                             </div>
                         </div>
                    ))}
                    {topCustomers.data.length === 0 && <div className="p-4 text-center text-slate-400 text-xs italic">Belum ada data.</div>}
                </div>
            </div>

            {/* 3. Top 10 Suppliers */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[400px]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-purple-50/50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Truck className="w-4 h-4 text-purple-500" /> Top 10 Supplier
                    </h3>
                </div>
                <div className="p-2 flex-1 overflow-y-auto">
                    {topSuppliers.map((s, i) => (
                         <div key={i} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded text-sm border-b border-slate-50 last:border-0">
                             <div className="flex items-center gap-3">
                                 <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600">
                                     {i+1}
                                 </div>
                                 <div>
                                     <div className="font-bold text-slate-700 truncate max-w-[120px]">{s.name}</div>
                                     <div className="text-[10px] text-slate-400">{s.count} Pengiriman</div>
                                 </div>
                             </div>
                             <div className="text-right">
                                 <div className="font-bold text-slate-800">{formatCurrency(s.totalBuy)}</div>
                                 <div className="text-[10px] text-purple-600 font-bold">{s.kg.toLocaleString()} Kg</div>
                             </div>
                         </div>
                    ))}
                    {topSuppliers.length === 0 && <div className="p-4 text-center text-slate-400 text-xs italic">Belum ada data.</div>}
                </div>
            </div>

       </div>

       {/* PROFIT DETAIL MODAL */}
       {showProfitDetail && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                   <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
                       <div className="flex items-center gap-2">
                           <Calculator className="w-6 h-6 text-green-400" />
                           <h2 className="text-lg font-bold">Rincian Profit & Margin</h2>
                       </div>
                       <button onClick={() => setShowProfitDetail(false)} className="text-slate-400 hover:text-white transition-colors">
                           <X className="w-6 h-6" />
                       </button>
                   </div>
                   
                   <div className="p-6">
                       <div className="space-y-4">
                           {/* Waterfall Calculation */}
                           <div className="space-y-2 border-b border-slate-200 pb-4 mb-4">
                               <div className="flex justify-between items-center text-sm">
                                   <span className="font-bold text-blue-700">(+) Total Penjualan (Revenue)</span>
                                   <span className="font-mono font-bold">{formatCurrency(metrics.revenue)}</span>
                               </div>
                               <div className="flex justify-between items-center text-sm">
                                   <span className="font-bold text-slate-600">(-) HPP (Cost of Goods Sold)</span>
                                   <span className="font-mono text-red-500">({formatCurrency(metrics.cogs)})</span>
                               </div>
                               <div className="flex justify-between items-center text-sm">
                                   <span className="font-bold text-slate-600">(-) Operational Expenses</span>
                                   <span className="font-mono text-red-500">({formatCurrency(metrics.opsCost)})</span>
                               </div>
                               {/* Breakdown Ops */}
                               <div className="pl-6 text-xs text-slate-400 italic space-y-1">
                                   <div className="flex justify-between"><span>Biaya Bongkar</span><span>{formatCurrency(metrics.breakdownOps.totalUnloading)}</span></div>
                                   <div className="flex justify-between"><span>Biaya Truk</span><span>{formatCurrency(metrics.breakdownOps.totalTruck)}</span></div>
                                   <div className="flex justify-between"><span>Lainnya</span><span>{formatCurrency(metrics.breakdownOps.totalOps)}</span></div>
                               </div>
                           </div>

                           {/* Result */}
                           <div className="flex justify-between items-center bg-slate-100 p-4 rounded-lg">
                               <span className="font-black text-lg uppercase text-slate-800">(=) Net Profit</span>
                               <span className={`font-black text-2xl font-mono ${metrics.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                   {formatCurrency(metrics.profit)}
                               </span>
                           </div>

                           {/* Analysis Grid */}
                           <div className="grid grid-cols-3 gap-3 mt-2">
                               <div className="p-3 bg-blue-50 border border-blue-100 rounded text-center">
                                   <div className="text-[10px] text-blue-500 font-bold uppercase mb-1">Net Margin</div>
                                   <div className="text-xl font-black text-blue-700">{metrics.marginPct.toFixed(2)}%</div>
                               </div>
                               <div className="p-3 bg-green-50 border border-green-100 rounded text-center">
                                   <div className="text-[10px] text-green-600 font-bold uppercase mb-1">Profit / Kg</div>
                                   <div className="text-lg font-bold text-green-700">{formatCurrency(metrics.profitPerKg)}</div>
                               </div>
                               <div className="p-3 bg-orange-50 border border-orange-100 rounded text-center">
                                   <div className="text-[10px] text-orange-600 font-bold uppercase mb-1">Cost / Kg</div>
                                   <div className="text-lg font-bold text-orange-700">{formatCurrency(metrics.costPerKg)}</div>
                               </div>
                           </div>
                       </div>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default Dashboard;
