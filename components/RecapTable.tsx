
import React, { useMemo, useState } from 'react';
import { PurchaseRecord, SaleRecord } from '../types';
import { Printer, TrendingUp, Download, Edit, ImageDown, AlertCircle, Filter, X, CheckCircle2, PlusCircle, ChevronDown, ChevronUp, DollarSign, Scale, Truck, Users, MousePointerClick, Calculator, HelpCircle, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
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
  
  // New Filters
  const [filterDriver, setFilterDriver] = useState<string>('');
  const [filterPlate, setFilterPlate] = useState<string>('');
  const [filterCoop, setFilterCoop] = useState<string>('');
  const [showFinishedOnly, setShowFinishedOnly] = useState<boolean>(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 30;

  // Expanded Row State
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [showDetailId, setShowDetailId] = useState<string | null>(null);
  
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
        setShowDetailId(null); // Reset detail view when collapsing
    } else {
        setExpandedRowId(id);
        setShowDetailId(null); // Reset detail view when opening new row
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
        // Robust filtering: ensure ID comparison is safe and type-insensitive
        const pIdNormalized = String(p.id).trim().toLowerCase();
        
        const relatedSales = sales.filter(s => 
            s.purchaseId && String(s.purchaseId).trim().toLowerCase() === pIdNormalized
        );

        const soldKg = relatedSales.reduce((sum, s) => sum + (Number(s.soldKg) || 0), 0);
        const mortalityKg = relatedSales.reduce((sum, s) => sum + (Number(s.mortalityKg) || 0), 0);
        
        // Revenue (Total Invoice Value)
        const totalRevenue = relatedSales.reduce((sum, s) => {
            const sKg = Number(s.soldKg) || 0;
            const mKg = Number(s.mortalityKg) || 0;
            const price = Number(s.sellPrice) || 0;
            // Ensure netKg is not negative
            const netKg = Math.max(0, sKg - mKg);
            return sum + (netKg * price);
        }, 0);

        // Operational Expenses
        const totalUnloading = relatedSales.reduce((sum, s) => sum + (Number(s.unloadingCost) || 0), 0);
        const totalOps = relatedSales.reduce((sum, s) => sum + (Number(s.operationalCost) || 0), 0);
        const totalTruck = relatedSales.reduce((sum, s) => sum + (Number(s.truckCost) || 0), 0);
        const totalDriverBonus = relatedSales.reduce((sum, s) => sum + (Number(s.driverBonus) || 0), 0);
        
        const customers = Array.from(new Set(relatedSales.map(s => s.customerName).filter(Boolean))).join(', ');

        // Profit Calculation
        const totalExpenses = totalUnloading + totalOps + totalTruck;
        const totalBuyCost = Number(p.totalBuyCost) || 0;
        const netProfit = totalRevenue - totalBuyCost - totalExpenses;
        
        const shrinkageKg = (Number(p.kg) || 0) - soldKg; 
        const shrinkagePct = (Number(p.kg) || 0) > 0 ? (shrinkageKg / Number(p.kg)) * 100 : 0;
        
        // Margin Calculations
        // Avg Sell Price = Total Revenue / Net Sold Kg (Live birds paid for)
        const netSoldKg = Math.max(0, soldKg - mortalityKg);
        const avgSellPrice = netSoldKg > 0 ? totalRevenue / netSoldKg : 0;
        
        const marginPerKg = avgSellPrice - p.buyPrice;
        const operationalCostPerKg = soldKg > 0 ? totalExpenses / soldKg : 0;

        // Determine completion status
        const isFinished = shrinkagePct < 20;

        return {
            purchase: p,
            sales: relatedSales, // Pass full sales array for detail view
            salesCount: relatedSales.length,
            customers,
            soldKg,
            mortalityKg,
            totalRevenue,
            totalExpenses,
            totalUnloading,
            totalOps,
            totalTruck,
            totalDriverBonus,
            netProfit,
            shrinkageKg,
            shrinkagePct,
            isFinished,
            avgSellPrice,
            marginPerKg,
            operationalCostPerKg
        };
      });

      // Apply "Show Finished Only" filter AFTER mapping calculations
      if (showFinishedOnly) {
          result = result.filter(r => r.isFinished);
      }

      return result.sort((a, b) => new Date(b.purchase.date).getTime() - new Date(a.purchase.date).getTime());
  }, [purchases, sales, startDate, endDate, allPurchaseIds, filterDriver, filterPlate, filterCoop, showFinishedOnly]);

  // PAGINATION LOGIC
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

  // 4. Totals (Calculated from ALL rows matching filter, not just current page)
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

  const handleDownloadImage = () => {
      downloadAsImage('recap-table-area', `Rekap_Profit_Loss_${startDate || 'All'}`);
  }

  const handleDownloadCSV = () => {
    // ... CSV Logic same as before ...
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 print:hidden">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-primary" />
                Rekap Laba / Rugi (Profit & Loss)
            </h2>
            <p className="text-sm text-slate-500">Analisa profitabilitas per pengiriman.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
             <button 
                onClick={handleDownloadCSV}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-sm text-sm"
            >
                <Download className="w-4 h-4" /> Export CSV
            </button>
            <button 
                onClick={handleDownloadImage}
                className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 shadow-sm text-sm"
            >
                <ImageDown className="w-4 h-4" /> Download JPG
            </button>
             <button 
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 shadow-sm text-sm"
                title="Use browser print dialog to Save as PDF"
            >
                <Printer className="w-4 h-4" /> Print / PDF
            </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 print:hidden">
          {/* ... Filters Logic same as before ... */}
          <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Filter Data
              </h3>
              {(startDate || endDate || filterDriver || filterPlate || filterCoop || showFinishedOnly) && (
                  <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                      <X className="w-3 h-3" /> Clear Filters
                  </button>
              )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
               <div>
                   <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Dari Tanggal</label>
                   <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setCurrentPage(1); }} className="w-full text-sm border-slate-300 rounded p-2" />
               </div>
               <div>
                   <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Sampai Tanggal</label>
                   <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setCurrentPage(1); }} className="w-full text-sm border-slate-300 rounded p-2" />
               </div>
               <div>
                   <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Supir</label>
                   <select value={filterDriver} onChange={e => { setFilterDriver(e.target.value); setCurrentPage(1); }} className="w-full text-sm border-slate-300 rounded p-2">
                       <option value="">-- Semua Supir --</option>
                       {uniqueDrivers.map(d => <option key={d} value={d}>{d}</option>)}
                   </select>
               </div>
               <div>
                   <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Plat Nomor</label>
                   <select value={filterPlate} onChange={e => { setFilterPlate(e.target.value); setCurrentPage(1); }} className="w-full text-sm border-slate-300 rounded p-2">
                       <option value="">-- Semua Plat --</option>
                       {uniquePlates.map(p => <option key={p} value={p}>{p}</option>)}
                   </select>
               </div>
               <div>
                   <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Kandang</label>
                   <select value={filterCoop} onChange={e => { setFilterCoop(e.target.value); setCurrentPage(1); }} className="w-full text-sm border-slate-300 rounded p-2">
                       <option value="">-- Semua Kandang --</option>
                       {uniqueCoops.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
               </div>
               <div className="flex items-center pb-2">
                   <label className="flex items-center gap-2 cursor-pointer select-none">
                       <input 
                            type="checkbox" 
                            checked={showFinishedOnly} 
                            onChange={e => { setShowFinishedOnly(e.target.checked); setCurrentPage(1); }}
                            className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                       />
                       <span className="text-xs font-bold text-slate-700">Sudah Terisi Semua (Habis)</span>
                   </label>
               </div>
          </div>
      </div>

      <div id="recap-table-area" className="bg-white p-4">
        <div className="hidden print:block mb-4">
            <h1 className="text-xl font-bold uppercase text-center">Laporan Rekap Laba Rugi</h1>
            <p className="text-center text-sm text-slate-600">
                Periode: {startDate || 'Awal'} s/d {endDate || 'Sekarang'}
            </p>
        </div>

        {/* Global Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-slate-500">
                <div className="text-xs font-bold text-slate-400 uppercase">Total Pembelian</div>
                <div className="text-lg font-bold text-slate-800">{formatCurrency(totals.buyCost)}</div>
                <div className="text-xs text-slate-500">{totals.buyKg.toLocaleString()} Kg</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                <div className="text-xs font-bold text-slate-400 uppercase">Total Penjualan</div>
                <div className="text-lg font-bold text-blue-700">{formatCurrency(totals.revenue)}</div>
                <div className="text-xs text-slate-500">{totals.soldKg.toLocaleString()} Kg</div>
            </div>
            <div className={`bg-white p-4 rounded-lg shadow border-l-4 ${totals.profit >= 0 ? 'border-green-500' : 'border-red-500'}`}>
                <div className="text-xs font-bold text-slate-400 uppercase">Net Profit (Laba Bersih)</div>
                <div className={`text-xl font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(totals.profit)}
                </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-300">
                <div className="text-xs font-bold text-slate-400 uppercase">Total Expenses</div>
                <div className="text-lg font-bold text-orange-600">{formatCurrency(totals.expenses)}</div>
                <div className="text-xs text-slate-500">Ops + Truk + Bongkar</div>
            </div>
        </div>

        <div className="rounded-xl shadow-lg border border-slate-200 overflow-hidden print:shadow-none print:border-none">
            <div className="overflow-auto max-h-[75vh] border-b border-slate-200 relative">
                <table className="w-full text-xs md:text-sm whitespace-nowrap text-left border-collapse print:text-xs">
                    <thead className="sticky top-0 z-10 shadow-sm">
                        <tr className="bg-slate-800 text-white uppercase text-[10px] tracking-wider print:bg-gray-200 print:text-black">
                            <th className="p-3 border-r border-slate-600 w-24 print:border-gray-400">Tanggal</th>
                            <th className="p-3 border-r border-slate-600 print:border-gray-400">Supplier / Kandang</th>
                            <th className="p-3 text-right border-r border-slate-600 print:border-gray-400">Beli (Rp)</th>
                            
                            <th className="p-3 border-r border-slate-600 bg-blue-900 print:bg-gray-200 print:border-gray-400">Customer</th>
                            <th className="p-3 text-right border-r border-slate-600 bg-blue-800 print:bg-gray-200 print:border-gray-400">Jual (Kg)</th>
                            <th className="p-3 text-right border-r border-slate-600 bg-blue-800 print:bg-gray-200 print:border-gray-400">Mati (Kg)</th>
                            <th className="p-3 text-right border-r border-slate-600 bg-blue-800 print:bg-gray-200 print:border-gray-400">Revenue (Rp)</th>
                            
                            <th className="p-3 text-right border-r border-slate-600 bg-orange-900 print:bg-gray-200 print:border-gray-400">Expenses</th>
                            
                            <th className="p-3 text-right border-r border-slate-600 bg-emerald-900 print:bg-gray-200 print:border-gray-400">Susut</th>
                            <th className="p-3 text-right bg-emerald-800 print:bg-gray-200">Laba / Rugi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 print:divide-gray-300 bg-white">
                        {paginatedRows.length === 0 && orphanedData.count === 0 ? (
                            <tr>
                                <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                                    Belum ada data pembelian untuk periode/filter ini.
                                </td>
                            </tr>
                        ) : (
                            paginatedRows.map((row) => (
                                <React.Fragment key={row.purchase.id}>
                                <tr 
                                    className={`hover:bg-slate-50 transition-colors cursor-pointer group ${expandedRowId === row.purchase.id ? 'bg-blue-50/50' : ''}`}
                                    onClick={() => toggleRow(row.purchase.id)}
                                >
                                    <td className="p-3 font-medium text-slate-700 border-r border-slate-100 flex items-center justify-between gap-1">
                                        <div className="flex flex-col">
                                            <span>{formatDate(row.purchase.date)}</span>
                                            {row.isFinished && (
                                                <span className="text-[9px] text-green-600 flex items-center gap-0.5 bg-green-50 px-1 rounded w-fit mt-0.5 border border-green-200">
                                                    <CheckCircle2 className="w-2.5 h-2.5" /> Selesai
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1 items-end print:hidden">
                                            {expandedRowId === row.purchase.id ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                                            {onEditPurchase && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onEditPurchase(row.purchase.id); }}
                                                    className="text-slate-400 hover:text-blue-500"
                                                    title="Edit Pembelian"
                                                >
                                                    <Edit className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    {/* ... Other Columns same as before ... */}
                                    <td className="p-3 border-r border-slate-100">
                                        <div className="font-bold text-slate-800">{row.purchase.supplier || '-'}</div>
                                        <div className="text-xs text-slate-500 flex gap-1">
                                            <span>{row.purchase.coop || 'No Coop'}</span> |
                                            <span>{row.purchase.plate || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-right border-r border-slate-100 font-mono text-slate-600 bg-slate-50/50">
                                        {formatCurrency(Number(row.purchase.totalBuyCost) || 0)}
                                    </td>

                                    <td className="p-3 border-r border-slate-100 max-w-[200px] truncate text-blue-800 font-medium relative" title={row.customers}>
                                        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end pr-1 pointer-events-none">
                                            <MousePointerClick className="w-4 h-4 text-blue-400 animate-bounce" />
                                        </div>
                                        {row.salesCount > 0 ? (
                                            <div className="flex items-center gap-1">
                                                {row.salesCount > 1 && <Users className="w-3 h-3 text-slate-400" />}
                                                {row.customers}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-300 italic">Belum terjual</span>
                                                {onInputSale && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onInputSale(row.purchase.id); }}
                                                        className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 print:hidden"
                                                    >
                                                        <PlusCircle className="w-3 h-3" /> Input
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3 text-right border-r border-slate-100 font-mono">
                                        {row.soldKg.toLocaleString()}
                                    </td>
                                    <td className="p-3 text-right border-r border-slate-100 font-mono text-red-500">
                                        {row.mortalityKg > 0 ? row.mortalityKg : '-'}
                                    </td>
                                    <td className="p-3 text-right border-r border-slate-100 font-mono font-bold text-blue-700 bg-blue-50/30">
                                        {formatCurrency(row.totalRevenue)}
                                    </td>
                                    
                                    <td className="p-3 text-right border-r border-slate-100 text-xs font-mono text-orange-700">
                                        {formatCurrency(row.totalExpenses)}
                                    </td>

                                    <td className="p-3 text-right border-r border-slate-100 text-xs">
                                        <div className={row.shrinkageKg > 0 ? 'text-orange-600' : 'text-green-600'}>
                                            {(row.shrinkageKg || 0).toFixed(1)} Kg
                                        </div>
                                        <div className="text-slate-400">{(row.shrinkagePct || 0).toFixed(1)}%</div>
                                    </td>
                                    <td className={`p-3 text-right font-bold font-mono text-sm ${row.netProfit >= 0 ? 'text-green-600 bg-green-50/50' : 'text-red-600 bg-red-50/50'}`}>
                                        {formatCurrency(row.netProfit)}
                                    </td>
                                </tr>
                                
                                {expandedRowId === row.purchase.id && (
                                    <tr className="bg-slate-50 animate-in slide-in-from-top-2">
                                        <td colSpan={10} className="p-4 md:p-6 border-b border-slate-200 shadow-inner">
                                            
                                            {/* --- NEW SUMMARY CARD LAYOUT --- */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                                
                                                {/* Card 1: Pembelian */}
                                                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-slate-400">
                                                    <div className="text-xs font-bold uppercase text-slate-400 mb-1">Total Pembelian</div>
                                                    <div className="text-lg font-bold text-slate-700">{formatCurrency(row.purchase.totalBuyCost)}</div>
                                                    <div className="text-xs text-slate-400">{row.purchase.kg} Kg</div>
                                                </div>

                                                {/* Card 2: Penjualan */}
                                                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-blue-500">
                                                    <div className="text-xs font-bold uppercase text-slate-400 mb-1">Total Penjualan</div>
                                                    <div className="text-lg font-bold text-blue-700">{formatCurrency(row.totalRevenue)}</div>
                                                    <div className="text-xs text-slate-400">{row.soldKg} Kg</div>
                                                </div>

                                                {/* Card 3: NET PROFIT (Clickable) */}
                                                <div 
                                                    onClick={() => setShowDetailId(showDetailId === row.purchase.id ? null : row.purchase.id)}
                                                    className={`p-4 rounded-lg shadow-md border-l-4 cursor-pointer transition-all transform hover:scale-105 active:scale-95 group relative ring-2 ${showDetailId === row.purchase.id ? 'ring-blue-400 ring-offset-2' : 'ring-transparent'}
                                                        ${row.netProfit >= 0 ? 'bg-green-50 border-green-200 border-l-green-600' : 'bg-red-50 border-red-200 border-l-red-600'}`}
                                                >
                                                     <div className="flex justify-between items-start">
                                                        <div className={`text-xs font-bold uppercase mb-1 ${row.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            Net Profit (Laba Bersih)
                                                        </div>
                                                        <HelpCircle className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                     </div>
                                                     <div className={`text-xl font-bold ${row.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                        {formatCurrency(row.netProfit)}
                                                     </div>
                                                     <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-bold">
                                                         {showDetailId === row.purchase.id ? 'Klik untuk tutup' : 'Klik untuk lihat detail'} <ArrowRight className="w-3 h-3" />
                                                     </div>
                                                </div>

                                                {/* Card 4: Expenses */}
                                                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 border-l-4 border-l-orange-400">
                                                    <div className="text-xs font-bold uppercase text-slate-400 mb-1">Total Expenses</div>
                                                    <div className="text-lg font-bold text-orange-600">{formatCurrency(row.totalExpenses)}</div>
                                                    <div className="text-xs text-slate-400">Ops + Truk + Bongkar</div>
                                                </div>
                                            </div>

                                            {/* --- DETAIL CALCULATION BOX (CONDITIONAL) --- */}
                                            {showDetailId === row.purchase.id && (
                                                <div className="mb-6 bg-gradient-to-r from-slate-50 to-white border-2 border-blue-200 rounded-xl p-6 relative animate-in slide-in-from-top-4 fade-in duration-300 shadow-md">
                                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-3 bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md flex items-center gap-2">
                                                        <Calculator className="w-3 h-3" /> Analisa Profit & Margin Breakdown
                                                    </div>

                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
                                                        {/* Left: Formula Breakdown */}
                                                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                                            <h4 className="text-sm font-bold text-slate-700 border-b border-slate-100 pb-3 mb-3 flex items-center gap-2">
                                                                <Scale className="w-4 h-4 text-blue-500" /> Rumus Perhitungan
                                                            </h4>
                                                            
                                                            <div className="space-y-3 text-sm">
                                                                <div className="flex justify-between items-center group">
                                                                    <div>
                                                                        <div className="font-bold text-blue-800">(+) Total Pendapatan (Revenue)</div>
                                                                        <div className="text-[10px] text-slate-400">Total Penjualan Ayam Hidup</div>
                                                                    </div>
                                                                    <span className="font-mono font-bold text-blue-700 text-lg">{formatCurrency(row.totalRevenue)}</span>
                                                                </div>
                                                                
                                                                <div className="flex justify-between items-center text-red-600 border-t border-dashed border-red-100 pt-2">
                                                                    <div>
                                                                        <div className="font-bold">(-) Modal Pembelian (HPP)</div>
                                                                        <div className="text-[10px] text-red-400 font-mono">
                                                                            {row.purchase.kg.toLocaleString()} kg x {formatCurrency(row.purchase.buyPrice)}
                                                                        </div>
                                                                    </div>
                                                                    <span className="font-mono">({formatCurrency(row.purchase.totalBuyCost)})</span>
                                                                </div>

                                                                <div className="flex justify-between items-start text-orange-600 pt-2">
                                                                    <div>
                                                                        <div className="font-bold">(-) Biaya Operasional (Exp)</div>
                                                                        <div className="pl-2 border-l-2 border-orange-200 text-[10px] text-slate-500 mt-1 space-y-0.5">
                                                                            <div className="flex justify-between w-32"><span>Truk:</span> <span>{formatCurrency(row.totalTruck)}</span></div>
                                                                            <div className="flex justify-between w-32"><span>Bongkar:</span> <span>{formatCurrency(row.totalUnloading)}</span></div>
                                                                            <div className="flex justify-between w-32"><span>Lainnya:</span> <span>{formatCurrency(row.totalOps)}</span></div>
                                                                        </div>
                                                                    </div>
                                                                    <span className="font-mono pt-1">({formatCurrency(row.totalExpenses)})</span>
                                                                </div>

                                                                <div className="border-t-2 border-slate-800 pt-2 mt-2">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="font-black text-slate-900 text-base uppercase">(=) Net Profit</span>
                                                                        <span className={`font-mono font-black text-xl ${row.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                            {formatCurrency(row.netProfit)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Right: Margin Analysis Cards */}
                                                        <div>
                                                            <h4 className="text-sm font-bold text-slate-700 border-b border-slate-200 pb-3 mb-3 flex items-center gap-2">
                                                                <TrendingUp className="w-4 h-4 text-green-500" /> Key Performance Indicator (KPI)
                                                            </h4>
                                                            
                                                            <div className="grid grid-cols-2 gap-3">
                                                                {/* Margin % */}
                                                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
                                                                    <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Net Margin %</div>
                                                                    <div className="text-2xl font-black text-blue-700">
                                                                        {(row.totalRevenue > 0 ? (row.netProfit / row.totalRevenue) * 100 : 0).toFixed(2)}%
                                                                    </div>
                                                                    <div className="text-[9px] text-slate-400 mt-1">Target: {'>'} 5%</div>
                                                                </div>

                                                                {/* Profit / Kg */}
                                                                <div className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow ${row.netProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                                                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${row.netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>Profit / Kg Jual</div>
                                                                    <div className={`text-xl font-black ${row.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                                        {formatCurrency(row.soldKg > 0 ? row.netProfit / row.soldKg : 0)}
                                                                    </div>
                                                                    <div className="text-[9px] text-slate-400 mt-1">Laba bersih per Kg</div>
                                                                </div>

                                                                {/* Cost / Kg */}
                                                                <div className="p-3 bg-orange-50 rounded-lg border border-orange-100 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
                                                                    <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">Cost / Kg Jual</div>
                                                                    <div className="text-xl font-black text-orange-700">
                                                                        {formatCurrency(row.operationalCostPerKg)}
                                                                    </div>
                                                                    <div className="text-[9px] text-slate-400 mt-1">Biaya Ops per Kg</div>
                                                                </div>
                                                                
                                                                {/* Shrinkage */}
                                                                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
                                                                     <div className="text-[10px] font-bold text-yellow-600 uppercase tracking-widest mb-1">Susut Berat</div>
                                                                     <div className="text-xl font-black text-yellow-700">
                                                                        {(row.shrinkagePct || 0).toFixed(2)}%
                                                                     </div>
                                                                     <div className="text-[9px] text-slate-400 mt-1">({(row.shrinkageKg || 0).toFixed(1)} Kg Hilang)</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* SALES BREAKDOWN TABLE (EDITABLE) */}
                                            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-xs font-bold uppercase text-slate-700 flex gap-2 items-center justify-between">
                                                    <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Rincian Distribusi & Biaya (Klik Edit untuk Revisi Biaya)</div>
                                                </div>
                                                <table className="w-full text-sm text-left">
                                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                                        <tr>
                                                            <th className="px-4 py-2">Customer</th>
                                                            <th className="px-4 py-2 text-right">Qty Jual</th>
                                                            <th className="px-4 py-2 text-right">Harga</th>
                                                            <th className="px-4 py-2 text-right">Bongkar</th>
                                                            <th className="px-4 py-2 text-right">Truk</th>
                                                            <th className="px-4 py-2 text-right">Ops Lain</th>
                                                            <th className="px-4 py-2 text-right">Bon Sopir</th>
                                                            <th className="px-4 py-2 text-center">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {row.sales.map((sale) => (
                                                            <tr key={sale.id} className="hover:bg-slate-50 group">
                                                                <td className="px-4 py-2 font-medium text-slate-800">{sale.customerName}</td>
                                                                <td className="px-4 py-2 text-right font-mono">{sale.soldKg.toLocaleString()} kg</td>
                                                                <td className="px-4 py-2 text-right font-mono text-slate-500">{formatCurrency(sale.sellPrice)}</td>
                                                                <td className="px-4 py-2 text-right text-slate-600 font-mono">
                                                                    {sale.unloadingCost > 0 ? formatCurrency(sale.unloadingCost) : '-'}
                                                                </td>
                                                                <td className="px-4 py-2 text-right text-slate-600 font-mono">
                                                                    {sale.truckCost > 0 ? formatCurrency(sale.truckCost) : '-'}
                                                                </td>
                                                                <td className="px-4 py-2 text-right text-slate-600 font-mono">
                                                                    {sale.operationalCost > 0 ? formatCurrency(sale.operationalCost) : '-'}
                                                                </td>
                                                                <td className="px-4 py-2 text-right text-slate-400 font-mono text-xs">
                                                                    {sale.driverBonus > 0 ? formatCurrency(sale.driverBonus) : '-'}
                                                                </td>
                                                                <td className="px-4 py-2 text-center">
                                                                    {onEditSale && (
                                                                        <button 
                                                                            onClick={() => onEditSale(sale.id)}
                                                                            className="text-blue-600 hover:text-blue-800 p-1 border border-blue-200 rounded bg-white hover:bg-blue-50 text-xs flex items-center gap-1 mx-auto"
                                                                            title="Edit Biaya / Transaksi"
                                                                        >
                                                                            <Edit className="w-3 h-3" /> Edit
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                </React.Fragment>
                            ))
                        )}

                        {/* Orphaned / Unlinked Sales Row (Hidden if specific filters active) */}
                        {orphanedData.count > 0 && (
                            <React.Fragment>
                            <tr 
                                className="bg-yellow-50 border-t-2 border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors"
                                onClick={() => setShowOrphanedDetail(!showOrphanedDetail)}
                            >
                                <td className="p-3 font-medium text-yellow-800 border-r border-yellow-200" colSpan={2}>
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        Data Tanpa Induk Pembelian
                                        {showOrphanedDetail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </div>
                                    <div className="text-[10px] text-yellow-600">
                                        *Transaksi penjualan yang data pembeliannya dihapus/hilang ({orphanedData.count} items)
                                    </div>
                                </td>
                                <td className="p-3 text-right border-r border-yellow-200 text-slate-400 font-mono">-</td>
                                <td className="p-3 border-r border-yellow-200 text-slate-500 italic">Multiple / Mixed</td>
                                
                                <td className="p-3 text-right border-r border-yellow-200 font-mono font-bold">{orphanedData.soldKg.toLocaleString()}</td>
                                <td className="p-3 text-right border-r border-yellow-200 font-mono text-red-500">{orphanedData.mortalityKg.toLocaleString()}</td>
                                <td className="p-3 text-right border-r border-yellow-200 font-mono font-bold text-blue-700">{formatCurrency(orphanedData.totalRevenue)}</td>
                                <td className="p-3 text-right border-r border-yellow-200 font-mono text-orange-700">{formatCurrency(orphanedData.totalExpenses)}</td>
                                <td className="p-3 border-r border-yellow-200 text-center">-</td>
                                <td className="p-3 text-right font-bold font-mono text-green-600">{formatCurrency(orphanedData.netProfit)}</td>
                            </tr>
                            {/* Orphaned Detail View */}
                            {showOrphanedDetail && (
                                <tr className="bg-yellow-50/50">
                                    <td colSpan={10} className="p-4 border-b border-yellow-200">
                                        <div className="bg-white border border-yellow-200 rounded-lg overflow-hidden">
                                            <div className="bg-yellow-100 px-4 py-2 border-b border-yellow-200 text-xs font-bold uppercase text-yellow-800">
                                                Rincian Transaksi Tanpa Induk
                                            </div>
                                            <table className="w-full text-sm text-left">
                                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                                                    <tr>
                                                        <th className="px-4 py-2">Tanggal</th>
                                                        <th className="px-4 py-2">Customer</th>
                                                        <th className="px-4 py-2 text-right">Qty Jual</th>
                                                        <th className="px-4 py-2 text-right">Harga</th>
                                                        <th className="px-4 py-2 text-right">Revenue</th>
                                                        <th className="px-4 py-2 text-center">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {orphanedData.sales.map((sale) => (
                                                        <tr key={sale.id} className="hover:bg-slate-50">
                                                            <td className="px-4 py-2 text-slate-600">{formatDate(sale.date)}</td>
                                                            <td className="px-4 py-2 font-medium text-slate-800">{sale.customerName}</td>
                                                            <td className="px-4 py-2 text-right font-mono">{sale.soldKg.toLocaleString()} kg</td>
                                                            <td className="px-4 py-2 text-right font-mono text-slate-500">{formatCurrency(sale.sellPrice)}</td>
                                                            <td className="px-4 py-2 text-right font-bold text-blue-700">
                                                                {formatCurrency(Math.max(0, sale.soldKg - sale.mortalityKg) * sale.sellPrice)}
                                                            </td>
                                                            <td className="px-4 py-2 text-center">
                                                                {onEditSale && (
                                                                    <button 
                                                                        onClick={() => onEditSale(sale.id)}
                                                                        className="text-blue-600 hover:text-blue-800 p-1 border border-blue-200 rounded bg-white text-xs flex items-center gap-1 mx-auto"
                                                                    >
                                                                        <Edit className="w-3 h-3" /> Edit
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            </React.Fragment>
                        )}

                    </tbody>
                    <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-xs uppercase print:bg-gray-100 print:border-gray-400">
                        <tr>
                            <td colSpan={2} className="p-3 text-right">Total Periode:</td>
                            <td className="p-3 text-right">{formatCurrency(totals.buyCost)}</td>
                            <td className="p-3 bg-slate-200 print:bg-gray-100"></td>
                            <td className="p-3 text-right">{totals.soldKg.toLocaleString()}</td>
                            <td className="p-3 text-right text-red-600">{totals.deadKg.toLocaleString()}</td>
                            <td className="p-3 text-right text-blue-800">{formatCurrency(totals.revenue)}</td>
                            <td className="p-3 text-right text-orange-700">{formatCurrency(totals.expenses)}</td>
                            <td className="p-3 bg-slate-200 print:bg-gray-100"></td>
                            <td className={`p-3 text-right text-sm ${totals.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {formatCurrency(totals.profit)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>

        {/* PAGINATION CONTROLS */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100 print:hidden">
            <div className="text-xs text-slate-500">
                Menampilkan {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, combinedRows.length)} dari {combinedRows.length} data.
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-700">
                    Halaman {currentPage} / {totalPages || 1}
                </span>
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-2 border rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default RecapTable;
