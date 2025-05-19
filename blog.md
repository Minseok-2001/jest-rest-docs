# 테스트 코드로 생성하는 API 문서화: jest-rest-docs 라이브러리 개발기

## 배경

개발 현장에서 API 문서화는 필수지만, 종종 우선순위에서 밀리거나 불완전하게 작성되는 경우가 많습니다. 저희 회사에서도 Swagger를 도입해 프론트엔드 개발자들이 API를 참고할 수 있도록 했지만, 실제로는 다음과 같은 문제점들이 있었습니다

- API 응답의 다양한 케이스에 대한 설명 부족
- 파라미터의 자세한 설명이나 제약사항 누락
- 개발이 진행됨에 따라 문서와 실제 API 간 불일치 발생
- **무엇보다 문서 작성과 유지보수는 정말 귀찮은 작업**

## spring rest docs...?

백엔드 개발자로서 API 개발 시 통합 테스트 코드를 꼼꼼히 작성하는 저에게 문득 떠오른 생각이 있었습니다. Spring 프레임워크에서는 이미 `spring-rest-docs`라는 훌륭한 도구가 있어, 테스트 실행 시 문서가 자동으로 생성됩니다. **"테스트 코드를 작성하면서 문서까지 자동으로 생성할 수 있다면?"** 이런 아이디어가 Jest 환경에서도 가능하지 않을까 하는 생각으로 `jest-rest-docs` 개발을 시작하게 되었습니다.

## jest-rest-docs 개발

Node.js 환경에서 Jest 테스트 코드를 작성하면서 동시에 OpenAPI(Swagger) 문서를 자동으로 생성해주는 라이브러리입니다. 주요 특징은 다음과 같습니다

```typescript
// 예시 테스트 코드
test('사용자 조회 API', async () => {
  await jestRestDocs.test({
    method: 'GET',
    path: '/api/users/{id}',
    metadata: {
      summary: '사용자 정보 조회',
      description: '사용자 ID를 기반으로 상세 정보를 조회합니다.',
      parameters: [
        {
          name: 'id',
          in: 'path',
          description: '사용자 ID',
          required: true,
          schema: { type: 'integer' },
        },
      ],
    },
    callback: async (request) => {
      await request.get('/api/users/1').set('Authorization', 'Bearer token').expect(200);
    },
  });
});
```

이렇게 작성된 테스트 코드는 API 동작을 검증하면서 동시에 다음을 수행합니다

- 요청 경로, 메서드 기록
- 요청 파라미터, 헤더, 바디 자동 추출
- 응답 상태 코드, 바디 구조 자동 추출
- metadata에 기록된 description 등 추가 정보 병합

## 내부 구현 살펴보기

핵심 기능 중 하나는 테스트 실행 중 발생하는 요청과 응답을 가로채 OpenAPI 스키마로 변환하는 것입니다. supertest 라이브러리를 확장해 요청과 응답 정보를 캡처하는 방식을 사용했습니다

```typescript
const extendTest = (test: supertest.Test) => {
  // 요청 바디 캡처
  const originalSend = test.send.bind(test);
  test.send = function (data: any) {
    capturedBody = data;
    return originalSend(data);
  };

  // 응답 캡처 및 문서화
  const originalEnd = test.end.bind(test);
  test.end = (fn?: (err: Error, res: Response) => void) => {
    return originalEnd(async (err: Error, res: Response) => {
      if (!err) {
        await this.captureApiDoc(method, path, {
          request: {
            /* 캡처된 요청 데이터 */
          },
          response: {
            status: res.status,
            body: res.body,
            headers: res.headers,
          },
        });
      }
      if (fn) fn(err, res);
    });
  };
};
```

중요한 개선 사항 중 하나는 중복 파라미터와 설명이 누적되는 문제를 해결하는 것이었습니다

```typescript
// 파라미터 중복 제거 로직
const paramMap = new Map<string, OpenAPIV3.ParameterObject>();

// 기존 파라미터 추가
existingParams.forEach((param: OpenAPIV3.ParameterObject) => {
  const key = `${param.in}:${param.name}`;
  paramMap.set(key, param);
});

// 새 파라미터 추가 (동일한 키가 있으면 덮어씀)
newParams.forEach((param: OpenAPIV3.ParameterObject) => {
  const key = `${param.in}:${param.name}`;
  paramMap.set(key, param);
});

const uniqueParams = Array.from(paramMap.values());
```

## 결과 및 효과

라이브러리 도입 후 우리 팀이 얻은 효과는 다음과 같습니다:

1. **효율성 향상**: 테스트 작성과 문서화를 동시에 해결하여 작업 시간 단축
2. **문서 정확성 보장**: 실제 동작하는 API를 기반으로 문서가 생성되므로 불일치 방지
3. **개발자 부담 감소**: 별도 문서 작성 및 유지보수 부담 제거
4. **자동화된 스키마 추론**: 요청/응답 데이터를 자동으로 분석하여 스키마 생성
5. **개선된 협업**: 프론트엔드-백엔드 간 명확한 인터페이스 공유

## 라이브러리 사용 방법

```bash
# 라이브러리 설치
npm install jest-rest-docs
```

```typescript
// 기본 설정
import { JestRestDocs } from 'jest-rest-docs';
import app from '../app';

const server = app.listen();
const jestRestDocs = new JestRestDocs({
  outputDir: './docs',
  openapi: {
    openapi: '3.0.0',
    info: {
      title: '우리 서비스 API 문서',
      version: '1.0.0',
      description: '모든 API에 대한 상세 문서',
    },
  },
  serverInstance: server,
});

afterAll(async () => {
  await jestRestDocs.generateDocs();
  server.close();
});
```

## 결론

`jest-rest-docs` 라이브러리 개발을 통해 저희 팀은 API 문서화 작업을 대폭 간소화하면서도 문서의 품질과 정확성을 높일 수 있었습니다. 프론트엔드 개발자들은 항상 최신 상태의 정확한 API 명세를 참고할 수 있게 되었고, 백엔드 개발자는 테스트 코드 작성에만 집중하며 자연스럽게 문서화까지 완료할 수 있게 되었습니다.

테스트 주도 개발(TDD)과 문서 주도 API 개발을 결합한 이 접근 방식은 개발 효율성뿐만 아니라 제품의 품질 향상에도 크게 기여했습니다. 앞으로도 더 많은 기능을 추가하고 커뮤니티의 피드백을 반영해 더 좋은 도구로 발전시켜 나갈 계획입니다.

오픈소스로 공개된 `jest-rest-docs`에 관심 있으신 분들은 [GitHub 저장소](https://github.com/Minseok-2001/jest-rest-docs)를 방문해주세요!
