# Cleaning False Positive Founder Names from startups3 Table

This guide explains how to filter out invalid founder names (like "Legal Information", "Address Proof", "Our Asks", "The Problem", etc.) from the `startups3` table.

## Problem

The `founder_names` column in the `startups3` table contains some entries that are not actual founder names. These are typically:
- Section headings from YC company pages (e.g., "The Problem", "Our Solution", "Our Ask")
- Legal/document information (e.g., "Legal Information", "Address Proof")
- Other non-name phrases that were mistakenly extracted

## Solution

We provide two methods to clean these false positives:

### Method 1: TypeScript Script (Recommended)

The TypeScript script uses the `cleanFounderNames` utility function from `lib/clean-founder-names.ts` to filter out false positives.

#### Usage

**Preview changes (dry run):**
```bash
npx tsx yc_companies/clean_founder_names_startups3.ts --dry-run
```

**Apply changes:**
```bash
npx tsx yc_companies/clean_founder_names_startups3.ts
```

#### What it does:
1. Fetches all startups with `founder_names` from the `startups3` table
2. Cleans each `founder_names` string by removing false positives
3. Updates the database with cleaned names (or sets to NULL if all names were false positives)
4. Provides a summary of changes

### Method 2: SQL Script

The SQL script provides more control and can be run directly in your database client or Supabase SQL editor.

#### Usage

1. Open `yc_companies/clean_startups3_founder_names.sql` in your SQL editor
2. **First**, run section 1 (PREVIEW) to see what will be changed
3. **Then**, run section 2 (COUNT) to see how many records will be affected
4. **Finally**, run section 3 (CLEANUP) to apply the changes
5. Run section 4 (VERIFICATION) to check results
6. Optionally run section 5 to find any remaining suspicious patterns

## False Positives Filtered

The following patterns are filtered out:

### Section Headings:
- "The Problem", "Problem"
- "Our Solution", "Solution", "The Solution"
- "Our Story", "Story"
- "Since Launch", "Launch"
- "Our Approach", "Approach"
- "Launch Video", "Video"
- "Our Ask", "Ask", "The Ask"
- "The Team", "Team"
- "Our Mission", "Mission"
- "Our Vision", "Vision"
- "Company History", "History"
- "About Us", "Us"
- "What We Do", "We Do"
- "How It Works", "It Works"
- "Meet The Team"
- "Our Product", "Product"
- "Our Technology", "Technology"
- "Our Customers", "Customers"
- "Our Traction", "Traction"
- "Contact Us"
- "Read More", "More"
- "Learn More"
- "Get Started", "Started"
- "Sign Up", "Up"
- "View All", "All"
- "About", "Contact", "Join"
- "Careers", "Press", "News"
- "Blog", "FAQ", "Help"
- "Support", "Login", "Signup"

### Legal/Document Information:
- "Legal Information", "legal information", "Legal information"
- "Address Proof", "address proof", "Address proof"
- "Proof", "Information"

### Pattern Matching:
- Names starting with "Legal ", "Address ", "Proof ", "Information "
- Names containing phrases like "legal information", "address proof", "proof of address", "legal document"

### Company Names:
- Any name that exactly matches the company name (case-insensitive)
- Example: If company name is "Acme Inc", then "Acme Inc" will be filtered out from founder_names

### Description Suffixes:
- Names with description suffixes like "Name - Description" are cleaned to extract just the name part
- The description part is detected if it contains keywords like "platform", "management", "workforce", "solution", etc., or if it's longer than 30 characters
- Examples:
  - "Bilanc - AI Engineering Management Platform" → "Bilanc"
  - "Brainbase - Build your own AI workforce" → "Brainbase"
  - "John Smith - CEO" → "John Smith" (kept as-is if not detected as description)

## How It Works

The cleaning function:
1. Splits comma-separated founder names into individual names
2. Extracts just the name part from entries like "Name - Description" (removes description suffixes)
3. Filters out names that match known false positive patterns
4. Filters out names that exactly match the company name (case-insensitive)
5. Rejoins valid names back into a comma-separated string
6. Returns `null` if no valid names remain

**Important**: Real founder names like "John Smith", "Sarah Johnson", etc. are preserved and not affected. Company names are also filtered out from the founder_names list.

## Utility Functions

The `lib/clean-founder-names.ts` file provides utility functions that can be used in your application code:

- `isFalsePositive(name: string): boolean` - Check if a name is a false positive
- `cleanFounderNames(founderNamesString: string | null | undefined, companyName?: string | null): string | null` - Clean a comma-separated list of names (optionally exclude company name)
- `splitFounderNames(founderNamesString: string | null | undefined, companyName?: string | null): string[]` - Split and filter names into an array (optionally exclude company name)
- `getFirstFounderName(founderNamesString: string | null | undefined, companyName?: string | null): string | null` - Get the first valid name (optionally exclude company name)
- `countValidFounderNames(founderNamesString: string | null | undefined, companyName?: string | null): number` - Count valid names (optionally exclude company name)

## Example Usage in Code

```typescript
import { cleanFounderNames, isFalsePositive } from '@/lib/clean-founder-names';

// Clean founder names string (without company name)
const dirtyNames = "John Smith, Legal Information, Address Proof, Jane Doe";
const cleanedNames = cleanFounderNames(dirtyNames);
// Result: "John Smith, Jane Doe"

// Clean founder names string (with company name exclusion)
const companyName = "Acme Inc";
const namesWithCompany = "John Smith, Acme Inc, Jane Doe";
const cleaned = cleanFounderNames(namesWithCompany, companyName);
// Result: "John Smith, Jane Doe" (company name removed)

// Check individual name
const isInvalid = isFalsePositive("Legal Information");
// Result: true
```

## Safety Notes

- The scripts only remove **exact matches** to known false positives
- Real founder names are **never** affected
- Always run in `--dry-run` mode first to preview changes
- The SQL script includes preview queries before the actual UPDATE statement
- Changes are reversible if you have database backups

## Adding New False Positives

If you discover new false positive patterns:

1. **Add to TypeScript utility** (`lib/clean-founder-names.ts`):
   - Add exact matches to the `FALSE_POSITIVE_NAMES` Set
   - Add pattern matching to the `FALSE_POSITIVE_PATTERNS` array

2. **Add to SQL script** (`yc_companies/clean_startups3_founder_names.sql`):
   - Add to the false_positives array in all sections

3. **Re-run the cleanup script** to apply the new filters

## Troubleshooting

**Q: Some valid names are being filtered out**
A: Check if the name matches one of the exact false positive strings. If it's a false positive, adjust the filtering logic to be more specific (e.g., use regex patterns instead of exact matches for ambiguous terms).

**Q: The script says "No changes needed" but I see false positives**
A: Check if the false positive patterns are in the filtering lists. You may need to add new patterns.

**Q: How do I revert changes?**
A: Restore from a database backup, or manually update the records if you kept track of the original values.

## Related Files

- `lib/clean-founder-names.ts` - TypeScript utility functions
- `yc_companies/clean_founder_names_startups3.ts` - TypeScript cleanup script
- `yc_companies/clean_startups3_founder_names.sql` - SQL cleanup script
- `scripts/clean-founder-names.sql` - Alternative SQL script for `startups` table
- `yc_companies/remove_false_positives_from_founder_names.sql` - Alternative SQL script for comma-separated lists
- `yc_companies/clean_false_positive_founders.sql` - Alternative SQL script for exact matches

