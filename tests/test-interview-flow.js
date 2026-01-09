/**
 * Full Interview Flow Test (Mock Vapi)
 * 
 * Simulates a complete interview from start to finish
 * using mock Vapi calls (no charges).
 * 
 * Run: node --env-file=.env.local test-interview-flow.js
 */

import { createSession, startInterview, getSession } from './lib/session-manager.js';
import * as mockVapi from './lib/vapi-client-mock.js';

// We'll manually orchestrate instead of using the real orchestrator
// to avoid any accidental real Vapi calls

async function testFullInterviewFlow() {
    console.log('🎬 Starting Full Interview Flow Test (Mock Vapi)\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
        // ═══════════════════════════════════════════════════
        // PHASE 1: Create Session
        // ═══════════════════════════════════════════════════
        console.log('📝 STEP 1: Creating interview session...\n');

        const session = await createSession('test-candidate-mock');

        const { updateSession } = await import('./lib/session-manager.js');
        await updateSession(session.sessionId, {
            repoName: 'AbsurdLangChain',
            repoUrl: 'https://github.com/Hermes-Startup/AbsurdLangChain'
        });

        console.log(`✅ Session created: ${session.sessionId}`);
        console.log(`   Repository: AbsurdLangChain\n`);

        // ═══════════════════════════════════════════════════
        // PHASE 2: Start Interview (KICK_OFF)
        // ═══════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 STEP 2: Starting Interview (KICK_OFF Phase)\n');

        const result = await startInterview(session.sessionId);
        console.log(`✅ Interview started`);
        console.log(`   Current phase: ${result.session.currentPhase}`);
        console.log(`   Status: ${result.session.status}\n`);

        // Set up mock Vapi event handlers
        mockVapi.onEvent('onCallEnd', async (callData) => {
            console.log(`\n✅ Mock Vapi call ended for phase ${callData.phaseId}`);
            console.log(`   Duration: ${callData.duration}s`);
            console.log(`   Messages collected: ${callData.messages.length}`);

            // Store messages (simulating what orchestrator does)
            const { storeConversationMessages } = await import('./lib/session-manager.js');
            await storeConversationMessages(
                callData.sessionId,
                callData.phaseId,
                callData.messages
            );
            console.log(`   💾 Messages stored in Supabase\n`);
        });

        // Start mock Vapi call for KICK_OFF
        await mockVapi.startPhaseCall(
            session.sessionId,
            'KICK_OFF',
            'kickoff',
            []
        );

        // Wait for mock conversation to finish
        await new Promise(resolve => setTimeout(resolve, 4000));

        // ═══════════════════════════════════════════════════
        // PHASE 3: Transition to BUILD
        // ═══════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔄 STEP 3: Transitioning to BUILD Phase\n');

        const { transitionToNextPhase } = await import('./lib/session-manager.js');
        const transition1 = await transitionToNextPhase(session.sessionId, 'vapi_end');

        console.log(`✅ Transitioned to ${transition1.currentPhase.id}`);
        console.log(`   Vapi should be: ${transition1.shouldActivateVapi ? 'INACTIVE' : 'ACTIVE'}`);
        console.log(`   Candidate coding time...\n`);

        await new Promise(resolve => setTimeout(resolve, 1000));

        // ═══════════════════════════════════════════════════
        // PHASE 4: Simulate Commit (BUILD → BUG_INJECTION)
        // ═══════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💾 STEP 4: Candidate pushes commit\n');

        const { recordCommit } = await import('./lib/session-manager.js');
        const commitResult = await recordCommit(session.sessionId, {
            id: 'abc123def456',
            message: 'Implemented authentication feature',
            author: 'Test Candidate',
            timestamp: new Date().toISOString()
        });

        console.log(`✅ Commit recorded: abc123d`);
        console.log(`   Should transition: ${commitResult.shouldTransition}\n`);

        if (commitResult.shouldTransition) {
            const transition2 = await transitionToNextPhase(session.sessionId, 'commit');
            console.log(`✅ Transitioned to ${transition2.currentPhase.id}`);
            console.log(`   Vapi should be: ${transition2.shouldActivateVapi ? 'ACTIVE' : 'INACTIVE'}\n`);

            // Get conversation history for context
            const { getConversationHistory } = await import('./lib/session-manager.js');
            const history = await getConversationHistory(session.sessionId);

            // Start BUG_INJECTION Vapi call with context
            await mockVapi.startPhaseCall(
                session.sessionId,
                'BUG_INJECTION',
                'bug_injection',
                history
            );

            await new Promise(resolve => setTimeout(resolve, 4000));
        }

        // ═══════════════════════════════════════════════════
        // PHASE 5: Transition to FIX
        // ═══════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔄 STEP 5: Transitioning to FIX Phase\n');

        const transition3 = await transitionToNextPhase(session.sessionId, 'vapi_end');
        console.log(`✅ Transitioned to ${transition3.currentPhase.id}`);
        console.log(`   Candidate fixing the bug...\n`);

        await new Promise(resolve => setTimeout(resolve, 1000));

        // ═══════════════════════════════════════════════════
        // PHASE 6: Fix Commit (FIX → POST_MORTEM)
        // ═══════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💾 STEP 6: Candidate pushes fix\n');

        await recordCommit(session.sessionId, {
            id: 'fix789ghi012',
            message: 'Fixed security vulnerability in auth module',
            author: 'Test Candidate',
            timestamp: new Date().toISOString()
        });

        console.log(`✅ Fix commit recorded: fix789g\n`);

        const transition4 = await transitionToNextPhase(session.sessionId, 'commit');
        console.log(`✅ Transitioned to ${transition4.currentPhase.id}`);
        console.log(`   Vapi should be: ${transition4.shouldActivateVapi ? 'ACTIVE' : 'INACTIVE'}\n`);

        // Start POST_MORTEM Vapi call with full history
        const { getConversationHistory } = await import('./lib/session-manager.js');
        const fullHistory = await getConversationHistory(session.sessionId);

        await mockVapi.startPhaseCall(
            session.sessionId,
            'POST_MORTEM',
            'post_mortem',
            fullHistory
        );

        await new Promise(resolve => setTimeout(resolve, 4000));

        // ═══════════════════════════════════════════════════
        // PHASE 7: Complete Interview
        // ═══════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 STEP 7: Completing Interview\n');

        const { completeInterview } = await import('./lib/session-manager.js');
        const completion = await completeInterview(session.sessionId);

        console.log(`✅ Interview completed!`);
        console.log(`   Total duration: ${completion.totalDuration}s`);
        console.log(`   Total Vapi time: ${completion.totalVapiSeconds}s\n`);

        // ═══════════════════════════════════════════════════
        // FINAL: Display Session Summary
        // ═══════════════════════════════════════════════════
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 FINAL SESSION STATE\n');

        const finalSession = await getSession(session.sessionId);

        console.log(`Session ID: ${finalSession.sessionId}`);
        console.log(`Status: ${finalSession.status}`);
        console.log(`Conversation history: ${finalSession.conversationHistory.length} messages`);
        console.log(`\nPhase History:`);
        finalSession.phaseHistory.forEach((event, i) => {
            console.log(`  ${i + 1}. ${event.phase} - ${event.action} (${event.trigger || 'N/A'})`);
        });

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ TEST COMPLETE - All phases executed successfully!');
        console.log('💰 Cost: $0.00 (mock mode)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the test
testFullInterviewFlow();
