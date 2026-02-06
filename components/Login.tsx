
import React, { useState } from 'react';
import { login } from '../services/authService';
import { User } from '../types';
import { Loader2, Lock, User as UserIcon, ShieldCheck, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await login(username, password);
      if (user) {
        onLogin(user);
      } else {
        setError('Username atau password salah');
      }
    } catch (e) {
      setError('Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      
      {/* Ambient Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-600/10 rounded-full blur-[120px] animate-pulse delay-700"></div>
      </div>

      <div className="w-full max-w-md animate-in zoom-in-95 duration-700 relative z-10">
        
        {/* Card Container */}
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/20 ring-1 ring-white/50">
          
          {/* Header / Brand Area */}
          <div className="bg-gradient-to-b from-slate-50 to-white p-8 pb-6 text-center border-b border-slate-100 relative overflow-hidden">
            {/* Logo Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-red-500/10 rounded-full blur-2xl -z-10"></div>
            
            <div className="relative inline-block group cursor-default">
                <div className="absolute inset-0 bg-red-500 blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-700 rounded-full"></div>
                <img 
                    src="logo.png" 
                    alt="Logo CV DPJ" 
                    className="w-29 h-29 mx-auto object-contain relative z-10 drop-shadow-xl transform transition-transform group-hover:scale-105 duration-500" 
                />
            </div>
            
           
          </div>

          <div className="p-8 pt-6">
            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm font-semibold rounded-xl border border-red-100 flex items-center gap-3 animate-in slide-in-from-top-2 shadow-sm">
                <div className="bg-red-100 p-1.5 rounded-full shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                </div>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 tracking-wider">Username</label>
                <div className="relative group">
                  <div className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-red-500 transition-colors duration-300">
                    <UserIcon className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all duration-300 font-medium text-slate-800 placeholder:text-slate-400 shadow-sm"
                    placeholder="Masukkan ID Pengguna"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 tracking-wider">Password</label>
                <div className="relative group">
                  <div className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-red-500 transition-colors duration-300">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all duration-300 font-medium text-slate-800 placeholder:text-slate-400 shadow-sm"
                    placeholder="Masukkan Kata Sandi"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                    title={showPassword ? "Sembunyikan password" : "Lihat password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-red-500/30 transition-all duration-300 transform active:scale-[0.98] flex items-center justify-center gap-2 mt-6"
              >
                {loading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Memverifikasi...</span>
                    </>
                ) : (
                    'Masuk Aplikasi'
                )}
              </button>
            </form>
          </div>
          
          <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              &copy; {new Date().getFullYear()} DPJ LB System. <br/>
              <span className="opacity-70">Secure Access Authorized Personnel Only.</span>
            </p>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default Login;
