
import React, { useState, useMemo, useEffect } from 'react';
import { SaleRecord, PurchaseRecord, Customer, CustomerPayment, User } from '../types';
import { formatCurrency, formatDate, generateDiff } from '../utils';
import { History, CreditCard, Save, Edit, Search, ArrowLeft, ChevronRight, Wallet, PlusCircle, Trash2 } from 'lucide-react';
import * as Storage from '../services/storageService';
import { v4 as uuidv4 } from 'uuid';
import SearchableSelect from './SearchableSelect';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { logActivity } from '../services/logService';

interface PaymentMenuProps {
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  customerPayments: CustomerPayment[];
  onOpenPaymentModal: (saleId: string) => void;
  onBulkPayment: (customerName: string, amount: number, date: string, method: 'CASH' | 'TRANSFER') => void;
  user: User;
}

const PaymentMenu: React.FC<PaymentMenuProps> = ({ sales, purchases, customerPayments, onOpenPaymentModal, onBulkPayment, user }) => {
  const [activeTab, setActiveTab] = useState<'INPUT' | 'STATUS'>('INPUT');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<CustomerPayment[]>([]);
  
  // Status View State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerIdForStatus, setSelectedCustomerIdForStatus] = useState<string | null>(null);

  // History Search State (New)
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  // Mobile Toggle for Status View
  const [showStatusDetailMobile, setShowStatusDetailMobile] = useState(false);

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Input Form State
  const [inputData, setInputData] = useState({
      date: new Date().toISOString().split('T')[0], // Tanggal Transaksi (Ledger)
      actualPaymentDate: new Date().toISOString().split('T')[0], // Tanggal Realisasi Bayar (Notes)
      customerId: '',
      customerName: '',
      transferAmount: 0,
      cashAmount: 0,
      unloadingCost: 0, // Bongkaran
      driverBonus: 0, // Bon Sopir
      otherCost: 0, // Biaya Lain
      notes: ''
  });

  // Extract data loading to a function so we can call it without reloading page
  const loadData = async () => {
      setCustomers(await Storage.getCustomers());
      setPaymentHistory(await Storage.getCustomerPayments());
  };

  useEffect(() => {
    loadData();
  }, [customerPayments]); // Refresh when parent data updates

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setInputData(prev => ({
          ...prev,
          [name]: (name === 'date' || name === 'actualPaymentDate' || name === 'customerName' || name === 'notes') 
            ? value 
            : parseFloat(value) || 0
      }));
  };

  const resetForm = () => {
    setEditingId(null);
    setInputData({
        date: new Date().toISOString().split('T')[0],
        actualPaymentDate: new Date().toISOString().split('T')[0],
        customerId: '',
        customerName: '', 
        transferAmount: 0,
        cashAmount: 0,
        unloadingCost: 0,
        driverBonus: 0,
        otherCost: 0,
        notes: ''
    });
  };

  const handleEditPayment = (payment: CustomerPayment) => {
      setEditingId(payment.id);
      
      // Try to extract Actual Payment Date from notes if exists
      let cleanNotes = payment.notes;
      const dateMatch = payment.notes ? payment.notes.match(/\(Tgl Bayar: (.+?)\)/) : null;
      
      if (dateMatch && dateMatch[1]) {
          cleanNotes = payment.notes.replace(dateMatch[0], '').trim();
      }

      setInputData({
          date: payment.date,
          actualPaymentDate: payment.date, 
          customerId: payment.customerId,
          customerName: payment.customerName,
          transferAmount: payment.transferAmount,
          cashAmount: payment.cashAmount,
          unloadingCost: payment.unloadingCost,
          driverBonus: payment.driverBonus,
          otherCost: payment.otherCost,
          notes: cleanNotes
      });
  };

  const initiateDelete = (id: string) => {
      setItemToDelete(id);
      setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
      if (itemToDelete) {
          await Storage.deleteCustomerPayment(itemToDelete);
          
          // Log Activity
          await logActivity(user, 'DELETE', 'PAYMENT', `Deleted payment record`, itemToDelete);

          setItemToDelete(null);
          await loadData();
          // Trigger parent refresh to update dashboard numbers
          onBulkPayment('DELETED', 0, '', 'CASH');
      }
  };

  const handleInputSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const total = inputData.transferAmount + inputData.cashAmount + inputData.unloadingCost + inputData.driverBonus + inputData.otherCost;
      
      if (!inputData.customerName) {
          alert("Pilih customer terlebih dahulu");
          return;
      }
      if (total <= 0) {
          alert("Total pembayaran harus lebih dari 0");
          return;
      }

      // Logic to ensure ID exists. If user changed name to a new one, ID might be empty.
      const selectedC = customers.find(c => c.name === inputData.customerName);
      let finalCustomerId = selectedC?.id || inputData.customerId;

      // If no ID found (user typed new name), generate one and save to master customers to be safe
      if (!finalCustomerId) {
          finalCustomerId = uuidv4();
          await Storage.saveCustomer({
              id: finalCustomerId,
              name: inputData.customerName,
              address: '-'
          });
          await logActivity(user, 'CREATE', 'CUSTOMER', `Auto-created customer ${inputData.customerName}`, finalCustomerId);
      }

      // Format Note with Actual Payment Date
      const paymentDateStr = formatDate(inputData.actualPaymentDate);
      const dateNote = `(Tgl Bayar: ${paymentDateStr})`;
      const finalNotes = inputData.notes ? `${inputData.notes} ${dateNote}` : dateNote;

      const paymentObject: CustomerPayment = {
          id: editingId || uuidv4(),
          date: inputData.date, // Use Transaction Date for Ledger
          customerId: finalCustomerId,
          customerName: inputData.customerName,
          transferAmount: inputData.transferAmount,
          cashAmount: inputData.cashAmount,
          unloadingCost: inputData.unloadingCost,
          driverBonus: inputData.driverBonus,
          otherCost: inputData.otherCost,
          notes: finalNotes,
          totalPaid: total
      };

      try {
        if (editingId) {
            // Find Original for Diff Logging
            const original = customerPayments.find(p => p.id === editingId) || paymentHistory.find(p => p.id === editingId);
            
            // Generate Timestamp for Revision
            const revisionDate = new Date().toLocaleString('id-ID', { 
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
            });

            let diffString = "Revised Payment";
            if (original) {
                diffString = generateDiff(original, paymentObject, [
                    { key: 'totalPaid', label: 'Total', isCurrency: true },
                    { key: 'date', label: 'Tgl Ledger' },
                    { key: 'customerName', label: 'Cust' },
                    { key: 'transferAmount', label: 'TF', isCurrency: true },
                    { key: 'cashAmount', label: 'Cash', isCurrency: true },
                    { key: 'notes', label: 'Notes' }
                ]);
            }

            await Storage.updateCustomerPayment(paymentObject);
            
            // Log Activity with Timestamp
            await logActivity(
                user, 
                'UPDATE', 
                'PAYMENT', 
                `[Rev: ${revisionDate}] ${inputData.customerName} - Detail: ${diffString}`, 
                paymentObject.id
            );
            
            alert("Revisi pembayaran berhasil disimpan.");
        } else {
            await Storage.saveCustomerPayment(paymentObject);
            await logActivity(user, 'CREATE', 'PAYMENT', `Created payment ${formatCurrency(total)} for ${inputData.customerName}`, paymentObject.id);
            alert("Pembayaran berhasil disimpan.");
        }
        
        resetForm();
        await loadData(); // Refresh local list
        // Trigger parent refresh in App.tsx without full reload
        onBulkPayment(inputData.customerName, total, inputData.date, 'CASH'); 
      } catch (err) {
          console.error("Error saving payment:", err);
          alert("Gagal menyimpan pembayaran. Silakan coba lagi.");
      }
  };

  // --- Filtering Logic for History ---
  const filteredHistory = useMemo(() => {
    return paymentHistory.filter(p => {
        const term = historySearchTerm.toLowerCase();
        return (
            p.customerName.toLowerCase().includes(term) ||
            (p.notes && p.notes.toLowerCase().includes(term)) ||
            p.date.includes(term) ||
            p.totalPaid.toString().includes(term)
        );
    });
  }, [paymentHistory, historySearchTerm]);

  // --- Logic for Status View (Direct Calculation by ID) ---
  const customerSummary = useMemo(() => {
    const summary: Record<string, { 
      id: string;
      name: string; 
      totalDebt: number; 
      totalPaid: number;
      invoiceCount: number; 
      invoices: SaleRecord[];
    }> = {};

    const getKey = (id: string, name: string) => id ? id : name;

    sales.forEach(sale => {
      const key = getKey(sale.customerId, sale.customerName);
      const netKg = Math.max(0, sale.soldKg - sale.mortalityKg);
      const totalInvoice = netKg * sale.sellPrice;
      
      if (!summary[key]) {
        summary[key] = {
          id: sale.customerId,
          name: sale.customerName,
          totalDebt: 0,
          totalPaid: 0,
          invoiceCount: 0,
          invoices: []
        };
      }
      summary[key].invoices.push(sale);
      summary[key].invoiceCount += 1;
      summary[key].totalDebt += totalInvoice;
    });

    customerPayments.forEach(pay => {
         const key = getKey(pay.customerId, pay.customerName);
         
         if (!summary[key]) {
            summary[key] = {
                id: pay.customerId,
                name: pay.customerName,
                totalDebt: 0,
                totalPaid: 0,
                invoiceCount: 0,
                invoices: []
            };
         }
         summary[key].totalPaid += pay.totalPaid;
    });

    return Object.values(summary).sort((a, b) => (b.totalDebt - b.totalPaid) - (a.totalDebt - a.totalPaid));
  }, [sales, customerPayments]);

  const filteredCustomers = customerSummary.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCustomerStatus = selectedCustomerIdForStatus 
    ? customerSummary.find(c => c.id === selectedCustomerIdForStatus || c.name === selectedCustomerIdForStatus)
    : null;

  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
        {/* Tab Switcher */}
        <div className="flex bg-white border-b border-slate-200 mb-4 rounded-t-xl overflow-hidden shadow-sm flex-wrap">
            <button 
                onClick={() => setActiveTab('INPUT')}
                className={`flex-1 py-3 md:py-4 font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'INPUT' ? 'bg-primary text-white' : 'hover:bg-slate-50 text-slate-600'}`}
            >
                <CreditCard className="w-4 h-4" /> Input
            </button>
            <button 
                onClick={() => setActiveTab('STATUS')}
                className={`flex-1 py-3 md:py-4 font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'STATUS' ? 'bg-primary text-white' : 'hover:bg-slate-50 text-slate-600'}`}
            >
                <Wallet className="w-4 h-4" /> Status Saldo
            </button>
        </div>

        {activeTab === 'INPUT' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full overflow-hidden overflow-y-auto">
                {/* Form Input */}
                <div className="md:col-span-4 bg-white rounded-xl shadow border border-slate-200 flex flex-col p-6 h-fit">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex justify-between items-center">
                        {editingId ? 'Revisi Pembayaran' : 'Form Pembayaran Baru'}
                        {editingId && (
                            <button onClick={resetForm} className="text-xs text-red-500 underline">Batal Edit</button>
                        )}
                    </h2>
                    
                    <form onSubmit={handleInputSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Tgl Ledger</label>
                                <input 
                                    type="date" 
                                    required
                                    name="date"
                                    value={inputData.date}
                                    onChange={handleInputChange}
                                    className="w-full border-slate-300 rounded p-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Tgl Bayar</label>
                                <input 
                                    type="date" 
                                    required
                                    name="actualPaymentDate"
                                    value={inputData.actualPaymentDate}
                                    onChange={handleInputChange}
                                    className="w-full border-slate-300 rounded p-2 text-sm"
                                />
                            </div>
                        </div>
                        
                        <div>
                             <SearchableSelect 
                                label="Nama Customer"
                                value={inputData.customerName}
                                onChange={(val) => {
                                    const found = customers.find(c => c.name === val);
                                    setInputData(prev => ({ 
                                        ...prev, 
                                        customerName: val,
                                        customerId: found ? found.id : '' 
                                    }));
                                }}
                                options={customers.map(c => c.name)}
                                placeholder="Pilih Customer..."
                                required
                             />
                        </div>
                        
                        <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-blue-700 mb-1">Via Transfer (Rp)</label>
                                <input type="number" name="transferAmount" value={inputData.transferAmount || ''} onChange={handleInputChange} className="w-full border-blue-200 focus:ring-blue-500 rounded p-2 text-sm font-bold" placeholder="0" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-green-700 mb-1">Via Cash (Rp)</label>
                                <input type="number" name="cashAmount" value={inputData.cashAmount || ''} onChange={handleInputChange} className="w-full border-green-200 focus:ring-green-500 rounded p-2 text-sm font-bold" placeholder="0" />
                            </div>
                        </div>

                        <div className="bg-orange-50 p-3 rounded border border-orange-200 space-y-3">
                            <h3 className="text-xs font-bold text-orange-800 uppercase border-b border-orange-200 pb-1 mb-2">Potongan / Biaya</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Bongkaran</label>
                                    <input type="number" name="unloadingCost" value={inputData.unloadingCost || ''} onChange={handleInputChange} className="w-full border-slate-300 rounded p-2 text-sm" placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Bon Sopir</label>
                                    <input type="number" name="driverBonus" value={inputData.driverBonus || ''} onChange={handleInputChange} className="w-full border-slate-300 rounded p-2 text-sm" placeholder="0" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-600 mb-1">Biaya Lainnya</label>
                                    <input type="number" name="otherCost" value={inputData.otherCost || ''} onChange={handleInputChange} className="w-full border-slate-300 rounded p-2 text-sm" placeholder="0" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Keterangan</label>
                            <input type="text" name="notes" value={inputData.notes} onChange={handleInputChange} className="w-full border-slate-300 rounded p-2 text-sm" placeholder="Catatan tambahan..." />
                        </div>

                        <div className="pt-2 border-t mt-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-slate-600">Total:</span>
                                <span className="text-lg font-bold text-slate-900">
                                    {formatCurrency(inputData.transferAmount + inputData.cashAmount + inputData.unloadingCost + inputData.driverBonus + inputData.otherCost)}
                                </span>
                            </div>
                            
                            <div className="flex gap-2">
                                {editingId && (
                                     <button type="button" onClick={resetForm} className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                                        Batal
                                    </button>
                                )}
                                <button type="submit" className={`flex-1 ${editingId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-900 hover:bg-slate-800'} text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2`}>
                                    <Save className="w-5 h-5" /> {editingId ? 'Simpan Revisi' : 'Simpan Baru'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* History Table */}
                <div className="md:col-span-8 bg-white rounded-xl shadow border border-slate-200 flex flex-col overflow-hidden h-[500px] md:h-auto mt-4 md:mt-0">
                     <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <History className="w-5 h-5 text-slate-500" /> Riwayat (Database)
                            </h2>
                            <div className="text-xs text-slate-400 font-mono">
                                Total: {filteredHistory.length}
                            </div>
                        </div>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Cari Customer, Nominal, atau Catatan..." 
                                value={historySearchTerm}
                                onChange={(e) => setHistorySearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                     </div>
                     <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-xs text-slate-500 uppercase font-bold sticky top-0">
                                <tr>
                                    <th className="p-3">Tanggal</th>
                                    <th className="p-3">Customer</th>
                                    <th className="p-3 text-right">Total</th>
                                    <th className="p-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredHistory.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3 whitespace-nowrap text-slate-600 align-top">
                                            {formatDate(p.date)}
                                            <div className="text-[10px] text-slate-400 truncate w-32">{p.notes}</div>
                                        </td>
                                        <td className="p-3 font-bold text-slate-800 align-top">
                                            {p.customerName}
                                            <div className="flex gap-1 mt-1 text-[10px]">
                                                {p.transferAmount > 0 && <span className="bg-blue-100 text-blue-700 px-1 rounded">TF</span>}
                                                {p.cashAmount > 0 && <span className="bg-green-100 text-green-700 px-1 rounded">CASH</span>}
                                                {(p.unloadingCost > 0 || p.driverBonus > 0) && <span className="bg-orange-100 text-orange-700 px-1 rounded">POT</span>}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right font-bold bg-slate-50 align-top">{formatCurrency(p.totalPaid)}</td>
                                        <td className="p-3 text-center align-top">
                                            <div className="flex justify-center gap-1">
                                                <button 
                                                    onClick={() => handleEditPayment(p)}
                                                    className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 rounded shadow-sm"
                                                    title="Edit / Revisi"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                {isSuperAdmin && (
                                                    <button 
                                                        onClick={() => initiateDelete(p.id)}
                                                        className="p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-300 rounded shadow-sm"
                                                        title="Hapus (Super Admin)"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredHistory.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-10 text-center text-slate-400 italic">Data tidak ditemukan.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                     </div>
                </div>
            </div>
        )}

        {activeTab === 'STATUS' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full overflow-hidden relative">
                {/* ... (Status View preserved) */}
                {/* Left Panel: Customer List */}
                <div className={`md:col-span-4 bg-white rounded-xl shadow border border-slate-200 flex flex-col overflow-hidden absolute md:relative inset-0 z-10 transition-transform duration-300 ${showStatusDetailMobile ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
                    <div className="p-4 border-b border-slate-200 bg-slate-50">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Cari Customer..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-md border border-slate-300 text-sm"
                            />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {filteredCustomers.map(c => {
                             const balance = c.totalDebt - c.totalPaid;
                             const selectionKey = c.id || c.name; 
                             return (
                                <button
                                    key={selectionKey}
                                    onClick={() => { 
                                        setSelectedCustomerIdForStatus(selectionKey); 
                                        setShowStatusDetailMobile(true); 
                                    }}
                                    className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-md
                                        ${(selectedCustomerIdForStatus === c.id || selectedCustomerIdForStatus === c.name) 
                                        ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' 
                                        : 'bg-white border-slate-100 hover:border-slate-300'
                                        }
                                    `}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={`font-bold ${(selectedCustomerIdForStatus === c.id || selectedCustomerIdForStatus === c.name) ? 'text-blue-800' : 'text-slate-700'}`}>
                                        {c.name}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500 text-xs">{c.invoiceCount} Transaksi</span>
                                        <span className={`font-mono font-bold ${balance > 100 ? 'text-red-600' : 'text-green-600'}`}>
                                            {balance > 100 ? formatCurrency(balance) : (balance < -100 ? `+${formatCurrency(Math.abs(balance))}` : 'Lunas')}
                                        </span>
                                    </div>
                                </button>
                             );
                        })}
                    </div>
                </div>

                {/* Right Panel: Invoice Details */}
                <div className={`md:col-span-8 bg-white rounded-xl shadow border border-slate-200 flex flex-col overflow-hidden absolute md:relative inset-0 z-20 transition-transform duration-300 bg-white ${showStatusDetailMobile ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                    {activeCustomerStatus ? (
                    <>
                        <div className="p-4 md:p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                {/* Mobile Back Button */}
                                <button 
                                    onClick={() => setShowStatusDetailMobile(false)}
                                    className="md:hidden p-1 bg-white border rounded shadow-sm text-slate-600 mr-2"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                                <div>
                                    <h2 className="text-lg md:text-xl font-bold text-slate-800 leading-tight">{activeCustomerStatus.name}</h2>
                                    <p className="text-xs md:text-sm text-slate-500">Rekap Saldo</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] md:text-xs text-slate-500 uppercase font-bold">Total Sisa Hutang</div>
                                <div className={`text-xl md:text-2xl font-bold ${activeCustomerStatus.totalDebt - activeCustomerStatus.totalPaid > 100 ? 'text-red-600' : 'text-green-600'}`}>
                                {(() => {
                                    const bal = activeCustomerStatus.totalDebt - activeCustomerStatus.totalPaid;
                                    return bal > 100 
                                    ? formatCurrency(bal) 
                                    : (bal < -100 ? `+${formatCurrency(Math.abs(bal))}` : 'Lunas');
                                })()}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
                             <div className="bg-white rounded border border-slate-200 p-4 mb-4 grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-[10px] md:text-xs uppercase font-bold text-slate-500">Total Belanja</div>
                                    <div className="text-lg md:text-xl font-bold text-slate-800">{formatCurrency(activeCustomerStatus.totalDebt)}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] md:text-xs uppercase font-bold text-slate-500">Total Pembayaran</div>
                                    <div className="text-lg md:text-xl font-bold text-green-700">{formatCurrency(activeCustomerStatus.totalPaid)}</div>
                                </div>
                             </div>

                             <div className="text-center text-slate-400 text-xs md:text-sm mt-10 p-4 bg-white rounded border border-dashed">
                                 Untuk rincian lengkap, buka menu <b>Ledger</b> lalu klik <b>Kartu Piutang</b>.
                             </div>
                        </div>
                    </>
                    ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                            <ChevronRight className="w-8 h-8 text-slate-400" />
                        </div>
                        <p>Pilih customer untuk melihat saldo.</p>
                    </div>
                    )}
                </div>
            </div>
        )}

      <DeleteConfirmationModal 
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Hapus Pembayaran"
        message="Anda yakin ingin menghapus data pembayaran ini? Sisa piutang customer akan bertambah kembali."
        username={user.username}
      />
    </div>
  );
};

export default PaymentMenu;
