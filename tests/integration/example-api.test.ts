import { JestRestDocs } from '../../src';
import app from '../setup/test-app';

const server = app.listen(3000);

const docs = new JestRestDocs({
  outputDir: 'build/docs',
  snippetsDir: 'build/docs/snippets',
  baseUrl: 'http://localhost:3000',
  serverInstance: server,
  openapi: {
    info: {
      title: 'Test API',
      version: '1.0.0',
      description: 'API Documentation',
    },
  },
});

describe('Example API Tests', () => {
  it(
    'creates a new user',
    docs.document(
      'Create User',
      {
        tags: ['Users'],
        summary: '새로운 사용자를 생성합니다',
        description: '사용자 정보를 받아 새로운 사용자를 생성하고 생성된 사용자 정보를 반환합니다.',
      },
      async () => {
        const newUser = {
          name: '홍길동',
          email: 'hong@example.com',
        };

        const response = await docs.test({
          method: 'POST',
          path: '/api/users',
          body: newUser,
          expect: {
            statusCode: 201,
            description: '사용자 정보가 정상적으로 생성되었습니다',
            bodySchema: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' },
                email: { type: 'string' },
              },
              required: ['id', 'name', 'email'],
            },
          },
        });

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe(newUser.name);
      }
    )
  );

  it(
    'returns 400 if name or email is missing when creating a new user',
    docs.document(
      'Create User - Validation Error',
      {
        tags: ['Users'],
        summary: '사용자 생성 시 유효성 검사 실패',
        description: '필수 필드가 누락된 경우 400 오류를 반환합니다.',
      },
      async () => {
        const incompleteUser = {
          name: '', // 누락된 필드 테스트
          email: 'missing@example.com',
        };

        const response = await docs.test({
          method: 'POST',
          path: '/api/users',
          body: incompleteUser,
          expect: {
            statusCode: 400,
            description: '필수 필드가 누락된 경우',
            bodySchema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
              },
              required: ['error'],
            },
          },
        });

        expect(response.body.error).toBe('Name and email are required');
      }
    )
  );

  it(
    'returns 404 if the user is not found',
    docs.document(
      'Get User - Not Found',
      {
        tags: ['Users'],
        summary: '존재하지 않는 사용자 조회',
        description: '존재하지 않는 사용자 ID로 조회 시 404 오류를 반환합니다.',
      },
      async () => {
        const userId = 1234;
        const response = await docs.test({
          method: 'GET',
          path: `/api/users/${userId}`,
          queryParams: [
            {
              name: 'id',
              description: '사용자 ID',
              type: 'number',
              required: true,
            },
          ],
          expect: {
            statusCode: 404,
            description: '사용자가 존재하지 않는 경우',
            bodySchema: {
              type: 'object',
              properties: {
                error: { type: 'string' },
              },
              required: ['error'],
            },
          },
        });

        expect(response.body.error).toBe('User not found');
      }
    )
  );

  it(
    'gets a user by id',
    docs.document(
      'Get User',
      {
        tags: ['Users'],
        summary: '사용자 정보를 조회합니다',
      },
      async () => {
        // 먼저 사용자 생성
        const createResponse = await docs.test({
          method: 'POST',
          path: '/api/users',
          body: { name: '테스트', email: 'test@example.com' },
          expect: {
            statusCode: 201,
            description: '사용자 정보가 정상적으로 생성되었습니다',
            bodySchema: {
              type: 'object',
              properties: {
                id: { type: 'number' },
              },
            },
          },
        });

        const userId = createResponse.body.id;

        // 생성된 사용자 조회
        const response = await docs.test({
          method: 'GET',
          path: `/api/users/${userId}`,
          pathParams: [
            {
              name: 'id',
              description: '사용자 ID',
              type: 'number',
              required: true,
            },
          ],
          expect: {
            statusCode: 200,
            description: '사용자 정보가 정상적으로 조회되었습니다',
            bodySchema: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' },
                email: { type: 'string' },
              },
              required: ['id', 'name', 'email'],
            },
          },
        });

        expect(response.body.id).toBe(userId);
      }
    )
  );
});
