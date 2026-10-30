# frontend — 보안 담당자 대시보드 (React + Vite)

`backend`의 데이터를 실시간(5초 폴링)으로 보여주는 DLP 모니터링 대시보드입니다.

- 🚨 유출 의심 알림 (AI/규칙 분석 결과)
- 🎣 카나리토큰/디코이 발동 현황
- 📄 agent가 수집한 메일/USB/파일 로그

## 프로젝트 개요

본 서비스는 AI 기반 능동형 데이터 유출 방지 및 공격자 탐지 시스템이다. 기밀정보의 이메일·USB 반출 시도를 검사하고, AI가 가짜 기밀 문서(허니파일)를 만들며, 카나리 토큰 접근과 여러 보안 이벤트를 분석해 관리자에게 알린다.

1.관리자 대시보드 구현 2.보안 이벤트 및 사용자별 위험도 표시
3.AI 분석 결과 표시 4.이메일·USB 차단 현황 표시 5.허니파일 접근 현황 표시 6.백엔드 API 연결 및 통합 디버깅

## 화면 구조

우선순위 | 페이지 | 경로 | 주요 기능
P0 | 보안 대시보드 | / | 통계 카드, 최근 이벤트, 위험도 현황, 차단 현황
P0 | 보안 이벤트 | /events | 이벤트 테이블, 유형·위험도 필터, 이벤트 상세
P0 | AI 위협 분석 | /analysis | 공격 유형, 위험도, 판단 근거, 권장 대응
P1 | 기능 테스트 | /simulation | 이메일 첨부파일 검사, USB 복사 시뮬레이션, 허니파일/카나리 시연

## 화면별 구성

A. 대시보드 /

- 상단: TrapDLP, 시스템 상태(실제 상태 API가 없으면 고정 상태로 오해하게 표시하지 않기)
- 통계 카드: 전체 로그 수(GET /api/logs의 필터 없는 X-Total-Count), 차단 로그 수(blocked=true 필터의 X-Total-Count), 위험 사용자·허니파일 접근(별도 API 확인 전에는 미연동 표시)
- 그래프: received_at 기반 시간별 로그 추이 또는 event_type별 분포. 위험도 분포는 알림 API 스키마 확인 후 구현
- 최근 로그 테이블: received_at, user, host, event_type, file_name, blocked (로그에는 위험도 필드 없음)
- 위험 경보 요약: GET /api/alerts 응답 스키마가 확정되면 연동. 그전에는 목업임을 표시하거나 영역을 숨김

  ┌───────────────┬────────────────────────────────────────────────────┐
  │ TrapDLP │ 보안 관제 대시보드 │
  │ ├────────────┬────────────┬────────────┬────────────┤
  │ 대시보드 │ 전체 이벤트│ 차단 이벤트│ 위험 사용자│ 허니파일 │
  │ 보안 이벤트 ├────────────┴────────────┴────────────┴────────────┤
  │ AI 위협 분석 │ 위험도별 그래프 │ 최근 경보 │
  │ 기능 테스트 ├─────────────────────────┴──────────────────────────┤
  │ │ 최근 보안 이벤트 테이블 │
  └───────────────┴────────────────────────────────────────────────────┘

B. 보안 이벤트 /events

- 이벤트 목록: received_at, user, host, event_type, file_name, classification, channel, blocked
- 서버 필터: host, user, event_type, classification, blocked, since, until
- limit(1~1000, 기본 100), offset(0 이상)으로 페이지네이션; X-Total-Count 헤더로 전체 건수 계산
- 행 선택 시 GET /api/logs/{id}로 상세 조회 (detail, file_hash 포함)
- 새로고침 버튼 및 5초 폴링; 필터 변경 시 offset=0으로 초기화
- 위험도 필터는 로그 API에서 지원하지 않음. 알림 API와 연동한 뒤 별도로 구현

C. AI 위협 분석 /analysis

- 사용자 또는 이벤트별 위험도: LOW / MEDIUM / HIGH / CRITICAL
- 공격 유형, 판단 근거, 권장 대응 표시
- 관련 이벤트 타임라인
- 주의: LogRecord에는 risk_score, risk_level, AI 판단 근거/권장 대응 필드가 없다. GET /api/alerts는 존재한다고 안내되지만 응답 스키마가 제공되지 않았다. 스키마 확정 전에는 실제 분석 데이터인 것처럼 표시하지 않는다.

D. 기능 테스트 /simulation

- 이메일 검사: 수신자 입력, 파일 첨부, DLP 검사 결과(허용/차단)
- USB 복사 시뮬레이션: 테스트 파일 선택, 복사 시도, 허용/차단 결과
- 허니파일: 생성/등록 결과 및 접근 이벤트 확인
- 카나리: 승인된 테스트 문서/토큰에 대한 접근 기록 확인
- 시연용 로그 생성: POST /api/logs는 host, user, event_type이 필수이며, id/`received_at`은 서버가 부여한다. 실제 로그 적재는 Agent 담당이다.
- 주의: 이메일 DLP 검사·USB 시뮬레이션 실행·AI 문서 생성·카나리 테스트의 실행 API는 이번 로그 API 명세만으로 확인할 수 없다. 백엔드 담당자와 별도 계약해야 한다.

## 폴더 구조

```
frontend/
├── src/
│   ├── api/
│   │   └── client.ts        # API 호출 함수 (GET/POST /api/logs, GET /api/logs/{id}, GET /api/alerts)
│   ├── components/
│   │   ├── Sidebar.tsx      # 공통 메뉴 + 백엔드 응답 상태
│   │   ├── StatCard.tsx     # 통계 카드
│   │   ├── EventTable.tsx   # 이벤트 테이블 (+ 유형/차단 태그)
│   │   └── RiskBadge.tsx    # 위험도 배지 (LOW/MEDIUM/HIGH/CRITICAL)
│   ├── hooks/
│   │   └── usePolling.ts    # 5초 폴링 훅
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Events.tsx
│   │   ├── Analysis.tsx
│   │   └── Simulation.tsx
│   ├── data/
│   │   └── mockEvents.ts    # 개발용 목업 데이터 (AI 분석 화면 전용)
│   ├── utils/
│   │   └── format.ts        # 날짜/숫자 포맷
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.example
└── package.json
```

> 개발 중에는 Vite 프록시를 거치므로 CORS 설정이 필요 없습니다. `VITE_API_BASE`로 백엔드에 직접 요청할 때는 백엔드 CORS에서 `expose_headers=["X-Total-Count"]`를 열어야 통계 카드·페이지네이션의 전체 건수가 표시됩니다.

## 실행

```bash
cd frontend
npm install
cp .env.example .env     # VITE_PROXY_TARGET에 백엔드 주소 설정 (기본: http://localhost:8000)
npm run dev              # http://localhost:5173
```

`backend`가 먼저 떠 있어야 데이터가 보입니다.

## 관련 레포

- [`agent`](../agent) — Windows 백그라운드 에이전트
- [`backend`](../backend) — 로그 수집 / AI 분석 / 카나리토큰 서버
