
import React, { useState, useMemo, useEffect } from 'react';
import { PurchaseRecord, SaleRecord, LedgerRow, User } from '../types';
import { formatDate, formatCurrency } from '../utils';
import { Loader2, Printer, Edit, FileWarning, Trash2, Search, Plus, Filter, ChevronLeft, ChevronRight, X, Calendar } from 'lucide-react';
import * as Storage from '../services/storageService';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface SalesListProps {
  purchases: PurchaseRecord[];
  sales?: SaleRecord[];
  onEditSale: (id: string) => void;
  onPrintInvoice: (data: LedgerRow) => void;
  onComplaint: (sale: SaleRecord) => void;
  onDeleteSale: (id: string) => Promise<void>;
  user: User;
  onNewSale: () => void;
}

const SalesList: React.FC<SalesListProps> = ({ purchases, sales, onEditSale, onPrintInvoice, onComplaint, onDeleteSale, user, onNewSale }) => {
  const [internalSales, setInternalSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (sales) {
        setInternalSales(sales);
    } else {
        const load = async () => {
            setLoading(true);
            const data = await Storage.getSales();
            setInternalSales(data);
            setLoading(false);
        };
        load();
    }
  }, [sales]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate]);

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const richSalesData = useMemo(() => {
      // 1. Map Data
      const mapped = internalSales.map(s => {
          const purchase = purchases.find(p => p.id === s.purchaseId);
          const totalExtras = (s.unloadingCost || 0) + (s.driverBonus || 0) + (s.operationalCost || 0) + (s.truckCost || 0);
          const netKg = Math.max(0, s.soldKg - s.mortalityKg);
          const totalInvoice = netKg * s.sellPrice;

          return {
              ...s,
              plate: purchase?.plate || 'Unknown',
              driver: purchase?.driver || 'Unknown',
              coop: purchase?.coop || 'Unknown',
              totalExtras,
              totalInvoice,
              // For ledger row mapping
              customer: s.customerName,
              totalSales: totalInvoice,
              totalPaid: 0, 
              remainingBalance: totalInvoice 
          };
      });

      // 2. Filter Data
      return mapped.filter(s => {
         const searchMatch = 
            s.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.plate.toLowerCase().includes(searchTerm.toLowerCase());
         
         let dateMatch = true;
         if (startDate || endDate) {
             const sDate = new Date(s.date);
             const start = startDate ? new Date(startDate) : null;
             const end = endDate ? new Date(endDate) : null;
             
             if (start && sDate < start) dateMatch = false;
             if (end && sDate > end) dateMatch = false;
         }

         return searchMatch && dateMatch;
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [internalSales, purchases, searchTerm, startDate, endDate]);

  // Pagination Logic
  const totalPages = Math.ceil(richSalesData.length / itemsPerPage);
  const paginatedData = richSalesData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePrintClick = (item: any) => {
      const row: LedgerRow = {
          date: item.date,
          plate: item.plate,
          driver: item.driver,
          customer: item.customerName,
          customerId: item.customerId,
          soldHeads: item.soldHeads,
          soldKg: item.soldKg,
          mortalityHeads: item.mortalityHeads,
          mortalityKg: item.mortalityKg,
          mortalityValue: item.mortalityKg * item.sellPrice,
          unloadingCost: item.unloadingCost,
          driverBonus: item.driverBonus,
          operationalCost: item.operationalCost,
          truckCost: item.truckCost,
          totalSales: item.totalInvoice,
          totalPaid: 0,
          remainingBalance: item.totalInvoice,
          saleId: item.id,
          purchaseId: item.purchaseId
      };
      onPrintInvoice(row);
  };

  const initiateDelete = (id: string) => {
      setDeleteId(id);
  }

  const clearFilters = () => {
      setSearchTerm('');
      setStartDate('');
      setEndDate('');
  }

  return (
    <div className="space-y-4">
        {/* Header & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari Customer / Plat..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 border rounded-lg transition-colors ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-300 text-slate-600'}`}
                    title="Advanced Filter"
                >
                    <Filter className="w-4 h-4" />
                </button>
            </div>
            
            <button onClick={onNewSale} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm whitespace-nowrap">
                <Plus className="w-4 h-4" /> Input Penjualan
            </button>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
           <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-in slide-in-from-top-2">
               <div className="flex justify-between items-center mb-3">
                   <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                       <Calendar className="w-3 h-3" /> Filter Tanggal
                   </h3>
                   {(startDate || endDate) && (
                       <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-bold">
                           <X className="w-3 h-3" /> Reset Filter
                       </button>
                   )}
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div>
                       <label className="block text-xs text-slate-500 mb-1 font-semibold">Dari Tanggal</label>
                       <input 
                        type="date" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)} 
                        className="w-full text-sm border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                       />
                   </div>
                   <div>
                       <label className="block text-xs text-slate-500 mb-1 font-semibold">Sampai Tanggal</label>
                       <input 
                        type="date" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)} 
                        className="w-full text-sm border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                       />
                   </div>
                   <div className="flex items-end">
                       <div className="text-xs text-slate-500 bg-white p-2 rounded border w-full text-center h-[38px] flex items-center justify-center">
                           Menampilkan <b>{richSalesData.length}</b> data
                       </div>
                   </div>
               </div>
           </div>
       )}

        <div className="bg-white shadow-sm rounded-lg overflow-hidden flex flex-col h-[calc(100vh-200px)]">
            {/* Unified Table View for Mobile & Desktop */}
            <div className="overflow-auto flex-1 rounded border border-slate-200 relative custom-scrollbar">
                <table className="w-full text-xs text-left whitespace-nowrap">
                    <thead className="bg-blue-600 text-white font-bold uppercase text-[10px] sticky top-0 z-10 shadow-md">
                        <tr>
                            <th className="p-3 border-r border-blue-500 w-24">Tanggal</th>
                            <th className="p-3 border-r border-blue-500">Customer</th>
                            <th className="p-3 border-r border-blue-500">Sumber / Transport</th>
                            <th className="p-3 text-right border-r border-blue-500">Net Vol</th>
                            <th className="p-3 text-center border-r border-blue-500">Mati</th>
                            <th className="p-3 text-right border-r border-blue-500">Ops</th>
                            <th className="p-3 text-right border-r border-blue-500 bg-blue-800">Total Invoice</th>
                            <th className="p-3 text-center w-20">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="p-10 text-center text-slate-400">
                                    <div className="flex justify-center items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading...
                                    </div>
                                </td>
                            </tr>
                        ) : paginatedData.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                                    Tidak ada data penjualan.
                                </td>
                            </tr>
                        ) : (
                            paginatedData.map(item => (
                                <tr key={item.id} className="hover:bg-blue-50 transition-colors group">
                                    <td className="p-2 font-medium text-slate-700 border-r border-slate-100 align-top">{formatDate(item.date)}</td>
                                    <td className="p-2 font-bold text-blue-800 border-r border-slate-100 align-top truncate max-w-[180px]" title={item.customerName}>{item.customerName}</td>
                                    
                                    <td className="p-2 border-r border-slate-100 align-top">
                                        <div className="text-xs font-semibold text-slate-700">{item.plate}</div>
                                        <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                            {item.coop} | {item.driver}
                                        </div>
                                    </td>

                                    <td className="p-2 text-right border-r border-slate-100 align-top">
                                        <div className="font-mono font-bold text-slate-800">{(item.soldKg - item.mortalityKg).toLocaleString()} Kg</div>
                                        <div className="text-[10px] text-slate-500">{item.soldHeads} Ekor</div>
                                    </td>
                                    
                                    <td className="p-2 text-center border-r border-slate-100 align-top">
                                        {item.mortalityKg > 0 ? (
                                            <div className="text-xs text-red-600 font-bold">
                                                {item.mortalityKg} <span className="text-[9px] font-normal text-red-400">Kg</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                    
                                    <td className="p-2 text-right border-r border-slate-100 align-top text-xs text-orange-700 font-mono">
                                        {item.totalExtras > 0 ? formatCurrency(item.totalExtras) : '-'}
                                    </td>
                                    
                                    <td className="p-2 text-right font-bold text-slate-900 bg-slate-50 border-l border-slate-200 font-mono align-top text-xs">
                                        {formatCurrency(item.totalInvoice)}
                                    </td>
                                    
                                    <td className="p-2 text-center align-top">
                                        <div className="flex justify-center gap-1">
                                            <button onClick={() => handlePrintClick(item)} className="p-1 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border rounded" title="Print"><Printer className="w-3 h-3" /></button>
                                            <button onClick={() => onEditSale(item.id)} className="p-1 hover:text-orange-600 bg-slate-50 hover:bg-orange-50 border rounded" title="Edit"><Edit className="w-3 h-3" /></button>
                                            <button onClick={() => onComplaint(item)} className="p-1 hover:text-red-600 bg-slate-50 hover:bg-red-50 border rounded" title="Komplain"><FileWarning className="w-3 h-3" /></button>
                                            {isSuperAdmin && (
                                                <button onClick={() => initiateDelete(item.id)} className="p-1 text-red-300 hover:text-red-600 bg-slate-50 hover:bg-red-50 border rounded"><Trash2 className="w-3 h-3" /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            
            {/* Pagination Controls - Compact */}
            <div className="bg-white border-t border-slate-200 px-3 py-1.5 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                    Hal {currentPage} dari {totalPages || 1} (Total {richSalesData.length})
                </div>
                <div className="flex gap-1">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-1 border rounded hover:bg-slate-50 disabled:opacity-50"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || totalPages === 0}
                        className="p-1 border rounded hover:bg-slate-50 disabled:opacity-50"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>

        <DeleteConfirmationModal
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={async () => { if(deleteId) await onDeleteSale(deleteId); }}
          title="Hapus Data Penjualan"
          message="Menghapus penjualan akan mempengaruhi stok, ledger, dan laporan keuangan."
          username={user.username}
       />
    </div>
  );
};

export default SalesList;
