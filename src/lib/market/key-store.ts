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

import { prisma } from "@/lib/db/listings-store";
import { encryptForDatabase, decryptFromDatabase } from "./server-crypto";

export async function storeKey(cid: string, secretKey: string, sellerWallet: string) {
  const encryptedKey = encryptForDatabase(secretKey);
  
  await prisma.decentralizedKey.upsert({
    where: { cid },
    update: { encryptedKey, sellerWallet },
    create: { cid, encryptedKey, sellerWallet },
  });
}

export async function getKey(cid: string): Promise<string | undefined> {
  const record = await prisma.decentralizedKey.findUnique({
    where: { cid },
  });
  
  if (!record) return undefined;
  
  try {
    return decryptFromDatabase(record.encryptedKey);
  } catch (err) {
    console.error(`Failed to decrypt key for CID ${cid}`, err);
    return undefined;
  }
}

export async function hasKey(cid: string): Promise<boolean> {
  const count = await prisma.decentralizedKey.count({
    where: { cid },
  });
  return count > 0;
}
