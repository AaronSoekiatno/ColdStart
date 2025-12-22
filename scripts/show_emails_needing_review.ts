/**
 * Quick script to show emails needing manual review
 * Filters for: 30% (generic), 50% (uncertain), and 0% (invalid) confidence
 */

import * as fs from 'fs';
import * as path from 'path';

interface EmailResult {
  startup_id: string;
  startup_name: string;
  email: string;
  verified: boolean;
  confidence: number;
  reason: string;
  founder_name?: string;
  suggested_alternatives?: string[];
}

const jsonPath = path.join(__dirname, 'email_verification_results.json');
const results: EmailResult[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Filter emails that need manual review
const needingReview = results.filter(r => 
  r.confidence === 0.30 || 
  r.confidence === 0.50 || 
  r.confidence === 0.00 || 
  !r.verified
);

console.log('\n📧 EMAILS NEEDING MANUAL REVIEW');
console.log('='.repeat(80));
console.log(`Total emails needing review: ${needingReview.length}\n`);

// Group by issue type
const generic = needingReview.filter(r => r.confidence === 0.30);
const uncertain = needingReview.filter(r => r.confidence === 0.50);
const invalid = needingReview.filter(r => r.confidence === 0.00 || !r.verified);

// Show Generic Emails (HIGH RISK - hello@, info@, etc.)
if (generic.length > 0) {
  console.log(`🔴 GENERIC EMAILS (${generic.length} emails - HIGH RISK!):`);
  console.log('─'.repeat(80));
  generic.forEach(r => {
    console.log(`  ${r.startup_name.padEnd(40)} ${r.email.padEnd(35)} ${r.founder_name || 'N/A'}`);
  });
  console.log('');
}

// Show Uncertain Emails (needs Hunter.io)
if (uncertain.length > 0) {
  console.log(`🟡 UNCERTAIN EMAILS (${uncertain.length} emails - needs Hunter.io):`);
  console.log('─'.repeat(80));
  uncertain.forEach(r => {
    console.log(`  ${r.startup_name.padEnd(40)} ${r.email.padEnd(35)} ${r.founder_name || 'N/A'}`);
    if (r.suggested_alternatives && r.suggested_alternatives.length > 0) {
      console.log(`    💡 Try: ${r.suggested_alternatives.slice(0, 2).join(', ')}`);
    }
  });
  console.log('');
}

// Show Invalid Emails
if (invalid.length > 0) {
  console.log(`❌ INVALID EMAILS (${invalid.length} emails):`);
  console.log('─'.repeat(80));
  invalid.forEach(r => {
    console.log(`  ${r.startup_name.padEnd(40)} ${r.email.padEnd(35)} ${r.founder_name || 'N/A'}`);
    console.log(`    Reason: ${r.reason}`);
    if (r.suggested_alternatives && r.suggested_alternatives.length > 0) {
      console.log(`    💡 Try: ${r.suggested_alternatives.slice(0, 2).join(', ')}`);
    }
  });
  console.log('');
}

// Export to CSV for easy review/editing
const csvPath = path.join(__dirname, 'emails_needing_review.csv');
const csvRows = [
  'Startup Name,Email,Founder Name,Confidence,Issue Type,Reason',
  ...needingReview.map(r => {
    const issueType = r.confidence === 0.30 ? 'Generic' 
                     : r.confidence === 0.50 ? 'Uncertain'
                     : 'Invalid';
    const email = r.email.replace(/"/g, '""');
    const startup = r.startup_name.replace(/"/g, '""');
    const founder = (r.founder_name || '').replace(/"/g, '""');
    const reason = (r.reason || '').replace(/"/g, '""');
    return `"${startup}","${email}","${founder}",${r.confidence},"${issueType}","${reason}"`;
  })
];

fs.writeFileSync(csvPath, csvRows.join('\n'));
console.log(`\n💾 Exported to CSV: ${csvPath}`);
console.log(`   You can open this in Excel/Sheets to review and fix emails\n`);

// Summary
console.log('📊 SUMMARY:');
console.log(`   Generic (30%): ${generic.length} emails`);
console.log(`   Uncertain (50%): ${uncertain.length} emails`);
console.log(`   Invalid (0%): ${invalid.length} emails`);
console.log(`   Total: ${needingReview.length} emails need review\n`);

