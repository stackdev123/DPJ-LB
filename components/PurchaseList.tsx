
import React, { useState, useEffect, useMemo } from 'react';
import { PurchaseRecord, User } from '../types';
import { Edit, PlusCircle, ImageDown, X, Trash2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatDate, formatCurrency, downloadAsImage } from '../utils';
import { getPurchasesPaginated, getSuppliers, getCoops, getPlatesList } from '../services/storageService';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface PurchaseListProps {
  onEditPurchase: (purchaseId: string) => void;
  onNewPurchase: () => void;
  onDeletePurchase: (id: string) => Promise<void>;
  user: User;
}

const PurchaseList: React.FC<PurchaseListProps> = ({ onEditPurchase, onNewPurchase, onDeletePurchase, user }) => {
  // Pagination State
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterCoop, setFilterCoop] = useState('');
  const [filterPlate, setFilterPlate] = useState('');
  
  // Options for Dropdowns
  const [optSuppliers, setOptSuppliers] = useState<string[]>([]);
  const [optCoops, setOptCoops] = useState<string[]>([]);
  const [optPlates, setOptPlates] = useState<string[]>([]);

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Initial Load & Master Data
  useEffect(() => {
    const loadOptions = async () => {
        const s = await getSuppliers();
        const c = await getCoops();
        const p = await getPlatesList();
        setOptSuppliers(s.map(i => i.name));
        setOptCoops(c.map(i => i.name));
        setOptPlates(p.map(i => i.value));
    }
    loadOptions();
  }, []);

  // Fetch Data when Page or Filters change
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterDate, filterSupplier, filterCoop, filterPlate]);

  const fetchData = async () => {
      setLoading(true);
      const { data, count } = await getPurchasesPaginated(page, pageSize, {
          date: filterDate || undefined,
          supplier: filterSupplier || undefined,
          coop: filterCoop || undefined,
          plate: filterPlate || undefined
      });
      setPurchases(data);
      setTotalCount(count);
      setLoading(false);
  };

  const handleDownloadImage = () => {
    downloadAsImage('purchase-list-table', 'Riwayat_Pembelian');
  };

  const clearFilters = () => {
      setFilterDate('');
      setFilterSupplier('');
      setFilterCoop('');
      setFilterPlate('');
      setPage(1); // Reset to page 1
  };

  const initiateDelete = (id: string) => {
      setItemToDelete(id);
      setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
      if (itemToDelete) {
          await onDeletePurchase(itemToDelete);
          setItemToDelete(null);
          fetchData(); // Refresh list after delete
      }
  };

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
      {/* Action Buttons */}
      <div className="flex justify-end items-center mb-6 gap-2 print:hidden">
           <button 
             onClick={onNewPurchase}
             className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 shadow text-sm font-bold"
           >
             <PlusCircle className="w-4 h-4" /> Input Pembelian
           </button>
           <button 
             onClick={handleDownloadImage}
             className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow text-sm font-bold"
           >
             <ImageDown className="w-4 h-4" /> Download JPG
           </button>
      </div>

      {/* Filter Section */}
      <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200 print:hidden">
          <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-slate-700">Filter Data:</h3>
              <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear Filters
              </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tanggal</label>
                  <input 
                    type="date" 
                    value={filterDate}
                    onChange={e => { setFilterDate(e.target.value); setPage(1); }}
                    className="w-full text-sm border-slate-300 rounded-md p-2"
                  />
              </div>
              <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Supplier</label>
                  <select 
                    value={filterSupplier}
                    onChange={e => { setFilterSupplier(e.target.value); setPage(1); }}
                    className="w-full text-sm border-slate-300 rounded-md p-2"
                  >
                      <option value="">-- Semua Supplier --</option>
                      {optSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
              </div>
              <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Kandang (Coop)</label>
                   <select 
                    value={filterCoop}
                    onChange={e => { setFilterCoop(e.target.value); setPage(1); }}
                    className="w-full text-sm border-slate-300 rounded-md p-2"
                  >
                      <option value="">-- Semua Kandang --</option>
                      {optCoops.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
              </div>
              <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Plat Nomor</label>
                   <select 
                    value={filterPlate}
                    onChange={e => { setFilterPlate(e.target.value); setPage(1); }}
                    className="w-full text-sm border-slate-300 rounded-md p-2"
                  >
                      <option value="">-- Semua Plat --</option>
                      {optPlates.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
              </div>
          </div>
      </div>

      <div id="purchase-list-table" className="bg-white p-0">
        {/* Table Container (Frozen Header) */}
        <div className="overflow-auto max-h-[70vh] rounded-lg border border-slate-200 relative custom-scrollbar">
            <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                <tr>
                <th className="p-3 bg-slate-100 border-b border-slate-200">Tanggal</th>
                <th className="p-3 bg-slate-100 border-b border-slate-200">Supplier & Kandang</th>
                <th className="p-3 bg-slate-100 border-b border-slate-200">Transport (Plat/Supir)</th>
                <th className="p-3 text-right bg-slate-100 border-b border-slate-200">Ekor</th>
                <th className="p-3 text-right bg-slate-100 border-b border-slate-200">Total Kg</th>
                <th className="p-3 text-right bg-slate-100 border-b border-slate-200">Rata2</th>
                <th className="p-3 text-right bg-slate-100 border-b border-slate-200">Harga Beli</th>
                <th className="p-3 text-right bg-slate-100 border-b border-slate-200">Total Tagihan</th>
                <th className="p-3 text-center print:hidden bg-slate-100 border-b border-slate-200">Aksi</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {loading ? (
                    <tr>
                        <td colSpan={9} className="p-10 text-center text-slate-400">
                            <div className="flex justify-center items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" /> Memuat Data...
                            </div>
                        </td>
                    </tr>
                ) : purchases.length === 0 ? (
                    <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400 italic">Data pembelian tidak ditemukan.</td>
                    </tr>
                ) : (
                    purchases.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-medium text-slate-700">{formatDate(p.date)}</td>
                            <td className="p-3">
                                <div className="font-bold">{p.supplier || <span className="text-slate-400 italic text-xs">Tanpa Supplier</span>}</div>
                                <div className="text-xs text-slate-500">{p.coop || '-'}</div>
                            </td>
                            <td className="p-3">
                                <div className="font-semibold">{p.plate}</div>
                                <div className="text-xs text-slate-500">{p.driver || '-'}</div>
                            </td>
                            <td className="p-3 text-right font-mono">{p.heads.toLocaleString()}</td>
                            <td className="p-3 text-right font-mono">{p.kg.toLocaleString()}</td>
                            <td className="p-3 text-right font-mono text-slate-500">{(p.avgWeight || 0).toFixed(2)}</td>
                            <td className="p-3 text-right font-mono text-slate-600">
                                {p.buyPrice > 0 ? formatCurrency(p.buyPrice) : <span className="text-red-400 italic">Pending</span>}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-800">
                                {formatCurrency(p.totalBuyCost)}
                            </td>
                            <td className="p-3 text-center print:hidden">
                                <div className="flex justify-center gap-1">
                                    <button 
                                        onClick={() => onEditPurchase(p.id)}
                                        className="text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1 text-xs font-bold border border-blue-200 px-2 py-1 rounded bg-blue-50"
                                        title="Edit Data"
                                    >
                                        <Edit className="w-3 h-3" />
                                    </button>
                                    {isSuperAdmin && (
                                        <button 
                                            onClick={() => initiateDelete(p.id)}
                                            className="text-red-400 hover:text-red-600 flex items-center justify-center gap-1 text-xs font-bold border border-red-200 px-2 py-1 rounded bg-red-50 transition-colors"
                                            title="Hapus Pembelian (Super Admin)"
                                        >
                                            <Trash2 className="w-3 h-3" />
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

        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100 print:hidden">
            <div className="text-xs text-slate-500">
                Menampilkan {purchases.length} dari total {totalCount} data.
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    className="p-2 border rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-slate-700">
                    Halaman {page} dari {totalPages || 1}
                </span>
                <button 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading || totalPages === 0}
                    className="p-2 border rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>

      </div>

      <DeleteConfirmationModal 
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Hapus Pembelian"
        message="Anda yakin ingin menghapus data pembelian ini? Data penjualan yang terkait mungkin akan menjadi error/yatim."
        username={user.username}
      />
    </div>
  );
};

export default PurchaseList;
