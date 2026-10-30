import { NavLink } from "react-router-dom";
import { BrainCircuit, FlaskConical, FolderSearch, LayoutDashboard, ShieldCheck } from "lucide-react";
import { API_TARGET, api } from "../api/client";
import { usePolling } from "../hooks/usePolling";
import { formatTime } from "../utils/format";

const NAV = [
  { to: "/", label: "대시보드", icon: LayoutDashboard, end: true },
  { to: "/events", label: "보안 이벤트", icon: FolderSearch, end: false },
  { to: "/analysis", label: "AI 위협 분석", icon: BrainCircuit, end: false },
  { to: "/simulation", label: "기능 테스트", icon: FlaskConical, end: false },
];

export default function Sidebar() {
  // 별도 상태 API가 없으므로 "로그 API 응답 여부"만 표시한다.
  const { error, updatedAt } = usePolling(() => api.logs({ limit: 1 }), []);
  const state = error ? "down" : updatedAt ? "up" : "pending";
  const label = { up: "응답 정상", down: "응답 없음", pending: "확인 중" }[state];

  return (
    <aside className="sidebar">
      <div className="brand">
        <ShieldCheck className="brand-icon" size={22} />
        <span>TrapDLP</span>
      </div>

      <nav className="nav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            <item.icon className="nav-icon" size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sys-status">
        <div className="sys-status-title">백엔드 로그 API</div>
        <div className={`status-dot ${state}`}>{label}</div>
        <div className="sys-status-meta" title={API_TARGET}>
          {API_TARGET}
        </div>
        {updatedAt && <div className="sys-status-meta">마지막 응답 {formatTime(updatedAt)}</div>}
        {error && <div className="sys-status-meta danger">{error.message}</div>}
      </div>
    </aside>
  );
}
