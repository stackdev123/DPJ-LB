import { supabase } from '../supabaseClient';
import { insertToSecondaryDb } from '../secondaryDBClient';
import { PurchaseRecord } from '../../types';
import { fetchLargeData } from './core';

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

// --- TRANSACTIONS ---

export const getPurchases = async (): Promise<PurchaseRecord[]> => {
    const data = await fetchLargeData(
        'avt_purchases', 
        'id, date, supplier, coop, driver, plate, heads, kg, avg_weight, buy_price, total_buy_cost, is_distributed'
    );
    return data.map(mapPurchaseFromDB);
};

export const savePurchases = async (newPurchases: PurchaseRecord[]) => {
    const dbData = newPurchases.map(mapPurchaseToDB);
    const { error } = await supabase.from('avt_purchases').upsert(dbData);
    if (error) throw error;
    
    // Backup data to secondary write-only database
    await insertToSecondaryDb('avt_purchases', dbData);
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
