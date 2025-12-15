/**
 * Inline diff utility for showing word-level changes
 * Similar to Grammarly-style inline suggestions
 */

export interface DiffPart {
  type: 'unchanged' | 'removed' | 'added';
  text: string;
}

/**
 * Calculate word-level diff between original and suggested text
 * Returns an array of diff parts that can be rendered inline
 */
export function calculateInlineDiff(original: string, suggested: string): DiffPart[] {
  const originalWords = tokenize(original);
  const suggestedWords = tokenize(suggested);

  const diff = diffArrays(originalWords, suggestedWords);
  return diff;
}

/**
 * Tokenize text into words and spaces
 * Preserves spaces as separate tokens for accurate reconstruction
 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const regex = /(\s+|\S+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[1]);
  }

  return tokens;
}

/**
 * Simple diff algorithm for arrays
 * Returns array of diff parts showing what was removed, added, or unchanged
 */
function diffArrays(original: string[], suggested: string[]): DiffPart[] {
  const result: DiffPart[] = [];

  // Use LCS (Longest Common Subsequence) algorithm for better diff
  const lcs = longestCommonSubsequence(original, suggested);

  let i = 0; // pointer for original
  let j = 0; // pointer for suggested
  let lcsIndex = 0; // pointer for LCS

  while (i < original.length || j < suggested.length) {
    // If we've matched all LCS elements, handle remaining items
    if (lcsIndex >= lcs.length) {
      // Add remaining original items as removed
      while (i < original.length) {
        addOrMergePart(result, { type: 'removed', text: original[i] });
        i++;
      }
      // Add remaining suggested items as added
      while (j < suggested.length) {
        addOrMergePart(result, { type: 'added', text: suggested[j] });
        j++;
      }
      break;
    }

    const lcsItem = lcs[lcsIndex];

    // Check if current original item matches LCS
    if (i < original.length && original[i] === lcsItem.value) {
      // Check if current suggested item also matches
      if (j < suggested.length && suggested[j] === lcsItem.value) {
        // Both match - this is unchanged
        addOrMergePart(result, { type: 'unchanged', text: original[i] });
        i++;
        j++;
        lcsIndex++;
      } else {
        // Original matches but suggested doesn't - suggested item was added
        addOrMergePart(result, { type: 'added', text: suggested[j] });
        j++;
      }
    } else if (j < suggested.length && suggested[j] === lcsItem.value) {
      // Suggested matches but original doesn't - original item was removed
      addOrMergePart(result, { type: 'removed', text: original[i] });
      i++;
    } else {
      // Neither matches - handle as removal and addition
      if (i < original.length) {
        addOrMergePart(result, { type: 'removed', text: original[i] });
        i++;
      }
      if (j < suggested.length) {
        addOrMergePart(result, { type: 'added', text: suggested[j] });
        j++;
      }
    }
  }

  return result;
}

/**
 * Add a part to the result, merging consecutive parts of the same type
 */
function addOrMergePart(result: DiffPart[], part: DiffPart): void {
  if (result.length > 0 && result[result.length - 1].type === part.type) {
    result[result.length - 1].text += part.text;
  } else {
    result.push(part);
  }
}

/**
 * Find longest common subsequence between two arrays
 */
function longestCommonSubsequence(arr1: string[], arr2: string[]): { value: string; index1: number; index2: number }[] {
  const m = arr1.length;
  const n = arr2.length;

  // Create LCS table
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

  // Fill the table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find the LCS
  const lcs: { value: string; index1: number; index2: number }[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      lcs.unshift({ value: arr1[i - 1], index1: i - 1, index2: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}
