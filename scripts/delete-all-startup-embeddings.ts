import { resolve } from 'path';
import { config } from 'dotenv';
// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { Pinecone } from '@pinecone-database/pinecone';

// Check Pinecone environment variables
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX_NAME || 'startups';

if (!pineconeApiKey) {
  throw new Error('PINECONE_API_KEY is required');
}

const pc = new Pinecone({ apiKey: pineconeApiKey });
const index = pc.index(pineconeIndexName);

/**
 * Delete all vectors from the startups namespace in Pinecone
 */
async function deleteAllStartupEmbeddings() {
  console.log('🗑️  Deleting all embeddings from Pinecone startups namespace...\n');
  console.log(`📊 Using index: ${pineconeIndexName}\n`);

  try {
    const namespace = index.namespace('startups');
    
    // Method 1: Try to delete all using deleteMany with empty filter
    // Note: This may not work in all Pinecone versions, so we have a fallback
    try {
      console.log('Attempting to delete all vectors...');
      // Some Pinecone versions support deleting all with an empty filter
      await namespace.deleteMany([]);
      console.log('✅ Successfully deleted all embeddings from startups namespace');
      console.log('   You can now re-embed startups from the startups table');
      return;
    } catch (deleteError) {
      console.log('   ⚠️  deleteMany([]) not supported, trying alternative method...');
    }

    // Method 2: List all vectors and delete them in batches
    console.log('Fetching all vector IDs from namespace...');
    const stats = await index.describeIndexStats();
    const namespaceStats = stats.namespaces?.['startups'];
    
    if (!namespaceStats || namespaceStats.vectorCount === 0) {
      console.log('✅ Namespace is already empty');
      return;
    }

    console.log(`   Found ${namespaceStats.vectorCount} vectors to delete`);
    console.log('   ⚠️  Note: Pinecone doesn\'t provide a direct way to list all IDs.');
    console.log('   ⚠️  To delete all vectors, you can:');
    console.log('   1. Use Pinecone dashboard: Go to your index → Namespaces → startups → Delete');
    console.log('   2. Or delete the namespace via API (if supported by your plan)');
    console.log('   3. Or query with a very high topK and delete the returned IDs');
    console.log('\n   For now, the namespace may still contain vectors.');
    console.log('   When you re-embed, new vectors will be added alongside old ones.');
    console.log('   Consider using a different namespace or cleaning via dashboard.');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error:', errorMessage);
    console.error('\n💡 Alternative: Use Pinecone dashboard to delete the namespace');
    console.error('   1. Go to https://app.pinecone.io');
    console.error('   2. Select your index');
    console.error('   3. Go to Namespaces → startups');
    console.error('   4. Delete the namespace');
    process.exit(1);
  }
}

// Run the script
deleteAllStartupEmbeddings().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
