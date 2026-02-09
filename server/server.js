import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import * as pty from 'node-pty';
import { createClient } from '@supabase/supabase-js';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Terminal session storage
const terminals = new Map();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  });

  // Create WebSocket server
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '', true);

    if (pathname === '/api/socket/terminal') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (pathname?.startsWith('/_next/webpack-hmr')) {
      // Allow Next.js HMR WebSocket connections to pass through
      // Don't destroy the socket - let Next.js handle it
      return;
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (ws, request) => {
    console.log('[WS] Client connected to terminal');

    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      ws.send('Error: sessionId is required\\r\\n');
      ws.close();
      return;
    }

    try {
      // Resolve Container Info
      let containerName = '';
      let appName = '';
      let isLocal = false;

      if (dev && sessionId === 'local-dev-session') {
        isLocal = true;
        containerName = 'hermes-assessment';
      } else {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        const { data: session } = await supabase
          .from('interview_sessions')
          .select('container_url, container_status')
          .eq('session_id', sessionId)
          .single();

        if (!session || !session.container_url) {
          ws.send('Error: Session or container not found\\r\\n');
          ws.close();
          return;
        }

        if (session.container_url.includes('localhost')) {
          isLocal = true;
          containerName = 'hermes-assessment';
        } else {
          const u = new URL(session.container_url);
          appName = u.hostname.replace('.fly.dev', '');
        }
      }

      // Check if terminal session already exists
      let ptyProcess = terminals.get(sessionId);
      let isNewPty = false;

      if (!ptyProcess) {
        console.log('[WS] Creating new PTY session');
        isNewPty = true;

        let shell = 'bash';
        let args = [];

        if (isLocal) {
          shell = 'docker';
          args = ['exec', '-it', containerName, '/bin/bash'];
        } else {
          shell = 'flyctl';
          args = ['ssh', 'console', '-a', appName, '-C', '/bin/bash'];
        }

        console.log(`[WS] Spawning: ${shell} ${args.join(' ')}`);

        ptyProcess = pty.spawn(shell, args, {
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: process.env.HOME,
          env: process.env
        });

        terminals.set(sessionId, ptyProcess);

        ptyProcess.onExit(() => {
          console.log(`[WS] PTY exited for session ${sessionId}`);
          terminals.delete(sessionId);
        });
      } else {
        console.log('[WS] Reusing existing PTY session');
      }

      // Send welcome message
      if (isNewPty) {
        ws.send('\\r\\n\\x1b[32m✓ Connected to container\\x1b[0m\\r\\n');
      } else {
        ws.send('\\r\\n\\x1b[32m✓ Reconnected to existing session\\x1b[0m\\r\\n');
      }

      // Pipe PTY output to WebSocket
      const dataHandler = ptyProcess.onData((data) => {
        if (ws.readyState === 1) { // WebSocket.OPEN
          ws.send(data);
        }
      });

      // Pipe WebSocket input to PTY
      ws.on('message', (msg) => {
        try {
          const message = JSON.parse(msg.toString());
          if (message.type === 'input') {
            ptyProcess.write(message.data);
          } else if (message.type === 'resize') {
            ptyProcess.resize(message.cols, message.rows);
          }
        } catch (e) {
          console.error('[WS] Failed to parse message:', e);
        }
      });

      // Cleanup on disconnect
      ws.on('close', () => {
        console.log('[WS] Client disconnected, keeping PTY alive');
        dataHandler.dispose();
      });

    } catch (err) {
      console.error('[WS] Error:', err);
      ws.send(`\\r\\nError: ${err}\\r\\n`);
      ws.close();
    }
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
