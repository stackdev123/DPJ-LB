import { supabase } from '../supabaseClient';

// --- GENERIC FETCH HELPER (To bypass 1000 row limit efficiently) ---

export const fetchLargeData = async (table: string, columns: string, orderBy: string = 'date', limit: number = 100000, retries: number = 3) => {
    let allData: any[] = [];

    // Helper for sleeping during retry
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
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
                let loopData: any[] = [];

                while (from < limit) {
                    const to = from + step - 1;
                    const { data, error } = await supabase
                        .from(table)
                        .select(columns)
                        .order(orderBy, { ascending: false })
                        .order('id', { ascending: true })
                        .range(from, to);

                    if (error) {
                        throw error; // Throw to trigger retry
                    }

                    if (!data || data.length === 0) break;

                    loopData = [...loopData, ...data];
                    if (data.length < step) break;
                    from += step;
                }
                return loopData;
            }

            // Run sequentially to avoid rate limiting and CORS errors (429)
            const totalToFetch = Math.min(count, limit);
            const step = 1000;
            const results = [];
            for (let from = 0; from < totalToFetch; from += step) {
                const to = Math.min(from + step - 1, totalToFetch - 1);
                const { data, error } = await supabase
                    .from(table)
                    .select(columns)
                    .order(orderBy, { ascending: false })
                    .order('id', { ascending: true })
                    .range(from, to);

                if (error) throw error;
                if (data) {
                    results.push(data);
                }
            }
            // Flatten array of arrays
            return results.reduce((acc, curr) => acc.concat(curr), []);

        } catch (error) {
            console.error(`Attempt ${attempt} failed fetching ${table}:`, error);
            if (attempt === retries) {
                throw new Error(`Failed fetching ${table} after ${retries} attempts: ${(error as Error).message || error}`);
            }
            await sleep(1000 * attempt); // Exponential backoff
        }
    }

    return [];
};
