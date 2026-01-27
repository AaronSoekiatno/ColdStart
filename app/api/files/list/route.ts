import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { execInContainer } from '@/lib/container-orchestration/exec-command';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 1 minute for container operations

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

    // Execute find command to list all files recursively in /workspace, excluding node_modules and .git
    // We handle prefix stripping in JS to avoid shell pipe/quote escaping issues
    const command = "find /workspace -maxdepth 10 -not -path '*/.*' -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/.vitest-cache/*' -print";
    console.log(`[API files/list] Executing in container for session ${sessionId}: ${command}`);
    
    const { stdout, stderr } = await execInContainer(sessionId, session.container_url, command);

    if (stderr) {
      console.warn(`[API files/list] Container stderr: ${stderr}`);
    }

    // Clean up valid output first, then split
    // Handle potential \r\n from TTY or other weirdness
    const files = stdout
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter(Boolean)
        .map(line => {
            // Remove /workspace prefix and any leading/trailing whitespace
            let cleaned = line.trim();
            if (cleaned.startsWith('/workspace/')) {
                cleaned = cleaned.substring(11);
            } else if (cleaned === '/workspace') {
                return '';
            }
            return cleaned;
        })
        .filter(f => f && f !== '/workspace'); // Final filter for empty or root strings
    console.log(`[API files/list] Found ${files.length} files`);
    console.log('[API files/list] First 10 files:', files.slice(0, 10));
    
    // Transform flat list to tree
    const rootNodes: any[] = [];
    const map: Record<string, any> = {};

    files.forEach(path => {
      const parts = path.split('/');
      let currentPath = '';

      parts.forEach((part, index) => {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!map[currentPath]) {
          const isFolder = index < parts.length - 1 || path.endsWith('/') || !part.includes('.');
          const node = {
            id: currentPath,
            name: part,
            isFolder: isFolder,
            children: isFolder ? [] : undefined
          };
          map[currentPath] = node;

          if (parentPath) {
            if (!map[parentPath].children) map[parentPath].children = [];
            map[parentPath].children.push(node);
          } else {
            rootNodes.push(node);
          }
        }
      });
    });

    // Sort function: Folders first, then alphabetical
    const sortNodes = (nodes: any[]) => {
      nodes.sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach(node => {
        if (node.children) {
          sortNodes(node.children);
        }
      });
    };

    sortNodes(rootNodes);

    console.log(`[API files/list] Built tree with ${rootNodes.length} root nodes`);
    return NextResponse.json({ files: rootNodes });
  } catch (error: any) {
    console.error('[API files/list] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
