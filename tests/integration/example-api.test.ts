import { JestRestDocs } from '../../lib';

const docs = new JestRestDocs({
  outputDir: 'build/docs',
  snippetsDir: 'build/docs/snippets',
  baseUrl: 'http://localhost:3000',
  openapi: {
    info: {
      title: 'Test API',
      version: '1.0.0',
      description: 'API Documentation',
    },
  },
});

describe('User API Documentation', () => {
  it(
    'documents user creation',
    docs.document(
      'Create User',
      {
        tags: ['Users'],
        summary: '새로운 사용자를 생성합니다',
        description: '사용자 정보를 받아 새로운 사용자를 생성하고 생성된 사용자 정보를 반환합니다.',
      },
      async () => {
        const response = await docs.test({
          method: 'POST',
          path: '/api/users',
          body: {
            name: '홍길동',
            email: 'hong@example.com',
          },
          headers: {
            'Accept-Language': 'ko-KR',
          },
          expect: {
            statusCode: 201,
            bodySchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: '생성된 사용자의 고유 ID',
                },
                name: {
                  type: 'string',
                  description: '사용자 이름',
                },
                email: {
                  type: 'string',
                  description: '사용자 이메일',
                  format: 'email',
                },
                createdAt: {
                  type: 'string',
                  description: '사용자 생성 일시',
                  format: 'date-time',
                },
              },
              required: ['id', 'name', 'email', 'createdAt'],
            },
          },
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('id');
        expect(response.data.name).toBe('홍길동');
      }
    )
  );

  it(
    'documents getting user by ID',
    docs.document(
      'Get User',
      {
        tags: ['Users'],
        summary: '사용자 정보를 조회합니다',
        description: '사용자 ID를 이용하여 특정 사용자의 상세 정보를 조회합니다.',
      },
      async () => {
        // 먼저 조회할 사용자 생성
        const createResponse = await docs.test({
          method: 'POST',
          path: '/api/users',
          body: {
            name: '테스트',
            email: 'test@example.com',
          },
          expect: {
            statusCode: 201,
            bodySchema: {
              type: 'object',
              properties: {
                id: { type: 'number' },
              },
              required: ['id'],
            },
          },
        });

        const userId = createResponse.data.id;

        // 생성된 사용자 조회
        const response = await docs.test({
          method: 'GET',
          path: `/api/users/${userId}`,
          pathParams: [
            {
              name: 'id',
              description: '조회할 사용자의 ID',
              type: 'number',
              required: true,
            },
          ],
          expect: {
            statusCode: 200,
            bodySchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'number',
                  description: '사용자 ID',
                },
                name: {
                  type: 'string',
                  description: '사용자 이름',
                },
                email: {
                  type: 'string',
                  description: '사용자 이메일',
                  format: 'email',
                },
                createdAt: {
                  type: 'string',
                  description: '사용자 생성 일시',
                  format: 'date-time',
                },
                updatedAt: {
                  type: 'string',
                  description: '사용자 정보 수정 일시',
                  format: 'date-time',
                },
              },
              required: ['id', 'name', 'email', 'createdAt', 'updatedAt'],
            },
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.id).toBe(userId);
      }
    )
  );

  it(
    'documents user not found error',
    docs.document(
      'User Not Found',
      {
        tags: ['Users'],
        summary: '존재하지 않는 사용자 조회 시 에러를 반환합니다',
        description: '요청한 ID의 사용자가 없을 경우 404 에러를 반환합니다.',
      },
      async () => {
        const response = await docs.test({
          method: 'GET',
          path: '/api/users/999999',
          pathParams: [
            {
              name: 'id',
              description: '조회할 사용자의 ID',
              type: 'number',
              required: true,
            },
          ],
          expect: {
            statusCode: 404,
            bodySchema: {
              type: 'object',
              properties: {
                error: {
                  type: 'string',
                  description: '에러 메시지',
                },
                code: {
                  type: 'string',
                  description: '에러 코드',
                  enum: ['USER_NOT_FOUND'],
                },
              },
              required: ['error', 'code'],
            },
          },
        });

        expect(response.status).toBe(404);
        expect(response.data).toHaveProperty('error');
        expect(response.data).toHaveProperty('code', 'USER_NOT_FOUND');
      }
    )
  );
});
