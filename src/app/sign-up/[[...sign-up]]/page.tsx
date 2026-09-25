"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import { Heart, Mail, Lock, User, Check, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkIsClerkConfigured, useBeatAheadAuth } from "@/lib/auth/ClerkAuthWrapper";
import { SplineBackground } from "@/components/ui/SplineBackground";

export default function SignUpPage() {
  const router = useRouter();
  const isClerkConfigured = checkIsClerkConfigured();
  const { isSignedIn, user, signOut, signInDemoUser } = useBeatAheadAuth();

  const [showGoogleChooser, setShowGoogleChooser] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showClerk, setShowClerk] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const googleAccounts = [
    { name: "Skanda K N", email: "skandakn13@gmail.com", avatar: "S", bg: "bg-emerald-700", isPro: true },
    { name: "Chirag S", email: "schiru330@gmail.com", avatar: "C", bg: "bg-indigo-700", isPro: true },
    { name: "Skanda K N", email: "knskanda68@gmail.com", avatar: "S", bg: "bg-slate-600", isPro: false },
    { name: "Shobhaskanda", email: "shobhaskanda5@gmail.com", avatar: "S", bg: "bg-sky-600", isPro: false },
  ];

  const handleSelectGoogleAccount = (acc: { name: string; email: string }) => {
    setIsLoading(true);
    signInDemoUser({ name: acc.name, email: acc.email });
    setTimeout(() => {
      router.push("/health-record?onboarding=true");
    }, 400);
  };

  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoogleEmail) return;
    setIsLoading(true);
    signInDemoUser({
      name: customGoogleEmail.split("@")[0],
      email: customGoogleEmail,
    });
    setTimeout(() => {
      router.push("/health-record?onboarding=true");
    }, 400);
  };

  const handleEmailSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      setFormError("Please enter your email address.");
      return;
    }
    if (!password.trim() || password.length < 6) {
      setFormError("Password must be at least 6 characters.");
      return;
    }
    setIsLoading(true);
    signInDemoUser({
      name: name.trim(),
      email: email.trim(),
    });
    setTimeout(() => {
      router.push("/health-record?onboarding=true");
    }, 400);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030712] px-4 py-12 text-white relative overflow-hidden">
      <SplineBackground />

      {/* If already signed in, show Sign Out banner card */}
      {isSignedIn && (
        <div className="absolute top-6 right-6 z-50 bg-navy-900/90 border border-white/10 rounded-xl p-3 flex items-center gap-3 shadow-xl backdrop-blur-md">
          <div className="text-left text-xs">
            <div className="font-semibold text-white">{user?.fullName || "Signed In"}</div>
            <div className="text-navy-400 text-[11px]">{user?.email}</div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => signOut()}
            className="gap-1 text-xs border-navy-700 hover:bg-red-950 hover:text-red-400"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </Button>
        </div>
      )}

      <div className="relative z-10 w-full max-w-md bg-navy-900/85 border border-white/10 backdrop-blur-2xl rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] p-6 sm:p-8 flex flex-col items-center text-center">
        {/* BeatAhead Logo */}
        <Link href="/" className="inline-flex items-center gap-2.5 mb-6 group">
          <div className="w-9 h-9 rounded-xl bg-cardiac flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
            <Heart className="w-5 h-5 text-white" fill="white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">BeatAhead</span>
        </Link>

        {isSignedIn ? (
          <div className="w-full space-y-6 py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <Check className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Active Account Found</h2>
              <p className="text-sm font-semibold text-red-400 mt-1">{user?.fullName || "BeatAhead User"}</p>
              <p className="text-xs text-navy-400 mt-0.5">{user?.email}</p>
            </div>
            <div className="space-y-2.5 pt-2">
              <Link href="/dashboard" className="w-full block">
                <Button className="w-full h-11 bg-cardiac hover:bg-red-700 text-white font-semibold rounded-xl text-sm shadow-md gap-2">
                  Open Dashboard
                  <span aria-hidden="true">&rarr;</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => signOut()}
                className="w-full h-10 border-navy-700 text-navy-300 hover:bg-navy-800 text-xs rounded-xl"
              >
                Sign Out / Create New Account
              </Button>
            </div>
          </div>
        ) : isClerkConfigured && showClerk ? (
          <div className="w-full space-y-4">
            <SignUp
              path="/sign-up"
              routing="path"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/health-record?onboarding=true"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "bg-transparent shadow-none p-0 w-full",
                  headerTitle: "text-white font-bold text-xl text-center",
                  headerSubtitle: "text-navy-400 text-xs text-center",
                  socialButtonsBlockButton: "bg-white hover:bg-navy-50 text-navy-950 font-semibold rounded-xl py-2.5 flex justify-center items-center gap-2 transition-colors w-full text-sm shadow-md border border-navy-200",
                  socialButtonsBlockButtonText: "text-navy-950 font-semibold text-sm",
                  dividerLine: "bg-navy-800",
                  dividerText: "text-navy-400 text-xs font-medium",
                  formButtonPrimary: "bg-cardiac hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl transition-all shadow-md active:scale-[0.99] w-full",
                  formFieldLabel: "text-navy-200 text-xs font-semibold uppercase tracking-wider text-left",
                  formFieldInput: "bg-navy-950/80 border border-navy-800 focus:border-cardiac rounded-xl text-white placeholder-navy-500",
                  footerActionText: "text-navy-400 text-xs",
                  footerActionLink: "text-red-400 hover:text-red-300 font-semibold text-xs transition-colors",
                },
                variables: {
                  colorPrimary: "#DC2626",
                  colorBackground: "#0F172A",
                  borderRadius: "0.75rem",
                },
              }}
            />
            <button
              onClick={() => setShowClerk(false)}
              className="text-xs text-navy-400 hover:text-white underline w-full text-center py-2"
            >
              &larr; Switch back to 1-Click / Google Sign Up
            </button>
          </div>
        ) : (
          <div className="w-full space-y-5 text-left">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-white">Create your Account</h2>
              <p className="text-xs text-navy-400">Join BeatAhead Health-Tech</p>
            </div>

            {/* WHITE BOX - CONTINUE WITH GOOGLE */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowGoogleChooser(true)}
                disabled={isLoading}
                className="w-full h-12 bg-white hover:bg-slate-100 text-slate-900 font-bold gap-3 rounded-xl border border-slate-300 shadow-md transition-all active:scale-[0.99] flex items-center justify-center px-4 cursor-pointer"
              >
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="text-slate-900 font-semibold text-base select-none">Continue with Google</span>
              </button>
            </div>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-navy-800 w-full" />
              <span className="bg-navy-900 px-3 text-[11px] text-navy-400 uppercase font-medium">or continue with email</span>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailSignUp} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-navy-300 mb-1">Full name <span className="text-red-400">*</span></label>
                <div className="relative">
                  <User className="w-4 h-4 text-navy-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setFormError(null); }}
                    placeholder="e.g. John Smith"
                    required
                    className="w-full bg-navy-950 border border-navy-800 focus:border-cardiac rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-navy-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-navy-300 mb-1">Email address <span className="text-red-400">*</span></label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-navy-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFormError(null); }}
                    placeholder="you@example.com"
                    required
                    className="w-full bg-navy-950 border border-navy-800 focus:border-cardiac rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-navy-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-navy-300 mb-1">Password <span className="text-red-400">*</span></label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-navy-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFormError(null); }}
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
                    className="w-full bg-navy-950 border border-navy-800 focus:border-cardiac rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-navy-500 outline-none"
                  />
                </div>
              </div>

              {/* Validation error */}
              {formError && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <span className="flex-shrink-0">⚠</span>
                  {formError}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 bg-cardiac hover:bg-red-700 text-white font-semibold rounded-xl transition-all shadow-md active:scale-[0.99] mt-2"
              >
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            {isClerkConfigured && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowClerk(true)}
                  className="text-xs text-navy-400 hover:text-white underline"
                >
                  Use Organization / Clerk Account Sign Up &rarr;
                </button>
              </div>
            )}

            <div className="pt-2 border-t border-navy-800 flex items-center justify-between text-xs">
              <p className="text-navy-400">
                Already have an account?{" "}
                <Link href="/sign-in" className="text-cardiac-muted hover:underline font-medium">
                  Sign In
                </Link>
              </p>
              {isSignedIn && (
                <button
                  onClick={() => signOut()}
                  className="text-red-400 hover:text-red-300 font-semibold flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* GOOGLE ACCOUNT CHOOSER MODAL (DARK THEME matching Google OAuth UI) */}
      {showGoogleChooser && (
        <div className="fixed inset-0 z-50 bg-[#121212]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#1e1e1e] text-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative border border-[#333333] animate-in fade-in zoom-in duration-150">
            <button
              type="button"
              onClick={() => setShowGoogleChooser(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span className="text-sm font-medium text-gray-200">Sign up with Google</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pt-2">
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 font-bold">
                  <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-normal text-white tracking-tight">Choose an account</h2>
                  <p className="text-xs text-gray-400 mt-2">
                    to continue to <span className="text-blue-400 font-medium">BeatAhead Health-Tech</span>
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                {googleAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleSelectGoogleAccount(acc)}
                    className="w-full flex items-center gap-3.5 py-3 px-3 rounded-xl hover:bg-[#2a2a2a] transition-colors text-left border-b border-[#2e2e2e] last:border-b-0 group"
                  >
                    <div className={`w-8 h-8 rounded-full ${acc.bg || 'bg-slate-700'} text-white font-semibold flex items-center justify-center text-xs shadow-sm flex-shrink-0`}>
                      {acc.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-white group-hover:text-blue-300 transition-colors truncate">{acc.name}</span>
                        {acc.isPro && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            PRO
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">{acc.email}</div>
                    </div>
                  </button>
                ))}

                {!showCustomInput ? (
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(true)}
                    className="w-full flex items-center gap-3.5 py-3 px-3 rounded-xl hover:bg-[#2a2a2a] transition-colors text-left border-t border-[#2e2e2e] text-xs font-medium text-gray-300"
                  >
                    <div className="w-8 h-8 rounded-full border border-gray-600 text-gray-300 flex items-center justify-center font-bold flex-shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium text-gray-200">Use another account</span>
                  </button>
                ) : (
                  <form onSubmit={handleCustomGoogleSubmit} className="pt-3 space-y-2 border-t border-[#2e2e2e]">
                    <input
                      type="email"
                      required
                      value={customGoogleEmail}
                      onChange={(e) => setCustomGoogleEmail(e.target.value)}
                      placeholder="skandakn13@gmail.com"
                      className="w-full bg-[#2a2a2a] border border-[#3e3e3e] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-blue-500"
                    />
                    <Button type="submit" size="sm" className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs py-1.5 rounded-xl">
                      Continue as {customGoogleEmail || "Google User"}
                    </Button>
                  </form>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#2e2e2e] text-[11px] text-gray-400 leading-relaxed">
              Before using this app, you can review BeatAhead&apos;s{" "}
              <Link href="/about" className="text-blue-400 hover:underline">Privacy Policy</Link> and{" "}
              <Link href="/about" className="text-blue-400 hover:underline">Terms of Service</Link>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
