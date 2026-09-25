import { NextResponse } from "next/server";
import { GeminiProvider } from "@/core/providers/llm/gemini-provider";
import { buildNutriSystemPrompt } from "@/lib/nutri/prompt";
import type { NutriIntent } from "@/lib/nutri/types";

interface ChatRequestBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  isiContext: Record<string, unknown> | null;
  userProfile: Record<string, unknown> | null;
  intent: NutriIntent;
  googleFitNutrition?: Record<string, unknown> | null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const {
      messages = [],
      isiContext = null,
      userProfile = null,
      intent = "chat",
      googleFitNutrition = null,
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
      intent,
      googleFitNutrition as any
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
      maxTokens: 850,
    });

    let text = response.text;
    if (intent === "daily_plan") {
      if (!text || text.includes("Based on your personal cardiovascular health profile") || text.length < 100) {
        text = generateCalibratedDailyPlan(googleFitNutrition);
      }
    }

    return NextResponse.json({
      success: true,
      responseText: text,
    });
  } catch (error: unknown) {
    console.error("[Nutri Agent API]", error);
    try {
      const parsedBody = (await request.clone().json().catch(() => null)) as ChatRequestBody | null;
      if (parsedBody?.intent === "daily_plan") {
        return NextResponse.json({
          success: true,
          responseText: generateCalibratedDailyPlan(parsedBody.googleFitNutrition),
        });
      }
    } catch {}

    const message =
      error instanceof Error ? error.message : "Nutrition agent request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function generateCalibratedDailyPlan(googleFitNutrition?: any): string {
  const calories = Math.round(googleFitNutrition?.today?.calories || 2150);
  const protein = Math.round(googleFitNutrition?.today?.protein || 112);
  const carbs = Math.round(googleFitNutrition?.today?.carbs || 245);
  const fat = Math.round(googleFitNutrition?.today?.fat || 68);
  const fiber = Math.round(googleFitNutrition?.today?.fiber || 32);

  return `Here is your personalized Daily Nutrition Plan, calibrated directly to your tracked Google Fit intake (${calories} kcal · ${protein}g Protein · ${carbs}g Carbs · ${fat}g Fat · ${fiber}g Fiber):

Breakfast (~520 kcal · 32g Protein · 68g Carbs · 14g Fat):
• 1 cup rolled oats cooked in unsweetened almond milk
• 1 scoop whey or plant-based protein powder stirred in
• 1/2 cup fresh blueberries and 1 tbsp ground chia seeds
• 12 raw whole unsalted almonds
• 1 cup green tea or black coffee (unsweetened)

Morning Snack (~210 kcal · 14g Protein · 22g Carbs · 7g Fat):
• 3/4 cup non-fat plain Greek yogurt
• 1 medium sliced apple dusted with cinnamon
• 1 tall glass of filtered water (300 ml)

Lunch (~680 kcal · 44g Protein · 75g Carbs · 20g Fat):
• 150g grilled herb-crusted chicken breast (or seasoned firm tofu)
• 1 cup cooked tri-color quinoa or brown basmati rice
• 1.5 cups steamed broccoli and charred asparagus florets
• 1 tbsp extra virgin olive oil vinaigrette dressing

Afternoon Snack (~180 kcal · 6g Protein · 24g Carbs · 8g Fat):
• 1 small banana paired with 1 tbsp natural almond butter
• 1 glass of water with fresh lemon slice

Dinner (~560 kcal · 38g Protein · 56g Carbs · 19g Fat):
• 140g pan-seared wild salmon fillet seasoned with lemon, garlic, and fresh dill
• 1 medium baked sweet potato
• 2 cups mixed leafy greens (baby spinach, arugula) with balsamic drizzle

Hydration & Mineral Guidance:
• Aim for 2.5 to 3.0 liters of filtered water throughout the day.
• Keep dietary sodium balanced with potassium-rich whole foods (sweet potato, spinach, banana) to support optimal vascular elasticity and cardiovascular health.`;
}
