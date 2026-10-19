import { LensError } from './errors.js';
import { TOOL_NAMES, type ToolName, type UsageEvent } from './types.js';

const ALLOWED_KEYS = new Set<string>([
  'schemaVersion',
  'projectId',
  'sessionId',
  'tool',
  'tokensBefore',
  'tokensAfter',
  'durationMs',
  'occurredAt',
]);

const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Privacy gate: validates an untrusted object as a UsageEvent and rejects anything else.
 * Unknown fields are a PRIVACY_VIOLATION (an allow-list, never a deny-list), so a new field
 * such as `filePath` cannot reach the statistics backend by accident.
 */
export function parseUsageEvent(input: unknown): UsageEvent {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new LensError('INVALID_INPUT', 'Event must be a JSON object.');
  }
  const record = input as Record<string, unknown>;

  const extra = Object.keys(record).filter((key) => !ALLOWED_KEYS.has(key));
  if (extra.length > 0) {
    throw new LensError('PRIVACY_VIOLATION', `Fields not allowed in events: ${extra.join(', ')}`);
  }

  const { schemaVersion, projectId, sessionId, tool, tokensBefore, tokensAfter, durationMs } =
    record;
  const occurredAt = record.occurredAt;

  if (schemaVersion !== 1) throw new LensError('INVALID_INPUT', 'schemaVersion must be 1.');
  if (typeof projectId !== 'string' || !ID_PATTERN.test(projectId)) {
    throw new LensError(
      'INVALID_INPUT',
      'projectId must be an opaque id (8-64 chars: A-Z a-z 0-9 _ -).',
    );
  }
  if (typeof sessionId !== 'string' || !ID_PATTERN.test(sessionId)) {
    throw new LensError(
      'INVALID_INPUT',
      'sessionId must be an opaque id (8-64 chars: A-Z a-z 0-9 _ -).',
    );
  }
  if (typeof tool !== 'string' || !(TOOL_NAMES as readonly string[]).includes(tool)) {
    throw new LensError('INVALID_INPUT', 'tool must be one of the five Lens tool names.');
  }
  if (!isCount(tokensBefore) || !isCount(tokensAfter) || !isCount(durationMs)) {
    throw new LensError(
      'INVALID_INPUT',
      'Token and duration fields must be non-negative integers.',
    );
  }
  if (typeof occurredAt !== 'string' || Number.isNaN(Date.parse(occurredAt))) {
    throw new LensError('INVALID_INPUT', 'occurredAt must be an ISO-8601 timestamp.');
  }

  return {
    schemaVersion: 1,
    projectId,
    sessionId,
    tool: tool as ToolName,
    tokensBefore,
    tokensAfter,
    durationMs,
    occurredAt,
  };
}
