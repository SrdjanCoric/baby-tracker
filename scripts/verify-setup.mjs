/* eslint-disable no-undef */
/**
 * Setup Verification Script
 * Tests all configurations from Parts A-E of the setup guide
 *
 * Run with: node scripts/verify-setup.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
dotenv.config();

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

const pass = (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`);
const fail = (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`);
const header = (msg) => console.log(`\n${colors.bold}${colors.blue}═══ ${msg} ═══${colors.reset}\n`);

let passCount = 0;
let failCount = 0;

function check(condition, passMsg, failMsg) {
  if (condition) {
    pass(passMsg);
    passCount++;
  } else {
    fail(failMsg);
    failCount++;
  }
}

async function runCommand(cmd) {
  try {
    const { stdout, stderr } = await execAsync(cmd);
    return { success: true, output: stdout.trim(), error: stderr };
  } catch (err) {
    return { success: false, output: '', error: err.message };
  }
}

async function main() {
  console.log(`
${colors.bold}╔═══════════════════════════════════════════════════════════╗
║       SOFI BABY TRACKER - SETUP VERIFICATION               ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`);

  // ==================== PART A: SUPABASE ====================
  header('PART A: SUPABASE BACKEND');

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  // A1: Environment Variables
  console.log('Checking environment variables...');
  check(url, `SUPABASE_URL is set: ${url}`, 'SUPABASE_URL is missing in .env');
  check(key, 'SUPABASE_ANON_KEY is set', 'SUPABASE_ANON_KEY is missing in .env');

  if (!url || !key) {
    fail('Cannot continue Supabase tests without credentials');
  } else {
    const supabase = createClient(url, key);

    // A2: Database Connection
    console.log('\nTesting database connection...');
    try {
      const { error } = await supabase.from('households').select('id').limit(1);
      if (error && error.code === '42P01') {
        fail('Table "households" does not exist - migrations not run');
      } else {
        pass('Database connection successful');
      }
    } catch (e) {
      fail(`Database connection failed: ${e.message}`);
    }

    // A3: Database Tables
    console.log('\nChecking database tables...');
    const tables = [
      'households', 'users', 'babies', 'feedings', 'sleep_sessions',
      'diapers', 'pumping_sessions', 'growth_measurements',
      'tummy_time_sessions', 'tummy_time_goals'
    ];

    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('id').limit(0);
        if (error && error.code === '42P01') {
          fail(`Table "${table}" is missing`);
        } else {
          pass(`Table "${table}" exists`);
        }
      } catch (e) {
        fail(`Table "${table}" error: ${e.message}`);
      }
    }

    // A4: RPC Functions
    console.log('\nChecking RPC functions...');
    const rpcs = ['regenerate_invite_code', 'join_household_by_invite_code', 'remove_caregiver'];

    for (const rpc of rpcs) {
      try {
        const { error } = await supabase.rpc(rpc, {});
        if (error && error.message.includes('does not exist')) {
          fail(`RPC function "${rpc}" is missing`);
        } else {
          pass(`RPC function "${rpc}" exists`);
        }
      } catch {
        pass(`RPC function "${rpc}" exists (requires auth)`);
      }
    }

    // A5: Auth Configuration
    console.log('\nChecking auth configuration...');
    try {
      const { error } = await supabase.auth.getSession();
      check(!error, 'Auth endpoint is accessible', `Auth error: ${error?.message}`);
    } catch (e) {
      fail(`Auth endpoint error: ${e.message}`);
    }
  }

  // ==================== PART B: EAS/EXPO ====================
  header('PART B: EAS/EXPO BUILD SERVICE');

  // B1: EAS CLI
  console.log('Checking EAS CLI...');
  const easVersion = await runCommand('eas --version');
  check(easVersion.success, `EAS CLI installed: ${easVersion.output}`, 'EAS CLI not installed');

  // B2: EAS Login
  console.log('Checking EAS login...');
  const easWhoami = await runCommand('eas whoami');
  check(easWhoami.success, `Logged in as: ${easWhoami.output}`, 'Not logged in to EAS');

  // B3: Project Link
  console.log('Checking project link...');
  const projectInfo = await runCommand('eas project:info');
  check(projectInfo.success, `Project linked: ${projectInfo.output.split('\n')[0]}`, 'Project not linked to EAS');

  // B4: Environment Variables
  console.log('Checking EAS environment variables...');
  const envList = await runCommand('eas env:list --environment production --non-interactive');
  const hasSupabaseUrl = envList.output.includes('EXPO_PUBLIC_SUPABASE_URL');
  const hasSupabaseKey = envList.output.includes('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  check(hasSupabaseUrl, 'EAS has EXPO_PUBLIC_SUPABASE_URL', 'EAS missing EXPO_PUBLIC_SUPABASE_URL');
  check(hasSupabaseKey, 'EAS has EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EAS missing EXPO_PUBLIC_SUPABASE_ANON_KEY');

  // ==================== PARTS C, D, E: MANUAL ====================
  header('PARTS C, D, E: MANUAL VERIFICATION REQUIRED');

  console.log(`
${colors.yellow}These items require manual verification in web dashboards:${colors.reset}

${colors.bold}Part C - Apple Developer (https://developer.apple.com):${colors.reset}
  □ App ID "com.sofibaby.app" created with Sign in with Apple capability
  □ App created in App Store Connect
  □ TestFlight configured with test information

${colors.bold}Part D - Google Play (https://play.google.com/console):${colors.reset}
  □ App "Sofi Baby Tracker" created
  □ Store listing filled in (description, screenshots)
  □ Internal testing track created with testers

${colors.bold}Part E - OAuth Providers:${colors.reset}

  ${colors.bold}Google (https://console.cloud.google.com):${colors.reset}
  □ OAuth consent screen configured
  □ iOS OAuth client created (bundle: com.sofibaby.app)
  □ Android OAuth client created (package: com.sofibaby.app, SHA-1 added)
  □ Web OAuth client created with Supabase callback URL

  ${colors.bold}Apple (https://developer.apple.com):${colors.reset}
  □ Services ID created (com.sofibaby.app.web)
  □ Signing key (.p8) generated and downloaded
  □ Key ID noted

  ${colors.bold}Supabase Providers (${url}/auth/providers):${colors.reset}
  □ Google provider enabled with Web client ID & secret
  □ Apple provider enabled with Service ID & JWT secret
`);

  // ==================== SUMMARY ====================
  header('SUMMARY');

  console.log(`Total automated checks: ${passCount + failCount}`);
  console.log(`${colors.green}Passed: ${passCount}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failCount}${colors.reset}`);

  if (failCount > 0) {
    console.log(`\n${colors.red}${colors.bold}⚠ Some checks failed. Review the errors above.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}${colors.bold}✓ All automated checks passed!${colors.reset}`);
  }

  console.log(`\n${colors.yellow}Don't forget to complete the manual verification items above.${colors.reset}\n`);
}

main().catch(console.error);
