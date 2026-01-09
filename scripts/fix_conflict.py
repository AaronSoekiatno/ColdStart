
import os

file_path = 'components/modals/OnboardingModal.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_conflict = False
conflict_start_line = 1322 # Adjust to 0-indexed close enough
# We will detect markers dynamically

for i, line in enumerate(lines):
    if '<<<<<<< HEAD' in line:
        # Check if this is the conflict we want (around line 1323)
        # Note: i is 0-indexed, so line 1323 is index 1322.
        if 1320 < i < 1340:
            in_conflict = True
            print(f"Found conflict start at line {i+1}")
            continue
    
    if '>>>>>>> beta01' in line:
        if in_conflict:
            in_conflict = False
            print(f"Found conflict end at line {i+1}")
            continue
    
    if not in_conflict:
        new_lines.append(line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Finished processing.")
