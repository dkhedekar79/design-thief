import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error - plain ESM module shared with the production server
import { analyzeUrl, AnalyzeError } from './server/analyze.mjs';
// @ts-expect-error - plain ESM module, Node-only DNS guard
import { verifyPublicHost } from './server/guard.mjs';

function apiPlugin(): Plugin {
  return {
    name: 'design-thief-api',
    configureServer(server) {
      server.middlewares.use('/api/analyze', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'Use POST.' }));
          return;
        }
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 20000) break;
        }
        let target = '';
        try {
          target = JSON.parse(raw || '{}').url ?? '';
        } catch {
          target = '';
        }
        try {
          const result = await analyzeUrl(target, { verifyHost: verifyPublicHost });
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.setHeader('cache-control', 'no-store');
          res.end(JSON.stringify(result));
        } catch (error) {
          const err = error as InstanceType<typeof AnalyzeError>;
          res.statusCode = err?.status ?? 500;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: err?.message ?? 'Could not read that site.' }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: false,
    // Extra hostnames (comma separated) for tunnelled previews; unset locally.
    allowedHosts: (process.env.ALLOWED_HOSTS ?? '')
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean),
  },
});
