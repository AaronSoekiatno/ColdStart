"""
Link new jobs to startups using fuzzy matching.

This script:
1. Finds jobs where startup_id IS NULL (new jobs)
2. For each unique company_name, tries to find an existing startup using fuzzy matching
3. Creates a new startup only if no match is found
4. Updates the jobs with the matched/created startup_id

IMPORTANT: This script loads all startups into memory at the start. If you delete
startups from the database while this script is running, it will verify each match
still exists before using it. However, for best results, restart the script after
making deletions to ensure you have the latest startup list.

Usage:
    python link_jobs_to_startups.py              # Run with default threshold (80%)
    python link_jobs_to_startups.py --threshold 85  # Use 85% similarity threshold
    python link_jobs_to_startups.py --dry-run    # Preview changes without modifying DB
"""

import os
import sys
import uuid
import argparse
from pathlib import Path
from typing import Optional, List, Dict, Tuple
from dotenv import load_dotenv

# Load environment variables FIRST
# Find project root (parent of script's directory) and look for .env.local there
script_dir = Path(__file__).parent.absolute()
project_root = script_dir.parent  # Go up one level from yc_companies/ to root

# Try multiple locations: project root first, then current directory
env_paths = [
    project_root / '.env.local',
    project_root / '.env',
    script_dir / '.env.local',
    script_dir / '.env',
    Path('.env.local'),  # Current working directory
    Path('.env'),  # Current working directory
]

env_loaded = False
for env_path in env_paths:
    if env_path.exists():
        env_loaded = load_dotenv(env_path)
        if env_loaded:
            print(f"[OK] Environment variables loaded from: {env_path}")
            break

if not env_loaded:
    print("[WARN] No .env file found - using system environment variables")
    print(f"   Checked paths: {[str(p) for p in env_paths if p.exists() or str(p).endswith('.env.local')]}")

from supabase import create_client, Client

# Initialize Supabase client
# IMPORTANT: Use SERVICE_ROLE_KEY to bypass RLS (Row Level Security)
# The anon key may not have permission to read startups3
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
# Prefer service role key (bypasses RLS) over anon key
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# Debug: Check what we found
print(f"[DEBUG] Supabase URL found: {'Yes' if supabase_url else 'No'}")
service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
anon_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
if service_key:
    print(f"[DEBUG] Using SERVICE_ROLE_KEY (bypasses RLS)")
elif anon_key:
    print(f"[WARN] Using ANON_KEY (may be blocked by RLS!)")
    print(f"   Add SUPABASE_SERVICE_ROLE_KEY to .env.local for full access")
else:
    print(f"[ERROR] No Supabase key found!")
if supabase_url:
    print(f"   URL: {supabase_url[:30]}...")
if not supabase_key:
    print("   Checking for: NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print("\n[ERROR] Missing Supabase credentials!")
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
        # Product/service type suffixes that might differ between job listings and startup names
        ' video', ' media', ' group', ' network', ' platform', ' health', ' healthcare',
        ' finance', ' financial', ' bio', ' robotics', ' automation', ' analytics',
        ' data', ' cloud', ' security', ' energy', ' foods', ' food',
    ]
    for suffix in suffixes:
        if normalized.endswith(suffix):
            # Don't remove suffix if it would leave less than 3 characters
            # (e.g., don't turn "14 Ai" into "14")
            remaining = normalized[:-len(suffix)]
            if len(remaining.strip()) >= 3:
                normalized = remaining
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

    # First word only (e.g., "Hera Video" -> "hera")
    # This helps match when company names have extra descriptive words
    words = normalized.split()
    if len(words) > 1 and len(words[0]) >= 3:
        variations.add(words[0])

    # With common suffixes removed more aggressively
    base = normalized
    extra_suffixes = ['ai', 'io', 'hq', 'app', 'labs', 'tech', 'video', 'media', 'health']
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

    # Check for first-word match (strong signal for company names like "Hera Video" vs "Hera")
    words1 = normalize_company_name(name1).split()
    words2 = normalize_company_name(name2).split()
    if words1 and words2 and len(words1[0]) >= 3 and len(words2[0]) >= 3:
        if words1[0] == words2[0]:
            # First words match exactly - very likely the same company
            best_score = 95.0

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


def verify_startup_exists(startup_id: str) -> bool:
    """Verify that a startup still exists in the database."""
    try:
        result = supabase.table("startups3").select("id").eq("id", startup_id).limit(1).execute()
        return result.data is not None and len(result.data) > 0
    except Exception:
        return False


def find_matching_startup(company_name: str, startups: List[Dict], threshold: float = 80.0, verify_exists: bool = True) -> Tuple[Optional[Dict], float]:
    """Find a startup that matches the company name using fuzzy matching.

    Args:
        company_name: The company name to match
        startups: List of startup dictionaries to search
        threshold: Similarity threshold (0-100)
        verify_exists: If True, verify each match still exists in database before returning

    Returns:
        Tuple of (matched_startup, similarity_score) or (None, 0.0)
    """
    best_match = None
    best_score = 0.0

    for startup in startups:
        startup_name = startup.get("name", "")
        if not startup_name:
            continue

        # Verify startup still exists in database if requested
        if verify_exists and best_match:
            startup_id = startup.get("id")
            if startup_id and not verify_startup_exists(startup_id):
                # This startup was deleted, skip it
                continue

        score = similarity_score(company_name, startup_name)

        if score > best_score:
            best_score = score
            if score >= threshold:
                best_match = startup

    # Final verification: if we found a match, verify it still exists
    if verify_exists and best_match:
        startup_id = best_match.get("id")
        if startup_id and not verify_startup_exists(startup_id):
            # Match was deleted, return None
            return None, best_score

    return best_match, best_score


def get_new_jobs_without_startup() -> List[Dict]:
    """Get all jobs where startup_id is NULL."""
    print("Fetching new jobs without startup_id...")

    # Query jobs where startup_id is null (with pagination)
    all_jobs = []
    page_size = 1000
    offset = 0

    while True:
        result = supabase.table("jobs").select("id, company_name, job_title, created_at").is_("startup_id", "null").range(offset, offset + page_size - 1).execute()

        if not result.data:
            break

        all_jobs.extend(result.data)
        print(f"   Fetched {len(all_jobs)} jobs so far...")

        if len(result.data) < page_size:
            break

        offset += page_size

    print(f"   Found {len(all_jobs)} jobs without startup_id")
    return all_jobs


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
    print("Fetching all startups from startups3...")

    try:
        # Debug: Try a simple query first
        print("   Testing table access...")
        test_result = supabase.table("startups3").select("id, name").limit(5).execute()
        print(f"   Test query returned: {len(test_result.data) if test_result.data else 0} rows")

        if test_result.data:
            print(f"   Sample: {[r.get('name', 'NO NAME') for r in test_result.data[:3]]}")

        # If test query returns 0, try to understand why
        if not test_result.data:
            print("   [WARN] Table appears empty or inaccessible!")
            print("   Checking if this is an RLS (Row Level Security) issue...")

            # Try to get count anyway
            try:
                count_result = supabase.table("startups3").select("*", count="exact").limit(0).execute()
                print(f"   Count query: {count_result.count if hasattr(count_result, 'count') else 'N/A'}")
            except Exception as ce:
                print(f"   [ERROR] Count query failed: {ce}")

            # Maybe the table is named differently?
            print("   If startups3 is empty, this script will create startups from job data.")
            return []

        # Fetch all startups (with pagination)
        all_startups = []
        page_size = 1000
        offset = 0

        while True:
            result = supabase.table("startups3").select("id, name, batch, description").range(offset, offset + page_size - 1).execute()
            if not result.data:
                break
            all_startups.extend(result.data)
            print(f"   Fetched {len(all_startups)} startups so far...")
            if len(result.data) < page_size:
                break
            offset += page_size

        print(f"   [OK] Found {len(all_startups)} existing startups")

        return all_startups

    except Exception as e:
        print(f"   [ERROR] Error fetching startups: {e}")
        import traceback
        traceback.print_exc()
        return []


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
            print(f"   [OK] Created startup: {company_name} (ID: {startup_id[:8]}...)")
            return startup_id
    except Exception as e:
        print(f"   [ERROR] Error creating startup {company_name}: {e}")

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
        print(f"   [ERROR] Error updating jobs for {company_name}: {e}")
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


def cluster_similar_names(company_names: List[str], threshold: float = 80.0) -> List[List[str]]:
    """Cluster similar company names together to avoid duplicates.

    Returns a list of clusters, where each cluster is a list of similar names.
    """
    print(f"\nClustering {len(company_names)} company names (threshold: {threshold}%)...")

    # Sort names so we process consistently
    sorted_names = sorted(company_names)

    clusters = []
    assigned = set()

    for name in sorted_names:
        if name in assigned:
            continue

        # Start a new cluster with this name
        cluster = [name]
        assigned.add(name)

        # Find all similar names
        for other in sorted_names:
            if other in assigned:
                continue

            score = similarity_score(name, other)
            if score >= threshold:
                cluster.append(other)
                assigned.add(other)

        clusters.append(cluster)

    # Show clustering results
    multi_name_clusters = [c for c in clusters if len(c) > 1]
    if multi_name_clusters:
        print(f"   Found {len(multi_name_clusters)} clusters with multiple names:")
        for cluster in multi_name_clusters[:10]:  # Show first 10
            print(f"      - {cluster}")
        if len(multi_name_clusters) > 10:
            print(f"      ... and {len(multi_name_clusters) - 10} more")
    else:
        print("   No duplicate company names detected")

    return clusters


def main():
    parser = argparse.ArgumentParser(
        description="Link new jobs to startups using fuzzy matching",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    python link_jobs_to_startups.py              # Run with default threshold (80%)
    python link_jobs_to_startups.py --threshold 85  # Use 85% auto-match threshold
    python link_jobs_to_startups.py --dry-run    # Preview changes without modifying DB

This script:
1. FIRST clusters similar company names from jobs (e.g., "14 Ai" and "14.ai")
2. THEN matches clusters to existing startups in startups3
3. Creates new startups only for unmatched clusters
        """
    )
    parser.add_argument("--threshold", type=float, default=80.0,
                        help="Similarity threshold for matching (0-100, default: 80)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview changes without modifying database")

    args = parser.parse_args()
    threshold = args.threshold
    dry_run = args.dry_run

    print("=" * 60)
    print("Link Jobs to Startups")
    print("=" * 60)
    print(f"   Similarity threshold: {threshold}%")
    if dry_run:
        print("   Mode: DRY RUN (no changes will be made)")
    print()

    # Get new jobs without startup_id
    jobs = get_new_jobs_without_startup()

    if not jobs:
        print("\n[OK] No new jobs to link!")
        return

    # Get unique company names
    company_names = get_unique_company_names(jobs)
    print(f"\nFound {len(company_names)} unique companies to process")

    # STEP 1: Cluster similar company names together FIRST
    # This prevents "14 Ai" and "14.ai" from becoming separate startups
    # Use a HIGHER threshold (95%) for clustering to avoid false positives
    # like grouping "Andon Labs" with "Andson Biotech"
    clustering_threshold = 95.0  # Very strict - only near-identical names
    clusters = cluster_similar_names(company_names, clustering_threshold)
    print(f"   Grouped into {len(clusters)} distinct companies")

    # Get all existing startups for matching
    # NOTE: This loads startups into memory. If startups are deleted after this point,
    # the script will verify each match still exists before using it.
    startups = get_all_startups()

    # Debug: Verify startups are loaded and check for specific names
    if startups:
        startup_names = [s.get("name", "") for s in startups if s.get("name")]
        print(f"\n[DEBUG] Loaded {len(startups)} startups")
        # Check if some of the job company names exist exactly in startups
        sample_matches = []
        for cn in company_names[:20]:  # Check first 20
            if cn in startup_names:
                sample_matches.append(cn)
        if sample_matches:
            print(f"   [OK] Exact matches found for: {sample_matches[:5]}")
        else:
            print(f"   [WARN] No exact matches in first 20 company names")
            print(f"   Sample startup names: {startup_names[:5]}")
            print(f"   Sample company names: {company_names[:5]}")
    else:
        print(f"\n[WARN] No startups loaded! All companies will be created as new.")

    # STEP 2: Process each cluster
    print(f"\n{'=' * 60}")
    print("Processing companies...")
    print("=" * 60)

    stats = {
        "matched": 0,
        "created": 0,
        "jobs_linked": 0,
        "errors": 0,
        "reviewed": 0,
    }

    for idx, cluster in enumerate(clusters, 1):
        # Use the first name in the cluster as the canonical name
        canonical_name = cluster[0]
        all_names = cluster

        if len(cluster) > 1:
            print(f"\n[{idx}/{len(clusters)}] {canonical_name} (+ {len(cluster)-1} variations: {cluster[1:]})")
        else:
            print(f"\n[{idx}/{len(clusters)}] {canonical_name}")

        # Try to find a matching startup using any name in the cluster
        best_match = None
        best_score = 0.0

        # First, check for EXACT match (case-insensitive)
        for name in all_names:
            name_lower = name.lower().strip()
            for startup in startups:
                startup_name = startup.get("name", "")
                if startup_name and startup_name.lower().strip() == name_lower:
                    # Exact match found! Verify it still exists
                    if verify_startup_exists(startup.get("id")):
                        best_match = startup
                        best_score = 100.0
                        print(f"   [OK] Exact match found: '{startup_name}'")
                        break
                    else:
                        # Exact match was deleted, skip it
                        print(f"   [WARN] Exact match '{startup_name}' was deleted, continuing search...")
                        continue
            if best_match:
                break

        # If no exact match, try fuzzy matching
        if not best_match:
            for name in all_names:
                match, score = find_matching_startup(name, startups, threshold, verify_exists=True)
                if score > best_score:
                    best_score = score
                    if match:
                        # Double-check the match still exists
                        if verify_startup_exists(match.get("id")):
                            best_match = match
                        else:
                            # Match was deleted, continue searching
                            print(f"   [WARN] Matched startup was deleted, continuing search...")
                            continue

        if best_match:
            # Found a match - verify it still exists before using
            startup_id = best_match.get("id")
            if not startup_id or not verify_startup_exists(startup_id):
                print(f"   [WARN] Matched startup was deleted from database, creating new one...")
                best_match = None
                best_score = 0.0
            else:
                # Found a match - use existing startup
                match_name = best_match["name"]
                print(f"   [MATCH] Matched to: '{match_name}' (score: {best_score:.1f}%)")
                stats["matched"] += 1
        else:
            # No auto-match - check for close matches
            top_matches = get_top_matches(canonical_name, startups, top_n=3)

            # Automatic review for close matches (70%+) to prevent duplicates
            has_close_match = top_matches and top_matches[0][1] >= 70

            if has_close_match:
                print(f"   [WARN] POTENTIAL DUPLICATE - Close matches found:")
                for i, (startup, s) in enumerate(top_matches, 1):
                    print(f"      {i}. '{startup['name']}' ({s:.1f}%)")
                print(f"      0. Create NEW startup (confirm not a duplicate)")

                try:
                    choice = input("   Select option (0-3, default=1 to use best match): ").strip()
                    if choice == "0":
                        # Explicitly chose to create new startup
                        print(f"   [+] Creating new startup (user confirmed)...")
                        startup_id = create_startup(canonical_name, dry_run)
                        if startup_id:
                            stats["created"] += 1
                            startups.append({"id": startup_id, "name": canonical_name})
                        else:
                            stats["errors"] += 1
                            continue
                    elif choice and choice.isdigit() and 1 <= int(choice) <= len(top_matches):
                        selected = top_matches[int(choice) - 1]
                        best_match = selected[0]
                        best_score = selected[1]
                        # Verify selected startup still exists
                        if not verify_startup_exists(best_match.get("id")):
                            print(f"   [WARN] Selected startup was deleted, creating new one...")
                            best_match = None
                            startup_id = create_startup(canonical_name, dry_run)
                            if startup_id:
                                stats["created"] += 1
                                startups.append({"id": startup_id, "name": canonical_name})
                            else:
                                stats["errors"] += 1
                                continue
                        else:
                            startup_id = best_match["id"]
                            print(f"   [OK] Selected: '{best_match['name']}'")
                            stats["reviewed"] += 1
                            stats["matched"] += 1
                    else:
                        # Default: use best match (option 1)
                        selected = top_matches[0]
                        best_match = selected[0]
                        best_score = selected[1]
                        # Verify best match still exists
                        if not verify_startup_exists(best_match.get("id")):
                            print(f"   [WARN] Best match was deleted, creating new one...")
                            best_match = None
                            startup_id = create_startup(canonical_name, dry_run)
                            if startup_id:
                                stats["created"] += 1
                                startups.append({"id": startup_id, "name": canonical_name})
                            else:
                                stats["errors"] += 1
                                continue
                        else:
                            startup_id = best_match["id"]
                            print(f"   [OK] Using best match: '{best_match['name']}' ({best_score:.1f}%)")
                            stats["reviewed"] += 1
                            stats["matched"] += 1
                except (EOFError, KeyboardInterrupt):
                    # Default to best match on interrupt
                    selected = top_matches[0]
                    best_match = selected[0]
                    best_score = selected[1]
                    # Verify best match still exists
                    if not verify_startup_exists(best_match.get("id")):
                        print(f"\n   [WARN] Best match was deleted, creating new one...")
                        best_match = None
                        startup_id = create_startup(canonical_name, dry_run)
                        if startup_id:
                            stats["created"] += 1
                            startups.append({"id": startup_id, "name": canonical_name})
                        else:
                            stats["errors"] += 1
                            continue
                    else:
                        startup_id = best_match["id"]
                        print(f"\n   [OK] Using best match (default): '{best_match['name']}'")
                        stats["reviewed"] += 1
                        stats["matched"] += 1
            else:
                # No close match - safe to create new startup
                if best_score > 0:
                    print(f"   [INFO] Best match was only {best_score:.1f}% (no close matches)")
                print(f"   [+] Creating new startup...")
                startup_id = create_startup(canonical_name, dry_run)
                if startup_id:
                    stats["created"] += 1
                    # Add to startups list for future matching in this run
                    startups.append({"id": startup_id, "name": canonical_name})
                else:
                    stats["errors"] += 1
                    continue

        # Update jobs with startup_id for ALL names in this cluster
        for name in all_names:
            jobs_updated = update_jobs_with_startup_id(name, startup_id, dry_run)
            stats["jobs_linked"] += jobs_updated
            if not dry_run and jobs_updated > 0:
                if name == canonical_name:
                    print(f"   [OK] Linked {jobs_updated} job(s)")
                else:
                    print(f"   [OK] Linked {jobs_updated} job(s) for '{name}'")

    # Summary
    print(f"\n{'=' * 60}")
    print("Summary")
    print("=" * 60)
    print(f"   Company clusters processed: {len(clusters)}")
    print(f"   Matched to existing startups: {stats['matched']}")
    if stats["reviewed"] > 0:
        print(f"      (including {stats['reviewed']} from interactive review)")
    print(f"   New startups created: {stats['created']}")
    print(f"   Total jobs linked: {stats['jobs_linked']}")
    if stats["errors"] > 0:
        print(f"   Errors: {stats['errors']}")

    if dry_run:
        print("\n[WARN] DRY RUN - No changes were made to the database")
    else:
        print("\n[OK] Done!")


if __name__ == "__main__":
    main()
