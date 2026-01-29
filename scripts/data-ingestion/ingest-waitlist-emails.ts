import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { parse } from 'csv-parse/sync';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

interface EmailRow {
  email: string;
}

/**
 * Parses the cleaned emails CSV file
 */
function parseEmailsCSV(filePath: string): string[] {
  const fileContent = readFileSync(filePath, 'utf-8');
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as EmailRow[];

  return records.map(row => row.email).filter(email => email && email.includes('@'));
}

/**
 * Fetches existing emails from the waitlist table
 */
async function getExistingEmails(): Promise<Set<string>> {
  console.log('Fetching existing emails from waitlist table...');
  
  const existingEmails = new Set<string>();
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('waitlist')
      .select('email')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch existing emails: ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach(row => existingEmails.add(row.email.toLowerCase()));
      hasMore = data.length === pageSize;
      page++;
    }
  }

  console.log(`Found ${existingEmails.size} existing emails in waitlist\n`);
  return existingEmails;
}

/**
 * Inserts emails into the waitlist table in batches
 */
async function insertEmails(emails: string[], batchSize: number = 100) {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(emails.length / batchSize);

    console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} emails)...`);

    // Prepare batch data
    const batchData = batch.map(email => ({
      email: email.toLowerCase().trim(),
    }));

    // Insert batch using upsert to handle duplicates gracefully
    // The unique constraint on email will prevent duplicates
    const { data, error } = await supabase
      .from('waitlist')
      .upsert(batchData, {
        onConflict: 'email',
        ignoreDuplicates: true,
      })
      .select();

    if (error) {
      // If batch insert fails, try individual inserts to identify problematic emails
      console.warn(`  Batch insert failed, trying individual inserts...`);
      
      for (const emailData of batchData) {
        try {
          const { error: insertError } = await supabase
            .from('waitlist')
            .insert(emailData)
            .select();

          if (insertError) {
            // Check if it's a duplicate error
            if (
              insertError.code === '23505' ||
              insertError.message?.includes('duplicate') ||
              insertError.message?.includes('unique')
            ) {
              skipped++;
            } else {
              errors++;
              console.error(`  Error inserting ${emailData.email}: ${insertError.message}`);
            }
          } else {
            inserted++;
          }
        } catch (err) {
          errors++;
          const errorMessage = err instanceof Error ? err.message : String(err);
          console.error(`  Error inserting ${emailData.email}: ${errorMessage}`);
        }
      }
    } else {
      // Count successful inserts
      const insertedCount = data?.length || 0;
      inserted += insertedCount;
      skipped += batch.length - insertedCount;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { inserted, skipped, errors };
}

/**
 * Main function to ingest emails into waitlist table
 */
async function ingestWaitlistEmails() {
  console.log('Starting waitlist email ingestion...\n');

  // Test Supabase connection
  try {
    const { data, error } = await supabase.from('waitlist').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    console.log('✓ Connected to Supabase\n');
  } catch (error) {
    throw new Error(
      `Cannot connect to Supabase. Make sure your database is set up and migrations are run. ` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Read cleaned emails CSV
  const csvPath = join(process.cwd(), 'waitlist_users_cleaned_emails.csv');
  console.log(`Reading emails from: ${csvPath}\n`);

  if (!existsSync(csvPath)) {
    throw new Error(
      `CSV file not found at: ${csvPath}\n` +
      `Please make sure the cleaned emails file exists.`
    );
  }

  const emails = parseEmailsCSV(csvPath);
  console.log(`Found ${emails.length} emails to process\n`);

  // Get existing emails to avoid duplicates
  const existingEmails = await getExistingEmails();

  // Filter out existing emails
  const newEmails = emails.filter(email => !existingEmails.has(email.toLowerCase().trim()));
  
  console.log(`New emails to insert: ${newEmails.length}`);
  console.log(`Already in waitlist: ${emails.length - newEmails.length}\n`);

  if (newEmails.length === 0) {
    console.log('No new emails to insert. All emails are already in the waitlist.');
    return;
  }

  // Insert new emails
  const { inserted, skipped, errors } = await insertEmails(newEmails);

  console.log(`\n=== Ingestion Complete ===`);
  console.log(`Total emails in CSV: ${emails.length}`);
  console.log(`Already existed: ${emails.length - newEmails.length}`);
  console.log(`New emails attempted: ${newEmails.length}`);
  console.log(`Successfully inserted: ${inserted}`);
  console.log(`Skipped (duplicates): ${skipped}`);
  console.log(`Errors: ${errors}`);
}

// Run the ingestion
if (process.argv[1] === import.meta.filename) {
  ingestWaitlistEmails()
    .then(() => {
      console.log('\nWaitlist email ingestion completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nWaitlist email ingestion failed:', error);
      process.exit(1);
    });
}

export { ingestWaitlistEmails };




