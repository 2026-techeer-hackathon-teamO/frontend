export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

const LABELS: Record<RiskLevel, string> = {
  LOW: "낮음",
  MEDIUM: "보통",
  HIGH: "높음",
  CRITICAL: "심각",
};

export default function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`risk-badge risk-${level.toLowerCase()}`}>
      {level} · {LABELS[level]}
    </span>
  );
}
