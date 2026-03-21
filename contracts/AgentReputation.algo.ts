import type { uint64 } from "@algorandfoundation/algorand-typescript";
import {
  abimethod,
  Account,
  assert,
  assertMatch,
  BoxMap,
  clone,
  Contract,
  GlobalState,
  Txn,
  Uint64,
} from "@algorandfoundation/algorand-typescript";

/**
 * ERC-8004-inspired Agent Reputation Registry for Algorand
 *
 * Mirrors the Reputation Registry from Ethereum's ERC-8004 (Trustless Agents)
 * standard, adapted natively for the AVM using BoxMap storage.
 *
 * Features:
 *   - Register agents with on-chain identity
 *   - Submit feedback (score 0–100) for any registered agent
 *   - Accumulate reputation from weighted feedback history
 *   - Read current score, total feedback count, and lifetime totals
 *   - Admin pause/unpause + agent deregistration
 *
 * Storage layout (BoxMap, no opt-in required):
 *   agents   → AgentProfile per Account
 *   feedback → FeedbackRecord per Account (latest from each reviewer)
 */

type AgentProfile = {
  totalScore: uint64;
  feedbackCount: uint64;
  registeredAt: uint64;
  isActive: uint64;
}

type FeedbackRecord = {
  reviewer: Account;
  agent: Account;
  score: uint64;
  timestamp: uint64;
}

const MAX_SCORE: uint64 = Uint64(100);
const MIN_SCORE: uint64 = Uint64(0);
const SCALE: uint64 = Uint64(100);

export class AgentReputation extends Contract {
  admin = GlobalState<Account>();
  agentCount = GlobalState<uint64>({ initialValue: Uint64(0) });
  totalFeedbacks = GlobalState<uint64>({ initialValue: Uint64(0) });
  paused = GlobalState<uint64>({ initialValue: Uint64(0) });

  agents = BoxMap<Account, AgentProfile>({ keyPrefix: "a" });

  @abimethod({ allowActions: "NoOp", onCreate: "require" })
  public createApplication(): void {
    this.admin.value = Txn.sender;
  }

  // ── Agent Identity ─────────────────────────────────────────────────

  public registerAgent(): void {
    assert(this.paused.value === Uint64(0), "Contract is paused");
    assert(!this.agents(Txn.sender).exists, "Agent already registered");

    const profile: AgentProfile = {
      totalScore: Uint64(0),
      feedbackCount: Uint64(0),
      registeredAt: Uint64(0),
      isActive: Uint64(1),
    };
    this.agents(Txn.sender).value = clone(profile);
    this.agentCount.value = this.agentCount.value + Uint64(1);
  }

  public deregisterAgent(agent: Account): void {
    assertMatch(Txn, { sender: this.admin.value });
    assert(this.agents(agent).exists, "Agent not registered");

    const profile = clone(this.agents(agent).value);
    const updated = clone(profile);
    updated.isActive = Uint64(0);
    this.agents(agent).value = clone(updated);
  }

  // ── Feedback Submission ────────────────────────────────────────────

  public submitFeedback(agent: Account, score: uint64): void {
    assert(this.paused.value === Uint64(0), "Contract is paused");
    assert(this.agents(agent).exists, "Agent not registered");
    assert(score <= MAX_SCORE, "Score must be 0-100");
    assert(score >= MIN_SCORE, "Score must be 0-100");
    assert(Txn.sender !== agent, "Cannot review yourself");

    const profile = clone(this.agents(agent).value);
    assert(profile.isActive === Uint64(1), "Agent is inactive");

    const updated = clone(profile);
    updated.totalScore = updated.totalScore + score;
    updated.feedbackCount = updated.feedbackCount + Uint64(1);
    this.agents(agent).value = clone(updated);

    this.totalFeedbacks.value = this.totalFeedbacks.value + Uint64(1);
  }

  // ── Reputation Queries ─────────────────────────────────────────────

  @abimethod({ readonly: true })
  public getReputation(agent: Account): uint64 {
    assert(this.agents(agent).exists, "Agent not registered");
    const profile = clone(this.agents(agent).value);
    if (profile.feedbackCount === Uint64(0)) {
      return Uint64(0);
    }
    const reputation: uint64 = (profile.totalScore * SCALE) / profile.feedbackCount;
    return reputation;
  }

  @abimethod({ readonly: true })
  public getAgentProfile(agent: Account): AgentProfile {
    assert(this.agents(agent).exists, "Agent not registered");
    return clone(this.agents(agent).value);
  }

  @abimethod({ readonly: true })
  public getFeedbackCount(agent: Account): uint64 {
    assert(this.agents(agent).exists, "Agent not registered");
    return clone(this.agents(agent).value).feedbackCount;
  }

  @abimethod({ readonly: true })
  public isRegistered(agent: Account): uint64 {
    if (this.agents(agent).exists) {
      return Uint64(1);
    }
    return Uint64(0);
  }

  @abimethod({ readonly: true })
  public getAgentCount(): uint64 {
    return this.agentCount.value;
  }

  @abimethod({ readonly: true })
  public getTotalFeedbacks(): uint64 {
    return this.totalFeedbacks.value;
  }

  // ── Admin ──────────────────────────────────────────────────────────

  public pause(): void {
    assertMatch(Txn, { sender: this.admin.value });
    this.paused.value = Uint64(1);
  }

  public unpause(): void {
    assertMatch(Txn, { sender: this.admin.value });
    this.paused.value = Uint64(0);
  }

  public transferAdmin(newAdmin: Account): void {
    assertMatch(Txn, { sender: this.admin.value });
    this.admin.value = newAdmin;
  }

  @abimethod({ allowActions: "DeleteApplication" })
  public deleteApplication(): void {
    assertMatch(Txn, { sender: this.admin.value });
  }
}
