export interface OnChainListing {
  id?: string;          // DB listing id (new)
  ipfsHash?: string;    // IPFS CID
  txId: string;
  sender: string;
  type: string;
  service: string;
  price: number;
  seller: string;
  description: string;
  timestamp: number;
  zkCommitment?: string;
  round: number;
  sellerName?: string;  // convenience alias
}

export interface ParsedIntent {
  serviceType: string;
  maxBudget: number;
  preferences: string[];
  searchTerms: string[];
  rawMessage: string;
}

export interface X402Message {
  id: string;
  from: string;
  to: string;
  action: "offer" | "counter" | "accept" | "reject";
  payload: {
    listingTxId: string;
    service: string;
    price: number;
    message: string;
    round: number;
    zkVerified?: boolean;
  };
  timestamp: string;
}

export interface NegotiationSession {
  listingTxId: string;
  ipfsHash?: string;    // IPFS CID
  sellerAddress: string;
  sellerName: string;
  service: string;
  originalPrice: number;
  finalPrice: number;
  accepted: boolean;
  messages: X402Message[];
  zkVerified: boolean;
  rounds: number;
  /** On-chain reputation score (0-100) at time of negotiation */
  reputationScore: number;
  /** Composite score used for deal ranking: blend of discount % and reputation */
  dealScore: number;
  /** Optional cryptographic hash representing a commitment to the seller's password */
  zkCommitment?: string;
}

export interface EscrowState {
  status: "idle" | "funded" | "released" | "refunded";
  buyerAddress: string;
  sellerAddress: string;
  amount: number;
  txId: string;
  confirmedRound: number;
}

export interface AgentAction {
  id: string;
  agent: "buyer" | "seller" | "system" | "user";
  agentName: string;
  type: "thinking" | "message" | "negotiation" | "transaction" | "result" | "discovery" | "verification";
  content: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

export interface SessionState {
  sessionId: string;
  intent: ParsedIntent | null;
  listings: OnChainListing[];
  negotiations: NegotiationSession[];
  selectedDeal: NegotiationSession | null;
  escrow: EscrowState;
  actions: AgentAction[];
  phase: "idle" | "parsing" | "initializing" | "discovering" | "negotiating" | "executing" | "completed" | "error";
  autoBuy: boolean;
}
