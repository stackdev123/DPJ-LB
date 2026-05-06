import { supabase } from '../supabaseClient';
import { DriverTransaction } from '../../types';
import { fetchLargeData } from './core';

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

export const getDriverTransactions = async (): Promise<DriverTransaction[]> => {
    const data = await fetchLargeData(
        'avt_driver_transactions',
        'id, driver_name, date, amount, type, notes'
    );
    return data.map(mapDriverTxFromDB);
};

export const saveDriverTransaction = async (tx: DriverTransaction) => {
    const dbData = mapDriverTxToDB(tx);
    const { error } = await supabase.from('avt_driver_transactions').insert(dbData);
    if (error) throw error;
};
