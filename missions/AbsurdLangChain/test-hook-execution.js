#!/usr/bin/env node
/**
 * Test script to verify hook execution and Supabase logging
 * Run: node test-hook-execution.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧪 Testing Hook Execution...\n');

// Read hooks.json
const hooksJsonPath = path.join(process.cwd(), '.cursor', 'hooks.json');
if (!fs.existsSync(hooksJsonPath)) {
  console.log('❌ hooks.json not found. Run test-hooks-setup.js first.');
  process.exit(1);
}

const hooksConfig = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
console.log('✅ hooks.json loaded');
console.log(`   Candidate ID: ${hooksConfig.candidateId}`);
console.log(`   Supabase URL: ${hooksConfig.supabaseUrl ? '✅' : '❌'}`);
console.log(`   Supabase Key: ${hooksConfig.supabaseServiceKey ? '✅' : '❌'}\n`);

if (!hooksConfig.supabaseUrl || !hooksConfig.supabaseServiceKey) {
  console.log('⚠️  Supabase credentials not configured. Hook will log locally only.');
}

// Test the hook script
const isWindows = process.platform === 'win32';
const hookScript = isWindows
  ? path.join(process.cwd(), '.cursor', 'hooks', 'beforeSubmitPrompt.ps1')
  : path.join(process.cwd(), '.cursor', 'hooks', 'beforeSubmitPrompt.sh');

if (!fs.existsSync(hookScript)) {
  console.log('❌ Hook script not found');
  process.exit(1);
}

console.log('🔧 Testing hook execution with sample prompt...\n');

const testPrompt = "Test prompt: Write a function to calculate fibonacci numbers";

try {
  if (isWindows) {
    execSync(
      `powershell -ExecutionPolicy Bypass -File "${hookScript}" -PromptText "${testPrompt}"`,
      { stdio: 'inherit', cwd: process.cwd() }
    );
  } else {
    execSync(`"${hookScript}" "${testPrompt}"`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  }
  
  console.log('\n✅ Hook executed successfully');
  
  // Check if log file was created
  const logsDir = path.join(process.cwd(), '.cursor', 'logs');
  if (fs.existsSync(logsDir)) {
    const logFiles = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
    if (logFiles.length > 0) {
      console.log(`✅ Log files created: ${logFiles.join(', ')}`);
      
      // Show last few lines of the most recent log
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const logFile = path.join(logsDir, `prompts-${today}.log`);
      if (fs.existsSync(logFile)) {
        const logContent = fs.readFileSync(logFile, 'utf8');
        const lines = logContent.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          console.log('\n📝 Last log entry:');
          console.log(`   ${lines[lines.length - 1]}`);
        }
      }
    }
  }
  
  console.log('\n✅ Hook test complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Check Supabase prompt_logs table for the test entry');
  console.log('   2. Restart Cursor and use it normally');
  console.log('   3. Prompts will be automatically logged');
  
} catch (error) {
  console.log(`\n❌ Hook execution failed: ${error.message}`);
  console.log('\nThis might be expected if Supabase is not configured.');
  console.log('Check .cursor/logs/ for local log files.');
}

