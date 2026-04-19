import hre from "hardhat";
import fs from "fs";
import path from "path";

const { ethers, network } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("─────────────────────────────────────────────");
  console.log(`Network  : ${network.name}`);
  console.log(`Deployer : ${deployer.address}`);
  console.log(`Balance  : ${ethers.formatEther(balance)} ETH`);
  console.log("─────────────────────────────────────────────\n");

  if (balance === 0n) {
    throw new Error("Deployer wallet has 0 ETH. Fund it on Sepolia before deploying.");
  }

  // ── Deploy A2AMarket ────────────────────────────────────────────────────────
  console.log("Deploying A2AMarket...");
  const Market = await ethers.getContractFactory("A2AMarket");
  const market  = await Market.deploy();
  await market.waitForDeployment();

  const marketAddr = await market.getAddress();
  console.log(`✅ A2AMarket  → ${marketAddr}`);

  // ── Deploy A2AEscrow (legacy, keep for backward compat) ─────────────────────
  console.log("Deploying A2AEscrow (legacy)...");
  const Escrow = await ethers.getContractFactory("A2AEscrow");
  const escrow  = await Escrow.deploy();
  await escrow.waitForDeployment();

  const escrowAddr = await escrow.getAddress();
  console.log(`✅ A2AEscrow  → ${escrowAddr}`);

  // ── Auto-patch .env.local ───────────────────────────────────────────────────
  const envPath = path.join(__dirname, "../.env.local");
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  const patch = (key: string, val: string) => {
    const line = `${key}=${val}`;
    env = env.includes(key)
      ? env.replace(new RegExp(`${key}=.*`), line)
      : env + `\n${line}`;
  };

  patch("NEXT_PUBLIC_MARKET_ADDRESS",  marketAddr);
  patch("NEXT_PUBLIC_ESCROW_ADDRESS",  escrowAddr);

  fs.writeFileSync(envPath, env.trimEnd() + "\n");

  console.log("\n📝 .env.local updated:");
  console.log(`   NEXT_PUBLIC_MARKET_ADDRESS  = ${marketAddr}`);
  console.log(`   NEXT_PUBLIC_ESCROW_ADDRESS  = ${escrowAddr}`);

  // ── Etherscan verification hint ─────────────────────────────────────────────
  if (network.name === "sepolia") {
    console.log("\n🔍 Verify contracts on Etherscan:");
    console.log(`   npx hardhat verify --network sepolia ${marketAddr}`);
    console.log(`   npx hardhat verify --network sepolia ${escrowAddr}`);
  }

  console.log("\n✨ Deployment complete. Restart your dev server to activate.\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
