import { NextRequest } from 'next/server';
import { callClaude, type ClaudeMessage } from '@/lib/claude/client';
import { getWorkspaceTools, CODING_ASSISTANT_SYSTEM_PROMPT } from '@/lib/claude/tools';
import {
  readWorkspaceFile,
  listWorkspaceDirectory,
  searchWorkspaceCode,
  writeWorkspaceFile,
  runWorkspaceCommand,
} from '@/lib/workspace/file-access';
import {
  checkSessionLimits,
  trackTokenUsage,
  estimateTokenCount,
  getSessionUsage,
} from '@/lib/claude/cost-tracker';

/**
 * Direct Claude API integration (v2)
 * Fast, cost-effective alternative to SSH + claude-code CLI
 */

import { logPrompt, updateLogResponse } from '@/lib/claude/logger';

export async function POST(request: NextRequest) {
  let logId: string | null = null;
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { message, sessionId, flyAppName, candidateId, conversationHistory = [] } = body;

    // Validate required fields
    if (!message || !sessionId || !flyAppName) {
      return Response.json(
        { error: 'Missing required fields: message, sessionId, flyAppName' },
        { status: 400 }
      );
    }

    // --- DETAILED LOGGING START ---
    console.log('\n💬 [Chat V2 UI] Request Received:');
    console.log('  Message:', message.substring(0, 100) + (message.length > 100 ? '...' : ''));
    console.log('  Session:', sessionId);
    console.log('  App:', flyAppName || '(No App)');

    // Log to Supabase (Database)
    try {
      logId = await logPrompt({
        candidateId, // Explicitly pass if provided
        sessionId,
        prompt: message,
        metadata: { 
            flyAppName, 
            historyLength: conversationHistory.length 
        }
      });
      if (logId) console.log('  📝 [Logger] Logged to DB ID:', logId);
    } catch (e) {
      console.error('  ⚠️ [Logger] Failed to start log:', e);
    }
    
    // Check cost limits
    const estimatedTokens = estimateTokenCount(message);
    const limitCheck = checkSessionLimits(sessionId, estimatedTokens);

    if (!limitCheck.allowed) {
      console.log('❌ [Chat V2 UI] Cost limit exceeded:', limitCheck.reason);
      
      const responsePayload = {
        error: 'Cost limit exceeded',
        reason: limitCheck.reason,
        usage: getSessionUsage(sessionId),
      };

      if (logId) {
        updateLogResponse({
            logId,
            responseStatus: 429,
            responseTimeMs: Date.now() - startTime,
            responseText: JSON.stringify(responsePayload)
        }).catch(console.error);
      }

      return Response.json(responsePayload, { status: 429 });
    }
    
    // Build conversation messages
    const messages: ClaudeMessage[] = [
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    // Get workspace tools
    const tools = getWorkspaceTools();

    // Call Claude API
    let response = await callClaude(messages, tools, {
      systemPrompt: CODING_ASSISTANT_SYSTEM_PROMPT,
      maxTokens: 4096,
    });

    let iterations = 0;
    const maxIterations = 5; // Prevent infinite tool use loops

    // Handle tool use loop
    while (
      response.stop_reason === 'tool_use' &&
      iterations < maxIterations
    ) {
      iterations++;
      
      // Extract tool calls from response
      const toolResults = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          console.log(`\n🛠️  [Chat V2 UI] Tool Call (${iterations}): ${block.name}`);
          // console.log('  Input:', JSON.stringify(block.input));

          let toolResult: string;

          try {
            // Execute tool
            switch (block.name) {
              case 'read_file':
                const readInput = block.input as any;
                console.log(`  Target: ${readInput.path}`);
                toolResult = await readWorkspaceFile(flyAppName, {
                  path: readInput.path,
                  startLine: readInput.start_line,
                  endLine: readInput.end_line,
                });
                break;

              case 'list_directory':
                const listInput = block.input as any;
                console.log(`  Target: ${listInput.path}`);
                toolResult = await listWorkspaceDirectory(flyAppName, {
                  path: listInput.path,
                  recursive: listInput.recursive,
                });
                break;

              case 'search_code':
                const searchInput = block.input as any;
                console.log(`  Query: "${searchInput.query}" in ${searchInput.file_pattern || '*'}`);
                toolResult = await searchWorkspaceCode(flyAppName, {
                  query: searchInput.query,
                  filePattern: searchInput.file_pattern,
                  caseSensitive: searchInput.case_sensitive,
                });
                break;

              case 'write_file':
                const writeInput = block.input as any;
                console.log(`  Target: ${writeInput.path} (${writeInput.content.length} bytes)`);
                toolResult = await writeWorkspaceFile(flyAppName, {
                  path: writeInput.path,
                  content: writeInput.content,
                });
                break;

              case 'run_command':
                const runInput = block.input as any;
                console.log(`  Command: ${runInput.command}`);
                toolResult = await runWorkspaceCommand(flyAppName, {
                  command: runInput.command,
                });
                break;

              default:
                toolResult = `Unknown tool: ${block.name}`;
            }

            console.log(`  ✅ Result: ${toolResult.length} chars`);
          } catch (error: any) {
            toolResult = `Error: ${error.message}`;
            console.error(`  ❌ Error: ${error.message}`);
          }

          toolResults.push({
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: toolResult,
          });
        }
      }

      // Continue conversation with tool results
      messages.push({
        role: 'assistant',
        content: response.content.map(block => {
          if (block.type === 'text') {
            return { type: 'text', text: block.text };
          } else if (block.type === 'tool_use') {
            return {
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input,
            };
          }
          return block;
        }) as any,
      });

      messages.push({
        role: 'user',
        content: toolResults as any,
      });

      // Call Claude again with tool results
      response = await callClaude(messages, tools, {
        systemPrompt: CODING_ASSISTANT_SYSTEM_PROMPT,
        maxTokens: 4096,
      });
    }

    // Extract final text response
    let finalText = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        finalText += block.text;
      }
    }

    // Track token usage
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
    trackTokenUsage(sessionId, tokensUsed);
    
    const duration = Date.now() - startTime;
    const costPerMillion = 0.25; // Haiku input pricing roughly
    const estCost = (tokensUsed / 1_000_000) * costPerMillion;

    console.log('\n✅ [Chat V2 UI] Success Response');
    console.log(`  Response: "${finalText.substring(0, 50)}..."`);
    console.log(`  Tokens: ${tokensUsed} (${response.usage.input_tokens} in / ${response.usage.output_tokens} out)`);
    console.log(`  Cost: ~$${estCost.toFixed(6)}`);
    console.log(`  Time: ${duration}ms`);
    console.log('-------------------------------------------');

    // Update DB Log (Fire and Forget)
    if (logId) {
        updateLogResponse({
            logId,
            responseStatus: 200,
            responseTimeMs: duration,
            responseText: finalText,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens
        }).catch(e => console.error('  ❌ [Logger] Failed to update log:', e));
    }

    return Response.json({
      response: finalText,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: tokensUsed,
      },
      sessionUsage: getSessionUsage(sessionId),
      toolCallCount: iterations,
    });
  } catch (error: any) {
    console.error('❌ [Chat V2 UI] Error:', error);

    // Update DB Log with Error
    if (logId) {
        updateLogResponse({
            logId,
            responseStatus: 500,
            responseTimeMs: Date.now() - startTime,
            responseText: `Error: ${error.message}`
        }).catch(e => console.error('  ❌ [Logger] Failed to update error log:', e));
    }

    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
