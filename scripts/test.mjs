import { build } from 'esbuild';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
await mkdir('.test-build', { recursive: true });
try {
  await build({
    entryPoints: ['tests/regression.test.tsx'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    jsx: 'automatic',
    loader: { '.css': 'empty' },
    outfile: '.test-build/regression.test.mjs',
    define: { 'import.meta.env': '{"MODE":"test","BASE_URL":"./"}' },
    plugins: [
      {
        name: 'inline-extra-test-locales',
        setup(build) {
          build.onLoad({ filter: /[\\/]i18n[\\/]i18n\.ts$/ }, async (args) => ({
            contents: (await readFile(args.path, 'utf8')).replace(
              /import\.meta\.glob\([\s\S]*?\) as/,
              '{} as'
            ),
            loader: 'ts',
          }));
        },
      },
    ],
  });
  await build({
    entryPoints: ['src/services/cache/qdnDocumentCache.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    outfile: '.test-build/cache-reload.mjs',
  });
  await build({
    entryPoints: ['src/services/qdn/publicationJobs.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    outfile: '.test-build/publication-reload.mjs',
  });
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      './tests/setup.mjs',
      '--test',
      '.test-build/regression.test.mjs',
    ],
    { stdio: 'inherit', timeout: 60_000 }
  );
  process.exitCode = result.status ?? 1;
} finally {
  await rm('.test-build', { recursive: true, force: true });
}
