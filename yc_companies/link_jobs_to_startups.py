"""
Link new jobs to startups using fuzzy matching.

This script:
1. Finds jobs where startup_id IS NULL (new jobs)
2. For each unique company_name, tries to find an existing startup using fuzzy matching
3. Creates a new startup only if no match is found
4. Updates the jobs with the matched/created startup_id

Usage:
    python link_jobs_to_startups.py              # Run with default threshold (80%)
    python link_jobs_to_startups.py --threshold 85  # Use 85% similarity threshold
    python link_jobs_to_startups.py --dry-run    # Preview changes without modifying DB
"""

import os
import sys
import uuid
import argparse
from typing import Optional, List, Dict, Tuple
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local') or load_dotenv('.env') or load_dotenv()

from supabase import create_client, Client

# Initialize Supabase client
# Prioritize NEXT_PUBLIC_* variables (Next.js convention)
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Debug: Check what we found
print(f"🔍 Debug - Supabase URL found: {'Yes' if supabase_url else 'No'}")
print(f"🔍 Debug - Supabase Key found: {'Yes' if supabase_key else 'No'}")
if supabase_url:
    print(f"   URL: {supabase_url[:30]}...")
if not supabase_key:
    print("   Checking for: NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print("\n❌ Missing Supabase credentials!")
    print("   Please set one of the following in .env.local:")
    print("   - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)")
    print("   - NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)")
    print("\n   Current working directory:", os.getcwd())
    print("   Looking for .env files in:", os.path.abspath('.'))
    sys.exit(1)

supabase: Client = create_client(supabase_url, supabase_key)


def normalize_company_name(name: str) -> str:
    """Normalize company name for comparison."""
    if not name:
        return ""

    import re

    # Convert to lowercase
    normalized = name.lower().strip()

    # Remove common suffixes (order matters - longer first)
    suffixes = [
        ' incorporated', ' corporation', ' company', ' technologies', ' technology',
        ', inc.', ', inc', ' inc.', ' inc', ', llc', ' llc', ', ltd.', ', ltd', ' ltd',
        ', co.', ' co.', ', corp.', ', corp', ' corp', ' labs', ' lab', ' studio', ' studios',
        ' ai', ' io', ' hq', ' app', ' tech', ' software', ' solutions', ' systems',
        ' global', ' international', ' usa', ' us',
    ]
    for suffix in suffixes:
        if normalized.endswith(suffix):
            normalized = normalized[:-len(suffix)]
            break  # Only remove one suffix

    # Remove common prefixes
    prefixes = ['the ', 'a ']
    for prefix in prefixes:
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix):]
            break

    # Remove special characters but keep spaces
    normalized = re.sub(r'[^\w\s]', '', normalized)

    # Remove extra whitespace
    normalized = ' '.join(normalized.split())

    return normalized


def get_name_variations(name: str) -> List[str]:
    """Generate common variations of a company name for matching."""
    import re

    variations = set()
    normalized = normalize_company_name(name)
    variations.add(normalized)

    # Original lowercase
    variations.add(name.lower().strip())

    # Without spaces (e.g., "Open AI" -> "openai")
    variations.add(normalized.replace(' ', ''))

    # With common suffixes removed more aggressively
    base = normalized
    extra_suffixes = ['ai', 'io', 'hq', 'app', 'labs', 'tech']
    for suffix in extra_suffixes:
        if base.endswith(suffix) and len(base) > len(suffix) + 2:
            variations.add(base[:-len(suffix)].strip())

    # Handle hyphenated vs non-hyphenated
    if '-' in name.lower():
        variations.add(name.lower().replace('-', ' '))
        variations.add(name.lower().replace('-', ''))

    return [v for v in variations if v]


def similarity_score(name1: str, name2: str) -> float:
    """Calculate similarity between two company names (0-100)."""
    from difflib import SequenceMatcher

    if not name1 or not name2:
        return 0.0

    # Get variations for both names
    vars1 = get_name_variations(name1)
    vars2 = get_name_variations(name2)

    best_score = 0.0

    for v1 in vars1:
        for v2 in vars2:
            if not v1 or not v2:
                continue

            # Exact match
            if v1 == v2:
                return 100.0

            # Check if one contains the other (important for partial matches)
            if len(v1) >= 3 and len(v2) >= 3:
                if v1 in v2:
                    score = 85.0 + (15.0 * len(v1) / len(v2))
                    best_score = max(best_score, score)
                elif v2 in v1:
                    score = 85.0 + (15.0 * len(v2) / len(v1))
                    best_score = max(best_score, score)

            # SequenceMatcher for fuzzy matching
            ratio = SequenceMatcher(None, v1, v2).ratio()
            best_score = max(best_score, ratio * 100)

    return best_score


def find_matching_startup(company_name: str, startups: List[Dict], threshold: float = 80.0) -> Tuple[Optional[Dict], float]:
    """Find a startup that matches the company name using fuzzy matching.

    Returns:
        Tuple of (matched_startup, similarity_score) or (None, 0.0)
    """
    best_match = None
    best_score = 0.0

    for startup in startups:
        startup_name = startup.get("name", "")
        if not startup_name:
            continue

        score = similarity_score(company_name, startup_name)

        if score > best_score:
            best_score = score
            if score >= threshold:
                best_match = startup

    return best_match, best_score


def get_new_jobs_without_startup() -> List[Dict]:
    """Get all jobs where startup_id is NULL."""
    print("📋 Fetching new jobs without startup_id...")

    # Query jobs where startup_id is null
    result = supabase.table("jobs").select("id, company_name, job_title, created_at").is_("startup_id", "null").execute()

    jobs = result.data if result.data else []
    print(f"   Found {len(jobs)} jobs without startup_id")

    return jobs


def get_unique_company_names(jobs: List[Dict]) -> List[str]:
    """Get unique company names from jobs."""
    company_names = set()
    for job in jobs:
        name = job.get("company_name")
        if name:
            company_names.add(name)

    return sorted(list(company_names))


def get_all_startups() -> List[Dict]:
    """Get all startups from startups3 table."""
    print("📋 Fetching all startups from startups3...")

    result = supabase.table("startups3").select("id, name, batch, description").execute()

    startups = result.data if result.data else []
    print(f"   Found {len(startups)} existing startups")

    return startups


def create_startup(company_name: str, dry_run: bool = False) -> Optional[str]:
    """Create a new startup entry."""
    startup_id = str(uuid.uuid4())

    startup_data = {
        "id": startup_id,
        "name": company_name,
        "needs_enrichment": True,
    }

    if dry_run:
        print(f"   [DRY RUN] Would create startup: {company_name}")
        return startup_id

    try:
        result = supabase.table("startups3").insert(startup_data).execute()
        if result.data:
            print(f"   ✅ Created startup: {company_name} (ID: {startup_id[:8]}...)")
            return startup_id
    except Exception as e:
        print(f"   ❌ Error creating startup {company_name}: {e}")

    return None


def update_jobs_with_startup_id(company_name: str, startup_id: str, dry_run: bool = False) -> int:
    """Update all jobs with the given company_name to use the startup_id."""
    if dry_run:
        # Count how many would be updated
        result = supabase.table("jobs").select("id").eq("company_name", company_name).is_("startup_id", "null").execute()
        count = len(result.data) if result.data else 0
        print(f"   [DRY RUN] Would link {count} jobs for '{company_name}'")
        return count

    try:
        result = supabase.table("jobs").update({"startup_id": startup_id}).eq("company_name", company_name).is_("startup_id", "null").execute()
        count = len(result.data) if result.data else 0
        return count
    except Exception as e:
        print(f"   ❌ Error updating jobs for {company_name}: {e}")
        return 0


def get_top_matches(company_name: str, startups: List[Dict], top_n: int = 3) -> List[Tuple[Dict, float]]:
    """Get the top N matching startups with their scores."""
    matches = []

    for startup in startups:
        startup_name = startup.get("name", "")
        if not startup_name:
            continue

        score = similarity_score(company_name, startup_name)
        if score > 50:  # Only include matches above 50%
            matches.append((startup, score))

    # Sort by score descending
    matches.sort(key=lambda x: x[1], reverse=True)
    return matches[:top_n]


def main():
    parser = argparse.ArgumentParser(
        description="Link new jobs to startups using fuzzy matching",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python link_jobs_to_startups.py              # Run with default threshold (80%)
    python link_jobs_to_startups.py --threshold 85  # Use 85% similarity threshold
    python link_jobs_to_startups.py --dry-run    # Preview changes without modifying DB
    python link_jobs_to_startups.py --review     # Interactively review close matches
        """
    )
    parser.add_argument("--threshold", type=float, default=80.0,
                        help="Similarity threshold for matching (0-100, default: 80)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview changes without modifying database")
    parser.add_argument("--review", action="store_true",
                        help="Interactively review matches below threshold but above 60%%")

    args = parser.parse_args()
    threshold = args.threshold
    dry_run = args.dry_run
    review_mode = args.review

    print("=" * 60)
    print("🔗 Link Jobs to Startups")
    print("=" * 60)
    print(f"   Similarity threshold: {threshold}%")
    if dry_run:
        print("   Mode: DRY RUN (no changes will be made)")
    if review_mode:
        print("   Mode: INTERACTIVE REVIEW (will prompt for close matches)")
    print()

    # Get new jobs without startup_id
    jobs = get_new_jobs_without_startup()

    if not jobs:
        print("\n✅ No new jobs to link!")
        return

    # Get unique company names
    company_names = get_unique_company_names(jobs)
    print(f"\n📊 Found {len(company_names)} unique companies to process")

    # Get all existing startups for matching
    startups = get_all_startups()

    # Process each company
    print(f"\n{'=' * 60}")
    print("🔄 Processing companies...")
    print("=" * 60)

    stats = {
        "matched": 0,
        "created": 0,
        "jobs_linked": 0,
        "errors": 0,
        "reviewed": 0,
    }
    near_misses = []  # Track close matches for summary

    for idx, company_name in enumerate(company_names, 1):
        print(f"\n[{idx}/{len(company_names)}] {company_name}")

        # Try to find a matching startup
        match, score = find_matching_startup(company_name, startups, threshold)

        if match:
            # Found a match - use existing startup
            startup_id = match["id"]
            match_name = match["name"]
            print(f"   🔍 Matched to: '{match_name}' (score: {score:.1f}%)")
            stats["matched"] += 1
        else:
            # No auto-match - check if we should review
            top_matches = get_top_matches(company_name, startups, top_n=3)

            # Track near-misses for summary
            if top_matches and top_matches[0][1] >= 60:
                near_misses.append((company_name, top_matches[0]))

            # Interactive review mode for close matches
            if review_mode and top_matches and top_matches[0][1] >= 60:
                print(f"   📋 Top matches found:")
                for i, (startup, s) in enumerate(top_matches, 1):
                    print(f"      {i}. '{startup['name']}' ({s:.1f}%)")
                print(f"      0. Create new startup")

                try:
                    choice = input("   Select option (0-3, default=0): ").strip()
                    if choice and choice.isdigit() and 1 <= int(choice) <= len(top_matches):
                        selected = top_matches[int(choice) - 1]
                        match = selected[0]
                        score = selected[1]
                        startup_id = match["id"]
                        print(f"   ✅ Selected: '{match['name']}'")
                        stats["reviewed"] += 1
                        stats["matched"] += 1
                    else:
                        # Create new startup
                        print(f"   ➕ Creating new startup...")
                        startup_id = create_startup(company_name, dry_run)
                        if startup_id:
                            stats["created"] += 1
                            startups.append({"id": startup_id, "name": company_name})
                        else:
                            stats["errors"] += 1
                            continue
                except (EOFError, KeyboardInterrupt):
                    print("\n   ⚠️  Review cancelled, creating new startup...")
                    startup_id = create_startup(company_name, dry_run)
                    if startup_id:
                        stats["created"] += 1
                        startups.append({"id": startup_id, "name": company_name})
                    else:
                        stats["errors"] += 1
                        continue
            else:
                # No match and not in review mode - create new startup
                if score > 0:
                    print(f"   ⚠️  Best match was {score:.1f}% (below {threshold}% threshold)")
                print(f"   ➕ No match found, creating new startup...")
                startup_id = create_startup(company_name, dry_run)
                if startup_id:
                    stats["created"] += 1
                    # Add to startups list for future matching in this run
                    startups.append({"id": startup_id, "name": company_name})
                else:
                    stats["errors"] += 1
                    continue

        # Update jobs with startup_id
        jobs_updated = update_jobs_with_startup_id(company_name, startup_id, dry_run)
        stats["jobs_linked"] += jobs_updated
        if not dry_run:
            print(f"   ✅ Linked {jobs_updated} job(s)")

    # Summary
    print(f"\n{'=' * 60}")
    print("📊 Summary")
    print("=" * 60)
    print(f"   Companies matched to existing startups: {stats['matched']}")
    if stats["reviewed"] > 0:
        print(f"      (including {stats['reviewed']} from interactive review)")
    print(f"   New startups created: {stats['created']}")
    print(f"   Total jobs linked: {stats['jobs_linked']}")
    if stats["errors"] > 0:
        print(f"   Errors: {stats['errors']}")

    # Show near-misses that weren't matched (potential duplicates to review)
    if near_misses and not review_mode:
        unmatched_near_misses = [nm for nm in near_misses if nm[1][1] < threshold]
        if unmatched_near_misses:
            print(f"\n⚠️  Potential duplicates to review ({len(unmatched_near_misses)} found):")
            for company_name, (startup, score) in unmatched_near_misses[:10]:
                print(f"   '{company_name}' ≈ '{startup['name']}' ({score:.1f}%)")
            if len(unmatched_near_misses) > 10:
                print(f"   ... and {len(unmatched_near_misses) - 10} more")
            print(f"\n   💡 Run with --review to interactively match these")

    if dry_run:
        print("\n⚠️  DRY RUN - No changes were made to the database")
    else:
        print("\n✅ Done!")


if __name__ == "__main__":
    main()
