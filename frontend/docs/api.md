## 개요

로그 API는 PC/사용자별 보안 이벤트를 기록하고 조회한다. 실제 로그 적재는 Endpoint Agent가 담당하며, 프론트엔드의 POST /api/logs 호출은 시연용이다.
Method | Endpoint | 목적
POST | /api/logs | 보안 이벤트 등록(시연용)
GET | /api/logs | 보안 이벤트 목록 조회·필터링·페이지네이션
GET | /api/logs/{id} | 보안 이벤트 상세 조회

서버는 로그 저장 직후 유출 의심 여부를 분석한다. 의심 이벤트의 알림은 **`GET /api/alerts`**로 별도 조회하며, POST /api/logs 응답에는 알림이 포함되지 않는다. GET /api/alerts의 구체적인 응답 스키마는 이번 자료에 없다.

## LogRecord 스키마

필드 | 타입 | POST 필수 | null 가능 | 설명 | 예시
id | string | 서버 부여 | 아니오 | 32자리 hex 로그 ID | 27d66df918ff4f849ed54ab7e5fa4aea
received_at | string | 서버 부여 | 아니오 | 서버 수신 시각, UTC ISO8601 | 2026-10-30T17:47:16.016811Z
host | string | 필수 | 아니오 | PC 식별자 | PC-01
user | string | 필수 | 아니오 | 로그인 사용자 | kim
event_type | string | 필수 | 아니오 | 이벤트 종류 | usb_copy
file_name | string / null | 선택 | 예 | 파일명 | 기밀.pdf
file_hash | string / null | 선택 | 예 | 기밀 파일 식별 해시 | null
classification | string / null | 선택 | 예 | 문서 등급 | confidential
channel | string / null | 선택 | 예 | 반출 채널 | usb:E:
blocked | boolean | 선택 | 아니오 | 정책 차단 여부, 기본 false | false
detail | object | 선택 | 아니오 | 추가 정보, 기본 {} | { "size": 10 }

event_type 허용 값
값 | 의미
file_access | 파일 접근
email_send | 이메일 전송
usb_copy | USB 복사
blocked | 차단 이벤트

주의: 원본 해커톤 기획서의 대문자 이벤트 코드(USB_COPY_ATTEMPT 등)와 이 API의 소문자 enum은 서로 다르다. 이 API에 요청할 때는 위 네 가지 소문자 값만 사용해야 한다. 별도 변환 규칙은 백엔드 담당자와 협의한다.

## POST /api/logs — 로그 생성

요청
POST /api/logs
Content-Type: application/json
id와 received_at은 보내지 않는다.
{
"host": "PC-01",
"user": "kim",
"event_type": "usb_copy",
"file_name": "기밀.pdf",
"classification": "confidential",
"channel": "usb:E:",
"detail": { "size": 10 }
}

성공: 200 OK — 저장된 LogRecord를 반환한다.
{
"host": "PC-01",
"user": "kim",
"event_type": "usb_copy",
"file_name": "기밀.pdf",
"file_hash": null,
"classification": "confidential",
"channel": "usb:E:",
"blocked": false,
"detail": { "size": 10 },
"id": "27d66df918ff4f849ed54ab7e5fa4aea",
"received_at": "2026-10-30T17:47:16.016811Z"
}

실패: 422 Unprocessable Entity — 필수 필드 누락 또는 허용되지 않은 이벤트 유형 등.
{
"detail": [
{
"type": "missing",
"loc": ["body", "user"],
"msg": "Field required",
"input": { "host": "PC-01", "event_type": "print" }
},
{
"type": "enum",
"loc": ["body", "event_type"],
"msg": "Input should be 'file_access', 'email_send', 'usb_copy' or 'blocked'",
"input": "print",
"ctx": { "expected": "'file_access', 'email_send', 'usb_copy' or 'blocked'" }
}
]
}

## GET /api/logs — 목록 조회

요청 예시
GET /api/logs?host=PC-01&event_type=usb_copy&since=2026-10-01T00:00:00Z&limit=20&offset=0
모든 쿼리 파라미터는 선택이다.
파라미터 | 타입 | 기본값 | 설명
host | string | 없음 | 정확히 일치
user | string | 없음 | 정확히 일치
event_type | string | 없음 | 허용된 네 가지 이벤트 유형
classification | string | 없음 | 정확히 일치
blocked | boolean | 없음 | true / false
since | datetime | 없음 | 이후 수신 시각. ISO8601, 시간대 생략 시 UTC
until | datetime | 없음 | 이전 수신 시각. ISO8601, 시간대 생략 시 UTC
limit | int | 100 | 1~1000
offset | int | 0 | 0 이상

성공: 200 OK

- Body: LogRecord[], received_at 기준 최신순.
- 검색 결과가 없으면 [].
- 응답 헤더 X-Total-Count: 필터 조건에 해당하는 전체 건수(현재 페이지 건수가 아님).
  HTTP/1.1 200 OK
  content-type: application/json
  x-total-count: 1
  [
  {
  "host": "PC-01",
  "user": "kim",
  "event_type": "usb_copy",
  "file_name": "기밀.pdf",
  "file_hash": null,
  "classification": "confidential",
  "channel": "usb:E:",
  "blocked": false,
  "detail": { "size": 10 },
  "id": "27d66df918ff4f849ed54ab7e5fa4aea",
  "received_at": "2026-10-30T17:47:16.016811Z"
  }
  ]
  실패: 422 Unprocessable Entity — limit/`offset` 범위 초과 또는 필터 형식 오류.
  {
  "detail": [
  {
  "type": "greater_than_equal",
  "loc": ["query", "limit"],
  "msg": "Input should be greater than or equal to 1",
  "input": "0",
  "ctx": { "ge": 1 }
  }
  ]
  }
  페이지네이션 계산
- 페이지 크기: 20
- 페이지 번호(0부터): page
- offset = page \* 20
- totalPages = Math.ceil(total / 20)
- 필터가 변경되면 페이지를 0으로 초기화하는 것이 좋다.

## GET /api/logs/{id} — 상세 조회

GET /api/logs/27d66df918ff4f849ed54ab7e5fa4aea

- 경로 변수 id: 목록 응답에서 받은 로그 ID.
- 성공 200 OK: 해당 LogRecord 단건 반환. 구조는 3절의 성공 응답과 같다.
- 실패 404 Not Found: 해당 ID의 로그가 존재하지 않음.
