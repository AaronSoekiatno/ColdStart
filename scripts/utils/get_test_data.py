import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv('../.env.local')

supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(supabase_url, supabase_key)

print("=== Getting Test Data ===\n")

# Get a candidate with role_type
print("1. Finding a candidate with role_type...")
candidates = supabase.table("candidates").select("id, email, role_type").limit(5).execute()

if candidates.data:
    for c in candidates.data:
        print(f"   Candidate ID: {c['id']}")
        print(f"   Email: {c['email']}")
        print(f"   Role Types: {c.get('role_type', 'None')}")
        print()
else:
    print("   No candidates found!")

# Get some jobs with titles
print("\n2. Finding jobs with titles...")
jobs = supabase.table("jobs").select("id, job_title, full_description").limit(3).execute()

if jobs.data:
    for j in jobs.data:
        print(f"   Job ID: {j['id']}")
        print(f"   Title: {j['job_title']}")
        print(f"   Description (first 100 chars): {j.get('full_description', '')[:100]}...")
        print()
else:
    print("   No jobs found!")

# Check if candidate has a resume
if candidates.data:
    candidate_id = candidates.data[0]['id']
    print(f"\n3. Checking if candidate {candidate_id} has a resume...")
    resumes = supabase.table("resumes").select("id, resume_full_text").eq("candidate_id", candidate_id).eq("is_active", True).execute()
    
    if resumes.data:
        print(f"   ✓ Found {len(resumes.data)} resume(s)")
        print(f"   Resume text length: {len(resumes.data[0].get('resume_full_text', ''))} characters")
    else:
        print("   ✗ No resume found for this candidate")
