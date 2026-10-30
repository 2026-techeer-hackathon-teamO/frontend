import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { BlockedTag, EventTypeTag } from "../components/EventTable";
import RiskBadge, { RISK_LEVELS } from "../components/RiskBadge";
import { USE_MOCK, mockLogs } from "../data/mockDashboard";
import { loadMockAnalyses } from "../data/mockEvents";
import { usePolling } from "../hooks/usePolling";
import { formatDateTime } from "../utils/format";

const TIMELINE_LIMIT = 50;

function Timeline({ user }: { user: string }) {
  const { data, error, loading } = usePolling(
    () => (USE_MOCK ? mockLogs({ user, limit: TIMELINE_LIMIT }) : api.logs({ user, limit: TIMELINE_LIMIT })),
    [user],
  );

  if (error) return <p className="empty danger">조회 실패: {error.message}</p>;
  if (!data) return <p className="empty">{loading ? "불러오는 중…" : ""}</p>;
  if (data.items.length === 0) return <p className="empty">user={user} 로그가 없습니다.</p>;

  return (
    <>
      <ol className="timeline">
        {data.items.map((log) => (
          <li key={log.id} className={log.blocked ? "is-blocked" : ""}>
            <div className="timeline-time mono">{formatDateTime(log.received_at)}</div>
            <div className="timeline-body">
              <EventTypeTag type={log.event_type} /> <BlockedTag blocked={log.blocked} />{" "}
              <Link to={`/events?id=${log.id}`} className="link">
                {log.file_name ?? "(파일 없음)"}
              </Link>
              <div className="muted small">
                {log.host}
                {log.channel && ` · ${log.channel}`}
                {log.classification && ` · ${log.classification}`}
              </div>
            </div>
          </li>
        ))}
      </ol>
      {data.total !== null && data.total > data.items.length && (
        <Link to={`/events?user=${encodeURIComponent(user)}`} className="link small">
          전체 {data.total}건 보안 이벤트에서 보기 →
        </Link>
      )}
    </>
  );
}

export default function Analysis() {
  const { data, error, loading } = usePolling(loadMockAnalyses, []);
  const analyses = data ?? [];
  const [selectedId, setSelectedId] = useState<string>();
  const selected = analyses.find((a) => a.id === selectedId) ?? analyses[0];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>AI 위협 분석</h1>
          <p className="muted">사용자·이벤트별 위험도, 공격 유형, 판단 근거, 권장 대응</p>
        </div>
      </header>

      {error && <div className="alert alert-danger">분석 데이터 조회 실패: {error.message}</div>}

      <div className="risk-summary">
        {RISK_LEVELS.map((level) => (
          <div key={level} className="card risk-summary-item">
            <RiskBadge level={level} />
            <span className="stat-value">{analyses.filter((a) => a.risk_level === level).length}</span>
          </div>
        ))}
      </div>

      <div className="grid-1-2 analysis-layout">
        <section className="card">
          <div className="card-head">
            <h2>분석 대상</h2>
          </div>
          {analyses.length === 0 && <p className="empty">{loading ? "불러오는 중…" : "분석 대상이 없습니다."}</p>}
          <ul className="select-list">
            {analyses.map((a) => (
              <li key={a.id}>
                <button className={a.id === selected?.id ? "active" : ""} onClick={() => setSelectedId(a.id)}>
                  <div className="row-between">
                    <b>
                      {a.user} <span className="muted">@{a.host}</span>
                    </b>
                    <RiskBadge level={a.risk_level} />
                  </div>
                  <div className="muted small">{a.attack_type}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {selected && (
          <div className="stack">
            <section className="card">
              <div className="card-head">
                <h2>{selected.attack_type}</h2>
              </div>
              <div className="analysis-meta">
                <RiskBadge level={selected.risk_level} />
                <div className="score">
                  <div className="score-track">
                    <div
                      className={`score-fill risk-${selected.risk_level.toLowerCase()}`}
                      style={{ width: `${selected.risk_score}%` }}
                    />
                  </div>
                  <span className="mono">{selected.risk_score} / 100</span>
                </div>
                <span className="muted small">
                  {selected.user}@{selected.host} · {formatDateTime(selected.analyzed_at)}
                </span>
              </div>
              <p>{selected.summary}</p>
              <div className="grid-2">
                <div>
                  <h3 className="sub-title">판단 근거</h3>
                  <ul className="bullets">
                    {selected.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="sub-title">권장 대응</h3>
                  <ul className="bullets">
                    {selected.recommendations.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section className="card timeline-card">
              <div className="card-head">
                <h2>관련 이벤트 타임라인</h2>
              </div>
              <div className="timeline-scroll">
                <Timeline user={selected.user} />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
