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
import { logPrompt, updateLogResponse } from '@/lib/claude/logger';

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
        const messages: ClaudeMessage[] = [
          ...conversationHistory,
          { role: 'user', content: message },
        ];
        const tools = getWorkspaceTools();
        
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
                         // Execute tool
                        const input = block.input as any;
                        if (block.name === 'read_file') {
                            toolResult = await readWorkspaceFile(flyAppName, { path: input.path, startLine: input.start_line, endLine: input.end_line });
                        } else if (block.name === 'list_directory') {
                            toolResult = await listWorkspaceDirectory(flyAppName, { path: input.path, recursive: input.recursive });
                        } else if (block.name === 'search_code') {
                            toolResult = await searchWorkspaceCode(flyAppName, { query: input.query, filePattern: input.file_pattern, caseSensitive: input.case_sensitive });
                        } else if (block.name === 'write_file') {
                            toolResult = await writeWorkspaceFile(flyAppName, { path: input.path, content: input.content });
                        } else if (block.name === 'run_command') {
                            toolResult = await runWorkspaceCommand(flyAppName, { command: input.command });
                        } else {
                            toolResult = `Unknown tool: ${block.name}`;
                        }
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
