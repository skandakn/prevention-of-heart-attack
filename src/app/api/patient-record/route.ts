import { NextRequest, NextResponse } from "next/server";
import { getPatientRecord, updatePatientRecord } from "@/lib/db/store";
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId") || "demo-user-1";
  return NextResponse.json({ record: getPatientRecord(userId) });
}
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId : "demo-user-1";
    const record = updatePatientRecord(userId, body);
    return NextResponse.json({ record });
  } catch {
    return NextResponse.json({ error: "Invalid patient record" }, { status: 400 });
  }
}
