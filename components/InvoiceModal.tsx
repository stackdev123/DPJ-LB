
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { LedgerRow } from '../types';
import { X, Printer, ImageDown } from 'lucide-react';
import { formatDate, formatCurrency, downloadAsImage } from '../utils';
import { getSales } from '../services/storageService';

interface InvoiceModalProps {
  data: LedgerRow | null; // Single invoice
  bulkData?: LedgerRow[] | null; // Multiple invoices
  onClose: () => void;
}

const InvoiceTemplate: React.FC<{ data: LedgerRow }> = ({ data }) => {
    const [invoiceInfo, setInvoiceInfo] = useState({ 
        invNumber: 'LOADING...', 
        customerAddress: '' 
    });

    useEffect(() => {
        const fetchInfo = async () => {
            try {
                const allSales = await getSales();
                const sameDaySales = allSales.filter(s => s.date === data.date);
                const index = sameDaySales.findIndex(s => s.id === data.saleId);
                const sequence = (index !== -1 ? index + 1 : 1).toString().padStart(3, '0');
                
                const dateObj = new Date(data.date);
                const day = dateObj.getDate().toString().padStart(2, '0');
                const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                const year = dateObj.getFullYear().toString().slice(-2);
                
                const specificSale = allSales.find(s => s.id === data.saleId);
                
                setInvoiceInfo({
                    invNumber: `INV/${day}${month}${year}/${sequence}`,
                    customerAddress: specificSale?.customerAddress || ''
                });
            } catch (err) {
                console.error("Error generating invoice info", err);
            }
        };
        fetchInfo();
    }, [data.date, data.saleId]);
    
    const netKg = data.soldKg - data.mortalityKg;
    const unitPrice = netKg > 0 ? data.totalSales / netKg : 0;

    return (
        <div className="bg-white w-full p-8 relative text-black font-sans text-sm flex flex-col box-border">
            {/* Header Section */}
            <div>
                <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tighter uppercase mb-2">INVOICE</h1>
                </div>
                <div className="text-right text-xs leading-relaxed">
                    <div className="font-bold text-red-600 text-lg mb-2 flex justify-end items-center gap-3">
                        {/* LOGO */}
                        <img src="logo.png" alt="Logo" className="h-10 w-auto object-contain" />
                        <span>CV. DPJ Berkah Unggas</span>
                    </div>
                    <p>Kp. Pangkalan No. 436, Desa Pangkalan, Kec.</p>
                    <p>Bojong, Kab. Purwakarta, Jawa Barat 41164</p>
                </div>
                </div>

                <div className="flex flex-col md:flex-row gap-6 mb-6">
                <div className="flex-1 border-2 border-black">
                    <div className="px-3 py-1 border-b border-black font-bold bg-gray-100 text-xs uppercase tracking-wide">
                    Alamat tagihan :
                    </div>
                    <div className="p-4 min-h-[5rem] flex flex-col justify-start items-start">
                        <div className="font-bold text-lg uppercase mb-1">{data.customer}</div>
                        {invoiceInfo.customerAddress && (
                            <div className="text-sm text-gray-600">{invoiceInfo.customerAddress}</div>
                        )}
                    </div>
                </div>

                <div className="w-full md:w-[45%] border-2 border-black grid grid-cols-2 text-center">
                    <div className="border-b border-r border-black p-1 bg-gray-100 font-bold text-xs uppercase">Nomor Inv</div>
                    <div className="border-b border-black p-1 bg-gray-100 font-bold text-xs uppercase">Tanggal</div>
                    
                    <div className="border-b border-r border-black p-2 text-sm font-mono flex items-center justify-center font-bold bg-yellow-50">{invoiceInfo.invNumber}</div>
                    <div className="border-b border-black p-2 text-sm font-medium flex items-center justify-center">{formatDate(data.date)}</div>

                    <div className="border-b border-r border-black p-1 bg-gray-100 font-bold text-xs uppercase">Plat Nomor</div>
                    <div className="border-b border-black p-1 bg-gray-100 font-bold text-xs uppercase">Supir</div>

                    <div className="border-r border-black p-2 font-bold uppercase flex items-center justify-center">{data.plate}</div>
                    <div className="p-2 font-bold uppercase flex items-center justify-center">{data.driver}</div>
                </div>
                </div>

                {/* Table Section */}
                <div className="border-2 border-black mb-6">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="bg-gray-100">
                        <th className="border-b border-r border-black p-2 w-10 text-center font-bold">No</th>
                        <th className="border-b border-r border-black p-2 text-left font-bold">Item</th>
                        <th className="border-b border-r border-black p-2 w-20 text-center font-bold">Ekor</th>
                        <th className="border-b border-r border-black p-2 w-24 text-center font-bold">Kg</th>
                        <th className="border-b border-r border-black p-2 w-28 text-right font-bold">Harga</th>
                        <th className="border-b border-black p-2 w-36 text-right font-bold">Total</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                        <td className="border-r border-black p-3 text-center align-top min-h-[120px]">1</td>
                        <td className="border-r border-black p-3 align-top min-h-[120px] font-medium">AYAM BROILER LIVE BIRDS</td>
                        <td className="border-r border-black p-3 text-center align-top min-h-[120px]">
                            <div className="mb-1">{data.soldHeads}</div>
                            {data.mortalityHeads > 0 && (
                                <div className="text-red-600 text-[10px] italic">
                                    -{data.mortalityHeads} Mati
                                </div>
                            )}
                        </td>
                        <td className="border-r border-black p-3 text-center align-top min-h-[120px]">
                            <div className="mb-1">{data.soldKg.toLocaleString('id-ID')}</div>
                            {data.mortalityKg > 0 && (
                                <div className="text-red-600 text-[10px] italic mb-1">
                                    -{data.mortalityKg.toLocaleString('id-ID')} Mati
                                </div>
                            )}
                            <div className="border-t border-dotted border-gray-400 mt-1 pt-1 font-bold">
                                {netKg.toLocaleString('id-ID', { minimumFractionDigits: 2 })} Net
                            </div>
                        </td>
                        <td className="border-r border-black p-3 text-right align-top min-h-[120px] font-mono">
                            {formatCurrency(unitPrice)}
                        </td>
                        <td className="p-3 text-right align-top min-h-[120px] font-bold font-mono text-base">
                            {formatCurrency(data.totalSales)}
                        </td>
                    </tr>
                    </tbody>
                </table>
                </div>
            </div>

            {/* Footer Section */}
            <div className="mt-auto">
                <div className="flex flex-col md:flex-row justify-between items-end mt-2 gap-6">
                    {/* Payment Info */}
                    <div className="text-xs text-slate-700 w-full md:w-[55%] bg-white p-3 rounded border-2 border-slate-800">
                        <div className="font-bold mb-1 uppercase tracking-wide border-b border-slate-300 pb-1">Info Pembayaran (Transfer Via) :</div>
                        <div className="flex justify-between mb-1">
                            <span>BCA</span>
                            <span className="font-mono font-bold">7410888879</span>
                            <span>A/N Panji Paranantias Mulyono</span>
                        </div>
                        <div className="flex justify-between">
                            <span>BRI</span>
                            <span className="font-mono font-bold">007501001986565</span>
                            <span>A/N Panji Paranantias Mulyono</span>
                        </div>
                    </div>
                    
                    {/* Grand Total */}
                    <div className="w-full md:w-[40%]">
                        <div className="flex justify-between items-center mb-1 text-sm">
                            <span className="font-bold text-gray-600">Grand Total :</span>
                            <span className="font-bold border-b border-black min-w-[100px] text-right text-base">{formatCurrency(data.totalSales)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center mb-1 text-xs text-green-700">
                            <span className="font-medium">Pembayaran / DP :</span>
                            <span className="text-right font-mono">({formatCurrency(data.totalPaid)})</span>
                        </div>
                        
                        <div className={`flex justify-between items-center mt-2 text-sm font-bold bg-gray-100 p-2 border border-black ${data.remainingBalance < 0 ? 'text-green-700' : ''}`}>
                            <span className="uppercase">{data.remainingBalance < 0 ? 'Deposit :' : 'Sisa Tagihan :'}</span>
                            <span className={`text-right ${data.remainingBalance < 0 ? 'text-green-700' : 'text-red-600'}`}>
                                {data.remainingBalance < 0 ? `+${formatCurrency(Math.abs(data.remainingBalance))}` : formatCurrency(data.remainingBalance)}
                            </span>
                        </div>
                    </div>
                </div>
                
                {/* Signatures */}
                <div className="mt-8 flex justify-between text-xs text-center px-6 pb-2">
                    <div>
                        <div className="mb-12 font-bold">Penerima / Customer</div>
                        <div className="border-t border-black w-32 mx-auto pt-1">( ............................ )</div>
                    </div>
                    <div>
                        <div className="mb-12 font-bold">Hormat Kami,</div>
                        <div className="border-t border-black w-32 mx-auto pt-1">Admin CV. DPJ</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ data, bulkData, onClose }) => {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  }

  const handleDownloadImage = () => {
      downloadAsImage('invoice-print-area', `Invoice_${data ? data.customer : 'Bulk'}`);
  }

  if (!data && (!bulkData || bulkData.length === 0)) return null;
  const itemsToRender = bulkData && bulkData.length > 0 ? bulkData : (data ? [data] : []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm overflow-y-auto print:bg-white print:p-0 print:static print:block">
      
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-[10000]">
        <button 
          onClick={handleDownloadImage}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full font-semibold flex items-center gap-2 shadow-xl"
        >
          <ImageDown className="w-5 h-5" /> Download JPG
        </button>
        <button 
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full font-semibold flex items-center gap-2 shadow-xl transition-transform transform hover:scale-105"
        >
          <Printer className="w-5 h-5" /> Print / PDF
        </button>
        <button 
          onClick={onClose}
          className="bg-white hover:bg-slate-100 text-slate-800 px-4 py-2 rounded-full font-semibold shadow-xl flex items-center gap-2 transition-transform transform hover:scale-105"
        >
          <X className="w-5 h-5" /> Close Preview
        </button>
      </div>

      <div 
        id="invoice-print-area"
        ref={componentRef}
        className={`bg-white shadow-2xl origin-top print:shadow-none print:w-full print:absolute print:top-0 print:left-0 mx-auto
        ${itemsToRender.length > 1 ? 'w-[210mm] min-h-screen my-10' : 'w-[210mm] p-0 mt-10'}`}
      >
          {itemsToRender.map((item, index) => (
              <div key={item.saleId} className="print:break-inside-avoid print:break-after-auto min-h-[140mm] border-b-2 border-dashed border-gray-300 print:border-none relative bg-white">
                  <InvoiceTemplate data={item} />
                  {index < itemsToRender.length - 1 && (
                      <div className="print:hidden h-4 bg-gray-200 w-full"></div>
                  )}
              </div>
          ))}
      </div>
    </div>
  );
};

export default InvoiceModal;
