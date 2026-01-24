import { NextRequest } from 'next/server';
import { callClaude, type ClaudeMessage } from '@/lib/claude/client';
import { getWorkspaceTools, CODING_ASSISTANT_SYSTEM_PROMPT } from '@/lib/claude/tools';
import {
  readWorkspaceFile,
  listWorkspaceDirectory,
  searchWorkspaceCode,
  writeWorkspaceFile,
  editWorkspaceFile,
  runWorkspaceCommand,
} from '@/lib/workspace/file-access';
import {
  checkSessionLimits,
  trackTokenUsage,
  estimateTokenCount,
  getSessionUsage,
} from '@/lib/claude/cost-tracker';
import { logPrompt, updateLogResponse } from '@/lib/claude/logger';
import { supabaseAdmin } from '@/lib/supabase';

// Prevent Next.js from caching the response
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { message, sessionId, flyAppName, candidateId, conversationHistory = [] } = body;

  // Validate required fields
  if (!message || !sessionId || !flyAppName) {
    return Response.json(
      { error: 'Missing required fields: message, sessionId, flyAppName' },
      { status: 400 }
    );
  }

  // Create a stream for the response
  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      let logId: string | null = null;
      let fullResponseText = '';
      const toolResultsLog: { toolName: string; input: any; result: string }[] = [];
      let inputTokens = 0;
      let outputTokens = 0;

      // Helper to send events
      const sendEvent = (type: string, data: any) => {
        const payload = JSON.stringify({ type, ...data });
        controller.enqueue(new TextEncoder().encode(payload + '\n'));
      };

      try {
        console.log(`\n💬 [Chat V2 Stream] Starting session: ${sessionId}`);

        // 1. Initial Logging
        try {
          logId = await logPrompt({
            candidateId,
            sessionId,
            prompt: message,
            metadata: { flyAppName, historyLength: conversationHistory.length }
          });
        } catch (e) {
          console.error('  ⚠️ Failed to create log:', e);
        }

        // 2. Check Cost Limits
        const estimatedTokens = estimateTokenCount(message);
        const limitCheck = checkSessionLimits(sessionId, estimatedTokens);

        if (!limitCheck.allowed) {
            sendEvent('error', { error: 'Cost limit exceeded: ' + limitCheck.reason });
            controller.close();
            
            if (logId) {
                updateLogResponse({
                    logId,
                    responseStatus: 429,
                    responseTimeMs: Date.now() - startTime,
                    responseText: JSON.stringify({ error: limitCheck.reason })
                }).catch(console.error);
            }
            return;
        }

        // 3. Prepare Prompt
        let processedMessage = message;
        const fileRegex = /@\/(\S+)/g;
        const fileMatches = message.match(fileRegex);
        
        if (fileMatches) {
          console.log(`🔍 [Chat V2] Found ${fileMatches.length} file references`);
          for (const match of fileMatches) {
            // Remove trailing punctuation from match if any
            const cleanMatch = match.replace(/[.,!?;:]$/, '');
            const filePath = cleanMatch.substring(2);
            
            try {
              sendEvent('status', { msg: `Reading ${filePath}...` });
              const content = await readWorkspaceFile(flyAppName, { path: filePath });
              processedMessage += `\n\n--- FILE ATTACHMENT: ${cleanMatch} ---\n${content}\n--- END ATTACHMENT ---`;
            } catch (err: any) {
              console.warn(`  ⚠️ Could not read ${filePath}:`, err.message);
              // We don't fail the whole request, just proceed without this file
            }
          }
        }

        const messages: ClaudeMessage[] = [
          ...conversationHistory,
          { role: 'user', content: processedMessage },
        ];
        const tools = getWorkspaceTools();
        
        // Helper: Execute tool with retry logic
        const executeToolWithRetry = async (
          toolName: string,
          input: any,
          maxRetries = 5  // Increased from 3 to 5 for flaky SSH
        ): Promise<string> => {
            // Helper to broadcast file updates
            const broadcastFileUpdate = async (path: string) => {
                if (!supabaseAdmin) {
                    console.warn('⚠️ Cannot broadcast file update: supabaseAdmin not initialized');
                    return;
                }
                try {
                    console.log(`📡 [Chat V2] Broadcasting file_update for ${path} to session:${sessionId}`);
                    const channel = supabaseAdmin.channel(`session:${sessionId}`);
                    await channel.send({
                        type: 'broadcast',
                        event: 'file_update',
                        payload: { path, timestamp: Date.now() }
                    });
                    // Clean up channel reference locally (admin client handles connection reuse typically, but good practice for on-demand)
                    supabaseAdmin.removeChannel(channel);
                } catch (e) {
                    console.error('⚠️ Failed to broadcast file update:', e);
                }
            };

          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              // Execute the tool
              if (toolName === 'read_file') {
                return await readWorkspaceFile(flyAppName, { path: input.path, startLine: input.start_line, endLine: input.end_line });
              } else if (toolName === 'list_directory') {
                return await listWorkspaceDirectory(flyAppName, { path: input.path, recursive: input.recursive });
              } else if (toolName === 'search_code') {
                return await searchWorkspaceCode(flyAppName, { query: input.query, filePattern: input.file_pattern, caseSensitive: input.case_sensitive });
              } else if (toolName === 'write_file') {
                const result = await writeWorkspaceFile(flyAppName, { path: input.path, content: input.content });
                // Broadcast update asynchronously
                broadcastFileUpdate(input.path).catch(console.error);
                return result;
              } else if (toolName === 'edit_file') {
                const result = await editWorkspaceFile(flyAppName, { path: input.path, startLine: input.start_line, endLine: input.end_line, newContent: input.new_content });
                // Broadcast update asynchronously
                broadcastFileUpdate(input.path).catch(console.error);
                return result;
              } else if (toolName === 'run_command') {
                return await runWorkspaceCommand(flyAppName, { command: input.command });
              } else {
                return `Unknown tool: ${toolName}`;
              }
            } catch (error: any) {
              const isLastAttempt = attempt === maxRetries - 1;
              
              // Don't retry certain errors
              const nonRetryableErrors = [
                'Invalid file path',
                'Invalid line range',
                'File not found',
                'Permission denied',
                'Unknown tool'
              ];
              
              // SSH/network errors that ARE retryable
              const sshErrors = [
                'Connection refused',
                'Connection reset',
                'ECONNREFUSED',
                'ETIMEDOUT',
                'ssh shell',
                'Could not find App',
                'timeout',
                'ENOTFOUND'
              ];
              
              const isNonRetryable = nonRetryableErrors.some(msg => error.message?.includes(msg));
              const isSshError = sshErrors.some(msg => error.message?.includes(msg));
              
              if (isNonRetryable || (isLastAttempt && !isSshError)) {
                throw error;
              }
              
              // Exponential backoff: 1s, 2s, 4s, 8s, 16s
              const delay = Math.pow(2, attempt) * 1000;
              const reason = isSshError ? 'SSH connection issue' : 'transient error';
              console.log(`  ⚠️ Tool ${toolName} failed (${reason}, attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          
          throw new Error(`Tool ${toolName} failed after ${maxRetries} attempts`);
        };
        
        // 4. Agent Loop
        let iterations = 0;
        const maxIterations = 5;
        let finalResponseFound = false;

        while (iterations < maxIterations && !finalResponseFound) {
            iterations++;
            // sendEvent('status', { msg: `Thinking... (Step ${iterations})` });

            // Call Claude
            const response = await callClaude(messages, tools, {
                systemPrompt: CODING_ASSISTANT_SYSTEM_PROMPT,
                maxTokens: 4096,
            });

            inputTokens += response.usage.input_tokens;
            outputTokens += response.usage.output_tokens;

            // Process blocks
            const toolUseBlocks = [];
            let thoughtContent = '';

            for (const block of response.content) {
                if (block.type === 'text') {
                    thoughtContent += block.text;
                } else if (block.type === 'tool_use') {
                    toolUseBlocks.push(block);
                }
            }

            // Send thought if exists
            if (thoughtContent) {
                // Heuristic: If there are NO tool calls, this is likely the final response (or part of it).
                // If there ARE tool calls, this is "Reasoning".
                if (toolUseBlocks.length > 0) {
                    sendEvent('thought', { content: thoughtContent });
                } else {
                    // Final response
                    fullResponseText += thoughtContent;
                    sendEvent('response_chunk', { content: thoughtContent });
                    finalResponseFound = true;
                }
            }

            // Provide tool execution
            if (toolUseBlocks.length > 0) {
                const toolResults = [];

                for (const block of toolUseBlocks) {
                    sendEvent('tool_start', { tool: block.name, input: block.input });
                    
                    let toolResult = '';
                    try {
                         // Execute tool with retry logic
                        const input = block.input as any;
                        toolResult = await executeToolWithRetry(block.name, input);
                    } catch (err: any) {
                        toolResult = `Error: ${err.message}`;
                    }

                    // Send result
                    sendEvent('tool_result', { result: toolResult });

                    // Log locally
                    toolResultsLog.push({ toolName: block.name, input: block.input, result: toolResult });

                    // Push to API conversation
                    toolResults.push({
                        type: 'tool_result' as const,
                        tool_use_id: block.id,
                        content: toolResult,
                    });
                }

                // Append assistant's move to history
                messages.push({
                    role: 'assistant',
                    content: response.content as any
                });

                // Append tool results to history
                messages.push({
                    role: 'user',
                    content: toolResults as any
                });

            } else {
                // No tools used, loop ends
                finalResponseFound = true;
            }
        }

        // 6. Finalize
        if (!fullResponseText && (iterations > 0 || toolResultsLog.length > 0)) {
            fullResponseText = "I have completed the requested operations.";
        }
        
        sendEvent('response', { content: fullResponseText }); // Signal completion
        const duration = Date.now() - startTime;
        
        trackTokenUsage(sessionId, inputTokens + outputTokens);

        // Update DB Log
        if (logId) {
            updateLogResponse({
                logId,
                responseStatus: 200,
                responseTimeMs: duration,
                responseText: fullResponseText,
                inputTokens,
                outputTokens
            }).catch(console.error);
        }

        // Broadcast agent completion to refresh UI
        if (supabaseAdmin) {
             supabaseAdmin.channel(`session:${sessionId}`)
                .send({
                    type: 'broadcast',
                    event: 'agent_complete',
                    payload: { timestamp: Date.now() }
                })
                .then(() => {
                    // console.log('Agent completion broadcast sent');
                })
                .catch(console.error);
        }

        controller.close();

      } catch (error: any) {
        console.error('Stream Error:', error);
        sendEvent('error', { error: error.message || 'Internal Error' });
        
        if (logId) {
             updateLogResponse({ logId, responseStatus: 500, responseTimeMs: 0, responseText: String(error) }).catch(console.error);
        }
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
