import { supabase } from '../supabaseClient';
import { Customer, Supplier, Coop, MasterItem } from '../../types';

// Customers
export const getCustomers = async (): Promise<Customer[]> => {
    const { data, error } = await supabase.from('avt_customers').select('id, name, address, phone').order('name');
    if (error) { 
        console.error('Error fetching customers:', error.message); 
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
        console.error('Error fetching suppliers:', error.message); 
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
        console.error('Error fetching coops:', error.message); 
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
        console.error('Error fetching drivers list:', error.message); 
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
        console.error('Error fetching plates list:', error.message); 
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
