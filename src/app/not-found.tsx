import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-navy-50">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-navy-900 mb-6">
          <Heart className="w-6 h-6 text-white" fill="white" />
        </div>
        <h1 className="text-4xl font-bold text-navy-900">404</h1>
        <p className="mt-3 text-navy-600">This page could not be found.</p>
        <p className="mt-1 text-sm text-navy-400">
          The route may have moved or doesn&apos;t exist in the BeatAhead demo platform.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
          <Link href="/dashboard">
            <Button>Open Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
