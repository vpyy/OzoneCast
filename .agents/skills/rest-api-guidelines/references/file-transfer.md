# REST API 설계 Best Practices: File Transfer

이 문서는 파일 업로드와 다운로드 계약을 설계할 때의 기본 규칙을 정리한다.

## TOC

- 17. 파일 업로드 / 다운로드

## 17. 파일 업로드 / 다운로드

### 17.1 업로드 방식은 크기와 용도에 따라 나눈다

- 소형 파일 + 메타데이터를 한 번에 보내는 경우:
  - `multipart/form-data`
- 대형 파일, 브라우저 직접 업로드, object storage 연계:
  - presigned URL 또는 별도 upload session
- 매우 큰 파일 또는 불안정한 네트워크:
  - resumable upload

### 17.2 업로드 API는 바이트 전송과 리소스 확정을 분리한다

예:

- `POST /uploads` → 업로드 세션 생성
- `PUT <presigned-url>` → 바이트 업로드
- `POST /uploads/{id}:complete` → 업로드 확정

### 17.3 presigned URL 규칙

- 짧은 TTL
- 허용 HTTP 메서드 고정
- 허용 content type / content length 제한
- 권한 범위 최소화
- 생성 API와 실제 storage endpoint를 문서에서 구분한다.

### 17.4 resumable upload 규칙

- session ID 기반으로 설계한다.
- chunk 순서 강제 여부, 재전송 허용 여부, finalize 단계 유무를 명확히 한다.
- 취소/만료 규칙을 문서화한다.

### 17.5 다운로드 규칙

- 바이너리 다운로드는 `Content-Type`, `Content-Length`, `Content-Disposition`를 명시한다.
- 원본 다운로드와 미리보기 URL은 구분한다.
- 권한 있는 URL을 직접 노출하면 TTL과 1회성 여부를 문서화한다.
