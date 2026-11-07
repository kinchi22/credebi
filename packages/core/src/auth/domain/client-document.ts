import {
  clientDocumentSchema,
  domainError,
  err,
  ok,
  type DomainError,
  type Result,
} from '@repo/contracts';

export type ClientDocument = {
  readonly clientId: string;
  readonly clientName: string | undefined;
  readonly redirectUris: readonly string[];
};

export type ClientDocumentPolicy = {
  readonly allowHttpLoopback: boolean;
};

export function clientDocumentUrl(
  clientId: string,
  policy: ClientDocumentPolicy,
): Result<URL, DomainError> {
  if (!URL.canParse(clientId)) {
    return err(domainError('INVALID_INPUT', 'A client id must be a URL.'));
  }
  const url = new URL(clientId);
  const scheme = url.protocol;
  if (scheme !== 'https:' && !(policy.allowHttpLoopback && scheme === 'http:')) {
    return err(domainError('INVALID_INPUT', 'A client document must be served over https.'));
  }
  if (url.username !== '' || url.password !== '' || url.hash !== '') {
    return err(
      domainError('INVALID_INPUT', 'A client document URL carries no credentials and no fragment.'),
    );
  }
  return ok(url);
}

export function readClientDocument(
  clientId: string,
  text: string,
): Result<ClientDocument, DomainError> {
  const json = parseJson(text);
  if (!json.ok) {
    return err(domainError('INVALID_INPUT', 'The client document is not JSON.'));
  }
  const parsed = clientDocumentSchema.safeParse(json.value);
  if (!parsed.success) {
    return err(domainError('INVALID_INPUT', 'The client document is malformed.'));
  }
  if (parsed.data.client_id !== clientId) {
    return err(
      domainError('INVALID_INPUT', 'The client document names a client_id other than its own URL.'),
    );
  }
  return ok({
    clientId,
    clientName: parsed.data.client_name,
    redirectUris: parsed.data.redirect_uris,
  });
}

function parseJson(text: string): Result<unknown, undefined> {
  try {
    return ok(JSON.parse(text));
  } catch {
    return err(undefined);
  }
}
