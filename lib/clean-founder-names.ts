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
  // Legal and document-related false positives
  'Legal Information', 'legal information', 'Legal information',
  'Address Proof', 'address proof', 'Address proof',
  'Proof', 'Information',
]);

// Patterns that indicate a false positive
const FALSE_POSITIVE_PATTERNS = [
  /^(The|Our|Since|Meet|How|What|Read|Learn|Get|Sign|View|Contact|About)\s+/i,
  /^(Join|Career|Press|News|Blog|FAQ|Help|Support|Login|Signup)$/i,
  // Legal/document related patterns
  /^(Legal|Address|Proof|Information)\s+/i,
  /\b(legal information|address proof|proof of address|legal document)\b/i,
];

/**
 * Normalize name capitalization - capitalize first letter of each word
 * but preserve lowercase for common name particles in the middle
 */
function normalizeNameCapitalization(name: string): string {
  const nameParticles = new Set(['de', 'del', 'de la', 'von', 'van', 'le', 'la', 'du', 'des', 'i', 'y', 'da', 'dos', 'das', 'zur']);
  
  const words = name.split(/\s+/);
  const normalized = words.map((word, index) => {
    // First and last words should be capitalized
    if (index === 0 || index === words.length - 1) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    // Middle words: if it's a particle, keep lowercase (or capitalize if already capitalized)
    const wordLower = word.toLowerCase();
    if (nameParticles.has(wordLower)) {
      return wordLower;
    }
    // Otherwise capitalize
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
  
  return normalized.join(' ');
}

/**
 * Extract just the name part, removing description suffixes like "Name - Description"
 * Returns the cleaned name part
 */
function extractNamePart(name: string): string {
  const trimmedName = name.trim();
  
  // Check if name contains " - " separator (common pattern for "Name - Description")
  const dashIndex = trimmedName.indexOf(' - ');
  if (dashIndex > 0) {
    const beforeDash = trimmedName.substring(0, dashIndex).trim();
    const afterDash = trimmedName.substring(dashIndex + 3).trim();
    
    // If the part after dash looks like a description (contains keywords, is long, etc.)
    // return just the part before the dash
    if (afterDash.length > 0) {
      // Keywords that suggest it's a description rather than a name
      const descriptionKeywords = [
        'platform', 'management', 'workforce', 'solution', 'service', 'product',
        'system', 'tool', 'software', 'application', 'app', 'build', 'create',
        'ai', 'engineering', 'business', 'company', 'team', 'technology',
        'data', 'analytics', 'cloud', 'enterprise', 'startup'
      ];
      
      const afterDashLower = afterDash.toLowerCase();
      const hasDescriptionKeyword = descriptionKeywords.some(keyword => 
        afterDashLower.includes(keyword)
      );
      
      // If it has description keywords or is very long, treat it as a description
      if (hasDescriptionKeyword || afterDash.length > 30) {
        return beforeDash;
      }
    }
  }
  
  return trimmedName;
}

/**
 * Comprehensive list of words that are definitely NOT names
 * These are business, technical, or other non-name terms
 */
const NON_NAME_WORDS = new Set([
  // Business entities
  'inc', 'llc', 'corp', 'ltd', 'company', 'co', 'llp', 'plc', 'inc.', 'llc.', 'corp.', 'ltd.',
  // Product/service terms
  'platform', 'management', 'workforce', 'solution', 'service', 'services', 'product', 'products',
  'system', 'systems', 'tool', 'tools', 'software', 'application', 'applications', 'app', 'apps', 'suite',
  // Titles and roles
  'ceo', 'cto', 'cfo', 'founder', 'co-founder', 'president', 'director', 'manager', 'head', 'lead',
  'senior', 'junior', 'executive', 'officer', 'vice', 'chief',
  // Business/office terms
  'office', 'factory', 'control', 'processing', 'claims', 'case', 'cases', 'study', 'studies',
  // Contact/online terms
  'email', 'phone', 'address', 'website', 'linkedin', 'twitter', 'github', 'contact', 'follow', 'connect',
  // Navigation/action terms
  'click', 'view', 'read', 'learn', 'more', 'here', 'link', 'get', 'download', 'sign', 'up', 'login', 'register',
  // Technical terms
  'api', 'sdk', 'ui', 'ux', 'ops', 'saas', 'paas', 'iaas', 'cloud', 'server', 'servers', 'client', 'database', 'framework',
  // Business terms
  'technologies', 'industries', 'ventures', 'capital', 'partners', 'group', 'global', 'international',
  // Product/feature terms
  'aggregator', 'onramp', 'checkout', 'direct',
  // Other common non-name words (but NOT "dev" or "see" - these can be names)
  'use', 'uses', 'the', 'and', 'or', 'for', 'with', 'from', 'about', 'team', 'teams'
]);

/**
 * Check if a string looks like a real person's name
 * Uses strict positive validation - only accepts entries that clearly look like names
 * Returns true if it appears to be a valid name, false otherwise
 */
function looksLikeRealName(name: string): boolean {
  const trimmed = name.trim();
  
  // Basic checks
  if (!trimmed || trimmed.length < 3 || trimmed.length > 50) {
    return false;
  }
  
  // No numbers, URLs, emails
  if (/\d/.test(trimmed) || 
      trimmed.includes('@') || 
      trimmed.includes('http') || 
      trimmed.includes('www.') ||
      trimmed.includes('://')) {
    return false;
  }
  
  // Only letters, spaces, hyphens, apostrophes, periods (for initials)
  if (!/^[a-zA-Z\s\-'.]+$/.test(trimmed)) {
    return false;
  }
  
  // Split into words
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  
  // Names can be:
  // - Single word (4+ characters, like "Madonna")
  // - 2-4 words (First Last, First Middle Last, First Initial Last, etc.)
  if (words.length < 1 || words.length > 4) {
    return false;
  }
  
  // Single word names must be at least 4 characters and start with capital
  if (words.length === 1) {
    const word = words[0];
    const cleanedWord = word.replace(/[.\-']/g, '');
    
    if (cleanedWord.length < 4 || cleanedWord.length > 20) {
      return false;
    }
    
    if (word[0] !== word[0].toUpperCase()) {
      return false;
    }
    
    if (NON_NAME_WORDS.has(cleanedWord.toLowerCase())) {
      return false;
    }
    
    return true; // Single word name passes if it meets these criteria
  }
  
  // Common name particles (allowed lowercase in middle of name)
  const nameParticles = new Set(['de', 'del', 'de la', 'von', 'van', 'le', 'la', 'du', 'des', 'i', 'y', 'da', 'dos', 'das', 'zur']);
  
  // Validate each word for multi-word names
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordLower = word.toLowerCase();
    
    // Remove punctuation for validation (keep periods for initials)
    const cleanedWord = word.replace(/[\-']/g, '');
    const cleanedWordLower = cleanedWord.toLowerCase();
    
    // Check if it's an initial (single letter followed by optional period)
    const isInitial = /^[A-Za-z]\.?$/.test(word);
    
    if (isInitial) {
      // Allow initials in the middle or end (e.g., "John D. Smith" or "Gabriel B.")
      continue;
    }
    
    // Check if it's a name particle (like "de", "von", "le", "i")
    const isParticle = nameParticles.has(cleanedWordLower);
    
    if (isParticle) {
      // Allow particles - they can be lowercase or capitalized
      continue;
    }
    
    // For non-initial, non-particle words:
    // Word must be 2-20 characters
    if (cleanedWord.length < 2 || cleanedWord.length > 20) {
      return false;
    }
    
    // First and last words should start with capital (but allow lowercase for now, we'll fix capitalization)
    // Middle words can be particles (already handled) or should be capitalized
    // For now, accept any capitalization - we'll normalize later
    
    // Check if word is in our non-name words list
    if (NON_NAME_WORDS.has(cleanedWordLower)) {
      return false;
    }
  }
  
  // Multi-word names should have at least one non-initial, non-particle word
  const hasNonInitial = words.some(word => {
    const cleaned = word.replace(/[\-']/g, '').toLowerCase();
    return !/^[a-z]\.?$/.test(word) && !nameParticles.has(cleaned);
  });
  if (!hasNonInitial) {
    return false;
  }
  
  // Check for phrases that are clearly not names
  const trimmedLower = trimmed.toLowerCase();
  const nonNamePhrases = [
    'use cases', 'office suite', 'factory control', 'control systems',
    'processing software', 'claims processing', 'case study', 'case studies',
    'software system', 'management system', 'control system', 'office system',
    'suite software', 'business suite', 'enterprise suite', 'product suite',
    'click here', 'read more', 'learn more', 'view all', 'sign up', 'log in',
    'the problem', 'our solution', 'our ask', 'the team',
    'live demo', 'product demo', 'product video', 'product snapshot',
    'start conducting', 'enter cambio', 'measuring code output', 'early use cases',
    'onramp aggregator', 'direct checkout', 'onramp', 'aggregator', 'checkout'
  ];
  
  // Also check individual words for business terms (for multi-word entries)
  const businessTermWords = ['onramp', 'aggregator', 'direct', 'checkout'];
  for (const word of words) {
    const wordLower = word.toLowerCase().replace(/[.\-']/g, '');
    if (businessTermWords.includes(wordLower)) {
      return false;
    }
  }
  
  for (const phrase of nonNamePhrases) {
    if (trimmedLower.includes(phrase)) {
      return false;
    }
  }
  
  // All caps is suspicious (likely acronym or heading)
  if (trimmed === trimmed.toUpperCase() && trimmed.length > 4) {
    return false;
  }
  
  // If we made it here, it passes our strict checks
  return true;
}

/**
 * Check if a name is likely a false positive (section heading, not a real name)
 */
export function isFalsePositive(name: string): boolean {
  const trimmedName = name.trim();

  // Empty names
  if (!trimmedName) {
    return true;
  }

  // Extract name part (remove description suffixes)
  const namePart = extractNamePart(trimmedName);
  
  // If extracting the name part left us with nothing, it's invalid
  if (!namePart || namePart.length === 0) {
    return true;
  }

  // Check exact matches on the cleaned name
  if (FALSE_POSITIVE_NAMES.has(namePart)) {
    return true;
  }

  // Check patterns on the cleaned name
  for (const pattern of FALSE_POSITIVE_PATTERNS) {
    if (pattern.test(namePart)) {
      return true;
    }
  }

  // Very short single-word names (likely not real)
  if (!namePart.includes(' ') && namePart.length < 3) {
    return true;
  }

  // All caps (likely a heading)
  if (namePart === namePart.toUpperCase() && namePart.length > 2) {
    return true;
  }

  return false;
}

/**
 * Extract names from founder_backgrounds text
 * Backgrounds are typically in format "Name: Description" or "Name: Hello world!..."
 * Returns array of extracted names
 */
export function extractNamesFromBackgrounds(founderBackgrounds: string | null | undefined): string[] {
  if (!founderBackgrounds || founderBackgrounds.trim() === '') {
    return [];
  }

  const names: string[] = [];
  // Split by common separators (newlines, semicolons, etc.)
  const sections = founderBackgrounds.split(/[\n;]/).map(s => s.trim()).filter(s => s.length > 0);

  for (const section of sections) {
    // Pattern: "Name: Description" or "Name Description" (colon or space after name)
    // Look for pattern where we have a name followed by colon or a clear break
    const colonMatch = section.match(/^([A-Z][a-zA-Z\s\-']{2,30}?):\s/);
    if (colonMatch) {
      const potentialName = colonMatch[1].trim();
      // Validate it looks like a name
      if (looksLikeRealName(potentialName)) {
        names.push(potentialName);
      }
    } else {
      // Try to find name at start (First Last format, 2-4 words)
      const words = section.split(/\s+/);
      if (words.length >= 2 && words.length <= 4) {
        // Check if first few words look like a name
        const potentialName = words.slice(0, words.length >= 3 ? 3 : 2).join(' ');
        if (looksLikeRealName(potentialName) && 
            (words.length === 2 || words[2].match(/^[A-Z]/))) {
          names.push(potentialName);
        }
      }
    }
  }

  return names;
}

/**
 * Clean a comma-separated list of founder names by removing false positives
 * Also removes the company name if it appears in the list
 * Optionally uses founder_backgrounds to validate names
 * Always returns at least one name if the original string had content (never nulls)
 * If all names are filtered, returns the original string
 * 
 * @param founderNamesString - Comma-separated list of founder names
 * @param companyName - Optional company name to exclude from founder names
 * @param founderBackgrounds - Optional founder backgrounds text to extract/validate names
 */
export function cleanFounderNames(
  founderNamesString: string | null | undefined, 
  companyName?: string | null,
  founderBackgrounds?: string | null
): string | null {
  if (!founderNamesString || founderNamesString.trim() === '') {
    return null;
  }

  // Normalize company name for comparison (trim and lowercase)
  const normalizedCompanyName = companyName?.trim().toLowerCase();

  // Extract names from founder_backgrounds if available (use as source of truth)
  const backgroundNames = founderBackgrounds ? extractNamesFromBackgrounds(founderBackgrounds) : [];
  const normalizedBackgroundNames = backgroundNames.map(n => n.toLowerCase());

  // Split by comma and filter out false positives and company name
  const validNames = founderNamesString
    .split(',')
    .filter(originalName => {
      const trimmed = originalName.trim();
      if (trimmed === '') return false;
      
      // Extract the name part (remove description suffixes)
      const namePart = extractNamePart(trimmed);
      if (namePart === '') return false;
      
      // Filter out company name FIRST (case-insensitive comparison)
      // Check both the original name and the extracted name part
      if (normalizedCompanyName && normalizedCompanyName.length > 0) {
        const normalizedOriginal = trimmed.toLowerCase();
        const normalizedNamePart = namePart.toLowerCase();
        
        // Extract just the first word of company name (for cases like "DeepAware AI" matching "DeepAware")
        const companyNameWords = normalizedCompanyName.split(/\s+/);
        const companyNameFirstWord = companyNameWords[0];
        
        // Exact match on either original or extracted name
        if (normalizedOriginal === normalizedCompanyName || normalizedNamePart === normalizedCompanyName) {
          return false;
        }
        
        // Match if name equals first word of company name (e.g., "DeepAware" matches "DeepAware AI")
        if (normalizedOriginal === companyNameFirstWord || normalizedNamePart === companyNameFirstWord) {
          return false;
        }
        
        // Check if company name is the main part of the name
        // Remove if the name starts with company name followed by space or dash
        if (normalizedOriginal.startsWith(normalizedCompanyName + ' ') ||
            normalizedOriginal.startsWith(normalizedCompanyName + ' -') ||
            normalizedOriginal.startsWith(normalizedCompanyName + '-') ||
            normalizedNamePart.startsWith(normalizedCompanyName + ' ')) {
          return false;
        }
        
        // Also check if name starts with first word of company name
        if (normalizedOriginal.startsWith(companyNameFirstWord + ' ') ||
            normalizedOriginal.startsWith(companyNameFirstWord + ' -') ||
            normalizedOriginal.startsWith(companyNameFirstWord + '-') ||
            normalizedNamePart.startsWith(companyNameFirstWord + ' ')) {
          return false;
        }
      }
      
      // If we have background names, prioritize matching those
      // Names in backgrounds are more reliable
      if (normalizedBackgroundNames.length > 0) {
        const normalizedNamePart = namePart.toLowerCase();
        // Check if this name matches any background name (exact or contains)
        const matchesBackground = normalizedBackgroundNames.some(bgName => {
          return normalizedNamePart === bgName || 
                 normalizedNamePart.includes(bgName) || 
                 bgName.includes(normalizedNamePart);
        });
        // If it matches a background name, trust it even if strict validation fails
        if (matchesBackground) {
          return true;
        }
      }
      
      // Filter out false positives (section headings, etc.)
      if (isFalsePositive(namePart)) return false;
      
      // Finally, check if it looks like a real name
      if (!looksLikeRealName(namePart)) return false;
      
      return true;
    })
    .map(n => {
      // Extract name part and normalize capitalization
      const extracted = extractNamePart(n.trim());
      return normalizeNameCapitalization(extracted);
    }); // Extract name parts after filtering and normalize

  // If we have valid names, return them
  if (validNames.length > 0) {
    return validNames.join(', ');
  }

  // If we extracted names from backgrounds but they weren't in the original list,
  // use those as fallback
  if (backgroundNames.length > 0) {
    return backgroundNames.join(', ');
  }

  // If all names were filtered but original had content, return original
  // (This preserves data - we assume there's always at least one founder)
  // The names might just need manual review rather than deletion
  return founderNamesString.trim();
}

/**
 * Split comma-separated founder names into an array, filtering out false positives
 * Also removes the company name if it appears in the list
 * Returns empty array if no valid names remain
 * 
 * @param founderNamesString - Comma-separated list of founder names
 * @param companyName - Optional company name to exclude from founder names
 */
export function splitFounderNames(founderNamesString: string | null | undefined, companyName?: string | null): string[] {
  if (!founderNamesString || founderNamesString.trim() === '') {
    return [];
  }

  // Normalize company name for comparison (trim and lowercase)
  const normalizedCompanyName = companyName?.trim().toLowerCase();

  return founderNamesString
    .split(',')
    .filter(originalName => {
      const trimmed = originalName.trim();
      if (trimmed === '') return false;
      
      // Extract the name part (remove description suffixes)
      const namePart = extractNamePart(trimmed);
      if (namePart === '') return false;
      
      // Filter out company name FIRST (case-insensitive comparison)
      // Check both the original name and the extracted name part
      if (normalizedCompanyName && normalizedCompanyName.length > 0) {
        const normalizedOriginal = trimmed.toLowerCase();
        const normalizedNamePart = namePart.toLowerCase();
        
        // Exact match on either original or extracted name
        if (normalizedOriginal === normalizedCompanyName || normalizedNamePart === normalizedCompanyName) {
          return false;
        }
        
        // Check if company name is the main part of the name
        // Remove if the name starts with company name followed by space or dash
        if (normalizedOriginal.startsWith(normalizedCompanyName + ' ') ||
            normalizedOriginal.startsWith(normalizedCompanyName + ' -') ||
            normalizedOriginal.startsWith(normalizedCompanyName + '-') ||
            normalizedNamePart.startsWith(normalizedCompanyName + ' ')) {
          return false;
        }
      }
      
      // Filter out false positives
      if (isFalsePositive(namePart)) return false;
      
      // Finally, check if it looks like a real name
      if (!looksLikeRealName(namePart)) return false;
      
      return true;
    })
    .map(n => {
      // Extract name part and normalize capitalization
      const extracted = extractNamePart(n.trim());
      return normalizeNameCapitalization(extracted);
    }); // Extract name parts after filtering and normalize
}

/**
 * Get the first valid founder name from a comma-separated list
 * Returns null if no valid names exist
 * 
 * @param founderNamesString - Comma-separated list of founder names
 * @param companyName - Optional company name to exclude from founder names
 */
export function getFirstFounderName(founderNamesString: string | null | undefined, companyName?: string | null): string | null {
  const names = splitFounderNames(founderNamesString, companyName);
  return names.length > 0 ? names[0] : null;
}

/**
 * Count how many valid founder names are in a comma-separated list
 * 
 * @param founderNamesString - Comma-separated list of founder names
 * @param companyName - Optional company name to exclude from founder names
 */
export function countValidFounderNames(founderNamesString: string | null | undefined, companyName?: string | null): number {
  return splitFounderNames(founderNamesString, companyName).length;
}

export default {
  isFalsePositive,
  cleanFounderNames,
  splitFounderNames,
  getFirstFounderName,
  countValidFounderNames,
};
