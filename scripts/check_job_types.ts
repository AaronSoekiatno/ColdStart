
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkJobTypes() {
  console.log('Checking distinct job_type values...');
  // We can't do distinct easily with simple query, so we'll fetch a bunch and aggregate
  const { data, error } = await supabase
    .from('jobs')
    .select('job_type')
    .limit(1000);

  if (error) {
    console.error(error);
    return;
  }

  const types = new Set(data.map(j => j.job_type));
  console.log('Found job types:', Array.from(types));
}

checkJobTypes();
