/**
 * Node-only host verification: blocks hostnames that resolve to private
 * addresses, which a bare hostname check cannot catch. Workers rely on the
 * runtime's own network isolation and skip this.
 */
import { lookup } from 'node:dns/promises';
import { AnalyzeError } from './analyze.mjs';

function isPrivateAddress(address) {
  const ip = address.toLowerCase();
  if (ip.includes(':')) {
    if (ip === '::1' || ip === '::') return true;
    if (/^f[cd][0-9a-f]{2}:/.test(ip) || /^fe80:/.test(ip)) return true;
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split('.').map(Number);
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export async function verifyPublicHost(hostname) {
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new AnalyzeError(`We could not resolve ${hostname}. Check the address and try again.`, 422);
  }
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new AnalyzeError('Local and private addresses are blocked.', 403);
  }
}
