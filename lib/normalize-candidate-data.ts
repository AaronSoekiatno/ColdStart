/**
 * Normalize candidate data before saving
 */

/**
 * Normalize name to title case (first letter of each word capitalized)
 */
export function normalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  
  const trimmed = name.trim();
  if (!trimmed) return null;
  
  return trimmed
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Capitalize first letter of each word
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Normalize education level to one of: "Bachelor's", "Master's", or "Highschool"
 */
export function normalizeEducationLevel(degree: string | null | undefined): string | null {
  if (!degree) return null;
  
  const degreeLower = degree.toLowerCase().trim();
  
  // Master's degree variations
  if (degreeLower.includes('master') || 
      degreeLower.includes('m.s.') || 
      degreeLower.includes('m.s') ||
      degreeLower.includes('ms ') ||
      degreeLower.includes('m.a.') ||
      degreeLower.includes('m.a') ||
      degreeLower.includes('ma ') ||
      degreeLower.includes('mba') ||
      degreeLower.includes('m.ed') ||
      degreeLower.includes('mfa') ||
      degreeLower.includes('ph.d') ||
      degreeLower.includes('phd') ||
      degreeLower.includes('doctorate') ||
      degreeLower.includes('doctoral')) {
    return "Master's";
  }
  
  // Bachelor's degree variations
  if (degreeLower.includes('bachelor') || 
      degreeLower.includes('b.s.') || 
      degreeLower.includes('b.s') ||
      degreeLower.includes('bs ') ||
      degreeLower.includes('b.a.') ||
      degreeLower.includes('b.a') ||
      degreeLower.includes('ba ') ||
      degreeLower.includes('b-tech') ||
      degreeLower.includes('b.tech') ||
      degreeLower.includes('btech') ||
      degreeLower.includes('b.e.') ||
      degreeLower.includes('b.e') ||
      degreeLower.includes('be ') ||
      degreeLower.includes('b.eng') ||
      degreeLower.includes('beng') ||
      degreeLower.includes('b.com') ||
      degreeLower.includes('bcom') ||
      degreeLower.includes('b.sc') ||
      degreeLower.includes('bsc')) {
    return "Bachelor's";
  }
  
  // High school variations
  if (degreeLower.includes('high school') || 
      degreeLower.includes('highschool') ||
      degreeLower.includes('secondary') ||
      (degreeLower.includes('diploma') && !degreeLower.includes('bachelor') && !degreeLower.includes('master'))) {
    return "Highschool";
  }
  
  // Default: if it contains any degree-like keywords but doesn't match above, assume Bachelor's
  // (most common case)
  if (degreeLower.length > 0) {
    return "Bachelor's"; // Default fallback
  }
  
  return null;
}

/**
 * Common university abbreviation mappings
 */
const UNIVERSITY_ABBREVIATIONS: Record<string, string> = {
  // UC System
  'ucsd': 'University of California, San Diego',
  'uc berkeley': 'University of California, Berkeley',
  'ucb': 'University of California, Berkeley',
  'ucla': 'University of California, Los Angeles',
  'uc davis': 'University of California, Davis',
  'ucd': 'University of California, Davis',
  'uc irvine': 'University of California, Irvine',
  'uci': 'University of California, Irvine',
  'uc santa barbara': 'University of California, Santa Barbara',
  'ucsb': 'University of California, Santa Barbara',
  'uc riverside': 'University of California, Riverside',
  'ucr': 'University of California, Riverside',
  'uc santa cruz': 'University of California, Santa Cruz',
  'ucsc': 'University of California, Santa Cruz',
  'uc merced': 'University of California, Merced',
  'ucm': 'University of California, Merced',
  
  // Ivy League
  'brown': 'Brown University',
  'harvard': 'Harvard University',
  'yale': 'Yale University',
  'princeton': 'Princeton University',
  'columbia': 'Columbia University',
  'cornell': 'Cornell University',
  'dartmouth': 'Dartmouth College',
  'upenn': 'University of Pennsylvania',
  'u penn': 'University of Pennsylvania',
  
  // Other top universities
  'mit': 'Massachusetts Institute of Technology',
  'stanford': 'Stanford University',
  'caltech': 'California Institute of Technology',
  'cal tech': 'California Institute of Technology',
  'cmu': 'Carnegie Mellon University',
  'carnegie mellon': 'Carnegie Mellon University',
  'nyu': 'New York University',
  'georgetown': 'Georgetown University',
  'duke': 'Duke University',
  'northwestern': 'Northwestern University',
  'uchicago': 'University of Chicago',
  'u chicago': 'University of Chicago',
  'jhu': 'Johns Hopkins University',
  'johns hopkins': 'Johns Hopkins University',
  'rice': 'Rice University',
  'vanderbilt': 'Vanderbilt University',
  'washington university': 'Washington University in St. Louis',
  'washu': 'Washington University in St. Louis',
  'wustl': 'Washington University in St. Louis',
  'emory': 'Emory University',
  'notre dame': 'University of Notre Dame',
  'usc': 'University of Southern California',
  'uva': 'University of Virginia',
  'unc': 'University of North Carolina at Chapel Hill',
  'ut austin': 'University of Texas at Austin',
  'uta': 'University of Texas at Austin',
  'utd': 'University of Texas at Dallas',
  'gatech': 'Georgia Institute of Technology',
  'georgia tech': 'Georgia Institute of Technology',
  'gt': 'Georgia Institute of Technology',
  'purdue': 'Purdue University',
  'uiuc': 'University of Illinois Urbana-Champaign',
  'u of i': 'University of Illinois Urbana-Champaign',
  'umich': 'University of Michigan',
  'u michigan': 'University of Michigan',
  'uw': 'University of Washington',
  'u washington': 'University of Washington',
  'uw madison': 'University of Wisconsin-Madison',
  'u wisconsin': 'University of Wisconsin-Madison',
  
  // State schools
  'asu': 'Arizona State University',
  'arizona state': 'Arizona State University',
  'psu': 'Pennsylvania State University',
  'penn state': 'Pennsylvania State University',
  'osu': 'Ohio State University',
  'ohio state': 'Ohio State University',
  'fsu': 'Florida State University',
  'florida state': 'Florida State University',
  'uf': 'University of Florida',
  'u florida': 'University of Florida',
  
  // International
  'u of t': 'University of Toronto',
  'utoronto': 'University of Toronto',
  'uwaterloo': 'University of Waterloo',
  'waterloo': 'University of Waterloo',
  'mcgill': 'McGill University',
  'ubc': 'University of British Columbia',
  'lse': 'London School of Economics',
  'imperial': 'Imperial College London',
  'oxford': 'University of Oxford',
  'cambridge': 'University of Cambridge',
  'eth zurich': 'ETH Zurich',
  'eth': 'ETH Zurich',
};

/**
 * Normalize university name to full name and title case
 * Uses lookup table for common abbreviations, returns title-cased original if not found
 */
export function normalizeUniversityName(school: string | null | undefined): string | null {
  if (!school) return null;
  
  const schoolTrimmed = school.trim();
  if (!schoolTrimmed) return null;
  
  // First, normalize to title case
  const titleCased = schoolTrimmed
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
  
  // Check exact match (case-insensitive) in lookup table
  const schoolLower = schoolTrimmed.toLowerCase();
  if (UNIVERSITY_ABBREVIATIONS[schoolLower]) {
    return UNIVERSITY_ABBREVIATIONS[schoolLower];
  }
  
  // Check if it's already a full name (contains "University" or "College")
  if (titleCased.toLowerCase().includes('university') || 
      titleCased.toLowerCase().includes('college')) {
    // Return title-cased version
    return titleCased;
  }
  
  // Check partial matches (e.g., "UC San Diego" -> "University of California, San Diego")
  for (const [abbrev, fullName] of Object.entries(UNIVERSITY_ABBREVIATIONS)) {
    if (schoolLower.includes(abbrev) || abbrev.includes(schoolLower)) {
      return fullName;
    }
  }
  
  // If no match found, return title-cased original
  return titleCased;
}

