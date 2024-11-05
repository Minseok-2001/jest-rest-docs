import { JestRestDocs } from '../../src';
import app from '../setup/test-app';

let server: any;
const port = 3000;

beforeAll(() => {
  server = app.listen(port);
});

afterAll(() => {
  server.close();
});

const docs = new JestRestDocs({
  outputDir: 'build/docs',
  snippetsDir: 'build/docs/snippets',
  baseUrl: `http://localhost:${port}`,
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

        expect(response.data).toHaveProperty('id');
        expect(response.data.name).toBe(newUser.name);
      },
    ),
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
            bodySchema: {
              type: 'object',
              properties: {
                id: { type: 'number' },
              },
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
              description: '사용자 ID',
              type: 'number',
              required: true,
            },
          ],
          expect: {
            statusCode: 200,
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

        expect(response.data.id).toBe(userId);
      },
    ),
  );
});
