const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export interface LogRecord {
  id: string;
  received_at: string;
  host: string;
  user: string;
  event_type: string;
  file_name?: string | null;
  classification?: string | null;
  channel?: string | null;
  blocked: boolean;
}

export interface Alert {
  id: string;
  created_at: string;
  severity: "low" | "medium" | "high";
  reason: string;
  score: number;
  host?: string | null;
  notified: boolean;
}

export interface Decoy {
  id: string;
  created_at: string;
  token_id: string;
  file_name: string;
  triggered: boolean;
  trigger_count: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  logs: () => get<LogRecord[]>("/api/logs"),
  alerts: () => get<Alert[]>("/api/alerts"),
  decoys: () => get<Decoy[]>("/api/decoys"),
  synthesizeDecoy: (fileName: string) =>
    fetch(`${BASE}/api/decoys/synthesize?file_name=${encodeURIComponent(fileName)}`, {
      method: "POST",
    }).then((r) => r.json()),
};
