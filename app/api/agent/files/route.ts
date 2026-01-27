import { NextRequest, NextResponse } from 'next/server';
import { listWorkspaceDirectory, runWorkspaceCommand } from '@/lib/workspace/file-access';

export async function POST(request: NextRequest) {
    try {
        const { flyAppName } = await request.json();
        
        if (!flyAppName) {
             return NextResponse.json({ error: 'Missing flyAppName' }, { status: 400 });
        }

        // Use `find` to get a recursive list of files efficiently
        // Exclude .git and node_modules to keep the list manageable and relevant
        const findCommand = `find . -type f -not -path '*/.*' -not -path '*/node_modules/*' | head -n 1000`;
        
        // We use runWorkspaceCommand which executes in /workspace
        const output = await runWorkspaceCommand(flyAppName, { command: findCommand });
        
        const files = output.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.includes('Command executed successfully') && !line.includes('No such file'));
            
        // Clean up paths (remove ./ prefix if present)
        const cleanFiles = files.map(f => f.startsWith('./') ? f.substring(2) : f);

        return NextResponse.json({ files: cleanFiles });
    } catch (error: any) {
        console.error('Error listing files:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
