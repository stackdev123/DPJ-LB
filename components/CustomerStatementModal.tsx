import React, { useMemo } from 'react';
import { SaleRecord, CustomerPayment } from '../types';
import { X, Printer, ImageDown } from 'lucide-react';
import { formatDate, formatCurrency, downloadAsImage } from '../utils';

interface CustomerStatementModalProps {
  customerName: string;
  customerId?: string;
  salesData: SaleRecord[];
  globalPayments: CustomerPayment[];
  startDate?: string;
  endDate?: string;
  onClose: () => void;
}

interface StatementRow {
  id: string;
  date: string;
  type: string; // Used for styling (color)
  paymentDateDisplay: string; // New column content
  description: string;
  soldKg: number;      // New: Qty Jual
  price: number;       // New: Harga Jual
  mortalityKg: number; // New: Qty Mati
  mortality: number;   // Nilai Kematian (Rp)
  unloading: number;   // Biaya Bongkar
  bonus: number;       // Bon Sopir
  debit: number;       // Penjualan / Tagihan
  credit: number;      // Pembayaran
  balance: number;     // Running Balance
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

  // Process data into chronological statement with grouping and reversed logic
  const { statementRows, openingBalance, closingBalance, totalDebit, totalCredit, totalMortality, totalUnloading, totalBonus } = useMemo(() => {
    // 1. Collect all raw transactions
    const transactions: { 
        date: string, 
        type: 'INV' | 'PAY', 
        amount: number, 
        soldKg: number,
        price: number,
        mortalityKg: number,
        mortality: number,
        unloading: number,
        bonus: number,
        desc: string, 
        paymentDateRaw: string,
        obj: any 
    }[] = [];

    // Add Invoices
    salesData.forEach(sale => {
        const netKg = Math.max(0, sale.soldKg - sale.mortalityKg);
        const amount = netKg * sale.sellPrice;
        const mortalityVal = sale.mortalityKg * sale.sellPrice;
        
        // Filter out empty/ghost transactions
        // A valid transaction must have some financial impact OR quantity change OR expenses
        const hasFinancialImpact = amount !== 0;
        const hasQuantity = sale.soldKg !== 0 || sale.mortalityKg !== 0;
        const hasExpenses = (sale.unloadingCost || 0) !== 0 || 
                            (sale.driverBonus || 0) !== 0 || 
                            (sale.operationalCost || 0) !== 0 || 
                            (sale.truckCost || 0) !== 0;

        if (!hasFinancialImpact && !hasQuantity && !hasExpenses) {
            return; // Skip this ghost record
        }
        
        // For invoices, we use specific columns, so desc can be empty or used for extra info if needed
        const desc = ''; 

        transactions.push({
            date: sale.date,
            type: 'INV',
            amount: amount,
            soldKg: sale.soldKg,
            price: sale.sellPrice,
            mortalityKg: sale.mortalityKg,
            mortality: mortalityVal,
            unloading: sale.unloadingCost || 0,
            bonus: sale.driverBonus || 0,
            desc: desc,
            paymentDateRaw: '',
            obj: sale
        });
    });

    // Add Payments
    const relevantPayments = globalPayments.filter(p => {
        if (customerId && p.customerId) return p.customerId === customerId;
        return p.customerName === customerName;
    });

    relevantPayments.forEach(pay => {
        // Skip 0 payments if necessary, though usually 0 payment might mean something (e.g. correction). 
        // But for ledger clarity, 0 payment is useless.
        if (pay.totalPaid === 0 && !pay.notes) return;

        // Extract "Tgl Bayar: ..." from notes if present
        let displayDate = '';
        const dateMatch = pay.notes ? pay.notes.match(/\(Tgl Bayar: (.+?)\)/) : null;
        if (dateMatch && dateMatch[1]) {
            displayDate = dateMatch[1];
        }

        // Clean description: Remove the date tag if found
        let description = pay.notes || '';
        if (displayDate) {
             description = description.replace(`(Tgl Bayar: ${displayDate})`, '').trim();
        }
        if (!description) description = "Pembayaran";

        transactions.push({
            date: pay.date,
            type: 'PAY',
            amount: pay.totalPaid,
            soldKg: 0,
            price: 0,
            mortalityKg: 0,
            mortality: 0,
            unloading: pay.unloadingCost || 0,
            bonus: pay.driverBonus || 0,
            desc: description,
            paymentDateRaw: displayDate,
            obj: pay
        });
    });

    // 2. Group by Date for "Sejajar" (Inline) Logic
    const grouped = new Map<string, { invs: typeof transactions, pays: typeof transactions }>();
    
    transactions.forEach(tx => {
        if (!grouped.has(tx.date)) grouped.set(tx.date, { invs: [], pays: [] });
        const day = grouped.get(tx.date)!;
        if (tx.type === 'INV') day.invs.push(tx);
        else day.pays.push(tx);
    });

    const sortedDates = Array.from(grouped.keys()).sort();

    // 3. Iterate and Calculate
    let runningBalance = 0;
    let openBal = 0;
    let tDeb = 0;
    let tCred = 0;
    let tMortality = 0;
    let tUnloading = 0;
    let tBonus = 0;
    const finalRows: StatementRow[] = [];

    const startTs = startDate ? new Date(startDate).getTime() : 0;
    const endTs = endDate ? new Date(endDate).getTime() : Number.MAX_SAFE_INTEGER;

    sortedDates.forEach(date => {
        const day = grouped.get(date)!;
        // Zipper merge: pair invs and pays up to the max count of either to align them
        const count = Math.max(day.invs.length, day.pays.length);

        for (let i = 0; i < count; i++) {
            const inv = day.invs[i];
            const pay = day.pays[i];

            const debit = inv ? inv.amount : 0;
            const credit = pay ? pay.amount : 0;
            
            // Consolidate aux costs for display
            const rowMortality = (inv?.mortality || 0) + (pay?.mortality || 0);
            const rowUnloading = (inv?.unloading || 0) + (pay?.unloading || 0);
            const rowBonus = (inv?.bonus || 0) + (pay?.bonus || 0);
            
            // Consolidate Kg & Price
            const rowSoldKg = (inv?.soldKg || 0);
            const rowPrice = (inv?.price || 0);
            const rowMortalityKg = (inv?.mortalityKg || 0);

            // Logic: Invoice (Debit) increases debt (negative balance), Payment (Credit) decreases debt (positive impact)
            const dailyImpact = credit - debit;

            const txTs = new Date(date).getTime();

            if (txTs < startTs) {
                // Before period: update opening balance
                runningBalance += dailyImpact;
                openBal = runningBalance;
            } else if (txTs <= endTs) {
                // Within period: generate rows
                runningBalance += dailyImpact;
                tDeb += debit;
                tCred += credit;
                tMortality += rowMortality;
                tUnloading += rowUnloading;
                tBonus += rowBonus;

                // Description Logic
                // If Invoice exists, description is empty (we use columns). 
                // If Payment exists, description is the note.
                // If both, we prioritize showing the payment note, or handle via logic in render
                let description = '';
                
                if (pay) {
                    description = pay.desc; 
                }

                // Type Logic (for coloring)
                let typeLabel = '';
                if (inv) typeLabel = 'PEMBELIAN'; 
                else typeLabel = 'PEMBAYARAN';
                
                // Payment Date Display Logic
                let paymentDateDisplay = '';
                if (pay && pay.paymentDateRaw) {
                    paymentDateDisplay = pay.paymentDateRaw;
                }

                finalRows.push({
                    id: `${date}-${i}`,
                    date: date,
                    type: typeLabel,
                    paymentDateDisplay: paymentDateDisplay,
                    description: description,
                    soldKg: rowSoldKg,
                    price: rowPrice,
                    mortalityKg: rowMortalityKg,
                    mortality: rowMortality,
                    unloading: rowUnloading,
                    bonus: rowBonus,
                    debit: debit,
                    credit: credit,
                    balance: runningBalance
                });
            }
        }
    });

    return {
        statementRows: finalRows,
        openingBalance: openBal,
        closingBalance: runningBalance,
        totalDebit: tDeb,
        totalCredit: tCred,
        totalMortality: tMortality,
        totalUnloading: tUnloading,
        totalBonus: tBonus
    };

  }, [salesData, globalPayments, customerId, customerName, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadImage = () => {
      downloadAsImage('customer-statement-area', `Statement_${customerName}`);
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 backdrop-blur-sm print:bg-white print:p-0 print:static print:block">
      
      <div className="fixed top-4 right-4 flex gap-2 print:hidden z-[101]">
        <button 
          onClick={handleDownloadImage}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2 text-sm font-bold"
        >
          <ImageDown className="w-4 h-4" /> Download JPG
        </button>
        <button 
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-lg flex items-center gap-2 text-sm font-bold"
        >
          <Printer className="w-4 h-4" /> Print Statement
        </button>
        <button 
          onClick={onClose}
          className="bg-white hover:bg-gray-100 text-gray-800 px-4 py-2 rounded shadow-lg flex items-center gap-2 text-sm font-bold"
        >
          <X className="w-4 h-4" /> Close
        </button>
      </div>

      <div className="flex min-h-full items-center justify-center p-4">
        <div 
            id="customer-statement-area"
            className="bg-white w-full max-w-7xl p-6 md:p-10 shadow-2xl rounded-lg mx-auto my-8 relative print:shadow-none print:m-0 print:w-full print:max-w-none print:p-0"
        >
            
            {/* Header Section with Logo */}
            <div className="flex flex-col md:flex-row justify-between items-start border-b-2 border-slate-800 pb-6 mb-6 gap-6">
                {/* Company Branding */}
                <div className="flex items-center gap-4">
                    <img src="/logo.png" alt="Logo" className="h-16 w-auto object-contain" />
                    <div>
                        <div className="text-xl font-bold text-slate-900 uppercase tracking-tight">CV. DPJ Berkah Unggas</div>
                        <div className="text-xs text-slate-600 max-w-xs mt-1 leading-relaxed">
                            Kp. Pangkalan No. 436, Desa Pangkalan, Kec. Bojong, Kab. Purwakarta, Jawa Barat 41164
                        </div>
                    </div>
                </div>

                {/* Document Title */}
                <div className="text-left md:text-right">
                    <h1 className="text-2xl font-bold uppercase text-slate-900">PEMBELIAN DAN PEMBAYARAN</h1>
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">BUKU BESAR CUSTOMER</h2>
                </div>
            </div>

            {/* Customer Info Box */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-6 bg-slate-50 p-4 rounded border border-slate-200 print:bg-white print:border-none print:p-0 print:mb-4">
                <div>
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Customer Info:</div>
                    <div className="text-xl font-bold text-slate-900">{customerName}</div>
                    {customerId && <div className="text-xs text-slate-400 font-mono">ID: {customerId}</div>}
                </div>
                <div className="text-left md:text-right mt-4 md:mt-0">
                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Periode Transaksi:</div>
                    <div className="text-sm font-bold text-slate-700 bg-white px-3 py-1 rounded border border-slate-300 inline-block print:border-none print:p-0">
                        {startDate ? formatDate(startDate) : 'Awal'} s/d {endDate ? formatDate(endDate) : 'Sekarang'}
                    </div>
                </div>
            </div>

            {/* Summary Box */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-sm">
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                    <div className="text-slate-500 uppercase text-xs font-bold">Saldo Awal</div>
                    <div className={`font-bold ${openingBalance < 0 ? 'text-red-700' : 'text-green-700'}`}>
                         {/* Debt is Negative (Red), Deposit is Positive (Green) */}
                        {formatCurrency(openingBalance)}
                    </div>
                </div>
                <div className="bg-white p-3 rounded border border-slate-200">
                    <div className="text-slate-500 uppercase text-xs font-bold">Total Penjualan (+)</div>
                    <div className="font-bold text-slate-800">{formatCurrency(totalDebit)}</div>
                </div>
                <div className="bg-white p-3 rounded border border-slate-200">
                    <div className="text-slate-500 uppercase text-xs font-bold">Total Pembayaran (-)</div>
                    <div className="font-bold text-slate-800">{formatCurrency(totalCredit)}</div>
                </div>
                <div className={`p-3 rounded border ${closingBalance < 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="text-slate-500 uppercase text-xs font-bold">Saldo Akhir</div>
                    <div className={`font-bold ${closingBalance < 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {formatCurrency(closingBalance)}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b-2 border-slate-800 bg-slate-50">
                        <th className="py-2 text-center font-bold text-slate-600">Tanggal</th>
                        <th className="py-2 text-center font-bold text-slate-600">Qty Jual (Kg)</th>
                        <th className="py-2 text-center font-bold text-slate-600">Harga (@)</th>
                        <th className="py-2 text-center font-bold text-slate-600">Qty Mati (Kg)</th>
                        <th className="py-2 text-center font-bold text-slate-600">Nilai Mati</th>
                        <th className="py-2 text-center font-bold text-slate-600">Bongkar</th>
                        <th className="py-2 text-center font-bold text-slate-600">Bon Sopir</th>
                        <th className="py-2 text-center font-bold text-slate-600">Penjualan (Debit)</th>
                        <th className="py-2 text-center font-bold text-slate-600">Pembayaran (Credit)</th>
                        <th className="py-2 text-center font-bold text-slate-600">Tgl Bayar</th>
                        <th className="py-2 text-center font-bold text-slate-600">Saldo</th>
                    </tr>
                </thead>
                <tbody>
                    {/* Opening Balance Row */}
                    <tr className="border-b border-slate-200 bg-slate-50/50">
                        <td className="py-2 pl-2 text-slate-500 italic text-center" colSpan={7}>Saldo Awal (Balance Brought Forward)</td>
                        <td className="py-2 text-center text-slate-400">-</td>
                        <td className="py-2 text-center text-slate-400">-</td>
                        <td className="py-2 text-center text-slate-400">-</td>
                        <td className={`py-2 text-center font-bold ${openingBalance < 0 ? 'text-red-700' : 'text-slate-800'}`}>
                            {formatCurrency(openingBalance)}
                        </td>
                    </tr>

                    {/* Rows */}
                    {statementRows.map(row => (
                        <tr key={row.id} className={`border-b border-slate-100 hover:bg-slate-50 ${row.type === 'PEMBELIAN' ? '' : 'bg-green-50/10'}`}>
                            <td className="py-2 text-center text-slate-700 whitespace-nowrap">{formatDate(row.date)}</td>
                            
                            {/* Conditional Rendering for Qty Columns */}
                            {row.type === 'PEMBELIAN' ? (
                                <>
                                    <td className="py-2 text-center font-mono text-slate-800">
                                        {row.soldKg > 0 ? row.soldKg.toLocaleString() : '-'}
                                    </td>
                                    <td className="py-2 text-center font-mono text-slate-600">
                                        {row.price > 0 ? formatCurrency(row.price) : ''}
                                    </td>
                                    <td className="py-2 text-center font-mono text-red-600">
                                        {row.mortalityKg > 0 ? row.mortalityKg.toLocaleString() : '-'}
                                    </td>
                                </>
                            ) : (
                                // For Payment, merge these cells to show the description/note
                                <td colSpan={3} className="py-2 text-center text-xs italic text-slate-500 px-2">
                                    {row.description}
                                </td>
                            )}

                            <td className="py-2 text-center text-red-500 text-xs font-medium">
                                {row.mortality > 0 ? formatCurrency(row.mortality) : '-'}
                            </td>
                            <td className="py-2 text-center text-slate-500 text-xs">
                                {row.unloading > 0 ? formatCurrency(row.unloading) : '-'}
                            </td>
                            <td className="py-2 text-center text-slate-500 text-xs">
                                {row.bonus > 0 ? formatCurrency(row.bonus) : '-'}
                            </td>
                            
                            <td className="py-2 text-center font-mono text-slate-700 font-semibold">
                                {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                            </td>
                            <td className="py-2 text-center font-mono text-green-700 font-semibold">
                                {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                            </td>
                             <td className="py-2 text-center">
                                {row.paymentDateDisplay ? (
                                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded border border-green-200">
                                        {row.paymentDateDisplay}
                                    </span>
                                ) : (
                                    <span className="text-slate-300 text-center">-</span>
                                )}
                            </td>
                            <td className={`py-2 text-center font-bold font-mono ${row.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(row.balance)}
                            </td>
                        </tr>
                    ))}
                    
                    {statementRows.length === 0 && (
                        <tr>
                            <td colSpan={11} className="py-8 text-center text-slate-400 italic">
                                Tidak ada transaksi pada periode ini.
                            </td>
                        </tr>
                    )}
                </tbody>
                <tfoot className="border-t-2 border-slate-800 bg-slate-50">
                    <tr>
                        <td colSpan={4} className="py-3 text-center font-bold uppercase text-slate-700">Total Periode</td>
                        <td className="py-3 text-center font-bold text-red-500 text-xs">{formatCurrency(totalMortality)}</td>
                        <td className="py-3 text-center font-bold text-slate-500 text-xs">{formatCurrency(totalUnloading)}</td>
                        <td className="py-3 text-center font-bold text-slate-500 text-xs">{formatCurrency(totalBonus)}</td>
                        <td className="py-3 text-center font-bold text-slate-900">{formatCurrency(totalDebit)}</td>
                        <td className="py-3 text-center font-bold text-green-700">{formatCurrency(totalCredit)}</td>
                        <td className="py-3 bg-slate-100"></td>
                        <td className={`py-3 text-center font-bold font-mono ${closingBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                             {formatCurrency(closingBalance)}
                        </td>
                    </tr>
                </tfoot>
            </table>
            </div>

            {/* Footer Info */}
            <div className="mt-12 text-xs text-slate-500 text-center">
                <p>Statement ini digenerate otomatis oleh sistem AvianTrade Pro.</p>
                <p>Jika saldo MINUS (warna merah), artinya customer memiliki hutang. Saldo positif (warna hijau) berarti deposit/tabungan.</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerStatementModal;