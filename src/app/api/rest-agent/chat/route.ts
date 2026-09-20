import { NextResponse } from "next/server";
import { GeminiProvider } from "@/core/providers/llm/gemini-provider";
import { buildRestSystemPrompt } from "@/lib/fit-rest/rest-prompt";
import type {
  RestIntent,
  RestProfile,
  FitRestISIContext,
  RecoveryState,
} from "@/lib/fit-rest/types";

interface ChatRequestBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  isiContext: unknown;
  restProfile: unknown;
  recoveryContext: unknown;
  intent: unknown;
}

// ── Runtime validation helpers ────────────────────────────────────────────────

const VALID_REST_INTENTS: RestIntent[] = [
  "chat",
  "bedtime_routine",
  "recommendations",
  "explain",
];

function isValidRestIntent(intent: unknown): intent is RestIntent {
  return (
    typeof intent === "string" &&
    VALID_REST_INTENTS.includes(intent as RestIntent)
  );
}

function validateRestProfile(
  profile: unknown
): RestProfile | null | undefined {
  if (profile === null || profile === undefined) {
    return profile;
  }

  if (typeof profile !== "object" || profile === null) {
    throw new Error("restProfile must be an object or null");
  }

  const p = profile as Record<string, unknown>;

  // Validate required fields
  if (typeof p.isProfileComplete !== "boolean") {
    throw new Error("restProfile.isProfileComplete must be boolean");
  }

  if (
    typeof p.targetSleepHours !== "number" ||
    ![6, 7, 8, 9].includes(p.targetSleepHours)
  ) {
    throw new Error("restProfile.targetSleepHours must be 6, 7, 8, or 9");
  }

  if (typeof p.typicalBedtime !== "string") {
    throw new Error("restProfile.typicalBedtime must be string");
  }

  if (typeof p.typicalWakeTime !== "string") {
    throw new Error("restProfile.typicalWakeTime must be string");
  }

  if (!Array.isArray(p.sleepGoals)) {
    throw new Error("restProfile.sleepGoals must be array");
  }

  if (!Array.isArray(p.recoveryGoals)) {
    throw new Error("restProfile.recoveryGoals must be array");
  }

  if (!Array.isArray(p.sleepChallenges)) {
    throw new Error("restProfile.sleepChallenges must be array");
  }

  if (!Array.isArray(p.preferredRecoveryActivities)) {
    throw new Error("restProfile.preferredRecoveryActivities must be array");
  }

  return p as unknown as RestProfile;
}

function validateISIContext(
  ctx: unknown
): FitRestISIContext | null | undefined {
  if (ctx === null || ctx === undefined) {
    return ctx;
  }

  if (typeof ctx !== "object" || ctx === null) {
    throw new Error("isiContext must be an object or null");
  }

  const c = ctx as Record<string, unknown>;

  // Validate required fields (read-only from BeatAhead ISI system)
  if (typeof c.score !== "number") {
    throw new Error("isiContext.score must be number");
  }

  if (
    typeof c.trend !== "string" ||
    !["increasing", "decreasing", "stable"].includes(c.trend)
  ) {
    throw new Error("isiContext.trend must be valid trend");
  }

  if (typeof c.label !== "string") {
    throw new Error("isiContext.label must be string");
  }

  if (typeof c.scenario !== "string") {
    throw new Error("isiContext.scenario must be string");
  }

  if (typeof c.signalQuality !== "number") {
    throw new Error("isiContext.signalQuality must be number");
  }

  return c as unknown as FitRestISIContext;
}

function validateRecoveryContext(
  recovery: unknown
): RecoveryState | null | undefined {
  if (recovery === null || recovery === undefined) {
    return recovery;
  }

  if (typeof recovery !== "object" || recovery === null) {
    throw new Error("recoveryContext must be an object or null");
  }

  const r = recovery as Record<string, unknown>;

  // Validate required fields
  if (typeof r.workoutCount !== "number") {
    throw new Error("recoveryContext.workoutCount must be number");
  }

  if (typeof r.intenseWorkoutCount !== "number") {
    throw new Error("recoveryContext.intenseWorkoutCount must be number");
  }

  if (typeof r.totalWorkoutMinutes !== "number") {
    throw new Error("recoveryContext.totalWorkoutMinutes must be number");
  }

  if (typeof r.avgSleepHours !== "number") {
    throw new Error("recoveryContext.avgSleepHours must be number");
  }

  if (typeof r.sleepConsistencyPercent !== "number") {
    throw new Error("recoveryContext.sleepConsistencyPercent must be number");
  }

  if (typeof r.sleepDebtHours !== "number") {
    throw new Error("recoveryContext.sleepDebtHours must be number");
  }

  if (typeof r.recentWorkoutSummary !== "string") {
    throw new Error("recoveryContext.recentWorkoutSummary must be string");
  }

  if (typeof r.recentSleepSummary !== "string") {
    throw new Error("recoveryContext.recentSleepSummary must be string");
  }

  return r as unknown as RecoveryState;
}

// ── API route handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const {
      messages = [],
      isiContext = null,
      restProfile = null,
      recoveryContext = null,
      intent = "chat",
    } = body;

    // Validate messages
    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages must be an array" },
        { status: 400 }
      );
    }

    // Validate intent
    if (!isValidRestIntent(intent)) {
      return NextResponse.json(
        { error: "invalid intent value" },
        { status: 400 }
      );
    }

    // Validate and sanitize profile (throws on validation error)
    let validatedProfile: RestProfile | null | undefined;
    let validatedISIContext: FitRestISIContext | null | undefined;
    let validatedRecoveryContext: RecoveryState | null | undefined;

    try {
      validatedProfile = validateRestProfile(restProfile);
      validatedISIContext = validateISIContext(isiContext);
      validatedRecoveryContext = validateRecoveryContext(recoveryContext);
    } catch (validationError: unknown) {
      const message =
        validationError instanceof Error
          ? validationError.message
          : "Invalid request data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

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
      return NextResponse.json(
        { error: "last message must be from user" },
        { status: 400 }
      );
    }

    // ── Build system prompt server-side (GEMINI_API_KEY never leaves the server)
    const systemInstruction = buildRestSystemPrompt(
      validatedProfile,
      intent,
      validatedISIContext,
      validatedRecoveryContext
    );

    // ── Instantiate provider — reads GEMINI_API_KEY from process.env
    const provider = new GeminiProvider();

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
      error instanceof Error ? error.message : "Rest agent request failed";
    console.error("[Rest Agent API]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
