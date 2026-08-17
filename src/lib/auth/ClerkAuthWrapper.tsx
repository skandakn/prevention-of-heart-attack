"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ClerkProvider, useAuth, useUser, useClerk, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export interface BeatAheadUser {
  id: string;
  fullName?: string | null;
  email?: string | null;
  imageUrl?: string | null;
}

export interface BeatAheadAuthContextType {
  isConfigured: boolean;
  isSignedIn: boolean;
  isLoaded: boolean;
  userId: string | null | undefined;
  user: BeatAheadUser | null;
  signOut: () => Promise<void>;
  signInDemoUser: (demoUser?: { email?: string; name?: string; imageUrl?: string }) => void;
}

const BeatAheadAuthContext = createContext<BeatAheadAuthContextType>({
  isConfigured: false,
  isSignedIn: false,
  isLoaded: true,
  userId: null,
  user: null,
  signOut: async () => {},
  signInDemoUser: () => {},
});

export function checkIsClerkConfigured(): boolean {
  const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!pubKey) return false;
  if (pubKey.includes("YOUR_") || pubKey.includes("placeholder")) return false;
  if (!pubKey.startsWith("pk_")) return false;
  // Key must be long enough to be real (not just "pk_test_")
  if (pubKey.length < 20) return false;
  return true;
}

function ClerkAuthBridge({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const { user: clerkUser } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const router = useRouter();

  const user: BeatAheadUser | null = clerkUser
    ? {
        id: clerkUser.id,
        fullName: clerkUser.fullName || clerkUser.firstName || "User",
        email: clerkUser.primaryEmailAddress?.emailAddress || null,
        imageUrl: clerkUser.imageUrl,
      }
    : null;

  const handleSignOut = async () => {
    await clerkSignOut();
    router.push("/sign-in");
  };

  return (
    <BeatAheadAuthContext.Provider
      value={{
        isConfigured: true,
        isSignedIn: Boolean(isSignedIn),
        isLoaded: Boolean(isLoaded),
        userId: userId || null,
        user,
        signOut: handleSignOut,
        signInDemoUser: () => {},
      }}
    >
      {children}
    </BeatAheadAuthContext.Provider>
  );
}

function UnconfiguredAuthBridge({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<BeatAheadUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("beatahead_demo_session");
      if (stored) {
        setSessionUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Error reading auth session:", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const signInDemoUser = useCallback(
    (demoUser?: { email?: string; name?: string; imageUrl?: string }) => {
      const newUser: BeatAheadUser = {
        id: `user_google_${Date.now()}`,
        fullName: demoUser?.name || "Skand Sharma",
        email: demoUser?.email || "skand.sharma@gmail.com",
        imageUrl:
          demoUser?.imageUrl ||
          "https://lh3.googleusercontent.com/a/ACg8ocIq_placeholder=s96-c",
      };
      setSessionUser(newUser);
      try {
        localStorage.setItem("beatahead_demo_session", JSON.stringify(newUser));
      } catch (e) {
        console.error("Error saving auth session:", e);
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    setSessionUser(null);
    try {
      localStorage.removeItem("beatahead_demo_session");
    } catch (e) {
      console.error("Error clearing auth session:", e);
    }
    router.push("/sign-in");
  }, [router]);

  return (
    <BeatAheadAuthContext.Provider
      value={{
        isConfigured: false,
        isSignedIn: Boolean(sessionUser),
        isLoaded,
        userId: sessionUser?.id || null,
        user: sessionUser,
        signOut,
        signInDemoUser,
      }}
    >
      {children}
    </BeatAheadAuthContext.Provider>
  );
}

export function BeatAheadAuthProvider({ children }: { children: React.ReactNode }) {
  const isConfigured = checkIsClerkConfigured();

  if (isConfigured) {
    return (
      <ClerkProvider>
        <ClerkAuthBridge>{children}</ClerkAuthBridge>
      </ClerkProvider>
    );
  }

  return <UnconfiguredAuthBridge>{children}</UnconfiguredAuthBridge>;
}

export function useBeatAheadAuth() {
  return useContext(BeatAheadAuthContext);
}

export function SafeUserButton(props: React.ComponentProps<typeof UserButton>) {
  const { isConfigured, isSignedIn, user, signOut } = useBeatAheadAuth();
  if (!isSignedIn) return null;

  if (isConfigured) {
    return <UserButton {...props} />;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-cardiac flex items-center justify-center text-white text-xs font-bold shadow-sm">
        {user?.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
      </div>
      <span className="text-xs font-semibold text-navy-800 hidden sm:inline-block">
        {user?.fullName || "Signed In"}
      </span>
      <button
        onClick={() => signOut()}
        className="text-xs text-navy-500 hover:text-cardiac font-medium ml-1 underline"
      >
        Sign Out
      </button>
    </div>
  );
}
