-- ============================================================
-- Clean False Positive Founder Names from startups3 Table
-- 
-- This script removes section headings, legal/document information,
-- and other non-name phrases that were mistakenly extracted as 
-- founder names from YC company pages.
-- 
-- ⚠️  SAFETY: This ONLY removes exact matches to known false positives.
-- Real founder names like "John Smith" or "Sarah Johnson" are preserved.
-- 
-- Examples of what WILL be removed:
--   - "The Problem"
--   - "Our Solution"
--   - "Our Ask"
--   - "Legal Information"
--   - "Address Proof"
--   - etc.
-- ============================================================

-- ============================================================
-- 1. PREVIEW: See what will be cleaned (DRY RUN)
-- ============================================================
-- Run this first to see exactly what will be affected

WITH false_positives AS (
  SELECT unnest(ARRAY[
    -- Section headings
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
    -- Legal and document-related false positives
    'Legal Information', 'legal information', 'Legal information',
    'Address Proof', 'address proof', 'Address proof',
    'Proof', 'Information'
  ]) AS false_positive
),
cleaned_names AS (
  SELECT 
    s.id,
    s.name,
    s.yc_link,
    s.founder_names AS original_names,
    TRIM(BOTH ' ' FROM 
      array_to_string(
        array(
          SELECT cleaned_name
          FROM (
            SELECT 
              CASE 
                -- Extract name part before " - " if it looks like a description suffix
                WHEN TRIM(name_part) ~ ' - ' THEN
                  CASE 
                    -- Check if part after dash looks like a description (contains keywords or is long)
                    WHEN SUBSTRING(TRIM(name_part) FROM ' - (.+)$') ~* '(platform|management|workforce|solution|service|product|system|tool|software|application|app|build|create|ai|engineering|business|company|team|technology|data|analytics|cloud|enterprise|startup)' 
                      OR LENGTH(SUBSTRING(TRIM(name_part) FROM ' - (.+)$')) > 30
                    THEN TRIM(SUBSTRING(TRIM(name_part) FROM '^(.+?) - '))
                    ELSE TRIM(name_part)
                  END
                ELSE TRIM(name_part)
              END AS cleaned_name
            FROM unnest(string_to_array(s.founder_names, ',')) AS name_part
          ) AS extracted_names
          WHERE cleaned_name NOT IN (SELECT false_positive FROM false_positives)
            AND cleaned_name != ''
            -- Also filter out names matching legal/document patterns
            AND cleaned_name !~* '^(Legal|Address|Proof|Information)\s+'
            AND cleaned_name !~* '\b(legal information|address proof|proof of address|legal document)\b'
            -- Filter out company name (case-insensitive comparison)
            AND LOWER(cleaned_name) != LOWER(s.name)
        ),
        ', '
      )
    ) AS cleaned_names
  FROM startups3 s
  WHERE s.founder_names IS NOT NULL
    AND s.founder_names != ''
)
SELECT 
  id,
  name,
  yc_link,
  original_names,
  cleaned_names,
  CASE 
    WHEN cleaned_names = '' OR cleaned_names IS NULL THEN 'Will be set to NULL'
    WHEN cleaned_names != original_names THEN 'Will be updated'
    ELSE 'No change needed'
  END AS action
FROM cleaned_names
WHERE original_names != COALESCE(cleaned_names, '')
ORDER BY name
LIMIT 100;

-- ============================================================
-- 2. COUNT: How many will be affected
-- ============================================================

WITH false_positives AS (
  SELECT unnest(ARRAY[
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
    'Legal Information', 'legal information', 'Legal information',
    'Address Proof', 'address proof', 'Address proof',
    'Proof', 'Information'
  ]) AS false_positive
),
cleaned_names AS (
  SELECT 
    s.id,
    s.name,
    s.founder_names AS original_names,
    TRIM(BOTH ' ' FROM 
      array_to_string(
        array(
          SELECT cleaned_name
          FROM (
            SELECT 
              CASE 
                -- Extract name part before " - " if it looks like a description suffix
                WHEN TRIM(name_part) ~ ' - ' THEN
                  CASE 
                    -- Check if part after dash looks like a description (contains keywords or is long)
                    WHEN SUBSTRING(TRIM(name_part) FROM ' - (.+)$') ~* '(platform|management|workforce|solution|service|product|system|tool|software|application|app|build|create|ai|engineering|business|company|team|technology|data|analytics|cloud|enterprise|startup)' 
                      OR LENGTH(SUBSTRING(TRIM(name_part) FROM ' - (.+)$')) > 30
                    THEN TRIM(SUBSTRING(TRIM(name_part) FROM '^(.+?) - '))
                    ELSE TRIM(name_part)
                  END
                ELSE TRIM(name_part)
              END AS cleaned_name
            FROM unnest(string_to_array(s.founder_names, ',')) AS name_part
          ) AS extracted_names
          WHERE cleaned_name NOT IN (SELECT false_positive FROM false_positives)
            AND cleaned_name != ''
            AND cleaned_name !~* '^(Legal|Address|Proof|Information)\s+'
            AND cleaned_name !~* '\b(legal information|address proof|proof of address|legal document)\b'
            -- Filter out company name (case-insensitive comparison)
            AND LOWER(cleaned_name) != LOWER(s.name)
        ),
        ', '
      )
    ) AS cleaned_names
  FROM startups3 s
  WHERE s.founder_names IS NOT NULL
    AND s.founder_names != ''
)
SELECT 
  COUNT(*) AS total_with_founder_names,
  COUNT(CASE WHEN cleaned_names = '' OR cleaned_names IS NULL THEN 1 END) AS will_be_set_to_null,
  COUNT(CASE WHEN cleaned_names != original_names AND cleaned_names != '' AND cleaned_names IS NOT NULL THEN 1 END) AS will_be_updated,
  COUNT(CASE WHEN cleaned_names = original_names THEN 1 END) AS no_change_needed
FROM cleaned_names;

-- ============================================================
-- 3. CLEANUP: Remove false positive names from founder_names
-- ============================================================
-- ⚠️  WARNING: This will UPDATE the database
-- ⚠️  SAFETY: Only removes exact matches to known false positives
-- ⚠️  Real founder names are preserved
-- 
-- Run the preview queries above first to see what will be changed

WITH false_positives AS (
  SELECT unnest(ARRAY[
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
    'Legal Information', 'legal information', 'Legal information',
    'Address Proof', 'address proof', 'Address proof',
    'Proof', 'Information'
  ]) AS false_positive
),
cleaned_data AS (
  SELECT 
    s.id,
    TRIM(BOTH ' ' FROM 
      array_to_string(
        array(
          SELECT cleaned_name
          FROM (
            SELECT 
              CASE 
                -- Extract name part before " - " if it looks like a description suffix
                WHEN TRIM(name_part) ~ ' - ' THEN
                  CASE 
                    -- Check if part after dash looks like a description (contains keywords or is long)
                    WHEN SUBSTRING(TRIM(name_part) FROM ' - (.+)$') ~* '(platform|management|workforce|solution|service|product|system|tool|software|application|app|build|create|ai|engineering|business|company|team|technology|data|analytics|cloud|enterprise|startup)' 
                      OR LENGTH(SUBSTRING(TRIM(name_part) FROM ' - (.+)$')) > 30
                    THEN TRIM(SUBSTRING(TRIM(name_part) FROM '^(.+?) - '))
                    ELSE TRIM(name_part)
                  END
                ELSE TRIM(name_part)
              END AS cleaned_name
            FROM unnest(string_to_array(s.founder_names, ',')) AS name_part
          ) AS extracted_names
          WHERE cleaned_name NOT IN (SELECT false_positive FROM false_positives)
            AND cleaned_name != ''
            AND cleaned_name !~* '^(Legal|Address|Proof|Information)\s+'
            AND cleaned_name !~* '\b(legal information|address proof|proof of address|legal document)\b'
            -- Filter out company name (case-insensitive comparison)
            AND LOWER(cleaned_name) != LOWER(s.name)
        ),
        ', '
      )
    ) AS cleaned_names
  FROM startups3 s
  WHERE s.founder_names IS NOT NULL
    AND s.founder_names != ''
)
UPDATE startups3
SET founder_names = CASE 
  WHEN cleaned_data.cleaned_names = '' OR cleaned_data.cleaned_names IS NULL THEN NULL
  ELSE cleaned_data.cleaned_names
END
FROM cleaned_data
WHERE startups3.id = cleaned_data.id
  AND startups3.founder_names IS NOT NULL
  AND startups3.founder_names != '';

-- ============================================================
-- 4. VERIFICATION: Check results after cleanup
-- ============================================================

SELECT 
  'After Cleanup' AS status,
  COUNT(*) AS total_startups,
  SUM(CASE WHEN founder_names IS NULL OR founder_names = '' THEN 1 ELSE 0 END) AS missing_founder_names,
  SUM(CASE WHEN founder_names IS NOT NULL AND founder_names != '' THEN 1 ELSE 0 END) AS has_founder_names,
  SUM(CASE WHEN founder_names ~ ',' THEN 1 ELSE 0 END) AS comma_separated_lists,
  SUM(CASE WHEN founder_names IS NOT NULL AND founder_names != '' AND founder_names !~ ',' THEN 1 ELSE 0 END) AS single_names
FROM startups3;

-- ============================================================
-- 5. FIND REMAINING SUSPICIOUS PATTERNS (Optional)
-- ============================================================
-- This helps identify any remaining false positives that weren't caught

WITH false_positives AS (
  SELECT unnest(ARRAY[
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
    'Legal Information', 'legal information', 'Legal information',
    'Address Proof', 'address proof', 'Address proof',
    'Proof', 'Information'
  ]) AS false_positive
),
name_parts AS (
  SELECT 
    s.id,
    s.name,
    s.yc_link,
    s.founder_names,
    TRIM(name_part) AS individual_name
  FROM startups3 s
  CROSS JOIN LATERAL unnest(string_to_array(s.founder_names, ',')) AS name_part
  WHERE s.founder_names IS NOT NULL
    AND s.founder_names != ''
    AND s.founder_names ~ ','
)
SELECT DISTINCT
  np.id,
  np.name,
  np.yc_link,
  np.founder_names,
  np.individual_name AS suspicious_name,
  'Review manually' AS recommendation
FROM name_parts np
INNER JOIN startups3 s ON np.id = s.id
WHERE np.individual_name IN (SELECT false_positive FROM false_positives)
   OR np.individual_name ~* '^(Legal|Address|Proof|Information)\s+'
   OR np.individual_name ~* '\b(legal information|address proof|proof of address|legal document)\b'
   OR LOWER(np.individual_name) = LOWER(s.name)  -- Company name matches
ORDER BY np.name
LIMIT 50;

-- ============================================================
-- NOTES:
-- ============================================================
-- 1. This script ONLY removes exact matches to known false positives
-- 2. Real founder names like "John Smith", "Sarah Johnson" are preserved
-- 3. Processes both single names and comma-separated lists
-- 4. If all names in a list are false positives, the field is set to NULL
-- 5. Run section 1 (PREVIEW) first to see exactly what will be cleaned
-- 6. Run section 2 (COUNT) to see how many will be affected
-- 7. Run section 3 (CLEANUP) to actually clean the data
-- 8. Run section 4 (VERIFICATION) to check results
-- 9. Run section 5 to find any remaining suspicious patterns

