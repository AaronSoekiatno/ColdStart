"""
Backfill startup_id in jobs table by matching company_name to startups3.name.
This connects existing jobs to the startups3 table.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from typing import Optional

# Load environment variables
parent_dir = Path(__file__).parent.parent
env_loaded = (
    load_dotenv(parent_dir / '.env.local') or
    load_dotenv(parent_dir / '.env') or
    load_dotenv('.env.local') or
    load_dotenv('.env') or
    load_dotenv()
)

if env_loaded:
    print("✅ Environment variables loaded")
else:
    print("⚠️  No .env file found - using system environment variables")

# Initialize Supabase client
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(supabase_url, supabase_key)


def find_startup_id_by_name(company_name: str) -> Optional[str]:
    """
    Find startup ID in startups3 table by company name.
    Tries exact match first, then case-insensitive match.
    """
    if not company_name or not company_name.strip():
        return None
    
    # Try exact match
    try:
        result = supabase.table("startups3").select("id").eq("name", company_name).limit(1).execute()
        if result.data and len(result.data) > 0:
            return result.data[0]["id"]
    except Exception as e:
        print(f"   ⚠️  Error finding startup by exact match: {e}")
    
    # Try case-insensitive match
    try:
        result = supabase.table("startups3").select("id, name").ilike("name", f"%{company_name}%").limit(10).execute()
        if result.data:
            # Find best match (exact case-insensitive match)
            for startup in result.data:
                if startup["name"].lower() == company_name.lower():
                    return startup["id"]
            
            # If no exact match, return first partial match (but log it)
            if len(result.data) > 0:
                print(f"   ⚠️  Using partial match: '{result.data[0]['name']}' for '{company_name}'")
                return result.data[0]["id"]
    except Exception as e:
        print(f"   ⚠️  Error finding startup by case-insensitive match: {e}")
    
    return None


def backfill_jobs_startup_id(dry_run: bool = False, limit: Optional[int] = None):
    """
    Backfill startup_id for jobs that don't have it set.
    Matches jobs.company_name to startups3.name.
    """
    print("🔗 Backfilling startup_id for jobs table...")
    print(f"   Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    
    # Get all jobs without startup_id
    print("\n📋 Fetching jobs without startup_id...")
    query = supabase.table("jobs").select("id, company_name, startup_id").is_("startup_id", "null")
    
    if limit:
        query = query.limit(limit)
    
    result = query.execute()
    
    if not result.data:
        print("   ✅ No jobs found without startup_id")
        return
    
    jobs = result.data
    print(f"   📊 Found {len(jobs)} jobs without startup_id")
    
    # Get unique company names
    company_names = list(set([job["company_name"] for job in jobs if job.get("company_name")]))
    print(f"   📊 Unique companies: {len(company_names)}")
    
    # Build a mapping of company_name -> startup_id
    print("\n🔍 Building company name to startup_id mapping...")
    company_to_startup_id = {}
    not_found_companies = []
    
    for company_name in company_names:
        startup_id = find_startup_id_by_name(company_name)
        if startup_id:
            company_to_startup_id[company_name] = startup_id
        else:
            not_found_companies.append(company_name)
    
    print(f"   ✅ Found matches: {len(company_to_startup_id)}")
    print(f"   ⚠️  Not found: {len(not_found_companies)}")
    
    if not_found_companies:
        print(f"\n   Companies not found in startups3:")
        for company in not_found_companies[:20]:  # Show first 20
            print(f"      - {company}")
        if len(not_found_companies) > 20:
            print(f"      ... and {len(not_found_companies) - 20} more")
    
    # Update jobs
    print(f"\n💾 Updating jobs...")
    updated_count = 0
    error_count = 0
    
    for idx, job in enumerate(jobs, 1):
        company_name = job.get("company_name")
        job_id = job.get("id")
        
        if not company_name or not job_id:
            continue
        
        startup_id = company_to_startup_id.get(company_name)
        
        if not startup_id:
            # Company not found in startups3 - skip
            continue
        
        if dry_run:
            print(f"   [{idx}/{len(jobs)}] [DRY RUN] Would update job {job_id[:8]}... for {company_name} -> {startup_id[:8]}...")
            updated_count += 1
        else:
            try:
                supabase.table("jobs").update({"startup_id": startup_id}).eq("id", job_id).execute()
                updated_count += 1
                if idx % 50 == 0:  # Progress update every 50 jobs
                    print(f"   [{idx}/{len(jobs)}] Updated {updated_count} jobs so far...")
            except Exception as e:
                error_count += 1
                print(f"   [{idx}/{len(jobs)}] ❌ Error updating job {job_id[:8]}...: {e}")
    
    print(f"\n{'='*80}")
    print(f"✅ Backfill complete!")
    print(f"{'='*80}")
    print(f"📊 Total jobs processed: {len(jobs)}")
    print(f"✅ Jobs updated: {updated_count}")
    print(f"❌ Errors: {error_count}")
    print(f"⚠️  Companies not found: {len(not_found_companies)}")
    
    if dry_run:
        print(f"\n💡 Run without --dry-run to apply changes")
    else:
        print(f"\n✅ Changes applied to database")


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Backfill startup_id in jobs table by matching company_name to startups3.name",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run to see what would be updated
  python backfill_jobs_startup_id.py --dry-run
  
  # Backfill all jobs
  python backfill_jobs_startup_id.py
  
  # Backfill first 100 jobs (for testing)
  python backfill_jobs_startup_id.py --limit 100
        """
    )
    parser.add_argument("--dry-run", action="store_true", help="Show what would be updated without making changes")
    parser.add_argument("--limit", type=int, help="Limit number of jobs to process (for testing)")
    
    args = parser.parse_args()
    
    backfill_jobs_startup_id(dry_run=args.dry_run, limit=args.limit)


if __name__ == "__main__":
    main()



