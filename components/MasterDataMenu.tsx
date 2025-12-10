
import React, { useState, useEffect } from 'react';
import * as Storage from '../services/storageService';
import { Customer, Supplier, Coop, MasterItem, User } from '../types';
import { Plus, Trash2, Database, Loader2, List, MapPin } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '../services/logService';

interface MasterDataMenuProps {
    user: User;
}

const MasterDataMenu: React.FC<MasterDataMenuProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'CUSTOMER' | 'SUPPLIER' | 'COOP' | 'DRIVER' | 'PLATE'>('CUSTOMER');

  // Data State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [coops, setCoops] = useState<Coop[]>([]);
  const [drivers, setDrivers] = useState<MasterItem[]>([]);
  const [plates, setPlates] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Inputs
  const [inputName, setInputName] = useState('');
  const [inputAddress, setInputAddress] = useState('');
  
  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    setCustomers(await Storage.getCustomers());
    setSuppliers(await Storage.getSuppliers());
    setCoops(await Storage.getCoops());
    setDrivers(await Storage.getDriversList());
    setPlates(await Storage.getPlatesList());
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName) return;

    setLoading(true);
    let entityId = '';

    if (activeTab === 'CUSTOMER') {
        entityId = uuidv4();
        await Storage.saveCustomer({ id: entityId, name: inputName, address: inputAddress || '-' });
    } else if (activeTab === 'SUPPLIER') {
        entityId = uuidv4();
        await Storage.saveSupplier({ id: entityId, name: inputName });
    } else if (activeTab === 'COOP') {
        entityId = uuidv4();
        await Storage.saveCoop({ id: entityId, name: inputName });
    } else if (activeTab === 'DRIVER') {
        entityId = uuidv4();
        await Storage.saveDriverToList({ id: entityId, value: inputName });
    } else if (activeTab === 'PLATE') {
        entityId = uuidv4();
        await Storage.savePlateToList({ id: entityId, value: inputName });
    }

    // Log
    await logActivity(user, 'CREATE', activeTab, `Added ${inputName}`, entityId);

    setInputName('');
    setInputAddress('');
    refreshData();
  };

  const handleDelete = async (id: string, name: string) => {
    if(!confirm(`Hapus data ${name}?`)) return;
    
    setLoading(true);
    if (activeTab === 'CUSTOMER') await Storage.deleteCustomer(id);
    if (activeTab === 'SUPPLIER') await Storage.deleteSupplier(id);
    if (activeTab === 'COOP') await Storage.deleteCoop(id);
    if (activeTab === 'DRIVER') await Storage.deleteDriverFromList(id);
    if (activeTab === 'PLATE') await Storage.deletePlateFromList(id);
    
    // Log
    await logActivity(user, 'DELETE', activeTab, `Deleted ${name}`, id);

    refreshData();
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-120px)]">
        {/* Responsive Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto no-scrollbar">
            <div className="flex p-1 gap-1 min-w-max">
                {['CUSTOMER', 'SUPPLIER', 'COOP', 'DRIVER', 'PLATE'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2
                            ${activeTab === tab 
                                ? 'bg-slate-800 text-white shadow-md' 
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                            }
                        `}
                    >
                        {tab === 'CUSTOMER' && <MapPin className="w-4 h-4" />}
                        {tab === 'COOP' && <Database className="w-4 h-4" />}
                        {tab === 'COOP' ? 'Kandang' : 
                         tab === 'PLATE' ? 'Plat Nomor' : 
                         tab === 'DRIVER' ? 'Supir' : 
                         tab.charAt(0) + tab.slice(1).toLowerCase()}
                    </button>
                ))}
            </div>
        </div>

        {/* Content & Form */}
        <div className="bg-white rounded-xl shadow border border-slate-200 flex flex-col flex-1 overflow-hidden">
            {/* Input Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Plus className="w-4 h-4 text-green-600" />
                        Tambah {activeTab === 'COOP' ? 'Kandang' : activeTab}
                        {loading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                    </h2>
                </div>
                
                <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-3 items-end">
                    <div className="w-full flex-1">
                        <input 
                            type="text" 
                            required 
                            className="w-full border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                            placeholder={`Nama ${activeTab === 'PLATE' ? 'Plat No' : activeTab.toLowerCase()}...`}
                            value={inputName}
                            onChange={e => setInputName(e.target.value)}
                        />
                    </div>
                    
                    {activeTab === 'CUSTOMER' && (
                        <div className="w-full flex-[1.5]">
                            <input 
                                type="text" 
                                required 
                                className="w-full border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                                placeholder="Alamat lengkap customer..."
                                value={inputAddress}
                                onChange={e => setInputAddress(e.target.value)}
                            />
                        </div>
                    )}

                    <button type="submit" className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50" disabled={loading}>
                        Simpan
                    </button>
                </form>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-0 bg-white">
                 {activeTab === 'CUSTOMER' ? (
                        <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-bold sticky top-0 z-10">
                            <tr>
                                <th className="p-3 border-b w-1/3">Nama Customer</th>
                                <th className="p-3 border-b">Alamat</th>
                                <th className="p-3 border-b text-center w-16">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {customers.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-3 font-bold text-slate-700">{c.name}</td>
                                    <td className="p-3 text-slate-500 text-xs">{c.address}</td>
                                    <td className="p-3 text-center">
                                        <button onClick={() => handleDelete(c.id, c.name)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        </table>
                ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                            {(activeTab === 'SUPPLIER' ? suppliers : 
                                activeTab === 'COOP' ? coops : 
                                activeTab === 'DRIVER' ? drivers : 
                                plates).map((item: any) => (
                                <div key={item.id} className="flex justify-between items-center p-3 border-b border-r border-slate-100 hover:bg-slate-50 group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-primary transition-colors"></div>
                                        <span className="font-medium text-slate-700 text-sm">{item.name || item.value}</span>
                                    </div>
                                    <button onClick={() => handleDelete(item.id, item.name || item.value)} className="text-slate-300 hover:text-red-600 p-1">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default MasterDataMenu;
