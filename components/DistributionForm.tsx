
import React, { useState, useEffect } from 'react';
import { PurchaseRecord, SaleRecord, Customer } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { Truck, Users, AlertCircle, Calendar, MapPin, TrendingUp, TrendingDown } from 'lucide-react';
import { formatDate, formatCurrency } from '../utils';
import SearchableSelect from './SearchableSelect';
import * as Storage from '../services/storageService';

interface DistributionFormProps {
  purchases: PurchaseRecord[];
  existingSales: SaleRecord[];
  onSaveSale: (sale: SaleRecord) => void;
  onCancel: () => void;
  initialPurchaseId?: string | null;
}

const DistributionForm: React.FC<DistributionFormProps> = ({ purchases, existingSales, onSaveSale, onCancel, initialPurchaseId }) => {
  const [purchaseDateFilter, setPurchaseDateFilter] = useState<string>('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
  
  // Master Data State
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    const loadCustomers = async () => {
      setCustomers(await Storage.getCustomers());
    };
    loadCustomers();
  }, []);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Default Transaction Date
    customerName: '',
    customerAddress: '',
    soldHeads: 0,
    soldKg: 0,
    sellPrice: 0,
    mortalityHeads: 0,
    mortalityKg: 0,
    unloadingCost: 0,
    driverBonus: 0,
    operationalCost: 0,
    truckCost: 500000, 
    initialPayment: 0,
    paymentMethod: 'TRANSFER' as 'CASH' | 'TRANSFER'
  });

  // Handle Initial Selection (Shortcut from Recap)
  useEffect(() => {
    if (initialPurchaseId) {
        const found = purchases.find(p => p.id === initialPurchaseId);
        if (found) {
            setPurchaseDateFilter(found.date);
            setSelectedPurchaseId(found.id);
            // Auto-set Sale Date to Purchase Date to avoid "missing" records in history
            setFormData(prev => ({ ...prev, date: found.date }));
        }
    }
  }, [initialPurchaseId, purchases]);
  
  // Find selected purchase and calculate remaining stock
  const selectedPurchase = purchases.find(p => String(p.id).trim().toLowerCase() === String(selectedPurchaseId).trim().toLowerCase());
  
  const relatedSales = existingSales.filter(s => 
    s.purchaseId && String(s.purchaseId).trim().toLowerCase() === String(selectedPurchaseId).trim().toLowerCase()
  );
  
  const totalSoldHeads = relatedSales.reduce((acc, curr) => acc + curr.soldHeads, 0);
  const totalSoldKg = relatedSales.reduce((acc, curr) => acc + curr.soldKg, 0);
  
  const remainingHeads = selectedPurchase ? selectedPurchase.heads - totalSoldHeads : 0;
  const remainingKg = selectedPurchase ? selectedPurchase.kg - totalSoldKg : 0;

  const [derived, setDerived] = useState({
    mortalityValue: 0,
    invoiceTotal: 0,
    estimatedProfit: 0
  });

  // When Customer Name is selected from dropdown, auto-fill address
  useEffect(() => {
    const matchedCustomer = customers.find(c => c.name === formData.customerName);
    if (matchedCustomer) {
        setFormData(prev => ({ ...prev, customerAddress: matchedCustomer.address }));
    }
  }, [formData.customerName, customers]);

  // Reset selected purchase when date filter changes ONLY if not initial load
  useEffect(() => {
    // If we just loaded an initial purchase, don't reset
    if (initialPurchaseId && selectedPurchaseId === initialPurchaseId) return;
    
    // Otherwise reset logic
    if (!initialPurchaseId) setSelectedPurchaseId('');
  }, [purchaseDateFilter]);

  // Reset form when purchase changes and implement Smart Logic for Truck Cost
  useEffect(() => {
    if (selectedPurchaseId) {
        // Only reset quantities, keep the date if it was set by initialPurchaseId or user
        setFormData(prev => ({ ...prev, soldHeads: 0, soldKg: 0 }));
        
        // Smart Logic: If this purchase already has sales, default truck cost to 0 (assume paid in first trip)
        // Else, default to 500k
        if (relatedSales.length > 0) {
            setFormData(prev => ({ ...prev, truckCost: 0 }));
        } else {
            setFormData(prev => ({ ...prev, truckCost: 500000 }));
        }
    }
  }, [selectedPurchaseId]); 

  useEffect(() => {
    const mortVal = formData.mortalityKg * formData.sellPrice;
    const netKg = Math.max(0, formData.soldKg - formData.mortalityKg);
    const invTotal = netKg * formData.sellPrice;

    // Estimate Profit for this specific transaction chunk
    let profit = 0;
    if (selectedPurchase) {
        // Revenue: Invoice Total
        const revenue = invTotal;
        // Cost: SoldKg * BuyPrice (Cost of Goods)
        const cogs = formData.soldKg * selectedPurchase.buyPrice;
        
        // Expenses
        // NOTE: Driver Bonus is excluded from Profit Loss as it is a receivable/loan
        const expenses = formData.unloadingCost + formData.operationalCost + formData.truckCost;
        
        profit = revenue - cogs - expenses;
    }

    setDerived({
      mortalityValue: mortVal,
      invoiceTotal: invTotal,
      estimatedProfit: profit
    });
  }, [formData, selectedPurchase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'customerName' || name === 'customerAddress' || name === 'paymentMethod' || name === 'date')
        ? value 
        : parseFloat(value) || 0
    }));
  };

  const handleCustomerSelect = (val: string) => {
    setFormData(prev => ({ ...prev, customerName: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchase) return;

    if (formData.soldKg > remainingKg + 0.1) {
        if(!confirm("Peringatan: Jumlah Kg Penjualan melebihi sisa stok pembelian! Lanjutkan?")) {
            return;
        }
    }

    // Auto-save New Customer if not exists
    const existing = customers.find(c => c.name.toLowerCase() === formData.customerName.toLowerCase());
    let customerId = existing?.id;
    if (!existing) {
        customerId = uuidv4();
        await Storage.saveCustomer({
            id: customerId,
            name: formData.customerName,
            address: formData.customerAddress || '-'
        });
    }

    const newSale: SaleRecord = {
      id: uuidv4(),
      purchaseId: selectedPurchaseId,
      customerId: customerId || '',
      customerName: formData.customerName,
      customerAddress: formData.customerAddress,
      date: formData.date, // User Selected Date
      soldHeads: formData.soldHeads,
      soldKg: formData.soldKg,
      sellPrice: formData.sellPrice,
      mortalityHeads: formData.mortalityHeads,
      mortalityKg: formData.mortalityKg,
      unloadingCost: formData.unloadingCost,
      driverBonus: formData.driverBonus,
      operationalCost: formData.operationalCost,
      truckCost: formData.truckCost,
      payments: formData.initialPayment > 0 ? [{
        id: uuidv4(),
        amount: formData.initialPayment,
        date: formData.date,
        method: formData.paymentMethod
      }] : []
    };

    onSaveSale(newSale);
  };

  const activePurchases = purchases.filter(p => {
     if (purchaseDateFilter && p.date !== purchaseDateFilter) return false;
     const pIdNormalized = String(p.id).trim().toLowerCase();
     const pSales = existingSales.filter(s => s.purchaseId && String(s.purchaseId).trim().toLowerCase() === pIdNormalized);
     const sold = pSales.reduce((acc, curr) => acc + curr.soldKg, 0);
     // Show if not fully sold OR if it's the currently selected one (to prevent disappearing)
     return sold < p.kg || p.id === selectedPurchaseId;
  });

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Truck className="w-6 h-6 text-secondary" />
        Input Distribusi Penjualan
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Step 1: Filter by Date */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Pilih Tanggal Pembelian (DO)
                    </label>
                    <input 
                        type="date" 
                        value={purchaseDateFilter}
                        onChange={(e) => setPurchaseDateFilter(e.target.value)}
                        className="block w-full rounded-md border-slate-300 shadow-sm focus:border-primary focus:ring focus:ring-primary p-2 border"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Pilih Data Stok Pembelian</label>
                    <select 
                        value={selectedPurchaseId} 
                        onChange={(e) => setSelectedPurchaseId(e.target.value)}
                        className="block w-full rounded-md border-slate-300 shadow-sm focus:border-secondary focus:ring focus:ring-secondary p-2 border disabled:bg-slate-200 disabled:text-slate-400"
                        required
                        disabled={!purchaseDateFilter}
                    >
                        <option value="">-- Pilih Stok Tersedia --</option>
                        {activePurchases.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.supplier || 'No Supplier'} | {p.plate} | Sisa: {(p.kg - (existingSales.filter(s => s.purchaseId && String(s.purchaseId).trim().toLowerCase() === String(p.id).trim().toLowerCase()).reduce((sum, s) => sum + s.soldKg, 0))).toFixed(1)} Kg
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {selectedPurchase && (
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600 bg-white p-2 rounded border border-dashed border-slate-300">
                    <span className="font-semibold">Info Stok:</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded border">Sisa Ekor: <b>{remainingHeads}</b></span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded border">Sisa Kg: <b>{remainingKg.toFixed(2)}</b></span>
                </div>
            )}
        </div>

        {selectedPurchase && (
            <>
                {/* Transaction Date Field */}
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 flex items-center gap-4">
                    <label className="block text-sm font-bold text-yellow-800">Tanggal Transaksi Penjualan:</label>
                    <input 
                        type="date" 
                        name="date"
                        value={formData.date}
                        onChange={handleChange}
                        className="rounded-md border-slate-300 p-1.5 border text-sm font-bold text-slate-800"
                        required
                    />
                    <div className="text-xs text-yellow-700 italic">
                        *Pastikan tanggal sesuai. (Default: Tanggal Pembelian)
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Customer Info */}
                    <div className="space-y-4 md:col-span-2 border-b border-dashed border-slate-300 pb-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase">Customer Info</h3>
                            <div className="text-blue-600 text-sm font-bold font-mono">
                                Info Harga Beli Awal: {formatCurrency(selectedPurchase.buyPrice)}
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row gap-4 p-4 border border-blue-200 border-dashed rounded-lg">
                            <div className="flex-1">
                                <SearchableSelect 
                                    label="Nama Customer"
                                    value={formData.customerName}
                                    onChange={handleCustomerSelect}
                                    options={customers.map(c => c.name)}
                                    placeholder="Ketik Nama Customer..."
                                    required
                                />
                            </div>
                            <div className="flex-[1.5]">
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Alamat Customer <span className="text-xs font-normal text-slate-400 italic">(Boleh dikosongkan)</span>
                                </label>
                                <div className="relative">
                                    <MapPin className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                                    <input 
                                        type="text" 
                                        name="customerAddress" 
                                        value={formData.customerAddress} 
                                        onChange={handleChange} 
                                        className="block w-full pl-8 rounded-md border-slate-300 p-2 border" 
                                        placeholder="Alamat Lengkap..." 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Jual Ekor</label>
                                <input type="number" name="soldHeads" required max={remainingHeads + 50} value={formData.soldHeads || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 p-2 border" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Jual Kg</label>
                                <input type="number" name="soldKg" required step="0.01" max={remainingKg + 50} value={formData.soldKg || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 p-2 border" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="block text-sm font-bold text-slate-800 mb-1">Harga Jual / Kg</label>
                            <input 
                                type="number" 
                                name="sellPrice" 
                                // Required attribute removed to allow 0/empty
                                value={formData.sellPrice || ''} 
                                onChange={handleChange} 
                                className="block w-full rounded-lg border-slate-400 p-3 border text-lg font-bold text-slate-900 shadow-sm focus:ring-2 focus:ring-secondary"
                                placeholder="0 (Boleh Kosong/Menyusul)"
                            />
                            <p className="text-[10px] text-slate-500 mt-1 italic">* Harga bisa dikosongkan (0) jika nota harga menyusul.</p>
                        </div>
                    </div>

                    {/* Mortality & Extras */}
                    <div className="space-y-4">
                         <div className="grid grid-cols-2 gap-4 bg-red-50 p-3 rounded-md border border-red-100">
                            <div>
                                <label className="block text-sm font-medium text-red-800">Mati Ekor</label>
                                <input type="number" name="mortalityHeads" value={formData.mortalityHeads || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-red-200 focus:ring-red-500 p-2 border" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-red-800">Mati Kg</label>
                                <input type="number" name="mortalityKg" step="0.01" value={formData.mortalityKg || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-red-200 focus:ring-red-500 p-2 border" />
                            </div>
                            <div className="col-span-2 text-right text-sm text-red-700 font-medium">
                                Nilai Kerugian: Rp {derived.mortalityValue.toLocaleString()}
                            </div>
                         </div>

                         {/* Expenses Dashed Box */}
                         <div className="grid grid-cols-2 gap-4 p-3 border-2 border-dashed border-blue-300 rounded-lg relative">
                            <div className="absolute -top-3 left-3 bg-white px-2 text-xs font-bold text-blue-500">
                                Biaya Tambahan
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Biaya Bongkar</label>
                                <input type="number" name="unloadingCost" value={formData.unloadingCost || ''} onChange={handleChange} className="block w-full rounded-md border-slate-300 p-2 border text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Bon Sopir</label>
                                <input type="number" name="driverBonus" value={formData.driverBonus || ''} onChange={handleChange} className="block w-full rounded-md border-slate-300 p-2 border text-sm" />
                                <span className="text-[10px] text-slate-400 leading-none">*Dipinjam Driver</span>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Biaya Operasional</label>
                                <input type="number" name="operationalCost" value={formData.operationalCost || ''} onChange={handleChange} className="block w-full rounded-md border-slate-300 p-2 border text-sm" placeholder="0" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Sewa Truk</label>
                                <input type="number" name="truckCost" value={formData.truckCost || ''} onChange={handleChange} className="block w-full rounded-md border-slate-300 p-2 border text-sm" placeholder="0" />
                            </div>
                         </div>
                    </div>
                </div>

                {/* Financial Summary */}
                <div className="mt-8 p-6 bg-slate-900 text-white rounded-lg shadow-xl relative overflow-hidden border border-slate-700">
                    <div className="flex justify-between items-center mb-6 relative z-10 border-b border-slate-700 pb-4">
                        <div>
                            <div className="text-slate-400 text-sm font-medium uppercase tracking-wider">Total Tagihan (Invoice)</div>
                            <div className="text-[10px] text-slate-500 font-mono mt-1">(Total Kg - Mati Kg) x Harga Jual</div>
                        </div>
                        <div className="text-4xl font-bold text-green-400 drop-shadow-sm font-mono tracking-tight">
                            Rp {derived.invoiceTotal.toLocaleString('id-ID')}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 relative z-10">
                        <div>
                             <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Pembayaran Awal (DP/Lunas)</label>
                             <input type="number" name="initialPayment" value={formData.initialPayment || ''} onChange={handleChange} className="block w-full rounded bg-slate-800 border-slate-600 text-white p-2 font-bold" placeholder="0" />
                        </div>
                         <div>
                             <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Metode Pembayaran</label>
                             <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="block w-full rounded bg-slate-800 border-slate-600 text-white p-2 text-sm">
                                 <option value="TRANSFER">TRANSFER</option>
                                 <option value="CASH">CASH</option>
                             </select>
                        </div>
                    </div>
                    
                    <div className="mt-3 text-right text-sm text-yellow-500 font-mono font-bold relative z-10">
                        Sisa Piutang: Rp {(derived.invoiceTotal - formData.initialPayment).toLocaleString()}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center relative z-10">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">EST. LABA/RUGI TRANSAKSI INI</span>
                        <span className={`text-base font-bold font-mono ${derived.estimatedProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatCurrency(derived.estimatedProfit)}
                        </span>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={onCancel} className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 font-medium">
                    Cancel
                  </button>
                  <button type="submit" className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 shadow-lg flex items-center gap-2 font-bold">
                    <Truck className="w-4 h-4" />
                    Proses Penjualan & Invoice
                  </button>
                </div>
            </>
        )}
      </form>
    </div>
  );
};

export default DistributionForm;
