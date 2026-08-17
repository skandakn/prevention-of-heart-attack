"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useBeatAheadAuth } from "@/lib/auth/ClerkAuthWrapper";

export type FeatureId =
  | "AI_INSIGHTS"
  | "PERSONAL_BASELINE"
  | "LONG_TERM_TRENDS"
  | "FEATURE_CONTRIBUTIONS"
  | "ADVANCED_ANALYTICS";

export type SubscriptionStatus = "active" | "inactive" | "pending" | "cancelled";

interface SubscriptionContextType {
  subscriptionStatus: SubscriptionStatus;
  demoMode: boolean;
  isLoading: boolean;
  setDemoMode: (enabled: boolean) => void;
  toggleDemoMode: () => void;
  canAccessFeature: (feature: FeatureId | string) => boolean;
  refreshSubscriptionStatus: () => Promise<void>;
  subscribeToPro: () => Promise<void>;
  setSubscriptionStatusState: (status: SubscriptionStatus) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded: isUserLoaded } = useBeatAheadAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>("inactive");
  const [demoMode, setDemoModeState] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);



  // Load demo mode from localStorage
  useEffect(() => {
    try {
      const savedDemo = localStorage.getItem("beatahead-demo-mode");
      if (savedDemo !== null) {
        setDemoModeState(JSON.parse(savedDemo));
      }
    } catch (e) {
      console.error("Error reading demo mode preference:", e);
    }
  }, []);

  // Fetch real subscription status from backend DB
  const refreshSubscriptionStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/subscription/status");
      if (res.ok) {
        const data = await res.json();
        if (data.subscriptionStatus) {
          setSubscriptionStatus(data.subscriptionStatus);
        }
      }
    } catch (err) {
      console.error("Failed to fetch subscription status:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isUserLoaded) {
      refreshSubscriptionStatus();
    }
  }, [isUserLoaded, userId, refreshSubscriptionStatus]);



  const setDemoMode = (enabled: boolean) => {
    setDemoModeState(enabled);
    try {
      localStorage.setItem("beatahead-demo-mode", JSON.stringify(enabled));
    } catch (e) {
      console.error("Error saving demo mode:", e);
    }
  };

  const toggleDemoMode = () => {
    setDemoMode(!demoMode);
  };

  const canAccessFeature = useCallback(
    (feature: FeatureId | string): boolean => {
      // Pro features unlocked if subscription is active OR Judge Demo Mode is ON
      if (subscriptionStatus === "active") return true;
      if (demoMode === true) return true;
      return false;
    },
    [subscriptionStatus, demoMode]
  );

  const setSubscriptionStatusState = async (status: SubscriptionStatus) => {
    try {
      const res = await fetch("/api/subscription/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setSubscriptionStatus(status);
      }
    } catch (err) {
      console.error("Error setting subscription state:", err);
    }
  };

  // Helper to dynamically load Razorpay Checkout JS script
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== "undefined" && window.Razorpay) {
        return resolve(true);
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const subscribeToPro = async () => {
    try {
      setIsLoading(true);
      const isScriptLoaded = await loadRazorpayScript();

      if (!isScriptLoaded) {
        alert("Failed to load Razorpay SDK. Please check your internet connection.");
        setIsLoading(false);
        return;
      }

      // Step 1: Call backend to create Razorpay Order
      const res = await fetch("/api/subscription/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const orderData = await res.json();

      if (!res.ok || orderData.error) {
        alert(`Order creation error: ${orderData.error || "Unable to process subscription"}`);
        setIsLoading(false);
        return;
      }

      // Step 2: Configure Razorpay Checkout modal
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "BeatAhead",
        description: "BeatAhead Pro Subscription (₹599/month)",
        order_id: orderData.orderId,
        prefill: {
          name: "Research Evaluator",
          email: "evaluator@beatahead.ai",
          contact: "9999999999",
        },
        theme: {
          color: "#0F172A",
        },
        // Step 3: Callback when Razorpay payment is authorized by user
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            // Step 4: Send to backend for HMAC signature verification & DB update
            const verifyRes = await fetch("/api/subscription/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok && verifyData.success) {
              setSubscriptionStatus("active");
              alert("🎉 BeatAhead Pro Subscription activated successfully!");
            } else {
              alert(`Verification failed: ${verifyData.error || "Signature invalid"}`);
            }
          } catch (e) {
            console.error("Error during payment verification:", e);
            alert("Payment completed but verification failed.");
          } finally {
            setIsLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsLoading(false);
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      razorpayInstance.open();
    } catch (err) {
      console.error("Error initiating subscription:", err);
      alert("Error initializing Razorpay subscription.");
      setIsLoading(false);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscriptionStatus,
        demoMode,
        isLoading,
        setDemoMode,
        toggleDemoMode,
        canAccessFeature,
        refreshSubscriptionStatus,
        subscribeToPro,
        setSubscriptionStatusState,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}
