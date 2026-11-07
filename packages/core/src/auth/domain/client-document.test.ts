import { describe, expect, it } from 'vitest';
import { isErr } from '@repo/contracts';
import { clientDocumentUrl, readClientDocument } from './client-document';

const CLIENT_ID = 'https://client.example.com/oauth/client.json';
const REDIRECT = 'https://client.example.com/callback';

const document = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    client_id: CLIENT_ID,
    client_name: 'Example client',
    redirect_uris: [REDIRECT],
    ...overrides,
  });

describe('clientDocumentUrl', () => {
  it('accepts an https URL', () => {
    const result = clientDocumentUrl(CLIENT_ID, { allowHttpLoopback: false });

    expect(result.ok && result.value.href).toBe(CLIENT_ID);
  });

  it('refuses an http URL', () => {
    const result = clientDocumentUrl('http://127.0.0.1:4000/client.json', {
      allowHttpLoopback: false,
    });

    expect(isErr(result) && result.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'A client document must be served over https.',
    });
  });

  it('accepts an http URL where an http loopback document is allowed', () => {
    const result = clientDocumentUrl('http://127.0.0.1:4000/client.json', {
      allowHttpLoopback: true,
    });

    expect(result.ok && result.value.href).toBe('http://127.0.0.1:4000/client.json');
  });

  it('refuses another scheme even where an http loopback document is allowed', () => {
    const result = clientDocumentUrl('ftp://client.example.com/client.json', {
      allowHttpLoopback: true,
    });

    expect(isErr(result) && result.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'A client document must be served over https.',
    });
  });

  it('refuses a client id that is not a URL', () => {
    const result = clientDocumentUrl('client.json', { allowHttpLoopback: true });

    expect(isErr(result) && result.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'A client id must be a URL.',
    });
  });

  it.each([
    ['a user name', 'https://ada@client.example.com/client.json'],
    ['a password', 'https://:secret@client.example.com/client.json'],
    ['a fragment', 'https://client.example.com/client.json#part'],
  ])('refuses a URL carrying %s', (_case, clientId) => {
    const result = clientDocumentUrl(clientId, { allowHttpLoopback: false });

    expect(isErr(result) && result.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'A client document URL carries no credentials and no fragment.',
    });
  });
});

describe('readClientDocument', () => {
  it('reads the client id, name and redirect URIs a well-formed document states', () => {
    expect(readClientDocument(CLIENT_ID, document())).toEqual({
      ok: true,
      value: {
        clientId: CLIENT_ID,
        clientName: 'Example client',
        redirectUris: [REDIRECT],
      },
    });
  });

  it('reads a document that states no name as nameless', () => {
    const result = readClientDocument(CLIENT_ID, document({ client_name: undefined }));

    expect(result.ok && result.value.clientName).toBeUndefined();
  });

  it('refuses a document whose client_id differs from its URL', () => {
    const result = readClientDocument(
      CLIENT_ID,
      document({ client_id: 'https://client.example.com/someone-else.json' }),
    );

    expect(isErr(result) && result.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'The client document names a client_id other than its own URL.',
    });
  });

  it('refuses a document that is not JSON', () => {
    const result = readClientDocument(CLIENT_ID, '{"client_id":');

    expect(isErr(result) && result.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'The client document is not JSON.',
    });
  });

  it.each([
    ['a JSON array', JSON.stringify([CLIENT_ID])],
    ['no client_id', document({ client_id: undefined })],
    ['no redirect_uris', document({ redirect_uris: undefined })],
    ['an empty redirect_uris', document({ redirect_uris: [] })],
    ['a redirect URI that is not a URL', document({ redirect_uris: ['callback'] })],
    ['a client_name that is not text', document({ client_name: 42 })],
    ['a blank client_name', document({ client_name: '' })],
  ])('refuses a malformed document: %s', (_case, text) => {
    const result = readClientDocument(CLIENT_ID, text);

    expect(isErr(result) && result.error).toEqual({
      code: 'INVALID_INPUT',
      message: 'The client document is malformed.',
    });
  });
});
