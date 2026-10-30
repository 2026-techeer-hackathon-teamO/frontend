import { useEffect, useState } from "react";
import { api, type Alert, type Decoy, type LogRecord } from "./api";

const sevColor: Record<string, string> = {
  high: "var(--high)",
  medium: "var(--medium)",
  low: "var(--muted)",
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <h2 style={{ margin: "0 0 12px", fontSize: 15, color: "var(--muted)" }}>{title}</h2>
      {children}
    </section>
  );
}

export default function App() {
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [decoys, setDecoys] = useState<Decoy[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      Promise.all([api.logs(), api.alerts(), api.decoys()])
        .then(([l, a, d]) => {
          setLogs(l);
          setAlerts(a);
          setDecoys(d);
          setError(null);
        })
        .catch((e: Error) => setError(e.message));
    };
    load();
    const t = setInterval(load, 5000); // 5초 폴링
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>🛡️ DLP 보안 대시보드</h1>
        <p style={{ color: "var(--muted)", marginTop: 6 }}>
          기밀 유출 방지 · 내부자 위협 탐지 · 허니팟/카나리토큰 모니터링
        </p>
      </header>

      {error && (
        <p style={{ color: "var(--high)" }}>
          backend 연결 실패: {error} (uvicorn 실행 여부를 확인하세요)
        </p>
      )}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
        <Panel title={`🚨 유출 의심 알림 (${alerts.length})`}>
          {alerts.length === 0 && <p style={{ color: "var(--muted)" }}>아직 없음</p>}
          {alerts.map((a) => (
            <div key={a.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: sevColor[a.severity], fontWeight: 600 }}>
                [{a.severity.toUpperCase()}] {a.score}
              </span>{" "}
              <span>{a.host}</span>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>{a.reason}</div>
            </div>
          ))}
        </Panel>

        <Panel title={`🎣 카나리토큰 / 디코이 (${decoys.length})`}>
          {decoys.length === 0 && <p style={{ color: "var(--muted)" }}>아직 없음</p>}
          {decoys.map((d) => (
            <div key={d.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ color: d.triggered ? "var(--high)" : "var(--ok)" }}>
                {d.triggered ? `● 발동 ${d.trigger_count}회` : "○ 대기"}
              </span>{" "}
              {d.file_name}
            </div>
          ))}
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title={`📄 수집 로그 (${logs.length})`}>
          {logs.length === 0 && <p style={{ color: "var(--muted)" }}>아직 없음</p>}
          {logs.map((l) => (
            <div
              key={l.id}
              style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}
            >
              <span style={{ color: l.blocked ? "var(--high)" : "var(--muted)" }}>
                {l.blocked ? "차단" : "허용"}
              </span>{" "}
              <b>{l.event_type}</b> · {l.host}/{l.user} · {l.file_name ?? "-"}{" "}
              {l.channel && <span style={{ color: "var(--muted)" }}>({l.channel})</span>}
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}
