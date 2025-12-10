
export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: 'CASH' | 'TRANSFER' | 'DEPOSIT' | 'POTONGAN';
}

export interface SaleRecord {
  id: string;
  purchaseId: string; // Link back to the parent purchase
  customerId: string; // Added customerId for linking
  customerName: string;
  customerAddress?: string; // Added address
  date: string;
  
  // Sales specific data
  soldHeads: number;
  soldKg: number;
  sellPrice: number;
  
  // Mortality (Kematian)
  mortalityHeads: number;
  mortalityKg: number;
  
  // Operational Data (Not affecting invoice total directly, but recorded)
  unloadingCost: number; // Biaya Bongkar
  driverBonus: number;   // Bon Sopir
  operationalCost?: number; // Biaya Operasional Lainnya
  truckCost?: number;       // Sewa Truk
  
  payments: Payment[];
}

export interface PurchaseRecord {
  id: string;
  date: string;
  supplier: string;
  coop: string; // Kandang
  driver: string;
  plate: string;
  
  // Quantities
  heads: number;
  kg: number;
  avgWeight: number; // Derived
  
  // Financials
  buyPrice: number;
  totalBuyCost: number; // Derived
  
  // Status
  isDistributed: boolean; // True if fully sold/allocated
}

// A combined type for the Ledger view
export interface LedgerRow {
  date: string;
  plate: string;
  driver: string;
  customer: string;
  customerId: string; // Added customerId
  
  // Sales Info
  soldHeads: number;
  soldKg: number;
  
  // Mortality Info
  mortalityHeads: number;
  mortalityKg: number;
  mortalityValue: number; // (SellPrice * MortalityKg)
  
  // Costs
  unloadingCost: number;
  driverBonus: number;
  operationalCost: number;
  truckCost: number;
  
  // Financials
  totalSales: number; // (SoldKg - MortalityKg) * SellPrice
  totalPaid: number;
  remainingBalance: number;
  
  saleId: string;
  purchaseId: string;
}

export interface DriverTransaction {
  id: string;
  driverName: string;
  date: string;
  amount: number;
  type: 'PAYMENT' | 'MANUAL_BON'; // PAYMENT = Driver pays back, MANUAL_BON = Driver borrows
  notes?: string;
}

// New Separate Payment Structure
export interface CustomerPayment {
  id: string;
  date: string; // tanggal_bayar
  customerId: string; // Added customerId
  customerName: string; // nama_customer
  
  // Payment Methods
  transferAmount: number; // Transfer
  cashAmount: number; // Cash
  
  // Deductions / Expenses paid by Customer
  unloadingCost: number; // Bongkaran
  driverBonus: number; // bon_sopir
  otherCost: number; // biaya_lain
  
  notes: string; // Keterangan
  
  totalPaid: number; // Derived sum of all above
}

// Supplier Payment Structure
export interface SupplierPayment {
  id: string;
  date: string;
  supplierName: string;
  amount: number;
  method: 'CASH' | 'TRANSFER';
  notes?: string;
}

// --- Master Data Interfaces ---
export interface Customer {
  id: string;
  name: string;
  address: string;
  phone?: string;
}

export interface Supplier {
  id: string;
  name: string;
}

export interface Coop {
  id: string;
  name: string;
  // supplierId removed
  location?: string;
}

export interface MasterItem {
  id: string;
  value: string;
}

export interface User {
  id: string;
  username: string;
  role: string;
}

export interface OnlineUser {
  userId: string;
  username: string;
  role: string;
  onlineAt: string;
}

// --- Activity Logs ---
export interface ActivityLog {
  id: string;
  timestamp: string;
  username: string;
  role: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'OTHER';
  entityType: string;
  entityId: string;
  details: string;
}

export enum AppView {
  OVERVIEW = 'OVERVIEW', // NEW DASHBOARD
  DASHBOARD = 'DASHBOARD', // Deprecated name, mapped to Ledger usually
  PURCHASE = 'PURCHASE',
  PURCHASE_LIST = 'PURCHASE_LIST', 
  DISTRIBUTION = 'DISTRIBUTION',
  SALES_LIST = 'SALES_LIST',
  LEDGER = 'LEDGER',
  PAYMENT = 'PAYMENT',
  RECAP = 'RECAP',
  DRIVER = 'DRIVER',
  MASTER = 'MASTER',
  SUPPLIER_LEDGER = 'SUPPLIER_LEDGER',
  LOGS = 'LOGS' // New Activity Log View
}
