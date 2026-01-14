import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function inspectTable() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Inspecting prompt_logs table...\n');

    // Get one record to see all columns
    const { data, error } = await supabase
        .from('prompt_logs')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No data in table');
        return;
    }

    console.log('📋 Columns in prompt_logs:');
    console.log(JSON.stringify(data[0], null, 2));
}

inspectTable().catch(console.error);
