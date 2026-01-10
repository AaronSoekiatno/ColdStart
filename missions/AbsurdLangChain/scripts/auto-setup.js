#!/usr/bin/env node

/**
 * Auto-Setup Script
 * 
 * Runs automatically after yarn install to provision credentials
 * and configure IDE settings. Zero-friction setup for candidates.
 */

const fs = require('fs');
const path = require('path');
const { fetchCredentials, writeEnvFile } = require('./provision-key.js');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

/**
 * Check if .env.local exists
 */
function envFileExists() {
  const envPath = path.join(process.cwd(), '.env.local');
  return fs.existsSync(envPath);
}

/**
 * Auto-provision credentials
 */
async function autoProvision() {
  try {
    logInfo('Auto-provisioning credentials...');
    const credentials = await fetchCredentials();
    
    // Check if candidate ID is configured (required for hooks)
    if (!credentials.CANDIDATE_ID && !credentials.CANDIDATE_UUID) {
      logWarning('Provisioning endpoint did not return candidate ID');
      logWarning('Candidates will need to run: yarn mission:start');
      return false;
    }
    
    writeEnvFile(credentials);
    logSuccess('Credentials provisioned automatically');
    return true;
  } catch (error) {
    // Don't fail the install if provisioning fails
    logWarning(`Auto-provisioning failed: ${error.message}`);
    logWarning('Candidates can manually run: yarn mission:start');
    return false;
  }
}

/**
 * Setup Cursor hooks for automatic prompt tracking
 */
function setupCursorHooks(candidateId) {
  if (!candidateId) {
    logWarning('No candidate ID available - skipping hook setup');
    return false;
  }

  const isWindows = process.platform === 'win32';
  const hooksScriptPath = isWindows 
    ? path.join(process.cwd(), '.cursor', 'setup-hooks.ps1')
    : path.join(process.cwd(), '.cursor', 'setup-hooks.sh');

  if (!fs.existsSync(hooksScriptPath)) {
    logWarning('Cursor hooks setup script not found - hooks may not be configured');
    return false;
  }

  try {
    if (isWindows) {
      // Windows PowerShell
      const { execSync } = require('child_process');
      execSync(
        `powershell -ExecutionPolicy Bypass -File "${hooksScriptPath}" -CandidateId "${candidateId}"`,
        { stdio: 'inherit', cwd: process.cwd() }
      );
    } else {
      // Unix/Linux/Mac
      fs.chmodSync(hooksScriptPath, '755');
      const { execSync } = require('child_process');
      execSync(`"${hooksScriptPath}" "${candidateId}"`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    }
    logSuccess('Cursor hooks configured');
    return true;
  } catch (error) {
    logWarning(`Failed to setup Cursor hooks: ${error.message}`);
    return false;
  }
}

/**
 * Main setup function
 */
async function main() {
  // Check if already configured
  if (envFileExists()) {
    logSuccess('Environment already configured');
    return;
  }
  
  log('\n🔧 Auto-Setup: Configuring your environment...\n');
  
  // Try to auto-provision
  const provisioned = await autoProvision();
  
  if (provisioned) {
    // Read credentials to get candidate ID for hooks
    const envPath = path.join(process.cwd(), '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const credentials = {};
    
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          credentials[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    
    // Get candidate ID (try both possible names)
    const candidateId = credentials.CANDIDATE_ID || credentials.CANDIDATE_UUID;
    
    // Setup Cursor hooks
    const hooksSetup = setupCursorHooks(candidateId);
    
    if (hooksSetup) {
      log('\n' + colors.bright + '═══════════════════════════════════════════════════════' + colors.reset);
      log(colors.bright + '  ✅ CURSOR HOOKS CONFIGURED' + colors.reset);
      log(colors.bright + '═══════════════════════════════════════════════════════' + colors.reset);
      log('\n' + colors.yellow + '⚠️  IMPORTANT:' + colors.reset);
      log('   1. Restart Cursor IDE to activate hooks');
      log('   2. Use Cursor normally with your own API keys');
      log('   3. All prompts are tracked automatically in the background');
      log('\n' + colors.gray + '   No Cursor settings configuration needed!' + colors.reset);
      log(colors.bright + '═══════════════════════════════════════════════════════\n' + colors.reset);
    }
    
    log('\n✅ Auto-setup complete! You can start coding now.\n');
  } else {
    log('\n⚠️  Auto-setup incomplete. Run: yarn mission:start\n');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Auto-setup error:', error);
    process.exit(1);
  });
}

module.exports = { main, setupCursorHooks };

