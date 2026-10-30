import { NavLink } from "react-router-dom";
import { BrainCircuit, FlaskConical, FolderSearch, LayoutDashboard, ShieldCheck } from "lucide-react";

const NAV = [
  { to: "/", label: "대시보드", icon: LayoutDashboard, end: true },
  { to: "/events", label: "보안 이벤트", icon: FolderSearch, end: false },
  { to: "/analysis", label: "AI 위협 분석", icon: BrainCircuit, end: false },
  { to: "/simulation", label: "기능 테스트", icon: FlaskConical, end: false },
];

export default function Sidebar() {
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
    </aside>
  );
}
