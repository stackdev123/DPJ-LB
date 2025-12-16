
import React, { useState, useMemo, useEffect } from 'react';
import { PurchaseRecord, User } from '../types';
import { Edit, Trash2, Search, Plus, Truck, Warehouse, Filter, ChevronLeft, ChevronRight, X, Calendar } from 'lucide-react';
import { formatDate, formatCurrency } from '../utils';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface PurchaseListProps {
  purchases: PurchaseRecord[];
  onEditPurchase: (id: string) => void;
  onNewPurchase: () => void;
  onDeletePurchase: (id: string) => Promise<void>;
  user: User;
}

const PurchaseList: React.FC<PurchaseListProps> = ({ purchases, onEditPurchase, onNewPurchase, onDeletePurchase, user }) => {
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      // Search Logic
      const searchMatch = 
        (p.supplier || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.plate || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.coop || '').toLowerCase().includes(searchTerm.toLowerCase());

      // Date Logic
      let dateMatch = true;
      if (startDate || endDate) {
        const pDate = new Date(p.date);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        if (start && pDate < start) dateMatch = false;
        if (end && pDate > end) dateMatch = false;
      }

      return searchMatch && dateMatch;
    });
  }, [purchases, searchTerm, startDate, endDate]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);
  const paginatedData = filteredPurchases.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const initiateDelete = (id: string) => {
    setDeleteId(id);
  };

  const clearFilters = () => {
      setSearchTerm('');
      setStartDate('');
      setEndDate('');
  };

  return (
    <div className="space-y-4">
       {/* Header & Actions */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Cari Supplier / Plat / Kandang..."
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
          
          <button onClick={onNewPurchase} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm whitespace-nowrap">
             <Plus className="w-4 h-4" /> Input Pembelian
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
                           Menampilkan <b>{filteredPurchases.length}</b> data
                       </div>
                   </div>
               </div>
           </div>
       )}

       <div id="purchase-list-table" className="bg-white p-0 shadow-sm rounded-lg overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        <div className="overflow-auto flex-1 rounded border border-slate-200 relative custom-scrollbar">
            <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-blue-600 text-white font-bold uppercase text-[10px] sticky top-0 z-10 shadow-md">
                <tr>
                <th className="p-3 border-r border-blue-500 w-24">Tanggal</th>
                <th className="p-3 border-r border-blue-500">Asal (Supplier/Kandang)</th>
                <th className="p-3 border-r border-blue-500">Transport</th>
                <th className="p-3 text-right border-r border-blue-500">Volume</th>
                <th className="p-3 text-right border-r border-blue-500">Rata2</th>
                <th className="p-3 text-right border-r border-blue-500">Harga Beli</th>
                <th className="p-3 text-right border-r border-blue-500 bg-blue-800">Total Tagihan</th>
                <th className="p-3 text-center print:hidden w-16">Aksi</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {paginatedData.length === 0 ? (
                    <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 italic">Data tidak ditemukan.</td>
                    </tr>
                ) : (
                    paginatedData.map(p => (
                        <tr key={p.id} className="hover:bg-blue-50 transition-colors">
                            <td className="p-2 font-medium text-slate-700 border-r border-slate-100">{formatDate(p.date)}</td>

                            <td className="p-2 border-r border-slate-100">
                                <div className="font-bold text-slate-800 text-xs truncate max-w-[150px]">{p.supplier || '-'}</div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <Warehouse className="w-3 h-3" /> {p.coop || '-'}
                                </div>
                            </td>

                            <td className="p-2 border-r border-slate-100">
                                <div className="font-bold text-slate-700 text-xs">{p.plate}</div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <Truck className="w-3 h-3" /> {p.driver || '-'}
                                </div>
                            </td>

                            <td className="p-2 text-right border-r border-slate-100">
                                <div className="font-mono font-bold text-slate-800">{p.kg.toLocaleString()} Kg</div>
                                <div className="text-[10px] text-slate-500">{p.heads.toLocaleString()} Ekor</div>
                            </td>

                            <td className="p-2 text-right border-r border-slate-100 font-mono text-slate-600 text-xs">
                                {(p.avgWeight || 0).toFixed(2)}
                            </td>

                            <td className="p-2 text-right border-r border-slate-100 font-mono text-slate-600 text-xs">
                                {p.buyPrice > 0 ? formatCurrency(p.buyPrice) : <span className="text-red-400 italic">Pending</span>}
                            </td>

                            <td className="p-2 text-right font-bold text-slate-900 bg-slate-50 border-l border-slate-200 font-mono">
                                {formatCurrency(p.totalBuyCost)}
                            </td>

                            <td className="p-2 text-center print:hidden">
                                <div className="flex justify-center gap-1">
                                    <button
                                        onClick={() => onEditPurchase(p.id)}
                                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded"
                                        title="Edit Data"
                                    >
                                        <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    {isSuperAdmin && (
                                        <button
                                            onClick={() => initiateDelete(p.id)}
                                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded"
                                            title="Hapus Pembelian"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
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
                Hal {currentPage} dari {totalPages || 1} (Total {filteredPurchases.length})
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
          onConfirm={async () => { if(deleteId) await onDeletePurchase(deleteId); }}
          title="Hapus Data Pembelian"
          message="Menghapus pembelian akan menghapus data penjualan terkait. Pastikan data benar-benar ingin dihapus."
          username={user.username}
       />
    </div>
  );
};

export default PurchaseList;
