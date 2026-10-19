export type LensErrorCode =
  | 'UNSUPPORTED_LANGUAGE'
  | 'FILE_NOT_FOUND'
  | 'INVALID_INPUT'
  | 'PRIVACY_VIOLATION'
  | 'NOT_IMPLEMENTED'
  | 'INTERNAL';

/** Single error type used across modules so that every layer reports failures the same way. */
export class LensError extends Error {
  readonly code: LensErrorCode;

  constructor(code: LensErrorCode, message: string) {
    super(message);
    this.name = 'LensError';
    this.code = code;
  }

  toJSON(): { code: LensErrorCode; message: string } {
    return { code: this.code, message: this.message };
  }
}
