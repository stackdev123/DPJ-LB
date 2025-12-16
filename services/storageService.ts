import { supabase } from './supabaseClient';
import { PurchaseRecord, SaleRecord, DriverTransaction, Customer, Supplier, Coop, MasterItem, CustomerPayment, SupplierPayment } from '../types';

// --- HELPERS FOR MAPPING (Snake_case DB <-> camelCase App) ---

const mapPurchaseFromDB = (p: any): PurchaseRecord => ({
    id: p.id,
    date: p.date,
    supplier: p.supplier,
    coop: p.coop,
    driver: p.driver,
    plate: p.plate,
    heads: p.heads ?? 0,
    kg: p.kg ?? 0,
    avgWeight: p.avg_weight ?? 0,
    buyPrice: p.buy_price ?? 0,
    totalBuyCost: p.total_buy_cost ?? 0,
    isDistributed: p.is_distributed
});

const mapPurchaseToDB = (p: PurchaseRecord) => ({
    id: p.id,
    date: p.date,
    supplier: p.supplier,
    coop: p.coop,
    driver: p.driver,
    plate: p.plate,
    heads: p.heads,
    kg: p.kg,
    avg_weight: p.avgWeight,
    buy_price: p.buyPrice,
    total_buy_cost: p.totalBuyCost,
    is_distributed: p.isDistributed
});

const mapSaleFromDB = (s: any): SaleRecord => ({
    id: s.id,
    purchaseId: s.purchase_id,
    customerId: s.customer_id,
    customerName: s.customer_name,
    customerAddress: s.customer_address,
    date: s.date,
    soldHeads: s.sold_heads ?? 0,
    soldKg: s.sold_kg ?? 0,
    sellPrice: s.sell_price ?? 0,
    mortalityHeads: s.mortality_heads ?? 0,
    mortalityKg: s.mortality_kg ?? 0,
    unloadingCost: s.unloading_cost ?? 0,
    driverBonus: s.driver_bonus ?? 0,
    operationalCost: s.operational_cost ?? 0,
    truckCost: s.truck_cost ?? 0,
    payments: s.payments || []
});

const mapSaleToDB = (s: SaleRecord) => ({
    id: s.id,
    purchase_id: s.purchaseId,
    customer_id: s.customerId,
    customer_name: s.customerName,
    customer_address: s.customerAddress,
    date: s.date,
    sold_heads: s.soldHeads,
    sold_kg: s.soldKg,
    sell_price: s.sellPrice,
    mortality_heads: s.mortalityHeads,
    mortality_kg: s.mortalityKg,
    unloading_cost: s.unloadingCost,
    driver_bonus: s.driverBonus,
    operational_cost: s.operationalCost,
    truck_cost: s.truckCost,
    payments: s.payments
});

const mapCustomerPaymentFromDB = (p: any): CustomerPayment => ({
    id: p.id,
    date: p.date,
    customerId: p.customer_id,
    customerName: p.customer_name,
    transferAmount: p.transfer_amount ?? 0,
    cashAmount: p.cash_amount ?? 0,
    unloadingCost: p.unloading_cost ?? 0,
    driverBonus: p.driver_bonus ?? 0,
    otherCost: p.other_cost ?? 0,
    notes: p.notes,
    totalPaid: p.total_paid ?? 0
});

const mapCustomerPaymentToDB = (p: CustomerPayment) => ({
    id: p.id,
    date: p.date,
    customer_id: p.customerId,
    customer_name: p.customerName,
    transfer_amount: p.transferAmount,
    cash_amount: p.cashAmount,
    unloading_cost: p.unloadingCost,
    driver_bonus: p.driverBonus,
    other_cost: p.otherCost,
    notes: p.notes,
    total_paid: p.totalPaid
});

const mapSupplierPaymentFromDB = (p: any): SupplierPayment => ({
    id: p.id,
    date: p.date,
    supplierName: p.supplier_name,
    amount: p.amount ?? 0,
    method: p.method,
    notes: p.notes
});

const mapSupplierPaymentToDB = (p: SupplierPayment) => ({
    id: p.id,
    date: p.date,
    supplier_name: p.supplierName,
    amount: p.amount,
    method: p.method,
    notes: p.notes
});

const mapDriverTxFromDB = (t: any): DriverTransaction => ({
    id: t.id,
    driverName: t.driver_name,
    date: t.date,
    amount: t.amount ?? 0,
    type: t.type,
    notes: t.notes
});

const mapDriverTxToDB = (t: DriverTransaction) => ({
    id: t.id,
    driver_name: t.driverName,
    date: t.date,
    amount: t.amount,
    type: t.type,
    notes: t.notes
});


// --- TRANSACTIONS ---

export const getPurchases = async (): Promise<PurchaseRecord[]> => {
    const { data, error } = await supabase
        .from('avt_purchases')
        .select('id, date, supplier, coop, driver, plate, heads, kg, avg_weight, buy_price, total_buy_cost, is_distributed')
        .order('date', { ascending: false });
    
    if (error) { 
        console.error('Error fetching purchases:', error.message || JSON.stringify(error)); 
        return []; 
    }
    return data.map(mapPurchaseFromDB);
};

// --- PAGINATED PURCHASES ---
export const getPurchasesPaginated = async (
    page: number, 
    pageSize: number, 
    filters?: { date?: string, supplier?: string, coop?: string, plate?: string }
): Promise<{ data: PurchaseRecord[], count: number }> => {
    
    let query = supabase
        .from('avt_purchases')
        .select('id, date, supplier, coop, driver, plate, heads, kg, avg_weight, buy_price, total_buy_cost, is_distributed', { count: 'exact' });

    // Apply Filters
    if (filters?.date) query = query.eq('date', filters.date);
    if (filters?.supplier) query = query.eq('supplier', filters.supplier);
    if (filters?.coop) query = query.eq('coop', filters.coop);
    if (filters?.plate) query = query.eq('plate', filters.plate);

    // Apply Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data, error, count } = await query
        .order('date', { ascending: false })
        .range(from, to);

    if (error) { 
        console.error('Error fetching purchases (paginated):', error.message || JSON.stringify(error)); 
        return { data: [], count: 0 }; 
    }
    
    return { 
        data: data ? data.map(mapPurchaseFromDB) : [], 
        count: count || 0 
    };
};

export const savePurchases = async (newPurchases: PurchaseRecord[]) => {
    const dbData = newPurchases.map(mapPurchaseToDB);
    const { error } = await supabase.from('avt_purchases').upsert(dbData);
    if (error) throw error;
};

export const savePurchase = async (purchase: PurchaseRecord) => {
    await savePurchases([purchase]);
};

export const updatePurchase = async (purchase: PurchaseRecord) => {
    await savePurchases([purchase]);
};

export const deletePurchase = async (id: string) => {
    const { error } = await supabase.from('avt_purchases').delete().eq('id', id);
    if (error) throw error;
};

export const getSales = async (): Promise<SaleRecord[]> => {
    const { data, error } = await supabase
        .from('avt_sales')
        .select('id, purchase_id, customer_id, customer_name, customer_address, date, sold_heads, sold_kg, sell_price, mortality_heads, mortality_kg, unloading_cost, driver_bonus, operational_cost, truck_cost, payments')
        .order('date', { ascending: false });

    if (error) { 
        console.error('Error fetching sales:', error.message || JSON.stringify(error)); 
        return []; 
    }
    return data.map(mapSaleFromDB);
};

// --- PAGINATED SALES ---
export const getSalesPaginated = async (
    page: number, 
    pageSize: number,
    filters?: { date?: string, customerName?: string }
): Promise<{ data: SaleRecord[], count: number }> => {
    
    let query = supabase
        .from('avt_sales')
        .select('id, purchase_id, customer_id, customer_name, customer_address, date, sold_heads, sold_kg, sell_price, mortality_heads, mortality_kg, unloading_cost, driver_bonus, operational_cost, truck_cost, payments', { count: 'exact' });

    // Apply Filters
    if (filters?.date) query = query.eq('date', filters.date);
    if (filters?.customerName) query = query.ilike('customer_name', `%${filters.customerName}%`);

    // Apply Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    const { data, error, count } = await query
        .order('date', { ascending: false })
        .range(from, to);

    if (error) { 
        console.error('Error fetching sales (paginated):', error.message || JSON.stringify(error)); 
        return { data: [], count: 0 }; 
    }
    
    return { 
        data: data ? data.map(mapSaleFromDB) : [], 
        count: count || 0 
    };
};

export const saveSale = async (sale: SaleRecord) => {
    const dbData = mapSaleToDB(sale);
    const { error } = await supabase.from('avt_sales').upsert(dbData);
    if (error) throw error;
};

export const updateSale = async (sale: SaleRecord) => {
    await saveSale(sale);
};

export const deleteSale = async (id: string) => {
    const { error } = await supabase.from('avt_sales').delete().eq('id', id);
    if (error) throw error;
};

// --- GLOBAL CUSTOMER PAYMENTS ---

export const getCustomerPayments = async (): Promise<CustomerPayment[]> => {
    const { data, error } = await supabase
        .from('avt_customer_payments')
        .select('id, date, customer_id, customer_name, transfer_amount, cash_amount, unloading_cost, driver_bonus, other_cost, notes, total_paid')
        .order('date', { ascending: false });
    
    if (error) { 
        console.error('Error fetching payments:', error.message || JSON.stringify(error)); 
        return []; 
    }
    return data.map(mapCustomerPaymentFromDB);
};

export const saveCustomerPayment = async (payment: CustomerPayment) => {
    const dbData = mapCustomerPaymentToDB(payment);
    const { error } = await supabase.from('avt_customer_payments').upsert(dbData);
    if (error) throw error;
};

export const updateCustomerPayment = async (payment: CustomerPayment) => {
    await saveCustomerPayment(payment);
};

export const deleteCustomerPayment = async (id: string) => {
    const { error } = await supabase.from('avt_customer_payments').delete().eq('id', id);
    if (error) throw error;
};

// --- SUPPLIER PAYMENTS ---

export const getSupplierPayments = async (): Promise<SupplierPayment[]> => {
    const { data, error } = await supabase
        .from('avt_supplier_payments')
        .select('id, date, supplier_name, amount, method, notes')
        .order('date', { ascending: false });
    
    if (error) { 
        console.error('Error fetching supplier payments:', error.message || JSON.stringify(error)); 
        return []; 
    }
    return data.map(mapSupplierPaymentFromDB);
};

export const saveSupplierPayment = async (payment: SupplierPayment) => {
    const dbData = mapSupplierPaymentToDB(payment);
    const { error } = await supabase.from('avt_supplier_payments').upsert(dbData);
    if (error) throw error;
};

export const deleteSupplierPayment = async (id: string) => {
    const { error } = await supabase.from('avt_supplier_payments').delete().eq('id', id);
    if (error) throw error;
};

// --- DRIVER TRANSACTIONS ---

export const getDriverTransactions = async (): Promise<DriverTransaction[]> => {
    const { data, error } = await supabase
        .from('avt_driver_transactions')
        .select('id, driver_name, date, amount, type, notes')
        .order('date', { ascending: false });

    if (error) { 
        console.error('Error fetching driver tx:', error.message || JSON.stringify(error)); 
        return []; 
    }
    return data.map(mapDriverTxFromDB);
};

export const saveDriverTransaction = async (tx: DriverTransaction) => {
    const dbData = mapDriverTxToDB(tx);
    const { error } = await supabase.from('avt_driver_transactions').upsert(dbData);
    if (error) throw error;
};


// --- MASTER DATA ---

// Customers
export const getCustomers = async (): Promise<Customer[]> => {
    const { data, error } = await supabase.from('avt_customers').select('id, name, address, phone').order('name');
    if (error) { 
        console.error('Error fetching customers:', error.message || JSON.stringify(error)); 
        return []; 
    }
    return data as Customer[];
};

export const saveCustomer = async (customer: Customer) => {
    const { error } = await supabase.from('avt_customers').upsert(customer);
    if (error) throw error;
};

export const deleteCustomer = async (id: string) => {
    const { error } = await supabase.from('avt_customers').delete().eq('id', id);
    if (error) throw error;
};

// Suppliers
export const getSuppliers = async (): Promise<Supplier[]> => {
    const { data, error } = await supabase.from('avt_suppliers').select('id, name').order('name');
    if (error) { 
        console.error('Error fetching suppliers:', error.message || JSON.stringify(error)); 
        return []; 
    }
    return data as Supplier[];
};

export const saveSupplier = async (supplier: Supplier) => {
    const { error } = await supabase.from('avt_suppliers').upsert(supplier);
    if (error) throw error;
};

export const deleteSupplier = async (id: string) => {
    const { error } = await supabase.from('avt_suppliers').delete().eq('id', id);
    if (error) throw error;
};

// Coops
export const getCoops = async (): Promise<Coop[]> => {
    const { data, error } = await supabase.from('avt_coops').select('id, name, location').order('name');
    if (error) { 
        console.error('Error fetching coops:', error.message || JSON.stringify(error)); 
        return []; 
    }
    return data as Coop[];
};

export const saveCoop = async (coop: Coop) => {
    const { error } = await supabase.from('avt_coops').upsert(coop);
    if (error) throw error;
};

export const deleteCoop = async (id: string) => {
    const { error } = await supabase.from('avt_coops').delete().eq('id', id);
    if (error) throw error;
};

// Drivers List
export const getDriversList = async (): Promise<MasterItem[]> => {
    const { data, error } = await supabase.from('avt_drivers_list').select('id, value').order('value');
    if (error) { 
        console.error('Error fetching drivers list:', error.message || JSON.stringify(error)); 
        return []; 
    }
    return data as MasterItem[];
};

export const saveDriverToList = async (driver: MasterItem) => {
    const { error } = await supabase.from('avt_drivers_list').upsert(driver);
    if (error) throw error;
};

export const deleteDriverFromList = async (id: string) => {
    const { error } = await supabase.from('avt_drivers_list').delete().eq('id', id);
    if (error) throw error;
};

// Plates List
export const getPlatesList = async (): Promise<MasterItem[]> => {
    const { data, error } = await supabase.from('avt_plates_list').select('id, value').order('value');
    if (error) { 
        console.error('Error fetching plates list:', error.message || JSON.stringify(error)); 
        return []; 
    }
    return data as MasterItem[];
};

export const savePlateToList = async (plate: MasterItem) => {
    const { error } = await supabase.from('avt_plates_list').upsert(plate);
    if (error) throw error;
};

export const deletePlateFromList = async (id: string) => {
    const { error } = await supabase.from('avt_plates_list').delete().eq('id', id);
    if (error) throw error;
};