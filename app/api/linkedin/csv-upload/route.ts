import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { parse } from 'csv-parse/sync';
import crypto from 'crypto';
import {
  getCandidate,
  createLinkedInImport,
  updateLinkedInImport,
  createFounderConnections,
  matchConnectionToCandidate,
  type FounderConnectionRow,
} from '@/lib/supabase';

interface LinkedInCSVRow {
  'First Name': string;
  'Last Name': string;
  'Email Address': string;
  'Company': string;
  'Position': string;
  'Connected On': string;
}

/**
 * Detect CSV delimiter by analyzing the first line
 */
function detectDelimiter(sample: string): string {
  const delimiters = [',', ';', '\t', '|'];
  const firstLine = sample.split('\n')[0];

  // Count occurrences of each delimiter
  const counts = delimiters.map(delimiter => ({
    delimiter,
    count: (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length,
  }));

  // Return the delimiter with the highest count (and at least 1 occurrence)
  const best = counts.reduce((prev, curr) =>
    curr.count > prev.count ? curr : prev
  );

  return best.count > 0 ? best.delimiter : ',';
}

/**
 * Parse LinkedIn CSV export format
 * CSV Structure: First Name, Last Name, Email Address, Company, Position, Connected On
 */
function parseLinkedInCSV(fileBuffer: Buffer): LinkedInCSVRow[] {
  try {
    // Convert buffer to string for delimiter detection
    const csvString = fileBuffer.toString('utf-8');
    const delimiter = detectDelimiter(csvString);

    console.log('Detected CSV delimiter:', delimiter === '\t' ? '\\t (tab)' : delimiter);

    const records = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // Handle UTF-8 BOM
      delimiter: delimiter,
      relax_column_count: true, // Allow inconsistent column counts
    }) as LinkedInCSVRow[];

    return records;
  } catch (error) {
    console.error('CSV parsing error:', error);
    throw new Error('Invalid CSV format. Please upload your LinkedIn connections CSV.');
  }
}

/**
 * Parse various date formats from LinkedIn
 */
function parseConnectedDate(dateStr: string): string | null {
  if (!dateStr) return null;

  try {
    // LinkedIn formats: "15 Oct 2023", "Oct 15, 2023", "10/15/2023"
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
  } catch {
    return null;
  }
}

/**
 * POST /api/linkedin/csv-upload
 * Upload and process LinkedIn connections CSV
 */
export async function POST(request: NextRequest) {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Get candidate info
    const candidate = await getCandidate(user.email);

    if (!candidate || !candidate.id) {
      return NextResponse.json(
        { error: 'Candidate profile not found.' },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded.' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a CSV file.' },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Calculate file hash to prevent duplicate uploads
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Check for duplicate uploads
    const { data: existingImports } = await supabase
      .from('linkedin_imports')
      .select('id')
      .eq('user_id', candidate.id)
      .eq('file_hash', fileHash)
      .limit(1);

    if (existingImports && existingImports.length > 0) {
      return NextResponse.json(
        { error: 'This file has already been uploaded.' },
        { status: 409 }
      );
    }

    // Parse CSV
    let rows: LinkedInCSVRow[];
    try {
      rows = parseLinkedInCSV(buffer);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to parse CSV' },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty or invalid.' },
        { status: 400 }
      );
    }

    // Create import record
    const linkedInImport = await createLinkedInImport({
      user_id: candidate.id,
      method: 'csv',
      status: 'processing',
      total_connections: rows.length,
      file_hash: fileHash,
    });

    // Process connections and match to candidates
    const connections: FounderConnectionRow[] = [];
    let matchedCount = 0;

    for (const row of rows) {
      const connection: FounderConnectionRow = {
        import_id: linkedInImport.id,
        user_id: candidate.id,
        first_name: row['First Name'],
        last_name: row['Last Name'],
        email: row['Email Address'] || undefined,
        company: row['Company'] || undefined,
        position: row['Position'] || undefined,
        connected_date: parseConnectedDate(row['Connected On']) || undefined,
      };

      // Try to match this connection to a candidate in Hermes DB
      const matchResult = await matchConnectionToCandidate({
        email: connection.email,
        first_name: connection.first_name,
        last_name: connection.last_name,
        company: connection.company,
        position: connection.position,
      });

      if (matchResult.candidate) {
        connection.matched_candidate_id = matchResult.candidate.id;
        connection.match_confidence = matchResult.confidence;
        connection.match_method = matchResult.method as 'email' | 'name_company' | 'name_school';
        matchedCount++;
      }

      connections.push(connection);
    }

    // Bulk insert all connections
    await createFounderConnections(connections);

    // Update import record with completion status
    await updateLinkedInImport(linkedInImport.id!, {
      status: 'complete',
      matched_connections: matchedCount,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      importId: linkedInImport.id,
      totalConnections: rows.length,
      matchedConnections: matchedCount,
      message: `Successfully imported ${rows.length} connections. Found ${matchedCount} matches in Hermes database.`,
    });
  } catch (error) {
    console.error('Error processing LinkedIn CSV upload:', error);
    return NextResponse.json(
      {
        error: 'Failed to process CSV upload',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
