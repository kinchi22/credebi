export type ClientAddressPolicy = 'public' | 'loopback';

type Address = { readonly bits: 32 | 128; readonly value: bigint };

type Subnet = Address & { readonly prefix: number };

const NOT_PUBLIC: readonly Subnet[] = [
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
  '::/3',
  '2001::/32',
  '2001:db8::/32',
  '2002::/16',
  '4000::/2',
  '8000::/1',
].map(subnet);

const LOOPBACK: readonly Subnet[] = ['127.0.0.0/8', '::1/128'].map(subnet);

export function clientAddressAllowed(address: string, policy: ClientAddressPolicy): boolean {
  const parsed = parseAddress(address.replace(/%.*$/, ''));
  if (parsed === undefined) {
    return false;
  }
  if (policy === 'loopback') {
    return LOOPBACK.some((range) => contains(range, parsed));
  }
  return !NOT_PUBLIC.some((range) => contains(range, parsed));
}

function contains(range: Subnet, address: Address): boolean {
  const shift = BigInt(range.bits - range.prefix);
  return range.bits === address.bits && address.value >> shift === range.value >> shift;
}

function subnet(cidr: string): Subnet {
  const [network = '', prefix = ''] = cidr.split('/');
  const address = parseAddress(network) ?? { bits: 32, value: 0n };
  return { ...address, prefix: Number(prefix) };
}

function parseAddress(text: string): Address | undefined {
  if (text.includes(':')) {
    const value = parseIpv6(text);
    return value === undefined ? undefined : { bits: 128, value };
  }
  const value = parseIpv4(text);
  return value === undefined ? undefined : { bits: 32, value };
}

function parseIpv4(text: string): bigint | undefined {
  const octets = text.split('.');
  if (octets.length !== 4 || !octets.every((octet) => /^\d{1,3}$/.test(octet))) {
    return undefined;
  }
  const numbers = octets.map(Number);
  if (numbers.some((octet) => octet > 255)) {
    return undefined;
  }
  return numbers.reduce((total, octet) => (total << 8n) + BigInt(octet), 0n);
}

function parseIpv6(text: string): bigint | undefined {
  const halves = text.split('::');
  if (halves.length > 2) {
    return undefined;
  }
  const compressed = halves.length === 2;
  const head = groups(halves[0] ?? '', !compressed);
  const tail = groups(halves[1] ?? '', true);
  if (head === undefined || tail === undefined) {
    return undefined;
  }
  const missing = 8 - head.length - tail.length;
  if (compressed ? missing < 1 : missing !== 0) {
    return undefined;
  }
  const all = [...head, ...Array<bigint>(missing).fill(0n), ...tail];
  return all.reduce((total, group) => (total << 16n) + group, 0n);
}

function groups(text: string, endsTheAddress: boolean): bigint[] | undefined {
  if (text === '') {
    return [];
  }
  const parts = text.split(':');
  const last = parts.at(-1) ?? '';
  const result: bigint[] = [];
  for (const part of parts.slice(0, -1)) {
    if (!/^[0-9a-f]{1,4}$/i.test(part)) {
      return undefined;
    }
    result.push(BigInt(`0x${part}`));
  }
  if (endsTheAddress && last.includes('.')) {
    const ipv4 = parseIpv4(last);
    return ipv4 === undefined ? undefined : [...result, ipv4 >> 16n, ipv4 & 0xffffn];
  }
  if (!/^[0-9a-f]{1,4}$/i.test(last)) {
    return undefined;
  }
  return [...result, BigInt(`0x${last}`)];
}
