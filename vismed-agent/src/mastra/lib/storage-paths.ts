import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface StorageConfig {
  mode: 'memory' | 'persistent';
  dataDir: string | null;
  libsqlUrl: string;
  duckdbPath: string;
}

export interface ResolveStorageOptions {
  startDir?: string;
  testMode?: boolean;
  dataDir?: string;
  libsqlUrl?: string;
  duckdbPath?: string;
}

/**
 * Detects whether code is executing under a test runner so tests default to
 * ephemeral in-memory storage instead of creating .db files on disk.
 */
export function isTestEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'test' ||
    Boolean(process.env.NODE_TEST_CONTEXT) ||
    process.execArgv.includes('--test') ||
    process.argv.includes('--test')
  );
}

/**
 * Resolves the root directory of vismed-agent regardless of whether code runs
 * from src/mastra, a test directory, or Mastra's bundled .mastra/output/.
 */
export function findProjectRoot(startDir?: string): string {
  const fallbackDir =
    typeof import.meta?.dirname === 'string' ? import.meta.dirname : process.cwd();
  let current = path.resolve(startDir || fallbackDir);

  while (true) {
    const pkgPath = path.join(current, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string };
        if (pkg.name === 'vismed-agent') {
          return current;
        }
      } catch {
        // Ignore unreadable package.json and continue walking upward
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return process.cwd();
}

/**
 * Returns deterministic, single-location storage configuration for LibSQL and DuckDB.
 * Defaults to in-memory databases during tests unless explicitly overridden.
 */
export function resolveStorageConfig(options: ResolveStorageOptions = {}): StorageConfig {
  const testMode = options.testMode ?? isTestEnvironment();
  const explicitLibsql = options.libsqlUrl || process.env.TURSO_DATABASE_URL;
  const explicitDuckdb = options.duckdbPath || process.env.DUCKDB_PATH;
  const explicitDataDir = options.dataDir || process.env.MASTRA_DATA_DIR;

  if (testMode && !explicitLibsql && !explicitDuckdb && !explicitDataDir) {
    return {
      mode: 'memory',
      dataDir: null,
      libsqlUrl: ':memory:',
      duckdbPath: ':memory:',
    };
  }

  const projectRoot = findProjectRoot(options.startDir);
  const dataDir = path.resolve(explicitDataDir || path.join(projectRoot, 'data'));

  if (!explicitLibsql || !explicitDuckdb) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const libsqlUrl =
    explicitLibsql || pathToFileURL(path.join(dataDir, 'mastra.db')).href;
  const duckdbPath = explicitDuckdb || path.join(dataDir, 'mastra.duckdb');

  return {
    mode: 'persistent',
    dataDir,
    libsqlUrl,
    duckdbPath,
  };
}
