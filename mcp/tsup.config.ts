import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { server: 'src/server.ts' },
  format: 'esm',
  target: 'node24',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // Workspace packages are shipped as TypeScript source, so bundle them in.
  noExternal: [/^@ft\//],
});
