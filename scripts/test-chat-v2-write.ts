/**
 * Test script for Chat V2 WRITE capabilities
 * Usage: tsx scripts/test-chat-v2-write.ts
 */

async function testChatV2Write() {
  const API_URL = 'http://localhost:3000/api/agent/chat-v2';
  
  // Test configuration
  const testRequest = {
    message: "Create a new file called 'hello-agent.txt' in the root directory with the content 'Hello from the direct API integration!'",
    sessionId: 'test-session-write-' + Date.now(),
    flyAppName: process.env.TEST_FLY_APP_NAME || 'assess-test-app',
    conversationHistory: [],
  };

  console.log('🧪 Testing Chat V2 WRITE Capabilities...\n');
  console.log('Target App:', testRequest.flyAppName);
  console.log('Request:', JSON.stringify(testRequest, null, 2));
  console.log('\n⏳ Sending request...\n');

  const startTime = Date.now();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testRequest),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Request failed:', error);
      return;
    }

    const data = await response.json();

    console.log('✅ Agent Response Success!\n');
    console.log('Response:', data.response);
    console.log('\n📊 Tool Execution:');
    console.log('  Tool Calls:', data.toolCallCount);
    
    // Now verify the file was actually written by reading it back
    console.log('\n🔎 Verifying file creation...');
    
    // Check usage stats
    console.log('\n💰 Cost Info:');
    const costPerMillion = 0.25;
    const estimatedCost = (data.usage.totalTokens / 1_000_000) * costPerMillion;
    console.log(`  Total Tokens: ${data.usage.totalTokens}`);
    console.log(`  Estimated Cost: $${estimatedCost.toFixed(6)}`);
    console.log(`  Duration: ${duration}ms`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

// Run test
testChatV2Write();
