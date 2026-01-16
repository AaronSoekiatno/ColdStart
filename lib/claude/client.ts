import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeToolCall {
  name: string;
  input: Record<string, any>;
}

export interface ClaudeStreamChunk {
  type: 'text' | 'tool_use' | 'error';
  content: string;
  toolCall?: ClaudeToolCall;
}

/**
 * Call Claude API with streaming support and tool use
 */
export async function* streamClaudeResponse(
  messages: ClaudeMessage[],
  tools: Anthropic.Tool[],
  options: {
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
  } = {}
): AsyncGenerator<ClaudeStreamChunk> {
  const {
    model = 'claude-3-5-haiku-20241022', // Haiku for cost savings
    maxTokens = 4096,
    systemPrompt = 'You are a helpful coding assistant.',
  } = options;

  try {
    const stream = await anthropic.messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      tools: tools.length > 0 ? tools : undefined,
    });

    for await (const chunk of stream) {
      // Handle different chunk types
      if (chunk.type === 'content_block_delta') {
        if (chunk.delta.type === 'text_delta') {
          yield {
            type: 'text',
            content: chunk.delta.text,
          };
        }
      } else if (chunk.type === 'content_block_start') {
        if (chunk.content_block.type === 'tool_use') {
          yield {
            type: 'tool_use',
            content: '',
            toolCall: {
              name: chunk.content_block.name,
              input: chunk.content_block.input,
            },
          };
        }
      }
    }

    // Get final message for tool use handling
    const finalMessage = await stream.finalMessage();
    
    // Return tool calls if any
    for (const block of finalMessage.content) {
      if (block.type === 'tool_use') {
        yield {
          type: 'tool_use',
          content: '',
          toolCall: {
            name: block.name,
            input: block.input,
          },
        };
      }
    }
  } catch (error: any) {
    yield {
      type: 'error',
      content: error.message || 'Unknown error occurred',
    };
  }
}

/**
 * Non-streaming version for simpler use cases
 */
export async function callClaude(
  messages: ClaudeMessage[],
  tools: Anthropic.Tool[],
  options: {
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
  } = {}
): Promise<Anthropic.Message> {
  const {
    model = 'claude-3-5-haiku-20241022',
    maxTokens = 4096,
    systemPrompt = 'You are a helpful coding assistant.',
  } = options;

  return await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    tools: tools.length > 0 ? tools : undefined,
  });
}

export { anthropic };
