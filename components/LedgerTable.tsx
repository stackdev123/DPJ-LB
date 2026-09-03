import React, { useState, useMemo } from 'react';
import { LedgerRow, CustomerPayment } from '../types';
import { Printer, Filter, FileText, Files, Wallet, BookOpen, ChevronRight, ArrowLeft, Users, Edit, ImageDown, Download } from 'lucide-react';
import { formatDate, formatCurrency, downloadAsImage, downloadAsExcel, downloadMultiSheetExcel } from '../utils';

interface LedgerTableProps {
    data: LedgerRow[];
    payments: CustomerPayment[];
    onViewPayment: (saleId: string) => void;
    onPrintInvoice: (row: LedgerRow) => void;
    onPrintBulkInvoices: (rows: LedgerRow[]) => void;
    onShowCustomerStatement: (customerName: string, customerId: string, startDate: string, endDate: string) => void;
    onEditSale: (saleId: string) => void;
    isLoading?: boolean;
}

const LedgerTable: React.FC<LedgerTableProps> = ({
    data,
    payments,
    onViewPayment,
    onPrintInvoice,
    onPrintBulkInvoices,
    onShowCustomerStatement,
    onEditSale,
    isLoading
}) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState('ALL');

    const uniqueCustomers = useMemo(() => {
        const map = new Map();
        data.forEach(d => {
            const key = d.customerId || d.customer;
            if (!map.has(key)) map.set(key, { id: d.customerId, name: d.customer });
        });
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [data]);

    const filteredData = useMemo(() => {
        return data.filter(row => {
            const rowDate = new Date(row.date);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            const matchCustomer = selectedCustomer === 'ALL' || (row.customerId === selectedCustomer) || (row.customer === selectedCustomer);
            const matchStart = !start || rowDate >= start;
            const matchEnd = !end || rowDate <= end;
            return matchCustomer && matchStart && matchEnd;
        });
    }, [data, startDate, endDate, selectedCustomer]);

    const customerSummary = useMemo(() => {
        let targetCustomers = uniqueCustomers;
        if (selectedCustomer !== 'ALL') {
            targetCustomers = uniqueCustomers.filter(c => (c.id === selectedCustomer) || (c.name === selectedCustomer));
        }

        return targetCustomers.map(cust => {
            const isMatch = (item: { customerId?: string, customer?: string, customerName?: string }) => {
                if (cust.id && item.customerId) return item.customerId === cust.id;
                const itemName = item.customer || item.customerName;
                return itemName === cust.name;
            };

            const allCustomerSales = data.filter(r => isMatch(r));
            const allCustomerPayments = payments.filter(p => isMatch(p));

            const absoluteDebt = allCustomerSales.reduce((a, b) => a + b.totalSales, 0);
            const absolutePaid = allCustomerPayments.reduce((a, b) => a + b.totalPaid, 0);
            const absoluteBalance = absoluteDebt - absolutePaid;

            const filteredRows = filteredData.filter(r => isMatch(r));
            const periodSales = filteredRows.reduce((a, b) => a + b.totalSales, 0);

            return {
                id: cust.id,
                customer: cust.name,
                totalKg: filteredRows.reduce((a, b) => a + b.soldKg, 0),
                periodSales: periodSales,
                totalPaid: absolutePaid,
                remainingBalance: absoluteBalance,
                transactionCount: filteredRows.length
            };
        }).sort((a, b) => b.remainingBalance - a.remainingBalance);
    }, [filteredData, selectedCustomer, data, payments, uniqueCustomers]);

    const totalSales = customerSummary.reduce((acc, row) => acc + row.periodSales, 0);
    const totalReceivable = customerSummary.reduce((acc, row) => acc + row.remainingBalance, 0);
    const totalMortalityVal = filteredData.reduce((acc, row) => acc + row.mortalityValue, 0);

    const handlePrintRecap = () => window.print();

    // Menggunakan ID baru 'ledger-capture-area' agar hasil download selalu tabel (PC view)
    const handleDownloadImage = () => {
        // Memberikan sedikit waktu render ulang jika diperlukan sebelum capture
        setTimeout(() => {
            downloadAsImage('ledger-capture-area', `Ledger_Recap_${selectedCustomer}`);
        }, 100);
    };

    const handleDownloadExcel = () => {
        const dataForExcel = customerSummary.map(row => ({
            'Customer Name': row.customer,
            'Total Transaksi': row.transactionCount,
            'Sales (Periode)': row.periodSales,
            'Total Tagihan': row.remainingBalance + row.totalPaid,
            'Total Bayar': row.totalPaid,
            'Sisa / Balance': row.remainingBalance
        }));
        downloadAsExcel(dataForExcel, `Ledger_Piutang_${selectedCustomer}`);
    };

    const handleDownloadDetailExcel = (customerId: string, customerName: string) => {
        const isMatch = (item: { customerId?: string, customer?: string, customerName?: string }) => {
            if (customerId && item.customerId) return item.customerId === customerId;
            const itemName = item.customer || item.customerName;
            return itemName === customerName;
        };

        // Filter berdasarkan rentang tanggal yang aktif
        const filterByDate = (itemDate: string) => {
            const d = new Date(itemDate);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            if (start && d < start) return false;
            if (end && d > end) return false;
            return true;
        };

        const customerSales = data.filter(r => isMatch(r) && filterByDate(r.date));
        const customerPaymentsList = payments.filter(p => isMatch(p) && filterByDate(p.date));

        // Label periode untuk nama file & header
        const periodLabel = startDate || endDate
            ? `${startDate || 'Awal'}_sd_${endDate || 'Sekarang'}`
            : 'Semua_Periode';

        // 1. Prepare Kartu Piutang Data
        const txs: Array<{
            date: string;
            type: 'SALE' | 'PAYMENT';
            description: string;
            price: number;
            bonSopir: number;
            debit: number;
            credit: number;
            paymentDate: string;
        }> = [];

        customerSales.forEach(s => {
            const netKg = Math.max(0, (s.soldKg || 0) - (s.mortalityKg || 0));
            const amount = Math.round(netKg * (s.sellPrice || 0));
            txs.push({
                date: s.date,
                type: 'SALE',
                description: `${(s.soldKg || 0).toLocaleString('id-ID')} Kg${(s.mortalityKg || 0) > 0 ? ` (Mati: ${s.mortalityKg} Kg)` : ''}`,
                price: s.sellPrice || 0,
                bonSopir: s.driverBonus || 0,
                debit: amount,
                credit: 0,
                paymentDate: '-'
            });
        });

        customerPaymentsList.forEach(p => {
            const methods = [];
            if ((p.transferAmount || 0) > 0) methods.push('TF');
            if ((p.cashAmount || 0) > 0) methods.push('CASH');
            const totalDeductions = (p.unloadingCost || 0) + (p.driverBonus || 0) + (p.otherCost || 0);
            if (totalDeductions > 0) methods.push('POT');
            const methodStr = methods.length > 0 ? methods.join('+') : 'Global';

            txs.push({
                date: p.date,
                type: 'PAYMENT',
                description: `Bayar: ${methodStr}`,
                price: 0,
                bonSopir: p.driverBonus || 0,
                debit: 0,
                credit: Math.round((p.totalPaid || 0) - (p.driverBonus || 0)),
                paymentDate: formatDate(p.date)
            });
        });

        txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // --- Hitung Saldo Awal (Opening Balance) ---
        // Ambil semua transaksi customer SEBELUM startDate (hanya jika ada filter startDate)
        let openingBalance = 0;
        if (startDate) {
            const startDt = new Date(startDate);
            const allSalesBeforeStart = data.filter(r => isMatch(r) && new Date(r.date) < startDt);
            const allPaymentsBeforeStart = payments.filter(p => isMatch(p) && new Date(p.date) < startDt);

            const debitBefore = allSalesBeforeStart.reduce((acc, s) => {
                const netKg = Math.max(0, (s.soldKg || 0) - (s.mortalityKg || 0));
                return acc + Math.round(netKg * (s.sellPrice || 0));
            }, 0);
            const bonSopirBefore = allSalesBeforeStart.reduce((acc, s) => acc + (s.driverBonus || 0), 0);
            const creditBefore = allPaymentsBeforeStart.reduce((acc, p) => {
                return acc + Math.round((p.totalPaid || 0) - (p.driverBonus || 0));
            }, 0);

            // Saldo awal = Piutang yang belum lunas sebelum periode ini
            openingBalance = debitBefore - bonSopirBefore - creditBefore;
        }

        const ledgerAoa: any[][] = [];
        // Tambahkan header info periode
        const periodInfo = startDate || endDate
            ? `Periode: ${startDate ? formatDate(startDate) : 'Awal'} s/d ${endDate ? formatDate(endDate) : 'Sekarang'}`
            : 'Periode: Semua Data';
        ledgerAoa.push([`Kartu Piutang - ${customerName}`]);
        ledgerAoa.push([periodInfo]);
        ledgerAoa.push([]); // baris kosong
        ledgerAoa.push(['Tanggal', 'Deskripsi', 'Harga / Kg', 'Bon Sopir', 'Piutang (Debit)', 'Bayar (Kredit)', 'Saldo']);

        // Baris Saldo Awal (hanya jika ada filter startDate)
        let HEADER_ROW = 4; // header tabel di baris ke-4
        let openingBalanceRow = 0;
        if (startDate && openingBalance !== 0) {
            // Saldo awal masuk sebagai baris pertama data (baris 5)
            ledgerAoa.push([
                startDate ? formatDate(startDate) : '',
                'Saldo Awal',
                '',
                '',
                '',
                '',
                openingBalance
            ]);
            openingBalanceRow = HEADER_ROW + 1; // baris 5 = saldo awal
        }

        // Data transaksi periode ini
        // Baris data pertama = setelah header + saldo awal (jika ada)
        const firstTxRow = HEADER_ROW + (openingBalanceRow > 0 ? 2 : 1);
        txs.forEach((tx, idx) => {
            const r = firstTxRow + idx;
            let formula: string;
            if (idx === 0 && openingBalanceRow > 0) {
                // Baris pertama, ada saldo awal di baris sebelumnya
                formula = `G${r - 1}+E${r}-D${r}-F${r}`;
            } else if (idx === 0) {
                // Baris pertama, tidak ada saldo awal
                formula = `E${r}-D${r}-F${r}`;
            } else {
                formula = `G${r - 1}+E${r}-D${r}-F${r}`;
            }

            ledgerAoa.push([
                formatDate(tx.date),
                tx.description,
                tx.price,
                tx.bonSopir,
                tx.debit,
                tx.credit,
                { t: 'n', f: formula }
            ]);
        });

        // Add Total Row
        const firstDataRow = HEADER_ROW + 1;
        const lastDataRow = firstTxRow + txs.length - 1;
        if (txs.length > 0 || openingBalanceRow > 0) {
            ledgerAoa.push([
                'TOTAL',
                '',
                '',
                { t: 'n', f: `SUM(D${firstDataRow}:D${lastDataRow})` },
                { t: 'n', f: `SUM(E${firstDataRow}:E${lastDataRow})` },
                { t: 'n', f: `SUM(F${firstDataRow}:F${lastDataRow})` },
                { t: 'n', f: `G${lastDataRow}` } // Final balance
            ]);
        }

        // 2. Detail Penjualan Data
        const salesData = customerSales.map(r => ({
            'Tanggal': formatDate(r.date),
            'Nopol': r.plate,
            'Sopir': r.driver,
            'Ekor': r.soldHeads,
            'Kg': r.soldKg,
            'Mati (Ekor)': r.mortalityHeads,
            'Mati (Kg)': r.mortalityKg,
            'Total Penjualan': r.totalSales
        }));

        // 3. Detail Pembayaran Data
        const paymentsData = customerPaymentsList.map(p => ({
            'Tanggal Bayar': formatDate(p.date),
            'Transfer': p.transferAmount,
            'Cash': p.cashAmount,
            'Bongkaran': p.unloadingCost,
            'Bon Sopir': p.driverBonus,
            'Biaya Lain': p.otherCost,
            'Total Bayar': p.totalPaid,
            'Keterangan': p.notes || ''
        }));

        downloadMultiSheetExcel([
            { name: 'Kartu Piutang', aoa: ledgerAoa },
            { name: 'Detail Penjualan', data: salesData },
            { name: 'Detail Pembayaran', data: paymentsData }
        ], `Ledger_${customerName}_${periodLabel}`);
    };

    const clearFilters = () => {
        setStartDate('');
        setEndDate('');
        setSelectedCustomer('ALL');
    };

    // Helper untuk merender komponen ringkasan (digunakan dua kali: di UI dan di area capture)
    const SummaryCards = () => (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <div className="bg-slate-50 p-2 rounded border-l-4 border-blue-500">
                <div className="text-slate-400 text-[9px] uppercase font-bold">Sales Periode</div>
                <div className="text-lg font-bold text-slate-800">{formatCurrency(totalSales)}</div>
            </div>
            <div className="bg-slate-50 p-2 rounded border-l-4 border-red-500">
                <div className="text-slate-400 text-[9px] uppercase font-bold">Total Sisa Piutang</div>
                <div className={`text-lg font-bold ${totalReceivable < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalReceivable < 0 ? `+${formatCurrency(Math.abs(totalReceivable))}` : formatCurrency(totalReceivable)}
                </div>
            </div>
            <div className="bg-slate-50 p-2 rounded border-l-4 border-orange-500">
                <div className="text-slate-400 text-[9px] uppercase font-bold">Nilai Kematian</div>
                <div className="text-lg font-bold text-orange-600">{formatCurrency(totalMortalityVal)}</div>
            </div>
        </div>
    );

    // Helper untuk merender tabel desktop (digunakan dua kali)
    const DesktopTable = ({ isForCapture = false }) => (
        <div className={`rounded border border-slate-200 ${!isForCapture ? 'hidden md:block overflow-x-auto' : 'overflow-visible'}`}>
            <table className="w-full text-[11px] text-left whitespace-nowrap bg-white">
                <thead className={`bg-slate-100 text-slate-600 font-bold uppercase text-[10px] ${!isForCapture ? 'sticky top-0 z-10 shadow-sm' : ''}`}>
                    <tr>
                        <th className="py-2 px-2 border-b min-w-[200px]">Customer Name</th>
                        <th className="py-2 px-2 text-right border-b">Sales (Periode)</th>
                        <th className="py-2 px-2 text-right border-b bg-slate-50">Total Tagihan</th>
                        <th className="py-2 px-2 text-right border-b bg-green-50 text-green-800">Total Bayar</th>
                        <th className="py-2 px-2 text-right border-b bg-red-50 text-red-800">Sisa / Balance</th>
                        {!isForCapture && <th className="py-2 px-2 text-center border-b print:hidden w-20">Action</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {customerSummary.map((row) => (
                        <tr key={row.id || row.customer} className="hover:bg-blue-50 transition-colors">
                            <td className="py-1 px-2 font-bold text-blue-800">
                                {row.customer}
                                <span className="text-[9px] font-normal text-slate-400 ml-2">({row.transactionCount})</span>
                            </td>
                            <td className="py-1 px-2 text-right text-slate-500 font-mono">{formatCurrency(row.periodSales)}</td>
                            <td className="py-1 px-2 text-right font-semibold font-mono bg-slate-50/50">{formatCurrency(row.remainingBalance + row.totalPaid)}</td>
                            <td className="py-1 px-2 text-right font-semibold text-green-700 font-mono bg-green-50/30">{formatCurrency(row.totalPaid)}</td>
                            <td className={`py-1 px-2 text-right font-bold font-mono text-xs bg-red-50/20 ${row.remainingBalance < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {row.remainingBalance < 0 ? `+${formatCurrency(Math.abs(row.remainingBalance))}` : formatCurrency(row.remainingBalance)}
                            </td>
                            {!isForCapture && (
                                <td className="py-1 px-2 text-center print:hidden">
                                    <div className="flex items-center justify-center gap-1">
                                        <button
                                            onClick={() => {
                                                const custObj = uniqueCustomers.find(c => c.id === row.id || c.name === row.customer);
                                                if (custObj) onShowCustomerStatement(custObj.name, custObj.id, startDate, endDate);
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:text-blue-600 hover:border-blue-300 text-[10px] font-bold shadow-sm"
                                        >
                                            Kartu <ChevronRight className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const custObj = uniqueCustomers.find(c => c.id === row.id || c.name === row.customer);
                                                if (custObj) handleDownloadDetailExcel(custObj.id, custObj.name);
                                            }}
                                            className="inline-flex items-center justify-center w-6 h-6 bg-white border border-slate-300 rounded text-green-600 hover:text-green-700 hover:border-green-400 shadow-sm"
                                            title="Download Excel Detail"
                                        >
                                            <Download className="w-3 h-3" />
                                        </button>
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                    {customerSummary.length === 0 && (
                        <tr><td colSpan={isForCapture ? 5 : 6} className="p-6 text-center text-slate-400 italic">No data found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mb-4"></div>
                <h3 className="text-lg font-bold text-slate-800">Memuat Data Ledger...</h3>
                <p className="text-slate-500 text-sm">Mohon tunggu sebentar, sedang mengambil data dari server.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* AREA TERSEMBUNYI UNTUK CAPTURE (DOWNLOAD) - Selalu dalam format PC/Tabel */}
            {/* w-[1280px] memastikan lebar cukup lebar untuk tabel penuh tanpa terpotong */}
            <div
                id="ledger-capture-area"
                className="absolute -top-[99999px] -left-[99999px] w-[1200px] bg-white p-10 pointer-events-none z-[-1] overflow-visible"
                aria-hidden="true"
            >
                <div className="mb-6 border-b-2 border-slate-800 pb-4">
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-black uppercase text-slate-800 tracking-tight">Rekap Ledger Piutang</h1>
                            <p className="text-base text-slate-500 font-bold">CV. DPJ Berkah Unggas</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-bold text-slate-700">Periode: {startDate || 'Awal'} s/d {endDate || 'Sekarang'}</p>
                            <p className="text-xs text-slate-400">Dicetak pada: {new Date().toLocaleString('id-ID')}</p>
                        </div>
                    </div>
                </div>
                <SummaryCards />
                <DesktopTable isForCapture={true} />
                <div className="mt-10 pt-4 border-t border-slate-100 text-center text-[10px] text-slate-400">
                    System generated report - CV DPJ Berkah Unggas
                </div>
            </div>

            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 print:hidden">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Ledger Piutang</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={handleDownloadExcel} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-bold"><Download className="w-3.5 h-3.5" /> XLSX</button>
                    <button onClick={handleDownloadImage} className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs font-bold"><ImageDown className="w-3.5 h-3.5" /> JPG</button>
                    <button onClick={handlePrintRecap} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 text-white rounded hover:bg-slate-700 text-xs font-bold"><FileText className="w-3.5 h-3.5" /> PDF</button>
                </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 print:hidden">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-slate-700 text-xs font-bold uppercase"><Filter className="w-3 h-3" /> Filter Data</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded border-slate-300 text-xs p-1.5" />
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded border-slate-300 text-xs p-1.5" />
                    <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} className="w-full rounded border-slate-300 text-xs p-1.5">
                        <option value="ALL">-- Semua Customer --</option>
                        {uniqueCustomers.map(c => <option key={c.id || c.name} value={c.id || c.name}>{c.name}</option>)}
                    </select>
                    {selectedCustomer !== 'ALL' ? (
                        <button onClick={() => {
                            const custObj = uniqueCustomers.find(c => c.id === selectedCustomer || c.name === selectedCustomer);
                            if (custObj) onShowCustomerStatement(custObj.name, custObj.id, startDate, endDate);
                        }} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-primary text-white rounded hover:bg-primary/90 text-xs font-bold shadow-sm">
                            <BookOpen className="w-3 h-3" /> Buka Kartu Piutang
                        </button>
                    ) : (
                        <button onClick={clearFilters} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 text-xs">Clear Filters</button>
                    )}
                </div>
            </div>

            <div id="ledger-content" className="bg-white p-2">
                <SummaryCards />

                {/* Mobile View: Card Layout (Tetap Tampil di Layar Mobile) */}
                <div className="md:hidden space-y-3">
                    {customerSummary.map((row) => (
                        <div key={row.id || row.customer} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                            <div className="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
                                <div>
                                    <div className="font-bold text-blue-800 text-sm">{row.customer}</div>
                                    <div className="text-[10px] text-slate-400">{row.transactionCount} Transaksi</div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            const custObj = uniqueCustomers.find(c => c.id === row.id || c.name === row.customer);
                                            if (custObj) handleDownloadDetailExcel(custObj.id, custObj.name);
                                        }}
                                        className="inline-flex items-center justify-center w-6 h-6 bg-white border border-slate-300 rounded text-green-600 hover:text-green-700 hover:border-green-400 shadow-sm"
                                    >
                                        <Download className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            const custObj = uniqueCustomers.find(c => c.id === row.id || c.name === row.customer);
                                            if (custObj) onShowCustomerStatement(custObj.name, custObj.id, startDate, endDate);
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 rounded text-slate-600 hover:text-blue-600 hover:border-blue-300 text-[10px] font-bold shadow-sm"
                                    >
                                        Kartu <ChevronRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                                <div>
                                    <div className="text-[10px] text-slate-500 uppercase">Sales (Periode)</div>
                                    <div className="font-mono text-slate-700">{formatCurrency(row.periodSales)}</div>
                                </div>

                                <div className="text-right">
                                    <div className="text-[10px] text-slate-500 uppercase">Total Tagihan</div>
                                    <div className="font-mono font-semibold text-slate-800">{formatCurrency(row.remainingBalance + row.totalPaid)}</div>
                                </div>

                                <div>
                                    <div className="text-[10px] text-green-600 uppercase">Total Bayar</div>
                                    <div className="font-mono font-bold text-green-700">{formatCurrency(row.totalPaid)}</div>
                                </div>

                                <div className="text-right">
                                    <div className="text-[10px] text-red-600 uppercase">Sisa / Balance</div>
                                    <div className={`font-mono font-bold text-base ${row.remainingBalance < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {row.remainingBalance < 0 ? `+${formatCurrency(Math.abs(row.remainingBalance))}` : formatCurrency(row.remainingBalance)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {customerSummary.length === 0 && (
                        <div className="p-6 text-center text-slate-400 italic">No data found.</div>
                    )}
                </div>

                {/* Desktop View: Compact Table Layout (Tetap Tampil di Layar PC) */}
                <DesktopTable />
            </div>
        </div>
    );
};

export default LedgerTable;