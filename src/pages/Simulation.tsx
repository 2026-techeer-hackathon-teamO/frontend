import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, api, type LogCreate, type LogRecord } from "../api/client";
import { BlockedTag, EventTypeTag } from "../components/EventTable";
import { formatDateTime } from "../utils/format";

type Scenario = "email" | "usb" | "honeyfile" | "canary" | "raw";

const SCENARIOS: { key: Scenario; label: string; description: string }[] = [
  {
    key: "email",
    label: "📧 이메일 검사",
    description: "수신자와 첨부파일을 지정해 email_send 로그를 남깁니다.",
  },
  {
    key: "usb",
    label: "💾 USB 복사",
    description: "이동식 드라이브로의 파일 복사 시도를 usb_copy 로그로 남깁니다.",
  },
  {
    key: "honeyfile",
    label: "🍯 허니파일 접근",
    description: "디코이 문서 열람을 file_access 로그로 남깁니다 (detail.scenario = honeyfile).",
  },
  {
    key: "canary",
    label: "🐤 카나리 토큰",
    description: "승인된 테스트 토큰 문서 접근을 file_access 로그로 남깁니다 (detail.scenario = canary).",
  },
  {
    key: "raw",
    label: "🛠️ 직접 입력",
    description: "POST /api/logs 본문을 JSON으로 직접 작성합니다. 422 검증 오류 확인에 사용하세요.",
  },
];

const CLASSIFICATIONS = ["", "public", "internal", "confidential", "secret"];

const RAW_SAMPLE = JSON.stringify(
  {
    host: "PC-01",
    user: "kim",
    event_type: "usb_copy",
    file_name: "기밀.pdf",
    classification: "confidential",
    channel: "usb:E:",
    detail: { size: 10 },
  },
  null,
  2,
);

interface Form {
  host: string;
  user: string;
  fileName: string;
  fileSize: number | null;
  classification: string;
  blocked: boolean;
  recipient: string;
  drive: string;
  tokenId: string;
  raw: string;
}

const INITIAL: Form = {
  host: "PC-01",
  user: "kim",
  fileName: "기밀.pdf",
  fileSize: null,
  classification: "confidential",
  blocked: false,
  recipient: "someone@external.com",
  drive: "E:",
  tokenId: "canary-test-001",
  raw: RAW_SAMPLE,
};

function buildPayload(scenario: Scenario, f: Form): LogCreate {
  if (scenario === "raw") return JSON.parse(f.raw) as LogCreate;

  const common = {
    host: f.host.trim(),
    user: f.user.trim(),
    file_name: f.fileName.trim() || null,
    classification: f.classification || null,
  };
  const size = f.fileSize !== null ? { size: f.fileSize } : {};

  switch (scenario) {
    case "email":
      return {
        ...common,
        event_type: "email_send",
        channel: `email:${f.recipient.trim()}`,
        blocked: f.blocked,
        detail: { simulated: true, recipient: f.recipient.trim(), ...size },
      };
    case "usb":
      return {
        ...common,
        event_type: "usb_copy",
        channel: `usb:${f.drive.trim()}`,
        blocked: f.blocked,
        detail: { simulated: true, ...size },
      };
    case "honeyfile":
      return {
        ...common,
        event_type: "file_access",
        detail: { simulated: true, scenario: "honeyfile" },
      };
    case "canary":
      return {
        ...common,
        event_type: "file_access",
        detail: { simulated: true, scenario: "canary", token_id: f.tokenId.trim() },
      };
  }
}

function ErrorView({ error }: { error: Error }) {
  if (error instanceof ApiError && error.issues.length > 0) {
    return (
      <div className="alert alert-danger">
        <b>{error.status} 검증 실패</b>
        <table className="table compact">
          <thead>
            <tr>
              <th>위치</th>
              <th>유형</th>
              <th>메시지</th>
            </tr>
          </thead>
          <tbody>
            {error.issues.map((issue, i) => (
              <tr key={i}>
                <td className="mono">{issue.loc.join(".")}</td>
                <td className="mono">{issue.type}</td>
                <td>{issue.msg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return <div className="alert alert-danger">{error.message}</div>;
}

export default function Simulation() {
  const [scenario, setScenario] = useState<Scenario>("email");
  const [form, setForm] = useState<Form>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ log?: LogRecord; error?: Error } | null>(null);
  const [history, setHistory] = useState<LogRecord[]>([]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, fileName: file.name, fileSize: file.size }));
  };

  let payload: LogCreate | null = null;
  let payloadError: string | null = null;
  try {
    payload = buildPayload(scenario, form);
  } catch (e) {
    payloadError = `JSON 형식 오류: ${(e as Error).message}`;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!payload) return;
    setSubmitting(true);
    setResult(null);
    try {
      const log = await api.createLog(payload);
      setResult({ log });
      setHistory((h) => [log, ...h].slice(0, 20));
    } catch (err) {
      setResult({ error: err as Error });
    } finally {
      setSubmitting(false);
    }
  };

  const current = SCENARIOS.find((s) => s.key === scenario)!;
  const showFile = scenario === "email" || scenario === "usb";
  const showResultChoice = scenario === "email" || scenario === "usb";

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>기능 테스트</h1>
          <p className="muted">시연용 보안 이벤트 생성 · POST /api/logs</p>
        </div>
      </header>

      <div className="tabs">
        {SCENARIOS.map((s) => (
          <button
            key={s.key}
            className={s.key === scenario ? "active" : ""}
            onClick={() => {
              setScenario(s.key);
              setResult(null);
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid-2">
        <form className="card form" onSubmit={submit}>
          <div className="card-head">
            <h2>{current.label}</h2>
            <span className="tag tag-muted">실행 API 미계약</span>
          </div>
          <p className="muted small">{current.description}</p>

          {scenario === "raw" ? (
            <label>
              요청 본문 (JSON)
              <textarea
                className="mono"
                rows={14}
                value={form.raw}
                onChange={(e) => set("raw", e.target.value)}
                spellCheck={false}
              />
            </label>
          ) : (
            <>
              <div className="form-row">
                <label>
                  호스트 *
                  <input value={form.host} onChange={(e) => set("host", e.target.value)} required />
                </label>
                <label>
                  사용자 *
                  <input value={form.user} onChange={(e) => set("user", e.target.value)} required />
                </label>
              </div>

              {scenario === "email" && (
                <label>
                  수신자
                  <input
                    type="email"
                    value={form.recipient}
                    onChange={(e) => set("recipient", e.target.value)}
                    required
                  />
                </label>
              )}
              {scenario === "usb" && (
                <label>
                  대상 드라이브
                  <input value={form.drive} onChange={(e) => set("drive", e.target.value)} placeholder="E:" required />
                </label>
              )}
              {scenario === "canary" && (
                <label>
                  테스트 토큰 ID
                  <input value={form.tokenId} onChange={(e) => set("tokenId", e.target.value)} required />
                </label>
              )}

              <label>
                {scenario === "honeyfile" ? "허니파일명" : scenario === "canary" ? "토큰 문서명" : "파일명"}
                <input
                  value={form.fileName}
                  onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value, fileSize: null }))}
                />
              </label>
              {showFile && (
                <label>
                  {scenario === "email" ? "첨부파일" : "테스트 파일"}
                  <input type="file" onChange={onFile} />
                  <span className="muted small">파일 내용은 전송되지 않고 파일명·크기만 기록됩니다.</span>
                </label>
              )}

              <label>
                문서 등급
                <select value={form.classification} onChange={(e) => set("classification", e.target.value)}>
                  {CLASSIFICATIONS.map((c) => (
                    <option key={c} value={c}>
                      {c || "(없음)"}
                    </option>
                  ))}
                </select>
              </label>

              {showResultChoice && (
                <fieldset className="radio-group">
                  <legend>DLP 검사 결과 (수동 지정)</legend>
                  <label className="inline">
                    <input type="radio" checked={!form.blocked} onChange={() => set("blocked", false)} /> 허용
                  </label>
                  <label className="inline">
                    <input type="radio" checked={form.blocked} onChange={() => set("blocked", true)} /> 차단
                  </label>
                </fieldset>
              )}
            </>
          )}

          <button type="submit" className="btn btn-primary" disabled={!payload || submitting}>
            {submitting ? "전송 중…" : "로그 생성"}
          </button>
        </form>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>전송될 요청</h2>
              <span className="mono small muted">POST /api/logs</span>
            </div>
            {payloadError ? (
              <p className="empty danger">{payloadError}</p>
            ) : (
              <pre className="code">{JSON.stringify(payload, null, 2)}</pre>
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>응답</h2>
            </div>
            {!result && <p className="empty">아직 전송하지 않았습니다.</p>}
            {result?.error && <ErrorView error={result.error} />}
            {result?.log && (
              <>
                <div className="alert alert-ok">
                  200 OK — 저장됨 ·{" "}
                  <Link to={`/events?id=${result.log.id}`} className="link">
                    보안 이벤트에서 보기 →
                  </Link>
                </div>
                <pre className="code">{JSON.stringify(result.log, null, 2)}</pre>
              </>
            )}
          </section>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>이번 세션에서 생성한 로그</h2>
          <span className="muted small">{history.length}건 (최근 20건)</span>
        </div>
        {history.length === 0 ? (
          <p className="empty">아직 없습니다.</p>
        ) : (
          <ul className="history">
            {history.map((log) => (
              <li key={log.id}>
                <span className="mono muted">{formatDateTime(log.received_at)}</span>
                <EventTypeTag type={log.event_type} />
                <BlockedTag blocked={log.blocked} />
                <span>
                  {log.user}@{log.host}
                </span>
                <Link to={`/events?id=${log.id}`} className="link ellipsis">
                  {log.file_name ?? log.id}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
