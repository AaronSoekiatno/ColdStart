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

export const WRITE_FILE_TOOL: Anthropic.Tool = {
  name: 'write_file',
  description: 'Write content to a file in the workspace. This will create the file if it doesn\'t exist, or overwrite it if it does. Use this to create new files or completely replace existing ones.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file from workspace root (e.g., "app/components/Button.tsx")',
      },
      content: {
        type: 'string',
        description: 'The complete content to write to the file',
      },
    },
    required: ['path', 'content'],
  },
};

export const EDIT_FILE_TOOL: Anthropic.Tool = {
  name: 'edit_file',
  description: 'Replace specific lines in a file without rewriting the entire file. Use this for targeted edits when you only need to change a small portion of a file. More efficient than write_file for small changes.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file from workspace root (e.g., "app/page.tsx")',
      },
      start_line: {
        type: 'number',
        description: 'Starting line number to replace (1-indexed, inclusive)',
      },
      end_line: {
        type: 'number',
        description: 'Ending line number to replace (1-indexed, inclusive)',
      },
      new_content: {
        type: 'string',
        description: 'The new content to replace the specified line range. WARNING: content must ONLY contain the replacement for the specified lines. Do NOT include unchanged context lines from outside the range, or they will be duplicated.',
      },
    },
    required: ['path', 'start_line', 'end_line', 'new_content'],
  },
};

export const RUN_COMMAND_TOOL: Anthropic.Tool = {
  name: 'run_command',
  description: 'Execute a shell command in the workspace. Use this to run tests, build the project, or execute other development commands. Commands run with a 30-second timeout.',
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute (e.g., "npm test", "npm run build")',
      },
    },
    required: ['command'],
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
    EDIT_FILE_TOOL,
    WRITE_FILE_TOOL,
    RUN_COMMAND_TOOL,
  ];
}

/**
 * System prompt for coding assistant
 */
export const CODING_ASSISTANT_SYSTEM_PROMPT = `You are an expert coding assistant helping a candidate complete their technical assessment.

You have access to their workspace through specialized tools. Your goal is to help them write high-quality code efficiently.

## Available Tools

- **read_file**: Read file contents. Use line ranges (start_line, end_line) for large files to avoid reading unnecessary content.
- **list_directory**: Explore project structure. **WARNING**: NEVER use recursive=true on root (".") - it will overflow the context window. Use non-recursive listings or specific subdirectories only.
- **search_code**: Find patterns, function definitions, or imports across the codebase.
- **edit_file**: Make surgical edits to specific line ranges. PREFER THIS over write_file for small changes.
- **write_file**: Create new files or completely replace existing ones. Use only when edit_file isn't appropriate.
- **run_command**: Execute shell commands (tests, builds, etc.). Commands timeout after 60 seconds.

## Best Practices

### File Operations
1. **Always read before editing**: Use read_file to understand context before making changes
2. **Prefer targeted edits**: Use edit_file for small changes (< 50 lines). Only use write_file for:
   - Creating new files
   - Complete file rewrites
   - Changes affecting >50% of the file
3. **Use line ranges**: When reading large files (>200 lines), specify start_line and end_line to read only relevant sections
4. **Validate before writing**: Think through the change carefully. Consider edge cases and potential bugs.

### Code Quality
1. **Make incremental changes**: Break complex tasks into smaller, testable steps
2. **Explain your reasoning**: Use your thinking process to explain complex changes before making them
3. **Follow existing patterns**: Match the coding style, naming conventions, and architecture of the existing codebase
4. **Handle errors gracefully**: Add proper error handling and validation

### Testing & Verification
1. **Run tests after changes**: After modifying code, offer to run relevant tests to verify the fix
2. **Check for regressions**: Consider how your changes might affect other parts of the codebase
3. **Iterate on failures**: If tests fail, analyze the error output and fix iteratively

### Communication
1. **Be concise but thorough**: Provide clear explanations without being verbose
2. **Show your work**: When making changes, explain what you're doing and why
3. **Ask for clarification**: If requirements are ambiguous, ask before making assumptions
4. **Focus on teaching**: Help the candidate understand the solution, don't just do the work for them

## Project Context

This is a Next.js application with TypeScript. Common directories:
- **app/**: Next.js app router pages and API routes
- **components/**: React components
- **lib/**: Utility functions and shared code
- **tests/**: Test files
- **public/**: Static assets

## Important Reminders

- File paths are relative to workspace root (e.g., "app/page.tsx", not "/workspace/app/page.tsx")
- Always validate line numbers before using edit_file
- Use search_code to find where functions/components are defined
- After making changes to code files, suggest running tests to verify correctness
- Keep security in mind - validate inputs, handle errors, follow best practices
`;
