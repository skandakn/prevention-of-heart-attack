import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPatientRecord, updatePatientRecord } from "@/lib/db/store";
import { isSafePatientRecordUserId, validatePatientRecordUpdate } from "@/lib/patient-record";

async function resolvePatientRecordUserId(value: string | null): Promise<string | null> {
  try {
    const { userId } = await auth();
    if (isSafePatientRecordUserId(userId)) return userId;
  } catch {
    // Clerk is optional in the local demo; retain the explicitly scoped demo fallback.
  }

  const userId = value || "demo-user-1";
  return isSafePatientRecordUserId(userId) ? userId : null;
}

export async function GET(request: NextRequest) {
  const userId = await resolvePatientRecordUserId(request.nextUrl.searchParams.get("userId"));
  if (!userId) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  return NextResponse.json({ record: getPatientRecord(userId) });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = await resolvePatientRecordUserId(typeof body.userId === "string" ? body.userId : null);
    if (!userId) return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    const record = updatePatientRecord(userId, validatePatientRecordUpdate(body));
    return NextResponse.json({ record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid patient record";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
