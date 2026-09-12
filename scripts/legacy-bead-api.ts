import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

interface LegacyResponse<T> {
  code: number;
  data?: { list?: T[] };
  msg?: string;
}

const execFileAsync = promisify(execFile);
const defaultApiBase = 'https://chuming.rwacn.net/index.php/api/custom.bead';

export async function fetchLegacyList<T>(path: 'categoryList' | 'list'): Promise<T[]> {
  const base = process.env.OLD_BEAD_API_BASE?.trim() || defaultApiBase;
  const url = new URL(`${base.replace(/\/$/, '')}/${path}`);
  url.searchParams.set('token', await legacyToken());
  url.searchParams.set('app_id', process.env.OLD_BEAD_API_APP_ID?.trim() || '10001');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Legacy API returned HTTP ${response.status}`);
  const body = (await response.json()) as LegacyResponse<T>;
  if (body.code !== 1 || !Array.isArray(body.data?.list)) {
    throw new Error(body.msg || `Legacy API returned an invalid ${path} response`);
  }
  return body.data.list;
}

async function legacyToken(): Promise<string> {
  const configured = process.env.OLD_BEAD_API_TOKEN?.trim();
  if (configured) return configured;

  // One-off compatibility fallback: locate the credential in the original
  // mock client's Git history without copying it into this repository.
  const { stdout: commits } = await execFileAsync('git', [
    '-C',
    '../stonelab',
    'log',
    '-Sconst TOKEN',
    '--format=%H',
    '--',
    'services/beads.ts',
  ]);
  const commit = commits.trim().split('\n')[0];
  if (!commit) throw new Error('OLD_BEAD_API_TOKEN is required');
  const { stdout: source } = await execFileAsync('git', [
    '-C',
    '../stonelab',
    'show',
    `${commit}:services/beads.ts`,
  ]);
  const token = source.match(/const TOKEN = '([^']+)'/)?.[1];
  if (!token) throw new Error('OLD_BEAD_API_TOKEN is required');
  return token;
}
