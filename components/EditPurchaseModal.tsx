
import React, { useState, useEffect } from 'react';
import { PurchaseRecord } from '../types';
import { X, Save } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import * as Storage from '../services/storageService';

interface EditPurchaseModalProps {
  purchase: PurchaseRecord | null;
  onClose: () => void;
  onSave: (updated: PurchaseRecord) => void;
}

const EditPurchaseModal: React.FC<EditPurchaseModalProps> = ({ purchase, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<PurchaseRecord>>(purchase || {});
  
  // Master Data Options
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [coops, setCoops] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [plates, setPlates] = useState<string[]>([]);

  useEffect(() => {
    const loadMasterData = async () => {
        const s = await Storage.getSuppliers();
        setSuppliers(s.map(i => i.name));
        
        const c = await Storage.getCoops();
        setCoops(c.map(i => i.name));
        
        const d = await Storage.getDriversList();
        setDrivers(d.map(i => i.value));
        
        const p = await Storage.getPlatesList();
        setPlates(p.map(i => i.value));
    };
    loadMasterData();
  }, []);

  if (!purchase) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };

  const handleSelectChange = (name: keyof PurchaseRecord, value: string) => {
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Recalculate derived
    const kg = formData.kg || purchase.kg;
    const heads = formData.heads || purchase.heads;
    const price = formData.buyPrice !== undefined ? formData.buyPrice : purchase.buyPrice;
    
    const avg = heads > 0 ? kg / heads : 0;
    const total = kg * price;

    onSave({ 
        ...purchase, 
        ...formData,
        avgWeight: avg,
        totalBuyCost: total
    } as PurchaseRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:hidden">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
            <h2 className="text-lg font-bold">Edit Pembelian</h2>
            <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm text-blue-800">
                Silakan revisi data pembelian di sini. Data master tersedia di dropdown.
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <SearchableSelect 
                        label="Supplier (Opsional)"
                        value={formData.supplier || ''}
                        onChange={(val) => handleSelectChange('supplier', val)}
                        options={suppliers}
                        placeholder="Pilih Supplier..."
                    />
                </div>
                 <div>
                    <SearchableSelect 
                        label="Kandang (Opsional)"
                        value={formData.coop || ''}
                        onChange={(val) => handleSelectChange('coop', val)}
                        options={coops}
                        placeholder="Pilih Kandang..."
                    />
                </div>
                <div>
                     <SearchableSelect 
                        label="Supir (Opsional)"
                        value={formData.driver || ''}
                        onChange={(val) => handleSelectChange('driver', val)}
                        options={drivers}
                        placeholder="Pilih Supir..."
                    />
                </div>
                 <div className="col-span-2 border-t pt-2">
                    <SearchableSelect 
                        label="Plat Nomor (Wajib)"
                        value={formData.plate || ''}
                        onChange={(val) => handleSelectChange('plate', val)}
                        options={plates}
                        placeholder="Pilih Plat..."
                        required
                    />
                </div>
                
                <div className="border-t col-span-2 mt-2"></div>

                <div>
                    <label className="block text-sm font-medium text-slate-700">Total Ekor</label>
                    <input type="number" name="heads" value={formData.heads} onChange={handleChange} className="w-full border-slate-300 rounded p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Total Kg</label>
                    <input type="number" name="kg" step="0.01" value={formData.kg} onChange={handleChange} className="w-full border-slate-300 rounded p-2" />
                </div>
                <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-800">Harga Beli / Kg</label>
                    <input type="number" name="buyPrice" value={formData.buyPrice} onChange={handleChange} className="w-full border-slate-300 rounded p-3 text-lg font-bold" />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-slate-600 hover:bg-slate-100">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
                    <Save className="w-4 h-4" /> Simpan Revisi
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default EditPurchaseModal;
