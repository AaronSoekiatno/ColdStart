import { minimatch } from 'minimatch';

/**
 * Maximum size for individual files (1MB)
 */
export const MAX_FILE_SIZE = 1 * 1024 * 1024;

/**
 * Maximum total snapshot size (50MB)
 */
export const MAX_SNAPSHOT_SIZE = 50 * 1024 * 1024;

/**
 * Generate patterns to exclude from snapshot
 * These patterns follow gitignore-style glob syntax
 */
export function generateExcludePatterns(): string[] {
  return [
    // Dependencies
    'node_modules',
    'node_modules/**/*',
    '.yarn',
    '.yarn/**/*',
    '.pnp.js',

    // Build artifacts
    '.next',
    '.next/**/*',
    'dist',
    'dist/**/*',
    'build',
    'build/**/*',
    'out',
    'out/**/*',

    // Lock files
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'bun.lockb',

    // Logs
    '*.log',
    '.dev-server.log',
    'logs',
    'logs/**/*',

    // IDE and editor folders
    '.cursor',
    '.cursor/**/*',
    '.vscode',
    '.vscode/**/*',
    '.idea',
    '.idea/**/*',
    '.github',
    '.github/**/*',

    // Environment files
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test',
    '.env.*',

    // Source maps
    '*.map',

    // Cache directories
    '.cache',
    '.cache/**/*',
    '.turbo',
    '.turbo/**/*',
    '.eslintcache',

    // OS files
    '.DS_Store',
    'Thumbs.db',

    // Temporary files
    'tmp',
    'tmp/**/*',
    'temp',
    'temp/**/*',
    '*.tmp',

    // Binary and media files (large files)
    '*.png',
    '*.jpg',
    '*.jpeg',
    '*.gif',
    '*.ico',
    '*.svg',
    '*.woff',
    '*.woff2',
    '*.ttf',
    '*.eot',
    '*.pdf',
    '*.zip',
    '*.tar',
    '*.tar.gz',
    '*.tgz',

    // Git folder (not needed in snapshots)
    '.git',
    '.git/**/*',
    '.gitattributes',

    // Test coverage
    'coverage',
    'coverage/**/*',
    '.nyc_output',
    '.nyc_output/**/*',
  ];
}

/**
 * Check if a file should be included in the snapshot
 *
 * @param filePath - Relative file path from workspace root
 * @param fileSize - Size of the file in bytes
 * @returns true if file should be included, false otherwise
 */
export function shouldIncludeFile(filePath: string, fileSize?: number): boolean {
  // Check file size limit
  if (fileSize !== undefined && fileSize > MAX_FILE_SIZE) {
    return false;
  }

  const excludePatterns = generateExcludePatterns();

  // Check against all exclude patterns
  for (const pattern of excludePatterns) {
    if (minimatch(filePath, pattern, { dot: true })) {
      return false;
    }
  }

  return true;
}

/**
 * Generate exclude file content for tar command
 * Returns patterns in a format suitable for tar --exclude-from
 */
export function generateTarExcludeFileContent(): string {
  const patterns = generateExcludePatterns();

  // Convert glob patterns to tar exclude patterns
  // Remove the **/* suffix as tar patterns are recursive by default
  const tarPatterns = patterns.map(pattern => {
    // Remove trailing /**/* for tar compatibility
    return pattern.replace(/\/\*\*\/\*$/, '');
  });

  return tarPatterns.join('\n');
}
