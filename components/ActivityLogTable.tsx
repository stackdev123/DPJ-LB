import React, { useState, useEffect } from 'react';
import { ActivityLog } from '../types';
import { getActivityLogs } from '../services/logService';
import { History, Search, RefreshCw, Database } from 'lucide-react';
import SchemaModal from './SchemaModal';

const ActivityLogTable: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [showSchema, setShowSchema] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    const data = await getActivityLogs();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
        log.username.toLowerCase().includes(term) ||
        log.details.toLowerCase().includes(term) ||
        log.entityType.toLowerCase().includes(term);
    
    const matchesFilter = filterAction === 'ALL' || log.actionType === filterAction;
    
    return matchesSearch && matchesFilter;
  });

  const getActionColor = (type: string) => {
      switch(type) {
          case 'CREATE': return 'bg-green-100 text-green-700';
          case 'UPDATE': return 'bg-blue-100 text-blue-700';
          case 'DELETE': return 'bg-red-100 text-red-700';
          case 'LOGIN': return 'bg-purple-100 text-purple-700';
          default: return 'bg-slate-100 text-slate-700';
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <History className="w-6 h-6 text-slate-600" />
                Activity Log
            </h2>
            <p className="text-sm text-slate-500">Rekaman aktivitas pengguna sistem.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setShowSchema(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white border border-slate-700 rounded hover:bg-slate-700 text-sm font-medium shadow-sm"
                title="View Database Schema / Fix Schema Error"
            >
                <Database className="w-4 h-4" />
                Schema & SQL
            </button>
            <button 
                onClick={fetchLogs} 
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded hover:bg-slate-50 text-sm font-medium"
            >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
            </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Cari User, Aktivitas, atau Detail..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border-slate-300 rounded text-sm focus:ring-1 focus:ring-primary"
                  />
              </div>
              <div className="w-full md:w-48">
                  <select 
                    value={filterAction} 
                    onChange={(e) => setFilterAction(e.target.value)}
                    className="w-full border-slate-300 rounded p-2 text-sm"
                  >
                      <option value="ALL">Semua Aksi</option>
                      <option value="CREATE">CREATE</option>
                      <option value="UPDATE">UPDATE</option>
                      <option value="DELETE">DELETE</option>
                      <option value="LOGIN">LOGIN</option>
                  </select>
              </div>
          </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs">
                      <tr>
                          <th className="p-3 w-40">Waktu</th>
                          <th className="p-3 w-32">User</th>
                          <th className="p-3 w-24">Aksi</th>
                          <th className="p-3 w-32">Entitas</th>
                          <th className="p-3">Detail Aktivitas</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-10 text-center text-slate-400 italic">
                                {loading ? 'Memuat data...' : 'Tidak ada log aktivitas atau tabel belum dibuat.'}
                            </td>
                          </tr>
                      ) : (
                          filteredLogs.map(log => (
                              <tr key={log.id} className="hover:bg-slate-50">
                                  <td className="p-3 text-slate-500 whitespace-nowrap text-xs">
                                      {new Date(log.timestamp).toLocaleString('id-ID')}
                                  </td>
                                  <td className="p-3 font-bold text-slate-700">
                                      {log.username}
                                      <div className="text-[10px] text-slate-400 font-normal">{log.role}</div>
                                  </td>
                                  <td className="p-3">
                                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${getActionColor(log.actionType)}`}>
                                          {log.actionType}
                                      </span>
                                  </td>
                                  <td className="p-3 font-mono text-xs text-slate-600">
                                      {log.entityType}
                                  </td>
                                  <td className="p-3 text-slate-700">
                                      {log.details}
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
          </div>
      </div>

      {showSchema && <SchemaModal onClose={() => setShowSchema(false)} />}
    </div>
  );
};

export default ActivityLogTable;