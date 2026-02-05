import React, { useState, useEffect } from 'react';
import { SaleRecord, Customer, PurchaseRecord } from '../types';
import { X, Save } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import CurrencyInput from './CurrencyInput';
import * as Storage from '../services/storageService';
import { v4 as uuidv4 } from 'uuid';

interface EditSaleModalProps {
  sale: SaleRecord | null;
  purchases: PurchaseRecord[];
  onClose: () => void;
  onSave: (updatedSale: SaleRecord) => void;
}

const EditSaleModal: React.FC<EditSaleModalProps> = ({ sale, purchases, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<SaleRecord>>(sale || {});
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
      const loadCustomers = async () => {
          const c = await Storage.getCustomers();
          setCustomers(c);
      }
      loadCustomers();
  }, []);

  // Auto-calculate Mortality Kg based on average weight from parent purchase
  useEffect(() => {
    if (sale && formData.mortalityHeads !== undefined && formData.mortalityHeads > 0) {
        const parentPurchase = purchases.find(p => p.id === sale.purchaseId);
        if (parentPurchase) {
            const calculatedKg = formData.mortalityHeads * parentPurchase.avgWeight;
            setFormData(prev => ({ ...prev, mortalityKg: parseFloat(calculatedKg.toFixed(2)) }));
        }
    }
  }, [formData.mortalityHeads, sale, purchases]);

  if (!sale) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'date')
        ? value 
        : parseFloat(value) || 0
    }));
  };

  const handleNumericChange = (name: keyof SaleRecord, value: number) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCustomerChange = (val: string) => {
      // Logic: Find existing customer to get ID, or generate new ID if not found
      // This ensures Ledger grouping (by ID) follows the new name.
      const existingCustomer = customers.find(c => c.name === val);
      
      setFormData(prev => ({ 
          ...prev, 
          customerName: val,
          // If customer exists, use their ID. 
          // If not (user typed new name), assume it's a new customer and generate ID (or keep existing if just correcting name? safer to generate/match)
          // For simplicity in edit mode: if exact match found, switch ID. If not, we might be renaming the current customer OR creating new.
          // To be safe and consistent with DistributionForm logic:
          customerId: existingCustomer ? existingCustomer.id : (prev.customerId || uuidv4())
      }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...sale, ...formData } as SaleRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
            <h2 className="text-lg font-bold">Revisi Transaksi Penjualan</h2>
            <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
            <div className="bg-orange-50 p-3 rounded border border-orange-200 mb-4 text-sm text-orange-800">
                Warning: Mengubah data transaksi akan mempengaruhi stok, tagihan, dan laporan laba rugi.
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Tanggal</label>
                    <input type="date" name="date" value={formData.date} onChange={handleChange} className="w-full border-slate-300 rounded p-2" />
                </div>
                <div>
                    <SearchableSelect 
                        label="Customer"
                        value={formData.customerName || ''}
                        onChange={handleCustomerChange}
                        options={customers.map(c => c.name)}
                        placeholder="Cari Customer..."
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Jual Ekor</label>
                    <input type="number" name="soldHeads" value={formData.soldHeads} onChange={handleChange} className="w-full border-slate-300 rounded p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Jual Kg</label>
                    <input type="number" name="soldKg" step="0.01" value={formData.soldKg} onChange={handleChange} className="w-full border-slate-300 rounded p-2" />
                </div>
                <div className="col-span-2">
                    <CurrencyInput 
                        label="Harga Jual / Kg"
                        value={formData.sellPrice || 0}
                        onChange={(val) => handleNumericChange('sellPrice', val)}
                        className="w-full border-slate-300 rounded p-2 font-bold text-slate-900"
                        placeholder="0"
                    />
                    <p className="text-[10px] text-slate-500 italic mt-1">*Jika harga 0, tagihan akan nol.</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4">
                 <div>
                    <label className="block text-sm font-medium text-red-700">Mati Ekor</label>
                    <input type="number" name="mortalityHeads" value={formData.mortalityHeads} onChange={handleChange} className="w-full border-slate-300 rounded p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-red-700">Mati Kg</label>
                    <input type="number" name="mortalityKg" step="0.01" value={formData.mortalityKg} onChange={handleChange} className="w-full border-slate-300 rounded p-2" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4 bg-slate-50 p-3 rounded">
                <div>
                    <CurrencyInput 
                        label="Biaya Bongkar"
                        labelClassName="block text-xs font-bold text-slate-600"
                        value={formData.unloadingCost || 0}
                        onChange={(val) => handleNumericChange('unloadingCost', val)}
                        className="w-full border-slate-300 rounded p-2"
                        placeholder="0"
                    />
                </div>
                <div>
                    <CurrencyInput 
                        label="Bon Sopir"
                        labelClassName="block text-xs font-bold text-slate-600"
                        value={formData.driverBonus || 0}
                        onChange={(val) => handleNumericChange('driverBonus', val)}
                        className="w-full border-slate-300 rounded p-2"
                        placeholder="0"
                    />
                </div>
                <div>
                    <CurrencyInput 
                        label="Ops Lainnya"
                        labelClassName="block text-xs font-bold text-slate-600"
                        value={formData.operationalCost || 0}
                        onChange={(val) => handleNumericChange('operationalCost', val)}
                        className="w-full border-slate-300 rounded p-2"
                        placeholder="0"
                    />
                </div>
                <div>
                    <CurrencyInput 
                        label="Sewa Truk"
                        labelClassName="block text-xs font-bold text-slate-600"
                        value={formData.truckCost || 0}
                        onChange={(val) => handleNumericChange('truckCost', val)}
                        className="w-full border-slate-300 rounded p-2"
                        placeholder="0"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
                    <Save className="w-4 h-4" /> Simpan Perubahan
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default EditSaleModal;