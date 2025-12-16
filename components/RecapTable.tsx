
import React, { useMemo, useState } from 'react';
import { PurchaseRecord, SaleRecord } from '../types';
import { Printer, TrendingUp, Download, Edit, ImageDown, AlertCircle, Filter, X, CheckCircle2, PlusCircle, ChevronDown, ChevronUp, DollarSign, Scale, Truck, Users, MousePointerClick, Calculator, HelpCircle, ArrowRight, ChevronLeft, ChevronRight, List, PieChart } from 'lucide-react';
import { formatDate, formatCurrency, downloadAsImage } from '../utils';

interface RecapTableProps {
  purchases: PurchaseRecord[];
  sales: SaleRecord[];
  onEditPurchase?: (purchaseId: string) => void;
  onInputSale?: (purchaseId: string) => void;
  onEditSale?: (saleId: string) => void;
}

const RecapTable: React.FC<RecapTableProps> = ({ purchases, sales, onEditPurchase, onInputSale, onEditSale }) => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterDriver, setFilterDriver] = useState<string>('');
  const [filterPlate, setFilterPlate] = useState<string>('');
  const [filterCoop, setFilterCoop] = useState<string>('');
  const [showFinishedOnly, setShowFinishedOnly] = useState<boolean>(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  // Expanded Row State
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  
  // Orphaned Data Detail View
  const [showOrphanedDetail, setShowOrphanedDetail] = useState(false);

  // 1. Identify Valid Purchase IDs and Extract Unique Options
  const allPurchaseIds = useMemo(() => new Set(purchases.map(p => String(p.id).trim().toLowerCase())), [purchases]);
  
  const uniqueDrivers = useMemo(() => Array.from(new Set(purchases.map(p => p.driver).filter(Boolean))).sort(), [purchases]);
  const uniquePlates = useMemo(() => Array.from(new Set(purchases.map(p => p.plate).filter(Boolean))).sort(), [purchases]);
  const uniqueCoops = useMemo(() => Array.from(new Set(purchases.map(p => p.coop).filter(Boolean))).sort(), [purchases]);

  const clearFilters = () => {
      setStartDate('');
      setEndDate('');
      setFilterDriver('');
      setFilterPlate('');
      setFilterCoop('');
      setShowFinishedOnly(false);
      setCurrentPage(1);
  };

  const toggleRow = (id: string) => {
    if (expandedRowId === id) {
        setExpandedRowId(null);
    } else {
        setExpandedRowId(id);
    }
  };

  // 2. Process Standard Rows (Purchases matching filter)
  const combinedRows = useMemo(() => {
    let result = purchases
      .filter(p => {
        // Date Filter
        if (startDate || endDate) {
            const pDate = new Date(p.date);
            const start = startDate ? new Date(startDate) : new Date('1900-01-01');
            const end = endDate ? new Date(endDate) : new Date('2100-01-01');
            if (pDate < start || pDate > end) return false;
        }

        // New Filters
        if (filterDriver && p.driver !== filterDriver) return false;
        if (filterPlate && p.plate !== filterPlate) return false;
        if (filterCoop && p.coop !== filterCoop) return false;

        return true;
      })
      .map(p => {
        const pIdNormalized = String(p.id).trim().toLowerCase();
        
        const relatedSales = sales.filter(s => 
            s.purchaseId && String(s.purchaseId).trim().toLowerCase() === pIdNormalized
        );

        const soldKg = relatedSales.reduce((sum, s) => sum + (Number(s.soldKg) || 0), 0);
        const mortalityKg = relatedSales.reduce((sum, s) => sum + (Number(s.mortalityKg) || 0), 0);
        
        const totalRevenue = relatedSales.reduce((sum, s) => {
            const sKg = Number(s.soldKg) || 0;
            const mKg = Number(s.mortalityKg) || 0;
            const price = Number(s.sellPrice) || 0;
            const netKg = Math.max(0, sKg - mKg);
            return sum + (netKg * price);
        }, 0);

        const totalUnloading = relatedSales.reduce((sum, s) => sum + (Number(s.unloadingCost) || 0), 0);
        const totalOps = relatedSales.reduce((sum, s) => sum + (Number(s.operationalCost) || 0), 0);
        const totalTruck = relatedSales.reduce((sum, s) => sum + (Number(s.truckCost) || 0), 0);
        
        const customers = Array.from(new Set(relatedSales.map(s => s.customerName).filter(Boolean))).join(', ');

        const totalExpenses = totalUnloading + totalOps + totalTruck;
        const totalBuyCost = Number(p.totalBuyCost) || 0;
        const netProfit = totalRevenue - totalBuyCost - totalExpenses;
        
        // Margin Calculation
        const marginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        // Per Kg Metrics (Based on Sold Kg)
        const profitPerKg = soldKg > 0 ? netProfit / soldKg : 0;
        const costPerKg = soldKg > 0 ? totalExpenses / soldKg : 0;

        const shrinkageKg = (Number(p.kg) || 0) - soldKg; 
        const shrinkagePct = (Number(p.kg) || 0) > 0 ? (shrinkageKg / Number(p.kg)) * 100 : 0;
        
        const isFinished = shrinkagePct < 20;

        return {
            purchase: p,
            sales: relatedSales, 
            salesCount: relatedSales.length,
            customers,
            soldKg,
            mortalityKg,
            totalRevenue,
            totalExpenses,
            netProfit,
            marginPct,
            profitPerKg,
            costPerKg,
            shrinkageKg,
            shrinkagePct,
            isFinished
        };
      });

      if (showFinishedOnly) {
          result = result.filter(r => r.isFinished);
      }

      return result.sort((a, b) => new Date(b.purchase.date).getTime() - new Date(a.purchase.date).getTime());
  }, [purchases, sales, startDate, endDate, allPurchaseIds, filterDriver, filterPlate, filterCoop, showFinishedOnly]);

  const totalPages = Math.ceil(combinedRows.length / pageSize);
  const paginatedRows = combinedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // 3. Process Orphaned Sales
  const orphanedData = useMemo(() => {
      if (filterDriver || filterPlate || filterCoop || showFinishedOnly) {
          return { count: 0, sales: [], soldKg: 0, mortalityKg: 0, totalRevenue: 0, totalExpenses: 0, netProfit: 0 };
      }

      const orphans = sales.filter(s => !s.purchaseId || !allPurchaseIds.has(String(s.purchaseId).trim().toLowerCase()));
      
      const filteredOrphans = orphans.filter(s => {
          if (!startDate && !endDate) return true;
          const sDate = new Date(s.date);
          const start = startDate ? new Date(startDate) : new Date('1900-01-01');
          const end = endDate ? new Date(endDate) : new Date('2100-01-01');
          return sDate >= start && sDate <= end;
      });

      const soldKg = filteredOrphans.reduce((sum, s) => sum + (Number(s.soldKg) || 0), 0);
      const mortalityKg = filteredOrphans.reduce((sum, s) => sum + (Number(s.mortalityKg) || 0), 0);
      
      const totalRevenue = filteredOrphans.reduce((sum, s) => {
            const sKg = Number(s.soldKg) || 0;
            const mKg = Number(s.mortalityKg) || 0;
            const price = Number(s.sellPrice) || 0;
            const netKg = Math.max(0, sKg - mKg);
            return sum + (netKg * price);
      }, 0);

      const totalUnloading = filteredOrphans.reduce((sum, s) => sum + (Number(s.unloadingCost) || 0), 0);
      const totalOps = filteredOrphans.reduce((sum, s) => sum + (Number(s.operationalCost) || 0), 0);
      const totalTruck = filteredOrphans.reduce((sum, s) => sum + (Number(s.truckCost) || 0), 0);
      const totalExpenses = totalUnloading + totalOps + totalTruck;
      const netProfit = totalRevenue - totalExpenses; 

      return { count: filteredOrphans.length, sales: filteredOrphans, soldKg, mortalityKg, totalRevenue, totalExpenses, netProfit };
  }, [sales, allPurchaseIds, startDate, endDate, filterDriver, filterPlate, filterCoop, showFinishedOnly]);

  const totals = useMemo(() => {
      const mainTotals = combinedRows.reduce((acc, row) => ({
          buyCost: acc.buyCost + (Number(row.purchase.totalBuyCost) || 0),
          revenue: acc.revenue + row.totalRevenue,
          profit: acc.profit + row.netProfit,
          buyKg: acc.buyKg + (Number(row.purchase.kg) || 0),
          soldKg: acc.soldKg + row.soldKg,
          deadKg: acc.deadKg + row.mortalityKg,
          expenses: acc.expenses + row.totalExpenses
      }), { buyCost: 0, revenue: 0, profit: 0, buyKg: 0, soldKg: 0, deadKg: 0, expenses: 0 });

      return {
          buyCost: mainTotals.buyCost,
          revenue: mainTotals.revenue + orphanedData.totalRevenue,
          profit: mainTotals.profit + orphanedData.netProfit,
          buyKg: mainTotals.buyKg,
          soldKg: mainTotals.soldKg + orphanedData.soldKg,
          deadKg: mainTotals.deadKg + orphanedData.mortalityKg,
          expenses: mainTotals.expenses + orphanedData.totalExpenses
      };
  }, [combinedRows, orphanedData]);

  const handlePrint = () => window.print();
  const handleDownloadImage = () => downloadAsImage('recap-table-area', 'Rekap_Profit_Loss');

  return (
    <div className="space-y-4">
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 print:hidden">
        <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Rekap Laba / Rugi
            </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleDownloadImage} className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs font-bold"><ImageDown className="w-3.5 h-3.5" /> Save Image</button>
             <button onClick={handlePrint} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-700 text-xs font-bold"><Printer className="w-3.5 h-3.5" /> Print</button>
        </div>
      </div>

      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 print:hidden">
          <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold text-slate-700 flex items-center gap-2"><Filter className="w-3 h-3" /> Filter</h3>
              {(startDate || endDate || filterDriver || filterPlate || filterCoop) && (
                  <button onClick={clearFilters} className="text-[10px] text-red-500 hover:text-red-700 border border-red-200 px-2 rounded bg-white">Reset</button>
              )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
               <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }} className="w-full text-xs border-slate-300 rounded p-1.5" />
               <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }} className="w-full text-xs border-slate-300 rounded p-1.5" />
               <select value={filterDriver} onChange={e => { setFilterDriver(e.target.value); setCurrentPage(1); }} className="w-full text-xs border-slate-300 rounded p-1.5">
                   <option value="">Supir (All)</option>
                   {uniqueDrivers.map(d => <option key={d} value={d}>{d}</option>)}
               </select>
               <select value={filterPlate} onChange={e => { setFilterPlate(e.target.value); setCurrentPage(1); }} className="w-full text-xs border-slate-300 rounded p-1.5">
                   <option value="">Plat (All)</option>
                   {uniquePlates.map(p => <option key={p} value={p}>{p}</option>)}
               </select>
               <select value={filterCoop} onChange={e => { setFilterCoop(e.target.value); setCurrentPage(1); }} className="w-full text-xs border-slate-300 rounded p-1.5">
                   <option value="">Kandang (All)</option>
                   {uniqueCoops.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
               <div className="flex items-center">
                   <label className="flex items-center gap-1 cursor-pointer select-none">
                       <input type="checkbox" checked={showFinishedOnly} onChange={e => { setShowFinishedOnly(e.target.checked); setCurrentPage(1); }} className="w-3.5 h-3.5 rounded text-primary" />
                       <span className="text-[10px] font-bold text-slate-700">Finished Only</span>
                   </label>
               </div>
          </div>
      </div>

      <div id="recap-table-area" className="bg-white p-2">
        {/* Global Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="bg-slate-50 p-2 rounded border-l-4 border-slate-500">
                <div className="text-[9px] font-bold text-slate-400 uppercase">Pembelian</div>
                <div className="text-sm font-bold text-slate-800">{formatCurrency(totals.buyCost)}</div>
                <div className="text-[10px] text-slate-500">{totals.buyKg.toLocaleString()} Kg</div>
            </div>
            <div className="bg-blue-50 p-2 rounded border-l-4 border-blue-500">
                <div className="text-[9px] font-bold text-blue-400 uppercase">Penjualan</div>
                <div className="text-sm font-bold text-blue-700">{formatCurrency(totals.revenue)}</div>
                <div className="text-[10px] text-blue-600">{totals.soldKg.toLocaleString()} Kg</div>
            </div>
            <div className={`p-2 rounded border-l-4 ${totals.profit >= 0 ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                <div className="text-[9px] font-bold text-slate-400 uppercase">Net Profit</div>
                <div className={`text-base font-black ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totals.profit)}
                </div>
            </div>
            <div className="bg-orange-50 p-2 rounded border-l-4 border-orange-300">
                <div className="text-[9px] font-bold text-orange-400 uppercase">Expenses</div>
                <div className="text-sm font-bold text-orange-600">{formatCurrency(totals.expenses)}</div>
            </div>
        </div>

        {/* Main Table */}
        <div className="rounded border border-slate-200 overflow-hidden relative">
            <div className="overflow-auto max-h-[70vh] custom-scrollbar">
                <table className="w-full text-[11px] whitespace-nowrap text-left border-collapse">
                    <thead className="sticky top-0 z-10 shadow-sm bg-slate-800 text-white uppercase font-semibold">
                        <tr>
                            <th className="p-2 border-r border-slate-600 w-8">#</th>
                            <th className="p-2 border-r border-slate-600 w-16">Tgl</th>
                            <th className="p-2 border-r border-slate-600 max-w-[100px]">Supplier/Kdg</th>
                            <th className="p-2 text-right border-r border-slate-600 bg-slate-700">Modal</th>
                            <th className="p-2 border-r border-slate-600 bg-blue-900 max-w-[150px]">Customer</th>
                            <th className="p-2 text-right border-r border-slate-600 bg-blue-900">Jual(Kg)</th>
                            <th className="p-2 text-right border-r border-slate-600 bg-blue-900">Mati</th>
                            <th className="p-2 text-right border-r border-slate-600 bg-blue-800">Revenue</th>
                            <th className="p-2 text-right border-r border-slate-600 bg-orange-900">Ops</th>
                            <th className="p-2 text-center border-r border-slate-600 bg-emerald-900">Susut</th>
                            <th className="p-2 text-right bg-emerald-800 font-bold">Laba/Rugi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {paginatedRows.length === 0 && orphanedData.count === 0 ? (
                            <tr><td colSpan={11} className="p-4 text-center text-slate-400 italic">No data matching filters.</td></tr>
                        ) : (
                            paginatedRows.map((row) => (
                                <React.Fragment key={row.purchase.id}>
                                <tr 
                                    className={`hover:bg-slate-50 cursor-pointer ${expandedRowId === row.purchase.id ? 'bg-blue-50' : ''}`}
                                    onClick={() => toggleRow(row.purchase.id)}
                                >
                                    <td className="p-2 border-r border-slate-100 text-center text-slate-400">
                                        {expandedRowId === row.purchase.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    </td>
                                    <td className="p-2 border-r border-slate-100">
                                        <div>{formatDate(row.purchase.date)}</div>
                                        <div className="flex gap-1 mt-0.5 items-center">
                                            {row.isFinished && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                                            <span className="text-[9px] text-slate-400">{row.purchase.plate}</span>
                                        </div>
                                    </td>
                                    <td className="p-2 border-r border-slate-100 truncate max-w-[100px]" title={`${row.purchase.supplier} | ${row.purchase.coop}`}>
                                        <div className="font-bold text-slate-700 truncate">{row.purchase.supplier}</div>
                                        <div className="text-[9px] text-slate-500 truncate">{row.purchase.coop}</div>
                                    </td>
                                    <td className="p-2 text-right border-r border-slate-100 font-mono bg-slate-50/50">
                                        <div className="font-semibold">{formatCurrency(Number(row.purchase.totalBuyCost)||0).replace('Rp','').trim()}</div>
                                        <div className="text-[9px] text-slate-400">{row.purchase.kg.toLocaleString()}Kg</div>
                                    </td>

                                    <td className="p-2 border-r border-slate-100 truncate max-w-[150px]" title={row.customers}>
                                        {row.salesCount > 0 ? (
                                            <div className="text-blue-800 font-medium truncate">{row.customers}</div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-300 italic">Open</span>
                                                {onInputSale && <button onClick={(e) => {e.stopPropagation(); onInputSale(row.purchase.id);}} className="text-[9px] px-1 bg-blue-100 rounded hover:bg-blue-200"><PlusCircle className="w-3 h-3"/></button>}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-2 text-right border-r border-slate-100 font-mono">
                                        {row.soldKg.toLocaleString()}
                                    </td>
                                    <td className="p-2 text-right border-r border-slate-100 font-mono text-red-500">
                                        {row.mortalityKg > 0 ? row.mortalityKg : '-'}
                                    </td>
                                    <td className="p-2 text-right border-r border-slate-100 font-mono font-bold text-blue-700 bg-blue-50/20">
                                        {formatCurrency(row.totalRevenue).replace('Rp','').trim()}
                                    </td>
                                    
                                    <td className="p-2 text-right border-r border-slate-100 font-mono text-orange-700">
                                        {formatCurrency(row.totalExpenses).replace('Rp','').trim()}
                                    </td>

                                    <td className="p-2 text-center border-r border-slate-100">
                                        <div className={row.shrinkageKg > 0 ? 'text-orange-600 font-bold' : 'text-green-600'}>
                                            {(row.shrinkageKg || 0).toFixed(0)}
                                        </div>
                                        <div className="text-[9px] text-slate-400">{(row.shrinkagePct || 0).toFixed(1)}%</div>
                                    </td>
                                    <td className={`p-2 text-right font-bold font-mono border-l-2 ${row.netProfit >= 0 ? 'text-green-700 border-green-200 bg-green-50/30' : 'text-red-700 border-red-200 bg-red-50/30'}`}>
                                        {formatCurrency(row.netProfit)}
                                    </td>
                                </tr>
                                {expandedRowId === row.purchase.id && (
                                    <tr className="bg-slate-100/50 shadow-inner">
                                        <td colSpan={11} className="p-3 border-b border-slate-200">
                                            
                                            {/* FINANCIAL SUMMARY BLOCK */}
                                            <div className="mb-4 bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                                                <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-1">
                                                    <PieChart className="w-3 h-3 text-slate-500" />
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Financial Analysis (Batch Ini)</span>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                                                    <div className="p-2 bg-blue-50/50 rounded border border-blue-100">
                                                        <div className="text-[10px] text-blue-500 font-bold uppercase">Total Revenue</div>
                                                        <div className="text-sm font-bold text-blue-700">{formatCurrency(row.totalRevenue)}</div>
                                                    </div>
                                                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                                                        <div className="text-[10px] text-slate-500 font-bold uppercase">Modal Beli</div>
                                                        <div className="text-sm font-bold text-slate-700">{formatCurrency(row.purchase.totalBuyCost)}</div>
                                                    </div>
                                                    <div className="p-2 bg-orange-50/50 rounded border border-orange-100">
                                                        <div className="text-[10px] text-orange-500 font-bold uppercase">Total Expenses</div>
                                                        <div className="text-sm font-bold text-orange-700">{formatCurrency(row.totalExpenses)}</div>
                                                    </div>
                                                    <div className="p-2 bg-orange-50/50 rounded border border-orange-100">
                                                        <div className="text-[10px] text-orange-600 font-bold uppercase">Cost / Kg</div>
                                                        <div className="text-sm font-bold text-orange-800">{formatCurrency(row.costPerKg)}</div>
                                                    </div>
                                                    <div className={`p-2 rounded border ${row.netProfit >= 0 ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
                                                        <div className={`text-[10px] font-bold uppercase ${row.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Profit</div>
                                                        <div className={`text-sm font-bold ${row.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(row.netProfit)}</div>
                                                    </div>
                                                    <div className={`p-2 rounded border ${row.profitPerKg >= 0 ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
                                                        <div className={`text-[10px] font-bold uppercase ${row.profitPerKg >= 0 ? 'text-green-600' : 'text-red-600'}`}>Profit / Kg</div>
                                                        <div className={`text-sm font-bold ${row.profitPerKg >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(row.profitPerKg)}</div>
                                                    </div>
                                                    <div className={`p-2 rounded border flex flex-col justify-center items-center ${row.marginPct >= 0 ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'}`}>
                                                        <div className={`text-[9px] font-bold uppercase ${row.marginPct >= 0 ? 'text-green-700' : 'text-red-700'}`}>Net Margin</div>
                                                        <div className={`text-lg font-black ${row.marginPct >= 0 ? 'text-green-800' : 'text-red-800'}`}>{row.marginPct.toFixed(2)}%</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* SALES TABLE */}
                                            <div className="bg-white border border-blue-200 rounded-md overflow-hidden text-[10px] shadow-sm">
                                                <div className="bg-blue-50/50 p-1.5 px-3 border-b border-blue-100 font-bold text-blue-800 flex items-center gap-2">
                                                    <List className="w-3 h-3" /> Rincian Penjualan
                                                </div>
                                                <table className="w-full text-left">
                                                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                                                        <tr>
                                                            <th className="p-2 pl-4">Customer</th>
                                                            <th className="p-2">Berat (Kg)</th>
                                                            <th className="p-2">Harga</th>
                                                            <th className="p-2 text-right text-orange-600">Bongkar</th>
                                                            <th className="p-2 text-right text-orange-600">Sopir</th>
                                                            <th className="p-2 text-right text-orange-600">Ops Lain</th>
                                                            <th className="p-2 text-right text-blue-700">Total Invoice</th>
                                                            <th className="p-2 text-center">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {row.sales.map((sale) => (
                                                            <tr key={sale.id} className="hover:bg-blue-50/30">
                                                                <td className="p-2 pl-4 font-bold text-slate-700 w-48">{sale.customerName}</td>
                                                                <td className="p-2 font-mono">
                                                                    {sale.soldKg.toLocaleString()}
                                                                    {sale.mortalityKg > 0 && <span className="text-red-500 ml-1 text-[9px]">(-{sale.mortalityKg} mt)</span>}
                                                                </td>
                                                                <td className="p-2 font-mono text-slate-500">@{formatCurrency(sale.sellPrice)}</td>
                                                                <td className="p-2 text-right text-slate-400">{sale.unloadingCost > 0 ? formatCurrency(sale.unloadingCost) : '-'}</td>
                                                                <td className="p-2 text-right text-slate-400">{sale.driverBonus > 0 ? formatCurrency(sale.driverBonus) : '-'}</td>
                                                                <td className="p-2 text-right text-slate-400">{(sale.operationalCost || 0) > 0 ? formatCurrency(sale.operationalCost || 0) : '-'}</td>
                                                                <td className="p-2 text-right font-bold text-blue-700">
                                                                    {formatCurrency((sale.soldKg - sale.mortalityKg) * sale.sellPrice)}
                                                                </td>
                                                                <td className="p-2 text-center">
                                                                    {onEditSale && <button onClick={() => onEditSale(sale.id)} className="text-blue-500 hover:text-blue-700 hover:underline">Edit</button>}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {row.sales.length === 0 && (
                                                            <tr><td colSpan={8} className="p-3 text-center text-slate-400 italic">Belum ada data penjualan untuk stok ini.</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                </React.Fragment>
                            ))
                        )}
                        {/* Orphaned Row Compact */}
                        {orphanedData.count > 0 && (
                            <React.Fragment>
                            <tr className="bg-yellow-50 border-t border-yellow-200 cursor-pointer" onClick={() => setShowOrphanedDetail(!showOrphanedDetail)}>
                                <td colSpan={7} className="p-2 font-bold text-yellow-800 text-xs">
                                    <div className="flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Data Tanpa Induk Pembelian ({orphanedData.count})</div>
                                </td>
                                <td className="p-2 text-right font-bold text-blue-700 font-mono">{formatCurrency(orphanedData.totalRevenue).replace('Rp','')}</td>
                                <td className="p-2 text-right text-orange-700 font-mono">{formatCurrency(orphanedData.totalExpenses).replace('Rp','')}</td>
                                <td></td>
                                <td className="p-2 text-right font-bold text-green-700 font-mono">{formatCurrency(orphanedData.netProfit)}</td>
                            </tr>
                            {showOrphanedDetail && (
                                <tr className="bg-yellow-50/50">
                                    <td colSpan={11} className="p-2">
                                        <div className="bg-white border border-yellow-200 rounded text-[10px] p-2">
                                            {orphanedData.sales.map(s => (
                                                <div key={s.id} className="flex justify-between border-b border-dashed border-slate-200 py-1">
                                                    <span>{formatDate(s.date)} - {s.customerName}</span>
                                                    <span className="font-mono">{formatCurrency(s.sellPrice * (s.soldKg - s.mortalityKg))}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            </React.Fragment>
                        )}
                    </tbody>
                    <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-[10px] uppercase">
                        <tr>
                            <td colSpan={3} className="p-2 text-right">Total:</td>
                            <td className="p-2 text-right">{formatCurrency(totals.buyCost).replace('Rp','')}</td>
                            <td className="p-2 bg-slate-200"></td>
                            <td className="p-2 text-right">{totals.soldKg.toLocaleString()}</td>
                            <td className="p-2 text-right text-red-600">{totals.deadKg.toLocaleString()}</td>
                            <td className="p-2 text-right text-blue-800">{formatCurrency(totals.revenue).replace('Rp','')}</td>
                            <td className="p-2 text-right text-orange-700">{formatCurrency(totals.expenses).replace('Rp','')}</td>
                            <td className="p-2 bg-slate-200"></td>
                            <td className={`p-2 text-right text-xs ${totals.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {formatCurrency(totals.profit)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 print:hidden">
            <div className="text-[10px] text-slate-500">
                View {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, combinedRows.length)} of {combinedRows.length}
            </div>
            <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 border rounded hover:bg-slate-50 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs font-bold text-slate-700 px-2">{currentPage} / {totalPages || 1}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-1 border rounded hover:bg-slate-50 disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default RecapTable;
