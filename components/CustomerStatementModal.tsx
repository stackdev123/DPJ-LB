import React, { useMemo } from 'react';
import { SaleRecord, CustomerPayment } from '../types';
import { X, Printer, ImageDown } from 'lucide-react';
import { formatDate, formatCurrency, downloadAsImage } from '../utils';

interface CustomerStatementModalProps {
  customerName: string;
  customerId?: string;
  salesData: SaleRecord[];
  globalPayments: CustomerPayment[];
  startDate: string;
  endDate: string;
  onClose: () => void;
}

const CustomerStatementModal: React.FC<CustomerStatementModalProps> = ({
  customerName,
  customerId,
  salesData,
  globalPayments,
  startDate,
  endDate,
  onClose
}) => {
  // Logic to process data
  const { rows, openingBalance, closingBalance, totalDebit, totalCredit, totalDriverBonus } = useMemo(() => {
    // Filter payments for this customer
    const payments = globalPayments.filter(p => {
        if (customerId && p.customerId) return p.customerId === customerId;
        return p.customerName === customerName;
    });

    const txs: Array<{
        id: string;
        date: string;
        type: 'SALE' | 'PAYMENT';
        description: React.ReactNode;
        price?: number;
        debit: number; // Sale (Increase Debt)
        bonSopir: number; // Driver Bonus (Deduction/Credit)
        credit: number; // Payment (Decrease Debt)
        paymentDate: string;
    }> = [];

    // Add Sales (Debit)
    salesData.forEach(s => {
        const netKg = Math.max(0, s.soldKg - s.mortalityKg);
        const amount = Math.round(netKg * s.sellPrice);
        
        const soldStr = `${s.soldKg.toLocaleString('id-ID')} Kg`;
        const mortVal = Math.round(s.mortalityKg * s.sellPrice); // Nilai Kematian (Rp)
        
        let desc: React.ReactNode = (
            <div className="flex flex-col py-0.5">
                <span className="font-semibold text-slate-800">{soldStr}</span>
                {s.mortalityKg > 0 && (
                    <div className="flex flex-wrap gap-x-2 text-[9px] leading-tight text-slate-500 mt-0.5">
                        <span className="text-red-600 font-medium">Mati: {s.mortalityKg.toLocaleString('id-ID')} Kg ({formatCurrency(mortVal)})</span>
                    </div>
                )}
            </div>
        );

        txs.push({
            id: s.id,
            date: s.date,
            type: 'SALE',
            description: desc,
            price: s.sellPrice,
            debit: amount,
            bonSopir: s.driverBonus || 0,
            credit: 0,
            paymentDate: '-'
        });
    });

    // Add Payments (Credit)
    payments.forEach(p => {
        const methods = [];
        if ((p.transferAmount || 0) > 0) methods.push('TF');
        if ((p.cashAmount || 0) > 0) methods.push('CASH');
        const totalDeductions = (p.unloadingCost || 0) + (p.driverBonus || 0) + (p.otherCost || 0);
        if (totalDeductions > 0) methods.push('POT');

        const methodStr = methods.length > 0 ? methods.join('+') : 'Global';

        let displayPayDate = formatDate(p.date);
        if (p.notes) {
            const match = p.notes.match(/\(Tgl Bayar: (.+?)\)/);
            if (match && match[1]) {
                displayPayDate = match[1];
            }
        }

        let desc: React.ReactNode = (
            <div className="flex flex-col py-0.5">
                <span className="font-medium text-slate-800">Bayar: {methodStr}</span>
            </div>
        );

        txs.push({
            id: p.id,
            date: p.date,
            type: 'PAYMENT',
            description: desc,
            debit: 0,
            bonSopir: p.driverBonus || 0,
            // Credit is total minus driver bonus to avoid double counting in the columns
            credit: Math.round(p.totalPaid - (p.driverBonus || 0)),
            paymentDate: displayPayDate
        });
    });

    txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    let openBal = 0;
    let tDebit = 0;
    let tCredit = 0;
    let tBon = 0;

    const startTs = startDate ? new Date(startDate).getTime() : 0;
    const endTs = endDate ? new Date(endDate).getTime() : Number.MAX_SAFE_INTEGER;

    const finalRows: Array<typeof txs[0] & { balance: number }> = [];

    txs.forEach(tx => {
        const txTs = new Date(tx.date).getTime();
        // Saldo dikurangi bayar DAN dikurangi bon sopir
        const netChange = tx.debit - tx.bonSopir - tx.credit;

        if (txTs < startTs) {
            openBal = Math.round(openBal + netChange);
            runningBalance = openBal;
        } else if (txTs <= endTs) {
            runningBalance = Math.round(runningBalance + netChange);
            tDebit += tx.debit;
            tCredit += tx.credit;
            tBon += tx.bonSopir;
            finalRows.push({ ...tx, balance: runningBalance });
        }
    });

    return { 
        rows: finalRows, 
        openingBalance: openBal, 
        closingBalance: runningBalance, 
        totalDebit: tDebit, 
        totalCredit: tCredit,
        totalDriverBonus: tBon
    };
  }, [salesData, globalPayments, customerId, customerName, startDate, endDate]);

  const handlePrint = () => window.print();
  const handleDownload = () => downloadAsImage('customer-statement-area', `Kartu_Piutang_${customerName}`);

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 backdrop-blur-sm print:bg-white print:p-0 print:static print:block">
        <div className="fixed top-4 right-4 flex gap-2 print:hidden z-[101]">
            <button onClick={handleDownload} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2 text-sm font-bold">
                <ImageDown className="w-4 h-4" /> Save JPG
            </button>
            <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2 text-sm font-bold">
                <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="bg-white hover:bg-gray-100 text-gray-800 px-4 py-2 rounded shadow-lg flex items-center gap-2 text-sm font-bold">
                <X className="w-4 h-4" /> Close
            </button>
        </div>

        <div className="flex min-h-full items-center justify-center p-2 md:p-4">
            <div id="customer-statement-area" className="bg-white w-full max-w-6xl p-4 md:p-8 shadow-2xl rounded-lg mx-auto my-4 relative print:shadow-none print:m-0 print:w-full print:max-w-none print:p-0">
                 <div className="mb-4 pb-4 border-b-2 border-slate-800">
                    <div className="flex justify-between items-start">
                        <div className="flex gap-4 items-center">
                            <img src="logo.png" alt="Logo" className="h-12 md:h-16 w-auto object-contain" />
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold uppercase text-slate-800">KARTU PIUTANG CUSTOMER</h1>
                                <div className="text-[10px] md:text-xs text-slate-500 mt-1">CV. DPJ Berkah Unggas</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-end mb-4 bg-slate-50 p-3 rounded border border-slate-200 print:bg-white print:border-none print:p-0 print:mb-4">
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Customer Info:</div>
                        <div className="text-lg font-bold text-slate-900">{customerName}</div>
                    </div>
                    <div className="text-left md:text-right mt-2 md:mt-0">
                        <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Periode Transaksi:</div>
                        <div className="text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded border border-slate-300 inline-block print:border-none print:p-0">
                            {startDate ? formatDate(startDate) : 'Awal'} s/d {endDate ? formatDate(endDate) : 'Sekarang'}
                        </div>
                    </div>
                </div>

                <div className="mb-4 p-2 rounded border border-slate-200 bg-slate-50 print:bg-white print:border-black">
                    <div className="text-[9px] font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">
                        Info Rekening Pembayaran <span className="font-normal normal-case">(A/N Panji Paranantias Mulyono) :</span>
                    </div>
                    <div className="flex flex-col md:flex-row gap-x-6 gap-y-1 text-[10px]">
                        <div className="flex items-center gap-2"><span className="font-bold text-slate-700 w-10">BCA</span><span className="font-mono font-bold text-slate-900 text-xs tracking-wide">7410888879</span></div>
                        <div className="flex items-center gap-2"><span className="font-bold text-slate-700 w-10">BRI</span><span className="font-mono font-bold text-slate-900 text-xs tracking-wide">007501001986565</span></div>
                        <div className="flex items-center gap-2"><span className="font-bold text-slate-700 w-14">MANDIRI</span><span className="font-mono font-bold text-slate-900 text-xs tracking-wide">1730081188881</span></div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 text-xs">
                    <div className="p-2 bg-slate-50 rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Saldo Awal</div>
                        <div className={`font-bold ${openingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(openingBalance)}</div>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Penjualan (Debit)</div>
                        <div className="font-bold text-slate-800">{formatCurrency(totalDebit)}</div>
                    </div>
                    <div className="p-2 bg-white rounded border border-slate-200">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Pembayaran + Bon (Credit)</div>
                        <div className="font-bold text-green-700">{formatCurrency(totalCredit + totalDriverBonus)}</div>
                    </div>
                    <div className="p-2 bg-indigo-50 rounded border border-indigo-200">
                        <div className="text-[10px] text-indigo-800 uppercase font-bold">Sisa Piutang Akhir</div>
                        <div className={`text-base font-bold ${closingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(closingBalance)}</div>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-200 print:border-black">
                    <table className="w-full text-[10px] md:text-xs text-left">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase print:bg-slate-200 print:text-black">
                            <tr>
                                <th className="p-1 md:p-2 border-b text-center whitespace-nowrap w-20">Tanggal</th>
                                <th className="p-1 md:p-2 border-b whitespace-nowrap min-w-[120px]">Keterangan</th>
                                <th className="p-1 md:p-2 border-b text-right whitespace-nowrap">Harga</th>
                                <th className="p-1 md:p-2 border-b text-right whitespace-nowrap">Tagihan</th>
                                <th className="p-1 md:p-2 border-b text-right whitespace-nowrap text-blue-700">Bon Sopir</th>
                                <th className="p-1 md:p-2 border-b text-right whitespace-nowrap">Bayar</th>
                                <th className="p-1 md:p-2 border-b text-center whitespace-nowrap w-20">Tgl Bayar</th>
                                <th className="p-1 md:p-2 border-b text-right bg-slate-200 print:bg-slate-300 whitespace-nowrap font-bold">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="bg-slate-50 italic text-slate-500">
                                <td className="p-1 md:p-2 text-center whitespace-nowrap" colSpan={2}>Saldo Awal</td>
                                <td className="p-1 md:p-2 text-center">-</td>
                                <td className="p-1 md:p-2 text-center">-</td>
                                <td className="p-1 md:p-2 text-center">-</td>
                                <td className="p-1 md:p-2 text-center">-</td>
                                <td className="p-1 md:p-2 text-center">-</td>
                                <td className={`p-1 md:p-2 text-right font-mono font-bold whitespace-nowrap ${openingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(openingBalance)}</td>
                            </tr>
                            
                            {rows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 border-b border-slate-100">
                                    <td className="p-1 md:p-2 whitespace-nowrap text-center text-[10px] md:text-xs">{formatDate(row.date)}</td>
                                    <td className="p-1 md:p-2 min-w-[120px]">{row.description}</td>
                                    <td className="p-1 md:p-2 text-right font-mono text-slate-600 whitespace-nowrap">{row.price ? formatCurrency(row.price) : '-'}</td>
                                    <td className="p-1 md:p-2 text-right font-mono text-slate-700 whitespace-nowrap">{row.debit > 0 ? formatCurrency(row.debit) : '-'}</td>
                                    <td className="p-1 md:p-2 text-right font-mono text-blue-700 font-bold whitespace-nowrap">{row.bonSopir > 0 ? formatCurrency(row.bonSopir) : '-'}</td>
                                    <td className="p-1 md:p-2 text-right font-mono text-green-700 font-semibold whitespace-nowrap">{row.credit > 0 ? formatCurrency(row.credit) : '-'}</td>
                                    <td className="p-1 md:p-2 text-center text-slate-500">{row.paymentDate}</td>
                                    <td className={`p-1 md:p-2 text-right font-mono font-bold bg-slate-50/50 whitespace-nowrap ${row.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(row.balance)}</td>
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr><td colSpan={8} className="p-6 text-center text-slate-400 italic">Tidak ada transaksi pada periode ini.</td></tr>
                            )}
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                            <tr>
                                <td colSpan={2} className="p-1 md:p-2 text-right uppercase text-[10px] text-slate-500 whitespace-nowrap">Total Periode</td>
                                <td></td>
                                <td className="p-1 md:p-2 text-right font-mono whitespace-nowrap">{formatCurrency(totalDebit)}</td>
                                <td className="p-1 md:p-2 text-right font-mono text-blue-700 whitespace-nowrap">{formatCurrency(totalDriverBonus)}</td>
                                <td className="p-1 md:p-2 text-right font-mono text-green-700 whitespace-nowrap">{formatCurrency(totalCredit)}</td>
                                <td></td>
                                <td className={`p-1 md:p-2 text-right font-mono whitespace-nowrap ${closingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(closingBalance)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    </div>
  );
};

export default CustomerStatementModal;