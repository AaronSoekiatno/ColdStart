import Anthropic from '@anthropic-ai/sdk';

/**
 * Tool definitions for Claude to interact with candidate workspace
 */

export const READ_FILE_TOOL: Anthropic.Tool = {
  name: 'read_file',
  description: 'Read the contents of a file from the candidate workspace. Use this to examine code, configuration files, or documentation. You can optionally specify line ranges to read only part of a file.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file from workspace root (e.g., "app/page.tsx", "package.json")',
      },
      start_line: {
        type: 'number',
        description: 'Optional: Starting line number (1-indexed). If omitted, reads from beginning.',
      },
      end_line: {
        type: 'number',
        description: 'Optional: Ending line number (1-indexed, inclusive). If omitted, reads to end.',
      },
    },
    required: ['path'],
  },
};

export const LIST_DIRECTORY_TOOL: Anthropic.Tool = {
  name: 'list_directory',
  description: 'List files and directories in a workspace directory. Use this to explore the project structure.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to directory from workspace root (e.g., "app", "components"). Use "." for root.',
      },
      recursive: {
        type: 'boolean',
        description: 'If true, list files recursively. Default: false',
      },
    },
    required: ['path'],
  },
};

export const SEARCH_CODE_TOOL: Anthropic.Tool = {
  name: 'search_code',
  description: 'Search for text patterns in workspace files using grep. Useful for finding function definitions, imports, or specific code patterns.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Text or pattern to search for',
      },
      file_pattern: {
        type: 'string',
        description: 'Optional: File pattern to search in (e.g., "*.tsx", "*.ts"). If omitted, searches all files.',
      },
      case_sensitive: {
        type: 'boolean',
        description: 'Whether search should be case-sensitive. Default: false',
      },
    },
    required: ['query'],
  },
};

/**
 * Get all available tools
 */
export function getWorkspaceTools(): Anthropic.Tool[] {
  return [
    READ_FILE_TOOL,
    LIST_DIRECTORY_TOOL,
    SEARCH_CODE_TOOL,
  ];
}

/**
 * System prompt for coding assistant
 */
export const CODING_ASSISTANT_SYSTEM_PROMPT = `You are a helpful coding assistant helping a candidate complete their assessment.

You have access to their workspace through tools. Use these tools to:
- Read files to understand their code
- List directories to explore project structure  
- Search for specific code patterns

Guidelines:
- Be concise and helpful
- Only read files when necessary to answer the question
- Suggest specific code changes when appropriate
- If you need to see code, use the read_file tool rather than asking the candidate to paste it
- Focus on helping them solve problems, not doing the work for them

The workspace is a Next.js application with TypeScript. Common directories:
- app/ - Next.js app router pages and API routes
- components/ - React components
- lib/ - Utility functions and shared code
- tests/ - Test files
`;
