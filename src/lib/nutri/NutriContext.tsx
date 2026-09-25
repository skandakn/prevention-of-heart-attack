"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  NutriISIContext,
  NutriIntent,
  NutriMessage,
  NutriProfile,
} from "./types";
import { DEFAULT_NUTRI_PROFILE } from "./types";

const STORAGE_KEY = "beatahead-nutri-profile";

// ─── Context shape ────────────────────────────────────────────────────────────

interface NutriContextValue {
  profile: NutriProfile;
  updateProfile: (partial: Partial<NutriProfile>) => void;
  messages: NutriMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (
    text: string,
    intent?: NutriIntent,
    isiContext?: NutriISIContext
  ) => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
}

const NutriContext = createContext<NutriContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

const INITIAL_NUTRI_MESSAGE: NutriMessage = {
  id: "msg_init_nutri",
  role: "assistant",
  content: "Hello! I'm your BeatAhead Nutrition Assistant. I'm here to provide heart-healthy dietary guidance, meal planning, and nutrition insights tailored to your cardiovascular health profile. What can I help you with today?",
  timestamp: Date.now(),
  intent: "chat",
};

export function NutriProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<NutriProfile>(DEFAULT_NUTRI_PROFILE);
  const [messages, setMessages] = useState<NutriMessage[]>([INITIAL_NUTRI_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref to messages to avoid stale closures in sendMessage
  const messagesRef = useRef<NutriMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Keep a ref to profile for the same reason
  const profileRef = useRef<NutriProfile>(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // ─── Load profile from localStorage on mount ────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<NutriProfile>;
        setProfile((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Silently ignore storage errors
    }
  }, []);

  // ─── Update profile + persist to localStorage ───────────────────────────

  const updateProfile = useCallback((partial: Partial<NutriProfile>) => {
    setProfile((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Silently ignore storage errors
      }
      return updated;
    });
  }, []);

  // ─── Send message to the server-side Nutri Agent API ───────────────────

  const sendMessage = useCallback(
    async (
      text: string,
      intent: NutriIntent = "chat",
      isiContext?: NutriISIContext
    ) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: NutriMessage = {
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
        // Build API payload from the *current* (ref-fresh) message history
        const history = messagesRef.current;
        const apiMessages = [...history, userMsg]
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch("/api/nutri-agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            isiContext: isiContext ?? null,
            userProfile: profileRef.current,
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

        const assistantMsg: NutriMessage = {
          id: `msg_${Date.now()}_a`,
          role: "assistant",
          content: data.responseText || "No response received.",
          timestamp: Date.now(),
          intent,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "An error occurred. Please try again.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [] // stable — all mutable state read via refs
  );

  const clearMessages = useCallback(() => setMessages([INITIAL_NUTRI_MESSAGE]), []);
  const clearError = useCallback(() => setError(null), []);

  return (
    <NutriContext.Provider
      value={{
        profile,
        updateProfile,
        messages,
        isLoading,
        error,
        sendMessage,
        clearMessages,
        clearError,
      }}
    >
      {children}
    </NutriContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNutri(): NutriContextValue {
  const ctx = useContext(NutriContext);
  if (!ctx) throw new Error("useNutri must be used within a NutriProvider");
  return ctx;
}
