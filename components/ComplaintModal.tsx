
import React, { useState, useRef, useEffect } from 'react';
import { PurchaseRecord, SaleRecord } from '../types';
import { X, Printer, FileText, FileWarning, ArrowRight } from 'lucide-react';
import { formatDate, downloadAsPDF } from '../utils';

interface ComplaintModalProps {
  purchase: PurchaseRecord; // The parent purchase (for Plate, Supplier, etc)
  sale: SaleRecord; // The specific sale (for Mortality data)
  onClose: () => void;
}

const ComplaintModal: React.FC<ComplaintModalProps> = ({ purchase, sale, onClose }) => {
  const [step, setStep] = useState<'INPUT' | 'PREVIEW'>('INPUT');
  
  // Form State
  const [mortalityHeads, setMortalityHeads] = useState<number>(0);
  const [mortalityKg, setMortalityKg] = useState<number>(0);
  
  // Initialize with values from the Sales Record
  useEffect(() => {
    if (sale) {
        setMortalityHeads(sale.mortalityHeads || 0);
        setMortalityKg(sale.mortalityKg || 0);
    }
  }, [sale]);
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const componentRef = useRef<HTMLDivElement>(null);

  if (!purchase || !sale) return null;

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('PREVIEW');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    downloadAsPDF('complaint-letter-area', `Surat_Komplain_${purchase.supplier.replace(/\s+/g, '_')}_${formatDate(sale.date)}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-4 overflow-hidden print:p-0 print:block print:bg-white print:static">
      
      {/* --- STEP 1: INPUT DATA --- */}
      {step === 'INPUT' && (
        <div className="bg-white m-4 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
           <div className="bg-red-700 text-white p-4 flex justify-between items-center">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <FileWarning className="w-5 h-5" /> Buat Surat Komplain
                </h2>
                <button onClick={onClose}><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleNext} className="p-6 space-y-4">
                <div className="bg-slate-50 p-3 rounded border border-slate-200 text-sm">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <span className="text-slate-500 font-bold">Supplier:</span>
                        <span className="text-right font-bold">{purchase.supplier}</span>
                        <span className="text-slate-500 font-bold">Tgl DO (Beli):</span>
                        <span className="text-right font-bold">{formatDate(purchase.date)}</span>
                        <span className="text-slate-500 font-bold">Plat No:</span>
                        <span className="text-right font-bold">{purchase.plate}</span>
                        <span className="text-slate-500 font-bold">Customer:</span>
                        <span className="text-right font-bold text-blue-600">{sale.customerName}</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Jumlah Kematian (Ekor)</label>
                    <input 
                        type="number" 
                        required 
                        min="1" 
                        value={mortalityHeads} 
                        onChange={e => setMortalityHeads(parseFloat(e.target.value))}
                        className="w-full border-slate-300 rounded p-2 focus:ring-red-500 focus:border-red-500 font-mono font-bold"
                    />
                    <p className="text-xs text-slate-400 mt-1">*Otomatis diambil dari data penjualan, bisa diedit.</p>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Total Berat Mati (Kg)</label>
                    <input 
                        type="number" 
                        step="0.01" 
                        value={mortalityKg} 
                        onChange={e => setMortalityKg(parseFloat(e.target.value))}
                        className="w-full border-slate-300 rounded p-2 focus:ring-red-500 focus:border-red-500 font-mono font-bold"
                    />
                </div>

                <div className="pt-4 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-slate-600 hover:bg-slate-50">Batal</button>
                    <button type="submit" className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold flex items-center gap-2">
                        Lanjut ke Preview <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
      )}

      {/* --- STEP 2: PREVIEW LETTER --- */}
      {step === 'PREVIEW' && (
        <div className="w-full h-full flex flex-col items-center">
             {/* Floating Actions */}
             <div className="fixed top-4 right-4 flex gap-2 print:hidden z-[101]">
                <button 
                onClick={handleDownload}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs md:text-sm font-bold"
                >
                <FileText className="w-4 h-4" /> <span className="hidden md:inline">Save PDF</span>
                </button>
                <button 
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs md:text-sm font-bold"
                >
                <Printer className="w-4 h-4" /> <span className="hidden md:inline">Print</span>
                </button>
                <button 
                onClick={onClose}
                className="bg-white hover:bg-gray-100 text-gray-800 px-3 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs md:text-sm font-bold"
                >
                <X className="w-4 h-4" /> <span className="hidden md:inline">Close</span>
                </button>
            </div>

            {/* LETTER WRAPPER for Mobile Scaling */}
            <div className="w-full h-full overflow-y-auto flex justify-center pt-20 pb-10">
                <div className="relative transform origin-top scale-[0.48] sm:scale-[0.6] md:scale-100 transition-transform duration-300">
                    <div 
                        id="complaint-letter-area"
                        className="bg-white w-[210mm] min-h-[297mm] p-[20mm] shadow-2xl text-black font-serif text-[12pt] leading-relaxed print:shadow-none print:w-full print:absolute print:top-0 print:left-0"
                    >
                        {/* HEADER */}
                        <div className="flex items-center border-b-4 border-double border-black pb-4 mb-8">
                            <img src="/logo.png" alt="Logo" className="h-24 w-auto object-contain mr-6" />
                            <div className="text-center w-full">
                                <h1 className="text-2xl font-bold uppercase tracking-wide">CV. DPJ BERKAH UNGGAS</h1>
                                <p className="text-sm">Kp. Pangkalan RT. 010 RW. 004 Desa Pangkalan Kecamatan Bojong</p>
                                <p className="text-sm">Kabupaten Purwakarta</p>
                                <p className="text-sm font-bold">Telp/Hp. +62 877-6908-0999</p>
                            </div>
                        </div>

                        {/* TITLE */}
                        <div className="text-center mb-10">
                            <h2 className="text-xl font-bold uppercase underline decoration-2 underline-offset-4">SURAT KOMPLAIN</h2>
                        </div>

                        {/* RECIPIENT */}
                        <div className="mb-6">
                            <p>Kepada Yth.</p>
                            <p className="font-bold">Sales/Marketing {purchase.supplier || 'Supplier'}</p>
                            <p>Ditempat.</p>
                        </div>

                        {/* INFO BLOCK */}
                        <div className="mb-8">
                            <table className="w-full">
                                <tbody>
                                    <tr>
                                        <td className="w-32 py-1">Tanggal</td>
                                        <td className="py-1">: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric'})}</td>
                                    </tr>
                                    <tr>
                                        <td className="w-32 py-1">Dari</td>
                                        <td className="py-1">: CV. DPJ Berkah Unggas / Panji Pranantias Mulyono</td>
                                    </tr>
                                    <tr>
                                        <td className="w-32 py-1">Perihal</td>
                                        <td className="py-1">: Komplain kematian pengambilan ayam broiler</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* BODY */}
                        <div className="mb-6 text-justify">
                            <p className="mb-4">Dengan hormat,</p>
                            <p>
                                Bersama ini saya memberitahukan bahwa pengambilan ayam 1 mobil (Pickup/Truk), 
                                saya mengajukan Komplain dengan data sebagai berikut :
                            </p>
                        </div>

                        {/* DATA TABLE / LIST */}
                        <div className="mb-10 pl-4">
                            <table className="w-full">
                                <tbody>
                                    <tr>
                                        <td className="w-32 py-1 align-top">Farm / Kandang</td>
                                        <td className="py-1 align-top uppercase">: {purchase.coop || '-'}</td>
                                    </tr>
                                    <tr>
                                        <td className="w-32 py-1 align-top">No Mobil</td>
                                        <td className="py-1 align-top uppercase">
                                            : <span className="font-bold">{purchase.plate}</span>
                                            <span className="ml-2">
                                                {purchase.heads.toLocaleString()} ekor / {purchase.kg.toLocaleString()} kg
                                            </span>
                                            <br />
                                            <span className="ml-2 mt-1 inline-block">
                                                ada kematian {mortalityHeads} ekor
                                                {mortalityKg > 0 && ` / ${mortalityKg} kg`}
                                            </span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="w-32 py-1 align-top">Tanggal DO</td>
                                        <td className="py-1 align-top">: {formatDate(purchase.date)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* CLOSING */}
                        <div className="mb-10">
                            <p>Demikian surat ini saya buat.</p>
                            <p>Atas perhatian dan kebijaksanaannya saya ucapkan terima kasih.</p>
                        </div>

                        {/* SIGNATURE SECTION */}
                        <div className="flex justify-end mt-10">
                            <div className="text-center w-64 relative">
                                <p className="mb-2">Purwakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric'})}</p>
                                
                                <div className="h-28 w-full flex items-center justify-center relative my-2">
                                     {/* TANDA TANGAN IMAGE */}
                                     <img 
                                        src="/img35.jpg" 
                                        alt="Tanda Tangan Panji" 
                                        className="h-full w-auto object-contain scale-125"
                                        style={{ mixBlendMode: 'multiply' }} 
                                     />
                                </div>
                                
                                <p className="font-bold underline text-lg mt-2">( Panji Pranantias )</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default ComplaintModal;
