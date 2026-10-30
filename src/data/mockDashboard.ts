import { ApiError, EVENT_TYPES, type EventType, type LogPage, type LogQuery, type LogRecord } from "../api/client";

/**
 * 개발용 대시보드/보안 이벤트 목업 데이터. VITE_USE_MOCK=true일 때만 사용한다.
 * 최근 14일 로그를 시간대별 가중치로 생성하고, 호출될 때마다 새 이벤트를 몇 건씩 덧붙여 실시간처럼 보이게 한다.
 * 실제 수집 데이터가 아니다.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

const HOUR = 3600 * 1000;

/** 같은 화면이 매번 같은 분포로 보이도록 시드 고정 난수 (mulberry32) */
function createRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = createRandom(20261031);
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];

const USERS = [
  { user: "kim", host: "PC-01" },
  { user: "lee", host: "PC-03" },
  { user: "park", host: "PC-07" },
  { user: "choi", host: "PC-12" },
  { user: "jung", host: "PC-05" },
  { user: "kang", host: "PC-09" },
  { user: "yoon", host: "PC-14" },
  { user: "han", host: "LAPTOP-02" },
  { user: "seo", host: "LAPTOP-04" },
  { user: "lim", host: "PC-21" },
] as const;

const FILES = [
  { name: "2026_임원_연봉테이블.xlsx", classification: "confidential" },
  { name: "신제품_로드맵_v3.pptx", classification: "confidential" },
  { name: "고객사_계약서_스캔본.pdf", classification: "confidential" },
  { name: "소스코드_백업_1030.zip", classification: "confidential" },
  { name: "인사평가_결과_취합.xlsx", classification: "confidential" },
  { name: "분기_매출보고서_Q3.xlsx", classification: "internal" },
  { name: "회의록_1029_개발팀.docx", classification: "internal" },
  { name: "서버_접속정보_정리.txt", classification: "internal" },
  { name: "협력사_연락처.csv", classification: "internal" },
  { name: "주간업무보고.docx", classification: "public" },
  { name: "사내_공지_템플릿.hwp", classification: "public" },
  { name: "제품_소개서.pdf", classification: "public" },
] as const;

const EMAIL_TARGETS = ["gmail.com", "naver.com", "partner-corp.co.kr", "outlook.com"];

/** 0~23시 활동량 가중치: 업무시간에 몰리고, 22~01시에 비정상 반출 시도가 튀도록 구성 */
const HOURLY_WEIGHT = [
  0.9, 0.5, 0.2, 0.1, 0.1, 0.2, 0.4, 0.9, 2.2, 3.4, 3.8, 3.5, 2.1, 3.0, 3.7, 3.9, 3.6, 3.0, 2.0, 1.1, 0.8, 0.7, 1.6,
  2.4,
];
export const NIGHT_HOURS = new Set([22, 23, 0, 1]);
const BASE_PER_HOUR = 14;

let seq = 0;

function hexHash() {
  return Array.from({ length: 64 }, () => Math.floor(rand() * 16).toString(16)).join("");
}

function makeLog(at: number): LogRecord {
  const hour = new Date(at).getHours();
  const night = NIGHT_HOURS.has(hour);
  // 야간 이상 행위는 소수 사용자에게 집중
  const actor = night && rand() < 0.7 ? USERS[rand() < 0.6 ? 0 : 1] : pick(USERS);
  const file = night && rand() < 0.6 ? FILES[Math.floor(rand() * 5)] : pick(FILES);

  const r = rand();
  let event_type: EventType;
  if (night) event_type = r < 0.3 ? "file_access" : r < 0.55 ? "usb_copy" : r < 0.75 ? "email_send" : "blocked";
  else event_type = r < 0.68 ? "file_access" : r < 0.86 ? "email_send" : r < 0.95 ? "usb_copy" : "blocked";

  const sensitive = file.classification === "confidential";
  let channel: string | null = null;
  let blocked = event_type === "blocked";
  const detail: Record<string, unknown> = {};

  if (event_type === "usb_copy" || (event_type === "blocked" && rand() < 0.5)) {
    channel = `usb:${pick(["E:", "F:"])}`;
    detail.device = pick(["SanDisk Ultra 64GB", "Samsung BAR Plus", "Kingston DataTraveler"]);
    if (sensitive && rand() < 0.7) blocked = true;
  } else if (event_type === "email_send" || event_type === "blocked") {
    const domain = pick(EMAIL_TARGETS);
    channel = `smtp:${domain}`;
    detail.recipient = `${pick(["backup", "me", "work", "temp"])}${Math.floor(rand() * 99)}@${domain}`;
    if (sensitive && domain !== "partner-corp.co.kr" && rand() < 0.6) blocked = true;
  } else {
    detail.path = `\\\\fileserver\\share\\${file.classification}\\${file.name}`;
    if (file.name.includes("연봉테이블")) detail.honeyfile = true;
  }
  if (blocked) detail.policy = sensitive ? "DLP-01 기밀문서 외부 반출 차단" : "DLP-04 비인가 채널 차단";

  seq += 1;
  return {
    id: `mock-${seq.toString().padStart(6, "0")}`,
    received_at: new Date(at).toISOString(),
    host: actor.host,
    user: actor.user,
    event_type,
    file_name: file.name,
    file_hash: hexHash(),
    classification: file.classification,
    channel,
    blocked,
    detail,
  };
}

/** 최신순 */
const logs: LogRecord[] = [];
/** 보안 이벤트 목록에서 페이지를 넘겨볼 수 있도록 최근 14일치를 미리 만들어 둔다 */
const HISTORY_DAYS = 14;
let generatedUntil = Date.now() - HISTORY_DAYS * 24 * HOUR;

/** generatedUntil부터 now까지 시간대 가중치에 맞춰 이벤트를 채운다 */
function fillUntil(now: number) {
  const fresh: LogRecord[] = [];
  let t = generatedUntil;
  while (true) {
    const perHour = BASE_PER_HOUR * HOURLY_WEIGHT[new Date(t).getHours()];
    t += -Math.log(1 - rand()) * (HOUR / perHour); // 포아송 도착 간격
    if (t > now) break;
    fresh.push(makeLog(t));
  }
  generatedUntil = now;
  logs.unshift(...fresh.reverse());
}

/** 현재 시각까지 로그를 채운다. 폴링마다 1~2건은 들어오도록 보정 */
function sync() {
  const now = Date.now();
  fillUntil(now);
  if (logs.length === 0 || now - new Date(logs[0].received_at).getTime() > 6000) {
    logs.unshift(makeLog(now));
  }
  return now;
}

const delay = () => new Promise((r) => setTimeout(r, 150)); // 네트워크 지연 흉내

function page(items: LogRecord[], limit: number, offset = 0): LogPage {
  return { items: items.slice(offset, offset + limit), total: items.length };
}

/** GET /api/logs 흉내 — docs/api.md 필터 규칙(host/user/classification 정확히 일치, since/until 수신 시각) */
export async function mockLogs(query: LogQuery = {}): Promise<LogPage> {
  sync();
  const since = query.since ? new Date(query.since).getTime() : null;
  const until = query.until ? new Date(query.until).getTime() : null;
  const matched = logs.filter((l) => {
    const at = new Date(l.received_at).getTime();
    return (
      (!query.host || l.host === query.host) &&
      (!query.user || l.user === query.user) &&
      (!query.event_type || l.event_type === query.event_type) &&
      (!query.classification || l.classification === query.classification) &&
      (query.blocked === undefined || l.blocked === query.blocked) &&
      (since === null || at >= since) &&
      (until === null || at <= until)
    );
  });
  await delay();
  return page(matched, query.limit ?? 100, query.offset ?? 0);
}

/** GET /api/logs/{id} 흉내 */
export async function mockLog(id: string): Promise<LogRecord> {
  sync();
  await delay();
  const log = logs.find((l) => l.id === id);
  if (!log) throw new ApiError(404, "404 Log not found");
  return log;
}

export async function loadMockDashboard() {
  const now = sync();
  const since = now - 24 * HOUR;
  const window24 = logs.filter((l) => new Date(l.received_at).getTime() >= since);
  const blocked = logs.filter((l) => l.blocked);

  await delay();

  return {
    recent: page(logs, 10),
    blocked: page(blocked, 1),
    window24: page(window24, 1000),
    byType: EVENT_TYPES.map((type) => ({ type, total: logs.filter((l) => l.event_type === type).length })),
  };
}
