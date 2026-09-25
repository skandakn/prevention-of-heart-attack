"""
scratch/update_routes_auth.py
Adds authenticated service-to-service invocation support (ML_SERVICE_AUTH_TOKEN)
to C:\ischemic\src\app\api\ml\predict\route.ts and C:\ischemic\src\app\api\ml\health\route.ts.
"""

from pathlib import Path

# 1. Update predict route
predict_path = Path(r"C:\ischemic\src\app\api\ml\predict\route.ts")
with open(predict_path, "r", encoding="utf-8") as f:
    p_content = f.read()

old_predict_fetch = """    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features: cleanFeatures }),
      signal: controller.signal
    });"""

new_predict_fetch = """    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.ML_SERVICE_AUTH_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.ML_SERVICE_AUTH_TOKEN}`;
    }

    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      headers,
      body: JSON.stringify({ features: cleanFeatures }),
      signal: controller.signal
    });"""

if old_predict_fetch in p_content:
    p_content = p_content.replace(old_predict_fetch, new_predict_fetch)
    with open(predict_path, "w", encoding="utf-8") as f:
        f.write(p_content)
    print("Updated predict route with ML_SERVICE_AUTH_TOKEN support.")
else:
    print("Old fetch pattern not found in predict route.")

# 2. Update health route
health_path = Path(r"C:\ischemic\src\app\api\ml\health\route.ts")
with open(health_path, "r", encoding="utf-8") as f:
    h_content = f.read()

old_health_fetch = """    const res = await fetch(`${ML_SERVICE_URL}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });"""

new_health_fetch = """    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.ML_SERVICE_AUTH_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.ML_SERVICE_AUTH_TOKEN}`;
    }

    const res = await fetch(`${ML_SERVICE_URL}/health`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });"""

if old_health_fetch in h_content:
    h_content = h_content.replace(old_health_fetch, new_health_fetch)
    with open(health_path, "w", encoding="utf-8") as f:
        f.write(h_content)
    print("Updated health route with ML_SERVICE_AUTH_TOKEN support.")
else:
    print("Old fetch pattern not found in health route.")
