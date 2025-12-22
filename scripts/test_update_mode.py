"""
Test script to analyze what will happen in update mode.

This script shows:
1. Which startups will be enriched (and with what data)
2. Which jobs will be added (new jobs)
3. Which jobs will be updated (existing jobs)
4. Which jobs will be marked inactive (deleted from website)
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
parent_dir = Path(__file__).parent.parent
env_loaded = (
    load_dotenv(parent_dir / '.env.local') or
    load_dotenv(parent_dir / '.env') or
    load_dotenv('.env.local') or
    load_dotenv('.env') or
    load_dotenv()
)

# Initialize Supabase
supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("Error: Missing Supabase credentials")
    sys.exit(1)

supabase: Client = create_client(supabase_url, supabase_key)


def analyze_startup_enrichment(company_name: str):
    """Show what data a startup currently has and what's missing."""
    print(f"\n{'='*80}")
    print(f"STARTUP ANALYSIS: {company_name}")
    print(f"{'='*80}")

    try:
        # Find the startup
        result = supabase.table("startups3").select("*").ilike("name", f"%{company_name}%").limit(5).execute()

        if not result.data:
            print(f"❌ Startup '{company_name}' not found in database")
            return None

        if len(result.data) > 1:
            print(f"⚠️  Found {len(result.data)} matches:")
            for i, startup in enumerate(result.data, 1):
                print(f"   {i}. {startup['name']}")
            print("\nUsing first match...")

        startup = result.data[0]

        # Show current data
        print(f"\n📊 Current Data:")
        print(f"   ID: {startup.get('id')}")
        print(f"   Name: {startup.get('name')}")
        print(f"   Batch: {startup.get('batch') or '❌ MISSING'}")
        print(f"   Description: {startup.get('description')[:100] + '...' if startup.get('description') else '❌ MISSING'}")
        print(f"   Website: {startup.get('website') or '❌ MISSING'}")
        print(f"   Location: {startup.get('location') or '❌ MISSING'}")
        print(f"   Team Size: {startup.get('team_size') or '❌ MISSING'}")
        print(f"   Needs Enrichment: {startup.get('needs_enrichment', 'N/A')}")

        # Check what will be enriched
        print(f"\n🔄 What Will Be Enriched from Work at a Startup:")
        will_enrich = []
        if not startup.get('description'):
            will_enrich.append("✅ Description (from company_description)")
        if not startup.get('batch'):
            will_enrich.append("✅ Batch (from company_tags)")

        if will_enrich:
            for item in will_enrich:
                print(f"   {item}")
        else:
            print("   ℹ️  No enrichment needed - all basic fields present")

        return startup.get('id')

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None


def analyze_job_changes(company_name: str, startup_id: str = None):
    """Show what jobs will be added, updated, or deleted."""
    print(f"\n{'='*80}")
    print(f"JOB ANALYSIS: {company_name}")
    print(f"{'='*80}")

    try:
        # Get current jobs in database for this company
        result = supabase.table("jobs").select("*").eq("company_name", company_name).execute()

        current_jobs = result.data if result.data else []

        print(f"\n📊 Current Jobs in Database: {len(current_jobs)}")

        if current_jobs:
            print(f"\n📋 Existing Jobs:")
            for i, job in enumerate(current_jobs[:10], 1):  # Show first 10
                is_active = job.get('is_active', True)
                status = "🟢 Active" if is_active else "🔴 Inactive"
                print(f"   {i}. {status} - {job.get('job_title', 'Unknown')}")
                print(f"      Job URL: {job.get('job_url', 'N/A')[:80]}")
                print(f"      Location: {job.get('location', 'N/A')}")

            if len(current_jobs) > 10:
                print(f"   ... and {len(current_jobs) - 10} more jobs")

        # Analyze what would happen
        print(f"\n🔄 What Will Happen in Update Mode:")
        print(f"   ✅ Jobs on website → Will be updated (or inserted if new)")
        print(f"   ❌ Jobs NOT on website → Will be marked inactive")
        print(f"   🆕 New jobs on website → Will be inserted")

        # Show job URLs for reference
        active_jobs = [j for j in current_jobs if j.get('is_active', True)]
        inactive_jobs = [j for j in current_jobs if not j.get('is_active', True)]

        print(f"\n📈 Active Jobs: {len(active_jobs)}")
        print(f"📉 Already Inactive Jobs: {len(inactive_jobs)}")

        # Show sample job data
        if active_jobs:
            sample_job = active_jobs[0]
            print(f"\n📄 Sample Job Data (what we have currently):")
            print(f"   Title: {sample_job.get('job_title')}")
            print(f"   Type: {sample_job.get('job_type', 'N/A')}")
            print(f"   Location: {sample_job.get('location', 'N/A')}")
            print(f"   Salary: {sample_job.get('salary_range', 'N/A')}")
            print(f"   Has Requirements: {'Yes' if sample_job.get('requirements') else 'No'}")
            print(f"   Has Benefits: {'Yes' if sample_job.get('benefits') else 'No'}")
            print(f"   Has Interview Process: {'Yes' if sample_job.get('interview_process') else 'No'}")

        return len(current_jobs)

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 0


def test_fuzzy_matching():
    """Test fuzzy matching with common variations."""
    print(f"\n{'='*80}")
    print(f"FUZZY MATCHING TEST")
    print(f"{'='*80}")

    test_cases = [
        ("OpenAI", "openai"),
        ("Hey Telo", "HeyTelo"),
        ("Acme Inc.", "Acme"),
        ("Hera Video", "Hera"),
        ("Kapa Ai", "Kapa.ai"),
        ("FirstIgnite", "Firstignite"),
    ]

    from scrape_workatastartup_directory import normalize_company_name

    print(f"\n🔍 Testing Name Normalization:")
    for input_name, expected_match in test_cases:
        normalized_input = normalize_company_name(input_name)
        normalized_expected = normalize_company_name(expected_match)
        match = "✅ MATCH" if normalized_input == normalized_expected else "❌ NO MATCH"
        print(f"   '{input_name}' vs '{expected_match}'")
        print(f"      → '{normalized_input}' vs '{normalized_expected}' {match}")


def main():
    """Run all tests."""
    print("="*80)
    print("UPDATE MODE TEST SUITE")
    print("="*80)
    print("\nThis script analyzes what will happen when you run update mode.")
    print("It shows enrichment, job updates, and deletions WITHOUT modifying data.")

    # Test fuzzy matching
    test_fuzzy_matching()

    # Get user input for company to test
    print(f"\n{'='*80}")
    company_name = input("\nEnter a company name to analyze (or press Enter for a default): ").strip()

    if not company_name:
        # Try to find a company with jobs
        result = supabase.table("startups3").select("name").limit(10).execute()
        if result.data:
            company_name = result.data[0]['name']
            print(f"Using default company: {company_name}")
        else:
            print("No companies found in database")
            return

    # Analyze startup enrichment
    startup_id = analyze_startup_enrichment(company_name)

    # Analyze job changes
    if startup_id:
        analyze_job_changes(company_name, startup_id)

    print(f"\n{'='*80}")
    print("TEST COMPLETE")
    print(f"{'='*80}")
    print("\n💡 Next Steps:")
    print("   1. Run: python scrape_workatastartup_directory.py --update-mode --dry-run --test")
    print("      (This will show what WOULD happen without modifying data)")
    print("   2. Run: python scrape_workatastartup_directory.py --update-mode --test")
    print("      (This will actually update ONE company)")
    print("   3. Run: python scrape_workatastartup_directory.py --update-mode --no-skip-existing")
    print("      (This will update ALL companies)")


if __name__ == "__main__":
    main()
