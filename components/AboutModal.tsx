
import React from 'react';
import { X, Info, CheckCircle2 } from 'lucide-react';

interface AboutModalProps {
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  const appVersion = "1.9.0";
  const lastUpdate = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const changelogs = [
    {
        version: "1.9.0",
        date: "Pagination, Filter & Ledger UI Update",
        features: [
            "Kartu Piutang: Optimasi tampilan tabel menjadi lebih ringkas (Compact Mode) dan penandaan warna merah untuk stok mati.",
            "Advanced Filter: Penambahan filter tanggal (Date Range) dan pencarian spesifik pada Riwayat Pembelian & Penjualan.",
            "Pagination System: Implementasi paging (50 data per halaman) untuk performa lebih ringan saat data menumpuk.",
            "Layout Optimization: Memaksimalkan area tabel untuk tampilan desktop yang lebih luas dan nyaman.",
            "Bug Fixes: Perbaikan error saat fetch data penjualan dan pembelian."
        ]
    },
    {
        version: "1.8.0",
        date: "Visual Upgrade & Logic Fix",
        features: [
            "Visual Update: Tampilan Tabel Riwayat Pembelian & Penjualan lebih berwarna dan mudah dibaca (Color-coded Headers).",
            "Bug Fix: Perbaikan logika perhitungan Net Profit pada Dashboard (Menggunakan HPP/COGS vs Cash Flow).",
            "Dashboard: Kartu 'Net Profit' sekarang menampilkan detail HPP (Harga Pokok Penjualan) saat diklik.",
            "Improvement: Penambahan informasi visual pada header tabel untuk kolom 'Total Tagihan' dan 'Total Invoice'.",
            "UI/UX Fix: Konsistensi warna pada tombol aksi dan layout tabel."
        ]
    },
    {
        version: "1.7.0",
        date: "Smart Sync & Optimization",
        features: [
            "Smart Realtime Sync: Sinkronisasi data cerdas yang hanya memuat ulang tabel yang berubah.",
            "Anti-Looping: Mencegah refresh berulang-ulang saat koneksi tidak stabil.",
            "Database Indexing Support: Penambahan script index untuk mempercepat query.",
            "Performance: Loading aplikasi lebih cepat dan hemat bandwidth."
        ]
    },
    {
        version: "1.6.0",
        date: "Performance & Efficiency Update",
        features: [
            "Performance: Implementasi Server-Side Pagination.",
            "Efficiency: Optimasi Query Database.",
            "Realtime: Sinkronisasi data otomatis.",
            "UI/UX: Perbaikan tata letak Dashboard dan Login."
        ]
    }
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
        >
            <X className="w-6 h-6" />
        </button>

        <div className="p-8 text-center bg-slate-50 border-b border-slate-100">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-sm border border-slate-200 mx-auto mb-4 flex items-center justify-center p-2">
                <img src="logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-800">CV DPJ Berkah Unggas</h2>
            <div className="flex justify-center items-center gap-2 mt-2">
                <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-full border border-primary/20">
                    v{appVersion}
                </span>
                <span className="text-xs text-slate-400">Updated: {lastUpdate}</span>
            </div>
            <p className="text-slate-500 text-sm mt-3 leading-relaxed">
                Sistem Manajemen Trading Ayam Broiler Terintegrasi.
                Mencakup Pembelian, Distribusi, Invoicing, Hutang/Piutang, Audit Log, dan Laporan Keuangan.
            </p>
        </div>

        <div className="p-6 h-[300px] overflow-y-auto custom-scrollbar bg-white">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Info className="w-4 h-4" /> Riwayat Perubahan
            </h3>

            <div className="space-y-6">
                {changelogs.map((log, idx) => (
                    <div key={idx} className="relative pl-4 border-l-2 border-slate-100">
                        <div className={`absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full ${idx === 0 ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                        <div className="flex justify-between items-start mb-2">
                            <span className={`font-bold text-sm ${idx === 0 ? 'text-green-700' : 'text-slate-700'}`}>Versi {log.version}</span>
                            <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded">{log.date}</span>
                        </div>
                        <ul className="space-y-2">
                            {log.features.map((feat, fIdx) => (
                                <li key={fIdx} className="text-xs text-slate-600 flex items-start gap-2">
                                    <CheckCircle2 className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                                    {feat}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400">
                &copy; {new Date().getFullYear()} CV DPJ Berkah Unggas. All rights reserved.
            </p>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
