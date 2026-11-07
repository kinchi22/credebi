import { type DomainError, type Result } from '@repo/contracts';
import { type IssuedAuthorizationCode } from '../domain/authorization';

export type AuthorizationCodeRepository = {
  readonly add: (code: IssuedAuthorizationCode) => Promise<Result<void, DomainError>>;
};
