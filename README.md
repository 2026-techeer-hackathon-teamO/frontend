<div align="center">

# 🛡️ TrapDLP — Frontend

**AI 기반 능동형 데이터 유출 방지 · 공격자 탐지 시스템의 보안 관제 대시보드**

<br/>

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-6-CA4245?style=flat-square&logo=reactrouter&logoColor=white)
![Lucide](https://img.shields.io/badge/Lucide-icons-F56565?style=flat-square&logo=lucide&logoColor=white)

</div>

---

## 📌 프로젝트 소개

**TrapDLP**는 기밀 정보의 **이메일 · USB 반출 시도**를 감시하고, **허니파일(가짜 기밀 문서)** 과 **카나리 토큰**으로 내부 공격자를 유인·탐지하는 보안 시스템입니다.

이 레포는 보안 담당자가 사용하는 **관제 대시보드**로, `agent`가 수집하고 `backend`가 저장·분석한 보안 로그를 **5초 주기로 실시간 갱신**해 보여줍니다.

```
 ┌──────────┐   로그 전송   ┌──────────┐   REST API (/api/logs, /api/alerts)   ┌────────────┐
 │  agent   │ ───────────▶ │ backend  │ ◀──────────────────────────────────── │  frontend  │
 │ (Windows)│              │ (FastAPI)│          5초 폴링                     │ (이 레포)   │
 └──────────┘              └──────────┘                                       └────────────┘
```

<br/>

## ✨ 주요 기능

| 페이지 | 경로 | 기능 |
| :-- | :-- | :-- |
| 📊 **보안 관제 대시보드** | `/` | 전체·차단 이벤트 통계 카드(차단율), 최근 24시간 시간별 로그 추이 / 유형별 분포 차트, 최근 경보, 최근 보안 이벤트 10건 |
| 🔎 **보안 이벤트** | `/events` | 호스트·사용자·유형·문서 등급·차단 여부·기간 서버 필터, 페이지네이션(20/50/100), 이벤트 상세 패널 |
| 🧠 **AI 위협 분석** | `/analysis` | 위험도(LOW ~ CRITICAL) 요약, 사용자별 공격 유형·위험 점수, 판단 근거 & 권장 대응, 관련 이벤트 타임라인 |
| 🧪 **기능 테스트** | `/simulation` | 이메일 / USB / 허니파일 / 카나리 시나리오별 시연용 로그 생성, JSON 직접 입력 및 422 검증 오류 확인 |

<details>
<summary><b>📊 대시보드 자세히 보기</b></summary>
<br/>

- **통계 카드** — `GET /api/logs`의 `X-Total-Count` 헤더로 전체 이벤트 수, `blocked=true` 필터로 차단 이벤트 수와 차단율을 계산합니다.
- **로그 추이 차트** — `시간별` / `유형별` 토글
  - 시간별: 최근 24시간 로그를 `received_at` 기준으로 1시간 단위 집계, 전체·차단 건수를 겹쳐서 표시
  - 유형별: `file_access` · `email_send` · `usb_copy` · `blocked` 별 건수. 막대를 클릭하면 해당 유형으로 필터링된 보안 이벤트 페이지로 이동
- **최근 경보** — `GET /api/alerts` 응답을 표시합니다. 스키마가 확정되지 않아 원본 응답을 접어서 보여주며, 404면 미구현 안내를 띄웁니다.
- **최근 보안 이벤트** — 행을 클릭하면 해당 이벤트의 상세 화면으로 이동합니다.

</details>

<details>
<summary><b>🔎 보안 이벤트 자세히 보기</b></summary>
<br/>

- 모든 필터 · 페이지 · 선택된 이벤트가 **URL 쿼리 파라미터**에 저장되어 새로고침하거나 링크로 공유해도 같은 화면이 유지됩니다.
- 필터를 바꾸면 자동으로 첫 페이지로 돌아갑니다.
- 상세 패널에서 `GET /api/logs/{id}`로 파일 해시, 반출 채널, `detail` 원본 JSON까지 확인할 수 있습니다.

</details>

<details>
<summary><b>🧠 AI 위협 분석 자세히 보기</b></summary>
<br/>

- 위험도 등급별 건수 요약 (`LOW · 낮음` / `MEDIUM · 보통` / `HIGH · 높음` / `CRITICAL · 심각`)
- 분석 대상 목록에서 사용자를 선택하면 공격 유형, 위험 점수(0~100) 게이지, 요약, 판단 근거, 권장 대응을 표시
- 해당 사용자의 최근 로그 50건을 **타임라인**으로 보여주고, 각 항목은 보안 이벤트 상세로 연결됩니다.

> ⚠️ 알림 API(`GET /api/alerts`)의 응답 스키마가 확정되기 전이라 현재는 **목업 분석 데이터**를 사용합니다.
> 목 로그의 최근 24시간을 사용자별로 집계해 야간 반출, 허니파일 열람 직후 USB 복사 같은 패턴으로 위험도를 산출합니다.

</details>

<details>
<summary><b>🧪 기능 테스트 자세히 보기</b></summary>
<br/>

| 시나리오 | 생성되는 로그 |
| :-- | :-- |
| 📧 이메일 검사 | `event_type=email_send`, `channel=email:<수신자>` |
| 💾 USB 복사 | `event_type=usb_copy`, `channel=usb:<드라이브>` |
| 🍯 허니파일 접근 | `event_type=file_access`, `detail.scenario=honeyfile` |
| 🐤 카나리 토큰 | `event_type=file_access`, `detail.scenario=canary` |
| 🛠️ 직접 입력 | `POST /api/logs` 본문을 JSON으로 직접 작성 |

- 파일을 첨부하면 파일명과 크기가 자동으로 채워지고, 전송 전 요청 본문을 미리 볼 수 있습니다.
- FastAPI 422 응답은 `위치 / 유형 / 메시지` 표로 풀어서 보여줍니다.
- 이번 세션에서 생성한 로그 이력(최대 20건)을 확인하고 보안 이벤트 상세로 바로 이동할 수 있습니다.

> 이메일 DLP 검사 · USB 차단 · 허니파일 생성 등의 **실제 실행 API**는 아직 백엔드와 계약되지 않아, 지금은 시연용 로그 적재(`POST /api/logs`)만 수행합니다.

</details>

<br/>

## 🚀 시작하기

### 요구 사항

- Node.js 18 이상
- 실행 중인 [`backend`](https://github.com/2026-techeer-hackathon-teamO/backend) 서버 (목업 모드에서는 불필요)

### 설치 및 실행

```bash
npm install
cp .env.example .env   # 백엔드 주소 설정
npm run dev            # http://localhost:5173
```

### 백엔드 없이 목업 데이터로 실행

```bash
# .env
VITE_USE_MOCK=true
```

대시보드 · 보안 이벤트 · AI 위협 분석 화면을 백엔드 없이 확인할 수 있어 개발과 시연에 유용합니다.

### 빌드

```bash
npm run build     # 타입 체크 + 프로덕션 빌드 (dist/)
npm run preview   # 빌드 결과 미리보기
```

<br/>

## ⚙️ 환경 변수

| 변수 | 기본값 | 설명 |
| :-- | :-- | :-- |
| `VITE_PROXY_TARGET` | `http://localhost:8000` | 개발 서버가 `/api` 요청을 전달할 백엔드 주소 |
| `VITE_API_BASE` | *(비어 있음)* | 백엔드에 직접 요청할 베이스 URL. 비우면 같은 출처의 `/api`로 요청 |
| `VITE_USE_MOCK` | `false` | `true`면 백엔드 대신 목업 데이터 사용 |

> 💡 개발 중에는 Vite 프록시를 거치므로 CORS 설정이 필요 없습니다.
> `VITE_API_BASE`로 다른 출처의 백엔드에 직접 요청한다면 백엔드 CORS에서 `allow_origins`와 `expose_headers=["X-Total-Count"]`를 열어야 통계 카드와 페이지네이션의 전체 건수가 표시됩니다.
>
> 프록시가 백엔드에 연결하지 못하면 `502`를 반환하도록 설정해, 백엔드 자체 오류(500)와 구분해서 "백엔드에 연결할 수 없습니다" 안내를 띄웁니다.

<br/>

## 🔌 연동 API

자세한 명세는 [`docs/api.md`](docs/api.md)를 참고하세요.

| Method | Endpoint | 사용처 |
| :-- | :-- | :-- |
| `GET` | `/api/logs` | 대시보드 통계·차트, 보안 이벤트 목록, 분석 타임라인 (`X-Total-Count` 헤더로 전체 건수) |
| `GET` | `/api/logs/{id}` | 이벤트 상세 |
| `POST` | `/api/logs` | 기능 테스트 시연용 로그 생성 |
| `GET` | `/api/alerts` | 대시보드 최근 경보 *(스키마 미확정)* |

<br/>

## 📁 프로젝트 구조

```
src/
├── api/
│   └── client.ts          # API 클라이언트, LogRecord 타입, ApiError(422 검증 오류 파싱)
├── components/
│   ├── Sidebar.tsx        # 좌측 내비게이션
│   ├── StatCard.tsx       # 통계 카드
│   ├── EventTable.tsx     # 이벤트 테이블, 유형/차단 태그
│   └── RiskBadge.tsx      # 위험도 배지 (LOW ~ CRITICAL)
├── data/
│   ├── mockDashboard.ts   # 대시보드·보안 이벤트 목업 로그 (VITE_USE_MOCK)
│   └── mockEvents.ts      # AI 위협 분석 목업 (목 로그 기반 위험도 산출)
├── hooks/
│   └── usePolling.ts      # 5초 주기 자동 갱신 훅
├── pages/
│   ├── Dashboard.tsx      # /
│   ├── Events.tsx         # /events
│   ├── Analysis.tsx       # /analysis
│   └── Simulation.tsx     # /simulation
├── utils/
│   └── format.ts          # 날짜·숫자 포맷
├── App.tsx                # 라우팅
└── main.tsx
```

<br/>

## 🗺️ 진행 현황

- [x] 관리자 대시보드 (통계 카드, 시간별/유형별 차트, 최근 이벤트)
- [x] 보안 이벤트 목록 · 필터 · 페이지네이션 · 상세
- [x] 이메일 · USB 차단 현황 표시
- [x] 기능 테스트(시연용 로그 생성)
- [x] 목업 데이터 모드
- [x] 라이트 테마 UI
- [ ] `GET /api/alerts` 스키마 확정 후 AI 위협 분석 실데이터 연동
- [ ] 사용자별 위험도 · 허니파일 접근 현황 API 연동
- [ ] 이메일 DLP 검사 · USB 시뮬레이션 실행 API 연동

<br/>

## 🔗 관련 레포지토리

| 레포 | 설명 |
| :-- | :-- |
| [`agent`](https://github.com/2026-techeer-hackathon-teamO/agent) | Windows 백그라운드 에이전트 — 메일 / USB / 파일 이벤트 수집 |
| [`backend`](https://github.com/2026-techeer-hackathon-teamO/backend) | 로그 수집 · AI 분석 · 카나리 토큰 서버 |
| **`frontend`** | 보안 관제 대시보드 (현재 레포) |

<br/>

<div align="center">

**2026 Techeer Hackathon · Team O**

</div>
