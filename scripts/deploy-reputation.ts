import { AlgorandClient, algo, Config } from "@algorandfoundation/algokit-utils";
import algosdk from "algosdk";
import dotenv from "dotenv";
import { AgentReputationFactory } from "../artifacts/agent_reputation/AgentReputationClient";

dotenv.config();
Config.configure({ logger: { error: () => {}, warn: () => {}, info: () => {}, verbose: () => {}, debug: () => {} } });

const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  cyan: "\x1b[36m", gray: "\x1b[90m", bgMagenta: "\x1b[45m", bgGreen: "\x1b[42m",
};

async function main() {
  console.log(`\n${c.bgMagenta}${c.bold}  Deploy AgentReputation to Algorand TestNet                  ${c.reset}\n`);

  const privKey = process.env.AVM_PRIVATE_KEY;
  if (!privKey) { console.error(`${c.red}Missing AVM_PRIVATE_KEY in .env${c.reset}`); process.exit(1); }

  const keyBytes = Buffer.from(privKey, "base64");
  const admin = algosdk.mnemonicToSecretKey(algosdk.secretKeyToMnemonic(keyBytes));
  const adminAddr = admin.addr.toString();

  const algorand = AlgorandClient.testNet();
  algorand.setSignerFromAccount(admin);

  console.log(`  ${c.gray}Admin address:${c.reset}  ${adminAddr}`);

  const info = await algorand.account.getInformation(adminAddr);
  const balance = Number(info.balance) / 1_000_000;
  console.log(`  ${c.gray}Admin balance:${c.reset}  ${balance} ALGO`);

  if (balance < 2) {
    console.error(`\n  ${c.red}${c.bold}Insufficient balance!${c.reset} Need at least 2 ALGO.`);
    console.log(`  ${c.yellow}Fund at: https://lora.algokit.io/testnet/fund${c.reset}`);
    console.log(`  ${c.yellow}Address: ${adminAddr}${c.reset}\n`);
    process.exit(1);
  }

  console.log(`\n  ${c.cyan}Deploying contract...${c.reset}`);
  const factory = algorand.client.getTypedAppFactory(AgentReputationFactory, { defaultSender: adminAddr });
  const { result, appClient } = await factory.send.create.createApplication({ args: [] });

  const appId = appClient.appId;
  const appAddr = appClient.appAddress.toString();

  console.log(`  ${c.green}${c.bold}✓ Deployed!${c.reset}`);
  console.log(`  ${c.gray}App ID:${c.reset}         ${c.bold}${appId}${c.reset}`);
  console.log(`  ${c.gray}App Address:${c.reset}    ${appAddr}`);
  console.log(`  ${c.gray}Tx ID:${c.reset}          ${result.transaction.txID()}`);
  console.log(`  ${c.gray}Explorer:${c.reset}       https://lora.algokit.io/testnet/application/${appId}`);

  console.log(`\n  ${c.cyan}Funding app for BoxMap MBR...${c.reset}`);
  await algorand.send.payment({ sender: adminAddr, receiver: appAddr, amount: algo(0.5) });
  console.log(`  ${c.green}✓ App funded with 0.5 ALGO${c.reset}`);

  console.log(`\n${c.bgGreen}${c.bold}  Add this to your .env:                                      ${c.reset}`);
  console.log(`  REPUTATION_APP_ID=${appId}`);
  console.log(`  REPUTATION_APP_ADDR=${appAddr}\n`);
}

main().catch((err) => {
  console.error(`\n  ${c.red}Error: ${err.message || err}${c.reset}`);
  process.exit(1);
});
