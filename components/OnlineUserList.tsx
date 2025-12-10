import React from 'react';
import { OnlineUser, User } from '../types';
import { X, Users, Globe } from 'lucide-react';

interface OnlineUserListProps {
  users: OnlineUser[];
  onClose: () => void;
  currentUser: User;
}

const OnlineUserList: React.FC<OnlineUserListProps> = ({ users, onClose, currentUser }) => {
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-end p-4 md:p-6 bg-black/10 backdrop-blur-[2px]">
      <div className="bg-white w-full max-w-xs rounded-xl shadow-2xl overflow-hidden border border-slate-200 mt-16 animate-in slide-in-from-right-10 duration-200">
        
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-green-400" />
                Who is Online?
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
            </button>
        </div>

        <div className="p-2 bg-slate-50 border-b border-slate-200 text-xs text-center text-slate-500">
            Total {users.length} pengguna sedang aktif saat ini.
        </div>

        <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
            {users.map((u, idx) => {
                const isMe = u.userId === currentUser.id;
                const loginTime = u.onlineAt ? new Date(u.onlineAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
                
                return (
                    <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${isMe ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-100'}`}>
                        <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-xs">
                                {u.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white bg-green-500"></span>
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <span className={`text-sm font-bold ${isMe ? 'text-blue-700' : 'text-slate-700'}`}>
                                    {u.username} {isMe && '(Anda)'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center mt-0.5">
                                <span className="text-[10px] text-slate-400 uppercase font-semibold">{u.role}</span>
                                <span className="text-[10px] text-slate-400">Login: {loginTime}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
            
            {users.length === 0 && (
                <div className="p-4 text-center text-slate-400 text-xs italic">
                    Tidak ada data pengguna online.
                </div>
            )}
        </div>
      </div>
      
      {/* Click outside closer */}
      <div className="absolute inset-0 -z-10" onClick={onClose}></div>
    </div>
  );
};

export default OnlineUserList;