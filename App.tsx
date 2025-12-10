
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './services/supabaseClient';
import { AppView, PurchaseRecord, SaleRecord, LedgerRow, LedgerRow as LedgerRowType, Payment, CustomerPayment, User, SupplierPayment, OnlineUser } from './types';
import * as Storage from './services/storageService';
import { logActivity } from './services/logService'; // Import Log Service
import PurchaseForm from './components/PurchaseForm';
import PurchaseList from './components/PurchaseList';
import DistributionForm from './components/DistributionForm';
import SalesList from './components/SalesList';
import LedgerTable from './components/LedgerTable';
import Dashboard from './components/Dashboard'; // Import Dashboard
import InvoiceModal from './components/InvoiceModal';
import PaymentModal from './components/PaymentModal';
import CustomerStatementModal from './components/CustomerStatementModal';
import PaymentMenu from './components/PaymentMenu';
import RecapTable from './components/RecapTable';
import DriverMenu from './components/DriverMenu';
import MasterDataMenu from './components/MasterDataMenu';
import SupplierLedger from './components/SupplierLedger'; // Import New Component
import EditSaleModal from './components/EditSaleModal';
import EditPurchaseModal from './components/EditPurchaseModal';
import ActivityLogTable from './components/ActivityLogTable'; // Import Activity Log
import Login from './components/Login';
import ComplaintModal from './components/ComplaintModal';
import AboutModal from './components/AboutModal'; // Import About
import OnlineUserList from './components/OnlineUserList'; // Import Online User List
import { LayoutDashboard, ShoppingCart, Truck, Menu, ChevronLeft, Wallet, TrendingUp, Database, User as UserIcon, RefreshCw, List, FileText, PieChart, LogOut, Package, X, Info, History, Radio } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { formatDate, formatCurrency, generateDiff } from './utils';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  
  // 1. VIEW PERSISTENCE: Initialize from localStorage if available
  const [currentView, setCurrentView] = useState<AppView>(() => {
    const savedView = localStorage.getItem('avt_current_view');
    // Safety check: if TV_MODE was saved, revert to OVERVIEW
    if (savedView === 'TV_MODE') return AppView.OVERVIEW;
    return (savedView as AppView) || AppView.OVERVIEW;
  });

  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]); // New State
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false); // New State for Realtime Feedback
  
  // Online Presence State
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);

  // Invoice State
  const [invoiceData, setInvoiceData] = useState<LedgerRow | null>(null);
  const [bulkInvoiceData, setBulkInvoiceData] = useState<LedgerRow[] | null>(null);

  // Modals State
  const [selectedSaleForPayment, setSelectedSaleForPayment] = useState<SaleRecord | null>(null);
  const [selectedSaleForEdit, setSelectedSaleForEdit] = useState<SaleRecord | null>(null);
  const [selectedPurchaseForEdit, setSelectedPurchaseForEdit] = useState<PurchaseRecord | null>(null);
  
  // About Modal
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Shortcut State
  const [preSelectedPurchaseId, setPreSelectedPurchaseId] = useState<string | null>(null);

  // Complaint Context (Sale + Parent Purchase)
  const [complaintContext, setComplaintContext] = useState<{sale: SaleRecord, purchase: PurchaseRecord} | null>(null);

  // Customer Statement State
  const [statementParams, setStatementParams] = useState<{
    customer: string;
    customerId?: string;
    startDate: string;
    endDate: string;
  } | null>(null);

  // Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Debounce & Change Tracking Ref for Smart Sync
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changedTablesRef = useRef<Set<string>>(new Set());

  // 2. VIEW PERSISTENCE: Save to localStorage whenever view changes
  useEffect(() => {
    if (currentView) {
        localStorage.setItem('avt_current_view', currentView);
    }
  }, [currentView]);

  // SMART SYNC: Refresh data granularly
  // isAutoSync = true means it's a background update (don't block UI with full loader)
  const refreshData = async (isAutoSync = false, tablesToRefresh: string[] = []) => {
    if (isAutoSync) {
        // Prevent overlapping syncs
        if (isSyncing) return;
        setIsSyncing(true);
    } else {
        setIsLoading(true);
    }

    try {
        const promises: Promise<void>[] = [];
        const fetchAll = tablesToRefresh.length === 0;

        // Conditional Fetching based on what changed
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

        // Execute only necessary requests in parallel
        if (promises.length > 0) {
            await Promise.all(promises);
        }

    } catch (e) {
        console.error("Failed to load data", e);
    } finally {
        setIsLoading(false);
        // Add a small delay to keep the "Updating" badge visible long enough to be noticed
        setTimeout(() => setIsSyncing(false), 1500);
    }
  };

  useEffect(() => {
    // Check for user session
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

    handleResize(); // Initial check
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 3. REALTIME SYNC & PRESENCE
  useEffect(() => {
    if (!user) return;

    // Initial fetch (Load All)
    refreshData(false);

    // --- SUPABASE REALTIME PRESENCE ---
    const room = supabase.channel('online-users');
    
    room
    .on('presence', { event: 'sync' }, () => {
        const newState = room.presenceState();
        const users = Object.values(newState).flat() as OnlineUser[];
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

    // --- SUPABASE REALTIME DATABASE CHANGES (SMART AUTO-REFRESH) ---
    const handleDbChange = (payload: any) => {
        // Log for debugging
        console.log('Realtime change received:', payload.table);

        // Immediate Feedback
        setIsSyncing(true);

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        
        // Track which table changed
        if (payload.table) {
            changedTablesRef.current.add(payload.table);
        }
        
        // Wait 1 second (debounce) to collect rapid-fire updates, then fetch
        debounceRef.current = setTimeout(() => {
            const tables = Array.from(changedTablesRef.current) as string[];
            refreshData(true, tables); // Pass true for isAutoSync
            changedTablesRef.current.clear(); // Reset tracker
        }, 1000);
    };

    // Listen to INSERT/UPDATE/DELETE on key tables
    const dbSync = supabase.channel('app-db-sync');
    
    dbSync
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avt_purchases' }, handleDbChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avt_sales' }, handleDbChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avt_customer_payments' }, handleDbChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avt_supplier_payments' }, handleDbChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avt_driver_transactions' }, handleDbChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avt_customers' }, handleDbChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avt_suppliers' }, handleDbChange)
      .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
              console.log("Realtime Sync Connected");
          }
      });

    // Cleanup
    return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        supabase.removeChannel(room);
        supabase.removeChannel(dbSync);
    };
  }, [user]);

  // 4. INTERVAL POLLING (Safety Net / 15s Auto-Refresh)
  // Optimization: Only runs if tab is visible and no sync is currently in progress
  useEffect(() => {
    if (!user) return;

    const intervalId = setInterval(() => {
        // "Efficient" Check: Stop polling if user is not looking or if app is already working
        if (document.visibilityState === 'visible' && !isLoading && !isSyncing) {
            console.log("Auto-refresh cycle (15s)...");
            refreshData(true);
        }
    }, 15000); // 15 seconds

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
    localStorage.removeItem('avt_current_view'); // Optional: Reset view on logout
    setCurrentView(AppView.OVERVIEW);
  };

  const handleSavePurchases = async (records: PurchaseRecord[]) => {
    setIsLoading(true);
    await Storage.savePurchases(records);
    
    // Log Activity
    const desc = records.map(p => `${p.supplier} (${p.kg}kg)`).join(', ');
    await logActivity(user, 'CREATE', 'PURCHASE', `Added ${records.length} purchases: ${desc}`);

    // await refreshData(); // Auto-handled by Realtime, but for UX instant feedback we can call:
    refreshData(true, ['avt_purchases']); 
    setCurrentView(AppView.PURCHASE_LIST);
  };

  const handleSaveSale = async (record: SaleRecord) => {
    setIsLoading(true);
    await Storage.saveSale(record);

    // Log Activity
    await logActivity(user, 'CREATE', 'SALE', `Sold ${record.soldKg}kg to ${record.customerName}`, record.id);

    // await refreshData(); // Auto-handled by Realtime
    refreshData(true, ['avt_sales']);
    setPreSelectedPurchaseId(null); // Clear shortcut state
    setCurrentView(AppView.SALES_LIST); // Redirect to Sales List after input
  };

  const handleUpdateSale = async (record: SaleRecord) => {
    setIsLoading(true);
    
    // 1. OPTIMISTIC UPDATE: Update State Immediately
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

    // Confirm with server sync
    refreshData(true, ['avt_sales']);
  };

  const handleUpdatePurchase = async (record: PurchaseRecord) => {
    setIsLoading(true);

    // 1. OPTIMISTIC UPDATE: Update State Immediately
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

    // Log Activity
    await logActivity(
        user, 
        'UPDATE', 
        'PURCHASE', 
        `[Rev: ${revisionDate}] ${record.supplier} - Detail: ${diffString}`, 
        record.id
    );

    // Confirm with server sync
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
    setSelectedSaleForPayment(null); // Close modal
  };

  const handleBulkPayment = async (customerName: string, amount: number, date: string, method: 'CASH' | 'TRANSFER') => {
      // Trigger background refresh instead of full loader
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

  // Transform sales to ledger rows for display
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

  // --- SIDEBAR HELPER ---
  const SidebarButton = ({ view, icon: Icon, label, active }: { view: AppView, icon: any, label: string, active: boolean }) => (
    <button 
        onClick={() => {
            setCurrentView(view);
            if (isMobile) setIsSidebarOpen(false); // Close sidebar on mobile after click
        }} 
        className={`
            relative w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 whitespace-nowrap text-sm font-medium group
            ${active 
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-900/20 ring-1 ring-white/10' 
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100 hover:shadow-inner'
            } 
            ${(!isSidebarOpen && !isMobile) ? 'justify-center px-0' : ''}
        `}
        title={!isSidebarOpen ? label : ''}
    >
        <Icon className={`w-5 h-5 shrink-0 transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`} /> 
        {(isSidebarOpen || isMobile) && <span className="tracking-wide">{label}</span>}
        
        {/* Active Indicator for Collapsed Mode */}
        {active && (!isSidebarOpen && !isMobile) && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
        )}
    </button>
  );

  const SidebarGroup = ({ title, children }: { title: string, children?: React.ReactNode }) => (
    <div className="mb-6 relative">
         {(isSidebarOpen || isMobile) && (
            <div className="px-4 mb-3 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                {title}
                <div className="h-px bg-slate-800 flex-1"></div>
            </div>
         )}
         {(!isSidebarOpen && !isMobile) && (
             <div className="h-px bg-slate-800 mx-4 mb-3"></div>
         )}
         <div className="space-y-1 px-3">
             {children}
         </div>
    </div>
  );

  // If not logged in, show login screen
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 flex relative overflow-hidden">
      
      {/* Mobile Overlay */}
      {isMobile && isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsSidebarOpen(false)}
          />
      )}

      {/* Sidebar */}
      <nav className={`
            fixed top-0 left-0 h-full bg-slate-900 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100 flex flex-col shadow-2xl z-40 transition-all duration-300 ease-in-out print:hidden border-r border-slate-800
            ${isMobile 
                ? (isSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72') 
                : (isSidebarOpen ? 'w-72' : 'w-20')
            }
        `}>
        <div className="p-6 flex items-center justify-between h-20 bg-slate-900/50 backdrop-blur-sm border-b border-white/5">
            <div className={`flex items-center gap-3 ${!isSidebarOpen && !isMobile && 'justify-center w-full'}`}>
                {/* --- LOGO --- */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-red-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity rounded-full"></div>
                    <img 
                        src="/logo.png" 
                        alt="Logo CV DPJ" 
                        className="w-8 h-8 object-contain shrink-0 relative z-10" 
                    />
                </div>
                {(isSidebarOpen || isMobile) && <span className="text-lg font-bold tracking-tight whitespace-nowrap text-white">DPJ Berkah Unggas</span>}
            </div>
            {/* Desktop Collapse Button */}
            {!isMobile && (
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`text-slate-400 hover:text-white transition-colors p-1 rounded-md hover:bg-slate-800 ${!isSidebarOpen && 'hidden'}`}>
                    <ChevronLeft className="w-5 h-5" />
                </button>
            )}
            {/* Mobile Close Button */}
            {isMobile && (
                 <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white p-1">
                    <X className="w-6 h-6" />
                </button>
            )}
        </div>
        
        {/* Desktop Expand Trigger (Icon Only Mode) */}
        {!isSidebarOpen && !isMobile && (
             <div className="flex justify-center py-4 cursor-pointer hover:bg-slate-800/50 transition-colors" onClick={() => setIsSidebarOpen(true)}>
                 <Menu className="w-6 h-6 text-slate-400" />
             </div>
        )}

        <div className="flex-1 py-6 overflow-hidden overflow-y-auto custom-scrollbar">
            
            <SidebarGroup title="Dashboard">
                <SidebarButton view={AppView.OVERVIEW} icon={PieChart} label="Overview" active={currentView === AppView.OVERVIEW} />
            </SidebarGroup>

            <SidebarGroup title="Transaksi">
                {/* Merged Input & List into one entry point */}
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
        
        {/* User Info & Logout */}
        <div className="p-4 bg-slate-900/80 backdrop-blur border-t border-slate-800">
             <div className={`
                flex items-center gap-3 mb-4 rounded-xl p-3 transition-colors 
                ${(isSidebarOpen || isMobile) ? 'bg-slate-800/50 border border-slate-700/50' : 'justify-center bg-transparent border-0 p-0'}
             `}>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg ring-2 ring-slate-700">
                    {user.username.charAt(0).toUpperCase()}
                </div>
                {(isSidebarOpen || isMobile) && (
                    <div className="overflow-hidden flex-1">
                        <div className="text-sm font-bold text-white truncate">{user.username}</div>
                        <div className="text-[10px] text-indigo-300 uppercase font-bold tracking-wide">{user.role}</div>
                    </div>
                )}
             </div>
             
             {/* Action Buttons */}
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
            flex-1 p-4 md:p-10 transition-all duration-300 ease-in-out print:m-0 print:p-0 print:w-full overflow-x-hidden
            ${isMobile ? 'ml-0 pt-24' : (isSidebarOpen ? 'ml-72' : 'ml-20')}
      `}>
        {/* Mobile Header Bar */}
        <div className="md:hidden fixed top-0 left-0 right-0 bg-white shadow-md z-20 px-4 py-3 flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600">
                    <Menu className="w-6 h-6" />
                </button>
                <div className="flex flex-col">
                    <span className="font-bold text-slate-800 text-lg leading-tight">DPJ Berkah Unggas</span>

                    <span className="text-[10px] text-slate-500 uppercase">Mobile Access</span>
                </div>
            </div>
             <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold shadow-sm">
                {user.username.charAt(0).toUpperCase()}
            </div>
        </div>

        <header className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4 print:hidden">
            <div className="flex items-center gap-4">
                <h1 className="text-xl md:text-2xl font-bold text-slate-800 break-words max-w-full">
                    {currentView === AppView.OVERVIEW && 'Dashboard Overview'}
                    {currentView === AppView.LEDGER && '' /* Removed Title */}
                    {currentView === AppView.SUPPLIER_LEDGER && '' /* Removed Title */}
                    {currentView === AppView.RECAP && '' /* Removed Title */}
                    {currentView === AppView.PURCHASE && 'Input Pembelian'}
                    {currentView === AppView.PURCHASE_LIST && 'Riwayat Pembelian'}
                    {currentView === AppView.DISTRIBUTION && 'Input Penjualan'}
                    {currentView === AppView.SALES_LIST && 'Riwayat Penjualan'}
                    {currentView === AppView.PAYMENT && 'Pembayaran'}
                    {currentView === AppView.DRIVER && 'Manajemen Sopir'}
                    {currentView === AppView.MASTER && 'Master Data'}
                    {currentView === AppView.LOGS && 'System Activity Log'}
                </h1>
                
                {/* Manual Refresh Button with Sync Indicator */}
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
                    
                    {/* Live Indicator Pulse */}
                    {isSyncing && (
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                    )}
                </button>
            </div>
            
            <div className="flex items-center gap-3 self-start md:self-auto">
                {/* ONLINE USERS INDICATOR */}
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

                <div className="hidden md:block text-sm text-slate-500 bg-white px-4 py-2 rounded-full shadow-sm border">
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>
        </header>

        <div className="max-w-7xl mx-auto print:max-w-none w-full">
            {currentView === AppView.OVERVIEW && <Dashboard purchases={purchases} sales={sales} customerPayments={customerPayments} supplierPayments={supplierPayments} />}
            {currentView === AppView.PURCHASE && <PurchaseForm onSave={handleSavePurchases} onCancel={() => setCurrentView(AppView.LEDGER)} />}
            {currentView === AppView.PURCHASE_LIST && <PurchaseList onEditPurchase={handleOpenPurchaseEditModal} onNewPurchase={() => setCurrentView(AppView.PURCHASE)} onDeletePurchase={handleDeletePurchase} user={user} />}
            {currentView === AppView.DISTRIBUTION && <DistributionForm purchases={purchases} existingSales={sales} initialPurchaseId={preSelectedPurchaseId} onSaveSale={handleSaveSale} onCancel={() => { setPreSelectedPurchaseId(null); setCurrentView(AppView.LEDGER); }} />}
            {currentView === AppView.SALES_LIST && <SalesList purchases={purchases} onEditSale={handleOpenEditModal} onPrintInvoice={(row) => setInvoiceData(row)} onComplaint={handleOpenComplaintModal} onDeleteSale={handleDeleteSale} user={user} onNewSale={handleNewSale} />}
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
      
      {/* Complaint Modal */}
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

      {/* About Modal */}
      {isAboutOpen && <AboutModal onClose={() => setIsAboutOpen(false)} />}
      
      {/* Online Users List Modal */}
      {showOnlineUsers && <OnlineUserList users={onlineUsers} onClose={() => setShowOnlineUsers(false)} currentUser={user} />}
    </div>
  );
};

export default App;
