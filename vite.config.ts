import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const proxyTarget = env.VITE_PROXY_TARGET || "http://localhost:8000";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      // 개발 서버에서 /api 요청을 백엔드로 전달한다 (CORS 우회).
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          // 백엔드 연결 실패 시 Vite 기본값(500) 대신 502로 응답해 백엔드 자체 오류와 구분한다.
          configure: (proxy) => {
            proxy.on("error", (_err, _req, res) => {
              if ("writeHead" in res && !res.headersSent && !res.writableEnded) {
                res.writeHead(502, { "Content-Type": "text/plain" }).end();
              }
            });
          },
        },
      },
    },
  };
});
