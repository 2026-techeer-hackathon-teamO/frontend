import { EVENT_TYPE_LABELS, type EventType, type LogRecord } from "../api/client";
import { formatDateTime } from "../utils/format";

export function EventTypeTag({ type }: { type: string }) {
  const label = EVENT_TYPE_LABELS[type as EventType] ?? type;
  return <span className={`tag tag-type type-${type}`}>{label}</span>;
}

export function BlockedTag({ blocked }: { blocked: boolean }) {
  return <span className={`tag ${blocked ? "tag-danger" : "tag-ok"}`}>{blocked ? "차단" : "허용"}</span>;
}

interface Props {
  logs: LogRecord[];
  /** compact: 대시보드용, full: 보안 이벤트 페이지용(등급·채널 포함) */
  variant?: "compact" | "full";
  onSelect?: (log: LogRecord) => void;
  selectedId?: string | null;
  emptyText?: string;
}

export default function EventTable({ logs, variant = "compact", onSelect, selectedId, emptyText }: Props) {
  const full = variant === "full";

  if (logs.length === 0) {
    return <p className="empty">{emptyText ?? "표시할 이벤트가 없습니다."}</p>;
  }

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>수신 시각</th>
            <th>사용자</th>
            <th>호스트</th>
            <th>유형</th>
            <th>파일명</th>
            {full && <th>등급</th>}
            {full && <th>채널</th>}
            <th>결과</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              className={`${onSelect ? "clickable" : ""} ${log.id === selectedId ? "selected" : ""}`}
              onClick={onSelect ? () => onSelect(log) : undefined}
            >
              <td className="nowrap mono">{formatDateTime(log.received_at)}</td>
              <td>{log.user}</td>
              <td>{log.host}</td>
              <td>
                <EventTypeTag type={log.event_type} />
              </td>
              <td className="ellipsis" title={log.file_name ?? undefined}>
                {log.file_name ?? <span className="muted">-</span>}
              </td>
              {full && <td>{log.classification ?? <span className="muted">-</span>}</td>}
              {full && <td className="mono">{log.channel ?? <span className="muted">-</span>}</td>}
              <td>
                <BlockedTag blocked={log.blocked} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
