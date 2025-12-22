"""
Quick script to check if specific companies exist in the database.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

# Load environment
parent_dir = Path(__file__).parent.parent
load_dotenv(parent_dir / '.env.local') or load_dotenv(parent_dir / '.env') or load_dotenv()

supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("Error: Missing Supabase credentials")
    sys.exit(1)

supabase = create_client(supabase_url, supabase_key)

# Companies that showed as "Would create new"
companies_to_check = [
    "Wanderlog",
    "Xpay",
    "Trycardinal",
    "Phonely",
    "Delty",
    "Firecrawl",
    "Polymath Robotics",
    "Midship",
    "Acely",
    "Pointone",
    "Sante",
    "Axle",
    "Hadrius",
    "Korrai",
]

print("Checking if companies exist in database...\n")

for company in companies_to_check:
    # Try exact match
    result = supabase.table("startups3").select("id, name").eq("name", company).execute()

    if result.data:
        print(f"FOUND (exact): '{company}' -> '{result.data[0]['name']}'")
        continue

    # Try case-insensitive
    result = supabase.table("startups3").select("id, name").ilike("name", f"%{company}%").limit(5).execute()

    if result.data:
        print(f"FOUND (fuzzy): '{company}' -> matches:")
        for match in result.data:
            print(f"               - '{match['name']}'")
    else:
        print(f"NOT FOUND:     '{company}' - This is truly a new company!")

print("\nDone!")
