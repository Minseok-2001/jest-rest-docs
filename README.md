# jest-rest-docs

## 소개

이 프로젝트는 Jest 기반의 API 테스트를 실행하면서 자동으로 OpenAPI 문서를 생성해주는 도구입니다.

## 사용법

### 1. 테스트 작성

`tests/integration/example-api.test.ts` 파일을 참고하여, 다음과 같이 테스트를 작성하세요:

```ts
import { docs } from '../setup/setup';

describe('User API Integration Tests', () => {
  it('should create a new user', async () => {
    await docs.test({
      method: 'POST',
      path: '/api/users',
      metadata: {
        tags: ['Users'],
        summary: '새로운 사용자 생성',
        description: '신규 사용자를 생성합니다.',
      },
      callback: async (request) => {
        const response = await request
          .post('/api/users')
          .send({ name: '홍길동', email: 'hong@example.com' })
          .expect(201);
      },
    });
  });
});
```

### 2. 테스트 실행

```bash
npm test
```

### 3. 결과 문서 확인

- 테스트가 끝나면 `docs/openapi.json` 파일이 자동으로 생성됩니다.
- 임시 파일은 `docs/temp-docs` 폴더에 저장되며, 테스트 종료 후 자동으로 정리됩니다.

## 폴더 구조

- `docs/openapi.json` : 최종 OpenAPI 문서
- `docs/temp-docs/` : 테스트 중간에 생성되는 임시 파일 (자동 정리)
- `tests/integration/example-api.test.ts` : 예시 테스트 코드
- `tests/setup/setup.ts` : JestRestDocs 인스턴스 및 서버 설정
- `tests/setup/teardown.ts` : 테스트 종료 후 문서 병합 및 임시 파일 정리

## 기타

- outputDir, tempDir 등은 모두 `docs` 하위로 고정되어 있습니다.
- 기존 openapi.json이 없거나 비어있어도 정상 동작합니다.
- 테스트를 추가하고 싶으면 `example-api.test.ts`를 복사해서 사용하세요.

---

문의사항은 이슈로 남겨주세요!
