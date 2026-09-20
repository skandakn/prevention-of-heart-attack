"use client";

import { useEffect, useRef, useState } from "react";
import { useFitRest } from "@/lib/fit-rest/FitRestContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Send,
  Bot,
  User,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  Dumbbell,
} from "lucide-react";
import type { FitnessIntent, FitRestISIContext } from "@/lib/fit-rest/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FitnessMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  intent?: FitnessIntent;
}

// ─── Quick-prompt chips ───────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  {
    label: "Create workout",
    text: "Create a workout plan based on my fitness goals and available time.",
    intent: "workout_plan" as const,
  },
  {
    label: "Fitness tips",
    text: "Give me 5 practical fitness tips based on my current level and goals.",
    intent: "recommendations" as const,
  },
  {
    label: "Form guidance",
    text: "What exercises can I do with my current equipment?",
  },
  {
    label: "Why these workouts?",
    text: "Why are you suggesting these workouts for me?",
    intent: "explain" as const,
  },
] as const;

// ─── Sub-component: single message bubble ─────────────────────────────────────

function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-2.5 items-start", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
          isUser ? "bg-navy-900 text-white" : "bg-blue-100 text-blue-700"
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-navy-900 text-white rounded-tr-sm"
            : "bg-white border border-navy-100 text-navy-900 rounded-tl-sm shadow-sm"
        )}
      >
        {content}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FitnessAIChat() {
  const { fitnessProfile, recoveryState, isDemoMode } = useFitRest();

  const [messages, setMessages] = useState<FitnessMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ISI context not available for Fitness AI
  const isiContext: FitRestISIContext | null = null;

  // Send message to API
  async function sendMessage(
    text: string,
    intent: FitnessIntent = "chat"
  ): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: FitnessMessage = {
      id: `msg_${Date.now()}_u`,
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
      intent,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    try {
      const apiMessages = [...messages, userMsg]
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/fitness-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          fitnessProfile,
          isiContext,
          recoveryContext: recoveryState,
          intent,
        }),
      });

      if (!res.ok) {
        let errMsg = `Request failed (${res.status})`;
        try {
          const errData = await res.json();
          if (errData?.error) errMsg = errData.error;
        } catch {
          // ignore parse errors
        }
        throw new Error(errMsg);
      }

      const data = await res.json();

      const assistantMsg: FitnessMessage = {
        id: `msg_${Date.now()}_a`,
        role: "assistant",
        content: data.responseText || "No response received.",
        timestamp: Date.now(),
        intent,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "An error occurred. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSend(text?: string) {
    const msg = text ?? input.trim();
    if (!msg || isLoading) return;
    setInput("");
    sendMessage(msg, "chat");
  }

  function handleQuickPrompt(prompt: (typeof QUICK_PROMPTS)[number]) {
    if (isLoading) return;
    sendMessage(
      prompt.text,
      "intent" in prompt ? prompt.intent : "chat"
    );
  }

  function clearMessages() {
    setMessages([]);
    setError(null);
  }

  function clearError() {
    setError(null);
  }

  return (
    <Card className="flex flex-col h-full min-h-[520px]">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm">AI Fitness Coach</CardTitle>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              title="Clear conversation"
              className="flex items-center gap-1 text-[11px] text-navy-400 hover:text-navy-600 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-[11px] text-navy-400">
            Informational wellness guidance — not medical or training advice.
          </p>
          {isDemoMode && (
            <p className="text-[10px] text-amber-600 font-medium">
              ⚠️ Activity data is in demo mode. AI suggestions are based on your
              profile.
            </p>
          )}
        </div>
      </CardHeader>

      {/* ── Message area ──────────────────────────────────────────────── */}
      <CardContent className="flex flex-1 flex-col gap-3 overflow-hidden p-4 pt-0">
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-navy-900">
                  Ask the Fitness Coach anything
                </p>
                <p className="text-xs text-navy-500 mt-0.5">
                  Powered by Gemini AI — suggestions are wellness guidance only.
                </p>
              </div>
              {/* Quick prompts */}
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handleQuickPrompt(p)}
                    className="rounded-full border border-navy-200 bg-white px-3 py-1 text-xs text-navy-700 hover:bg-navy-50 hover:border-navy-400 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex gap-2.5 items-start">
              <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="space-y-1.5 pt-1">
                <Skeleton className="h-3 w-32 rounded-full" />
                <Skeleton className="h-3 w-48 rounded-full" />
                <Skeleton className="h-3 w-24 rounded-full" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-cardiac shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-red-800">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="text-[10px] text-red-600 hover:text-red-900 underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Input row ───────────────────────────────────────────────── */}
        <div className="flex gap-2 pt-1 shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isLoading
                ? "Fitness Coach is thinking…"
                : "Ask about workouts or fitness…"
            }
            disabled={isLoading}
            className="flex-1 rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm text-navy-900 placeholder:text-navy-400 focus:outline-none focus:ring-2 focus:ring-navy-900 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="rounded-xl shrink-0"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick prompts — shown after first message too */}
        {messages.length > 0 && !isLoading && (
          <div className="flex flex-wrap gap-1.5 shrink-0">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p.label}
                onClick={() => handleQuickPrompt(p)}
                className="rounded-full border border-navy-200 bg-white px-2.5 py-0.5 text-[11px] text-navy-600 hover:bg-navy-50 hover:border-navy-400 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
