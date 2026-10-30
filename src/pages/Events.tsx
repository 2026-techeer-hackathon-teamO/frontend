import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError, EVENT_TYPES, EVENT_TYPE_LABELS, api, type LogQuery, type LogRecord } from "../api/client";
import EventTable, { BlockedTag, EventTypeTag } from "../components/EventTable";
import { USE_MOCK, mockLog, mockLogs } from "../data/mockDashboard";
import { usePolling } from "../hooks/usePolling";
import { formatDateTime, formatNumber, formatTime, isoToLocalInput, localInputToIso } from "../utils/format";

const PAGE_SIZES = [20, 50, 100];
const TEXT_FILTERS = ["host", "user", "classification"] as const;

type Draft = Record<(typeof TEXT_FILTERS)[number] | "since" | "until", string>;

function draftFromParams(params: URLSearchParams): Draft {
  return {
    host: params.get("host") ?? "",
    user: params.get("user") ?? "",
    classification: params.get("classification") ?? "",
    since: isoToLocalInput(params.get("since")),
    until: isoToLocalInput(params.get("until")),
  };
}

function LogDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [state, setState] = useState<{ log?: LogRecord; error?: Error; loading: boolean }>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true });
    (USE_MOCK ? mockLog(id) : api.log(id))
      .then((log) => !cancelled && setState({ log, loading: false }))
      .catch((error: Error) => !cancelled && setState({ error, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const { log, error, loading } = state;

  return (
    <aside className="card detail-panel">
      <div className="card-head">
        <h2>이벤트 상세</h2>
        <button className="btn btn-ghost" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>
      {loading && <p className="empty">불러오는 중…</p>}
      {error && (
        <p className="empty danger">
          {error instanceof ApiError && error.status === 404
            ? "해당 ID의 로그가 존재하지 않습니다 (404)."
            : `조회 실패: ${error.message}`}
        </p>
      )}
      {log && (
        <>
          <dl className="kv">
            <dt>ID</dt>
            <dd className="mono break">{log.id}</dd>
            <dt>수신 시각</dt>
            <dd>
              {formatDateTime(log.received_at)}
              <div className="muted small mono">{log.received_at}</div>
            </dd>
            <dt>사용자</dt>
            <dd>{log.user}</dd>
            <dt>호스트</dt>
            <dd>{log.host}</dd>
            <dt>유형</dt>
            <dd>
              <EventTypeTag type={log.event_type} />
            </dd>
            <dt>결과</dt>
            <dd>
              <BlockedTag blocked={log.blocked} />
            </dd>
            <dt>파일명</dt>
            <dd className="break">{log.file_name ?? "-"}</dd>
            <dt>파일 해시</dt>
            <dd className="mono break">{log.file_hash ?? "-"}</dd>
            <dt>문서 등급</dt>
            <dd>{log.classification ?? "-"}</dd>
            <dt>반출 채널</dt>
            <dd className="mono">{log.channel ?? "-"}</dd>
          </dl>
          <h3 className="sub-title">detail</h3>
          <pre className="code">{JSON.stringify(log.detail, null, 2)}</pre>
        </>
      )}
    </aside>
  );
}

export default function Events() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState<Draft>(() => draftFromParams(params));

  const paramsKey = params.toString();
  useEffect(() => {
    setDraft(draftFromParams(params));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  const sizeParam = Number(params.get("size"));
  const size = PAGE_SIZES.includes(sizeParam) ? sizeParam : PAGE_SIZES[0];
  const page = Math.max(0, Math.floor(Number(params.get("page")) || 0));
  const selectedId = params.get("id");
  const blockedParam = params.get("blocked");

  const query: LogQuery = {
    host: params.get("host") || undefined,
    user: params.get("user") || undefined,
    event_type: params.get("event_type") || undefined,
    classification: params.get("classification") || undefined,
    blocked: blockedParam === "true" ? true : blockedParam === "false" ? false : undefined,
    since: params.get("since") || undefined,
    until: params.get("until") || undefined,
    limit: size,
    offset: page * size,
  };
  const queryKey = JSON.stringify(query);

  const { data, error, loading, updatedAt, refresh } = usePolling(() => (USE_MOCK ? mockLogs(query) : api.logs(query)), [queryKey]);

  /** URL 파라미터 갱신. 필터가 바뀌면 page를 0으로 초기화한다. */
  const update = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    if (resetPage) next.delete("page");
    setParams(next);
  };

  const applyDraft = (e: FormEvent) => {
    e.preventDefault();
    update({
      host: draft.host.trim(),
      user: draft.user.trim(),
      classification: draft.classification.trim(),
      since: localInputToIso(draft.since),
      until: localInputToIso(draft.until),
    });
  };

  const resetFilters = () => {
    const next = new URLSearchParams();
    if (params.get("size")) next.set("size", String(size));
    setParams(next);
  };

  const total = data?.total ?? null;
  const totalPages = total === null ? null : Math.max(1, Math.ceil(total / size));
  const hasFilter = ["host", "user", "event_type", "classification", "blocked", "since", "until"].some((k) =>
    params.get(k),
  );

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>보안 이벤트</h1>
          <p className="muted">
            5초마다 자동 갱신{updatedAt && ` · 마지막 갱신 ${formatTime(updatedAt)}`}
          </p>
        </div>
        <button className="btn" onClick={refresh} disabled={loading && !data}>
          새로고침
        </button>
      </header>

      <form className="card filters" onSubmit={applyDraft}>
        <label>
          호스트
          <input value={draft.host} onChange={(e) => setDraft({ ...draft, host: e.target.value })} placeholder="PC-01" />
        </label>
        <label>
          사용자
          <input value={draft.user} onChange={(e) => setDraft({ ...draft, user: e.target.value })} placeholder="kim" />
        </label>
        <label>
          유형
          <select value={params.get("event_type") ?? ""} onChange={(e) => update({ event_type: e.target.value })}>
            <option value="">전체</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t]} ({t})
              </option>
            ))}
          </select>
        </label>
        <label>
          문서 등급
          <input
            value={draft.classification}
            onChange={(e) => setDraft({ ...draft, classification: e.target.value })}
            placeholder="confidential"
          />
        </label>
        <label>
          차단 여부
          <select value={blockedParam ?? ""} onChange={(e) => update({ blocked: e.target.value })}>
            <option value="">전체</option>
            <option value="true">차단</option>
            <option value="false">허용</option>
          </select>
        </label>
        <label>
          시작 (since)
          <input
            type="datetime-local"
            value={draft.since}
            onChange={(e) => setDraft({ ...draft, since: e.target.value })}
          />
        </label>
        <label>
          종료 (until)
          <input
            type="datetime-local"
            value={draft.until}
            onChange={(e) => setDraft({ ...draft, until: e.target.value })}
          />
        </label>
        <div className="filter-actions">
          <button type="submit" className="btn btn-primary">
            적용
          </button>
          <button type="button" className="btn" onClick={resetFilters} disabled={!hasFilter}>
            초기화
          </button>
        </div>
      </form>

      {error && <div className="alert alert-danger">조회 실패: {error.message}</div>}

      <div className={selectedId ? "grid-list-detail" : ""}>
        <section className="card">
          <div className="card-head">
            <h2>
              이벤트 목록{" "}
              <span className="muted small">
                {total === null
                  ? data
                    ? "(X-Total-Count 헤더 없음 — CORS expose_headers 확인)"
                    : ""
                  : `총 ${formatNumber(total)}건`}
              </span>
            </h2>
            <label className="inline">
              페이지 크기
              <select value={size} onChange={(e) => update({ size: e.target.value })}>
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <EventTable
            variant="full"
            logs={data?.items ?? []}
            selectedId={selectedId}
            onSelect={(log) => update({ id: log.id }, false)}
            emptyText={loading && !data ? "불러오는 중…" : "조건에 맞는 이벤트가 없습니다."}
          />

          <div className="pagination">
            <button className="btn" disabled={page === 0} onClick={() => update({ page: "0" }, false)}>
              «
            </button>
            <button className="btn" disabled={page === 0} onClick={() => update({ page: String(page - 1) }, false)}>
              이전
            </button>
            <span className="muted">
              {page + 1} / {totalPages ?? "?"} 페이지
            </span>
            <button
              className="btn"
              disabled={totalPages !== null ? page + 1 >= totalPages : (data?.items.length ?? 0) < size}
              onClick={() => update({ page: String(page + 1) }, false)}
            >
              다음
            </button>
            <button
              className="btn"
              disabled={totalPages === null || page + 1 >= totalPages}
              onClick={() => totalPages && update({ page: String(totalPages - 1) }, false)}
            >
              »
            </button>
          </div>
        </section>

        {selectedId && <LogDetail id={selectedId} onClose={() => update({ id: null }, false)} />}
      </div>
    </div>
  );
}
