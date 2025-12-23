-- ============================================================================
-- Email Confidence Filtering Scripts
-- ============================================================================
-- These queries help filter emails by confidence level for verification review
--
-- Confidence Levels:
-- - 85% (0.85) = High confidence (first@domain pattern - most common)
-- - 70% (0.70) = Good confidence (first.last@domain pattern)
-- - 50% (0.50) = Medium confidence (pattern uncertain - needs Hunter.io)
-- - 30% (0.30) = Low confidence (generic emails like hello@, info@)
-- - 0% (0.00) = Invalid (undeliverable, no MX record)
-- ============================================================================

-- ============================================================================
-- OPTION 1: Founders Table (Recommended - Newer Normalized Structure)
-- ============================================================================

-- View all founders with email confidence breakdown
-- Shows startup name, founder name, email, confidence level, and verification status
SELECT 
    s.name AS startup_name,
    s.website AS startup_website,
    f.name AS founder_name,
    f.email,
    f.email_confidence,
    CASE 
        WHEN f.email_confidence = 0.85 THEN 'High (85% - first@domain)'
        WHEN f.email_confidence = 0.70 THEN 'Good (70% - first.last@domain)'
        WHEN f.email_confidence = 0.50 THEN 'Medium (50% - needs Hunter.io)'
        WHEN f.email_confidence = 0.30 THEN 'Low/Generic (30% - hello@/info@)'
        WHEN f.email_confidence = 0.00 OR f.email_confidence IS NULL THEN 'Invalid (0%)'
        ELSE 'Other'
    END AS confidence_category,
    f.email_verified,
    f.email_source,
    f.needs_manual_review,
    f.created_at
FROM founders f
JOIN startups s ON f.startup_id = s.id
WHERE f.email IS NOT NULL
ORDER BY f.email_confidence ASC, s.name ASC;

-- ============================================================================
-- FILTER BY SPECIFIC CONFIDENCE LEVELS
-- ============================================================================

-- 1. Generic emails (30% confidence) - HIGH RISK
-- These are emails like hello@, info@, contact@ - likely wrong
SELECT 
    s.name AS startup_name,
    s.website AS startup_website,
    f.name AS founder_name,
    f.email,
    f.email_confidence,
    f.email_verified,
    f.email_source,
    f.needs_manual_review
FROM founders f
JOIN startups s ON f.startup_id = s.id
WHERE f.email IS NOT NULL
    AND f.email_confidence = 0.30
ORDER BY s.name ASC;

-- 2. 50% confidence emails - NEEDS HUNTER.IO
-- Pattern uncertain, should be verified with Hunter.io free tier
SELECT 
    s.name AS startup_name,
    s.website AS startup_website,
    f.name AS founder_name,
    f.email,
    f.email_confidence,
    f.email_verified,
    f.email_source,
    f.needs_manual_review
FROM founders f
JOIN startups s ON f.startup_id = s.id
WHERE f.email IS NOT NULL
    AND f.email_confidence = 0.50
ORDER BY s.name ASC;

-- 3. Invalid emails (0% confidence or not verified)
-- No MX record, domain doesn't exist, or verification failed
SELECT 
    s.name AS startup_name,
    s.website AS startup_website,
    f.name AS founder_name,
    f.email,
    f.email_confidence,
    f.email_verified,
    f.email_source,
    f.needs_manual_review
FROM founders f
JOIN startups s ON f.startup_id = s.id
WHERE f.email IS NOT NULL
    AND (f.email_confidence = 0.00 OR f.email_verified = false OR f.email_confidence IS NULL)
ORDER BY s.name ASC;

-- 4. Combined: Generic + 50% + Invalid (All emails needing review)
-- This gives you the 86 (50%) + 12 (invalid) + 1 (generic) = 99 emails to review
SELECT 
    s.name AS startup_name,
    s.website AS startup_website,
    f.name AS founder_name,
    f.email,
    f.email_confidence,
    CASE 
        WHEN f.email_confidence = 0.30 THEN 'Generic (hello@/info@)'
        WHEN f.email_confidence = 0.50 THEN 'Uncertain (needs Hunter.io)'
        WHEN f.email_confidence = 0.00 OR f.email_confidence IS NULL THEN 'Invalid'
        ELSE 'Other'
    END AS issue_type,
    f.email_verified,
    f.email_source,
    f.needs_manual_review
FROM founders f
JOIN startups s ON f.startup_id = s.id
WHERE f.email IS NOT NULL
    AND (f.email_confidence = 0.30 
         OR f.email_confidence = 0.50 
         OR f.email_confidence = 0.00 
         OR f.email_verified = false 
         OR f.email_confidence IS NULL)
ORDER BY 
    CASE 
        WHEN f.email_confidence = 0.30 THEN 1
        WHEN f.email_confidence = 0.50 THEN 2
        ELSE 3
    END,
    s.name ASC;

-- ============================================================================
-- SUMMARY STATISTICS
-- ============================================================================

-- Count emails by confidence level
SELECT 
    CASE 
        WHEN email_confidence = 0.85 THEN 'High (85%)'
        WHEN email_confidence = 0.70 THEN 'Good (70%)'
        WHEN email_confidence = 0.50 THEN 'Medium (50%)'
        WHEN email_confidence = 0.30 THEN 'Low/Generic (30%)'
        WHEN email_confidence = 0.00 OR email_confidence IS NULL THEN 'Invalid (0%)'
        ELSE 'Other (' || (email_confidence * 100)::text || '%)'
    END AS confidence_category,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM founders WHERE email IS NOT NULL), 1) AS percentage
FROM founders
WHERE email IS NOT NULL
GROUP BY 
    CASE 
        WHEN email_confidence = 0.85 THEN 'High (85%)'
        WHEN email_confidence = 0.70 THEN 'Good (70%)'
        WHEN email_confidence = 0.50 THEN 'Medium (50%)'
        WHEN email_confidence = 0.30 THEN 'Low/Generic (30%)'
        WHEN email_confidence = 0.00 OR email_confidence IS NULL THEN 'Invalid (0%)'
        ELSE 'Other (' || (email_confidence * 100)::text || '%)'
    END
ORDER BY 
    MIN(email_confidence) DESC NULLS LAST;

-- ============================================================================
-- OPTION 2: Legacy Startups Table (if using comma-separated emails)
-- ============================================================================
-- NOTE: This assumes you've stored confidence data somewhere else
-- If you only have emails in startups.founder_emails, you'll need to
-- check generic emails manually using the pattern matching

-- Find generic emails in startups table (hello@, info@, contact@, etc.)
SELECT 
    s.name AS startup_name,
    s.website,
    s.founder_names,
    s.founder_emails,
    -- Extract individual emails (simplified - may need adjustment)
    regexp_split_to_table(s.founder_emails, ',') AS individual_email
FROM startups s
WHERE s.founder_emails IS NOT NULL
    AND (
        s.founder_emails ILIKE 'hello@%'
        OR s.founder_emails ILIKE '%hello@%'
        OR s.founder_emails ILIKE 'info@%'
        OR s.founder_emails ILIKE '%info@%'
        OR s.founder_emails ILIKE 'contact@%'
        OR s.founder_emails ILIKE '%contact@%'
        OR s.founder_emails ILIKE 'support@%'
        OR s.founder_emails ILIKE '%support@%'
        OR s.founder_emails ILIKE 'team@%'
        OR s.founder_emails ILIKE '%team@%'
    )
ORDER BY s.name ASC;

-- ============================================================================
-- EXPORT FOR HUNTER.IO (CSV format for import)
-- ============================================================================
-- Export 50% confidence emails in a format ready for Hunter.io lookup
-- Copy this output and import into Hunter.io

SELECT 
    s.name AS "Company Name",
    f.name AS "Founder Name",
    f.email AS "Current Email",
    s.website AS "Company Website",
    f.email_confidence AS "Confidence",
    'needs_hunter_io' AS "Action"
FROM founders f
JOIN startups s ON f.startup_id = s.id
WHERE f.email IS NOT NULL
    AND f.email_confidence = 0.50
ORDER BY s.name ASC
LIMIT 50;  -- Hunter.io free tier limit

-- ============================================================================
-- QUICK FILTERS (One-liners for common use cases)
-- ============================================================================

-- Just show the counts
-- SELECT COUNT(*) FROM founders WHERE email IS NOT NULL AND email_confidence = 0.30;  -- Generic
-- SELECT COUNT(*) FROM founders WHERE email IS NOT NULL AND email_confidence = 0.50;  -- Needs Hunter.io
-- SELECT COUNT(*) FROM founders WHERE email IS NOT NULL AND (email_confidence = 0.00 OR email_verified = false);  -- Invalid

