import { BlockList, isIP } from 'node:net';
const deny = new BlockList();
for (const [ip, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
])
  deny.addSubnet(ip, bits, 'ipv4');
const v6 = new BlockList();
v6.addSubnet('2000::', 3, 'ipv6');
const deny6 = new BlockList();
for (const [ip, bits] of [
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['3fff::', 20],
])
  deny6.addSubnet(ip, bits, 'ipv6');
export function publicAddress(value) {
  const ip = String(value).replace(/^\[|\]$/g, '');
  const family = isIP(ip);
  return family === 4
    ? !deny.check(ip, 'ipv4')
    : family === 6 && v6.check(ip, 'ipv6') && !deny6.check(ip, 'ipv6');
}
export function sourceUrl(value) {
  const u = new URL(value),
    host = u.hostname
      .replace(/^\[|\]$/g, '')
      .replace(/\.$/, '')
      .toLowerCase();
  if (
    !['http:', 'https:'].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.hash ||
    (u.port && u.port !== (u.protocol === 'https:' ? '443' : '80')) ||
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    (isIP(host) && !publicAddress(host))
  )
    throw Error('請提供不含憑證的公開 HTTP(S) 音源網址（僅限 80／443）');
  return u.href;
}
