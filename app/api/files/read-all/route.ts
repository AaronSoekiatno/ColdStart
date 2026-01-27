
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { execInContainer } from '@/lib/container-orchestration/exec-command';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes for reading all files (can be slow)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Authenticate
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get container URL
    let session;
    if (process.env.NODE_ENV === 'development' && sessionId === 'local-dev-session') {
      session = { container_url: 'http://localhost:8080' };
    } else {
      const { data: dbSession } = await supabase
        .from('interview_sessions')
        .select('container_url')
        .eq('session_id', sessionId)
        .single();
      session = dbSession;
    }

    if (!session || !session.container_url) {
      return NextResponse.json({ error: 'Container not found' }, { status: 404 });
    }

    console.log(`[API files/read-all] Fetching all files for session ${sessionId}`);

    // Script to read all files as JSON
     const script = `
const fs = require('fs');
const path = require('path');
const root = '/workspace';

function getAllFiles(dir, fileList = []) {
  try {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      // Skip unwanted directories
      if (file === 'node_modules' || file === '.git' || file === '.next' || file === '.vite' || file === '.vitest-cache') return;
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        getAllFiles(filePath, fileList);
      } else {
        fileList.push(filePath);
      }
    });
  } catch(e) {}
  return fileList;
}

try {
  const files = getAllFiles(root);
  const result = {};
  files.forEach(f => {
    try {
        const relative = path.relative(root, f);
        // Skip huge files > 500KB to prevent payload explosion
        if (fs.statSync(f).size < 500000) {
             result[relative] = fs.readFileSync(f, 'utf8');
        }
    } catch(e) {}
  });
  console.log('JSON_START');
  console.log(JSON.stringify(result));
  console.log('JSON_END');
} catch(e) {
  console.error(e);
}
`;
    // Base64 encode the script to avoid shell escaping issues
    const base64Script = Buffer.from(script).toString('base64');
    const command = `node -e "eval(Buffer.from('${base64Script}', 'base64').toString())"`;

    const { stdout, stderr } = await execInContainer(sessionId, session.container_url, command);

    if (stderr && !stderr.includes('Debugger attached')) {
       // Only warn, don't fail, as node might print non-fatal things to stderr
      console.warn(`[API files/read-all] Container stderr: ${stderr}`);
    }

    const jsonStr = stdout.split('JSON_START')[1]?.split('JSON_END')[0];

    if (!jsonStr) {
        console.error('[API files/read-all] Failed to parse output', stdout);
        return NextResponse.json({ error: 'Failed to parse file content output' }, { status: 500 });
    }

    const files = JSON.parse(jsonStr);
    const fileCount = Object.keys(files).length;
    console.log(`[API files/read-all] Successfully read ${fileCount} files`);

    return NextResponse.json({ files });

  } catch (error: any) {
    console.error('[API files/read-all] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
