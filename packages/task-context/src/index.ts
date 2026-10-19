import { LensError } from '@lens/shared';

/** Documented placeholder: the contract for `prepare_task` (implemented in the task-layer sprints). */
export type TaskIntent = 'explain' | 'fix' | 'modify' | 'add' | 'test' | 'other';

export interface PrepareTaskInput {
  /** Raw task statement typed by the developer. Stays on the machine. */
  task: string;
  /** Absolute root of the project being worked on. */
  projectRoot: string;
}

export interface PrepareTaskResult {
  intent: TaskIntent;
  cleanedTask: string;
  /** 0-1 score; low values flag vague requests. */
  qualityScore: number;
  /** Selected context targets (files / symbols) for the compressor to expand fully. */
  relevant: { file: string; symbols: string[] }[];
}

export function prepareTask(_input: PrepareTaskInput): Promise<PrepareTaskResult> {
  return Promise.reject(
    new LensError('NOT_IMPLEMENTED', 'prepare_task is scheduled for a later sprint.'),
  );
}
