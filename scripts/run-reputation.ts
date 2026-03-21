import { AlgorandClient, algo, Config } from "@algorandfoundation/algokit-utils";
import algosdk from "algosdk";
import dotenv from "dotenv";
import { AgentReputationFactory, AgentReputationClient } from "../artifacts/agent_reputation/AgentReputationClient";

dotenv.config();

Config.configure({ logger: { error: () => {}, warn: () => {}, info: () => {}, verbose: () => {}, debug: () => {} } });

type NetworkMode = "localnet" | "testnet";
const NETWORK: NetworkMode = (process.env.ALGORAND_NETWORK?.toLowerCase() === "testnet") ? "testnet" : "localnet";

const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m",
  white: "\x1b[37m", gray: "\x1b[90m",
  bgBlue: "\x1b[44m", bgGreen: "\x1b[42m", bgYellow: "\x1b[43m",
  bgMagenta: "\x1b[45m", bgCyan: "\x1b[46m", bgRed: "\x1b[41m",
};

function banner(text: string, bg = c.bgBlue) {
  const pad = " ".repeat(Math.max(0, 60 - text.length));
  console.log(`\n${bg}${c.bold}  ${text}${pad}${c.reset}`);
}
function section(text: string) { console.log(`\n${c.cyan}${c.bold}▸ ${text}${c.reset}`); }
function info(label: string, value: string) { console.log(`  ${c.gray}${label.padEnd(22)}${c.reset} ${value}`); }
function success(text: string) { console.log(`  ${c.green}✓ ${text}${c.reset}`); }
function warn(text: string) { console.log(`  ${c.yellow}⚠ ${text}${c.reset}`); }
function fail(text: string) { console.log(`  ${c.red}✗ ${text}${c.reset}`); }
function divider() { console.log(`  ${c.gray}${"─".repeat(56)}${c.reset}`); }

function score(val: number) {
  if (val >= 80) return `${c.green}${c.bold}${val}/100${c.reset} ★★★★★`;
  if (val >= 60) return `${c.yellow}${c.bold}${val}/100${c.reset} ★★★★☆`;
  if (val >= 40) return `${c.yellow}${val}/100${c.reset} ★★★☆☆`;
  return `${c.red}${val}/100${c.reset} ★★☆☆☆`;
}

async function main() {
  banner("ERC-8004 Agent Reputation Registry on Algorand", c.bgMagenta);
  console.log(`  ${c.dim}Inspired by Ethereum ERC-8004 Trustless Agents standard${c.reset}`);
  console.log(`  ${c.dim}Adapted natively for the Algorand Virtual Machine (AVM)${c.reset}`);
  info("Network", NETWORK === "testnet" ? `${c.green}TestNet${c.reset}` : `${c.blue}LocalNet${c.reset}`);

  // ── Step 1: Initialize Algorand client + accounts ───────────────────

  banner("Step 1 · Initialize Accounts", c.bgCyan);

  const algorand = NETWORK === "testnet"
    ? AlgorandClient.testNet()
    : AlgorandClient.defaultLocalNet();

  let adminAddr: string;
  let agent1Addr: string;
  let agent2Addr: string;
  let reviewerAddr: string;

  if (NETWORK === "testnet") {
    const privKey = process.env.AVM_PRIVATE_KEY;
    if (!privKey) throw new Error("AVM_PRIVATE_KEY required for TestNet");

    const keyBytes = Buffer.from(privKey, "base64");
    const adminAccount = algosdk.mnemonicToSecretKey(algosdk.secretKeyToMnemonic(keyBytes));
    adminAddr = adminAccount.addr.toString();
    algorand.setSignerFromAccount(adminAccount);

    const agent1Account = algosdk.generateAccount();
    const agent2Account = algosdk.generateAccount();
    const reviewerAccount = algosdk.generateAccount();
    agent1Addr = agent1Account.addr.toString();
    agent2Addr = agent2Account.addr.toString();
    reviewerAddr = reviewerAccount.addr.toString();

    algorand.setSignerFromAccount(agent1Account);
    algorand.setSignerFromAccount(agent2Account);
    algorand.setSignerFromAccount(reviewerAccount);

    section("Funding ephemeral accounts from admin");
    for (const [label, addr] of [["Agent 1", agent1Addr], ["Agent 2", agent2Addr], ["Reviewer", reviewerAddr]]) {
      await algorand.send.payment({ sender: adminAddr, receiver: addr, amount: algo(0.15) });
      success(`Funded ${label}: ${addr.slice(0, 12)}...`);
    }
  } else {
    const dispenser = await algorand.account.localNetDispenser();
    const admin = algorand.account.random();
    const agent1 = algorand.account.random();
    const agent2 = algorand.account.random();
    const reviewer = algorand.account.random();

    adminAddr = admin.addr.toString();
    agent1Addr = agent1.addr.toString();
    agent2Addr = agent2.addr.toString();
    reviewerAddr = reviewer.addr.toString();

    for (const addr of [adminAddr, agent1Addr, agent2Addr, reviewerAddr]) {
      await algorand.send.payment({ sender: dispenser.addr, receiver: addr, amount: algo(10) });
    }
    success("All accounts funded via LocalNet dispenser");
  }

  info("Admin", `${adminAddr.slice(0, 16)}...`);
  info("Agent 1", `${agent1Addr.slice(0, 16)}...`);
  info("Agent 2", `${agent2Addr.slice(0, 16)}...`);
  info("Reviewer", `${reviewerAddr.slice(0, 16)}...`);

  // ── Step 2: Deploy or connect to AgentReputation contract ──────────

  banner("Step 2 · AgentReputation Contract", c.bgGreen);

  let appClient: InstanceType<typeof AgentReputationClient>;
  let appId: bigint;
  let appAddr: string;

  const existingAppId = process.env.REPUTATION_APP_ID;

  if (NETWORK === "testnet" && existingAppId) {
    appClient = algorand.client.getTypedAppClientById(AgentReputationClient, {
      appId: BigInt(existingAppId),
      defaultSender: adminAddr,
    });
    appId = BigInt(existingAppId);
    appAddr = appClient.appAddress.toString();
    success(`Connected to existing contract`);
    info("App ID", `${appId}`);
    info("App Address", appAddr.slice(0, 16) + "...");
  } else {
    const factory = algorand.client.getTypedAppFactory(AgentReputationFactory, {
      defaultSender: adminAddr,
    });
    const { result: createResult, appClient: rawClient } = await factory.send.create.createApplication({ args: [] });
    appClient = rawClient;
    appId = appClient.appId;
    appAddr = appClient.appAddress.toString();

    success(`Contract deployed!`);
    info("App ID", `${appId}`);
    info("App Address", appAddr.slice(0, 16) + "...");
    info("Transaction", createResult.transaction.txID().slice(0, 24) + "...");

    section("Funding app account for BoxMap MBR");
    await algorand.send.payment({ sender: adminAddr, receiver: appAddr, amount: algo(1) });
    success("App funded with 1 ALGO for box storage");
  }

  // ── Step 3: Register Agents ─────────────────────────────────────────

  banner("Step 3 · Register Agents (Identity Layer)", c.bgCyan);
  console.log(`  ${c.dim}ERC-8004 §3.1: Agents must be registered before receiving feedback${c.reset}`);

  function agentBox(addr: string) {
    return { appId, name: Buffer.concat([Buffer.from("a"), algosdk.decodeAddress(addr).publicKey]) };
  }

  await appClient.send.registerAgent({ sender: agent1Addr, boxReferences: [agentBox(agent1Addr)] });
  success(`Agent 1 registered: ${agent1Addr.slice(0, 16)}...`);

  await appClient.send.registerAgent({ sender: agent2Addr, boxReferences: [agentBox(agent2Addr)] });
  success(`Agent 2 registered: ${agent2Addr.slice(0, 16)}...`);

  const countResult = await appClient.send.getAgentCount({});
  const agentCount = Number(countResult.return);
  info("Total agents", `${agentCount}`);

  section("Verify registration");
  const reg1 = await appClient.send.isRegistered({ args: { agent: agent1Addr }, boxReferences: [agentBox(agent1Addr)] });
  const reg2 = await appClient.send.isRegistered({ args: { agent: agent2Addr }, boxReferences: [agentBox(agent2Addr)] });
  info("Agent 1 registered?", Number(reg1.return) === 1 ? `${c.green}Yes${c.reset}` : `${c.red}No${c.reset}`);
  info("Agent 2 registered?", Number(reg2.return) === 1 ? `${c.green}Yes${c.reset}` : `${c.red}No${c.reset}`);

  // ── Step 4: Submit Feedback (Reputation Building) ───────────────────

  banner("Step 4 · Submit Feedback (Reputation Layer)", c.bgYellow);
  console.log(`  ${c.dim}ERC-8004 §3.2: Scores range 0-100, self-review forbidden${c.reset}`);

  const feedbacks = [
    { from: reviewerAddr, fromLabel: "Reviewer", to: agent1Addr, toLabel: "Agent 1", score: 85 },
    { from: adminAddr,    fromLabel: "Admin",    to: agent1Addr, toLabel: "Agent 1", score: 92 },
    { from: agent2Addr,   fromLabel: "Agent 2",  to: agent1Addr, toLabel: "Agent 1", score: 78 },
    { from: reviewerAddr, fromLabel: "Reviewer", to: agent2Addr, toLabel: "Agent 2", score: 65 },
    { from: adminAddr,    fromLabel: "Admin",    to: agent2Addr, toLabel: "Agent 2", score: 55 },
    { from: agent1Addr,   fromLabel: "Agent 1",  to: agent2Addr, toLabel: "Agent 2", score: 70 },
  ];

  for (const fb of feedbacks) {
    await appClient.send.submitFeedback({
      sender: fb.from,
      args: { agent: fb.to, score: BigInt(fb.score) },
      boxReferences: [agentBox(fb.to)],
    });
    console.log(`  ${c.magenta}→${c.reset} ${fb.fromLabel} rated ${fb.toLabel}: ${score(fb.score)}`);
  }

  divider();
  const totalFb = await appClient.send.getTotalFeedbacks({});
  info("Total feedbacks on-chain", `${Number(totalFb.return)}`);

  // ── Step 5: Query Reputation ────────────────────────────────────────

  banner("Step 5 · Query Reputation Scores", c.bgGreen);
  console.log(`  ${c.dim}ERC-8004 §3.3: Weighted average = (totalScore × 100) / feedbackCount${c.reset}`);

  for (const [label, addr] of [["Agent 1", agent1Addr], ["Agent 2", agent2Addr]] as const) {
    section(label);
    const rep = await appClient.send.getReputation({ args: { agent: addr }, boxReferences: [agentBox(addr)] });
    const profile = await appClient.send.getAgentProfile({ args: { agent: addr }, boxReferences: [agentBox(addr)] });
    const p = profile.return as unknown as { totalScore: bigint; feedbackCount: bigint; registeredAt: bigint; isActive: bigint };

    const repVal = Number(rep.return);
    const avgScore = Number(p.totalScore) / Number(p.feedbackCount);

    info("Total Score", `${p.totalScore}`);
    info("Feedback Count", `${p.feedbackCount}`);
    info("Average", score(Math.round(avgScore)));
    info("Reputation (×100)", `${repVal}`);
    info("Status", Number(p.isActive) === 1 ? `${c.green}Active${c.reset}` : `${c.red}Inactive${c.reset}`);
  }

  // ── Step 6: Admin Actions ───────────────────────────────────────────

  banner("Step 6 · Admin Controls", c.bgRed);
  console.log(`  ${c.dim}ERC-8004 §3.4: Admin can pause, deregister agents${c.reset}`);

  section("Pause contract");
  await appClient.send.pause({ sender: adminAddr });
  success("Contract paused by admin");

  section("Attempt feedback while paused");
  try {
    await appClient.send.submitFeedback({
      sender: reviewerAddr,
      args: { agent: agent1Addr, score: BigInt(90) },
      boxReferences: [agentBox(agent1Addr)],
    });
    fail("Should have been rejected!");
  } catch {
    success("Correctly rejected: Contract is paused");
  }

  section("Unpause contract");
  await appClient.send.unpause({ sender: adminAddr });
  success("Contract unpaused");

  section("Deregister Agent 2");
  await appClient.send.deregisterAgent({ sender: adminAddr, args: { agent: agent2Addr }, boxReferences: [agentBox(agent2Addr)] });
  warn(`Agent 2 deregistered by admin`);

  const profile2After = await appClient.send.getAgentProfile({ args: { agent: agent2Addr }, boxReferences: [agentBox(agent2Addr)] });
  const p2 = profile2After.return as unknown as { isActive: bigint };
  info("Agent 2 status", Number(p2.isActive) === 0 ? `${c.red}Inactive${c.reset}` : `Active`);

  section("Attempt feedback on inactive agent");
  try {
    await appClient.send.submitFeedback({
      sender: reviewerAddr,
      args: { agent: agent2Addr, score: BigInt(50) },
      boxReferences: [agentBox(agent2Addr)],
    });
    fail("Should have been rejected!");
  } catch {
    success("Correctly rejected: Agent is inactive");
  }

  // ── Step 7: Final Summary ───────────────────────────────────────────

  banner("Final Summary · ERC-8004 on Algorand", c.bgMagenta);

  divider();
  console.log(`  ${c.bold}ERC-8004 Feature Mapping${c.reset}`);
  divider();
  console.log(`  ${c.white}Identity Registry    ${c.gray}→${c.reset} BoxMap<Account, AgentProfile>`);
  console.log(`  ${c.white}Reputation Registry  ${c.gray}→${c.reset} On-chain score accumulation (0-100)`);
  console.log(`  ${c.white}Feedback Submission  ${c.gray}→${c.reset} ABI method with score validation`);
  console.log(`  ${c.white}Self-Review Guard    ${c.gray}→${c.reset} assert(Txn.sender !== agent)`);
  console.log(`  ${c.white}Admin Pause/Unpause  ${c.gray}→${c.reset} GlobalState<uint64> circuit breaker`);
  console.log(`  ${c.white}Agent Deregistration ${c.gray}→${c.reset} isActive flag (soft delete)`);
  divider();

  info("Contract App ID", `${appId}`);
  info("Network", NETWORK);
  info("Total Agents", `${agentCount}`);
  info("Total Feedbacks", `${Number(totalFb.return)}`);

  console.log(`\n  ${c.green}${c.bold}✓ ERC-8004 Reputation Registry fully operational on Algorand${c.reset}`);
  console.log(`  ${c.dim}All state stored on-chain via ARC-56 typed smart contract${c.reset}\n`);

  if (NETWORK === "localnet") {
    section("Cleaning up (delete application)");
    await appClient.send.delete.deleteApplication({ sender: adminAddr });
    success("Application deleted");
  } else {
    console.log(`\n  ${c.dim}Contract persisted on TestNet — App ID: ${appId}${c.reset}`);
    console.log(`  ${c.dim}Explorer: https://lora.algokit.io/testnet/application/${appId}${c.reset}`);
  }
}

main().catch((err) => {
  console.error(`\n${c.red}${c.bold}Error:${c.reset}`, err.message || err);
  process.exit(1);
});
