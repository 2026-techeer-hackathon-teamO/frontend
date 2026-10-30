import { Link, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Analysis from "./pages/Analysis";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import Simulation from "./pages/Simulation";

function NotFound() {
  return (
    <div className="page">
      <h1>페이지를 찾을 수 없습니다</h1>
      <Link to="/" className="link">
        대시보드로 이동 →
      </Link>
    </div>
  );
}

export default function App() {
  // 전체 페이지 라이트 테마
  return (
    <div className="layout theme-light">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
