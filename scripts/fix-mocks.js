import fs from 'fs';

const filePath = '/Users/aidannguyen/Downloads/Hermes/tests/unit/lib/supabase-save-candidate.test.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix the mock definitions and move implementation to beforeEach
// We'll keep the hoisted variables but set their implementation in beforeEach for reliability

// 2. Identify the calls that should be mockSingleForGet vs mockSingleForUpsert
// Pattern: mockSingleForUpsert.mockResolvedValueOnce(...) where the data is null or has existing data but NO id
// or it's clearly for getCandidate.

// Let's just do a smarter replacement.
// In saveCandidate:
// 第1次 call (getCandidate) -> mockSingleForGet
// 第2次 call (upsert().select().single()) -> mockSingleForUpsert

content = content.replace(/mockSingleForUpsert\.mockResolvedValueOnce/g, 'mockSingle_MOCK');

// We will manually fix some of these.
// Actually, I'll just rewrite the file's mocking section and the first few tests to be sure.

// Better: use a stateful approach in the mock itself?
// No, let's just use the two mocks I created.

// I'll rewrite the beforeEach to properly set up the implementation every time.

content = content.replace(/beforeEach\(\(\) => \{[\s\S]*?\}\);/m, `beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockImplementation((table) => {
      return {
        upsert: mockUpsert,
        select: mockSelect,
        eq: mockEq,
      };
    });

    mockUpsert.mockReturnValue({
      select: mockSelect
    });

    mockSelect.mockImplementation(() => ({
      single: mockSingleForUpsert,
      eq: mockEq
    }));

    mockEq.mockImplementation(() => ({
      single: mockSingleForGet,
      eq: mockEq
    }));

    // Setup default successful responses
    mockSingleForUpsert.mockResolvedValue({
      data: mockCandidate(),
      error: null
    });

    mockSingleForGet.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' }
    });
  });`);

fs.writeFileSync(filePath, content);
