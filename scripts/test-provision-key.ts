
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Setup Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase Credentials in .env.local");
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const TEST_EMAIL = `test-provision-${Date.now()}@example.com`;
const TEST_TOKEN = `test-token-${Date.now()}`;
const API_URL = 'http://localhost:3000/api/topcandidates/provision';

async function testProvisioningFlow() {
    console.log("🧪 Starting Provision API Test...");
    console.log(`👤 Creating Test Candidate: ${TEST_EMAIL}`);

    try {
        // 1. Create Test Candidate
        const { data: candidate, error: createError } = await supabaseAdmin
            .from('candidates')
            .insert({
                email: TEST_EMAIL,
                name: 'Test Provision Candidate',
                skills: 'Testing',
                provisioning_token: TEST_TOKEN
            })
            .select()
            .single();

        if (createError) {
            throw new Error(`Failed to create candidate: ${createError.message}`);
        }
        console.log("✅ Candidate Created.");

        // 2. Call Provision API
        console.log(`\n📡 Calling Provision API with token: ${TEST_TOKEN}`);
        const response = await fetch(`${API_URL}?token=${TEST_TOKEN}`, {
            method: 'GET'
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Request Failed: ${response.status} ${text}`);
        }

        const data = await response.json();
        console.log("✅ API Response Received.");
        
        // 3. Verify Response Structure
        console.log("\n🔍 Verifying Response Keys...");
        
        let passed = true;
        
        if (data.GOOGLE_API_KEY === 'managed-by-proxy') {
            console.log("✅ GOOGLE_API_KEY is masked ('managed-by-proxy')");
        } else {
            console.error(`❌ GOOGLE_API_KEY LEAKED: ${data.GOOGLE_API_KEY}`);
            passed = false;
        }

        if (data.GEMINI_BASE_URL && data.GEMINI_BASE_URL.includes('/api/proxy/gemini')) {
            console.log(`✅ GEMINI_BASE_URL is correct: ${data.GEMINI_BASE_URL}`);
        } else {
            console.error(`❌ Missing or Invalid GEMINI_BASE_URL: ${data.GEMINI_BASE_URL}`);
            passed = false;
        }

        if (data.SUPABASE_PRIVATE_KEY) {
            console.log("✅ SUPABASE_PRIVATE_KEY (JWT) received");
        } else {
             console.error("❌ Missing SUPABASE_PRIVATE_KEY");
             passed = false;
        }

        // Cleanup
        console.log("\n🧹 Cleaning up Test Candidate...");
        await supabaseAdmin.from('candidates').delete().eq('email', TEST_EMAIL);

        if (passed) {
            console.log("\n🎉 SUCCESS: Provision API and Proxy Configuration are Secure!");
        } else {
            console.error("\n💥 FAILURE: Security checks failed.");
            process.exit(1);
        }

    } catch (error) {
        console.error("\n❌ Test Failed:", error);
        // Attempt Cleanup
        await supabaseAdmin.from('candidates').delete().eq('email', TEST_EMAIL);
        process.exit(1);
    }
}

testProvisioningFlow();
