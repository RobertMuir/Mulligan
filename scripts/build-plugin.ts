// Bundles the MCP server and the CLI into self-contained files under dist/,
// so the plugin runs with nothing but Node installed.
import { chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const entries = [
  { in: 'packages/mcp/src/main.ts', out: 'dist/mcp-server.mjs' },
  { in: 'packages/bot/src/terminal/main.ts', out: 'dist/Mulligan.mjs' },
];

for (const entry of entries) {
  await build({
    entryPoints: [path.join(root, entry.in)],
    outfile: path.join(root, entry.out),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    minify: true,
    legalComments: 'none',
    // Bundled CommonJS dependencies (the TypeScript compiler) expect require, __filename and __dirname.
    banner: {
      js: [
        '#!/usr/bin/env node',
        "import { createRequire as __cr } from 'node:module';",
        "import { fileURLToPath as __fu } from 'node:url';",
        "import { dirname as __dn } from 'node:path';",
        'const require = __cr(import.meta.url);',
        'const __filename = __fu(import.meta.url);',
        'const __dirname = __dn(__filename);',
      ].join('\n'),
    },
    logLevel: 'warning',
  });
  await chmod(path.join(root, entry.out), 0o755).catch(() => undefined);
  console.log(`built ${entry.out}`);
}
