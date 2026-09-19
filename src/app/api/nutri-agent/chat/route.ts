import { NextResponse } from "next/server";
import { GeminiProvider } from "@/core/providers/llm/gemini-provider";
import { buildNutriSystemPrompt } from "@/lib/nutri/prompt";
import type { NutriIntent } from "@/lib/nutri/types";

interface ChatRequestBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  isiContext: Record<string, unknown> | null;
  userProfile: Record<string, unknown> | null;
  intent: NutriIntent;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const {
      messages = [],
      isiContext = null,
      userProfile = null,
      intent = "chat",
    } = body;

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages must be an array" },
        { status: 400 }
      );
    }

    // ── Build system prompt server-side (GEMINI_API_KEY never leaves the server)
    const systemInstruction = buildNutriSystemPrompt(
      isiContext as any,
      userProfile as any,
      intent
    );

    // ── Instantiate provider — reads GEMINI_API_KEY from process.env
    const provider = new GeminiProvider();

    // ── Sanitise messages: only user/assistant roles, non-empty content
    const llmMessages = messages
      .filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0
      )
      .map((m) => ({ role: m.role, content: m.content.trim() }));

    // Ensure the final message is from the user
    if (
      llmMessages.length === 0 ||
      llmMessages[llmMessages.length - 1]?.role !== "user"
    ) {
      llmMessages.push({
        role: "user",
        content: "Please provide nutrition guidance based on my profile.",
      });
    }

    const response = await provider.generateResponse({
      messages: llmMessages,
      systemInstruction,
      temperature: 0.7,
      maxTokens: 700,
    });

    return NextResponse.json({
      success: true,
      responseText: response.text,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Nutrition agent request failed";
    console.error("[Nutri Agent API]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
