/**
 * Test script for the new chat-v2 API endpoint
 * Usage: tsx scripts/test-chat-v2.ts
 */

async function testChatV2() {
  const API_URL = 'http://localhost:3000/api/agent/chat-v2';
  
  // Payload matching the new AgentChat.tsx structure
  const flyAppName = process.env.TEST_FLY_APP_NAME || 'assess-b206aa10-1768612954597-87';
  const payload = {
    message: 'Please create a file called "agent_test.txt" in the "test_output" directory with the content "Hello from Chat V2 Agent!".',
    sessionId: `test-session-${Date.now()}`,
    flyAppName: flyAppName,
    candidateId: '223bb7a4-2338-4648-84be-98101abeb93b', // Valid candidate for logging test
    conversationHistory: [],
  };

  console.log('🧪 Testing Chat V2 API...\n');
  console.log('Request:', JSON.stringify(payload, null, 2));
  console.log('\n⏳ Sending request...\n');

  const startTime = Date.now();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const duration = Date.now() - startTime;

    if (!response.  ok) {
      const error = await response.json();
      console.error('❌ Request failed:', error);
      console.error(`⏱️  Duration: ${duration}ms`);
      return;
    }

    const data = await response.json();

    console.log('✅ Success!\n');
    console.log('Response:', data.response);
    console.log('\n📊 Usage Stats:');
    console.log('  Input tokens:', data.usage.inputTokens);
    console.log('  Output tokens:', data.usage.outputTokens);
    console.log('  Total tokens:', data.usage.totalTokens);
    console.log('  Tool calls:', data.toolCallCount);
    console.log('\n⏱️  Duration:', duration + 'ms');
    
    if (data.sessionUsage) {
      console.log('\n💰 Session Usage:');
      console.log('  Total tokens:', data.sessionUsage.totalTokens);
      console.log('  Request count:', data.sessionUsage.requestCount);
    }

    // Cost estimate (Haiku pricing)
    const costPerMillion = 0.25; // $0.25 per 1M input tokens
    const estimatedCost = (data.usage.totalTokens / 1_000_000) * costPerMillion;
    console.log('\n💵 Estimated cost: $' + estimatedCost.toFixed(6));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(`⏱️  Duration: ${Date.now() - startTime}ms`);
  }
}

// Run test
testChatV2();
