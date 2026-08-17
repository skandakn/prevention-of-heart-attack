import React from "react";
import { Heart } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-navy-900 flex items-center justify-center shadow-xl">
          <Heart className="w-8 h-8 text-cardiac animate-pulse" fill="#DC2626" />
        </div>
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cardiac opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-cardiac"></span>
        </span>
      </div>
      <h3 className="text-lg font-bold text-navy-900 tracking-tight">
        Authenticating & Loading Dashboard
      </h3>
      <p className="text-xs text-navy-500 mt-1 max-w-sm">
        Initializing physiological signal engine and fetching personalized ISI baseline...
      </p>
    </div>
  );
}
