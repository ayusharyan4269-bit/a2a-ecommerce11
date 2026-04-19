<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/A2A-TrustMesh_AI-white?style=for-the-badge&labelColor=000000">
  <img src="https://img.shields.io/badge/A2A-TrustMesh_AI-000000?style=for-the-badge&labelColor=white" alt="A2A TrustMesh AI" />
</picture>

<br/><br/>

# Autonomous Agents. On-Chain Verification. Real Payments.

<br/>

AI agents autonomously discover services, negotiate prices using LLMs, execute payments through the **Ethereum** blockchain via the x402 protocol, verify sellers via on-chain Escrow logic, and deliver credentials to buyers — all without a single human click.

**Zero intervention. Real credentials. On-chain everything.**

<br/>

<p>
  <img src="https://img.shields.io/badge/Next.js_15-000000?style=flat-square&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Ethereum-3C3C3D?style=flat-square&logo=ethereum&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white" />
  <img src="https://img.shields.io/badge/Groq_Llama_3.3-F97316?style=flat-square&labelColor=2d2d2d" />
  <img src="https://img.shields.io/badge/Hardhat-FFF000?style=flat-square&logo=hardhat&logoColor=black" />
</p>

</div>

---

## ⚡ Overview

Every digital purchase today — cloud storage, API access, compute, streaming accounts — requires a human to search, compare, and pay. **A2A TrustMesh AI** removes that bottleneck entirely. Type what you want, and autonomous agents handle discovery, verification, negotiation, payment, and credential delivery end-to-end on the **Ethereum Sepolia Testnet**.

## 🚀 Quick Start

Ensure you have Node.js 18+ installed.

### 1. Clone & Install
```bash
git clone https://github.com/your-username/a2a-ecommerce11.git
cd a2a-ecommerce11
npm install
```

### 2. Environment Setup
Rename `.env.example` to `.env.local` and configure your keys:
```env
# Ethereum
PRIVATE_KEY="your-metamask-private-key"
SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
ETHERSCAN_API_KEY="your-etherscan-key"

# Database (Supabase)
DATABASE_URL="postgresql://postgres:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres"

# AI
GROQ_API_KEY="your-groq-key"
```

### 3. Database Migration (Supabase)
Push your schema to Supabase:
```bash
npx prisma db push
```

### 4. Run the Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to see the application!

---

## ☁️ Supabase Integration

We recently fully migrated our architecture to **Supabase** for enterprise-grade, highly reliable, and pooled PostgreSQL connection handling. All platform features — Escrow tracking, Listing ingestion, Cryptographic storage, and Reputation points are synced through Supabase.

![Supabase Requests Dashboard](./docs/supabase-metrics.png)
*(Drop your image here into the project and replace this link!)*

---

## 🏛️ Architecture & Smart Contracts

Our architecture heavily relies on the EVM (Ethereum Virtual Machine) using Hardhat.

* **Escrow Contracts:** Funds are securely held inside `A2AEscrow` while delivery of Zero-Knowledge credentials completes.
* **Reputation Tracking:** Agents gain on-chain reputation based on successful negotiations and honest resolutions.
* **x402 Protocol Implementation:** Integrated via `@x402-avm` packages to verify machine-to-machine HTTP payments asynchronously.

### Deploying the Contracts
```bash
npx hardhat compile
npx hardhat run scripts/deploy.ts --network sepolia
```

---

<div align="center">
<br/>

**Built for the Agentic Web**
<br/>
<sub>Powered by Ethereum · Next.js · Supabase · Ethers.js</sub>
</div>
