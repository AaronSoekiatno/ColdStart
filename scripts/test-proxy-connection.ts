
import { generateCandidateJWT } from '../lib/generate-candidate-jwt';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testProxy() {
    console.log("🧪 Starting Proxy Connection Test...");

    const LOCAL_PORT = 3000; 
    const PROXY_BASE_URL = `http://localhost:${LOCAL_PORT}/api/proxy/gemini`;
    
    // Generate JWT
    const TEST_CANDIDATE_ID = 'test-candidate-uuid';
    const TEST_SCHEMA = 'test_candidate_schema';
    
    let jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error("❌ Error: SUPABASE_JWT_SECRET not found in .env.local");
        process.exit(1);
    }
    
    const token = generateCandidateJWT(TEST_CANDIDATE_ID, TEST_SCHEMA);
    console.log("✅ JWT Generated.");

    // Step 1: List Models to find a generation model
    const listEndpoint = `${PROXY_BASE_URL}/v1beta/models`;
    console.log(`\n📡 Fetching Models from: ${listEndpoint}`);

    let modelName = '';

    try {
        const listResponse = await fetch(listEndpoint, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!listResponse.ok) {
            console.error(`❌ List Models Failed: ${listResponse.status}`);
            process.exit(1);
        }

        const data = await listResponse.json();
        const models = data.models || [];
        
        // Find a model that supports generateContent
        // Usually contains 'gemini' and is not an embedding model
        const genModel = models.find((m: any) => 
            m.supportedGenerationMethods?.includes('generateContent') &&
            m.name.includes('gemini')
        );

        if (genModel) {
            modelName = genModel.name; // e.g., models/gemini-1.5-flash
            console.log(`✅ Found Generation Model: ${modelName}`);
        } else {
            console.error("❌ No suitable generation model found in the list.");
            console.log("Available models:", models.map((m: any) => m.name));
            process.exit(1);
        }

    } catch (error) {
        console.error("❌ Error listing models:", error);
        process.exit(1);
    }

    // Step 2: Test generateContent with the found model
    // Note: modelName usually comes as "models/gemini-1.5-flash", 
    // but the endpoint expectation might vary.
    // The standard URL is /v1beta/{model}:generateContent
    
    // We need to strip "models/" if the API expects just the ID, 
    // but usually the full resource name "models/..." works or is required depending on the exact endpoint.
    // Let's try using the full name first as returned by the API.
    
    const generateEndpoint = `${PROXY_BASE_URL}/v1beta/${modelName}:generateContent`;
    console.log(`\n🚀 Testing Generation with: ${generateEndpoint}`);

    const prompt = {
        contents: [{
            parts: [{ text: "Hello, reply with 'Working!'" }]
        }]
    };

    try {
        const genResponse = await fetch(generateEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(prompt)
        });

        if (!genResponse.ok) {
            const errorText = await genResponse.text();
            console.error(`❌ Generation Failed! Status: ${genResponse.status}`);
            console.error(errorText);
            process.exit(1);
        }

        const genData = await genResponse.json();
        console.log("\n✅ Generation Successful!");
        const text = genData?.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`Response: "${text}"`);

    } catch (error) {
        console.error("❌ Generation Error:", error);
    }
}

testProxy();
