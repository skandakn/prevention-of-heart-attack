import { NextRequest, NextResponse } from "next/server";
import { createEmptyPatientRecord, validatePatientRecordUpdate } from "@/lib/patient-record";
import type { PatientRecord } from "@/lib/patient-record";

/**
 * Patient Record API — stateless, Vercel-compatible.
 *
 * The file-based store (.data/patient-records.json) does not work on
 * serverless platforms because the filesystem is read-only at runtime.
 *
 * Instead, persistence is handled entirely client-side via localStorage
 * (key: "beatahead-patient-record-<userId>"). This API route simply
 * validates the incoming data and returns the sanitised record so the
 * client can store it. No data is written to the server.
 */

function resolveUserId(raw: string | null): string {
  const id = (raw ?? "").trim();
  if (!id || id.length > 256 || !/^[\w\-@.]+$/.test(id)) return "demo-user-1";
  return id;
}

export async function GET(request: NextRequest) {
  // The client always holds the authoritative copy in localStorage.
  // Return an empty record so the page can fall back gracefully when
  // localStorage is empty (first visit / new device).
  const userId = resolveUserId(request.nextUrl.searchParams.get("userId"));
  return NextResponse.json({ record: createEmptyPatientRecord(userId) });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const userId = resolveUserId(typeof body.userId === "string" ? body.userId : null);

    // Validate + sanitise — throws on bad input
    const update = validatePatientRecordUpdate(body);

    const record: PatientRecord = {
      ...createEmptyPatientRecord(userId),
      ...update,
      userId,
      updatedAt: new Date().toISOString(),
    };

    // Return the validated record — the client will persist it to localStorage
    return NextResponse.json({ record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid patient record data";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
