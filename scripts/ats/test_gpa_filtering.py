"""
Test script for GPA and Major filtering functionality
"""

from atsFilter import ATSFilter

def test_gpa_extraction():
    """Test GPA extraction from various formats"""
    filter = ATSFilter()
    
    print("=" * 50)
    print("Testing GPA Extraction")
    print("=" * 50)
    
    # Test cases for GPA parsing
    test_cases = [
        ("GPA: 3.8", 3.8),
        ("3.7/4.0", 3.7),
        ("GPA 3.9 out of 4.0", 3.9),
        ("No GPA here", None),
    ]
    
    for text, expected in test_cases:
        result = filter._extract_gpa_from_text(text)
        status = "✓" if result == expected else "✗"
        print(f"{status} '{text}' → {result} (expected: {expected})")
    
    print()

def test_major_extraction():
    """Test major extraction from resume text"""
    filter = ATSFilter()
    
    print("=" * 50)
    print("Testing Major Extraction")
    print("=" * 50)
    
    test_cases = [
        ("Bachelor of Science in Computer Science", ["computer science"]),
        ("B.S. in Electrical Engineering", ["electrical engineering"]),
        ("Major: Mathematics", ["mathematics"]),
    ]
    
    for text, expected in test_cases:
        result = filter._extract_major_from_text(text)
        # Check if any expected major is in result
        matches = any(exp in (result or []) for exp in expected)
        status = "✓" if matches or (not result and not expected) else "✗"
        print(f"{status} '{text}' → {result}")
    
    print()

def test_major_requirement_parsing():
    """Test major requirement extraction from job descriptions"""
    filter = ATSFilter()
    
    print("=" * 50)
    print("Testing Major Requirement Parsing")
    print("=" * 50)
    
    test_cases = [
        "Bachelor's degree in Computer Science or Engineering required",
        "CS degree required",
        "Major in Electrical Engineering preferred",
        "No major requirements",
    ]
    
    for text in test_cases:
        result = filter.extract_major_requirements(text)
        print(f"'{text}' → {result}")
    
    print()

def test_major_matching():
    """Test major matching with fuzzy logic"""
    filter = ATSFilter()
    
    print("=" * 50)
    print("Testing Major Matching (Fuzzy)")
    print("=" * 50)
    
    test_cases = [
        (["computer science"], ["cs"], True, "CS abbreviation matches Computer Science"),
        (["electrical engineering"], ["ee"], True, "EE matches Electrical Engineering"),
        (["computer science"], ["biology"], False, "CS does not match Biology"),
        (["cs", "math"], ["computer science"], True, "Multiple majors, one matches"),
    ]
    
    for cand_majors, req_majors, expected_pass, description in test_cases:
        result = filter.check_major_requirement(cand_majors, req_majors)
        meets = result["meets_requirement"]
        status = "✓" if meets == expected_pass else "✗"
        print(f"{status} {description}: {meets}")
        if not meets and result.get("reason"):
            print(f"     Reason: {result['reason']}")
    
    print()

def test_gpa_checking():
    """Test GPA requirement checking logic"""
    filter = ATSFilter()
    
    print("=" * 50)
    print("Testing GPA Requirement Checking")
    print("=" * 50)
    
    test_cases = [
        (3.8, 3.5, True,  "Candidate GPA 3.8 >= Required 3.5"),
        (3.2, 3.5, False, "Candidate GPA 3.2 < Required 3.5"),
        (None, 3.5, False, "No candidate GPA but required 3.5"),
        (3.7, None, True,  "No requirement"),
    ]
    
    for cand_gpa, req_gpa, expected_pass, description in test_cases:
        result = filter.check_gpa_requirement(cand_gpa, req_gpa)
        meets = result["meets_requirement"]
        status = "✓" if meets == expected_pass else "✗"
        reason = result.get("reason", "Passed")
        print(f"{status} {description}: {meets} - {reason}")
    
    print()

if __name__ == "__main__":
    print("\n" + "="*50)
    print("EDUCATION FILTERING TEST SUITE (GPA + Major)")
    print("="*50 + "\n")
    
    try:
        test_gpa_extraction()
        test_gpa_checking()
        test_major_extraction()
        test_major_requirement_parsing()
        test_major_matching()
        
        print("="*50)
        print("✓ All tests completed!")
        print("="*50)
        
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
