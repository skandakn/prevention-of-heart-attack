# BeatAhead — Ischemic Stress Index (ISI)

AI Framework for Early Cardiac Risk Assessment. A production-quality hackathon MVP web application for multimodal physiological signal fusion and personalized risk-trend screening.

> **Important:** This is a research/prototype screening indicator — NOT a medical diagnostic device.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

No environment variables are required for the MVP. All data is simulated locally.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Landing page
│   ├── dashboard/          # Main monitoring dashboard
│   ├── monitor/            # Live signal monitoring
│   ├── signals/            # Feature analysis
│   ├── trends/             # Long-term trend analytics
│   ├── insights/           # AI explainability
│   ├── clinician/          # Clinician dashboard
│   ├── about/              # About & roadmap
│   └── methodology/        # Technical methodology
├── components/
│   ├── charts/             # Recharts visualizations
│   ├── dashboard/          # Dashboard-specific components
│   ├── isi/                # ISI gauge, baseline, contributions
│   ├── landing/            # Landing page sections
│   ├── layout/             # Navigation, footer, demo mode
│   ├── signals/            # Signal waveform panels
│   └── ui/                 # shadcn/ui primitives
└── lib/
    ├── isi/                # ISI scoring engine
    │   ├── types.ts        # TypeScript interfaces
    │   ├── scoring.ts      # calculateISI() prototype engine
    │   ├── features.ts     # Feature extraction
    │   ├── simulation.ts   # Deterministic data simulation
    │   └── baseline.ts     # Personal baseline logic
    ├── simulation/         # React context for live simulation
    └── utils.ts            # Shared utilities
```

## How the ISI Simulation Works

1. **Scenario Selection** — Choose from 5 demo scenarios (Normal, Stress Event, Recovering, Persistent Rising, Motion Artifact) via the Demo Mode panel.

2. **Signal Generation** — `simulation.ts` generates deterministic physiological samples (PPG, ECG, SpO₂, IMU) correlated to the selected scenario.

3. **Feature Extraction** — `features.ts` computes HRV, pulse morphology, SpO₂ trends, ECG features, and motion/artifact metrics against personal baseline.

4. **ISI Scoring** — `scoring.ts` runs `calculateISI()` which weights feature deviations, applies scenario modifiers, and produces a 0–100 score with trend, confidence, and feature contributions.

5. **Live Updates** — When monitoring is active, new samples are generated every second, scores recalculated, and charts updated in real time.

## Replacing Simulation with a Real XGBoost Model

The scoring engine is modular. To integrate a trained model:

1. Replace the body of `calculateISI()` in `src/lib/isi/scoring.ts`
2. Load your XGBoost model (via ONNX runtime, a Python microservice, or edge inference)
3. Map `FeatureSet` inputs to your model's expected feature vector
4. Return the same `ISIScore` interface

```typescript
// Example replacement in scoring.ts
export async function calculateISI(input: ScoringInput): Promise<ISIScore> {
  const featureVector = mapToModelFeatures(input.features);
  const prediction = await xgboostModel.predict(featureVector);
  return mapToISIScore(prediction, input.baseline);
}
```

## Connecting Real Wearable Sensor APIs

1. Create a sensor adapter in `src/lib/isi/sensors/` (e.g., `ble-adapter.ts`, `api-adapter.ts`)
2. Map incoming sensor data to the `PhysiologicalSample` interface
3. Replace `generateSample()` calls in `SimulationContext.tsx` with real data ingestion
4. Update `systemStatus.sensorStream` from `"simulated"` to `"connected"`
5. Remove simulated data badges when using real hardware

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **UI:** shadcn/ui components, Lucide icons
- **Charts:** Recharts
- **Animation:** Framer Motion
- **Backend:** Next.js API routes (simulation runs client-side for MVP)

## Demo Scenarios

| Scenario | ISI Range | Description |
|----------|-----------|-------------|
| Normal | 40–50 | Stable baseline fluctuation |
| Stress Event | 60–70 peak | Rises then recovers |
| Recovering | Declining | Returning to baseline |
| Persistent Rising | Gradual increase | Sustained elevation |
| Motion Artifact | Variable | Reduced signal quality |

## License

Research prototype — BeatAhead Hackathon MVP.
