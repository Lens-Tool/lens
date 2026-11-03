import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isAnonymousId } from '@lens/shared';

/**
 * Stable anonymous project id (ADR 0003). The id is random: it is never derived from a path,
 * folder name, user name or repository. It is stored in `<rootDir>/.lens/project-id.json` and
 * read again on later starts, so the same project keeps the same id.
 *
 * Warnings are fixed messages without file paths (the real path could contain a user name).
 */
export interface ProjectIdOptions {
  /** Folder of the project. Pass it explicitly: the process working directory is not reliable. */
  rootDir: string;
  /** Receives a short warning. Default: stderr. stdout is reserved for the MCP protocol. */
  warn?: (message: string) => void;
}

export interface ProjectIdResult {
  id: string;
  /** `file`: read from disk. `created`: new id saved. `session-only`: new id that could not be saved. */
  source: 'file' | 'created' | 'session-only';
}

const ID_DIR = '.lens';
const ID_FILE = 'project-id.json';

const warnOnStderr = (message: string): void => {
  console.error(`[lens] ${message}`);
};

export function getOrCreateProjectId(options: ProjectIdOptions): ProjectIdResult {
  const warn = options.warn ?? warnOnStderr;
  const dir = join(options.rootDir, ID_DIR);
  const file = join(dir, ID_FILE);

  const existing = readStoredId(file, warn);
  if (existing) return { id: existing, source: 'file' };

  const id = `proj_${randomUUID()}`;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, `${JSON.stringify({ projectId: id }, null, 2)}\n`, 'utf8');
    return { id, source: 'created' };
  } catch {
    warn(
      'Could not save the project id (the folder is not writable). Using an id for this session only.',
    );
    return { id, source: 'session-only' };
  }
}

function readStoredId(file: string, warn: (message: string) => void): string | undefined {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      warn('The project id file could not be read. Creating a new id.');
    }
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    const id =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { projectId?: unknown }).projectId
        : undefined;
    if (isAnonymousId(id)) return id;
  } catch {
    // fall through to the warning below
  }
  warn('The project id file is corrupted. Creating a new id.');
  return undefined;
}
