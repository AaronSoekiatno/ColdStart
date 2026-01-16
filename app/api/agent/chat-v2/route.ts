import { NextRequest } from 'next/server';
import { callClaude, type ClaudeMessage } from '@/lib/claude/client';
import { getWorkspaceTools, CODING_ASSISTANT_SYSTEM_PROMPT } from '@/lib/claude/tools';
import {
  readWorkspaceFile,
  listWorkspaceDirectory,
  searchWorkspaceCode,
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId, flyAppName, conversationHistory = [] } = body;

    // Validate required fields
    if (!message || !sessionId || !flyAppName) {
      return Response.json(
        { error: 'Missing required fields: message, sessionId, flyAppName' },
        { status: 400 }
      );
    }

    // Check cost limits
    const estimatedTokens = estimateTokenCount(message);
    const limitCheck = checkSessionLimits(sessionId, estimatedTokens);

    if (!limitCheck.allowed) {
      return Response.json(
        {
          error: 'Cost limit exceeded',
          reason: limitCheck.reason,
          usage: getSessionUsage(sessionId),
        },
        { status: 429 }
      );
    }

    console.log('[Chat V2] Request:', {
      sessionId,
      flyAppName,
      messageLength: message.length,
      estimatedTokens,
    });

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
          console.log('[Chat V2] Tool call:', block.name, block.input);

          let toolResult: string;

          try {
            // Execute tool
            switch (block.name) {
              case 'read_file':
                const readInput = block.input as any;
                toolResult = await readWorkspaceFile(flyAppName, {
                  path: readInput.path,
                  startLine: readInput.start_line,
                  endLine: readInput.end_line,
                });
                break;

              case 'list_directory':
                const listInput = block.input as any;
                toolResult = await listWorkspaceDirectory(flyAppName, {
                  path: listInput.path,
                  recursive: listInput.recursive,
                });
                break;

              case 'search_code':
                const searchInput = block.input as any;
                toolResult = await searchWorkspaceCode(flyAppName, {
                  query: searchInput.query,
                  filePattern: searchInput.file_pattern,
                  caseSensitive: searchInput.case_sensitive,
                });
                break;

              default:
                toolResult = `Unknown tool: ${block.name}`;
            }

            console.log('[Chat V2] Tool result length:', toolResult.length);
          } catch (error: any) {
            toolResult = `Error: ${error.message}`;
            console.error('[Chat V2] Tool error:', error);
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

    console.log('[Chat V2] Success:', {
      tokensUsed,
      iterations,
      responseLength: finalText.length,
    });

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
    console.error('[Chat V2] Error:', error);
    return Response.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
