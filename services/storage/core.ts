import { supabase } from '../supabaseClient';

// --- GENERIC FETCH HELPER (To bypass 1000 row limit efficiently) ---

export const fetchLargeData = async (table: string, columns: string, orderBy: string = 'date', limit: number = 5000) => {
    let allData: any[] = [];

    // First, find the total count dynamically for efficiency
    const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

    if (countError || count === null || count === 0) {
        // Fallback or empty
        if (count === 0) return [];
        // If error fetching count, fallback to basic loop
        let from = 0;
        let step = 1000;

        while (from < limit) {
            const to = from + step - 1;
            const { data, error } = await supabase
                .from(table)
                .select(columns)
                .order(orderBy, { ascending: false })
                .order('id', { ascending: true })
                .range(from, to);

            if (error) {
                console.error(`Error fetching ${table}:`, error.message);
                break;
            }

            if (!data || data.length === 0) break;

            allData = [...allData, ...data];
            if (data.length < step) break;
            from += step;
        }
        return allData;
    }

    // Parallelize fetches based on count
    const totalToFetch = Math.min(count, limit);
    const step = 1000;
    const promises = [];

    for (let from = 0; from < totalToFetch; from += step) {
        const to = Math.min(from + step - 1, totalToFetch - 1);
        const promise = supabase
            .from(table)
            .select(columns)
            .order(orderBy, { ascending: false })
            .order('id', { ascending: true })
            .range(from, to)
            .then(({ data, error }) => {
                if (error) throw error;
                return data || [];
            });
        promises.push(promise);
    }

    try {
        const results = await Promise.all(promises);
        // Flatten array of arrays
        allData = results.reduce((acc, curr) => acc.concat(curr), []);
    } catch (e) {
        console.error(`Error in parallel fetch for ${table}:`, e);
        return [];
    }

    return allData;
};
