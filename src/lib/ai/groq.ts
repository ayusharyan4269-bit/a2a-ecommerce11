import Groq from "groq-sdk";
import { ParsedIntent } from "@/lib/agents/types";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = "llama-3.3-70b-versatile";

export async function parseUserIntent(message: string): Promise<ParsedIntent> {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are an AI agent that parses user purchase intents for a digital marketplace.
Extract structured data from the user's message. Respond ONLY with valid JSON, no markdown.

Output format:
{
  "serviceType": string,
  "maxBudget": number (in ALGO, default 100 if not specified),
  "preferences": string[] (extracted preferences like "cheap", "reliable", "fast", "encrypted"),
  "searchTerms": string[] (key product/brand/service words from the query for search matching)
}

IMPORTANT RULES for serviceType:
1. Use these ONLY when the user clearly means one of these infrastructure services:
   - "cloud", "storage", "backup" -> "cloud-storage"
   - "API", "gateway", "endpoint" -> "api-access"
   - "compute", "GPU", "server", "VM" -> "compute"
   - "hosting", "website", "deploy" -> "hosting"
2. For ALL other products (accounts, subscriptions, digital goods, software, etc.),
   use the ACTUAL product/brand name in kebab-case as the serviceType.
   Do NOT force-map them to the categories above.

Examples:
- "Buy Netflix account" -> serviceType: "netflix-account", searchTerms: ["netflix", "account"]
- "Get me a Spotify premium" -> serviceType: "spotify-premium", searchTerms: ["spotify", "premium"]
- "I need cloud storage under 1 ALGO" -> serviceType: "cloud-storage", searchTerms: ["cloud", "storage"]
- "Buy a VPN subscription" -> serviceType: "vpn-subscription", searchTerms: ["vpn", "subscription"]
- "Need cheap hosting" -> serviceType: "hosting", searchTerms: ["hosting"]

searchTerms should contain the key nouns/brands from the query (lowercase), excluding filler words like "buy", "get", "me", "a", "the", "under", "for".`,
      },
      { role: "user", content: message },
    ],
    temperature: 0.1,
    max_tokens: 200,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    return {
      serviceType: parsed.serviceType ?? "cloud-storage",
      maxBudget: parsed.maxBudget ?? 100,
      preferences: parsed.preferences ?? [],
      searchTerms: parsed.searchTerms ?? [],
      rawMessage: message,
    };
  } catch {
    // Fallback: extract basic search terms from the raw message
    const stopWords = new Set(["buy", "get", "me", "a", "the", "under", "for", "i", "need", "want", "algo"]);
    const fallbackTerms = message.toLowerCase().split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w) && !/^\d/.test(w));
    return {
      serviceType: "cloud-storage",
      maxBudget: 100,
      preferences: [],
      searchTerms: fallbackTerms,
      rawMessage: message,
    };
  }
}

export async function generateNegotiationResponse(
  sellerName: string,
  strategy: string,
  buyerOffer: number,
  sellerMin: number,
  sellerBase: number,
  counterPrice: number,
  round: number,
  isAccepting: boolean
): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `You are ${sellerName}, a ${strategy} negotiator for a cloud/API service provider in India.
Generate a SHORT (1-2 sentences) negotiation response. Be conversational and natural.
Strategy: ${strategy === "aggressive" ? "Hold firm on price, make small concessions" : strategy === "moderate" ? "Be reasonable but protect margins" : "Be friendly and willing to negotiate"}`,
      },
      {
        role: "user",
        content: isAccepting
          ? `The buyer offered ${buyerOffer} ALGO and you're accepting at ${counterPrice} ALGO. Respond with acceptance.`
          : `The buyer offered ${buyerOffer} ALGO (round ${round}). Your base is ${sellerBase} ALGO and minimum is ${sellerMin} ALGO. Counter at ${counterPrice} ALGO. Explain why your service is worth it.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 100,
  });

  return completion.choices[0]?.message?.content ?? `I can offer this at ${counterPrice} ALGO.`;
}

export async function generateDealSummary(
  sellerName: string,
  serviceType: string,
  finalPrice: number,
  originalPrice: number,
  rounds: number
): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a concise deal analyst. Summarize the completed deal in 2-3 sentences. Mention the savings percentage and number of negotiation rounds.",
      },
      {
        role: "user",
        content: `Deal completed: ${serviceType} from ${sellerName}. Original price: ${originalPrice} ALGO, Final: ${finalPrice} ALGO. Took ${rounds} rounds.`,
      },
    ],
    temperature: 0.5,
    max_tokens: 100,
  });

  return (
    completion.choices[0]?.message?.content ??
    `Deal closed with ${sellerName} at ${finalPrice} ALGO (${Math.round(((originalPrice - finalPrice) / originalPrice) * 100)}% savings).`
  );
}
