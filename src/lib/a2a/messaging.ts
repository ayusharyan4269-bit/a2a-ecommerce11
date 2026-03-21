import { v4 as uuidv4 } from "uuid";
import type { X402Message, AgentAction } from "@/lib/agents/types";

export function createX402Message(
  from: string,
  to: string,
  action: X402Message["action"],
  listingTxId: string,
  service: string,
  price: number,
  message: string,
  round: number,
  zkVerified?: boolean
): X402Message {
  return {
    id: uuidv4(),
    from,
    to,
    action,
    payload: { listingTxId, service, price, message, round, zkVerified },
    timestamp: new Date().toISOString(),
  };
}

export function createAction(
  agent: AgentAction["agent"],
  agentName: string,
  type: AgentAction["type"],
  content: string,
  data?: Record<string, unknown>
): AgentAction {
  return {
    id: uuidv4(),
    agent,
    agentName,
    type,
    content,
    data,
    timestamp: new Date().toISOString(),
  };
}
