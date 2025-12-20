-- One-time script to clean false positive founder names from the database
-- Removes section headings like "The Solution", "The Ask", "Team", etc.
-- that were mistakenly extracted as founder names from YC company pages.

-- Step 1: Preview what will be cleaned (run this first)
SELECT
  id,
  name,
  founder_names AS before,
  TRIM(BOTH ' ' FROM
    array_to_string(
      array(
        SELECT TRIM(name_part)
        FROM unnest(string_to_array(founder_names, ',')) AS name_part
        WHERE TRIM(name_part) NOT IN (
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
          'Support', 'Login', 'Signup'
        )
        AND TRIM(name_part) != ''
      ),
      ', '
    )
  ) AS after
FROM startups
WHERE data_source = 'yc'
  AND founder_names IS NOT NULL
  AND founder_names != ''
ORDER BY name
LIMIT 50;

-- Step 2: Execute cleanup (run this after reviewing preview)
WITH cleaned AS (
  SELECT
    id,
    TRIM(BOTH ' ' FROM
      array_to_string(
        array(
          SELECT TRIM(name_part)
          FROM unnest(string_to_array(founder_names, ',')) AS name_part
          WHERE TRIM(name_part) NOT IN (
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
            'Support', 'Login', 'Signup'
          )
          AND TRIM(name_part) != ''
        ),
        ', '
      )
    ) AS cleaned_names
  FROM startups
  WHERE data_source = 'yc'
    AND founder_names IS NOT NULL
    AND founder_names != ''
)
UPDATE startups
SET founder_names = CASE
  WHEN cleaned.cleaned_names = '' THEN NULL
  ELSE cleaned.cleaned_names
END
FROM cleaned
WHERE startups.id = cleaned.id;

-- Step 3: Verify results
SELECT
  COUNT(*) AS total,
  COUNT(founder_names) AS has_names,
  COUNT(*) - COUNT(founder_names) AS null_names
FROM startups
WHERE data_source = 'yc';
