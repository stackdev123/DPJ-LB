
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './services/supabaseClient';
import { AppView, PurchaseRecord, SaleRecord, LedgerRow, LedgerRow as LedgerRowType, Payment, CustomerPayment, User, SupplierPayment, OnlineUser } from './types';
import * as Storage from './services/storageService';
import { logActivity } from './services/logService';
import PurchaseForm from './components/PurchaseForm';
import PurchaseList from './components/PurchaseList';
import DistributionForm from './components/DistributionForm';
import SalesList from './components/SalesList';
import LedgerTable from './components/LedgerTable';
import Dashboard from './components/Dashboard';
import InvoiceModal from './components/InvoiceModal';
import PaymentModal from './components/PaymentModal';
import CustomerStatementModal from './components/CustomerStatementModal';
import PaymentMenu from './components/PaymentMenu';
import RecapTable from './components/RecapTable';
import DriverMenu from './components/DriverMenu';
import MasterDataMenu from './components/MasterDataMenu';
import SupplierLedger from './components/SupplierLedger';
import EditSaleModal from './components/EditSaleModal';
import EditPurchaseModal from './components/EditPurchaseModal';
import ActivityLogTable from './components/ActivityLogTable';
import Login from './components/Login';
import ComplaintModal from './components/ComplaintModal';
import AboutModal from './components/AboutModal';
import OnlineUserList from './components/OnlineUserList';
import TvDashboard from './components/TvDashboard';
import { LayoutDashboard, ShoppingCart, Truck, Menu, ChevronLeft, Wallet, TrendingUp, Database, User as UserIcon, RefreshCw, List, FileText, PieChart, LogOut, Package, X, Info, History, Radio, MonitorPlay } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { formatDate, formatCurrency, generateDiff } from './utils';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  
  const [currentView, setCurrentView] = useState<AppView>(() => {
    const savedView = localStorage.getItem('avt_current_view');
    if (savedView === 'TV_MODE') return AppView.OVERVIEW; // TV Mode handled separately now
    return (savedView as AppView) || AppView.OVERVIEW;
  });
  
  // State for TV Dashboard overlay
  const [isTvMode, setIsTvMode] = useState(false);

  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);

  const [invoiceData, setInvoiceData] = useState<LedgerRow | null>(null);
  const [bulkInvoiceData, setBulkInvoiceData] = useState<LedgerRow[] | null>(null);

  const [selectedSaleForPayment, setSelectedSaleForPayment] = useState<SaleRecord | null>(null);
  const [selectedSaleForEdit, setSelectedSaleForEdit] = useState<SaleRecord | null>(null);
  const [selectedPurchaseForEdit, setSelectedPurchaseForEdit] = useState<PurchaseRecord | null>(null);
  
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const [preSelectedPurchaseId, setPreSelectedPurchaseId] = useState<string | null>(null);

  const [complaintContext, setComplaintContext] = useState<{sale: SaleRecord, purchase: PurchaseRecord} | null>(null);

  const [statementParams, setStatementParams] = useState<{
    customer: string;
    customerId?: string;
    startDate: string;
    endDate: string;
  } | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changedTablesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (currentView && !isTvMode) {
        localStorage.setItem('avt_current_view', currentView);
    }
  }, [currentView, isTvMode]);

  const refreshData = async (isAutoSync = false, tablesToRefresh: string[] = []) => {
    if (isAutoSync) {
        if (isSyncing) return;
        setIsSyncing(true);
    } else {
        setIsLoading(true);
    }

    try {
        const promises: Promise<void>[] = [];
        const fetchAll = tablesToRefresh.length === 0;

        if (fetchAll || tablesToRefresh.includes('avt_purchases')) {
            promises.push(Storage.getPurchases().then(setPurchases));
        }
        if (fetchAll || tablesToRefresh.includes('avt_sales')) {
            promises.push(Storage.getSales().then(setSales));
        }
        if (fetchAll || tablesToRefresh.includes('avt_customer_payments')) {
            promises.push(Storage.getCustomerPayments().then(setCustomerPayments));
        }
        if (fetchAll || tablesToRefresh.includes('avt_supplier_payments')) {
            promises.push(Storage.getSupplierPayments().then(setSupplierPayments));
        }

        if (promises.length > 0) {
            await Promise.all(promises);
        }

    } catch (e) {
        console.error("Failed to load data", e);
    } finally {
        setIsLoading(false);
        setTimeout(() => setIsSyncing(false), 1500);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('avt_user_session');
    if (storedUser) {
        setUser(JSON.parse(storedUser));
    }

    const handleResize = () => {
        if (window.innerWidth < 768) {
            setIsMobile(true);
            setIsSidebarOpen(false);
        } else {
            setIsMobile(false);
            setIsSidebarOpen(true);
        }
    };

    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user) return;

    refreshData(false);

    const room = supabase.channel('online-users');
    
    room
    .on('presence', { event: 'sync' }, () => {
        const newState = room.presenceState();
        // Fix: Use 'unknown' cast first to avoid type overlap error
        const users = Object.values(newState).flat() as unknown as OnlineUser[];
        setOnlineUsers(users);
    })
    .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await room.track({
                userId: user.id,
                username: user.username,
                role: user.role,
                onlineAt: new Date().toISOString()
            });
        }
    });

    const handleDbChange = (payload: any) => {
        console.log('Realtime change received:', payload.table);

        setIsSyncing(true);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        
        if (payload.table) {
            changedTablesRef.current.add(payload.table);
        }
        
        debounceRef.current = setTimeout(() => {
            const tables = Array.from(changedTablesRef.current) as string[];
            refreshData(true, tables); 
            changedTablesRef.current.clear(); 
        }, 1000);
    };

    const dbSync = supabase.channel('app-db-sync');
    
    dbSync
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avt_purchases' }, (payload) => handleDbChange(payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avt_sales' }, (payload) => handleDbChange(payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avt_customer_payments' }, (payload) => handleDbChange(payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avt_supplier_payments' }, (payload) => handleDbChange(payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avt_driver_transactions' }, (payload) => handleDbChange(payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avt_customers' }, (payload) => handleDbChange(payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avt_suppliers' }, (payload) => handleDbChange(payload))
      .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
              console.log("Realtime Sync Connected");
          }
      });

    return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        supabase.removeChannel(room);
        supabase.removeChannel(dbSync);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const intervalId = setInterval(() => {
        if (document.visibilityState === 'visible' && !isLoading && !isSyncing) {
            console.log("Auto-refresh cycle (15s)...");
            refreshData(true);
        }
    }, 15000); 

    return () => clearInterval(intervalId);
  }, [user, isLoading, isSyncing]);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('avt_user_session', JSON.stringify(loggedInUser));
    logActivity(loggedInUser, 'LOGIN', 'AUTH', `User ${loggedInUser.username} logged in`);
  };

  const handleLogout = () => {
    if(user) logActivity(user, 'LOGIN', 'AUTH', `User ${user.username} logged out`);
    setUser(null);
    localStorage.removeItem('avt_user_session');
    localStorage.removeItem('avt_current_view');
    setCurrentView(AppView.OVERVIEW);
    setIsTvMode(false);
  };

  const handleSavePurchases = async (records: PurchaseRecord[]) => {
    setIsLoading(true);
    await Storage.savePurchases(records);
    
    const desc = records.map(p => `${p.supplier} (${p.kg}kg)`).join(', ');
    await logActivity(user, 'CREATE', 'PURCHASE', `Added ${records.length} purchases: ${desc}`);

    refreshData(true, ['avt_purchases']); 
    setCurrentView(AppView.PURCHASE_LIST);
  };

  const handleSaveSale = async (record: SaleRecord) => {
    setIsLoading(true);
    await Storage.saveSale(record);

    await logActivity(user, 'CREATE', 'SALE', `Sold ${record.soldKg}kg to ${record.customerName}`, record.id);

    refreshData(true, ['avt_sales']);
    setPreSelectedPurchaseId(null); 
    setCurrentView(AppView.SALES_LIST); 
  };

  const handleUpdateSale = async (record: SaleRecord) => {
    setIsLoading(true);
    setSales(prev => prev.map(s => s.id === record.id ? record : s));

    const revisionDate = new Date().toLocaleString('id-ID', { 
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    
    let diffString = "Updated sale details";
    if (selectedSaleForEdit) {
        diffString = generateDiff(selectedSaleForEdit, record, [
            { key: 'customerName', label: 'Cust' },
            { key: 'soldKg', label: 'Kg Jual' },
            { key: 'soldHeads', label: 'Ekor Jual' },
            { key: 'sellPrice', label: 'Harga', isCurrency: true },
            { key: 'mortalityKg', label: 'Kg Mati' },
            { key: 'date', label: 'Tgl Transaksi' }
        ]);
    }

    await Storage.updateSale(record);
    
    await logActivity(
        user, 
        'UPDATE', 
        'SALE', 
        `[Rev: ${revisionDate}] ${record.customerName} - Detail: ${diffString}`, 
        record.id
    );

    refreshData(true, ['avt_sales']);
  };

  const handleUpdatePurchase = async (record: PurchaseRecord) => {
    setIsLoading(true);
    setPurchases(prev => prev.map(p => p.id === record.id ? record : p));

    const revisionDate = new Date().toLocaleString('id-ID', { 
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    let diffString = "Updated purchase details";
    if (selectedPurchaseForEdit) {
        diffString = generateDiff(selectedPurchaseForEdit, record, [
            { key: 'supplier', label: 'Supplier' },
            { key: 'kg', label: 'Kg' },
            { key: 'heads', label: 'Ekor' },
            { key: 'buyPrice', label: 'Harga Beli', isCurrency: true },
            { key: 'plate', label: 'Plat' }
        ]);
    }

    await Storage.updatePurchase(record);

    await logActivity(
        user, 
        'UPDATE', 
        'PURCHASE', 
        `[Rev: ${revisionDate}] ${record.supplier} - Detail: ${diffString}`, 
        record.id
    );

    refreshData(true, ['avt_purchases']);
  };

  const handleOpenPaymentModal = (saleId: string) => {
      const sale = sales.find(s => s.id === saleId);
      if (sale) setSelectedSaleForPayment(sale);
  };

  const handleOpenEditModal = (saleId: string) => {
      const sale = sales.find(s => s.id === saleId);
      if (sale) setSelectedSaleForEdit(sale);
  };

  const handleOpenPurchaseEditModal = (purchaseId: string) => {
      const purchase = purchases.find(p => p.id === purchaseId);
      if (purchase) setSelectedPurchaseForEdit(purchase);
  };

  const handleInputSaleFromRecap = (purchaseId: string) => {
      setPreSelectedPurchaseId(purchaseId);
      setCurrentView(AppView.DISTRIBUTION);
  };

  const handleNewSale = () => {
      setPreSelectedPurchaseId(null);
      setCurrentView(AppView.DISTRIBUTION);
  };

  const handleOpenComplaintModal = (sale: SaleRecord) => {
      const parent = purchases.find(p => p.id === sale.purchaseId);
      if (parent) {
        setComplaintContext({ sale, purchase: parent });
      } else {
          alert("Data pembelian induk tidak ditemukan. Tidak dapat membuat surat komplain.");
      }
  };

  const handleAddPayment = async (saleId: string, amount: number, date: string, method: 'CASH' | 'TRANSFER') => {
    setIsLoading(true);
    const targetSale = sales.find(s => s.id === saleId);
    if (!targetSale) { setIsLoading(false); return; }

    const newPayment: CustomerPayment = {
        id: uuidv4(),
        date: date,
        customerId: targetSale.customerId,
        customerName: targetSale.customerName,
        transferAmount: method === 'TRANSFER' ? amount : 0,
        cashAmount: method === 'CASH' ? amount : 0,
        unloadingCost: 0,
        driverBonus: 0,
        otherCost: 0,
        notes: `Pembayaran via Invoice ${formatDate(targetSale.date)}`,
        totalPaid: amount
    };
    
    await Storage.saveCustomerPayment(newPayment);
    await logActivity(user, 'CREATE', 'PAYMENT', `Added payment ${formatCurrency(amount)} for ${targetSale.customerName}`, newPayment.id);
    refreshData(true, ['avt_customer_payments']);
    setSelectedSaleForPayment(null); 
  };

  const handleBulkPayment = async (customerName: string, amount: number, date: string, method: 'CASH' | 'TRANSFER') => {
      refreshData(true, ['avt_customer_payments']);
  };

  const handleDeleteSale = async (saleId: string) => {
      setIsLoading(true);
      const sale = sales.find(s => s.id === saleId);
      await Storage.deleteSale(saleId);
      await logActivity(user, 'DELETE', 'SALE', `Deleted sale of ${sale?.customerName} (${sale?.soldKg}kg)`, saleId);
      refreshData(true, ['avt_sales']);
  };

  const handleDeletePurchase = async (purchaseId: string) => {
      setIsLoading(true);
      const purchase = purchases.find(p => p.id === purchaseId);
      await Storage.deletePurchase(purchaseId);
      await logActivity(user, 'DELETE', 'PURCHASE', `Deleted purchase from ${purchase?.supplier}`, purchaseId);
      refreshData(true, ['avt_purchases']);
  };

  const handleCloseInvoice = () => {
      setInvoiceData(null);
      setBulkInvoiceData(null);
  }

  const handleShowStatement = (customer: string, customerId: string, startDate: string, endDate: string) => {
    setStatementParams({ customer, customerId, startDate, endDate });
  }

  const ledgerData: LedgerRow[] = sales.map(sale => {
      const purchase = purchases.find(p => p.id === sale.purchaseId);
      const mortalityValue = sale.mortalityKg * sale.sellPrice;
      const netKg = Math.max(0, sale.soldKg - sale.mortalityKg);
      const totalSales = netKg * sale.sellPrice;
      
      return {
          date: sale.date,
          plate: purchase?.plate || 'Unknown',
          driver: purchase?.driver || 'Unknown',
          customer: sale.customerName,
          customerId: sale.customerId,
          soldHeads: sale.soldHeads,
          soldKg: sale.soldKg,
          mortalityHeads: sale.mortalityHeads,
          mortalityKg: sale.mortalityKg,
          mortalityValue: mortalityValue,
          unloadingCost: sale.unloadingCost,
          driverBonus: sale.driverBonus,
          operationalCost: sale.operationalCost || 0,
          truckCost: sale.truckCost || 0,
          totalSales: totalSales,
          totalPaid: 0,
          remainingBalance: totalSales,
          saleId: sale.id,
          purchaseId: sale.purchaseId
      };
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const SidebarButton = ({ view, icon: Icon, label, active }: { view: AppView, icon: any, label: string, active: boolean }) => (
    <button 
        onClick={() => {
            setCurrentView(view);
            if (isMobile) setIsSidebarOpen(false); 
        }} 
        className={`
            relative w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 whitespace-nowrap text-sm font-semibold group mb-1.5
            ${active 
                ? 'bg-gradient-to-r from-red-600 via-red-600 to-rose-600 text-white shadow-[0_4px_12px_-2px_rgba(220,38,38,0.4)] ring-1 ring-white/10' 
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100 hover:translate-x-1'
            } 
            ${(!isSidebarOpen && !isMobile) ? 'justify-center px-0' : ''}
        `}
        title={!isSidebarOpen ? label : ''}
    >
        <Icon className={`w-5 h-5 shrink-0 transition-transform duration-300 ${active ? 'scale-110 drop-shadow-md' : 'group-hover:scale-110'}`} /> 
        {(isSidebarOpen || isMobile) && <span className="tracking-wide text-[13px]">{label}</span>}
        {active && (!isSidebarOpen && !isMobile) && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-red-500 rounded-r-full shadow-[0_0_12px_rgba(220,38,38,0.8)]"></div>
        )}
    </button>
  );

  const SidebarGroup = ({ title, children }: { title: string, children?: React.ReactNode }) => (
    <div className="mb-6 relative">
         {(isSidebarOpen || isMobile) && (
            <div className="px-4 mb-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 opacity-80">
                {title}
                <div className="h-px bg-slate-800/50 flex-1"></div>
            </div>
         )}
         {(!isSidebarOpen && !isMobile) && (
             <div className="h-px bg-slate-800/50 mx-4 mb-3"></div>
         )}
         <div className="px-3">
             {children}
         </div>
    </div>
  );

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // TV MODE OVERLAY
  if (isTvMode) {
      return (
          <TvDashboard 
            purchases={purchases}
            sales={sales}
            customerPayments={customerPayments}
            supplierPayments={supplierPayments}
            onExit={() => setIsTvMode(false)}
          />
      );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 flex relative overflow-hidden">
      {isMobile && isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/60 z-30 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsSidebarOpen(false)}
          />
      )}

      <nav className={`
            fixed top-0 left-0 h-full text-slate-100 flex flex-col shadow-2xl z-40 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] print:hidden border-r border-slate-800
            bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900 via-[#1e1b4b] to-[#450a0a]
            ${isMobile 
                ? (isSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72') 
                : (isSidebarOpen ? 'w-72' : 'w-20')
            }
        `}>
        <div className="p-6 flex items-center justify-between h-24 bg-gradient-to-b from-slate-900/50 to-transparent backdrop-blur-sm border-b border-white/5">
            <div className={`flex items-center gap-3 ${!isSidebarOpen && !isMobile && 'justify-center w-full'}`}>
                <div className="relative group">
                    <div className="absolute inset-0 bg-red-600 blur-lg opacity-30 group-hover:opacity-60 transition-opacity duration-500 rounded-full"></div>
                    <img 
                        src="/logo.png" 
                        alt="Logo CV DPJ" 
                        className="w-9 h-9 object-contain shrink-0 relative z-10 drop-shadow-md" 
                    />
                </div>
                {(isSidebarOpen || isMobile) && (
                    <div className="flex flex-col">
                        <span className="text-lg font-black tracking-tight whitespace-nowrap text-white leading-none">DPJ BERKAH</span>
                        <span className="text-[10px] font-bold tracking-[0.2em] text-red-400 uppercase mt-1">Unggas System</span>
                    </div>
                )}
            </div>
            {!isMobile && (
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`text-slate-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10 ${!isSidebarOpen && 'hidden'}`}>
                    <ChevronLeft className="w-5 h-5" />
                </button>
            )}
            {isMobile && (
                 <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white p-1">
                    <X className="w-6 h-6" />
                </button>
            )}
        </div>
        
        {!isSidebarOpen && !isMobile && (
             <div className="flex justify-center py-4 cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => setIsSidebarOpen(true)}>
                 <Menu className="w-6 h-6 text-slate-400 group-hover:text-white" />
             </div>
        )}

        <div className="flex-1 py-6 overflow-hidden overflow-y-auto custom-scrollbar relative">
            <SidebarGroup title="Dashboard">
                <SidebarButton view={AppView.OVERVIEW} icon={PieChart} label="Overview" active={currentView === AppView.OVERVIEW} />
            </SidebarGroup>

            <SidebarGroup title="Transaksi">
                <SidebarButton view={AppView.PURCHASE_LIST} icon={ShoppingCart} label="Pembelian" active={currentView === AppView.PURCHASE_LIST || currentView === AppView.PURCHASE} />
                <SidebarButton view={AppView.SALES_LIST} icon={Truck} label="Penjualan" active={currentView === AppView.SALES_LIST || currentView === AppView.DISTRIBUTION} />
            </SidebarGroup>

            <SidebarGroup title="Keuangan">
                <SidebarButton view={AppView.LEDGER} icon={LayoutDashboard} label="Piutang (AR)" active={currentView === AppView.LEDGER} />
                <SidebarButton view={AppView.SUPPLIER_LEDGER} icon={Package} label="Hutang (AP)" active={currentView === AppView.SUPPLIER_LEDGER} />
                <SidebarButton view={AppView.PAYMENT} icon={Wallet} label="Pembayaran" active={currentView === AppView.PAYMENT} />
                <SidebarButton view={AppView.RECAP} icon={TrendingUp} label="Laba Rugi" active={currentView === AppView.RECAP} />
            </SidebarGroup>

            <SidebarGroup title="Admin">
                <SidebarButton view={AppView.DRIVER} icon={UserIcon} label="Sopir" active={currentView === AppView.DRIVER} />
                <SidebarButton view={AppView.MASTER} icon={Database} label="Master Data" active={currentView === AppView.MASTER} />
                {user.role === 'SUPER_ADMIN' && (
                    <SidebarButton view={AppView.LOGS} icon={History} label="Logs" active={currentView === AppView.LOGS} />
                )}
            </SidebarGroup>

        </div>
        
        <div className="p-4 bg-gradient-to-t from-black/60 to-transparent backdrop-blur border-t border-white/5">
             <div className={`
                flex items-center gap-3 mb-4 rounded-xl p-3 transition-colors duration-300
                ${(isSidebarOpen || isMobile) ? 'bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10' : 'justify-center bg-transparent border-0 p-0'}
             `}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg ring-2 ring-white/20">
                    {user.username.charAt(0).toUpperCase()}
                </div>
                {(isSidebarOpen || isMobile) && (
                    <div className="overflow-hidden flex-1">
                        <div className="text-sm font-bold text-white truncate">{user.username}</div>
                        <div className="text-[10px] text-indigo-300 uppercase font-bold tracking-wide flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                            {user.role}
                        </div>
                    </div>
                )}
             </div>
             
             <div className={`grid ${(isSidebarOpen || isMobile) ? 'grid-cols-2 gap-2' : 'grid-cols-1 gap-3'} `}>
                 <button 
                    onClick={() => setIsAboutOpen(true)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all text-xs font-bold border border-transparent hover:border-slate-700 ${(!isSidebarOpen && !isMobile) && 'justify-center'}`}
                    title="Tentang Aplikasi"
                 >
                    <Info className="w-4 h-4 shrink-0" />
                    {(isSidebarOpen || isMobile) && <span>Info</span>}
                 </button>

                 <button 
                    onClick={handleLogout}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all text-xs font-bold border border-red-500/10 hover:border-red-500/30 ${(!isSidebarOpen && !isMobile) && 'justify-center'}`}
                    title="Log Out"
                 >
                    <LogOut className="w-4 h-4 shrink-0" />
                    {(isSidebarOpen || isMobile) && <span>Logout</span>}
                 </button>
             </div>
        </div>
      </nav>

      <main className={`
            flex-1 p-4 md:p-8 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] print:m-0 print:p-0 print:w-full overflow-x-hidden
            ${isMobile ? 'ml-0 pt-24' : (isSidebarOpen ? 'ml-72' : 'ml-20')}
      `}>
        <div className="md:hidden fixed top-0 left-0 right-0 bg-gradient-to-r from-slate-900 to-slate-800 shadow-md z-20 px-4 py-3 flex items-center justify-between h-20 text-white">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-300 hover:text-white">
                    <Menu className="w-6 h-6" />
                </button>
                <div className="flex flex-col">
                    <span className="font-black text-lg leading-tight tracking-tight">DPJ BERKAH</span>
                    <span className="text-[10px] text-red-400 uppercase font-bold tracking-wider">Mobile Access</span>
                </div>
            </div>
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold shadow-lg ring-1 ring-white/20">
                {user.username.charAt(0).toUpperCase()}
            </div>
        </div>

        <header className="flex flex-col md:flex-row justify-between md:items-center mb-8 gap-4 print:hidden">
            <div className="flex items-center gap-4">
                <div className="hidden md:block w-1 h-8 bg-red-600 rounded-full"></div>
                <h1 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight break-words max-w-full">
                    {currentView === AppView.OVERVIEW && 'Dashboard Overview'}
                    {currentView === AppView.LEDGER && 'Ledger Piutang (AR)'}
                    {currentView === AppView.SUPPLIER_LEDGER && 'Hutang Supplier (AP)'}
                    {currentView === AppView.RECAP && 'Analisa Laba Rugi'}
                    {currentView === AppView.PURCHASE && 'Input Pembelian'}
                    {currentView === AppView.PURCHASE_LIST && 'Riwayat Pembelian'}
                    {currentView === AppView.DISTRIBUTION && 'Input Penjualan'}
                    {currentView === AppView.SALES_LIST && 'Riwayat Penjualan'}
                    {currentView === AppView.PAYMENT && 'Pembayaran Customer'}
                    {currentView === AppView.DRIVER && 'Manajemen Sopir'}
                    {currentView === AppView.MASTER && 'Master Data'}
                    {currentView === AppView.LOGS && 'System Activity Log'}
                </h1>
                
                <button 
                    onClick={() => refreshData(false)}
                    disabled={isLoading}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-sm whitespace-nowrap transition-all border
                        ${(isLoading || isSyncing)
                            ? 'text-primary bg-white border-primary/20' 
                            : 'text-slate-500 bg-white hover:bg-slate-50 hover:text-primary hover:border-primary/30 cursor-pointer border-slate-200'
                        }
                    `}
                    title={isSyncing ? "Data sedang disinkronisasi" : "Manual Refresh"}
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isSyncing ? 'animate-spin' : ''}`} />
                    <span className="text-xs font-bold hidden md:inline">
                        {isSyncing ? 'Live Updating...' : (isLoading ? 'Syncing...' : 'Refresh Data')}
                    </span>
                    {isSyncing && (
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                    )}
                </button>
            </div>
            
            <div className="flex items-center gap-3 self-start md:self-auto">
                <button 
                    onClick={() => setIsTvMode(true)}
                    className="flex items-center gap-2 bg-slate-800 text-white px-3 py-1.5 rounded-full shadow-md border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
                    title="Open TV Dashboard"
                >
                    <MonitorPlay className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold hidden md:inline">TV Mode</span>
                </button>

                <button 
                    onClick={() => setShowOnlineUsers(true)}
                    className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                    <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </div>
                    <span className="text-xs font-bold text-slate-700">{onlineUsers.length} Online</span>
                </button>

                <div className="hidden md:block text-sm text-slate-500 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 font-medium">
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>
        </header>

        <div className={`mx-auto print:max-w-none w-full transition-all duration-300 ${
            [AppView.LEDGER, AppView.SUPPLIER_LEDGER, AppView.RECAP].includes(currentView) 
            ? 'max-w-[95%] xl:max-w-[1600px]' 
            : 'max-w-7xl'
        }`}>
            {currentView === AppView.OVERVIEW && <Dashboard purchases={purchases} sales={sales} customerPayments={customerPayments} supplierPayments={supplierPayments} />}
            {currentView === AppView.PURCHASE && <PurchaseForm onSave={handleSavePurchases} onCancel={() => setCurrentView(AppView.LEDGER)} />}
            {currentView === AppView.PURCHASE_LIST && <PurchaseList purchases={purchases} onEditPurchase={handleOpenPurchaseEditModal} onNewPurchase={() => setCurrentView(AppView.PURCHASE)} onDeletePurchase={handleDeletePurchase} user={user} />}
            {currentView === AppView.DISTRIBUTION && <DistributionForm purchases={purchases} existingSales={sales} initialPurchaseId={preSelectedPurchaseId} onSaveSale={handleSaveSale} onCancel={() => { setPreSelectedPurchaseId(null); setCurrentView(AppView.LEDGER); }} />}
            {currentView === AppView.SALES_LIST && <SalesList purchases={purchases} sales={sales} onEditSale={handleOpenEditModal} onPrintInvoice={(row) => setInvoiceData(row)} onComplaint={handleOpenComplaintModal} onDeleteSale={handleDeleteSale} user={user} onNewSale={handleNewSale} />}
            {currentView === AppView.LEDGER && <LedgerTable data={ledgerData} payments={customerPayments} onViewPayment={handleOpenPaymentModal} onPrintInvoice={(row) => setInvoiceData(row)} onPrintBulkInvoices={(rows) => setBulkInvoiceData(rows)} onShowCustomerStatement={handleShowStatement} onEditSale={handleOpenEditModal} />}
            {currentView === AppView.SUPPLIER_LEDGER && <SupplierLedger purchases={purchases} payments={supplierPayments} sales={sales} onPaymentSaved={() => refreshData(true, ['avt_supplier_payments'])} user={user} />}
            {currentView === AppView.PAYMENT && <PaymentMenu sales={sales} purchases={purchases} customerPayments={customerPayments} onOpenPaymentModal={handleOpenPaymentModal} onBulkPayment={handleBulkPayment} user={user} />}
            {currentView === AppView.RECAP && <RecapTable purchases={purchases} sales={sales} onEditPurchase={handleOpenPurchaseEditModal} onInputSale={handleInputSaleFromRecap} onEditSale={handleOpenEditModal} />}
            {currentView === AppView.DRIVER && <DriverMenu purchases={purchases} sales={sales} />}
            {currentView === AppView.MASTER && <MasterDataMenu user={user} />}
            {currentView === AppView.LOGS && <ActivityLogTable />}
        </div>
      </main>

      <InvoiceModal data={invoiceData} bulkData={bulkInvoiceData} onClose={handleCloseInvoice} />
      {selectedSaleForPayment && <PaymentModal sale={selectedSaleForPayment} onClose={() => setSelectedSaleForPayment(null)} onAddPayment={handleAddPayment} />}
      {selectedSaleForEdit && <EditSaleModal sale={selectedSaleForEdit} onClose={() => setSelectedSaleForEdit(null)} onSave={handleUpdateSale} />}
      {selectedPurchaseForEdit && <EditPurchaseModal purchase={selectedPurchaseForEdit} onClose={() => setSelectedPurchaseForEdit(null)} onSave={handleUpdatePurchase} />}
      
      {complaintContext && (
          <ComplaintModal 
            sale={complaintContext.sale}
            purchase={complaintContext.purchase} 
            onClose={() => setComplaintContext(null)} 
          />
      )}

      {statementParams && <CustomerStatementModal 
        customerName={statementParams.customer} 
        customerId={statementParams.customerId}
        salesData={sales.filter(s => {
            if (statementParams.customerId && s.customerId) return s.customerId === statementParams.customerId;
            return s.customerName === statementParams.customer;
        })} 
        globalPayments={customerPayments}
        startDate={statementParams.startDate} 
        endDate={statementParams.endDate} 
        onClose={() => setStatementParams(null)} 
      />}

      {isAboutOpen && <AboutModal onClose={() => setIsAboutOpen(false)} />}
      
      {showOnlineUsers && <OnlineUserList users={onlineUsers} onClose={() => setShowOnlineUsers(false)} currentUser={user} />}
    </div>
  );
};

export default App;
