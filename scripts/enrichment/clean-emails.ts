import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

interface CSVRow {
  'actor/id': string;
  linkedIn: string;
  name: string;
  'user-desc': string;
  email: string;
}

function extractEmail(text: string): string | null {
  if (!text) return null;
  
  // Remove leading/trailing whitespace
  text = text.trim();
  
  // Email regex pattern
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  
  // Find email in the text
  const match = text.match(emailRegex);
  if (!match) return null;
  
  // Extract just the email
  let email = match[0];
  
  // Remove any trailing characters that might be part of the email but shouldn't be
  // (like punctuation that's clearly not part of the email)
  email = email.replace(/[.,;:!?]+$/, '');
  
  // Normalize: lowercase and trim
  email = email.toLowerCase().trim();
  
  return email;
}

function cleanEmails(inputPath: string, outputPath: string) {
  console.log('Reading CSV file...');
  const fileContent = fs.readFileSync(inputPath, 'utf-8');
  
  // Parse CSV
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as CSVRow[];
  
  console.log(`Found ${records.length} rows`);
  
  // Extract and clean emails
  const emails = new Set<string>();
  let processed = 0;
  let invalid = 0;
  
  for (const record of records) {
    const email = extractEmail(record.email);
    if (email) {
      emails.add(email);
      processed++;
    } else {
      invalid++;
      if (invalid <= 10) {
        console.log(`  Invalid email entry: "${record.email?.substring(0, 50)}..."`);
      }
    }
  }
  
  console.log(`\nProcessed: ${processed} valid emails`);
  console.log(`Invalid: ${invalid} entries`);
  console.log(`Unique emails: ${emails.size}`);
  console.log(`Duplicates removed: ${processed - emails.size}`);
  
  // Convert to array and sort
  const emailArray = Array.from(emails).sort();
  
  // Write to output CSV
  const outputContent = 'email\n' + emailArray.map(email => email).join('\n');
  fs.writeFileSync(outputPath, outputContent, 'utf-8');
  
  console.log(`\nCleaned emails saved to: ${outputPath}`);
}

// Main execution
const inputFile = path.join(
  __dirname,
  '..',
  'waitlist users hermes - dataset_linkedin-post-comments_2025-12-15_04-52-23-668 (1).csv.csv'
);

const outputFile = path.join(
  __dirname,
  '..',
  'waitlist_users_cleaned_emails.csv'
);

cleanEmails(inputFile, outputFile);
