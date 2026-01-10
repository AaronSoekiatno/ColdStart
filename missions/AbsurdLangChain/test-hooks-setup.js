#!/usr/bin/env node
/**
 * Test script to verify Cursor hooks setup
 * Run: node test-hooks-setup.js
 */

const { setupCursorHooks } = require('./scripts/auto-setup.js');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Cursor Hooks Setup...\n');

// Test 1: Check if hooks directory exists
const hooksDir = path.join(process.cwd(), '.cursor');
if (!fs.existsSync(hooksDir)) {
  console.log('❌ .cursor directory not found');
  process.exit(1);
}
console.log('✅ .cursor directory exists');

// Test 2: Check if setup script exists
const isWindows = process.platform === 'win32';
const setupScript = isWindows 
  ? path.join(hooksDir, 'setup-hooks.ps1')
  : path.join(hooksDir, 'setup-hooks.sh');
  
if (!fs.existsSync(setupScript)) {
  console.log('❌ Setup script not found');
  process.exit(1);
}
console.log('✅ Setup script exists');

// Test 3: Check if hook scripts exist
const beforeSubmitHook = isWindows
  ? path.join(hooksDir, 'hooks', 'beforeSubmitPrompt.ps1')
  : path.join(hooksDir, 'hooks', 'beforeSubmitPrompt.sh');

if (!fs.existsSync(beforeSubmitHook)) {
  console.log('❌ beforeSubmitPrompt hook not found');
  process.exit(1);
}
console.log('✅ Hook scripts exist');

// Test 4: Check if .env.local exists with candidate ID
const envPath = path.join(process.cwd(), '.env.local');
let candidateId = null;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const candidateIdMatch = envContent.match(/CANDIDATE_ID=(.+)/);
  const candidateUuidMatch = envContent.match(/CANDIDATE_UUID=(.+)/);
  candidateId = candidateIdMatch ? candidateIdMatch[1].trim() : (candidateUuidMatch ? candidateUuidMatch[1].trim() : null);
  
  if (candidateId) {
    console.log(`✅ Found candidate ID in .env.local: ${candidateId}`);
  } else {
    console.log('⚠️  No candidate ID found in .env.local');
    candidateId = 'test-candidate-12345';
    console.log(`   Using test candidate ID: ${candidateId}`);
  }
} else {
  console.log('⚠️  .env.local not found');
  candidateId = 'test-candidate-12345';
  console.log(`   Using test candidate ID: ${candidateId}`);
}

// Test 5: Run setup
console.log('\n🔧 Running hook setup...');
try {
  const result = setupCursorHooks(candidateId);

  if (result) {
    console.log('✅ Hook setup successful');
    
    // Test 6: Check if hooks.json was created
    const hooksJsonPath = path.join(hooksDir, 'hooks.json');
    if (fs.existsSync(hooksJsonPath)) {
      const hooksJson = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
      console.log('✅ hooks.json created');
      console.log(`   Candidate ID: ${hooksJson.candidateId}`);
      console.log(`   Supabase URL: ${hooksJson.supabaseUrl ? '✅ Set' : '❌ Not set'}`);
      console.log(`   Supabase Key: ${hooksJson.supabaseServiceKey ? '✅ Set' : '❌ Not set'}`);
    } else {
      console.log('❌ hooks.json not created');
      process.exit(1);
    }
  } else {
    console.log('❌ Hook setup failed');
    process.exit(1);
  }
} catch (error) {
  console.log(`❌ Error during setup: ${error.message}`);
  process.exit(1);
}

console.log('\n✅ All tests passed!');
console.log('\n📝 Next steps:');
console.log('   1. Restart Cursor IDE to activate hooks');
console.log('   2. Use Cursor normally - prompts will be logged to Supabase');
console.log('   3. Check .cursor/logs/ for local log files');

