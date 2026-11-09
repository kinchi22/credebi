import { describe, expect, it } from 'vitest';
import { clientAddressAllowed } from './client-address';

describe('clientAddressAllowed, for an https document', () => {
  it.each([
    ['a public IPv4 address', '160.79.104.10'],
    ['the last address before a private range', '9.255.255.255'],
    ['the first address after a private range', '11.0.0.0'],
    ['a public IPv6 address', '2606:4700:4700::1111'],
    ['a public IPv6 address with a zone', '2606:4700:4700::1111%en0'],
    ['a public IPv6 address written in full', '2607:6bc0:0000:0000:0000:0000:0000:0010'],
  ])('allows %s', (_case, address) => {
    expect(clientAddressAllowed(address, 'public')).toBe(true);
  });

  it.each([
    ['loopback', '127.0.0.1'],
    ['loopback, at the top of 127.0.0.0/8', '127.255.255.255'],
    ['private, in 10.0.0.0/8', '10.0.0.5'],
    ['private, in 172.16.0.0/12', '172.31.255.255'],
    ['private, in 192.168.0.0/16', '192.168.1.1'],
    ['link-local', '169.254.169.254'],
    ['unspecified', '0.0.0.0'],
    ['in the shared address space', '100.64.0.1'],
    ['in an IETF protocol range', '192.0.0.8'],
    ['documentation', '192.0.2.1'],
    ['benchmarking', '198.18.0.1'],
    ['documentation, in 198.51.100.0/24', '198.51.100.7'],
    ['documentation, in 203.0.113.0/24', '203.0.113.9'],
    ['multicast', '224.0.0.1'],
    ['broadcast', '255.255.255.255'],
    ['IPv6 loopback', '::1'],
    ['IPv6 unspecified', '::'],
    ['IPv6 link-local', 'fe80::1'],
    ['IPv6 link-local with a zone', 'fe80::1%en0'],
    ['IPv6 unique local', 'fd00::1'],
    ['IPv6 multicast', 'ff02::1'],
    ['IPv4-mapped loopback, dotted', '::ffff:127.0.0.1'],
    ['IPv4-mapped loopback, in hex', '::ffff:7f00:1'],
    ['NAT64', '64:ff9b::a00:1'],
    ['Teredo', '2001:0:4136:e378::1'],
    ['IPv6 documentation', '2001:db8::1'],
    ['6to4', '2002:a00:1::1'],
  ])('refuses a %s address', (_case, address) => {
    expect(clientAddressAllowed(address, 'public')).toBe(false);
  });

  it.each([
    ['a host name', 'client.example.com'],
    ['an IPv4 octet over 255', '256.1.1.1'],
    ['three IPv4 octets', '1.1.1'],
    ['an IPv4 octet with too many digits', '1.1.1.0001'],
    ['nine IPv6 groups', '1:2:3:4:5:6:7:8:9'],
    ['seven IPv6 groups', '1:2:3:4:5:6:7'],
    ['two compressions', '2606::1::2'],
    ['a compression standing for no group', '1:2:3:4::5:6:7:8'],
    ['an IPv6 group of five digits', '2606:47000::1'],
    ['an IPv6 group that is not hex', '2606:xyz::1'],
    ['an IPv4 tail that is not an address', '2606::1.1.1'],
    ['an IPv4 part before a compression', '1.2.3.4::1'],
    ['an IPv4 part before the last group', '::1.2.3.4:1'],
  ])('refuses what is not an address: %s', (_case, address) => {
    expect(clientAddressAllowed(address, 'public')).toBe(false);
  });
});

describe('clientAddressAllowed, for an http loopback document', () => {
  it.each([
    ['IPv4 loopback', '127.0.0.1'],
    ['IPv4 loopback, elsewhere in 127.0.0.0/8', '127.8.9.10'],
    ['IPv6 loopback', '::1'],
  ])('allows %s', (_case, address) => {
    expect(clientAddressAllowed(address, 'loopback')).toBe(true);
  });

  it.each([
    ['public', '160.79.104.10'],
    ['private', '10.0.0.5'],
    ['just past 127.0.0.0/8', '128.0.0.0'],
    ['IPv6 unspecified', '::'],
    ['IPv6 address after loopback', '::2'],
    ['not an address', 'localhost'],
  ])('refuses a %s address', (_case, address) => {
    expect(clientAddressAllowed(address, 'loopback')).toBe(false);
  });
});
