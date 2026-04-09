import React, { useState, useMemo, useEffect } from 'react';
import { PurchaseRecord, SaleRecord, LedgerRow, User } from '../types';
import { formatDate, formatCurrency } from '../utils';
import { 
  Loader2, Printer, Edit, FileWarning, Trash2, 
  Search, Plus, Filter, ChevronLeft, ChevronRight, 
  X, Calendar, AlertCircle 
} from 'lucide-react';
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

const SalesList: React.FC<SalesListProps> = ({ 
  purchases = [], 
  sales, 
  onEditSale, 
  onPrintInvoice, 
  onComplaint, 
  onDeleteSale, 
  user, 
  onNewSale 
}) => {
  const [internalSales, setInternalSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Load Data
  useEffect(() => {
    if (sales) {
        setInternalSales(sales);
    } else {
        const load = async () => {
            setLoading(true);
            try {
                const data = await Storage.getSales();
                setInternalSales(data || []);
            } catch (err) {
                console.error("Error loading sales:", err);
                setError("Gagal memuat data penjualan");
            } finally {
                setLoading(false);
            }
        };
        load();
    }
  }, [sales]);

  // Reset ke halaman 1 jika filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate]);

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Logika Pengolahan Data (Memoized)
  const richSalesData = useMemo(() => {
      if (!internalSales) return [];

      // 1. Mapping & Enriching Data
      const mapped = internalSales.map(s => {
          const purchase = purchases.find(p => p.id === s.purchaseId);
          
          const unloading = Number(s.unloadingCost || 0);
          const bonus = Number(s.driverBonus || 0);
          const operational = Number(s.operationalCost || 0);
          const truck = Number(s.truckCost || 0);
          
          const totalExtras = unloading + bonus + operational + truck;
          const netKg = Math.max(0, (s.soldKg || 0) - (s.mortalityKg || 0));
          const totalInvoice = netKg * (s.sellPrice || 0);

          return {
              ...s,
              plate: purchase?.plate || 'Tanpa Plat',
              driver: purchase?.driver || 'Tanpa Driver',
              coop: purchase?.coop || 'Tanpa Kandang',
              totalExtras,
              totalInvoice,
              // Fallback untuk mapping ke LedgerRow
              customer: s.customerName || 'No Name',
              totalSales: totalInvoice,
          };
      });

      // 2. Filtering
      return mapped.filter(s => {
         const nameMatch = (s.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());
         const plateMatch = (s.plate || '').toLowerCase().includes(searchTerm.toLowerCase());
         const searchMatch = nameMatch || plateMatch;
         
         let dateMatch = true;
         if (startDate || endDate) {
             const sDate = new Date(s.date);
             sDate.setHours(0, 0, 0, 0);

             if (startDate) {
                 const start = new Date(startDate);
                 start.setHours(0, 0, 0, 0);
                 if (sDate < start) dateMatch = false;
             }
             if (endDate) {
                 const end = new Date(endDate);
                 end.setHours(23, 59, 59, 999);
                 if (sDate > end) dateMatch = false;
             }
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
          soldHeads: item.soldHeads || 0,
          soldKg: item.soldKg || 0,
          mortalityHeads: item.mortalityHeads || 0,
          mortalityKg: item.mortalityKg || 0,
          mortalityValue: (item.mortalityKg || 0) * (item.sellPrice || 0),
          unloadingCost: item.unloadingCost || 0,
          driverBonus: item.driverBonus || 0,
          operationalCost: item.operationalCost || 0,
          truckCost: item.truckCost || 0,
          totalSales: item.totalInvoice,
          totalPaid: 0,
          remainingBalance: item.totalInvoice,
          saleId: item.id,
          purchaseId: item.purchaseId
      };
      onPrintInvoice(row);
  };

  const clearFilters = () => {
      setSearchTerm('');
      setStartDate('');
      setEndDate('');
  };

  return (
    <div className="space-y-4">
        {/* Header & Search Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-80">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari Nama Customer atau Plat Mobil..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>
                <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-2 border rounded-lg transition-colors ${showFilters ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 text-slate-600'}`}
                    title="Filter Tanggal"
                >
                    <Filter className="w-4 h-4" />
                </button>
            </div>
            
            <button 
                onClick={onNewSale} 
                className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95"
            >
                <Plus className="w-4 h-4" /> Input Penjualan
            </button>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
           <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner animate-in fade-in slide-in-from-top-2 duration-200">
               <div className="flex justify-between items-center mb-3">
                   <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                       <Calendar className="w-3 h-3" /> Rentang Waktu
                   </h3>
                   {(startDate || endDate || searchTerm) && (
                       <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-bold">
                           <X className="w-3 h-3" /> Reset
                       </button>
                   )}
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div>
                       <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Dari</label>
                       <input 
                        type="date" 
                        value={startDate} 
                        onChange={e => setStartDate(e.target.value)} 
                        className="w-full text-sm border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                       />
                   </div>
                   <div>
                       <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 ml-1">Sampai</label>
                       <input 
                        type="date" 
                        value={endDate} 
                        onChange={e => setEndDate(e.target.value)} 
                        className="w-full text-sm border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                       />
                   </div>
                   <div className="flex items-end">
                       <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 p-2 rounded-lg w-full text-center h-[38px] flex items-center justify-center font-medium">
                           Menampilkan {richSalesData.length} transaksi
                       </div>
                   </div>
               </div>
           </div>
       )}

        {/* Table Container */}
        <div className="bg-white shadow-xl rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[calc(115vh-280px)]">
            <div className="overflow-auto flex-1 relative custom-scrollbar">
                <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-800 text-slate-200 font-bold uppercase text-[10px] sticky top-0 z-20">
                        <tr>
                            <th className="p-4 border-b border-slate-700 w-24">Tanggal</th>
                            <th className="p-4 border-b border-slate-700">Customer</th>
                            <th className="p-4 border-b border-slate-700">Sumber / Transport</th>
                            <th className="p-4 text-right border-b border-slate-700">Volume Net</th>
                            <th className="p-4 text-center border-b border-slate-700">Mati (Kg)</th>
                            <th className="p-4 text-right border-b border-slate-700">Total Ops</th>
                            <th className="p-4 text-right border-b border-slate-700 bg-slate-900 text-blue-400">Total Tagihan</th>
                            <th className="p-4 text-center w-28 border-b border-slate-700">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="p-20 text-center">
                                    <div className="flex flex-col justify-center items-center gap-3">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                        <span className="text-slate-500 font-medium italic">Memuat data penjualan...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={8} className="p-20 text-center">
                                    <div className="flex flex-col justify-center items-center gap-2 text-red-500">
                                        <AlertCircle className="w-8 h-8" />
                                        <span className="font-bold">{error}</span>
                                    </div>
                                </td>
                            </tr>
                        ) : paginatedData.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="p-20 text-center">
                                    <div className="flex flex-col justify-center items-center gap-2 text-slate-400">
                                        <Search className="w-8 h-8 opacity-20" />
                                        <span className="italic">Data tidak ditemukan</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedData.map((item) => (
                                <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                                    <td className="p-3 font-medium text-slate-600 align-top">{formatDate(item.date)}</td>
                                    <td className="p-3 align-top">
                                        <div className="font-bold text-slate-900 text-sm">{item.customerName}</div>
                                        <div className="text-[10px] text-slate-400">ID: {item.id.substring(0,8)}...</div>
                                    </td>
                                    
                                    <td className="p-3 align-top">
                                        <div className="font-bold text-blue-700">{item.plate}</div>
                                        <div className="text-[10px] text-slate-500 leading-tight">
                                            {item.coop} <br/>
                                            {item.driver}
                                        </div>
                                    </td>

                                    <td className="p-3 text-right align-top">
                                        <div className="font-mono font-bold text-slate-800 text-sm">
                                            {((item.soldKg || 0) - (item.mortalityKg || 0)).toLocaleString('id-ID')} <span className="text-[10px] font-normal">Kg</span>
                                        </div>
                                        <div className="text-[10px] text-slate-500">{item.soldHeads} Ekor</div>
                                    </td>
                                    
                                    <td className="p-3 text-center align-top">
                                        {item.mortalityKg > 0 ? (
                                            <span className="inline-block px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-bold border border-red-100">
                                                {item.mortalityKg}
                                            </span>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </td>
                                    
                                    <td className="p-3 text-right align-top text-xs text-orange-700 font-mono">
                                        {item.totalExtras > 0 ? formatCurrency(item.totalExtras) : '-'}
                                    </td>
                                    
                                    <td className="p-3 text-right font-bold text-slate-900 bg-slate-50/50 font-mono align-top text-sm">
                                        {formatCurrency(item.totalInvoice)}
                                    </td>
                                    
                                    <td className="p-3 text-center align-top">
                                        <div className="flex justify-center gap-1.5">
                                            <button 
                                                onClick={() => handlePrintClick(item)} 
                                                className="p-1.5 hover:text-blue-600 bg-white hover:bg-blue-50 border border-slate-200 rounded-md transition-all shadow-sm" 
                                                title="Cetak Nota"
                                            >
                                                <Printer className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={() => onEditSale(item.id)} 
                                                className="p-1.5 hover:text-amber-600 bg-white hover:bg-amber-50 border border-slate-200 rounded-md transition-all shadow-sm" 
                                                title="Edit Data"
                                            >
                                                <Edit className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={() => onComplaint(item)} 
                                                className="p-1.5 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 rounded-md transition-all shadow-sm" 
                                                title="Input Komplain"
                                            >
                                                <FileWarning className="w-3.5 h-3.5" />
                                            </button>
                                            {isSuperAdmin && (
                                                <button 
                                                    onClick={() => setDeleteId(item.id)} 
                                                    className="p-1.5 text-slate-300 hover:text-red-600 bg-white hover:bg-red-50 border border-slate-200 rounded-md transition-all shadow-sm"
                                                    title="Hapus"
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
            
            {/* Pagination Controls */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex items-center justify-between">
                <div className="text-[11px] text-slate-500 font-medium">
                    Halaman <span className="text-slate-900">{currentPage}</span> dari <span className="text-slate-900">{totalPages || 1}</span> 
                    <span className="mx-2 text-slate-300">|</span> 
                    Total <span className="text-slate-900">{richSalesData.length}</span> Transaksi
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1 || loading}
                        className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase pr-1">Prev</span>
                    </button>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages || totalPages === 0 || loading}
                        className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <span className="text-[10px] font-bold uppercase pl-1">Next</span>
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>

        {/* Modal Konfirmasi Hapus */}
        <DeleteConfirmationModal
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={async () => { 
              if(deleteId) {
                  await onDeleteSale(deleteId);
                  setDeleteId(null);
              } 
          }}
          title="Hapus Data Penjualan"
          message="PERINGATAN: Menghapus data penjualan akan mengembalikan stok ke pembelian asal dan menghapus riwayat piutang di buku besar (ledger)."
          username={user?.username || 'Admin'}
       />
    </div>
  );
};

export default SalesList;