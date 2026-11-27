import { realpath } from 'node:fs/promises';
import * as path from 'node:path';
import { LensError } from '@lens/shared';

/** True when `target` is `root` or lies below it (both already absolute). */
function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

/**
 * Resolves `inputPath` and returns its real path, or throws if it is not inside `repoRoot`.
 * Shared by every tool that reads a file, so they all enforce the same boundary.
 *
 * The root may be written in a form that realpath() changes: a symlink or junction, a Windows 8.3
 * short name (RUNNER~1) or macOS /var -> /private/var. A path under the root as the caller wrote it
 * must still be accepted, so the cheap lexical check accepts either form of the root. The real
 * security check is the second one, after realpath, where both sides are fully resolved.
 *
 * Error messages never contain the path (it can include a user name).
 */
export async function resolveInsideRoot(repoRoot: string, inputPath: string): Promise<string> {
  const rawRoot = path.resolve(repoRoot);
  const realRoot = await realpath(repoRoot);
  const resolvedInputPath = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(rawRoot, inputPath);

  // Lexical check first (realpath fails on paths that do not exist).
  if (!isInside(rawRoot, resolvedInputPath) && !isInside(realRoot, resolvedInputPath)) {
    throw new LensError('INVALID_INPUT', 'Path must be inside the repository root.');
  }

  let realPath: string;
  try {
    realPath = await realpath(resolvedInputPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new LensError('FILE_NOT_FOUND', 'The requested file does not exist.');
    }
    throw new LensError('INTERNAL', 'The file could not be read.');
  }

  if (!isInside(realRoot, realPath)) {
    throw new LensError('INVALID_INPUT', 'Path must be inside the repository root.');
  }
  return realPath;
}
