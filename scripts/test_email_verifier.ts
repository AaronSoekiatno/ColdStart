/**
 * Test Email Verifier with Known Valid and Invalid Emails
 *
 * Tests the Rapid Email Verifier API to ensure it correctly:
 * - Accepts valid emails
 * - Rejects invalid emails
 * - Detects non-existent mailboxes
 * - Identifies disposable emails
 */

import { verifyEmailWithRapid } from './email_pattern_matcher';

interface TestCase {
  email: string;
  expectedValid: boolean;
  expectedDeliverable: boolean;
  description: string;
}

const testCases: TestCase[] = [
  // Valid emails (should pass)
  {
    email: 'test@gmail.com',
    expectedValid: true,
    expectedDeliverable: true,
    description: 'Valid Gmail address',
  },
  {
    email: 'support@google.com',
    expectedValid: true,
    expectedDeliverable: true,
    description: 'Valid Google support email',
  },

  // Invalid syntax (should fail)
  {
    email: 'notanemail',
    expectedValid: false,
    expectedDeliverable: false,
    description: 'Invalid email syntax (no @ symbol)',
  },
  {
    email: 'invalid@',
    expectedValid: false,
    expectedDeliverable: false,
    description: 'Invalid email syntax (no domain)',
  },
  {
    email: '@nodomain.com',
    expectedValid: false,
    expectedDeliverable: false,
    description: 'Invalid email syntax (no local part)',
  },

  // Non-existent domains (should fail)
  {
    email: 'user@thisdoesnotexist123456789.com',
    expectedValid: false,
    expectedDeliverable: false,
    description: 'Non-existent domain',
  },

  // Non-existent mailboxes (domain exists, mailbox doesn't)
  {
    email: 'thisprobablydoesnotexist12345@gmail.com',
    expectedValid: false,
    expectedDeliverable: false,
    description: 'Non-existent mailbox (Gmail)',
  },
  {
    email: 'fakefounderemail99999@stripe.com',
    expectedValid: false,
    expectedDeliverable: false,
    description: 'Non-existent mailbox (Stripe)',
  },

  // Disposable emails (should be detected)
  {
    email: 'test@guerrillamail.com',
    expectedValid: false,
    expectedDeliverable: false,
    description: 'Disposable email (Guerrilla Mail)',
  },
  {
    email: 'test@mailinator.com',
    expectedValid: false,
    expectedDeliverable: false,
    description: 'Disposable email (Mailinator)',
  },

  // Real startup founder emails (if you know any valid ones)
  {
    email: 'patrick@stripe.com',
    expectedValid: true,
    expectedDeliverable: true,
    description: 'Known founder email (Patrick Collison, Stripe)',
  },
];

async function runTests() {
  console.log('🧪 Testing Email Verifier Library\n');
  console.log('Testing Rapid Email Verifier API with known valid/invalid emails...\n');
  console.log('=' .repeat(80));

  let passed = 0;
  let failed = 0;
  const results: Array<{
    email: string;
    description: string;
    passed: boolean;
    expected: { valid: boolean; deliverable: boolean };
    actual: { valid: boolean; deliverable: boolean };
    reason?: string;
  }> = [];

  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    console.log(`\n[${i + 1}/${testCases.length}] Testing: ${test.email}`);
    console.log(`Description: ${test.description}`);
    console.log(`Expected: ${test.expectedDeliverable ? '✅ Deliverable' : '❌ Not Deliverable'}`);

    try {
      const result = await verifyEmailWithRapid(test.email);

      console.log(`Actual: ${result.isDeliverable ? '✅ Deliverable' : '❌ Not Deliverable'}`);
      console.log(`  - Valid: ${result.isValid}`);
      console.log(`  - Deliverable: ${result.isDeliverable}`);
      console.log(`  - Confidence: ${(result.confidence * 100).toFixed(0)}%`);
      console.log(`  - Reason: ${result.reason}`);

      // Check if result matches expectation
      const testPassed = result.isDeliverable === test.expectedDeliverable;

      if (testPassed) {
        console.log(`✅ TEST PASSED`);
        passed++;
      } else {
        console.log(`❌ TEST FAILED`);
        console.log(`   Expected deliverable=${test.expectedDeliverable}, got deliverable=${result.isDeliverable}`);
        failed++;
      }

      results.push({
        email: test.email,
        description: test.description,
        passed: testPassed,
        expected: {
          valid: test.expectedValid,
          deliverable: test.expectedDeliverable,
        },
        actual: {
          valid: result.isValid,
          deliverable: result.isDeliverable,
        },
        reason: result.reason,
      });

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.log(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failed++;

      results.push({
        email: test.email,
        description: test.description,
        passed: false,
        expected: {
          valid: test.expectedValid,
          deliverable: test.expectedDeliverable,
        },
        actual: {
          valid: false,
          deliverable: false,
        },
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 TEST SUMMARY\n');
  console.log(`Total tests: ${testCases.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

  // Show failed tests
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`\n  - ${r.email}`);
      console.log(`    ${r.description}`);
      console.log(`    Expected: deliverable=${r.expected.deliverable}`);
      console.log(`    Actual: deliverable=${r.actual.deliverable}`);
      console.log(`    Reason: ${r.reason}`);
    });
  }

  console.log('\n' + '='.repeat(80));

  // Return exit code
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
