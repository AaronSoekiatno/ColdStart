import { NextRequest, NextResponse } from 'next/server';
import { writeWorkspaceFile } from '@/lib/workspace/file-access';

export async function POST(request: NextRequest) {
    try {
        const { flyAppName, path, content } = await request.json();
        
        if (!flyAppName || !path) {
             return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        // Ensure content is a string
        const contentStr = typeof content === 'string' ? content : '';

        const result = await writeWorkspaceFile(flyAppName, { path: path, content: contentStr });
        return NextResponse.json({ result });
    } catch (error: any) {
        console.error('Error in undo:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
