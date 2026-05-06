import { supabase } from '../supabaseClient';
import { CustomerPayment, SupplierPayment } from '../../types';
import { fetchLargeData } from './core';

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

// --- GLOBAL CUSTOMER PAYMENTS ---

export const getCustomerPayments = async (): Promise<CustomerPayment[]> => {
    const data = await fetchLargeData(
        'avt_customer_payments',
        'id, date, customer_id, customer_name, transfer_amount, cash_amount, unloading_cost, driver_bonus, other_cost, notes, total_paid'
    );
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
    const data = await fetchLargeData(
        'avt_supplier_payments',
        'id, date, supplier_name, amount, method, notes'
    );
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
