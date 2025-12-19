/**
 * Quick test script to verify TechCrunch scraper is working
 * This tests the core functionality without running the full scraper
 */

import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function testTechCrunchScraper() {
  console.log('🧪 Testing TechCrunch Scraper Configuration...\n');

  // Test 1: Environment Variables
  console.log('1️⃣ Checking environment variables...');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const pineconeKey = process.env.PINECONE_API_KEY;
  const pineconeIndex = process.env.PINECONE_INDEX_NAME || 'startups';

  if (!supabaseUrl) {
    console.error('   ❌ SUPABASE_URL not found');
    return false;
  }
  console.log('   ✅ SUPABASE_URL found');

  if (!supabaseKey) {
    console.error('   ❌ SUPABASE_KEY not found');
    return false;
  }
  console.log('   ✅ SUPABASE_KEY found');

  if (!geminiKey) {
    console.warn('   ⚠️  GEMINI_API_KEY not found (will fall back to regex extraction)');
  } else {
    console.log('   ✅ GEMINI_API_KEY found');
  }

  if (!pineconeKey) {
    console.warn('   ⚠️  PINECONE_API_KEY not found (embeddings will not be stored)');
  } else {
    console.log('   ✅ PINECONE_API_KEY found');
  }

  // Test 2: Supabase Connection
  console.log('\n2️⃣ Testing Supabase connection...');
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('startups3').select('id').limit(1);
    
    if (error && error.code !== 'PGRST116') {
      console.error(`   ❌ Supabase connection failed: ${error.message}`);
      return false;
    }
    console.log('   ✅ Supabase connected successfully');
  } catch (error) {
    console.error(`   ❌ Supabase connection error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }

  // Test 3: Gemini API (if available)
  if (geminiKey) {
    console.log('\n3️⃣ Testing Gemini API...');
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const modelNames = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
      let modelWorks = false;
      
      for (const modelName of modelNames) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent('Say "test"');
          if (result.response.text()) {
            console.log(`   ✅ Gemini API working (using ${modelName})`);
            modelWorks = true;
            break;
          }
        } catch (error: any) {
          if (error?.message?.includes('not found') || error?.message?.includes('404')) {
            continue;
          }
          throw error;
        }
      }
      
      if (!modelWorks) {
        console.warn('   ⚠️  No Gemini models available (will use regex extraction)');
      }
    } catch (error) {
      console.warn(`   ⚠️  Gemini API test failed: ${error instanceof Error ? error.message : String(error)}`);
      console.warn('   (This is okay - scraper will use regex extraction as fallback)');
    }
  }

  // Test 4: Check existing TechCrunch data
  console.log('\n4️⃣ Checking existing TechCrunch data...');
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('startups3')
      .select('id, name, techcrunch_article_link')
      .eq('data_source', 'techcrunch')
      .limit(5);
    
    if (error) {
      console.warn(`   ⚠️  Could not query startups table: ${error.message}`);
    } else {
      console.log(`   ✅ Found ${data?.length || 0} existing TechCrunch startups`);
      if (data && data.length > 0) {
        console.log('   Recent startups:');
        data.forEach((s: any) => {
          console.log(`      - ${s.name}`);
        });
      }
    }
  } catch (error) {
    console.warn(`   ⚠️  Could not check existing data: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test 5: Check active hours
  console.log('\n5️⃣ Checking TechCrunch active hours...');
  const now = new Date();
  const pacificTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const hour = pacificTime.getHours();
  const isActive = hour >= 6 && hour < 22;
  
  console.log(`   Current Pacific Time: ${hour}:${pacificTime.getMinutes().toString().padStart(2, '0')}`);
  if (isActive) {
    console.log('   ✅ Within active hours (6 AM - 10 PM Pacific)');
  } else {
    console.log('   ⏸️  Outside active hours (scraper will skip runs)');
  }

  console.log('\n✅ All tests completed!');
  console.log('\n📝 To run the scraper:');
  console.log('   npm run scrape-techcrunch-supabase');
  console.log('\n💡 Note: The scraper will only run during active hours (6 AM - 10 PM Pacific)');
  
  return true;
}

// Run tests
testTechCrunchScraper()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

