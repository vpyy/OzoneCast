# REST API 설계 Best Practices: Resource Design

이 문서는 **일관된 HTTP+JSON REST API**를 설계하기 위한 실무 기준 중 리소스 설계와 기본 계약에 해당하는 부분을 정리한다. 기준 축은 **resource-oriented design**, **HTTP 표준 의미론**, **운영성과 재시도 가능성**, **장기 호환성**이다.

## TOC

- 1. 기본 원칙
- 2. URI / Resource Naming
- 3. JSON 필드 네이밍 / 데이터 표현
- 4. 표준 메서드와 Update 전략
- 5. 상태코드 사용 규칙
- 7. 관계 모델링 / FK / 중첩 객체

## 1. 기본 원칙

- API는 **리소스 중심(resource-oriented)** 으로 설계한다.
- 경로는 명사형 리소스를 나타내고, 행위는 우선 HTTP 메서드로 표현한다.
- 목표는 “가장 이론적으로 순수한 REST”보다 **일관성, 예측 가능성, 진화 가능성**이다.
- 같은 개념은 항상 같은 이름과 같은 패턴으로 드러나야 한다.

호환성 관점에서는 다음 원칙을 기본 전제로 둔다.

- 서버는 기존 클라이언트가 깨지지 않도록 **backward compatibility**를 유지한다.
- 클라이언트는 모르는 **object field**, **enum value**, **error detail field** 가 와도 무시하거나 안전하게 처리하도록 **forward compatibility**를 가진다.
- breaking change가 필요하면 **새 major version으로 분리한다**.
- 새 필드 추가는 비교적 안전하지만, **필드 삭제 / 이름 변경 / 의미 변경**은 breaking change로 본다.

## 2. URI / Resource Naming

### 2.1 리소스는 명사형으로 설계한다

- 경로에 동사를 넣지 않는다.
- 기본형은 다음과 같다.
  - `GET /users`
  - `POST /users`
  - `GET /users/{userId}`
  - `PATCH /users/{userId}`
  - `DELETE /users/{userId}`

### 2.2 컬렉션은 복수형, singleton만 단수형으로 둔다

- 컬렉션:
  - `/users`
  - `/orders`
  - `/projects`
- singleton:
  - `/users/{userId}/profile`
  - `/users/{userId}/config`

### 2.3 URI 표기 규칙은 단순하게 유지한다

- path는 **lowercase kebab-case** 를 권장한다.
  - 예: `/user-profiles/{userId}`
- trailing slash는 금지한다.
  - 예: `/user-profiles/`
- 확장자는 넣지 않는다.
  - 예: `/user-profiles.json`
- path depth는 과도하게 깊어지지 않게 제한한다.

### 2.4 중첩은 최소화한다

- 부모-자식 관계가 명확할 때만 중첩한다.
- 가능하면 모든 리소스는 직접 접근 가능한 canonical URI도 갖게 한다.

예:

- `/projects/{projectId}/tasks`
- `/tasks/{taskId}`

중첩은 “scope”를 표현할 때만 쓰고, 조회 편의 때문에 path를 끝없이 깊게 만들지 않는다.

### 2.5 (Optional) namespce는 필요한 경우에만 사용한다

- namespace는 API를 외부 관점의 도메인이나 역할 기준으로 구분해야 할 때만 도입한다.
- 단순한 내부 모듈명, 서비스명, 팀명, 패키지명은 path에 노출하지 않는다.
- namespace를 사용하더라도 리소스명은 기존 규칙대로 명사형 복수형으로 유지한다.
- 문서 분류만을 위한 목적이라면 namespace 대신 OpenAPI tag 등 문서화 수단을 사용한다.
- namespace를 포함하더라도 path depth는 과도하게 깊어지지 않게 제한한다.

예:

- `/v1/billing/invoices`
- `/v1/admin/users`
- `/v1/public/articles`

지양 예:

- `/v1/service-a/users`
- `/v1/user-module/profiles`
- `/v1/team-backend/orders`

## 3. JSON 필드 네이밍 / 데이터 표현

### 3.1 JSON 필드명은 하나로 통일한다

- JSON 필드명은 **lowerCamelCase** 를 권장한다.
- 배열 필드는 복수형, 단일 값은 단수형을 사용한다.

### 3.2 날짜/시간은 RFC 3339 문자열을 기본으로 한다

- 외부 API의 날짜/시간은 **RFC 3339 형식 문자열** 을 권장한다.
- 기본 기준 시간대는 UTC를 권장한다.
- 예: `2026-03-19T10:30:00Z`

### 3.3 `null` / 생략 / 빈값 의미를 문서화한다

- field omission과 `null`은 같은 의미로 취급하지 않는다.
- PATCH 요청에서 필드 생략은 기본적으로 “변경 없음”이다.
- PATCH에서 `null`을 “명시적 제거”로 볼지 문서로 고정한다.
- 빈 배열 `[]`와 `null`은 구분한다.

### 3.4 성공 응답은 리소스 자체를 기본으로 한다

- 단건 조회/생성/수정 성공 시 **리소스 자체를 반환**하는 것을 기본으로 한다.
- 불필요한 wrapper는 지양한다.

예:

```json
{
  "id": "usr_123",
  "name": "Muromi",
  "createdAt": "2026-03-19T10:30:00Z"
}
```

## 4. 표준 메서드와 Update 전략

### 4.1 기본 CRUD + list

- `GET /resources` : 목록 조회
- `POST /resources` : 생성
- `GET /resources/{id}` : 단건 조회
- `PATCH /resources/{id}` : 부분 수정
- `DELETE /resources/{id}` : 삭제

### 4.2 메서드 기본 규칙

- GET은 읽기 전용이어야 한다.
- **GET과 HEAD는 request body에 의존하지 않는다. DELETE의 request body도 상호운용성이 낮으므로 public API에서는 피하는 편이 안전하다.**
- `PUT` / `DELETE`는 같은 요청을 여러 번 보내도 의도된 결과가 같아야 한다.
- 전체 교체가 꼭 필요한 상황이 아니라면 update의 기본값은 `PATCH`가 더 적합하다.

### 4.3 Update는 기본적으로 PATCH를 사용한다

- 전체 교체보다 부분 수정 중심의 `PATCH`를 기본값으로 둔다.
- full replacement `PUT`은 정말 필요한 경우에만 도입한다.
- 자체 패치 문법은 만들지 않는 편이 낫다.

#### 4.3.1 (Common default) `application/merge-patch+json`

- **단순 partial update에 가장 무난한 기본값**
- request body가 원본 JSON 구조와 유사해서 이해와 구현이 쉽다.
- 객체 필드 추가/수정/삭제 표현에 적합하다.
- 배열 일부 원소만 정밀하게 수정하는 데는 부적합하다.

예:

```http
PATCH /v1/users/usr_123
Content-Type: application/merge-patch+json

{
  "displayName": "Muromi",
  "bio": null
}
```

#### 4.3.2 (Good alternative) `application/json-patch+json`

- **정밀한 변경 연산이 꼭 필요할 때 좋은 대안**
- `add`, `remove`, `replace`, `move`, `copy`, `test` 같은 연산을 표현할 수 있다.
- 배열 일부 수정, 특정 path 교체 같은 작업에 강하다.
- 하지만 문법이 복잡하고, 실수 여지도 크다.

예:

```http
PATCH /v1/users/usr_123
Content-Type: application/json-patch+json

[
  { "op": "replace", "path": "/displayName", "value": "Muromi" },
  { "op": "remove", "path": "/tags/1" }
]
```

#### 4.3.3 다른 대안: update mask 방식

- Google 계열 API에서 흔한 스타일이다.
- 어떤 필드를 수정하는지 `updateMask`로 명시하므로 intent가 분명하다.
- field-level update intent를 드러내기에는 좋다.
- 다만 일반적인 public REST의 기본 문법으로는 다소 이질적이다.

예:

```http
PATCH /v1/users/usr_123?updateMask=displayName,photoUrl
Content-Type: application/json

{
  "displayName": "Muromi",
  "photoUrl": "https://cdn.example.com/p/u1.png"
}
```

#### 4.3.4 추천

**일반적인 public HTTP+JSON REST API라면 `application/merge-patch+json`을 기본값으로 두는 것을 가장 권장한다.**

이유는 다음과 같다.

- 문서화가 쉽다.
- 클라이언트 구현이 단순하다.
- 대부분의 “부분 수정” 요구를 무난하게 처리한다.

배열의 세밀한 조작이 핵심 요구사항이면 JSON Patch를 검토하고, Google-style resource API를 강하게 따를 때는 update mask를 선택하는 편이 낫다.

### 4.4 반복 필드(repeated field) 수정 전략

- 반복 필드는 기본적으로 **전체 교체(replace-whole-list)** 로 다룬다.
- PATCH에 배열을 넣으면 그 필드는 “배열 전체 교체”로 해석하는 편이 안전하다.
- 배열 일부에 append/remove/update 의미를 PATCH에 암묵적으로 부여하지 않는다.
- 반복 필드가 크거나, 개별 원소를 독립적으로 관리해야 하면 subresource 분리를 우선 검토한다.

### 4.5 커스텀 액션

- 먼저 리소스로 모델링 가능한지 검토한다.
- 리소스로 자연스럽게 표현되지 않는 작업만 custom action을 쓴다.
- 형식은 `POST /v1/resources/{id}:action` 패턴을 권장한다.

예:

- `POST /v1/orders/{orderId}:cancel`
- `POST /v1/files/{fileId}:archive`

### 4.6 생성/삭제 응답 규칙

- 생성 성공: `201 Created` + `Location` 헤더 + 생성된 리소스 body를 권장한다.
- 삭제 성공: `204 No Content`를 기본으로 한다.
- soft delete라면 삭제된 리소스 body 반환도 가능하지만, 기본값은 `204`가 더 단순하다.

## 5. 상태코드 사용 규칙

### 5.1 기본 상태코드

- `200 OK`: 일반 성공
- `201 Created`: 생성 성공
- `202 Accepted`: 비동기 접수
- `204 No Content`: 본문 없는 성공
- `400 Bad Request`: 잘못된 요청 형식/파라미터
- `401 Unauthorized`: 인증 자격이 없거나 유효하지 않음
- `403 Forbidden`: 인증은 되었지만 권한이 부족함
- `404 Not Found`: 대상 없음
- `409 Conflict`: 상태 충돌
- `500 Internal Server Error`: 서버 오류

### 5.2 추가로 자주 쓰는 상태코드

- `304 Not Modified`: 캐시된 표현 재사용
- `405 Method Not Allowed`: 해당 메서드 미지원
- `406 Not Acceptable`: 요청한 표현 형식 제공 불가
- `410 Gone`: 영구적으로 제거됨
- `412 Precondition Failed`: 조건부 요청 실패
- `415 Unsupported Media Type`: 지원하지 않는 `Content-Type`
- `422 Unprocessable Content`: 형식은 맞지만 의미상 처리 불가
- `428 Precondition Required`: 조건부 요청 필요
- `429 Too Many Requests`: 요청 한도 초과
- `431 Request Header Fields Too Large`: 헤더가 너무 큼
- `503 Service Unavailable`: 일시적 서비스 불가

### 5.3 `401 Unauthorized`에는 `WWW-Authenticate`를 포함한다

- `401` 응답에는 **클라이언트가 어떤 인증 방식을 써야 하는지 알 수 있도록** `WWW-Authenticate` 헤더를 포함하는 것이 좋다.
- Bearer token 기반이라면 다음처럼 줄 수 있다.

예:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="example"
```

- 토큰 만료나 무효 토큰 같은 상황에서는 error parameter를 추가로 줄 수 있다.

예:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="example", error="invalid_token"
```

### 5.4 (Optional) `429` / `503` 응답 시 재시도 힌트를 줄 수 있으면 준다

- 가능하면 `Retry-After`를 함께 반환한다.
- rate limit 정책은 문서에 반드시 적는다.

## 7. 관계 모델링 / FK / 중첩 객체

### 7.1 참조는 기본적으로 ID로 표현한다

- 응답 본문에는 관련 객체를 기본적으로 ID/FK로 표현한다.

예:

- `userId`
- `projectId`
- `ownerId`

### 7.2 관련 객체 전체를 항상 중첩하지 않는다

- 관련 리소스 전체를 항상 inline으로 넣지 않는다.
- 필요 시 `include=` 또는 `expand=` 같은 확장 파라미터를 둔다.
- inline object는 summary 정도만 제공하는 편이 낫다.

### 7.3 중첩 경로는 scope 표현에만 사용한다

- `/projects/{projectId}/tasks` 는 괜찮다.
- 과도한 depth는 지양한다.
