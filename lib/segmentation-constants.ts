/**
 * Candidate Segmentation Constants
 *
 * School tier lists and helper functions for segmenting candidates.
 * Uses normalized names matching UNIVERSITY_ABBREVIATIONS from normalize-candidate-data.ts
 */

/**
 * Top 20 CS schools for segmentation
 * Uses normalized names matching UNIVERSITY_ABBREVIATIONS
 */
export const TOP_20_CS_SCHOOLS = [
  'Massachusetts Institute of Technology',
  'Stanford University',
  'Carnegie Mellon University',
  'University of California, Berkeley',
  'University of Illinois Urbana-Champaign',
  'Cornell University',
  'University of Washington',
  'Georgia Institute of Technology',
  'California Institute of Technology',
  'Princeton University',
  'University of Texas at Austin',
  'University of Michigan',
  'Columbia University',
  'University of California, Los Angeles',
  'University of California, San Diego',
  'Harvard University',
  'Yale University',
  'University of Pennsylvania',
  'Brown University',
  'Duke University',
];

export const ELITE_INTERNATIONAL_SCHOOLS = [
  // UK
  'University of Oxford',
  'University of Cambridge',
  'Imperial College London',
  'University College London',

  // Canada
  'University of Toronto',
  'University of British Columbia',
  'University of Waterloo',
  'McGill University',

  // Europe
  'ETH Zurich',
  'EPFL',
  'Technical University of Munich',
  'TU Delft',

  // Asia
  'National University of Singapore',
  'Nanyang Technological University',
  'Tsinghua University',
  'Peking University',
  'University of Tokyo',
  'KAIST',
  'Indian Institute of Technology, Bombay',
  'Indian Institute of Technology, Delhi',
  'Indian Institute of Technology, Madras',

  // Australia
  'University of Melbourne',
  'Australian National University',
];

/**
 * Check if normalized university is in a tier list
 */
export function isUniversityInList(
  normalizedUniversity: string | null | undefined,
  list: string[]
): boolean {
  if (!normalizedUniversity) return false;
  return list.includes(normalizedUniversity);
}

/**
 * Determine if location is US-based
 */
export function isUSLocation(location: string | null | undefined): boolean {
  if (!location) return false;
  const loc = location.toLowerCase().trim();

  const usIndicators = [
    'usa', 'united states', 'u.s.', ' us ', // space around 'us' to avoid false matches
    'alabama', 'al', 'alaska', 'ak', 'arizona', 'az', 'arkansas', 'ar',
    'california', 'ca', 'colorado', 'co', 'connecticut', 'ct',
    'delaware', 'de', 'florida', 'fl', 'georgia', 'ga',
    'hawaii', 'hi', 'idaho', 'id', 'illinois', 'il', 'indiana', 'in',
    'iowa', 'ia', 'kansas', 'ks', 'kentucky', 'ky', 'louisiana', 'la',
    'maine', 'me', 'maryland', 'md', 'massachusetts', 'ma', 'michigan', 'mi',
    'minnesota', 'mn', 'mississippi', 'ms', 'missouri', 'mo',
    'montana', 'mt', 'nebraska', 'ne', 'nevada', 'nv', 'new hampshire', 'nh',
    'new jersey', 'nj', 'new mexico', 'nm', 'new york', 'ny',
    'north carolina', 'nc', 'north dakota', 'nd', 'ohio', 'oh',
    'oklahoma', 'ok', 'oregon', 'or', 'pennsylvania', 'pa',
    'rhode island', 'ri', 'south carolina', 'sc', 'south dakota', 'sd',
    'tennessee', 'tn', 'texas', 'tx', 'utah', 'ut', 'vermont', 'vt',
    'virginia', 'va', 'washington', 'wa', 'west virginia', 'wv',
    'wisconsin', 'wi', 'wyoming', 'wy',
    // Major cities
    'san francisco', 'new york city', 'nyc', 'los angeles', 'seattle',
    'boston', 'austin', 'chicago', 'miami', 'atlanta', 'denver',
    'portland', 'philadelphia', 'san diego', 'san jose',
  ];

  return usIndicators.some(indicator =>
    loc.includes(indicator) || loc === indicator
  );
}
