import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function antigravityTerminalLogger() {
  return {
    name: 'antigravity-terminal-logger',
    configureServer(server) {
      server.middlewares.use('/__terminal_log', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              const level = String(payload.level || 'INFO').toUpperCase();
              const source = payload.source || 'Browser';
              const time = payload.time || new Date().toLocaleTimeString();

              const color =
                level === 'ERROR'
                  ? '\x1b[31m' // Red
                  : level === 'WARN'
                  ? '\x1b[33m' // Yellow
                  : '\x1b[36m'; // Cyan
              const reset = '\x1b[0m';

              console.log(
                `\n${color}[ANTIGRAVITY-${level}] [${time}] [${source}]${reset} ${payload.message}`
              );
              if (payload.details) {
                console.log(`${color}${payload.details}${reset}`);
              }
            } catch (err) {
              console.log('\x1b[31m[ANTIGRAVITY-LOG-RAW]\x1b[0m', body);
            }
            res.statusCode = 204;
            res.end();
          });
          return;
        }
        res.statusCode = 405;
        res.end();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), antigravityTerminalLogger()],
});
