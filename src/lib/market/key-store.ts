/**
 * src/lib/market/key-store.ts
 *
 * In-process key store for the A2A secure credential marketplace.
 *
 * Architecture (Option B from spec):
 *   - Seller registers { cid → AES secretKey } after listing on-chain
 *   - Buyer can only fetch the key AFTER the backend verifies their payment
 *     by reading the A2AMarket contract's escrow storage (on-chain proof)
 *
 * ⚠️  Production note: Replace the in-memory Map with Redis or an encrypted
 *     database column. The key store must be persistent across server restarts.
 */

// { cid → { secretKey, sellerAddress } }
const keyStore = new Map<string, { secretKey: string; sellerAddress: string }>();

export function storeKey(cid: string, secretKey: string, sellerAddress: string): void {
  if (keyStore.has(cid)) {
    // Silent no-op — key already registered; seller cannot overwrite
    return;
  }
  keyStore.set(cid, { secretKey, sellerAddress });
}

export function getKey(cid: string): { secretKey: string; sellerAddress: string } | null {
  return keyStore.get(cid) ?? null;
}

export function hasKey(cid: string): boolean {
  return keyStore.has(cid);
}
