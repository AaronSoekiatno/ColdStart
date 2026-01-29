/**
 * Normalize candidate data before saving
 */

/**
 * Internal helper to title case a string while keeping small words lowercase
 */
function titleCase(text: string): string {
  if (!text) return text;
  
  const smallWords = ['and', 'of', 'in', 'with', 'for', 'at', 'by', 'on', 'to', 'from'];
  
  return text
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      if (word.length === 0) return word;
      
      // Always capitalize the first word, or if it's not a small word
      if (index === 0 || !smallWords.includes(word.toLowerCase())) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      
      return word.toLowerCase();
    })
    .join(' ');
}

/**
 * Normalize name to title case (first letter of each word capitalized)
 */
export function normalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  
  const trimmed = name.trim();
  if (!trimmed) return null;
  
  return titleCase(trimmed);
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
  'penn': 'University of Pennsylvania',
  
  // Other Top US Universities
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
  'wustl': 'Washington University in St. Louis',
  'washu': 'Washington University in St. Louis',
  'emory': 'Emory University',
  'notre dame': 'University of Notre Dame',
  'usc': 'University of Southern California',
  'uva': 'University of Virginia',
  'unc': 'University of North Carolina at Chapel Hill',
  'unc-ch': 'University of North Carolina at Chapel Hill',
  'ut austin': 'University of Texas at Austin',
  'uta': 'University of Texas at Austin',
  'gatech': 'Georgia Institute of Technology',
  'georgia tech': 'Georgia Institute of Technology',
  'gt': 'Georgia Institute of Technology',
  'purdue': 'Purdue University',
  'uiuc': 'University of Illinois Urbana-Champaign',
  'u michigan': 'University of Michigan',
  'umich': 'University of Michigan',
  'uw': 'University of Washington',
  'u washington': 'University of Washington',
  'uw madison': 'University of Wisconsin-Madison',
  'wisconsin madison': 'University of Wisconsin-Madison',
  'tamu': 'Texas A&M University',
  'texas a&m': 'Texas A&M University',
  'vt': 'Virginia Tech',
  'virginia tech': 'Virginia Tech',
  
  // State Schools & Others
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
  'rutgers': 'Rutgers University',
  'umd': 'University of Maryland',
  'u maryland': 'University of Maryland',
  'msu': 'Michigan State University',
  'michigan state': 'Michigan State University',
  'umn': 'University of Minnesota',
  'minnesota': 'University of Minnesota',
  'pitt': 'University of Pittsburgh',
  'csu': 'California State University',
  'cal state': 'California State University',
  'ucf': 'University of Central Florida',
  'sjsu': 'San Jose State University',
  'sfu': 'Simon Fraser University',
  
  // Canada
  'u of t': 'University of Toronto',
  'utoronto': 'University of Toronto',
  'uwaterloo': 'University of Waterloo',
  'waterloo': 'University of Waterloo',
  'mcgill': 'McGill University',
  'ubc': 'University of British Columbia',
  'uottawa': 'University of Ottawa',
  'western': 'Western University',
  'uwo': 'Western University',
  'queens': "Queen's University",
  'mcmaster': 'McMaster University',
  'alberta': 'University of Alberta',
  'ualberta': 'University of Alberta',
  
  // UK & Europe
  'oxford': 'University of Oxford',
  'cambridge': 'University of Cambridge',
  'lse': 'London School of Economics',
  'imperial': 'Imperial College London',
  'ucl': 'University College London',
  'kcl': 'King\'s College London',
  'eth': 'ETH Zurich',
  'eth zurich': 'ETH Zurich',
  'epfl': 'EPFL',
  'insead': 'INSEAD',
  'tud': 'TU Delft',
  'tu delft': 'TU Delft',
  'tum': 'Technical University of Munich',
  'polytechnique': 'École Polytechnique',
  
  // India (IITs, NITs, BITS)
  'iitb': 'Indian Institute of Technology, Bombay',
  'iit bombay': 'Indian Institute of Technology, Bombay',
  'iitd': 'Indian Institute of Technology, Delhi',
  'iit delhi': 'Indian Institute of Technology, Delhi',
  'iitk': 'Indian Institute of Technology, Kanpur',
  'iit kanpur': 'Indian Institute of Technology, Kanpur',
  'iitkgp': 'Indian Institute of Technology, Kharagpur',
  'iit kharagpur': 'Indian Institute of Technology, Kharagpur',
  'iitm': 'Indian Institute of Technology, Madras',
  'iit madras': 'Indian Institute of Technology, Madras',
  'iitr': 'Indian Institute of Technology, Roorkee',
  'iit roorkee': 'Indian Institute of Technology, Roorkee',
  'iit g': 'Indian Institute of Technology, Guwahati',
  'iit guwahati': 'Indian Institute of Technology, Guwahati',
  'iit bhilai': 'Indian Institute of Technology, Bhilai',
  'iit goa': 'Indian Institute of Technology, Goa',
  'iit jammu': 'Indian Institute of Technology, Jammu',
  'iit dharwad': 'Indian Institute of Technology, Dharwad',
  'iit palakkad': 'Indian Institute of Technology, Palakkad',
  'iit tirupati': 'Indian Institute of Technology, Tirupati',
  'bits': 'BITS Pilani',
  'bits pilani': 'BITS Pilani',
  'iiit': 'Indian Institute of Information Technology',
  'nit': 'National Institute of Technology',
  'vit': 'Vellore Institute of Technology',
  
  // Asia
  'nus': 'National University of Singapore',
  'ntu': 'Nanyang Technological University',
  'hku': 'University of Hong Kong',
  'ust': 'HKUST',
  'tsinghua': 'Tsinghua University',
  'pku': 'Peking University',
  'snu': 'Seoul National University',
  'kaist': 'KAIST',
  'tokyo': 'University of Tokyo',
  'kyoto': 'University of Kyoto',
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
  const titleCased = titleCase(schoolTrimmed);
  
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

/**
 * Normalize job type to lowercase with hyphens
 * Converts variations to: full-time, part-time, or internship
 */
export function normalizeJobType(jobType: string | null | undefined): string | null {
  if (!jobType) return null;

  const normalized = jobType.toLowerCase().trim();

  switch (normalized) {
    case 'full-time':
    case 'fulltime':
    case 'full time':
      return 'full-time';
    case 'part-time':
    case 'parttime':
    case 'part time':
      return 'part-time';
    case 'internship':
    case 'intern':
      return 'internship';
    default:
      console.warn(`Unknown job type: ${jobType}, defaulting to null`);
      return null;
  }
}
/**
 * Normalize major/field of study
 * Removes common prefixes like "B.S. in", "Bachelor of Science in", etc.
 */
export function normalizeMajor(major: string | null | undefined): string | null {
  if (!major) return null;
  
  let cleaned = major.trim();
  if (!cleaned) return null;
  
  // Remove common prefixes
  const prefixes = [
    /^b\.?s\.? (in |of )/i,
    /^b\.?a\.? (in |of )/i,
    /^b\.?e\.? (in |of )/i,
    /^b\.?tech\.? (in |of )/i,
    /^master of (science |arts )?(in )?/i,
    /^m\.?s\.? (in |of )/i,
    /^m\.?a\.? (in |of )/i,
    /^bachelor of (science |arts |engineering |technology )?(in )?/i,
    /^degree (in |of )/i,
    /^major (in |of )/i,
    /^concentration (in |of )/i,
    /^specialization (in |of )/i,
  ];
  
  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, '');
  }
  
  // Title case the result
  return titleCase(cleaned);
}
