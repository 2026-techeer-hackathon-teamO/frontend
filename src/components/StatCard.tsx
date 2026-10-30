import type { ReactNode } from "react";
import { formatNumber } from "../utils/format";

interface Props {
  label: string;
  value?: number | null;
  hint?: ReactNode;
  tone?: "default" | "danger" | "warning";
  /** 연동할 API가 아직 없는 지표 */
  unlinked?: boolean;
  loading?: boolean;
}

export default function StatCard({ label, value, hint, tone = "default", unlinked, loading }: Props) {
  return (
    <div className={`card stat-card tone-${tone}`}>
      <div className="stat-label">
        {label}
        {unlinked && <span className="tag tag-muted">미연동</span>}
      </div>
      <div className="stat-value">{unlinked ? "—" : loading && value == null ? "…" : formatNumber(value)}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}
