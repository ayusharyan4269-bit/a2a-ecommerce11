# API Endpoint Guide

Complete reference for all API endpoints in the A2A TrustMesh AI Framework. These endpoints are designed for frontend integration with wallet authentication via Pera, Defly, or Lute.

---

## Overview

| Category | Endpoints | Auth Required |
|:---------|:----------|:--------------|
| **Wallet** | 3 endpoints | Wallet address |
| **Listings** | 2 endpoints | None (read) / Wallet (write) |
| **Reputation** | 3 endpoints | None (read) / Wallet (write) |
| **Commerce Flow** | 4 endpoints | Server-side |
| **Premium (x402)** | 2 endpoints | x402 payment |

Base URL: `http://localhost:3000` (dev) or your deployed URL.

---

## Wallet Endpoints

These endpoints support the wallet-signed transaction flow: server prepares unsigned txns → wallet signs client-side → server submits.

### `GET /api/wallet/info`

Get wallet balance and network information.

**Query Parameters:**

| Param | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `address` | string | Yes | Algorand address |

**Response:**

```json
{
  "address": "AYIFKOGN...",
  "balance": 24.651,
  "network": "testnet",
  "explorerUrl": "https://testnet.explorer.perawallet.app/address/AYIFKOGN..."
}
```

---

### `POST /api/wallet/prepare-payment`

Build an unsigned payment transaction for the user's wallet to sign.

**Request Body:**

```json
{
  "senderAddress": "AYIFKOGN...",
  "receiverAddress": "67YHITMF...",
  "amountAlgo": 0.33,
  "note": "A2A TrustMesh AI | SME Cloud Storage | 0.33 ALGO"
}
```

**Response:**

```json
{
  "unsignedTxn": "iaNhbXTOAAU...",
  "txnId": "FSBVCUFS2T7L...",
  "details": {
    "sender": "AYIFKOGN...",
    "receiver": "67YHITMF...",
    "amount": 0.33,
    "fee": 0.001
  }
}
```

**Frontend Integration:**

```typescript
import { useWallet } from "@txnlab/use-wallet-react";

const { signTransactions } = useWallet();

// 1. Prepare
const res = await fetch("/api/wallet/prepare-payment", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ senderAddress, receiverAddress, amountAlgo, note }),
});
const { unsignedTxn } = await res.json();

// 2. Decode and sign with wallet
const txnBytes = Uint8Array.from(atob(unsignedTxn), c => c.charCodeAt(0));
const signedTxns = await signTransactions([txnBytes]);

// 3. Submit
const signed = signedTxns[0];
const signedB64 = btoa(String.fromCharCode(...Array.from(signed)));
const submitRes = await fetch("/api/wallet/submit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ signedTxn: signedB64 }),
});
```

---

### `POST /api/wallet/submit`

Submit a wallet-signed transaction to the network.

**Request Body:**

```json
{
  "signedTxn": "gqNzaWfEQP..."
}
```

**Response:**

```json
{
  "success": true,
  "txId": "FSBVCUFS2T7L...",
  "confirmedRound": 61641648,
  "explorerUrl": "https://testnet.explorer.perawallet.app/tx/FSBV..."
}
```

---

## Listing Endpoints

### `GET /api/listings/fetch`

Fetch on-chain listings from the Algorand Indexer. No authentication required.

**Query Parameters:**

| Param | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `type` | string | No | Filter by service type (`cloud-storage`, `api-access`, `compute`, `hosting`) |
| `maxBudget` | number | No | Max price filter (default: 999999) |
| `seller` | string | No | Filter by seller address |

**Response:**

```json
{
  "listings": [
    {
      "txId": "57OCQ43D...",
      "sender": "VW2LM66T...",
      "type": "cloud-storage",
      "service": "Enterprise Cloud Storage",
      "price": 0.5,
      "seller": "cloudmax",
      "description": "Enterprise-grade, Mumbai & Chennai DC...",
      "timestamp": 1711036800000,
      "zkCommitment": "94c2db830c03390b...",
      "round": 61641616
    }
  ],
  "count": 5,
  "network": "testnet"
}
```

---

### `POST /api/listings/create`

Build an unsigned listing transaction. The seller's wallet signs it client-side.

**Request Body:**

```json
{
  "senderAddress": "VW2LM66T...",
  "type": "cloud-storage",
  "service": "My Cloud Service",
  "price": 0.5,
  "description": "High-availability storage"
}
```

**Response:**

```json
{
  "unsignedTxn": "iaNhbXTOAAU...",
  "txnId": "57OCQ43D...",
  "zkSecret": "cf9c53ae08ed96c9...",
  "zkCommitment": "94c2db830c03390b...",
  "listing": {
    "type": "cloud-storage",
    "service": "My Cloud Service",
    "price": 0.5,
    "seller": "VW2LM66T...",
    "description": "High-availability storage",
    "timestamp": 1711036800000,
    "zkCommitment": "94c2db830c03390b..."
  }
}
```

> **Important**: Store the `zkSecret` client-side. It's needed later for on-chain ZK reveal.

---

## Reputation Endpoints

Interact with the AgentReputation smart contract (App ID `757478982` on TestNet).

### `GET /api/reputation/query`

Query an agent's reputation score. No authentication required.

**Query Parameters:**

| Param | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `agent` | string | Yes | Agent's Algorand address |

**Response (registered agent):**

```json
{
  "agent": "VW2LM66T...",
  "appId": 757478982,
  "isRegistered": true,
  "reputation": 8500,
  "feedbackCount": 3,
  "totalScore": 255,
  "isActive": true,
  "registeredAt": 0
}
```

**Response (unregistered):**

```json
{
  "agent": "UNKNOWN...",
  "appId": 757478982,
  "isRegistered": false,
  "reputation": 0,
  "feedbackCount": 0,
  "totalScore": 0,
  "isActive": false
}
```

> **Reputation formula**: `(totalScore × 100) / feedbackCount`. Score range 0-100 per feedback.

---

### `POST /api/reputation/register`

Build an unsigned transaction to register as an agent. Wallet signs it.

**Request Body:**

```json
{
  "senderAddress": "VW2LM66T..."
}
```

**Response:**

```json
{
  "unsignedTxn": "iaNhbXTOAAU...",
  "txnId": "CPWCXNHZ..."
}
```

---

### `POST /api/reputation/feedback`

Build an unsigned transaction to submit feedback for an agent. Wallet signs it.

**Request Body:**

```json
{
  "senderAddress": "AYIFKOGN...",
  "agentAddress": "VW2LM66T...",
  "score": 85
}
```

| Param | Type | Description |
|:------|:-----|:------------|
| `senderAddress` | string | Reviewer's address |
| `agentAddress` | string | Agent being reviewed |
| `score` | number | 0-100 score |

**Response:**

```json
{
  "unsignedTxn": "iaNhbXTOAAU...",
  "txnId": "GAFR4323..."
}
```

---

## Commerce Flow Endpoints

These power the automated A2A TrustMesh AI pipeline. They use server-side accounts for the demo flow.

### `POST /api/intent`

Parse a natural language purchase intent using Groq AI.

**Request Body:**

```json
{
  "message": "Buy cloud storage under 1 ALGO"
}
```

**Response:**

```json
{
  "intent": {
    "serviceType": "cloud-storage",
    "maxBudget": 1,
    "preferences": [],
    "rawMessage": "Buy cloud storage under 1 ALGO"
  },
  "actions": [...]
}
```

---

### `POST /api/init`

Initialize accounts and post seed listings on-chain. Call once before the commerce flow.

**Request Body:** None

**Response:**

```json
{
  "success": true,
  "accounts": {
    "buyer": { "address": "AYIFKOGN...", "balance": 25.54 },
    "sellers": { "cloudmax": { "address": "VW2LM66T...", "balance": 0.11 } }
  },
  "listingTxIds": ["57OCQ43D...", "PAY64MZ3..."],
  "actions": [...]
}
```

---

### `POST /api/discover`

Discover on-chain listings matching a parsed intent via the Algorand Indexer.

**Request Body:**

```json
{
  "intent": {
    "serviceType": "cloud-storage",
    "maxBudget": 1,
    "preferences": []
  }
}
```

**Response:**

```json
{
  "listings": [...],
  "allCount": 5,
  "actions": [...]
}
```

---

### `POST /api/negotiate`

Run AI-powered multi-round negotiation against matched listings.

**Request Body:**

```json
{
  "intent": { "serviceType": "cloud-storage", "maxBudget": 1, "preferences": [] },
  "listings": [...]
}
```

**Response:**

```json
{
  "sessions": [
    {
      "listingTxId": "57OCQ43D...",
      "sellerAddress": "VW2LM66T...",
      "sellerName": "cloudmax",
      "service": "Enterprise Cloud Storage",
      "originalPrice": 0.5,
      "finalPrice": 0.42,
      "accepted": true,
      "messages": [...],
      "zkVerified": true,
      "rounds": 5
    }
  ],
  "bestDeal": { ... },
  "actions": [...]
}
```

---

## Premium Endpoints (x402-Gated)

These require x402 payment via the `X-PAYMENT` header. Auto-handled by `wrapFetchWithPayment()`.

### `GET /api/premium/data`

**Price**: $0.001 USDC

Returns marketplace analytics and aggregated listing data.

### `POST /api/premium/analyze`

**Price**: $0.002 USDC

AI-powered market analysis with pricing recommendations.

**Request Body:**

```json
{
  "query": "What's the best cloud storage deal?"
}
```

---

## Frontend Integration Pattern

### 1. Setup Wallet Provider

```tsx
// layout.tsx
import { AlgorandWalletProvider } from "@/components/wallet-provider";

export default function Layout({ children }) {
  return (
    <AlgorandWalletProvider>
      {children}
    </AlgorandWalletProvider>
  );
}
```

### 2. Connect Wallet

```tsx
import { useWallet } from "@txnlab/use-wallet-react";

function App() {
  const { wallets, activeAccount, signTransactions } = useWallet();

  return (
    <div>
      {wallets.map(w => (
        <button key={w.id} onClick={() => w.connect()}>
          {w.metadata.name}
        </button>
      ))}
      {activeAccount && <p>Connected: {activeAccount.address}</p>}
    </div>
  );
}
```

### 3. Full Payment Flow

```tsx
async function payForService(deal) {
  // Prepare unsigned txn
  const prep = await fetch("/api/wallet/prepare-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      senderAddress: activeAccount.address,
      receiverAddress: deal.sellerAddress,
      amountAlgo: deal.finalPrice,
      note: `Payment for ${deal.service}`,
    }),
  }).then(r => r.json());

  // Sign with wallet
  const txnBytes = Uint8Array.from(atob(prep.unsignedTxn), c => c.charCodeAt(0));
  const signed = await signTransactions([txnBytes]);
  const signedB64 = btoa(String.fromCharCode(...Array.from(signed[0])));

  // Submit
  const result = await fetch("/api/wallet/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedTxn: signedB64 }),
  }).then(r => r.json());

  console.log("Payment confirmed:", result.txId);
}
```

### 4. Check Reputation

```tsx
async function checkReputation(agentAddress: string) {
  const res = await fetch(`/api/reputation/query?agent=${agentAddress}`);
  const data = await res.json();

  if (data.isRegistered) {
    console.log(`Score: ${data.reputation / 100}/100 (${data.feedbackCount} reviews)`);
  }
}
```

### 5. Browse Listings

```tsx
async function browseListings(type?: string) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);

  const res = await fetch(`/api/listings/fetch?${params}`);
  const { listings } = await res.json();
  return listings;
}
```

---

## Error Handling

All endpoints return errors in a consistent format:

```json
{
  "error": "Description of what went wrong"
}
```

HTTP status codes:
- `400` — Missing or invalid parameters
- `500` — Server error (network, contract call failure)
- `402` — Payment required (x402-gated endpoints only)
