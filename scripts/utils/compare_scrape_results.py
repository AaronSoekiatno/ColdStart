"""
Compare database state before and after running the scraper.

Usage:
1. Run BEFORE scraping: python compare_scrape_results.py snapshot
2. Run the scraper: python scrape_workatastartup_directory.py --update-mode --test
3. Run AFTER scraping: python compare_scrape_results.py compare
"""
import os
import sys
import json
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
parent_dir = Path(__file__).parent.parent
env_loaded = (
    load_dotenv(parent_dir / '.env.local') or
    load_dotenv(parent_dir / '.env') or
    load_dotenv()
)

# Initialize Supabase
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("Error: Missing Supabase credentials")
    sys.exit(1)

supabase: Client = create_client(supabase_url, supabase_key)

SNAPSHOT_FILE = "scrape_snapshot.json"


def take_snapshot():
    """Take a snapshot of current database state."""
    print("Taking snapshot of current database state...")

    try:
        # Get all startups
        startups_result = supabase.table("startups3").select("id, name, batch, description, needs_enrichment").execute()
        startups = startups_result.data if startups_result.data else []

        # Get all jobs
        jobs_result = supabase.table("jobs").select("id, company_name, job_title, job_url, is_active").execute()
        jobs = jobs_result.data if jobs_result.data else []

        snapshot = {
            "timestamp": datetime.now().isoformat(),
            "startups": {
                "total": len(startups),
                "with_description": len([s for s in startups if s.get('description')]),
                "with_batch": len([s for s in startups if s.get('batch')]),
                "needs_enrichment": len([s for s in startups if s.get('needs_enrichment')]),
                "data": startups
            },
            "jobs": {
                "total": len(jobs),
                "active": len([j for j in jobs if j.get('is_active', True)]),
                "inactive": len([j for j in jobs if not j.get('is_active', True)]),
                "data": jobs
            }
        }

        # Save to file
        with open(SNAPSHOT_FILE, 'w') as f:
            json.dump(snapshot, f, indent=2)

        print(f"\n✅ Snapshot saved to {SNAPSHOT_FILE}")
        print(f"\n📊 Current State:")
        print(f"   Startups: {snapshot['startups']['total']}")
        print(f"     - With description: {snapshot['startups']['with_description']}")
        print(f"     - With batch: {snapshot['startups']['with_batch']}")
        print(f"     - Needs enrichment: {snapshot['startups']['needs_enrichment']}")
        print(f"   Jobs: {snapshot['jobs']['total']}")
        print(f"     - Active: {snapshot['jobs']['active']}")
        print(f"     - Inactive: {snapshot['jobs']['inactive']}")

    except Exception as e:
        print(f"❌ Error taking snapshot: {e}")
        import traceback
        traceback.print_exc()


def compare_snapshots():
    """Compare current state with snapshot."""
    if not os.path.exists(SNAPSHOT_FILE):
        print(f"❌ No snapshot found. Run 'python {sys.argv[0]} snapshot' first.")
        return

    print("Loading snapshot...")
    with open(SNAPSHOT_FILE, 'r') as f:
        before = json.load(f)

    print("Getting current database state...")

    try:
        # Get current state
        startups_result = supabase.table("startups3").select("id, name, batch, description, needs_enrichment").execute()
        current_startups = startups_result.data if startups_result.data else []

        jobs_result = supabase.table("jobs").select("id, company_name, job_title, job_url, is_active").execute()
        current_jobs = jobs_result.data if jobs_result.data else []

        # Calculate changes
        print(f"\n{'='*80}")
        print(f"COMPARISON RESULTS")
        print(f"{'='*80}")
        print(f"\nSnapshot taken: {before['timestamp']}")
        print(f"Current time: {datetime.now().isoformat()}")

        # Startup changes
        print(f"\n📊 STARTUPS:")
        print(f"   Before: {before['startups']['total']}")
        print(f"   After:  {len(current_startups)}")
        print(f"   Change: {len(current_startups) - before['startups']['total']:+d}")

        # Enrichment changes
        current_with_description = len([s for s in current_startups if s.get('description')])
        current_with_batch = len([s for s in current_startups if s.get('batch')])
        current_needs_enrichment = len([s for s in current_startups if s.get('needs_enrichment')])

        print(f"\n   Enrichment:")
        print(f"     With description:")
        print(f"       Before: {before['startups']['with_description']}")
        print(f"       After:  {current_with_description}")
        print(f"       Change: {current_with_description - before['startups']['with_description']:+d}")

        print(f"     With batch:")
        print(f"       Before: {before['startups']['with_batch']}")
        print(f"       After:  {current_with_batch}")
        print(f"       Change: {current_with_batch - before['startups']['with_batch']:+d}")

        print(f"     Needs enrichment:")
        print(f"       Before: {before['startups']['needs_enrichment']}")
        print(f"       After:  {current_needs_enrichment}")
        print(f"       Change: {current_needs_enrichment - before['startups']['needs_enrichment']:+d}")

        # Job changes
        current_active = len([j for j in current_jobs if j.get('is_active', True)])
        current_inactive = len([j for j in current_jobs if not j.get('is_active', True)])

        print(f"\n📋 JOBS:")
        print(f"   Total:")
        print(f"     Before: {before['jobs']['total']}")
        print(f"     After:  {len(current_jobs)}")
        print(f"     Change: {len(current_jobs) - before['jobs']['total']:+d}")

        print(f"   Active:")
        print(f"     Before: {before['jobs']['active']}")
        print(f"     After:  {current_active}")
        print(f"     Change: {current_active - before['jobs']['active']:+d}")

        print(f"   Inactive:")
        print(f"     Before: {before['jobs']['inactive']}")
        print(f"     After:  {current_inactive}")
        print(f"     Change: {current_inactive - before['jobs']['inactive']:+d}")

        # Find specific changes
        print(f"\n🔍 DETAILED CHANGES:")

        # New startups
        before_startup_ids = {s['id'] for s in before['startups']['data']}
        new_startups = [s for s in current_startups if s['id'] not in before_startup_ids]

        if new_startups:
            print(f"\n   ✅ New Startups ({len(new_startups)}):")
            for startup in new_startups[:10]:
                print(f"      - {startup['name']}")
            if len(new_startups) > 10:
                print(f"      ... and {len(new_startups) - 10} more")

        # Enriched startups
        before_startups_dict = {s['id']: s for s in before['startups']['data']}
        enriched = []
        for startup in current_startups:
            if startup['id'] in before_startups_dict:
                before_startup = before_startups_dict[startup['id']]
                if not before_startup.get('description') and startup.get('description'):
                    enriched.append((startup['name'], 'description'))
                if not before_startup.get('batch') and startup.get('batch'):
                    enriched.append((startup['name'], 'batch'))

        if enriched:
            print(f"\n   🔄 Enriched Startups ({len(enriched)}):")
            for name, field in enriched[:10]:
                print(f"      - {name}: added {field}")
            if len(enriched) > 10:
                print(f"      ... and {len(enriched) - 10} more")

        # New/updated/deleted jobs
        before_job_urls = {j['job_url']: j for j in before['jobs']['data'] if j.get('job_url')}
        current_job_urls = {j['job_url']: j for j in current_jobs if j.get('job_url')}

        new_jobs = [j for url, j in current_job_urls.items() if url not in before_job_urls]
        deleted_jobs = []

        for url, before_job in before_job_urls.items():
            if url in current_job_urls:
                current_job = current_job_urls[url]
                # Check if job was deactivated
                if before_job.get('is_active', True) and not current_job.get('is_active', True):
                    deleted_jobs.append(before_job)

        if new_jobs:
            print(f"\n   ✅ New Jobs ({len(new_jobs)}):")
            for job in new_jobs[:10]:
                print(f"      - {job['company_name']}: {job['job_title']}")
            if len(new_jobs) > 10:
                print(f"      ... and {len(new_jobs) - 10} more")

        if deleted_jobs:
            print(f"\n   ❌ Deactivated Jobs ({len(deleted_jobs)}):")
            for job in deleted_jobs[:10]:
                print(f"      - {job['company_name']}: {job['job_title']}")
            if len(deleted_jobs) > 10:
                print(f"      ... and {len(deleted_jobs) - 10} more")

        print(f"\n{'='*80}")

    except Exception as e:
        print(f"❌ Error comparing: {e}")
        import traceback
        traceback.print_exc()


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print(f"  {sys.argv[0]} snapshot  - Take a snapshot of current state")
        print(f"  {sys.argv[0]} compare   - Compare current state with snapshot")
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == "snapshot":
        take_snapshot()
    elif command == "compare":
        compare_snapshots()
    else:
        print(f"Unknown command: {command}")
        print("Use 'snapshot' or 'compare'")
        sys.exit(1)


if __name__ == "__main__":
    main()
