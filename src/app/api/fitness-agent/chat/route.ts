import { NextResponse } from "next/server";
import { GeminiProvider } from "@/core/providers/llm/gemini-provider";
import { buildFitnessSystemPrompt } from "@/lib/fit-rest/fitness-prompt";
import type {
  FitnessIntent,
  FitnessProfile,
  FitRestISIContext,
  RecoveryState,
} from "@/lib/fit-rest/types";

interface ChatRequestBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  isiContext: unknown;
  fitnessProfile: unknown;
  recoveryContext: unknown;
  intent: unknown;
}

// ── Runtime validation helpers ────────────────────────────────────────────────

const VALID_FITNESS_INTENTS: FitnessIntent[] = [
  "chat",
  "workout_plan",
  "recommendations",
  "explain",
];

function isValidFitnessIntent(intent: unknown): intent is FitnessIntent {
  return (
    typeof intent === "string" &&
    VALID_FITNESS_INTENTS.includes(intent as FitnessIntent)
  );
}

function validateFitnessProfile(
  profile: unknown
): FitnessProfile | null | undefined {
  if (profile === null || profile === undefined) {
    return profile;
  }

  if (typeof profile !== "object" || profile === null) {
    throw new Error("fitnessProfile must be an object or null");
  }

  const p = profile as Record<string, unknown>;

  // Validate required fields
  if (typeof p.isProfileComplete !== "boolean") {
    throw new Error("fitnessProfile.isProfileComplete must be boolean");
  }

  if (
    typeof p.fitnessLevel !== "string" ||
    !["beginner", "intermediate", "advanced"].includes(p.fitnessLevel)
  ) {
    throw new Error("fitnessProfile.fitnessLevel must be valid FitnessLevel");
  }

  if (typeof p.experienceMonths !== "number") {
    throw new Error("fitnessProfile.experienceMonths must be number");
  }

  if (!Array.isArray(p.goals)) {
    throw new Error("fitnessProfile.goals must be array");
  }

  if (!Array.isArray(p.preferredActivities)) {
    throw new Error("fitnessProfile.preferredActivities must be array");
  }

  if (
    typeof p.workoutsPerWeek !== "number" ||
    p.workoutsPerWeek < 1 ||
    p.workoutsPerWeek > 7
  ) {
    throw new Error("fitnessProfile.workoutsPerWeek must be 1-7");
  }

  if (
    typeof p.availableTimeMinutes !== "number" ||
    ![15, 20, 30, 45, 60, 90].includes(p.availableTimeMinutes)
  ) {
    throw new Error(
      "fitnessProfile.availableTimeMinutes must be valid duration"
    );
  }

  if (!Array.isArray(p.availableEquipment)) {
    throw new Error("fitnessProfile.availableEquipment must be array");
  }

  return p as unknown as FitnessProfile;
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
      fitnessProfile = null,
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
    if (!isValidFitnessIntent(intent)) {
      return NextResponse.json(
        { error: "invalid intent value" },
        { status: 400 }
      );
    }

    // Validate and sanitize profile (throws on validation error)
    let validatedProfile: FitnessProfile | null | undefined;
    let validatedISIContext: FitRestISIContext | null | undefined;
    let validatedRecoveryContext: RecoveryState | null | undefined;

    try {
      validatedProfile = validateFitnessProfile(fitnessProfile);
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
    const systemInstruction = buildFitnessSystemPrompt(
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
      error instanceof Error ? error.message : "Fitness agent request failed";
    console.error("[Fitness Agent API]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
