import { resolve } from 'node:path';

/**
 * The project folder (ADR 0003): `LENS_PROJECT_ROOT` if set, otherwise the working directory of the
 * process. One definition for everything that needs it (project id, expand_symbol path guard), so a
 * host that starts the connector outside the project cannot end up with two different roots.
 */
export function resolveProjectRoot(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  const fromEnv = env.LENS_PROJECT_ROOT;
  return fromEnv ? resolve(cwd, fromEnv) : cwd;
}
