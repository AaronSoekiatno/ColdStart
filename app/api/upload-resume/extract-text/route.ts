import { NextRequest, NextResponse } from 'next/server';
import { extractDocxText } from '../utils';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Only process DOCX files
    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                   file.name.toLowerCase().endsWith('.docx');

    if (!isDocx) {
      return NextResponse.json(
        { error: 'File must be a DOCX file' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text
    const text = await extractDocxText(buffer);

    return NextResponse.json({
      text: text || '',
    });
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    return NextResponse.json(
      {
        error: 'Failed to extract text from DOCX file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

