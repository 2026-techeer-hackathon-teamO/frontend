# frontend — 보안 담당자 대시보드 (React + Vite)

`backend`의 데이터를 실시간(5초 폴링)으로 보여주는 DLP 모니터링 대시보드입니다.

- 🚨 유출 의심 알림 (AI/규칙 분석 결과)
- 🎣 카나리토큰/디코이 발동 현황
- 📄 agent가 수집한 메일/USB/파일 로그

## 실행

```bash
cd frontend
npm install
cp .env.example .env     # VITE_API_BASE 확인 (기본: http://localhost:8000)
npm run dev              # http://localhost:5173
```

`backend`가 먼저 떠 있어야 데이터가 보입니다.

## 관련 레포

- [`agent`](../agent) — Windows 백그라운드 에이전트
- [`backend`](../backend) — 로그 수집 / AI 분석 / 카나리토큰 서버
