# JestRestDocs 예제 프로젝트

이 예제 프로젝트는 JestRestDocs 라이브러리를 사용하여 Express API 문서를 자동으로 생성하는 방법을 보여줍니다.

## 프로젝트 구조

```
example/
  ├── src/                     # 소스 코드
  │   ├── controllers/         # API 컨트롤러
  │   ├── models/              # 데이터 모델
  │   ├── routes/              # API 라우트
  │   └── server.ts            # Express 서버 설정
  ├── tests/                   # 테스트 코드
  │   ├── setup/               # 테스트 설정
  │   ├── users/               # 사용자 API 테스트
  │   ├── posts/               # 게시물 API 테스트
  │   └── comments/            # 댓글 API 테스트
  ├── docs/                    # 생성된 API 문서
  └── jest.config.ts           # Jest 설정
```

## 애플리케이션 설명

이 예제는 간단한 블로그 API를 구현합니다:

1. **사용자 API** - 사용자 관리 (생성, 조회, 수정, 삭제)
2. **게시물 API** - 게시물 관리 (생성, 조회, 수정, 삭제)
3. **댓글 API** - 댓글 관리 (생성, 조회, 수정, 삭제)

모든 데이터는 메모리에 저장되며, 서버가 재시작되면 초기 샘플 데이터로 재설정됩니다.

## 실행 방법

### 서버 실행

```bash
npm run example:server
```

이 명령어는 Express 서버를 시작하고 `http://localhost:3000`에서 API를 제공합니다.

### 테스트 실행 및 문서 생성

```bash
npm run example
```

이 명령어는 모든 통합 테스트를 실행하고 테스트 결과를 기반으로 OpenAPI 문서를 생성합니다. 생성된 문서는 `example/docs/openapi.json` 파일에 저장됩니다.

## API 문서 확인

생성된 OpenAPI 문서는 다음 도구로 확인할 수 있습니다:

1. [Swagger UI](https://swagger.io/tools/swagger-ui/)
2. [Redoc](https://github.com/Redocly/redoc)
3. [Swagger Editor](https://editor.swagger.io/)

예를 들어, Swagger UI Docker 이미지를 사용하여 문서를 확인할 수 있습니다:

```bash
docker run -p 8080:8080 -e SWAGGER_JSON=/docs/openapi.json -v ./example/docs:/docs swaggerapi/swagger-ui
```

그런 다음 브라우저에서 `http://localhost:8080`에 접속하여 API 문서를 확인할 수 있습니다.

## 주요 특징

- 성공 및 실패 케이스를 모두 포함한 다양한 테스트 케이스
- 도메인별로 구분된 테스트 파일
- 자동 생성된 OpenAPI 문서
- 경로 파라미터, 쿼리 파라미터, 요청 본문 및 응답 스키마 자동 문서화
