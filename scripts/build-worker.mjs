import { build } from 'esbuild';

await build({
  entryPoints: ['worker/index.js'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  outfile: 'worker-dist/worker.js',
  legalComments: 'none',
  logLevel: 'info',
});
