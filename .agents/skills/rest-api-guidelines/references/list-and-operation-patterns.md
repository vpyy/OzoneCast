# REST API 설계 Best Practices: List and Operation Patterns

이 문서는 목록 조회, 정렬/필터링/검색, batch, long-running operation에 대한 실무 기준을 정리한다.

## TOC

- 6. Pagination / Sorting / Filtering / Search
- 8. Batch API
- 9. Long-Running Operations (LRO)

## 6. Pagination / Sorting / Filtering / Search

### 6.1 Pagination은 처음부터 넣는다

- 목록 API는 처음부터 pagination을 넣는다.
- 나중에 pagination을 추가하면 사실상 breaking change가 되기 쉽다.

### 6.2 (Common default) token 기반 pagination

- 일반적인 기본값으로는 **cursor / pageToken 기반** 을 권장한다.
- 기본 파라미터 이름:
  - `pageSize`
  - `pageToken`
  - `nextPageToken`
- `pageToken`은 opaque value로 취급하고, 내부 구조를 클라이언트가 해석하지 않게 한다.
- 삽입/삭제가 잦은 큰 컬렉션에서 더 안전하다.

예시 요청:

```http
GET /v1/users?pageSize=20&pageToken=eyJzb3J0S2V5IjoiMjAyNi0wMy0xOVQxMDowMDowMFoiLCJpZCI6InVzcl8xMjMifQ
```

예시 응답:

```json
{
  "items": [
    { "id": "usr_123", "name": "Muromi" },
    { "id": "usr_124", "name": "Eun" }
  ],
  "nextPageToken": "eyJzb3J0S2V5IjoiMjAyNi0wMy0xOVQxMDowNTowMFoiLCJpZCI6InVzcl8xMjQifQ"
}
```

### 6.3 (Good alternative) pageNumber 기반 pagination

- UI에서 “직접 17페이지로 점프” 같은 요구가 강하면 page 번호 방식도 가능하다.
- 소규모 데이터나 상대적으로 정적인 목록에서는 이해하기 쉽다.
- 하지만 대규모/변동성 높은 컬렉션에서는 insert/delete 시 중복·누락이 생기기 쉽다.

예시 요청:

```http
GET /v1/users?page=3&pageSize=20
```

예시 응답:

```json
{
  "items": [
    { "id": "usr_141", "name": "A" },
    { "id": "usr_142", "name": "B" }
  ],
  "page": 3,
  "pageSize": 20,
  "totalCount": 271,
  "totalPages": 14
}
```

- `totalSize`는 큰 컬렉션이나 eventually consistent 저장소에서는 계산 비용이 크거나 시점에 따라 부정확할 수 있으므로 **(optional)** 로 제공한다.

### 6.4 추천

**일반적인 public REST에서는 token 기반 pagination을 가장 권장한다.**

이유는 다음과 같다.

- 데이터 삽입/삭제에 더 강하다.
- 대용량 목록에서 더 안정적이다.
- 중복/누락 문제를 줄이기 쉽다.

직접 페이지 점프가 핵심 요구일 때만 pageNumber 방식을 선택하는 편이 낫다.

### 6.5 정렬 규칙

- 기본 정렬 기준을 명시한다.
- 파라미터 이름은 `sort` 또는 `orderBy` 중 하나로 통일한다.
- 정렬은 가능한 한 **stable** 해야 한다.

예:

- `sort=createdAt`
- `sort=-createdAt`
- `orderBy=createdAt desc,id`

### 6.6 필터링 규칙

- 처음부터 복잡한 DSL을 강제하지 말고 단순 exact/range 필터부터 시작한다.
- 복잡한 조건을 지원할 때는 단일 `filter` 파라미터에 모으는 편이 낫다.

예:

- 단순형: `status=ACTIVE&createdAtFrom=...&createdAtTo=...`
- 통합형: `filter=status="ACTIVE" AND createdAt>"..."`

### 6.7 검색 파라미터

- 자유 텍스트 검색이 있다면 `q` 또는 `query` 중 하나만 선택한다.
- list/filter semantics와 search semantics는 섞지 않는다.

## 8. (Optional) Batch API

### 8.1 기본 원칙

- 범용 `/$batch`보다 **리소스별 명시적 batch method** 가 관리하기 쉽다.
- 권장 패턴:
  - `POST /v1/users:batchGet`
  - `POST /v1/users:batchCreate`
  - `POST /v1/users:batchUpdate`
  - `POST /v1/users:batchDelete`

### 8.2 Batch의 기본 계약

- 요청 본문은 배열 또는 하위 요청 리스트를 사용한다.
- 원자성(atomicity) 보장 여부를 반드시 문서화한다.
- 동기 batch 응답은 가능하면 atomic하게 유지한다.
- 부분 성공을 허용한다면 per-item error 구조를 정의한다.
- 대용량 batch는 비동기 job/LRO로 승격하는 기준을 둔다.

## 9. (Optional) Long-Running Operations (LRO)

### 9.1 언제 비동기로 분리할지

- 요청이 즉시 완료되지 않거나
- 클라이언트 polling이 필요하거나
- 처리 시간이 길거나
- 부분 성공/재시도/상태 추적이 중요하면

`202 Accepted` + operation/job 리소스로 분리한다.

### 9.2 기본 계약

- 최초 응답: `202 Accepted`
- `Location` 또는 operation 상태 조회 URL을 제공한다.
- 가능하면 `Retry-After`를 제공한다.
- 상태 리소스에는 최소한 다음 정도를 둔다:
  - `id`
  - `status`
  - `submittedAt`
  - `startedAt`
  - `completedAt`
  - `error`
  - `result`

예:

- `NotStarted | Running | Succeeded | Failed | Canceled`

### 9.3 PATCH를 억지로 LRO로 만들지 않는다

- 오래 걸리는 변경은 PATCH 자체보다 action/job으로 분리하는 편이 낫다.
- CRUD와 비동기 작업 계약을 섞으면 클라이언트 경험이 나빠진다.
