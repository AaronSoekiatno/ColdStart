/**
 * Comprehensive Founder Email Verification Script
 *
 * Verifies ALL founder emails in startups.founder_emails column
 *
 * IMPORTANT: Rapid Email Verifier can only verify domain existence,
 * NOT specific mailbox existence for catch-all domains.
 *
 * Confidence Scoring:
 * - 0.95 (95%) = From trusted source (manual CSV data with ✅ REAL tag)
 * - 0.85 (85%) = Pattern matched + most common pattern (first@domain)
 * - 0.70 (70%) = Pattern matched + common pattern (first.last@domain)
 * - 0.50 (50%) = Domain verified but uncertain
 * - 0.30 (30%) = Generic email (hello@, info@, contact@) - HIGH RISK
 * - 0.0 (0%) = Invalid or undeliverable
 */

import { createClient } from '@supabase/supabase-js';
import { verifyEmailWithRapid, generateEmailPatterns } from './email_pattern_matcher';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Startup {
  id: string;
  name: string;
  website: string | null;
  founder_names: string | null;
  founder_emails: string | null;
}

interface EmailVerificationResult {
  startup_id: string;
  startup_name: string;
  email: string;
  verified: boolean;
  confidence: number;
  reason: string;
  founder_name?: string;
  suggested_alternatives?: string[];
}

/**
 * Check if email looks like it was extracted from company name
 */
function isGenericEmail(email: string): boolean {
  const genericPrefixes = ['hello', 'info', 'contact', 'support', 'team', 'hi', 'admin'];
  const prefix = email.split('@')[0]?.toLowerCase();
  return genericPrefixes.includes(prefix);
}

/**
 * Extract domain from website URL
 */
function extractDomain(website: string | null | undefined): string | null {
  if (!website) return null;

  try {
    const cleaned = website
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase();

    return cleaned || null;
  } catch {
    return null;
  }
}

/**
 * Parse comma-separated list
 */
function parseCommaSeparated(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
}

/**
 * Verify a single email with confidence scoring
 */
async function verifyEmail(
  email: string,
  startup: Startup,
  founderName?: string
): Promise<EmailVerificationResult> {
  console.log(`  🔍 Verifying: ${email}${founderName ? ` (${founderName})` : ''}`);

  // Verify with Rapid API
  const apiResult = await verifyEmailWithRapid(email);

  let confidence = 0;
  let verified = false;
  let reason = apiResult.reason || 'Unknown';
  const suggestedAlternatives: string[] = [];

  if (apiResult.isDeliverable) {
    verified = true;

    // Adjust confidence based on email characteristics
    if (isGenericEmail(email)) {
      // Generic email like hello@company.com = LOW CONFIDENCE (30%)
      confidence = 0.30;
      reason = 'Domain verified but GENERIC email (hello@/info@/contact@) - HIGH RISK';

      // Suggest better alternatives if we have founder name
      if (founderName && startup.website) {
        const domain = extractDomain(startup.website);
        if (domain) {
          const patterns = generateEmailPatterns(founderName, domain);
          suggestedAlternatives.push(...patterns.slice(0, 3).map(p => p.email));
        }
      }
    } else if (founderName && startup.website) {
      // Check which pattern this email matches
      const domain = extractDomain(startup.website);
      if (domain) {
        const patterns = generateEmailPatterns(founderName, domain);
        const matchIndex = patterns.findIndex(p => p.email === email);

        if (matchIndex === 0) {
          // First pattern (first@domain) = 85% confidence
          confidence = 0.85;
          reason = 'Verified + matches most common pattern (first@domain)';
        } else if (matchIndex === 1) {
          // Second pattern (first.last@domain) = 70% confidence
          confidence = 0.70;
          reason = 'Verified + matches common pattern (first.last@domain)';
        } else if (matchIndex >= 2 && matchIndex <= 3) {
          // Third/fourth pattern = 60% confidence
          confidence = 0.60;
          reason = `Verified + matches pattern #${matchIndex + 1}`;
        } else {
          // No pattern match or less common
          confidence = 0.50;
          reason = 'Domain verified but pattern uncertain';
        }
      } else {
        confidence = 0.50;
        reason = 'Domain verified but no website to check pattern';
      }
    } else {
      // No founder name to verify pattern against
      confidence = 0.50;
      reason = 'Domain verified but no founder name for pattern matching';
    }
  } else {
    // Not deliverable
    verified = false;
    confidence = 0;
    reason = apiResult.reason || 'Email verification failed';

    // Suggest alternatives if we have founder name and website
    if (founderName && startup.website) {
      const domain = extractDomain(startup.website);
      if (domain) {
        const patterns = generateEmailPatterns(founderName, domain);
        suggestedAlternatives.push(...patterns.slice(0, 3).map(p => p.email));
      }
    }
  }

  console.log(`     ${verified ? '✅' : '❌'} Confidence: ${(confidence * 100).toFixed(0)}% - ${reason}`);

  if (suggestedAlternatives.length > 0) {
    console.log(`     💡 Try: ${suggestedAlternatives.slice(0, 2).join(', ')}`);
  }

  // Small delay to be respectful to API
  await new Promise(resolve => setTimeout(resolve, 250));

  return {
    startup_id: startup.id,
    startup_name: startup.name,
    email,
    verified,
    confidence,
    reason,
    founder_name: founderName,
    suggested_alternatives: suggestedAlternatives.length > 0 ? suggestedAlternatives : undefined,
  };
}

async function main() {
  console.log('🔍 Comprehensive Founder Email Verification\n');
  console.log('Verifies ALL emails in startups.founder_emails column');
  console.log('\nConfidence scoring:');
  console.log('  - 85%: Pattern matched + most common pattern (first@domain)');
  console.log('  - 70%: Pattern matched + common pattern (first.last@domain)');
  console.log('  - 50%: Domain verified but uncertain');
  console.log('  - 30%: Generic email (hello@, info@) - HIGH RISK');
  console.log('  - 0%: Invalid or undeliverable\n');

  // Check arguments
  const args = process.argv.slice(2);
  const limit = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1] || '10')
    : undefined;
  const autoUpdate = args.includes('--auto');

  // Fetch startups with founder emails
  console.log('📥 Fetching startups from database...\n');

  let query = supabase
    .from('startups')
    .select('id, name, website, founder_names, founder_emails')
    .not('founder_emails', 'is', null);

  if (limit) {
    query = query.limit(limit);
  }

  const { data: startups, error } = await query;

  if (error) {
    console.error('❌ Error fetching startups:', error.message);
    process.exit(1);
  }

  if (!startups || startups.length === 0) {
    console.log('⚠️  No startups with founder emails found in database.');
    process.exit(0);
  }

  console.log(`Found ${startups.length} startups with founder emails\n`);
  console.log('='.repeat(80));

  // Process each startup
  const allResults: EmailVerificationResult[] = [];
  let totalEmails = 0;
  let verifiedCount = 0;
  let unverifiedCount = 0;
  let genericEmailCount = 0;

  for (let i = 0; i < startups.length; i++) {
    const startup = startups[i];

    console.log(`\n[${i + 1}/${startups.length}] ${startup.name}`);

    const emails = parseCommaSeparated(startup.founder_emails);
    const founderNames = parseCommaSeparated(startup.founder_names);

    if (emails.length === 0) continue;

    totalEmails += emails.length;

    // Verify each email
    for (let j = 0; j < emails.length; j++) {
      const email = emails[j];
      const founderName = founderNames[j]; // May be undefined if fewer names than emails

      try {
        const result = await verifyEmail(email, startup, founderName);
        allResults.push(result);

        if (result.verified) {
          verifiedCount++;
          if (result.confidence === 0.30) {
            genericEmailCount++;
          }
        } else {
          unverifiedCount++;
        }
      } catch (error) {
        console.error(`     ❌ Error:`, error instanceof Error ? error.message : 'Unknown error');
        unverifiedCount++;
        allResults.push({
          startup_id: startup.id,
          startup_name: startup.name,
          email,
          verified: false,
          confidence: 0,
          reason: error instanceof Error ? error.message : 'Verification error',
          founder_name: founderName,
        });
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 VERIFICATION SUMMARY\n');
  console.log(`Total startups: ${startups.length}`);
  console.log(`Total emails: ${totalEmails}`);
  console.log(`✅ Verified: ${verifiedCount}`);
  console.log(`❌ Unverified: ${unverifiedCount}`);
  console.log(`⚠️  Generic emails (HIGH RISK): ${genericEmailCount}`);
  console.log(`Success rate: ${((verifiedCount / totalEmails) * 100).toFixed(1)}%`);

  // Breakdown by confidence
  console.log('\n📈 Confidence Distribution:\n');
  const confidenceBuckets = {
    'High (85%)': allResults.filter(r => r.confidence >= 0.85).length,
    'Good (70-84%)': allResults.filter(r => r.confidence >= 0.70 && r.confidence < 0.85).length,
    'Medium (50-69%)': allResults.filter(r => r.confidence >= 0.50 && r.confidence < 0.70).length,
    'Low/Generic (30%)': allResults.filter(r => r.confidence === 0.30).length,
    'Invalid (0%)': allResults.filter(r => r.confidence === 0).length,
  };

  Object.entries(confidenceBuckets).forEach(([bucket, count]) => {
    console.log(`  ${bucket}: ${count} (${((count / allResults.length) * 100).toFixed(1)}%)`);
  });

  // Show generic emails (HIGH RISK)
  const genericEmails = allResults.filter(r => r.confidence === 0.30);
  if (genericEmails.length > 0) {
    console.log('\n⚠️  GENERIC EMAILS (HIGH RISK - likely wrong):\n');
    genericEmails.slice(0, 15).forEach(r => {
      console.log(`  - ${r.startup_name}: ${r.email}`);
      if (r.suggested_alternatives && r.suggested_alternatives.length > 0) {
        console.log(`    💡 Better options: ${r.suggested_alternatives.slice(0, 2).join(', ')}`);
      }
    });
    if (genericEmails.length > 15) {
      console.log(`  ... and ${genericEmails.length - 15} more`);
    }
  }

  // Show invalid emails
  const invalidEmails = allResults.filter(r => r.confidence === 0);
  if (invalidEmails.length > 0) {
    console.log('\n❌ INVALID EMAILS:\n');
    invalidEmails.slice(0, 10).forEach(r => {
      console.log(`  - ${r.startup_name}: ${r.email} - ${r.reason}`);
      if (r.suggested_alternatives && r.suggested_alternatives.length > 0) {
        console.log(`    💡 Try: ${r.suggested_alternatives.slice(0, 2).join(', ')}`);
      }
    });
    if (invalidEmails.length > 10) {
      console.log(`  ... and ${invalidEmails.length - 10} more`);
    }
  }

  // Export results to JSON
  const fs = await import('fs');
  const outputPath = 'yc_companies/email_verification_results.json';
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`\n💾 Full results saved to: ${outputPath}`);

  console.log('\n' + '='.repeat(80));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
