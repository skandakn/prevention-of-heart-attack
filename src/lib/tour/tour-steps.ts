export interface TourStep {
  id: number;
  target: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    target: "[data-tour-id='dashboard-header']",
    title: "Welcome to BeatAhead",
    description: "BeatAhead is a research prototype for exploring continuous physiological signals and the Ischemic Stress Index.",
    position: "bottom",
  },
  {
    id: 2,
    target: "[data-tour-id='nav-health-record']",
    title: "My Health Record",
    description: "Input and view your clinical vitals, blood pressure, resting heart rate, and cardiovascular history.",
    position: "right",
  },
  {
    id: 3,
    target: "[data-tour-id='nav-signals']",
    title: "Signal Analysis",
    description: "Explore individual physiological signals and their quality metrics.",
    position: "right",
  },
  {
    id: 4,
    target: "[data-tour-id='isi-gauge']",
    title: "Current ISI Score",
    description: "Follow the current Ischemic Stress Index and understand how the score changes relative to the monitoring baseline.",
    position: "left",
  },
  {
    id: 5,
    target: "[data-tour-id='isi-trend-chart']",
    title: "ISI Trend",
    description: "Track how the ISI evolves over time instead of relying on a single snapshot.",
    position: "top",
  },
  {
    id: 6,
    target: "[data-tour-id='wellness-agents']",
    title: "Wellness Agents",
    description: "Explore nutrition, fitness and recovery guidance from the BeatAhead wellness agents.",
    position: "right",
  },
];
