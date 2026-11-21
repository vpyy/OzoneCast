# REST API 설계 Best Practices: Compatibility and Contracts

이 문서는 에러 계약, 보안, 버전, 운영성, 문서화, 수치와 금액, enum과 state 정책을 정리한다.

## TOC

- 10. 에러 응답 구조
- 11. 보안 기본 규칙
- 12. 버전 정책
- 13. 운영성 / 관측성 / 변경 안정성
- 14. 문서화 규칙
- 15. 수치 / 금액 규칙
- 16. enum / state 규칙

## 10. 에러 응답 구조

### 10.1 표준형 권장

- 가능하면 `application/problem+json` 기반의 Problem Details를 채택한다.

- 기본 필드:
  - `type`
  - `title`
  - `status`
  - `detail`
  - `instance`
- 필요하면 확장 필드:
  - `code`
  - `requestId`
  - `violations`

예시:

```json
{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Validation failed",
  "status": 422,
  "detail": "One or more fields are invalid.",
  "code": "VALIDATION_ERROR",
  "requestId": "req_123",
  "violations": [
    {
      "field": "displayName",
      "reason": "REQUIRED"
    }
  ]
}
```

## 11. 보안 기본 규칙

### 11.1 민감정보는 query parameter로 전달하지 않는다

- 비밀번호, API key, access token, refresh token, PII, 카드/계좌 식별정보 같은 민감정보는 **query parameter로 전달하지 않는다**.
- 민감정보는 request body 또는 `Authorization` 같은 전용 header로 전달한다.
- 민감 필드는 기본적으로 **input-only / write-only** 로 취급한다.
- 응답에는 원문 대신 존재 여부나 마스킹된 값만 노출한다.

예:

- `apiKeySet: true`
- `sharedSecretSet: true`
- `obfuscatedEmail`
- `maskedCardNumber`

### 11.2 외부 노출 ID는 opaque string을 권장한다

- 내부 DB auto-increment 정수를 그대로 외부 계약으로 노출하지 않는 편이 안전하다.
- 연속된 정수 ID는 추측, 열거(enumeration), 수집 대상이 되기 쉽다.
- 외부 식별자는 **opaque string** 으로 설계하고, 내부 저장 구조와 분리하는 편이 낫다.
- 예시로는 `UUIDv4`, `UUIDv7`, `ULID`, `KSUID`, 또는 접두사가 붙은 커스텀 문자열 ID(`usr_...`, `ord_...`)를 사용할 수 있다.
- 중요한 점은 “어떤 포맷을 쓰느냐”보다 **외부 계약에서 내부 PK 의미를 노출하지 않는 것**이다.
- 포맷은 한 번 정하면 같은 major version 동안 안정적으로 유지한다.

## 12. 버전 정책

### 12.1 (Common default) path major versioning

- 가장 눈에 잘 띄고 단순하다.
- 라우팅, 로그, 문서, 디버깅에서 버전이 명확하게 드러난다.
- public API에서 가장 이해하기 쉽다.

예:

- `/v1/users`
- `/v2/users`
- `/v1/orders/{orderId}`

preview 채널을 둔다면:

- `/v1beta1/users`
- `/v1alpha1/users`

### 12.2 (Good alternative) query versioning

- URI path를 덜 건드리고 같은 리소스 경로를 유지할 수 있다.
- Azure 스타일처럼 실제 사례가 많다.
- 다만 가시성, 캐시, 도구 호환성 면에서는 path 방식보다 덜 직관적일 수 있다.

예:

- `GET /users/123?api-version=2025-01-01`
- `GET /products?api-version=2`

### 12.3 다른 대안: header versioning

- URI가 깔끔하다는 장점이 있다.
- 하지만 요청만 보고는 버전이 잘 드러나지 않는다.
- 프록시/캐시/문서화/디버깅 관점에서 가시성이 떨어질 수 있다.

예:

```http
GET /users/123
Accept: application/json;api-version=2
```

또는:

```http
GET /users/123
X-API-Version: 2
```

### 12.4 추천

**새로운 public HTTP+JSON REST API라면 path major versioning을 가장 권장한다.**

이유는 다음과 같다.

- 가장 단순하다.
- 문서와 예제가 읽기 쉽다.
- 로그와 트러블슈팅에서 버전이 바로 보인다.

query versioning은 좋은 대안이고, header versioning은 내부 시스템이나 미디어 타입 협상이 강한 환경에서 검토할 수 있다.

### 12.5 deprecated 필드 / endpoint 정책

- deprecated 필드와 endpoint는 **문서와 OpenAPI에 명시**한다.
- 제거 예정인 경우 **제거 예정 시점** 또는 최소한 **유예 기간 정책**을 함께 공지한다.
- 가능하면 응답 헤더의 **`Deprecation`**, **`Sunset`** 사용 정책도 문서에 포함한다.
- deprecated라고 표시한 즉시 제거하지 말고, 마이그레이션 경로와 대체 필드를 함께 제공하는 편이 낫다.

## 13. 운영성 / 관측성 / 변경 안정성

### 13.1 (Optional) request ID

- 모든 요청은 추적 가능한 request ID를 가지는 편이 좋다.
- 서버는 응답 헤더와 에러 바디에 request ID를 포함하는 것이 좋다.

### 13.2 timestamp 필드

- 리소스에는 기본적으로 `createdAt`, `updatedAt`를 두는 편이 좋다.
- 필요 시 `deletedAt`, `submittedAt`, `completedAt` 등을 확장한다.

### 13.3 (Optional) ETag / If-Match / If-None-Match

- 동시 수정 충돌 가능성이 높은 리소스는 `ETag`와 조건부 요청 지원이 유용하다.
- `If-None-Match` → `304 Not Modified`
- `If-Match` 실패 → `412 Precondition Failed`

### 13.4 (Optional) POST 멱등성 / idempotency key

- 중복 생성 방지가 중요하면 **POST에 idempotency key를 지원한다**.
- 가장 흔한 표현은 **`Idempotency-Key`** 이다.
- 특정 헤더 이름은 조직 표준을 따를 수 있지만, 예를 들면 `Idempotency-Key` 또는 조직 표준 repeatability 헤더를 사용할 수 있다.
- 중요한 점은 **API 전체에서 하나의 정책으로 통일**하는 것이다.

### 13.5 (Optional) validate-only / dry-run

- 변경 요청에 대해 실제 반영 없이 검증만 수행하는 옵션을 둘 수 있다.
- 실제 요청과 동일한 검증/권한 확인을 하되 부작용은 없어야 한다.

### 13.6 (Optional) partial response / field selection

- 읽기 최적화가 필요하면 `fields=` 같은 partial response를 지원할 수 있다.
- 큰 리소스에서 네트워크 비용을 줄이는 데 유용하다.

## 14. 문서화 규칙

### 14.1 모든 endpoint에 예시를 포함한다

각 endpoint에는 최소한 아래를 포함한다.

- request example
- success response example
- 대표 error response example
- path/query/header 설명

### 14.2 계약 문서는 OpenAPI로 관리한다

- 사람이 읽는 가이드와 별도로 기계가 읽는 계약(OpenAPI)을 유지한다.
- 상태코드, 필드명, required/optional, 예시 body가 문서와 스펙에서 일치해야 한다.

### 14.3 에러와 제약도 문서화한다

- 가능한 에러 코드
- pagination 최대치
- sort/filter 가능 필드
- rate limit 정책
- retry 정책
- version/deprecation 정책

## 15. 수치 / 금액 규칙

### 15.1 일반 수치 규칙

- 수량 필드는 의미가 드러나는 이름을 사용한다.
  - `fileSizeBytes`
  - `distanceKm`
  - `nodeCount`
- 단위가 있는 수치는 필드명이나 스키마 설명에 **명시적 단위**를 포함한다.
- 범위 제한이 있으면 최소/최대값을 문서화한다.

### 15.2 금액은 float를 피한다

- money는 `float` / `double`로 표현하지 않는 편이 안전하다.
- 권장 방식:
  - decimal string

    ```json
    { "amount": "12.34", "currency": "USD" }
    ```

  - minor unit integer

    ```json
    { "amountMinor": 1234, "currency": "USD" }
    ```

- scale, currency, 반올림 규칙, 세금 포함 여부를 함께 문서화한다.

### 15.3 퍼센트 / 비율 / rate

- 퍼센트는 `0~100`인지 `0~1`인지 반드시 고정한다.
- rate는 시간 단위를 포함한다.
  - `requestsPerMinute`
  - `errorRatePercent`

## 16. enum / state 규칙

### 16.1 enum은 문자열로 노출한다

- JSON 응답에서 enum은 숫자 대신 문자열 literal로 노출하는 것을 권장한다.
- enum 값은 API 전체에서 같은 의미에 같은 이름을 유지한다.

### 16.2 unknown / unspecified enum 정책

- enum 기본값 / 미지 값 처리 규칙을 문서화한다.
- enum에는 `UNSPECIFIED` 또는 `UNKNOWN` 계열 값을 명시적으로 둘 수 있다.
- 응답 enum은 클라이언트가 **새 enum 값**을 받아도 죽지 않도록 설계한다.

### 16.3 state는 lifecycle용 enum으로 분리한다

- 리소스 lifecycle은 `state` 필드로 표현한다.
- 예:
  - `CREATING`
  - `ACTIVE`
  - `SUSPENDED`
  - `DELETING`
  - `DELETED`
  - `FAILED`
- state transition 규칙을 문서화한다.
- 클라이언트가 직접 설정하면 안 되는 state는 output-only로 둔다.

### 16.4 enum 변경 정책

- 같은 major version에서 enum 값 제거/이름 변경은 금지한다.
- 새 값 추가는 가능하지만 unknown handling을 전제로 한다.
- deprecated enum 값은 즉시 제거하지 말고 유예 기간을 둔다.
