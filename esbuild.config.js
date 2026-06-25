const esbuild = require('esbuild');

async function main() {
  const config = {
    entryPoints: ['./src/extension.ts'],
    bundle: true,
    outfile: './dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node16',
    sourcemap: true,
    minify: process.argv.includes('--production'),
  };

  if (process.argv.includes('--watch')) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
  } else {
    await esbuild.build(config);
  }
}

main().catch(() => process.exit(1));
