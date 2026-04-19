import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk/index.mjs";

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

export async function POST(req: NextRequest) {
  try {
    const { serviceType, maxBudget } = await req.json();

    if (!groq) {
      return NextResponse.json({
        status: "success",
        analysis: { recommendation: "Automated test logic", expectedDiscount: "10-20%", riskLevel: "low" },
        x402: {
          protocol: "x402 v2",
          note: "This AI analysis was paid for via x402 micro-payment on Algorand TestNet.",
        },
      });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a market analyst for Indian cloud/tech services. Give a brief JSON analysis with fields: recommendation, expectedDiscount, bestTimeToNegotiate, riskLevel. Keep it concise.",
        },
        {
          role: "user",
          content: `Analyze market for "${serviceType ?? "cloud-storage"}" services with budget ${maxBudget ?? 100} ALGO.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let analysis;
    try {
      analysis = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch {
      analysis = { recommendation: raw, expectedDiscount: "10-20%", riskLevel: "low" };
    }

    return NextResponse.json({
      status: "success",
      analysis,
      x402: {
        protocol: "x402 v2",
        note: "This AI analysis was paid for via x402 micro-payment on Algorand TestNet.",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
