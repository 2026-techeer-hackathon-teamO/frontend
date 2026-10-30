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

const CONFIDENTIAL = FILES.filter((f) => f.classification === "confidential");
const INTERNAL = FILES.filter((f) => f.classification === "internal");

const TRUSTED_DOMAIN = "partner-corp.co.kr";
const PERSONAL_DOMAINS = ["gmail.com", "naver.com", "outlook.com"];
const EMAIL_TARGETS = [...PERSONAL_DOMAINS, TRUSTED_DOMAIN];
const USB_DEVICES = ["SanDisk Ultra 64GB", "Samsung BAR Plus", "Kingston DataTraveler"];

const POLICY_EXTERNAL = "DLP-01 기밀문서 외부 반출 차단";
const POLICY_ACCESS = "DLP-02 기밀 폴더 무권한 접근 차단";
const POLICY_CHANNEL = "DLP-04 비인가 채널 차단";

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
    detail.device = pick(USB_DEVICES);
    if (sensitive && rand() < 0.7) blocked = true;
  } else if (event_type === "email_send" || event_type === "blocked") {
    const domain = pick(EMAIL_TARGETS);
    channel = `smtp:${domain}`;
    detail.recipient = `${pick(["backup", "me", "work", "temp"])}${Math.floor(rand() * 99)}@${domain}`;
    if (sensitive && domain !== TRUSTED_DOMAIN && rand() < 0.6) blocked = true;
  } else {
    detail.path = `\\\\fileserver\\share\\${file.classification}\\${file.name}`;
    if (file.name.includes("연봉테이블")) detail.honeyfile = true;
  }
  if (blocked) detail.policy = sensitive ? POLICY_EXTERNAL : POLICY_CHANNEL;

  return record(at, actor, file, event_type, channel, blocked, detail);
}

function record(
  at: number,
  actor: (typeof USERS)[number],
  file: (typeof FILES)[number],
  event_type: EventType,
  channel: string | null,
  blocked: boolean,
  detail: Record<string, unknown>,
): LogRecord {
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

/** 같은 사용자·같은 유형인데 조건 차이로 허용/차단이 갈리는 이벤트 쌍 (오래된 순: 허용 → 차단) */
function makeContrastPair(at: number): LogRecord[] {
  const actor = pick(USERS);
  const first = at - (2 + rand() * 3) * 1000;
  const scenario = rand();

  if (scenario < 0.4) {
    // 같은 기밀 문서라도 협력사 메일은 허용, 개인 메일은 차단
    const file = pick(CONFIDENTIAL);
    const domain = pick(PERSONAL_DOMAINS);
    return [
      record(first, actor, file, "email_send", `smtp:${TRUSTED_DOMAIN}`, false, {
        recipient: `pm@${TRUSTED_DOMAIN}`,
      }),
      record(at, actor, file, "email_send", `smtp:${domain}`, true, {
        recipient: `${actor.user}.backup@${domain}`,
        policy: POLICY_EXTERNAL,
      }),
    ];
  }
  if (scenario < 0.75) {
    // 같은 USB라도 사내 문서는 허용, 기밀 문서는 차단
    const channel = `usb:${pick(["E:", "F:"])}`;
    const device = pick(USB_DEVICES);
    return [
      record(first, actor, pick(INTERNAL), "usb_copy", channel, false, { device }),
      record(at, actor, pick(CONFIDENTIAL), "usb_copy", channel, true, { device, policy: POLICY_EXTERNAL }),
    ];
  }
  // 파일 서버 열람: 사내 문서는 허용, 권한 없는 기밀 폴더는 차단 (허니파일은 탐지용이라 열어 둔다)
  const allowed = pick(INTERNAL);
  const denied = pick(CONFIDENTIAL.filter((f) => !f.name.includes("연봉테이블")));
  const path = (f: (typeof FILES)[number]) => `\\\\fileserver\\share\\${f.classification}\\${f.name}`;
  return [
    record(first, actor, allowed, "file_access", null, false, { path: path(allowed) }),
    record(at, actor, denied, "file_access", null, true, { path: path(denied), policy: POLICY_ACCESS }),
  ];
}

/** 이력 생성 시 이벤트 대신 허용/차단 대비 쌍을 넣을 확률 */
const PAIR_RATE_HISTORY = 0.05;
/** 폴링 보정 시 대비 쌍을 넣을 확률 — 대시보드 최근 10건에 대체로 한 쌍은 보이도록 */
const PAIR_RATE_LIVE = 0.3;

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
    if (rand() < PAIR_RATE_HISTORY) fresh.push(...makeContrastPair(t));
    else fresh.push(makeLog(t));
  }
  generatedUntil = now;
  // 대비 쌍의 앞 이벤트가 직전 이벤트보다 이를 수 있어 시간순으로 다시 정렬
  fresh.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
  logs.unshift(...fresh);
}

/** 현재 시각까지 로그를 채운다. 폴링마다 1~2건은 들어오도록 보정 */
function sync() {
  const now = Date.now();
  fillUntil(now);
  if (logs.length === 0 || now - new Date(logs[0].received_at).getTime() > 6000) {
    logs.unshift(...(rand() < PAIR_RATE_LIVE ? makeContrastPair(now) : [makeLog(now)]).reverse());
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
