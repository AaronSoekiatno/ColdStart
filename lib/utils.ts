import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Fisher-Yates shuffle algorithm
 * Randomly shuffles an array with O(n) complexity
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Shuffle matches within score groups
 * Groups matches by score, shuffles within each group, then concatenates
 * This preserves score ordering while randomizing within each score tier
 */
export function shuffleByScoreGroups<T extends { score: number }>(array: T[]): T[] {
  // Group by score
  const scoreGroups = new Map<number, T[]>();

  for (const item of array) {
    const score = item.score;
    if (!scoreGroups.has(score)) {
      scoreGroups.set(score, []);
    }
    scoreGroups.get(score)!.push(item);
  }

  // Sort score keys descending
  const sortedScores = Array.from(scoreGroups.keys()).sort((a, b) => b - a);

  // Shuffle within each group and concatenate
  const result: T[] = [];
  for (const score of sortedScores) {
    const group = scoreGroups.get(score)!;
    const shuffledGroup = shuffleArray(group);
    result.push(...shuffledGroup);
  }

  return result;
}

/**
 * Reorder an array based on stored order of IDs
 * Used to restore shuffle order from sessionStorage
 */
export function reorderByIds<T extends { id: string }>(
  items: T[],
  orderedIds: string[]
): T[] {
  const itemMap = new Map(items.map(item => [item.id, item]));
  return orderedIds
    .map(id => itemMap.get(id))
    .filter((item): item is T => item !== undefined);
}

