/** 비어 있으면 같은 출처(/api)로 요청하고, 개발 서버에서는 Vite 프록시가 백엔드로 전달한다. */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

/** 화면 표시용 실제 요청 대상 */
export const API_TARGET =
  API_BASE || `${import.meta.env.VITE_PROXY_TARGET ?? "http://localhost:8000"} (프록시)`;

export const EVENT_TYPES = ["file_access", "email_send", "usb_copy", "blocked"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  file_access: "파일 접근",
  email_send: "이메일 전송",
  usb_copy: "USB 복사",
  blocked: "차단 이벤트",
};

/** docs/api.md — LogRecord 스키마 */
export interface LogRecord {
  id: string;
  received_at: string;
  host: string;
  user: string;
  event_type: EventType;
  file_name: string | null;
  file_hash: string | null;
  classification: string | null;
  channel: string | null;
  blocked: boolean;
  detail: Record<string, unknown>;
}

/** POST /api/logs 요청 본문. id, received_at은 서버가 부여한다. */
export interface LogCreate {
  host: string;
  user: string;
  event_type: string;
  file_name?: string | null;
  file_hash?: string | null;
  classification?: string | null;
  channel?: string | null;
  blocked?: boolean;
  detail?: Record<string, unknown>;
}

export interface LogQuery {
  host?: string;
  user?: string;
  event_type?: string;
  classification?: string;
  blocked?: boolean;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

export interface LogPage {
  items: LogRecord[];
  /** X-Total-Count 헤더. CORS에서 노출되지 않으면 null */
  total: number | null;
}

/** FastAPI 422 응답의 detail 항목 */
export interface ValidationIssue {
  type: string;
  loc: (string | number)[];
  msg: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public issues: ValidationIssue[] = [],
    public body: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function toQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

async function request<T>(path: string, init?: RequestInit): Promise<{ data: T; res: Response }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    throw new ApiError(0, `백엔드에 연결할 수 없습니다 (${API_TARGET})`);
  }

  // 프록시 대상에 연결하지 못하면 개발 서버가 502를 돌려준다 (vite.config.ts).
  if (!API_BASE && res.status === 502) {
    throw new ApiError(res.status, `백엔드에 연결할 수 없습니다 (${API_TARGET})`);
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail;
    const issues = Array.isArray(detail) ? (detail as ValidationIssue[]) : [];
    const message =
      typeof detail === "string"
        ? detail
        : issues.length > 0
          ? issues.map((i) => `${i.loc.join(".")}: ${i.msg}`).join(", ")
          : res.statusText;
    throw new ApiError(res.status, `${res.status} ${message}`, issues, body);
  }
  return { data: body as T, res };
}

export const api = {
  /** GET /api/logs — received_at 최신순, X-Total-Count = 필터 조건 전체 건수 */
  async logs(query: LogQuery = {}): Promise<LogPage> {
    const { data, res } = await request<LogRecord[]>(`/api/logs${toQuery(query)}`);
    const header = res.headers.get("X-Total-Count");
    return { items: data ?? [], total: header === null ? null : Number(header) };
  },

  /** GET /api/logs/{id} */
  async log(id: string): Promise<LogRecord> {
    return (await request<LogRecord>(`/api/logs/${encodeURIComponent(id)}`)).data;
  },

  /** POST /api/logs — 시연용. 응답에 알림은 포함되지 않는다. */
  async createLog(body: LogCreate): Promise<LogRecord> {
    return (await request<LogRecord>("/api/logs", { method: "POST", body: JSON.stringify(body) })).data;
  },

  /** GET /api/alerts — 응답 스키마 미확정이므로 원본 그대로 반환 */
  async alerts(): Promise<unknown> {
    return (await request<unknown>("/api/alerts")).data;
  },
};
