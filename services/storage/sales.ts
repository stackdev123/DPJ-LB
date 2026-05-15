import { supabase } from '../supabaseClient';
import { insertToSecondaryDb } from '../secondaryDBClient';
import { SaleRecord } from '../../types';
import { fetchLargeData } from './core';

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

export const getSales = async (): Promise<SaleRecord[]> => {
    const data = await fetchLargeData(
        'avt_sales',
        'id, purchase_id, customer_id, customer_name, customer_address, date, sold_heads, sold_kg, sell_price, mortality_heads, mortality_kg, unloading_cost, driver_bonus, operational_cost, truck_cost, payments'
    );
    return data.map(mapSaleFromDB);
};

export const saveSale = async (sale: SaleRecord) => {
    const dbData = mapSaleToDB(sale);
    const { error } = await supabase.from('avt_sales').upsert(dbData);
    if (error) throw error;
    
    // Backup data to secondary write-only database
    await insertToSecondaryDb('avt_sales', dbData);
};

export const updateSale = async (sale: SaleRecord) => {
    await saveSale(sale);
};

export const deleteSale = async (id: string) => {
    const { error } = await supabase.from('avt_sales').delete().eq('id', id);
    if (error) throw error;
};
