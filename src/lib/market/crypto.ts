/**
 * src/lib/market/crypto.ts
 *
 * Browser-safe AES-256 encryption using crypto-js.
 * Credentials are ALWAYS encrypted in the browser — never sent in plaintext.
 * The raw secretKey is also never stored in a DB or on IPFS.
 */

import CryptoJS from "crypto-js";

export interface Credentials {
  email:    string;
  password: string;
  notes?:   string;
}

/**
 * Generate a cryptographically random 256-bit AES key (hex string).
 * Called once per listing — never reused.
 */
export function generateSecretKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Encrypt a credentials object with AES-256.
 * Returns a base64 ciphertext string safe for IPFS upload.
 */
export function encryptCredentials(creds: Credentials, secretKey: string): string {
  const plaintext = JSON.stringify(creds);
  return CryptoJS.AES.encrypt(plaintext, secretKey).toString();
}

/**
 * Decrypt a base64 ciphertext back to a credentials object.
 * Called only in the buyer's browser — never server-side.
 */
export function decryptCredentials(ciphertext: string, secretKey: string): Credentials {
  const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
  const plaintext = bytes.toString(CryptoJS.enc.Utf8);
  if (!plaintext) throw new Error("Decryption failed — invalid key or corrupted data");
  return JSON.parse(plaintext) as Credentials;
}

/**
 * Build the IPFS payload: wrap ciphertext with metadata.
 * This is the object that gets pinned to Pinata.
 */
export function buildIpfsPayload(encryptedData: string, sellerAddress: string, service: string) {
  return {
    version: "a2a-secure-v1",
    service,
    seller:  sellerAddress,
    encryptedData,             // AES-encrypted credentials — all that's on IPFS
    uploadedAt: Date.now(),
  };
}

/**
 * Fetch and decrypt credentials from IPFS.
 * @param cid        The Pinata CID from the smart contract.
 * @param secretKey  The AES key obtained from the backend key-exchange endpoint.
 */
export async function fetchAndDecryptFromIpfs(
  cid: string,
  secretKey: string
): Promise<Credentials> {
  const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status}`);

  const payload = await res.json();

  if (!payload.encryptedData) {
    throw new Error("Invalid IPFS payload — missing encryptedData field");
  }

  return decryptCredentials(payload.encryptedData, secretKey);
}
