
import React, { useState } from 'react';
import { Loader2, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { verifyPassword } from '../services/authService';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title: string;
  message: string;
  username: string; // Needed to verify password
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  username
}) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Verify Password
      const isValid = await verifyPassword(username, password);
      
      if (isValid) {
        // 2. Perform Action
        await onConfirm();
        onClose();
      } else {
        setError('Password salah. Autorisasi gagal.');
      }
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan saat verifikasi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="bg-red-50 p-6 flex flex-col items-center text-center border-b border-red-100">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3 text-red-600">
                <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-red-900">{title}</h3>
            <p className="text-sm text-red-700 mt-2">{message}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="bg-slate-50 p-3 rounded border border-slate-200 text-sm text-slate-600">
                <p className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    Tindakan ini <b>permanen</b> dan tidak bisa dibatalkan.
                </p>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Konfirmasi Password Super Admin</label>
                <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border-slate-300 rounded-md p-2.5 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                    placeholder="Masukkan password Anda..."
                    autoFocus
                    required
                />
                {error && <p className="text-xs text-red-600 mt-1 font-bold">{error}</p>}
            </div>

            <div className="flex gap-3 pt-2">
                <button 
                    type="button" 
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                    disabled={loading}
                >
                    Batal
                </button>
                <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                    disabled={loading}
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hapus Data'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
