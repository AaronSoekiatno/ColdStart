/**
 * Webhook Test Script
 * 
 * Creates a test session linked to AbsurdLangChain repo
 * and prepares for webhook testing.
 * 
 * Run: node --env-file=.env.local test-webhook-setup.js
 */

import { createSession, updateSession, startInterview, getSession } from './lib/session-manager.js';

async function setupTestSession() {
    console.log('🧪 Setting up test session for webhook testing...\n');

    try {
        // 1. Create a test session
        console.log('📝 Creating test session...');
        const session = await createSession('test-candidate-absurd');
        console.log(`✅ Session created: ${session.sessionId}\n`);

        // 2. Link to AbsurdLangChain repo
        console.log('🔗 Linking to GitHub repository...');
        await updateSession(session.sessionId, {
            repoName: 'AbsurdLangChain',
            repoUrl: 'https://github.com/Hermes-Startup/AbsurdLangChain'
        });
        console.log('✅ Repository linked\n');

        // 3. Start the interview (KICK_OFF → BUILD)
        console.log('🚀 Starting interview...');
        const result = await startInterview(session.sessionId);
        console.log(`✅ Interview started`);
        console.log(`   Current phase: ${result.session.currentPhase}`);
        console.log(`   Status: ${result.session.status}\n`);

        // 4. Display session details
        console.log('📊 Session Details:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Session ID: ${session.sessionId}`);
        console.log(`Candidate ID: ${session.candidateId}`);
        console.log(`Repository: ${session.repoUrl}`);
        console.log(`Current Phase: ${result.session.currentPhase}`);
        console.log(`Status: ${result.session.status}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 5. Instructions for next steps
        console.log('🎯 Next Steps:');
        console.log('');
        console.log('1. Start your dev server (if not running):');
        console.log('   npm run dev');
        console.log('');
        console.log('2. Expose your server with ngrok (in new terminal):');
        console.log('   ngrok http 3000');
        console.log('');
        console.log('3. Copy the ngrok URL (e.g., https://abc123.ngrok.io)');
        console.log('');
        console.log('4. Add webhook to GitHub:');
        console.log('   → Go to: https://github.com/Hermes-Startup/AbsurdLangChain/settings/hooks');
        console.log('   → Click "Add webhook"');
        console.log('   → Payload URL: YOUR_NGROK_URL/api/webhooks/github');
        console.log('   → Content type: application/json');
        console.log('   → Secret: create-a-random-secret');
        console.log('   → Events: Just the push event');
        console.log('');
        console.log('5. Add the webhook secret to .env.local:');
        console.log('   GITHUB_WEBHOOK_SECRET=your-secret-here');
        console.log('');
        console.log('6. Push a commit to AbsurdLangChain:');
        console.log('   cd /path/to/AbsurdLangChain');
        console.log('   echo "test" > test.txt');
        console.log('   git add .');
        console.log('   git commit -m "Test: BUILD phase transition"');
        console.log('   git push origin main');
        console.log('');
        console.log('7. Watch your server logs for webhook activity!');
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Setup complete! Ready for webhook testing.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('❌ Error setting up test session:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the setup
setupTestSession();
