"""
Test fuzzy matching to ensure no duplicates are created.

This tests that variations of company names all match the same company.
"""
import re


def normalize_company_name(company_name: str) -> str:
    """
    Normalize company name for fuzzy matching.
    (Copied from scrape_workatastartup_directory.py)
    """
    if not company_name:
        return ""

    # Convert to lowercase
    normalized = company_name.lower().strip()

    # Remove common suffixes that might differ
    suffixes_to_remove = [', inc.', ' inc.', ', inc', ' inc',
                          ', llc', ' llc', ', corp', ' corp',
                          ', ltd', ' ltd', ' corporation']
    for suffix in suffixes_to_remove:
        if normalized.endswith(suffix):
            normalized = normalized[:-len(suffix)]
            break

    # Remove all non-alphanumeric characters (punctuation, spaces, etc.)
    normalized = re.sub(r'[^a-z0-9]', '', normalized)

    return normalized


def test_normalizations():
    """Test that different name variations normalize to the same value."""

    test_cases = [
        # (input, expected_normalized, description)
        ("OpenAI", "openai", "Simple lowercase"),
        ("openai", "openai", "Already lowercase"),
        ("Open AI", "openai", "With space"),
        ("OpenAI Inc", "openai", "With Inc suffix"),
        ("OpenAI, Inc.", "openai", "With Inc. suffix"),
        ("OpenAI Inc.", "openai", "With Inc. suffix no comma"),

        ("Hera", "hera", "Simple name"),
        ("Hera Video", "hera", "With Video suffix (should be removed)"),
        ("HeraVideo", "hera", "Video concatenated"),

        ("Kapa.ai", "kapa", "With .ai domain"),
        ("Kapa AI", "kapa", "With AI suffix"),
        ("KapaAI", "kapa", "AI concatenated"),

        ("Alex.com", "alex", "With .com domain"),
        ("Alex Com", "alex", "With Com suffix"),
        ("AlexCom", "alex", "Com concatenated"),

        ("FirstIgnite", "firstignite", "CamelCase"),
        ("Firstignite", "firstignite", "Different casing"),
        ("First Ignite", "firstignite", "With space"),

        ("X-Pay", "xpay", "With hyphen"),
        ("XPay", "xpay", "No hyphen"),
        ("X Pay", "xpay", "With space"),

        ("Acme Corp", "acme", "With Corp suffix"),
        ("Acme Corporation", "acme", "With Corporation suffix"),
        ("Acme, Inc.", "acme", "With Inc suffix"),
        ("Acme LLC", "acme", "With LLC suffix"),
        ("ACME", "acme", "All caps"),
    ]

    print("="*80)
    print("FUZZY MATCHING TEST - Name Normalization")
    print("="*80)

    passed = 0
    failed = 0

    for input_name, expected, description in test_cases:
        result = normalize_company_name(input_name)
        status = " PASS" if result == expected else " FAIL"

        if result == expected:
            passed += 1
        else:
            failed += 1

        print(f"\n{status} - {description}")
        print(f"  Input:    '{input_name}'")
        print(f"  Expected: '{expected}'")
        print(f"  Got:      '{result}'")

    print(f"\n{'='*80}")
    print(f"Results: {passed} passed, {failed} failed")
    print(f"{'='*80}")

    return failed == 0


def test_duplicate_detection():
    """Test that variations would be detected as the same company."""

    print(f"\n{'='*80}")
    print("DUPLICATE DETECTION TEST")
    print("="*80)

    # These groups should all normalize to the same value (no duplicates)
    duplicate_groups = [
        ["OpenAI", "openai", "Open AI", "OpenAI Inc", "OpenAI, Inc."],
        ["Hera", "Hera Video", "HeraVideo"],
        ["Kapa.ai", "Kapa AI", "KapaAI", "Kapa"],
        ["FirstIgnite", "Firstignite", "First Ignite"],
        ["Acme", "Acme Inc", "Acme Corp", "ACME", "Acme LLC"],
    ]

    all_passed = True

    for group in duplicate_groups:
        print(f"\n Testing group: {group}")

        # Normalize all names in the group
        normalized = [normalize_company_name(name) for name in group]

        # Check if all normalized to the same value
        unique_normalized = set(normalized)

        if len(unique_normalized) == 1:
            print(f"    PASS - All normalize to: '{normalized[0]}'")
        else:
            print(f"    FAIL - Multiple normalized values: {unique_normalized}")
            all_passed = False

            # Show which ones differ
            for i, name in enumerate(group):
                print(f"      '{name}' → '{normalized[i]}'")

    print(f"\n{'='*80}")
    if all_passed:
        print(" ALL TESTS PASSED - No duplicates would be created")
    else:
        print(" SOME TESTS FAILED - Duplicates might be created!")
    print(f"{'='*80}")

    return all_passed


def test_core_matching():
    """Test core name matching (suffix removal)."""

    print(f"\n{'='*80}")
    print("CORE NAME MATCHING TEST")
    print("="*80)
    print("\nTests removal of common suffixes like 'video', 'ai', 'com', etc.")

    test_cases = [
        # (name_with_suffix, name_without_suffix, should_match)
        ("Hera Video", "Hera", True),
        ("Kapa AI", "Kapa.ai", True),
        ("Alex Com", "Alex.com", True),
        ("Finto De", "Finto.de", True),
        ("TryCardinal", "Cardinal", True),  # "Try" should match core
        ("Blink New", "Blink", True),
        ("Different Company", "Another Startup", False),
    ]

    passed = 0
    failed = 0

    for name1, name2, should_match in test_cases:
        # Normalize both
        norm1 = normalize_company_name(name1)
        norm2 = normalize_company_name(name2)

        # Get core (remove suffixes)
        suffixes = ['video', 'com', 'app', 'ai', 'inc', 'new', 'io', 'tech', 'de', 'try']
        core1 = norm1
        core2 = norm2

        for suffix in suffixes:
            core1 = core1.replace(suffix, '')
            core2 = core2.replace(suffix, '')

        core1 = core1.strip()
        core2 = core2.strip()

        matches = (core1 == core2 and core1)  # Match if cores are equal and not empty

        status = " PASS" if matches == should_match else " FAIL"

        if matches == should_match:
            passed += 1
        else:
            failed += 1

        print(f"\n{status}")
        print(f"  '{name1}' vs '{name2}'")
        print(f"  Normalized: '{norm1}' vs '{norm2}'")
        print(f"  Core: '{core1}' vs '{core2}'")
        print(f"  Expected match: {should_match}, Got: {matches}")

    print(f"\n{'='*80}")
    print(f"Results: {passed} passed, {failed} failed")
    print(f"{'='*80}")

    return failed == 0


if __name__ == "__main__":
    print("\nRunning Fuzzy Matching Tests\n")

    test1 = test_normalizations()
    test2 = test_duplicate_detection()
    test3 = test_core_matching()

    print(f"\n{'='*80}")
    print("FINAL RESULTS")
    print(f"{'='*80}")

    if test1 and test2 and test3:
        print(" ALL TESTS PASSED!")
        print("\nFuzzy matching is working correctly.")
        print("Duplicates should be prevented.")
    else:
        print(" SOME TESTS FAILED")
        print("\nFuzzy matching needs improvement.")
        print("Duplicates might be created.")

    print(f"{'='*80}\n")
