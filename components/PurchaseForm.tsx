
import React, { useState, useEffect } from 'react';
import { PurchaseRecord, Supplier, Coop } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { Save, Plus, Trash2, Loader2, Info } from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import * as Storage from '../services/storageService';

interface PurchaseFormProps {
  onSave: (records: PurchaseRecord[]) => void;
  onCancel: () => void;
}

interface PurchaseRowData {
  tempId: string;
  date: string;
  supplier: string; 
  coop: string; 
  driver: string;
  plate: string;
  heads: number;
  kg: number;
  buyPrice: number;
}

const PurchaseForm: React.FC<PurchaseFormProps> = ({ onSave, onCancel }) => {
  const [suppliersObj, setSuppliersObj] = useState<Supplier[]>([]);
  const [coopsObj, setCoopsObj] = useState<Coop[]>([]);
  const [plates, setPlates] = useState<string[]>([]);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadMaster = async () => {
        setLoading(true);
        setSuppliersObj(await Storage.getSuppliers());
        setCoopsObj(await Storage.getCoops());
        const d = await Storage.getDriversList();
        setDrivers(d.map(i => i.value));
        const p = await Storage.getPlatesList();
        setPlates(p.map(i => i.value));
        setLoading(false);
    }
    loadMaster();
  }, []);

  const [rows, setRows] = useState<PurchaseRowData[]>([
    {
      tempId: uuidv4(),
      date: new Date().toISOString().split('T')[0],
      supplier: '',
      coop: '',
      driver: '',
      plate: '',
      heads: 0,
      kg: 0,
      buyPrice: 0,
    }
  ]);

  const updateRow = (id: string, field: keyof PurchaseRowData, value: any) => {
    setRows(prev => prev.map(row => {
      if (row.tempId === id) {
        if (field === 'supplier') {
            return { ...row, supplier: value };
        }
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  const addRow = () => {
    const lastRow = rows[rows.length - 1];
    setRows(prev => [
      ...prev, 
      {
        tempId: uuidv4(),
        date: lastRow.date,
        supplier: lastRow.supplier, 
        coop: lastRow.coop, 
        driver: '',
        plate: '',
        heads: 0,
        kg: 0,
        buyPrice: 0
      }
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length > 1) {
      setRows(prev => prev.filter(r => r.tempId !== id));
    }
  };

  const calculateRowDerived = (row: PurchaseRowData) => {
    const avg = row.heads > 0 ? row.kg / row.heads : 0;
    const total = row.kg * row.buyPrice;
    return { avg, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const row of rows) {
        if(row.driver) await Storage.saveDriverToList({ id: uuidv4(), value: row.driver });
        if(row.plate) await Storage.savePlateToList({ id: uuidv4(), value: row.plate });
    }

    const recordsToSave: PurchaseRecord[] = rows.map(row => {
      const { avg, total } = calculateRowDerived(row);
      return {
        id: uuidv4(),
        date: row.date,
        supplier: row.supplier,
        coop: row.coop,
        driver: row.driver,
        plate: row.plate,
        heads: row.heads,
        kg: row.kg,
        avgWeight: parseFloat(avg.toFixed(2)),
        buyPrice: row.buyPrice,
        totalBuyCost: total,
        isDistributed: false
      };
    });

    onSave(recordsToSave);
  };

  const grandTotal = rows.reduce((acc, row) => acc + (row.kg * row.buyPrice), 0);

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          Input Pembelian Baru
          {loading && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
        </h2>
        <div className="text-right">
           <div className="text-xs text-slate-500">Grand Total</div>
           <div className="text-xl font-bold text-primary">Rp {grandTotal.toLocaleString('id-ID')}</div>
        </div>
      </div>
      
      <div className="mb-4 bg-blue-50 p-3 rounded border border-blue-200 text-sm text-blue-800 flex items-start gap-2">
         <Info className="w-5 h-5 shrink-0 mt-0.5" />
         <p>Data Supplier, Kandang, Supir, dan Harga Beli bisa dikosongkan jika informasi belum lengkap. Anda dapat melengkapinya nanti melalui menu <b>Riwayat Pembelian</b>.</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {rows.map((row, index) => {
           const { avg, total } = calculateRowDerived(row);
           const allCoopNames = coopsObj.map(c => c.name);

           return (
            <div key={row.tempId} className="bg-slate-50 border border-slate-200 p-4 rounded-lg relative transition-all hover:shadow-md">
                <div className="absolute top-2 left-2 bg-slate-200 text-slate-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                    {index + 1}
                </div>
                
                {rows.length > 1 && (
                    <button 
                        type="button" 
                        onClick={() => removeRow(row.tempId)}
                        className="absolute top-2 right-2 text-red-400 hover:text-red-600 p-1"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
                    {/* Line 1: Basic Info */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tanggal</label>
                        <input 
                            type="date" 
                            required 
                            value={row.date} 
                            onChange={(e) => updateRow(row.tempId, 'date', e.target.value)} 
                            className="w-full rounded-md border-slate-300 p-2 border text-sm" 
                        />
                    </div>
                    <div className="md:col-span-3">
                         <SearchableSelect 
                            label="Supplier"
                            options={suppliersObj.map(s => s.name)}
                            value={row.supplier}
                            onChange={(val) => updateRow(row.tempId, 'supplier', val)}
                            placeholder="Supplier (Boleh Kosong)"
                            required={false}
                         />
                    </div>
                    <div className="md:col-span-3">
                        <SearchableSelect 
                            label="Kandang (Coop)"
                            options={allCoopNames}
                            value={row.coop}
                            onChange={(val) => updateRow(row.tempId, 'coop', val)}
                            placeholder="Kandang (Boleh Kosong)"
                            required={false}
                         />
                    </div>
                    <div className="md:col-span-2">
                        <SearchableSelect 
                            label="Plat Nomor"
                            options={plates}
                            value={row.plate}
                            onChange={(val) => updateRow(row.tempId, 'plate', val)}
                            placeholder="Plat No (Wajib)"
                            required
                         />
                    </div>
                    <div className="md:col-span-2">
                        <SearchableSelect 
                            label="Supir"
                            options={drivers}
                            value={row.driver}
                            onChange={(val) => updateRow(row.tempId, 'driver', val)}
                            placeholder="Supir (Boleh Kosong)"
                            required={false}
                         />
                    </div>

                    {/* Line 2: Numbers */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Ekor</label>
                        <input 
                            type="number" 
                            required 
                            min="1"
                            value={row.heads || ''} 
                            onChange={(e) => updateRow(row.tempId, 'heads', parseFloat(e.target.value))} 
                            className="w-full rounded-md border-slate-300 p-2 border text-sm font-mono" 
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Total Kg</label>
                        <input 
                            type="number" 
                            required 
                            min="0.1"
                            step="0.01"
                            value={row.kg || ''} 
                            onChange={(e) => updateRow(row.tempId, 'kg', parseFloat(e.target.value))} 
                            className="w-full rounded-md border-slate-300 p-2 border text-sm font-mono" 
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-500 mb-1">Rata-rata</label>
                        <div className="w-full bg-slate-200 p-2 rounded-md text-sm text-slate-700 font-mono">
                            {avg.toFixed(2)} Kg
                        </div>
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Harga Beli / Kg</label>
                        <input 
                            type="number" 
                            min="0"
                            value={row.buyPrice || ''} 
                            onChange={(e) => updateRow(row.tempId, 'buyPrice', parseFloat(e.target.value))} 
                            className="w-full rounded-md border-slate-300 p-2 border text-sm font-mono" 
                            placeholder="0 (Boleh Kosong)"
                        />
                    </div>
                    <div className="md:col-span-3">
                         <label className="block text-sm font-medium text-slate-500 mb-1">Subtotal</label>
                         <div className="w-full bg-primary/10 border border-primary/20 p-2 rounded-md text-sm text-primary font-bold font-mono text-right">
                            Rp {total.toLocaleString('id-ID')}
                        </div>
                    </div>
                </div>
            </div>
           );
        })}

        <button 
            type="button" 
            onClick={addRow}
            className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-primary hover:text-primary transition-colors flex justify-center items-center gap-2"
        >
            <Plus className="w-5 h-5" />
            Tambah Data Pembelian Lain (Add Row)
        </button>

        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
          <button type="button" onClick={onCancel} className="px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 flex items-center gap-2">
            <Save className="w-4 h-4" />
            Simpan Semua ({rows.length} Items)
          </button>
        </div>
      </form>
    </div>
  );
};

export default PurchaseForm;
