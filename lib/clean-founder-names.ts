/**
 * Utility functions to clean and validate founder names
 * Can be used in application code to filter out false positives
 */

// Known false positive patterns from YC company pages (section headings)
const FALSE_POSITIVE_NAMES = new Set([
  'The Problem', 'Problem',
  'Our Solution', 'Solution', 'The Solution',
  'Our Story', 'Story',
  'Since Launch', 'Launch',
  'Our Approach', 'Approach',
  'Launch Video', 'Video',
  'Our Ask', 'Ask', 'The Ask',
  'The Team', 'Team',
  'Our Mission', 'Mission',
  'Our Vision', 'Vision',
  'Company History', 'History',
  'About Us', 'Us',
  'What We Do', 'We Do',
  'How It Works', 'It Works',
  'Meet The Team',
  'Our Product', 'Product',
  'Our Technology', 'Technology',
  'Our Customers', 'Customers',
  'Our Traction', 'Traction',
  'Contact Us',
  'Read More', 'More',
  'Learn More',
  'Get Started', 'Started',
  'Sign Up', 'Up',
  'View All', 'All',
  'About', 'Contact', 'Join',
  'Careers', 'Press', 'News',
  'Blog', 'FAQ', 'Help',
  'Support', 'Login', 'Signup',
]);

// Patterns that indicate a false positive
const FALSE_POSITIVE_PATTERNS = [
  /^(The|Our|Since|Meet|How|What|Read|Learn|Get|Sign|View|Contact|About)\s+/i,
  /^(Join|Career|Press|News|Blog|FAQ|Help|Support|Login|Signup)$/i,
];

/**
 * Check if a name is likely a false positive (section heading, not a real name)
 */
export function isFalsePositive(name: string): boolean {
  const trimmedName = name.trim();

  // Empty names
  if (!trimmedName) {
    return true;
  }

  // Check exact matches
  if (FALSE_POSITIVE_NAMES.has(trimmedName)) {
    return true;
  }

  // Check patterns
  for (const pattern of FALSE_POSITIVE_PATTERNS) {
    if (pattern.test(trimmedName)) {
      return true;
    }
  }

  // Very short single-word names (likely not real)
  if (!trimmedName.includes(' ') && trimmedName.length < 3) {
    return true;
  }

  // All caps (likely a heading)
  if (trimmedName === trimmedName.toUpperCase() && trimmedName.length > 2) {
    return true;
  }

  return false;
}

/**
 * Clean a comma-separated list of founder names by removing false positives
 * Returns null if no valid names remain
 */
export function cleanFounderNames(founderNamesString: string | null | undefined): string | null {
  if (!founderNamesString || founderNamesString.trim() === '') {
    return null;
  }

  // Split by comma and filter out false positives
  const names = founderNamesString
    .split(',')
    .map(n => n.trim())
    .filter(n => n !== '' && !isFalsePositive(n));

  // Return null if no valid names remain
  if (names.length === 0) {
    return null;
  }

  // Return cleaned comma-separated list
  return names.join(', ');
}

/**
 * Split comma-separated founder names into an array, filtering out false positives
 * Returns empty array if no valid names remain
 */
export function splitFounderNames(founderNamesString: string | null | undefined): string[] {
  if (!founderNamesString || founderNamesString.trim() === '') {
    return [];
  }

  return founderNamesString
    .split(',')
    .map(n => n.trim())
    .filter(n => n !== '' && !isFalsePositive(n));
}

/**
 * Get the first valid founder name from a comma-separated list
 * Returns null if no valid names exist
 */
export function getFirstFounderName(founderNamesString: string | null | undefined): string | null {
  const names = splitFounderNames(founderNamesString);
  return names.length > 0 ? names[0] : null;
}

/**
 * Count how many valid founder names are in a comma-separated list
 */
export function countValidFounderNames(founderNamesString: string | null | undefined): number {
  return splitFounderNames(founderNamesString).length;
}

export default {
  isFalsePositive,
  cleanFounderNames,
  splitFounderNames,
  getFirstFounderName,
  countValidFounderNames,
};
