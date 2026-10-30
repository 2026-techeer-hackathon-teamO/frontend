import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, EVENT_TYPES, EVENT_TYPE_LABELS, api, type EventType, type LogRecord } from "../api/client";
import EventTable from "../components/EventTable";
import RiskBadge from "../components/RiskBadge";
import StatCard from "../components/StatCard";
import { USE_MOCK, loadMockDashboard } from "../data/mockDashboard";
import { loadMockAnalyses } from "../data/mockEvents";
import { usePolling } from "../hooks/usePolling";
import { formatDateTime, formatNumber, formatTime } from "../utils/format";

const HOUR = 3600 * 1000;
const WINDOW_LIMIT = 1000; // GET /api/logs limit 최대값

async function loadDashboard() {
  if (USE_MOCK) return loadMockDashboard();
  const since = new Date(Date.now() - 24 * HOUR).toISOString();
  const [recent, blocked, window24, ...byType] = await Promise.all([
    api.logs({ limit: 10 }), // 필터 없는 X-Total-Count = 전체 로그 수
    api.logs({ blocked: true, limit: 1 }),
    api.logs({ since, limit: WINDOW_LIMIT }),
    ...EVENT_TYPES.map((t) => api.logs({ event_type: t, limit: 1 })),
  ]);
  return {
    recent,
    blocked,
    window24,
    byType: EVENT_TYPES.map((type, i) => ({ type, total: byType[i].total })),
  };
}

function hourlyBuckets(logs: LogRecord[], now: Date) {
  const end = new Date(now);
  end.setMinutes(0, 0, 0);
  const start = end.getTime() - 23 * HOUR;
  const buckets = Array.from({ length: 24 }, (_, i) => ({ start: new Date(start + i * HOUR), total: 0, blocked: 0 }));
  for (const log of logs) {
    const idx = Math.floor((new Date(log.received_at).getTime() - start) / HOUR);
    if (idx < 0 || idx >= 24) continue;
    buckets[idx].total += 1;
    if (log.blocked) buckets[idx].blocked += 1;
  }
  return buckets;
}

function HourlyChart({ logs, now, truncated }: { logs: LogRecord[]; now: Date; truncated: boolean }) {
  const buckets = hourlyBuckets(logs, now);
  const max = Math.max(1, ...buckets.map((b) => b.total));
  return (
    <div className="chart-body">
      <div className="bar-chart">
        {buckets.map((b, i) => (
          <div
            key={i}
            className="bar-col"
            title={`${b.start.getHours()}시 — 전체 ${b.total}건 / 차단 ${b.blocked}건`}
          >
            <div className="bar" style={{ height: `${(b.total / max) * 100}%` }}>
              <div className="bar-blocked" style={{ height: b.total ? `${(b.blocked / b.total) * 100}%` : 0 }} />
            </div>
            <div className="bar-label">{i % 3 === 0 ? `${b.start.getHours()}시` : ""}</div>
          </div>
        ))}
      </div>
      <div className="chart-legend">
        <span className="legend-item">
          <i className="swatch swatch-total" /> 전체
        </span>
        <span className="legend-item">
          <i className="swatch swatch-blocked" /> 차단
        </span>
        <span className="muted">
          최근 24시간 · received_at 기준{truncated && ` · 최신 ${WINDOW_LIMIT}건만 집계`}
        </span>
      </div>
    </div>
  );
}

function TypeDistribution({ items }: { items: { type: EventType; total: number | null }[] }) {
  const navigate = useNavigate();
  const max = Math.max(1, ...items.map((i) => i.total ?? 0));
  return (
    <div className="hbar-list">
      {items.map((item) => (
        <button
          key={item.type}
          className="hbar-row"
          onClick={() => navigate(`/events?event_type=${item.type}`)}
          title="보안 이벤트에서 보기"
        >
          <span className="hbar-label">{EVENT_TYPE_LABELS[item.type]}</span>
          <span className="hbar-track">
            <span className={`hbar-fill type-${item.type}`} style={{ width: `${((item.total ?? 0) / max) * 100}%` }} />
          </span>
          <span className="hbar-value">{formatNumber(item.total)}</span>
        </button>
      ))}
      <div className="muted small">전체 기간 · event_type별 X-Total-Count</div>
    </div>
  );
}

const MOCK_ALERT_LIMIT = 4;

function MockAlertsPanel() {
  const { data, loading } = usePolling(loadMockAnalyses, []);
  const alerts = (data ?? []).filter((a) => a.risk_level !== "LOW").slice(0, MOCK_ALERT_LIMIT);
  return (
    <section className="card">
      <div className="card-head">
        <h2>최근 경보</h2>
        <Link to="/analysis" className="link">
          AI 분석 →
        </Link>
      </div>
      {alerts.length === 0 && <p className="empty">{loading ? "불러오는 중…" : "최근 24시간 경보가 없습니다."}</p>}
      <ul className="history">
        {alerts.map((a) => (
          <li key={a.id} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
            <div>
              <RiskBadge level={a.risk_level} /> <b>{a.attack_type}</b>
            </div>
            <div className="muted small">
              {a.user} · {a.host} · 위험도 {a.risk_score} · {formatDateTime(a.analyzed_at)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AlertsPanel() {
  const { data, error, loading } = usePolling(() => api.alerts(), []);

  let body;
  if (error) {
    body =
      error instanceof ApiError && error.status === 404 ? (
        <p className="empty">GET /api/alerts가 아직 구현되지 않았습니다 (404).</p>
      ) : (
        <p className="empty danger">경보 조회 실패: {error.message}</p>
      );
  } else if (loading && data === null) {
    body = <p className="empty">불러오는 중…</p>;
  } else {
    const list = Array.isArray(data) ? data : null;
    body = (
      <>
        <p className="notice">
          응답 스키마가 확정되지 않아 경보 내용을 해석하지 않습니다.
          {list && (
            <>
              {" "}
              현재 응답 <b>{list.length}건</b>.
            </>
          )}
        </p>
        <details className="raw">
          <summary>원본 응답 보기 (연동 디버깅용)</summary>
          <pre>{JSON.stringify(list ? list.slice(0, 5) : data, null, 2)}</pre>
          {list && list.length > 5 && <div className="muted small">… 외 {list.length - 5}건</div>}
        </details>
      </>
    );
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2>최근 경보</h2>
        <span className="tag tag-muted">스키마 미확정</span>
      </div>
      {body}
    </section>
  );
}

export default function Dashboard() {
  const { data, error, loading, updatedAt, refresh } = usePolling(loadDashboard, []);
  const [chart, setChart] = useState<"hourly" | "type">("hourly");
  const navigate = useNavigate();

  const total = data?.recent.total ?? null;
  const blocked = data?.blocked.total ?? null;
  const headerMissing = data !== null && (total === null || blocked === null);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>보안 관제 대시보드</h1>
          <p className="muted">5초마다 자동 갱신{updatedAt && ` · 마지막 갱신 ${formatTime(updatedAt)}`}</p>
        </div>
        <button className="btn" onClick={refresh}>
          새로고침
        </button>
      </header>

      {error && <div className="alert alert-danger">데이터 조회 실패: {error.message}</div>}
      {headerMissing && (
        <div className="alert alert-warning">
          X-Total-Count 헤더를 읽을 수 없습니다. 백엔드 CORS 설정에 <code>expose_headers=["X-Total-Count"]</code>가
          필요합니다.
        </div>
      )}

      <div className="grid-2-1">
        <section className="card chart-card">
          <div className="card-head">
            <h2>로그 추이</h2>
            <div className="segmented">
              <button className={chart === "hourly" ? "active" : ""} onClick={() => setChart("hourly")}>
                시간별
              </button>
              <button className={chart === "type" ? "active" : ""} onClick={() => setChart("type")}>
                유형별
              </button>
            </div>
          </div>
          {!data ? (
            <p className="empty">{loading ? "불러오는 중…" : "데이터 없음"}</p>
          ) : chart === "hourly" ? (
            <HourlyChart
              logs={data.window24.items}
              now={updatedAt ?? new Date()}
              truncated={(data.window24.total ?? 0) > data.window24.items.length}
            />
          ) : (
            <TypeDistribution items={data.byType} />
          )}
        </section>

        <div className="stack">
          <div className="stat-grid stat-grid-2">
            <StatCard label="전체 이벤트" value={total} loading={loading} />
            <StatCard
              label="차단 이벤트"
              value={blocked}
              loading={loading}
              tone="danger"
              hint={total && blocked !== null ? `차단율 ${((blocked / total) * 100).toFixed(1)}%` : undefined}
            />
          </div>
          {USE_MOCK ? <MockAlertsPanel /> : <AlertsPanel />}
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>최근 보안 이벤트</h2>
          <Link to="/events" className="link">
            전체 보기 →
          </Link>
        </div>
        <EventTable
          logs={data?.recent.items ?? []}
          onSelect={(log) => navigate(`/events?id=${log.id}`)}
          emptyText={loading ? "불러오는 중…" : "수집된 로그가 없습니다."}
        />
      </section>
    </div>
  );
}
