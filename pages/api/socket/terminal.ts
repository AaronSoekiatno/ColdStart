import type { NextApiRequest, NextApiResponse } from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import * as pty from 'node-pty';
import { createClient } from '@supabase/supabase-js';

// Prevent Next.js from handling the request body so we can handle the upgrade
export const config = {
  api: {
    bodyParser: false,
  },
};

// Global map to store active terminals to prevent garbage collection
// session_id -> ptyProcess
const terminals = new Map<string, pty.IPty>();

export default async function handler(req: NextApiRequest, res: any) {
  if (!res.socket.server.ws) {
    console.log('[API socket/terminal] Initializing WebSocket Server...');
    
    // Create WebSocket Server attached to the HTTP server
    const wss = new WebSocketServer({ noServer: true });
    
    res.socket.server.ws = wss;

    // Handle upgrades manually
    res.socket.server.on('upgrade', (request: any, socket: any, head: any) => {
      if (request.url?.startsWith('/api/socket/terminal')) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    });

    wss.on('connection', async (ws: WebSocket, request: any) => {
      console.log('[API socket/terminal] Client connected');

      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        ws.send('Error: sessionId is required\r\n');
        ws.close();
        return;
      }

      // Authenticate / Resolve Container
      // Note: In a real prod environment, we should validate cookies here. 
      // For MVP/Dev, we'll trust the sessionId lookup logic which mimics our other routes.

      try {
        // 1. Resolve Container Info
        let containerName = ''; // For Docker
        let appName = '';      // For Fly.io
        let isLocal = false;

        if (process.env.NODE_ENV === 'development' && sessionId === 'local-dev-session') {
           // Local Development Fallback
           // Try to find a running assessment container
           // We can't access `exec` easily here without importing it, so we'll duplicate simple logic or rely on a known name for now.
           // Ideally, we'd use the `execInContainer` logic, but `node-pty` needs a command string, not a promise.
           
           isLocal = true;
           containerName = 'hermes-assessment'; // Default/Predictable name for local dev
        } else {
            // Lookup in Supabase
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const { data: session } = await supabase
                .from('interview_sessions')
                .select('container_url, container_status')
                .eq('session_id', sessionId)
                .single();

            if (!session || !session.container_url) {
                ws.send('Error: Session or container not found\r\n');
                ws.close();
                return;
            }

            if (session.container_url.includes('localhost')) {
                isLocal = true;
                // Try to infer docker name or just use a generic strategy
                // For now, assume if it's localhost, we are in a hybrid mode where we want to attach to a local docker container
                containerName = 'hermes-assessment'; 
            } else {
                // Fly.io
                const u = new URL(session.container_url);
                appName = u.hostname.replace('.fly.dev', '');
            }
        }

        // 2. Define the Command to Spawn
        let shell = 'bash';
        let args: string[] = [];

        if (isLocal) {
            // Local Docker Exec
            // We use 'docker exec -it <name> bash'
            // node-pty will handle the TTY part, so we might not need -t, but -i is good.
            shell = 'docker';
            // Try to find the actual container ID if the name is ambiguous? 
            // For simplicity, we assume 'hermes-assessment-...' or just try the name found.
            // Let's rely on `docker ps` to find it dynamically if possible, but that's async.
            // For this implementation, we'll assume the container is named or reachable via `docker exec`.
            // A safer bet locally is to spawn a shell that *then* runs docker exec.
             args = ['exec', '-it', containerName, '/bin/bash'];
             
             // Check if we need to find the container name dynamically
             // We'll trust the variable for now.
        } else {
            // Remote Fly.io SSH
            // We use `flyctl ssh console`
            shell = 'flyctl';
            args = ['ssh', 'console', '-a', appName, '-C', '/bin/bash'];
        }

        console.log(`[API socket/terminal] Spawning: ${shell} ${args.join(' ')}`);

        // 3. Spawn PTY
        const ptyProcess = pty.spawn(shell, args, {
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: process.env.HOME,
          env: process.env as any
        });

        // 4. Pipe PTY -> WebSocket
        ptyProcess.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });

        // 5. Pipe WebSocket -> PTY
        ws.on('message', (msg) => {
            try {
                const message = JSON.parse(msg.toString());
                if (message.type === 'input') {
                    ptyProcess.write(message.data);
                } else if (message.type === 'resize') {
                    ptyProcess.resize(message.cols, message.rows);
                }
            } catch (e) {
                // Determine if it's raw text or JSON (backward compatibility)
                // If parsing fails, treat as raw input? No, our protocol is strictly JSON for meta-events.
                console.error('Failed to parse WS message:', e);
            }
        });

        // Cleanup on disconnect
        ws.on('close', () => {
            console.log('[API socket/terminal] Client disconnected, killing PTY');
            ptyProcess.kill();
        });

      } catch (err) {
        console.error('[API socket/terminal] Error:', err);
        ws.send(`\r\nError: ${err}\r\n`);
        ws.close();
      }
    });
  }
  
  res.end();
}
