import { generateEmailPatterns } from './email_pattern_matcher';

// Test cases from the 50% confidence emails
const testCases = [
  {
    founderName: 'Dr. Sabrine Obbad',
    email: 'dr@alaradental.com',
    domain: 'alaradental.com',
  },
  {
    founderName: 'Erik Vank',
    email: 'erik@usenarrative.ai',
    domain: 'usenarrative.ai',
  },
  {
    founderName: 'Stephen Xu',
    email: 'about@verialabs.com',
    domain: 'verialabs.com',
  },
  {
    founderName: 'Cayden Liao',
    email: 'stephen@verialabs.com',
    domain: 'verialabs.com',
  },
];

console.log('🔍 Debugging Why Emails Get 50% Confidence\n');

testCases.forEach((test, i) => {
  console.log(`\n[${i + 1}] ${test.founderName}`);
  console.log(`Email: ${test.email}`);
  console.log(`Domain: ${test.domain}`);

  const patterns = generateEmailPatterns(test.founderName, test.domain);
  console.log(`\nGenerated patterns:`);
  patterns.forEach((p, idx) => {
    console.log(`  ${idx}. ${p.email} (${p.pattern})`);
  });

  const matchIndex = patterns.findIndex(p => p.email === test.email);
  console.log(`\nMatch index: ${matchIndex}`);

  if (matchIndex === -1) {
    console.log('❌ EMAIL DOES NOT MATCH ANY PATTERN');
    console.log('   This is why it gets 50% confidence!');
    console.log('   Reason: Pattern generator creates different email than what we have');
  } else {
    console.log(`✅ Matches pattern #${matchIndex}`);
  }

  console.log('─'.repeat(80));
});
