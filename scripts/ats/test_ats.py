import requests
import json

# API base URL
BASE_URL = "http://localhost:8000"

print("=== Testing ATS Filter API ===\n")

# Test data from your database
CANDIDATE_ID = "16050c25-1ae8-4eee-8317-d427f5ff231e"  # PM role type
CANDIDATE_ROLE_TYPES = ["PM"]

# Test 1: Extract keywords from sample text
print("TEST 1: Keyword Extraction")
print("-" * 50)
test_text = "Looking for a Senior Product Manager with experience in AI/ML products, user research, and agile development"
response = requests.post(
    f"{BASE_URL}/api/extract-keywords",
    json={"text": test_text}
)
print(f"Input: {test_text}")
print(f"Extracted Keywords: {response.json()['keywords']}")
print(f"Keyword Count: {response.json()['keyword_count']}\n")

# Test 2: Single job filtering WITH job title (tests both keyword + title matching)
print("TEST 2: Single Job Filter (Keyword + Job Title Matching)")
print("-" * 50)
job_requirements = """
We're looking for a Senior Product Manager to lead our AI products team.
You'll work on defining product strategy, conducting user research, and 
collaborating with engineering teams. Experience with machine learning 
products and agile methodologies required.
"""
job_title = "Senior Product Manager"  # Should match well with PM role type

response = requests.post(
    f"{BASE_URL}/api/filter-job",
    json={
        "candidate_id": CANDIDATE_ID,
        "job_requirements": job_requirements.strip(),
        "job_title": job_title
    }
)

result = response.json()
print(f"Job Title: {job_title}")
print(f"Candidate Role Types: {CANDIDATE_ROLE_TYPES}")
print(f"\nResults:")
print(f"  Keyword Match: {result['keyword_match_percentage']}%")
print(f"  Job Title Similarity: {result['job_title_similarity']}%")
print(f"  Combined Score: {result['combined_score']}%")
print(f"  Matching Keywords: {result['matching_keywords'][:10]}...")  # First 10
print(f"  Total Matching: {result['matching_count']}/{result['total_job_keywords']}")
print()

# Test 3: Test job title similarity with different titles
print("TEST 3: Job Title Similarity Tests")
print("-" * 50)
test_titles = [
    ("Product Manager", "Should be HIGH similarity (~90%)"),
    ("Senior PM", "Should be HIGH similarity (~85%)"),
    ("Software Engineer", "Should be LOW similarity (~20%)"),
    ("Backend Engineer", "Should be LOW similarity (~15%)"),
    ("Product Designer", "Should be MEDIUM similarity (~40%)"),
]

for title, expected in test_titles:
    response = requests.post(
        f"{BASE_URL}/api/filter-job",
        json={
            "candidate_id": CANDIDATE_ID,
            "job_requirements": "Sample job description",
            "job_title": title
        }
    )
    result = response.json()
    print(f"  '{title}' → {result['job_title_similarity']}% ({expected})")

print()

# Test 4: Batch filtering (real-world scenario)
print("TEST 4: Batch Job Filtering")
print("-" * 50)
jobs = [
    {
        "id": "job-1",
        "requirements": "Senior Product Manager for B2B SaaS platform. Lead product strategy and roadmap.",
        "job_title": "Senior Product Manager"
    },
    {
        "id": "job-2",
        "requirements": "Backend Engineer needed. Python, Django, PostgreSQL experience required.",
        "job_title": "Backend Software Engineer"
    },
    {
        "id": "job-3",
        "requirements": "Product Manager for AI/ML products. Work with data scientists and engineers.",
        "job_title": "AI Product Manager"
    }
]

response = requests.post(
    f"{BASE_URL}/api/filter-jobs-batch",
    json={
        "candidate_id": CANDIDATE_ID,
        "jobs": jobs
    }
)

results = response.json()['results']
print(f"Tested {len(results)} jobs, sorted by combined score:\n")
for i, job in enumerate(results, 1):
    print(f"{i}. Job ID: {job['job_id']}")
    print(f"   Keyword Match: {job['keyword_match_percentage']}%")
    print(f"   Title Similarity: {job['job_title_similarity']}%")
    print(f"   Combined Score: {job['combined_score']}%")
    print()

# Test 5: Verify weighted scoring calculation
print("TEST 5: Verify Weighted Scoring (70% keywords, 30% title)")
print("-" * 50)
response = requests.post(
    f"{BASE_URL}/api/filter-job",
    json={
        "candidate_id": CANDIDATE_ID,
        "job_requirements": "Product Manager with agile experience",
        "job_title": "Product Manager"
    }
)
result = response.json()
keyword_pct = result['keyword_match_percentage']
title_pct = result['job_title_similarity']
combined = result['combined_score']
expected_combined = round((keyword_pct * 0.7) + (title_pct * 0.3), 2)

print(f"Keyword Match: {keyword_pct}%")
print(f"Title Similarity: {title_pct}%")
print(f"Combined Score: {combined}%")
print(f"Expected: ({keyword_pct} * 0.7) + ({title_pct} * 0.3) = {expected_combined}%")
print(f"✓ Calculation is {'CORRECT' if combined == expected_combined else 'INCORRECT'}!")

print("\n" + "=" * 50)
print("All tests completed!")
