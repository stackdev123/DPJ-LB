
import React, { useState, useEffect, useMemo } from 'react';
import { SaleRecord, PurchaseRecord, LedgerRow, User } from '../types';
import { Edit, Printer, Search, X, Calendar, Truck, FileWarning, Trash2, PlusCircle, Home, AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatDate, formatCurrency } from '../utils';
import { getSalesPaginated } from '../services/storageService';
import DeleteConfirmationModal from './DeleteConfirmationModal';

interface SalesListProps {
  purchases: PurchaseRecord[]; // Kept for Client-Side lookup (Reference Data)
  onEditSale: (saleId: string) => void;
  onPrintInvoice: (data: LedgerRow) => void;
  onComplaint: (sale: SaleRecord) => void;
  onDeleteSale: (saleId: string) => Promise<void>;
  user: User;
  onNewSale?: () => void;
}

const SalesList: React.FC<SalesListProps> = ({ purchases, onEditSale, onPrintInvoice, onComplaint, onDeleteSale, user, onNewSale }) => {
  // Pagination State
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [filterDate, setFilterDate] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Fetch Data
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterDate, filterCustomer]); // Debounce logic ideally needed for text search, but keep simple for now

  const fetchData = async () => {
    setLoading(true);
    const { data, count } = await getSalesPaginated(page, pageSize, {
        date: filterDate || undefined,
        customerName: filterCustomer || undefined
    });
    setSales(data);
    setTotalCount(count);
    setLoading(false);
  };

  // Combine Sale data with parent Purchase data for display
  const richSalesData = useMemo(() => {
    return sales.map(sale => {
      const parent = purchases.find(p => p.id === sale.purchaseId);
      const netKg = Math.max(0, sale.soldKg - sale.mortalityKg);
      const total = netKg * sale.sellPrice;
      
      const totalExtras = (sale.unloadingCost || 0) + (sale.driverBonus || 0) + (sale.operationalCost || 0) + (sale.truckCost || 0);
      const mortalityPct = sale.soldKg > 0 ? (sale.mortalityKg / sale.soldKg) * 100 : 0;

      return {
        ...sale,
        totalInvoice: total,
        totalExtras,
        mortalityPct,
        plate: parent?.plate || 'Unknown',
        driver: parent?.driver || 'Unknown',
        coop: parent?.coop || 'Tanpa Kandang',
        purchaseDate: parent?.date || null
      };
    });
  }, [sales, purchases]);

  const handlePrintClick = (item: typeof richSalesData[0]) => {
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

  const initiateDelete = (id: string) => {
      setItemToDelete(id);
      setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
      if (itemToDelete) {
          await onDeleteSale(itemToDelete);
          setItemToDelete(null);
          fetchData(); // Refresh list after delete
      }
  };

  const clearFilters = () => {
    setFilterDate('');
    setFilterCustomer('');
    setPage(1);
  };

  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="bg-white p-4 md:p-6 rounded-xl shadow-md border border-slate-200">
      {/* Buttons */}
      <div className="flex justify-end items-center mb-6 gap-2">
        {onNewSale && (
            <button 
                onClick={onNewSale}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md transition-all text-sm"
            >
                <PlusCircle className="w-4 h-4" /> Input Penjualan Baru
            </button>
        )}
      </div>

      {/* Filter Section */}
      <div className="mb-6 bg-slate-50 p-4 rounded-lg border border-slate-200">
         <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2"><Search className="w-4 h-4" /> Filter Pencarian</h3>
              {(filterDate || filterCustomer) && (
                <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                    <X className="w-3 h-3" /> Clear Filters
                </button>
              )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tanggal Transaksi</label>
                  <div className="relative">
                    <Calendar className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                    <input 
                        type="date" 
                        value={filterDate}
                        onChange={e => { setFilterDate(e.target.value); setPage(1); }}
                        className="w-full pl-8 text-sm border-slate-300 rounded-md p-2"
                    />
                  </div>
              </div>
              <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Cari Nama Customer</label>
                   <div className="relative">
                    <Search className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Ketik nama customer..."
                        value={filterCustomer}
                        onChange={e => { setFilterCustomer(e.target.value); setPage(1); }}
                        className="w-full pl-8 text-sm border-slate-300 rounded-md p-2"
                    />
                  </div>
              </div>
          </div>
      </div>

      {/* Desktop Table View (Scrollable & Sticky Header) */}
      <div className="hidden md:block overflow-auto max-h-[70vh] rounded-lg border border-slate-200 relative custom-scrollbar">
        <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs sticky top-0 z-10 shadow-sm">
                <tr>
                    <th className="p-3 bg-slate-100 border-b border-slate-200">Tanggal Jual</th>
                    <th className="p-3 bg-slate-100 border-b border-slate-200">Customer</th>
                    <th className="p-3 bg-slate-100 border-b border-slate-200">Asal (Kandang & DO)</th>
                    <th className="p-3 bg-slate-100 border-b border-slate-200">Transport</th>
                    <th className="p-3 text-right bg-slate-100 border-b border-slate-200">Vol (Net)</th>
                    <th className="p-3 text-center bg-slate-100 border-b border-slate-200">Mati / Loss</th>
                    <th className="p-3 text-right bg-slate-100 border-b border-slate-200">Biaya Ops</th>
                    <th className="p-3 text-right bg-slate-100 border-b border-slate-200">Total Invoice</th>
                    <th className="p-3 text-center bg-slate-100 border-b border-slate-200">Aksi</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {loading ? (
                     <tr>
                        <td colSpan={9} className="p-10 text-center text-slate-400">
                            <div className="flex justify-center items-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" /> Memuat Data Penjualan...
                            </div>
                        </td>
                    </tr>
                ) : richSalesData.length === 0 ? (
                    <tr>
                        <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                            Tidak ada data penjualan yang cocok.
                        </td>
                    </tr>
                ) : (
                    richSalesData.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-medium text-slate-700 whitespace-nowrap align-top">{formatDate(item.date)}</td>
                            <td className="p-3 font-bold text-blue-800 align-top">{item.customerName}</td>
                            
                            <td className="p-3 align-top">
                                <div className="font-bold text-slate-700 text-xs">{item.coop}</div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    Beli: {item.purchaseDate ? formatDate(item.purchaseDate) : '-'}
                                </div>
                            </td>

                            <td className="p-3 text-slate-600 align-top">
                                <div className="flex items-center gap-1">
                                    <Truck className="w-3 h-3 text-slate-400" />
                                    {item.plate}
                                </div>
                                <div className="text-xs text-slate-400 pl-4">{item.driver}</div>
                            </td>
                            <td className="p-3 text-right font-mono align-top">
                                <div className="font-bold">{(item.soldKg - item.mortalityKg).toLocaleString()} Kg</div>
                                <div className="text-xs text-slate-500">{item.soldHeads} Ekor</div>
                            </td>
                             <td className="p-3 text-center align-top">
                                {item.mortalityKg > 0 ? (
                                    <div className="inline-flex flex-col items-center bg-red-50 border border-red-100 px-2 py-1 rounded">
                                        <div className="flex items-center gap-1 text-red-600 font-bold text-xs">
                                            <AlertTriangle className="w-3 h-3" /> {item.mortalityKg} Kg
                                        </div>
                                        <div className="text-[10px] text-red-400">
                                            {item.mortalityHeads} Ekor ({item.mortalityPct.toFixed(1)}%)
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-slate-300">-</span>
                                )}
                            </td>
                            <td className="p-3 text-right align-top">
                                {item.totalExtras > 0 ? (
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="font-bold text-orange-600 text-xs">{formatCurrency(item.totalExtras)}</div>
                                        <div className="flex gap-1 flex-wrap justify-end">
                                            {item.unloadingCost > 0 && <span className="text-[9px] bg-orange-100 text-orange-700 px-1 rounded">Bongkar</span>}
                                            {item.driverBonus > 0 && <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded">Sopir</span>}
                                            {item.truckCost > 0 && <span className="text-[9px] bg-slate-100 text-slate-700 px-1 rounded">Truk</span>}
                                            {item.operationalCost > 0 && <span className="text-[9px] bg-purple-100 text-purple-700 px-1 rounded">Lainnya</span>}
                                        </div>
                                    </div>
                                ) : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-800 align-top">
                                {formatCurrency(item.totalInvoice)}
                            </td>
                            <td className="p-3 text-center flex justify-center gap-2 align-top">
                                <button 
                                    onClick={() => handlePrintClick(item)}
                                    className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded border border-slate-200"
                                    title="Cetak Invoice"
                                >
                                    <Printer className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => onEditSale(item.id)}
                                    className="p-1.5 text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded border border-slate-200"
                                    title="Edit Transaksi"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => onComplaint(item)}
                                    className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded border border-slate-200"
                                    title="Surat Komplain Kematian"
                                >
                                    <FileWarning className="w-4 h-4" />
                                </button>
                                {isSuperAdmin && (
                                    <button 
                                        onClick={() => initiateDelete(item.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded border border-slate-200 transition-colors"
                                        title="Hapus Transaksi (Super Admin)"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
          {loading ? (
             <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded border border-dashed border-slate-300">
                <div className="flex justify-center items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" /> Loading...
                </div>
            </div>
          ) : richSalesData.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded border border-dashed border-slate-300">
                    Tidak ada data penjualan.
                </div>
          ) : (
              richSalesData.map(item => (
                  <div key={item.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 relative">
                      {/* ... existing mobile card render logic ... */}
                       <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-2">
                          <div>
                              <div className="text-xs text-slate-500 font-bold uppercase">{formatDate(item.date)}</div>
                              <div className="text-lg font-bold text-blue-800 leading-tight">{item.customerName}</div>
                          </div>
                          <div className="flex gap-2">
                                <button onClick={() => handlePrintClick(item)} className="p-2 text-blue-600 bg-blue-50 rounded-full"><Printer className="w-4 h-4" /></button>
                                <button onClick={() => onEditSale(item.id)} className="p-2 text-orange-600 bg-orange-50 rounded-full"><Edit className="w-4 h-4" /></button>
                          </div>
                      </div>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                          <div className="col-span-2 flex items-center justify-between text-slate-600 text-xs bg-orange-50 border border-orange-100 p-2 rounded">
                                <div className="flex items-center gap-2"><Home className="w-3 h-3 text-orange-600" /><span className="font-bold">{item.coop}</span></div>
                                <div className="text-[10px]">DO: {item.purchaseDate ? formatDate(item.purchaseDate) : '-'}</div>
                          </div>
                          <div className="col-span-2 flex items-center gap-2 text-slate-600 text-xs bg-slate-50 p-2 rounded">
                              <Truck className="w-3 h-3" /> {item.plate}
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-100">
                              <div className="text-xs text-slate-400">Net Kg</div>
                              <div className="font-mono font-semibold">{(item.soldKg - item.mortalityKg).toLocaleString()}</div>
                          </div>
                           <div className={`p-2 rounded border border-slate-100 ${item.mortalityKg > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50'}`}>
                              <div className="text-xs text-slate-400">Mati</div>
                              {item.mortalityKg > 0 ? (<div className="font-mono text-red-600 font-bold">{item.mortalityKg} Kg</div>) : <span className="text-slate-300">-</span>}
                          </div>
                          <div className="col-span-2 pt-2 border-t border-slate-100 flex justify-between items-center mt-1">
                              <span className="text-xs font-bold text-slate-500 uppercase">Invoice</span>
                              <span className="text-lg font-bold text-slate-900">{formatCurrency(item.totalInvoice)}</span>
                          </div>
                      </div>
                  </div>
              ))
          )}
      </div>

       {/* Pagination Controls */}
       <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100 print:hidden">
            <div className="text-xs text-slate-500">
                Menampilkan {sales.length} dari total {totalCount} data.
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
                    Hal {page} / {totalPages || 1}
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

      <DeleteConfirmationModal 
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Hapus Penjualan"
        message="Anda yakin ingin menghapus data penjualan ini? Tindakan ini tidak dapat dibatalkan."
        username={user.username}
      />
    </div>
  );
};

export default SalesList;
