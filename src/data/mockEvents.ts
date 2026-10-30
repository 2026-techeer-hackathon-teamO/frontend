import type { RiskLevel } from "../components/RiskBadge";

/**
 * 개발용 목업 데이터.
 * GET /api/alerts 응답 스키마가 확정되기 전까지 AI 위협 분석 화면의 레이아웃 확인용으로만 사용한다.
 * 실제 분석 결과가 아니다.
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

export const mockAnalyses: MockAnalysis[] = [
  {
    id: "mock-1",
    user: "kim",
    host: "PC-01",
    risk_level: "CRITICAL",
    risk_score: 94,
    attack_type: "허니파일 접근 후 USB 반출 시도",
    summary: "디코이 문서를 연 직후 동일 파일을 이동식 저장소로 복사하려고 시도했습니다.",
    reasons: [
      "업무와 무관한 허니파일(2026_임원_연봉테이블.xlsx) 열람",
      "열람 3분 이내 usb:E: 채널로 confidential 등급 파일 복사 시도",
      "평소 접속 시간대(09~18시)를 벗어난 23시 이후 활동",
    ],
    recommendations: [
      "해당 계정 USB 쓰기 권한 즉시 회수",
      "PC-01 단말 격리 및 포렌식 이미지 확보",
      "인사/감사 부서에 내부자 위협 의심 건으로 통보",
    ],
    analyzed_at: "2026-10-30T23:12:00Z",
  },
  {
    id: "mock-2",
    user: "lee",
    host: "PC-03",
    risk_level: "HIGH",
    risk_score: 78,
    attack_type: "외부 메일로 기밀 문서 반복 전송",
    summary: "개인 메일 도메인으로 기밀 등급 첨부파일 전송이 짧은 간격으로 반복되었습니다.",
    reasons: [
      "1시간 내 외부 도메인 수신자에게 email_send 5회",
      "첨부파일 중 3건이 confidential 등급",
      "2건이 정책에 의해 차단되었으나 파일명을 바꿔 재시도",
    ],
    recommendations: ["외부 메일 첨부 전송 일시 차단", "사용자 면담 및 전송 사유 확인"],
    analyzed_at: "2026-10-30T15:40:00Z",
  },
  {
    id: "mock-3",
    user: "park",
    host: "PC-07",
    risk_level: "MEDIUM",
    risk_score: 52,
    attack_type: "카나리 토큰 문서 열람",
    summary: "공유 폴더의 카나리 토큰이 삽입된 문서가 열렸습니다. 반출 시도는 없었습니다.",
    reasons: ["카나리 토큰 1회 발동", "후속 반출 이벤트 없음"],
    recommendations: ["공유 폴더 접근 권한 점검", "추가 발동 여부 24시간 모니터링"],
    analyzed_at: "2026-10-30T11:05:00Z",
  },
  {
    id: "mock-4",
    user: "choi",
    host: "PC-12",
    risk_level: "LOW",
    risk_score: 18,
    attack_type: "일반 파일 접근",
    summary: "업무 범위 내 파일 접근으로 판단됩니다.",
    reasons: ["internal 등급 문서 열람", "반출 채널 사용 없음"],
    recommendations: ["조치 불필요"],
    analyzed_at: "2026-10-30T09:20:00Z",
  },
];
