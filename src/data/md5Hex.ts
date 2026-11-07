/**
 * Synchronous MD5 of a string's UTF-8 bytes as lowercase hex. Replaces the
 * vendor CryptoJS.MD5(s).toString(); the output must stay identical because
 * stored structure hashes (localStorage structureHash_*, Dexie files) depend
 * on it. Web Crypto has no MD5 and is async, so it is not a substitute.
 * MD5 here is a layout fingerprint, not a security primitive.
 */
import { md5 } from '@noble/hashes/legacy.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export function md5Hex(text: string): string {
  return bytesToHex(md5(utf8ToBytes(text)));
}
