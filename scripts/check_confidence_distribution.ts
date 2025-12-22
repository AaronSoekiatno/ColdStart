import * as fs from 'fs';
import * as path from 'path';

const jsonPath = path.join(process.cwd(), 'yc_companies', 'email_verification_results.json');
const results = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

const byConfidence = results.reduce((acc: any, r: any) => {
  const key = r.confidence || 0;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

console.log('\n📊 CONFIDENCE DISTRIBUTION:');
console.log('='.repeat(60));

Object.entries(byConfidence)
  .sort((a: any, b: any) => parseFloat(b[0]) - parseFloat(a[0]))
  .forEach(([conf, count]: any) => {
    const pct = ((count / results.length) * 100).toFixed(1);
    const label = conf === '0.85' ? 'High (85%)' 
                : conf === '0.7' ? 'Good (70%)'
                : conf === '0.5' ? 'Medium (50%)'
                : conf === '0.3' ? 'Low/Generic (30%)'
                : conf === '0' ? 'Invalid (0%)'
                : `${(parseFloat(conf) * 100).toFixed(0)}%`;
    console.log(`  ${label.padEnd(20)} ${String(count).padStart(5)} emails (${pct}%)`);
  });

console.log('─'.repeat(60));
console.log(`  Total: ${results.length} emails`);

const highConf = results.filter((r: any) => r.confidence === 0.85 || r.confidence === 0.70);
const needingReview = results.filter((r: any) => 
  r.confidence === 0.30 || r.confidence === 0.50 || r.confidence === 0.00 || !r.verified
);

console.log(`\n✅ High confidence (70-85%): ${highConf.length} emails`);
console.log(`⚠️  Need review (0%, 30%, 50%): ${needingReview.length} emails`);
console.log(`\n${highConf.length} / ${results.length} = ${((highConf.length / results.length) * 100).toFixed(1)}% are high confidence\n`);

