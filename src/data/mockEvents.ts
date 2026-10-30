import type { LogRecord } from "../api/client";
import type { RiskLevel } from "../components/RiskBadge";
import { NIGHT_HOURS, mockLogs } from "./mockDashboard";

/**
 * 개발용 AI 위협 분석 목업 데이터.
 * GET /api/alerts 응답 스키마가 확정되기 전까지 화면 확인용으로, 대시보드·보안 이벤트와 같은 목 로그의
 * 최근 24시간을 사용자별로 집계해 위험도·판단 근거를 만든다. 실제 분석 결과가 아니다.
 */
export interface MockAnalysis {
  id: string;
  user: string;
  host: string;
  risk_level: RiskLevel;
  risk_score: number;
  attack_type: string;
  summary: string;
  reasons: string[];
  recommendations: string[];
  analyzed_at: string;
}

const HOUR = 3600 * 1000;
const WINDOW_HOURS = 24;
/** 허니파일 열람 후 이 시간 안에 USB 복사가 있으면 연계 반출 시도로 본다 */
const HONEY_TO_USB = 0.5 * HOUR;
/** 협력사 메일은 허용된 반출 채널 */
const TRUSTED_CHANNEL = "smtp:partner-corp.co.kr";

const timeOf = (l: LogRecord) => new Date(l.received_at).getTime();
const isNight = (l: LogRecord) => NIGHT_HOURS.has(new Date(l.received_at).getHours());
const isOutbound = (l: LogRecord) => l.channel !== null && l.channel !== TRUSTED_CHANNEL;
const unique = (list: string[]) => [...new Set(list)].join(", ");

function riskLevel(score: number): RiskLevel {
  if (score >= 90) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

const RECOMMENDATIONS: Record<RiskLevel, (user: string, host: string) => string[]> = {
  CRITICAL: (user, host) => [
    `${user} 계정 USB 쓰기 권한 즉시 회수`,
    `${host} 단말 격리 및 포렌식 이미지 확보`,
    "인사/감사 부서에 내부자 위협 의심 건으로 통보",
  ],
  HIGH: () => ["외부 메일 첨부·USB 반출 일시 차단", "사용자 면담 및 반출 사유 확인"],
  MEDIUM: () => ["파일 서버 접근 권한 점검", "추가 이상 행위 여부 24시간 모니터링"],
  LOW: () => ["조치 불필요"],
};

/** 한 사용자의 최근 24시간 로그(최신순)로 분석 카드를 만든다 */
function analyze(logs: LogRecord[]): MockAnalysis {
  const { user, host } = logs[0];
  const night = logs.filter(isNight);
  const honey = logs.filter((l) => l.detail.honeyfile === true);
  const nightHoney = honey.filter(isNight);
  const confOut = logs.filter((l) => l.classification === "confidential" && isOutbound(l));
  const nightConfOut = confOut.filter(isNight);
  const confUsb = confOut.filter((l) => l.channel!.startsWith("usb:"));
  const confMail = confOut.filter((l) => l.channel!.startsWith("smtp:"));
  const blocked = logs.filter((l) => l.blocked);
  const honeyThenUsb = honey.some((h) => confUsb.some((u) => timeOf(u) > timeOf(h) && timeOf(u) - timeOf(h) <= HONEY_TO_USB));

  const score = Math.min(
    99,
    Math.round(
      Math.min(40, night.length) +
        (nightHoney.length > 0 ? 20 : 0) +
        Math.min(20, nightConfOut.length * 2) +
        Math.min(10, (confOut.length - nightConfOut.length) * 2) +
        Math.min(10, blocked.length / 2),
    ),
  );
  const level = riskLevel(score);

  const reasons: string[] = [];
  if (honey.length > 0) {
    reasons.push(
      `허니파일(${honey[0].file_name}) 열람 ${honey.length}회` +
        (nightHoney.length > 0 ? ` (야간 ${nightHoney.length}회)` : ""),
    );
  }
  if (honeyThenUsb) reasons.push("허니파일 열람 후 30분 이내 confidential 등급 파일 USB 복사 시도");
  if (night.length > 0) reasons.push(`평소 업무 시간대를 벗어난 22~01시 활동 ${night.length}건`);
  if (confUsb.length > 0) {
    reasons.push(`${unique(confUsb.map((l) => l.channel!))} 채널로 confidential 등급 파일 복사 ${confUsb.length}회`);
  }
  if (confMail.length > 0) {
    const domains = unique(confMail.map((l) => l.channel!.slice("smtp:".length)));
    reasons.push(`외부 도메인(${domains})으로 confidential 등급 파일 메일 전송 ${confMail.length}회`);
  }
  if (blocked.length > 0) reasons.push(`DLP 정책에 의해 차단 ${blocked.length}건`);
  if (reasons.length === 0) reasons.push("반출 채널 사용 없음");

  let attackType: string;
  if (level === "LOW") attackType = "업무 범위 내 활동";
  else if (honeyThenUsb) attackType = "허니파일 접근 후 USB 반출 시도";
  else if (nightHoney.length > 0) attackType = "야간 허니파일 접근";
  else if (confMail.length > confUsb.length) attackType = "외부 메일로 기밀 문서 반복 전송";
  else if (confUsb.length > 0) attackType = "USB로 기밀 문서 반출 시도";
  else attackType = "비정상 시간대 활동";

  const confOutBlocked = confOut.filter((l) => l.blocked).length;
  const summary =
    level === "LOW"
      ? `최근 24시간 ${logs.length}건의 활동이 업무 시간대에 집중되어 있고 이상 징후가 기준치 미만입니다.`
      : `최근 24시간 ${logs.length}건 중 야간 활동 ${night.length}건, 기밀 문서 외부 반출 시도 ${confOut.length}건(차단 ${confOutBlocked}건)이 확인되었습니다.`;

  return {
    id: `analysis-${user}`,
    user,
    host,
    risk_level: level,
    risk_score: score,
    attack_type: attackType,
    summary,
    reasons,
    recommendations: RECOMMENDATIONS[level](user, host),
    analyzed_at: logs[0].received_at,
  };
}

/** 사용자별 분석 결과, 위험도 높은 순 */
export async function loadMockAnalyses(): Promise<MockAnalysis[]> {
  const since = new Date(Date.now() - WINDOW_HOURS * HOUR).toISOString();
  const { items } = await mockLogs({ since, limit: Infinity });
  const byUser = new Map<string, LogRecord[]>();
  for (const log of items) {
    const list = byUser.get(log.user) ?? [];
    list.push(log);
    byUser.set(log.user, list);
  }
  return [...byUser.values()].map(analyze).sort((a, b) => b.risk_score - a.risk_score);
}
