import { lookup as resolve } from 'node:dns';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { domainError, err, ok, type DomainError, type Err, type Result } from '@repo/contracts';
import { clientDocumentUrl, readClientDocument } from '../domain/client-document';
import { type ClientDocuments } from '../ports/client-documents';

export type HttpClientDocumentsOptions = {
  readonly allowHttpLoopback: boolean;
  readonly timeoutMs?: number;
};

export const CLIENT_DOCUMENT_MAX_BYTES = 5 * 1024;

export const CLIENT_DOCUMENT_TIMEOUT_MS = 5000;

const NOT_PUBLIC = subnets(
  [
    '0.0.0.0/8',
    '10.0.0.0/8',
    '100.64.0.0/10',
    '127.0.0.0/8',
    '169.254.0.0/16',
    '172.16.0.0/12',
    '192.0.0.0/24',
    '192.0.2.0/24',
    '192.168.0.0/16',
    '198.18.0.0/15',
    '198.51.100.0/24',
    '203.0.113.0/24',
    '224.0.0.0/3',
  ],
  ['::/3', '2001::/32', '2001:db8::/32', '2002::/16', '4000::/2', '8000::/1'],
);

const LOOPBACK = subnets(['127.0.0.0/8'], ['::1/128']);

type AddressRule = (address: string) => boolean;

const isPublic: AddressRule = (address) => !within(NOT_PUBLIC, address);

const isLoopback: AddressRule = (address) => within(LOOPBACK, address);

const NOT_FETCHABLE = 'The client document is not served from an address it may be fetched from.';
const UNFETCHED = 'The client document could not be fetched.';
const TOO_LARGE = 'The client document is larger than allowed.';

export function createHttpClientDocuments(options: HttpClientDocumentsOptions): ClientDocuments {
  const timeoutMs = options.timeoutMs ?? CLIENT_DOCUMENT_TIMEOUT_MS;
  return {
    fetch: async (clientId) => {
      const url = clientDocumentUrl(clientId, {
        allowHttpLoopback: options.allowHttpLoopback,
      });
      if (!url.ok) {
        return url;
      }
      const allowed = url.value.protocol === 'https:' ? isPublic : isLoopback;
      const host = url.value.hostname.replace(/^\[(.*)\]$/, '$1');
      if (isIP(host) !== 0 && !allowed(host)) {
        return refused(NOT_FETCHABLE);
      }
      const body = await download(url.value, allowed, timeoutMs);
      if (!body.ok) {
        return body;
      }
      return readClientDocument(clientId, body.value);
    },
  };
}

function download(
  url: URL,
  allowed: AddressRule,
  timeoutMs: number,
): Promise<Result<string, DomainError>> {
  return new Promise((settle) => {
    let addressRefused = false;
    const lookup: LookupFunction = (hostname, lookupOptions, callback) => {
      resolve(hostname, { ...lookupOptions, all: true }, (error, addresses) => {
        if (error !== null) {
          callback(error, '');
          return;
        }
        if (addresses.length === 0 || !addresses.every(({ address }) => allowed(address))) {
          addressRefused = true;
          callback(new Error(NOT_FETCHABLE), '');
          return;
        }
        if (lookupOptions.all === true) {
          callback(null, addresses);
          return;
        }
        const [first] = addresses;
        callback(null, first?.address ?? '', first?.family);
      });
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

type Subnets = { readonly ipv4: BlockList; readonly ipv6: BlockList };

function within(lists: Subnets, address: string): boolean {
  return isIP(address) === 6
    ? lists.ipv6.check(address, 'ipv6')
    : lists.ipv4.check(address, 'ipv4');
}

function subnets(ipv4: readonly string[], ipv6: readonly string[]): Subnets {
  return { ipv4: blockList(ipv4, 'ipv4'), ipv6: blockList(ipv6, 'ipv6') };
}

function blockList(cidrs: readonly string[], type: 'ipv4' | 'ipv6'): BlockList {
  const list = new BlockList();
  for (const cidr of cidrs) {
    const [network = '', prefix = ''] = cidr.split('/');
    list.addSubnet(network, Number(prefix), type);
  }
  return list;
}
