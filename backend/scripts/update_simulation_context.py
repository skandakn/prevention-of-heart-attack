import os

context_path = r"C:\ischemic\src\lib\simulation\SimulationContext.tsx"
with open(context_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace calculateISI calls to include rawSample
old_build_call = """      const score = calculateISI({
      features: feat,
      baseline: DEFAULT_BASELINE,
      historicalScores: historicalScores.map((s) => s.score),
      scenario: newScenario,
      signalQuality: sample.signalQuality.overall,
      timestamp: sample.timestamp,
    });"""

new_build_call = """      const score = calculateISI({
      features: feat,
      baseline: DEFAULT_BASELINE,
      historicalScores: historicalScores.map((s) => s.score),
      scenario: newScenario,
      signalQuality: sample.signalQuality.overall,
      timestamp: sample.timestamp,
      rawSample: {
        heartRate: sample.heartRate,
        hrv: sample.hrv,
        spo2: sample.spo2,
        ppg: sample.ppg,
        ecg: sample.ecg,
        imu: sample.imu,
      },
    });"""

old_tick_call = """      const newScore = calculateISI({
        features: newFeatures,
        baseline,
        historicalScores: prev.history.map((s) => s.score),
        scenario,
        signalQuality: newSample.signalQuality.overall,
        timestamp: newSample.timestamp,
      });"""

new_tick_call = """      const newScore = calculateISI({
        features: newFeatures,
        baseline,
        historicalScores: prev.history.map((s) => s.score),
        scenario,
        signalQuality: newSample.signalQuality.overall,
        timestamp: newSample.timestamp,
        rawSample: {
          heartRate: newSample.heartRate,
          hrv: newSample.hrv,
          spo2: newSample.spo2,
          ppg: newSample.ppg,
          ecg: newSample.ecg,
          imu: newSample.imu,
        },
      });"""

content = content.replace(old_build_call, new_build_call)
content = content.replace(old_tick_call, new_tick_call)

with open(context_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated SimulationContext.tsx with rawSample forwarding")
