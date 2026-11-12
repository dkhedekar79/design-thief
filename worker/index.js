import { AnalyzeError, analyzeUrl } from '../server/analyze.mjs';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/analyze') {
      if (request.method !== 'POST') return json(405, { error: 'Use POST.' });
      let target = '';
      try {
        target = (await request.json()).url ?? '';
      } catch {
        target = '';
      }
      try {
        return json(200, await analyzeUrl(target));
      } catch (error) {
        const known = error instanceof AnalyzeError;
        return json(known ? error.status : 500, {
          error: known ? error.message : 'Could not read that site. Try another address.',
        });
      }
    }

    if (url.pathname.startsWith('/api/')) return json(404, { error: 'Unknown endpoint.' });

    // Serve the built SPA, falling back to index.html for client-side routes.
    const assets = env?.ASSETS;
    if (!assets) return new Response('Not found', { status: 404 });
    const assetResponse = await assets.fetch(request);
    if (assetResponse.status !== 404) return assetResponse;
    return assets.fetch(new Request(new URL('/', url).toString(), request));
  },
};
