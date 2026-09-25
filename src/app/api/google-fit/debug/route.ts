import { NextResponse } from "next/server";

/**
 * POST /api/google-fit/debug
 * Diagnostic endpoint — returns raw Google Fit API responses so we can
 * see exactly what data is available and what errors occur.
 * Remove this route before going to production.
 */
export async function POST(request: Request) {
  const { access_token } = await request.json() as { access_token: string };

  if (!access_token) {
    return NextResponse.json({ error: "Missing access_token" }, { status: 400 });
  }

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const results: Record<string, unknown> = {};

  // 1. Test sessions endpoint
  try {
    const sessionsRes = await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${new Date(thirtyDaysAgo).toISOString()}&endTime=${new Date(now).toISOString()}`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    results.sessions_status = sessionsRes.status;
    results.sessions_data = await sessionsRes.json();
  } catch (e) {
    results.sessions_error = String(e);
  }

  // 2. Test aggregate steps — estimated_steps source
  try {
    const aggRes = await fetch(
      "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          aggregateBy: [{
            dataTypeName: "com.google.step_count.delta",
            dataSourceId: "derived:com.google.step_count.delta:com.google.android.gms:estimated_steps",
          }],
          bucketByTime: { durationMillis: "86400000" },
          startTimeMillis: String(thirtyDaysAgo),
          endTimeMillis: String(now),
        }),
      }
    );
    results.steps_estimated_status = aggRes.status;
    results.steps_estimated_data = await aggRes.json();
  } catch (e) {
    results.steps_estimated_error = String(e);
  }

  // 3. Test aggregate steps — merge source (alternative)
  try {
    const aggRes2 = await fetch(
      "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: "com.google.step_count.delta" }],
          bucketByTime: { durationMillis: "86400000" },
          startTimeMillis: String(thirtyDaysAgo),
          endTimeMillis: String(now),
        }),
      }
    );
    results.steps_merge_status = aggRes2.status;
    results.steps_merge_data = await aggRes2.json();
  } catch (e) {
    results.steps_merge_error = String(e);
  }

  // 4. List available data sources
  try {
    const dsRes = await fetch(
      "https://www.googleapis.com/fitness/v1/users/me/dataSources",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    results.datasources_status = dsRes.status;
    const dsData = await dsRes.json() as { dataSource?: { dataStreamId: string; dataType?: { name: string } }[] };
    // Only show step-related sources to keep response small
    results.step_datasources = (dsData.dataSource ?? [])
      .filter(ds => ds.dataType?.name?.includes("step") || ds.dataStreamId?.includes("step"))
      .map(ds => ({ id: ds.dataStreamId, type: ds.dataType?.name }));
  } catch (e) {
    results.datasources_error = String(e);
  }

  return NextResponse.json(results);
}
