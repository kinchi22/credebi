export const DOMAIN_ERROR_CODES = [
  'INVALID_INPUT',
  'NOT_FOUND',
  'CONFLICT',
  'DEPENDENCY_UNAVAILABLE',
  'UNBALANCED',
  'UNAUTHENTICATED',
  'NAME_TAKEN',
  'IN_USE',
  'TITLE_TOO_LONG',
  'MEMO_TOO_LONG',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export type DomainError = {
  readonly code: DomainErrorCode;
  readonly message: string;
};

export const domainError = (code: DomainErrorCode, message: string): DomainError => ({
  code,
  message,
});
