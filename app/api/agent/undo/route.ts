import { NextRequest, NextResponse } from 'next/server';
import { readWorkspaceFile, writeWorkspaceFile } from '@/lib/workspace/file-access';
import * as Diff from 'diff';

export async function POST(request: NextRequest) {
    try {
        const { flyAppName, path, diff } = await request.json();
        
        if (!flyAppName || !path || !diff) {
             return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Read current file content
        const currentContent = await readWorkspaceFile(flyAppName, { path });

        // 2. Parse the patch
        const patches = Diff.parsePatch(diff);
        if (patches.length === 0) {
            throw new Error('Invalid diff format');
        }
        const patch = patches[0];

        // 3. Reverse the patch (New -> Old)
        // Swap file names
        const temp = patch.oldFileName;
        patch.oldFileName = patch.newFileName;
        patch.newFileName = temp;

        // Process hunks
        for (const hunk of patch.hunks) {
            // Swap ranges
            const tempStart = hunk.oldStart;
            const tempLines = hunk.oldLines;
            hunk.oldStart = hunk.newStart;
            hunk.oldLines = hunk.newLines;
            hunk.newStart = tempStart;
            hunk.newLines = tempLines; // Note: hunk.oldLines is number of lines

            // Swap lines
            hunk.lines = hunk.lines.map(line => {
                if (line.startsWith('+')) return '-' + line.substring(1);
                if (line.startsWith('-')) return '+' + line.substring(1);
                return line;
            });
        }

        // 4. Apply the reversed patch
        const revertedContent = Diff.applyPatch(currentContent, patch);

        if (revertedContent === false) {
             throw new Error('Cannot undo change: File has been modified subsequently and context does not match.');
        }

        // 5. Write back
        const result = await writeWorkspaceFile(flyAppName, { path, content: revertedContent });
        return NextResponse.json({ result: 'Successfully reverted changes based on patch.' });

    } catch (error: any) {
        console.error('Error in undo:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
