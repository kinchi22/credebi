import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { domainError, err, ok, type DomainError, type Err, type Result } from '@repo/contracts';
import { clientAddressAllowed, type ClientAddressPolicy } from '../domain/client-address';
import {
  clientDocumentUrl,
  readClientDocument,
  type ClientDocumentPolicy,
} from '../domain/client-document';
import { type ClientDocuments } from '../ports/client-documents';

export type ResolvedAddress = { readonly address: string; readonly family: number };

export type ResolveHost = (hostname: string) => Promise<readonly ResolvedAddress[]>;

export type HttpClientDocumentsOptions = ClientDocumentPolicy & {
  readonly timeoutMs?: number;
  readonly resolveHost?: ResolveHost;
};

export const CLIENT_DOCUMENT_MAX_BYTES = 5 * 1024;

const CLIENT_DOCUMENT_TIMEOUT_MS = 5000;

const NOT_FETCHABLE = 'The client document is not served from an address it may be fetched from.';
const UNFETCHED = 'The client document could not be fetched.';
const TOO_LARGE = 'The client document is larger than allowed.';

const resolveByDns: ResolveHost = (hostname) => dnsLookup(hostname, { all: true });

type Fetch = {
  readonly url: URL;
  readonly policy: ClientAddressPolicy;
  readonly resolveHost: ResolveHost;
  readonly timeoutMs: number;
};

export function createHttpClientDocuments(options: HttpClientDocumentsOptions): ClientDocuments {
  return {
    fetch: async (clientId) => {
      const url = clientDocumentUrl(clientId, options);
      if (!url.ok) {
        return url;
      }
      const policy = url.value.protocol === 'https:' ? 'public' : 'loopback';
      const host = url.value.hostname.replace(/^\[(.*)\]$/, '$1');
      if (isIP(host) !== 0 && !clientAddressAllowed(host, policy)) {
        return refused(NOT_FETCHABLE);
      }
      const body = await download({
        url: url.value,
        policy,
        resolveHost: options.resolveHost ?? resolveByDns,
        timeoutMs: options.timeoutMs ?? CLIENT_DOCUMENT_TIMEOUT_MS,
      });
      if (!body.ok) {
        return body;
      }
      return readClientDocument(clientId, body.value);
    },
  };
}

function download({
  url,
  policy,
  resolveHost,
  timeoutMs,
}: Fetch): Promise<Result<string, DomainError>> {
  return new Promise((settle) => {
    let addressRefused = false;
    const lookup: LookupFunction = (hostname, lookupOptions, callback) => {
      resolveHost(hostname).then(
        (addresses) => {
          const allowed = addresses.every(({ address }) => clientAddressAllowed(address, policy));
          const [first] = addresses;
          if (first === undefined || !allowed) {
            addressRefused = true;
            callback(new Error(NOT_FETCHABLE), '');
            return;
          }
          if (lookupOptions.all === true) {
            callback(
              null,
              addresses.map(({ address, family }) => ({ address, family })),
            );
            return;
          }
          callback(null, first.address, first.family);
        },
        (error: unknown) => {
          callback(error instanceof Error ? error : new Error(UNFETCHED), '');
        },
      );
    };
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const request = send(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      agent: false,
      lookup,
      signal: AbortSignal.timeout(timeoutMs),
    });
    request.on('error', () => {
      settle(refused(addressRefused ? NOT_FETCHABLE : UNFETCHED));
    });
    request.on('response', (response) => {
      read(response).then(settle, () => {
        settle(refused(UNFETCHED));
      });
    });
    request.end();
  });
}

async function read(response: IncomingMessage): Promise<Result<string, DomainError>> {
  if (response.statusCode !== 200) {
    response.destroy();
    return refused(UNFETCHED);
  }
  if (Number(response.headers['content-length'] ?? 0) > CLIENT_DOCUMENT_MAX_BYTES) {
    response.destroy();
    return refused(TOO_LARGE);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of response) {
    const bytes = Buffer.from(chunk as Uint8Array);
    size += bytes.length;
    if (size > CLIENT_DOCUMENT_MAX_BYTES) {
      response.destroy();
      return refused(TOO_LARGE);
    }
    chunks.push(bytes);
  }
  return ok(Buffer.concat(chunks).toString('utf8'));
}

function refused(message: string): Err<DomainError> {
  return err(domainError('INVALID_INPUT', message));
}
