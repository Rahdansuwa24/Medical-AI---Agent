import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  findProjectRoot,
  isTestEnvironment,
  resolveStorageConfig,
} from './storage-paths';

test('isTestEnvironment otomatis aktif saat menjalankan npm test', () => {
  assert.equal(isTestEnvironment(), true);
});

test('resolveStorageConfig memakai :memory: saat test mode tanpa menyentuh disk', () => {
  const config = resolveStorageConfig();
  assert.equal(config.mode, 'memory');
  assert.equal(config.dataDir, null);
  assert.equal(config.libsqlUrl, ':memory:');
  assert.equal(config.duckdbPath, ':memory:');
});

test('findProjectRoot dan resolveStorageConfig mengunci path DB tunggal di folder data/ meski dipanggil dari .mastra/output', () => {
  const rootFromSrc = findProjectRoot(path.resolve(import.meta.dirname, '..'));
  const rootFromOutput = findProjectRoot(
    path.resolve(rootFromSrc, '.mastra', 'output')
  );

  assert.equal(rootFromSrc, rootFromOutput);

  const configFromSrc = resolveStorageConfig({
    testMode: false,
    startDir: path.resolve(rootFromSrc, 'src', 'mastra'),
  });
  const configFromOutput = resolveStorageConfig({
    testMode: false,
    startDir: path.resolve(rootFromSrc, '.mastra', 'output'),
  });

  const expectedDataDir = path.join(rootFromSrc, 'data');
  assert.equal(configFromSrc.mode, 'persistent');
  assert.equal(configFromSrc.dataDir, expectedDataDir);
  assert.equal(configFromOutput.dataDir, expectedDataDir);
  assert.equal(
    configFromSrc.libsqlUrl,
    pathToFileURL(path.join(expectedDataDir, 'mastra.db')).href
  );
  assert.equal(configFromSrc.libsqlUrl, configFromOutput.libsqlUrl);
  assert.equal(
    configFromSrc.duckdbPath,
    path.join(expectedDataDir, 'mastra.duckdb')
  );
  assert.equal(configFromSrc.duckdbPath, configFromOutput.duckdbPath);
});

test('mengimpor src/mastra/index.ts di mode test berjalan aman dengan :memory:', async () => {
  const { mastra } = await import('../index');
  assert.ok(mastra.getAgent('agent'));
  assert.ok(mastra.getWorkflow('radiologyWorkflow'));
});
