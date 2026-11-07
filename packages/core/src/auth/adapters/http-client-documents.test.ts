import { createServer, type ServerResponse, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type DomainError, type Result } from '@repo/contracts';
import { type ClientDocument } from '../domain/client-document';
import {
  CLIENT_DOCUMENT_MAX_BYTES,
  createHttpClientDocuments,
  type HttpClientDocumentsOptions,
} from './http-client-documents';

type Answer = (response: ServerResponse) => void;

let server: Server;
let origin: string;
let clientId: string;
let answer: Answer;

const json = (status: number, body: string, headers: Record<string, string> = {}): Answer => {
  return (response) => {
    response.writeHead(status, { 'content-type': 'application/json', ...headers }).end(body);
  };
};

const documentFor = (id: string): string =>
  JSON.stringify({
    client_id: id,
    client_name: 'Loopback client',
    redirect_uris: [`${origin}/cb`],
  });

const fetchWith = (
  url: string,
  options: Partial<HttpClientDocumentsOptions> = {},
): Promise<Result<ClientDocument, DomainError>> =>
  createHttpClientDocuments({ allowHttpLoopback: true, ...options }).fetch(url);

const refusal = (result: Result<ClientDocument, DomainError>): DomainError | undefined =>
  result.ok ? undefined : result.error;

beforeAll(async () => {
  server = createServer((_request, response) => {
    answer(response);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  clientId = `${origin}/client.json`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  answer = json(200, documentFor(clientId));
});

describe('createHttpClientDocuments, where an http loopback document is allowed', () => {
  it('fetches the document its URL serves', async () => {
    expect(await fetchWith(clientId)).toEqual({
      ok: true,
      value: {
        clientId,
        clientName: 'Loopback client',
        redirectUris: [`${origin}/cb`],
      },
    });
  });

  it('fetches from a loopback host name, judged by the address it resolves to', async () => {
    const byName = clientId.replace('127.0.0.1', 'localhost');
    answer = json(200, documentFor(byName));

    const result = await fetchWith(byName);

    expect(result.ok && result.value.clientId).toBe(byName);
  });

  it('refuses an http document from an address that is not loopback', async () => {
    expect(refusal(await fetchWith('http://10.0.0.1/client.json'))).toEqual({
      code: 'INVALID_INPUT',
      message: 'The client document is not served from an address it may be fetched from.',
    });
  });

  it('refuses a document whose client_id differs from its URL', async () => {
    answer = json(200, documentFor(`${origin}/someone-else.json`));

    expect(refusal(await fetchWith(clientId))?.message).toBe(
      'The client document names a client_id other than its own URL.',
    );
  });

  it('refuses a document that is malformed', async () => {
    answer = json(200, '{"client_id":');

    expect(refusal(await fetchWith(clientId))?.message).toBe('The client document is not JSON.');
  });

  it('refuses a document answered with a status other than 200', async () => {
    answer = json(302, documentFor(clientId), {
      location: `${origin}/elsewhere.json`,
    });

    expect(refusal(await fetchWith(clientId))).toEqual({
      code: 'INVALID_INPUT',
      message: 'The client document could not be fetched.',
    });
  });

  it('refuses a document that cannot be reached', async () => {
    expect(refusal(await fetchWith('http://127.0.0.1:1/client.json'))).toEqual({
      code: 'INVALID_INPUT',
      message: 'The client document could not be fetched.',
    });
  });

  it('accepts a document of exactly the size limit', async () => {
    const padded = documentFor(clientId);
    answer = json(200, padded.padEnd(CLIENT_DOCUMENT_MAX_BYTES, ' '));

    expect((await fetchWith(clientId)).ok).toBe(true);
  });

  it('refuses a document over the size limit that declares its length', async () => {
    answer = json(200, documentFor(clientId).padEnd(CLIENT_DOCUMENT_MAX_BYTES + 1, ' '));

    expect(refusal(await fetchWith(clientId))).toEqual({
      code: 'INVALID_INPUT',
      message: 'The client document is larger than allowed.',
    });
  });

  it('refuses a document over the size limit that streams without a length', async () => {
    answer = (response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.write(documentFor(clientId));
      response.end(' '.repeat(CLIENT_DOCUMENT_MAX_BYTES));
    };

    expect(refusal(await fetchWith(clientId))?.message).toBe(
      'The client document is larger than allowed.',
    );
  });

  it('refuses a document slower than the time limit', async () => {
    answer = (response) => {
      setTimeout(() => {
        json(200, documentFor(clientId))(response);
      }, 500);
    };

    expect(refusal(await fetchWith(clientId, { timeoutMs: 50 }))).toEqual({
      code: 'INVALID_INPUT',
      message: 'The client document could not be fetched.',
    });
  });

  it('refuses a document whose body stalls past the time limit', async () => {
    answer = (response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.write('{');
    };

    expect(refusal(await fetchWith(clientId, { timeoutMs: 50 }))?.message).toBe(
      'The client document could not be fetched.',
    );
  });
});

describe('createHttpClientDocuments, where no http loopback document is allowed', () => {
  it('refuses an http loopback document', async () => {
    expect(refusal(await fetchWith(clientId, { allowHttpLoopback: false }))).toEqual({
      code: 'INVALID_INPUT',
      message: 'A client document must be served over https.',
    });
  });

  it.each([
    ['loopback', 'https://127.0.0.1/client.json'],
    ['IPv6 loopback', 'https://[::1]/client.json'],
    ['private', 'https://10.1.2.3/client.json'],
    ['private, in 172.16.0.0/12', 'https://172.20.0.1/client.json'],
    ['private, in 192.168.0.0/16', 'https://192.168.1.1/client.json'],
    ['link-local', 'https://169.254.169.254/client.json'],
    ['IPv6 link-local', 'https://[fe80::1]/client.json'],
    ['IPv6 unique local', 'https://[fd00::1]/client.json'],
    ['IPv4-mapped IPv6 loopback', 'https://[::ffff:127.0.0.1]/client.json'],
    ['unspecified', 'https://0.0.0.0/client.json'],
    ['shared address space', 'https://100.64.0.1/client.json'],
  ])('refuses an https document at a %s address', async (_case, url) => {
    expect(refusal(await fetchWith(url, { allowHttpLoopback: false }))).toEqual({
      code: 'INVALID_INPUT',
      message: 'The client document is not served from an address it may be fetched from.',
    });
  });

  it.each([
    ['IPv4', 'https://1.1.1.1:1/client.json'],
    ['IPv6', 'https://[2606:4700:4700::1111]:1/client.json'],
  ])('lets an https document at a public %s address be fetched', async (_case, url) => {
    expect(refusal(await fetchWith(url, { allowHttpLoopback: false, timeoutMs: 50 }))).toEqual({
      code: 'INVALID_INPUT',
      message: 'The client document could not be fetched.',
    });
  });

  it('refuses an https document whose host name resolves to a loopback address', async () => {
    const byName = clientId.replace('http://127.0.0.1', 'https://localhost');

    expect(refusal(await fetchWith(byName, { allowHttpLoopback: false }))).toEqual({
      code: 'INVALID_INPUT',
      message: 'The client document is not served from an address it may be fetched from.',
    });
  });
});
