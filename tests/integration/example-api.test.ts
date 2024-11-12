import { JestRestDocs } from '../../src';
import app from '../setup/test-app';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

const server = app.listen(3000);

const docs = new JestRestDocs({
  outputDir: 'build/docs',
  snippetsDir: 'build/docs/snippets',
  openapi: {
    info: {
      title: 'User Management API',
      version: '1.0.0',
      description: '사용자 관리를 위한 RESTful API 문서입니다.',
    },
  },
  serverInstance: server,
});

describe('User API Integration Tests', () => {
  let userId: number;
  let adminToken: string;

  beforeAll(async () => {
    await docs.test({
      method: 'POST',
      path: '/api/admin/login',
      metadata: {
        tags: ['Admin'],
        summary: '관리자 로그인',
        description: '관리자 계정으로 로그인하여 인증 토큰을 발급받습니다.',
      },
      callback: async (request) => {
        const response = await request
          .post('/api/admin/login')
          .send({
            email: 'admin@example.com',
            password: 'admin123',
          })
          .expect(200);

        adminToken = response.body.token;
      },
    });
  });

  describe('User CRUD Operations', () => {
    it('should create a new user', async () => {
      await docs.test({
        method: 'POST',
        path: '/api/users',
        metadata: {
          tags: ['Users'],
          summary: '새로운 사용자 생성',
          description:
            '신규 사용자를 생성합니다. 이메일은 고유해야 하며, 기본 정보와 주소 정보를 함께 저장할 수 있습니다.',
        },
        callback: async (request) => {
          const response = await request
            .post('/api/users')
            .send({
              name: '홍길동',
              email: 'hong@example.com',
              age: 30,
              address: {
                street: '테헤란로',
                city: '서울',
              },
            })
            .expect(201);

          userId = response.body.id;
          expect(response.body.name).toBe('홍길동');
        },
      });
    });

    it('should validate email format', async () => {
      await docs.test({
        method: 'POST',
        path: '/api/users',
        metadata: {
          tags: ['Users'],
          summary: '잘못된 이메일 형식 검증',
          description: '이메일 형식이 올바르지 않은 경우 400 에러를 반환합니다.',
        },
        callback: async (request) => {
          await request
            .post('/api/users')
            .send({
              name: '테스트',
              email: 'invalid-email',
            })
            .expect(400);
        },
      });
    });

    it('should get user by id', async () => {
      await docs.test({
        method: 'GET',
        path: '/api/users/{id}',
        metadata: {
          tags: ['Users'],
          summary: '사용자 정보 조회',
          description: '특정 사용자의 상세 정보를 조회합니다.',
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
          await request
            .get(`/api/users/${userId}`)
            .expect(200)
            .expect((res) => {
              expect(res.body.id).toBe(userId);
              expect(res.body.name).toBe('홍길동');
            });
        },
      });
    });

    it('should list users with pagination', async () => {
      await docs.test({
        method: 'GET',
        path: '/api/users',
        metadata: {
          tags: ['Users'],
          summary: '사용자 목록 조회',
          description: '페이지네이션과 정렬 기능을 지원하는 사용자 목록 조회 API입니다.',
          parameters: [
            {
              name: 'page',
              in: 'query',
              description: '페이지 번호',
              schema: { type: 'integer', default: 1 },
            },
            {
              name: 'limit',
              in: 'query',
              description: '페이지당 항목 수',
              schema: { type: 'integer', default: 10, maximum: 100 },
            },
            {
              name: 'sort',
              in: 'query',
              description: '정렬 기준 (예: name:asc, name:desc)',
              schema: { type: 'string' },
            },
          ],
        },
        callback: async (request) => {
          await request
            .get('/api/users')
            .query({
              page: 1,
              limit: 10,
              sort: 'name:asc',
            })
            .expect(200);
        },
      });
    });

    it('should update user partially', async () => {
      await docs.test({
        method: 'PATCH',
        path: '/api/users/{id}',
        metadata: {
          tags: ['Users'],
          summary: '사용자 정보 부분 수정',
          description:
            '사용자 정보를 부분적으로 수정합니다. 제공된 필드만 업데이트되며, 나머지는 기존 값이 유지됩니다.',
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
          await request
            .patch(`/api/users/${userId}`)
            .send({
              name: '홍길동 (수정됨)',
              address: {
                street: '강남대로',
              },
            })
            .expect(200);
        },
      });
    });

    it('should search users by multiple criteria', async () => {
      await docs.test({
        method: 'GET',
        path: '/api/users/search',
        metadata: {
          tags: ['Users'],
          summary: '사용자 검색',
          description: '여러 조건으로 사용자를 검색할 수 있습니다.',
          parameters: [
            {
              name: 'name',
              in: 'query',
              description: '이름 검색 (부분 일치)',
              schema: { type: 'string' },
            },
            {
              name: 'city',
              in: 'query',
              description: '도시',
              schema: { type: 'string' },
            },
            {
              name: 'minAge',
              in: 'query',
              description: '최소 나이',
              schema: { type: 'integer' },
            },
            {
              name: 'maxAge',
              in: 'query',
              description: '최대 나이',
              schema: { type: 'integer' },
            },
          ],
        },
        callback: async (request) => {
          await request
            .get('/api/users/search')
            .query({
              name: '홍',
              city: '서울',
              minAge: 20,
              maxAge: 40,
            })
            .expect(200);
        },
      });
    });
  });

  describe('Admin Operations', () => {
    it('should allow admin to deactivate user', async () => {
      await docs.test({
        method: 'POST',
        path: '/api/admin/users/{id}/deactivate',
        metadata: {
          tags: ['Admin'],
          summary: '사용자 계정 비활성화',
          description: '관리자 권한으로 특정 사용자의 계정을 비활성화합니다.',
          security: [
            {
              bearerAuth: [],
            },
          ],
          parameters: [
            {
              name: 'id',
              in: 'path',
              description: '비활성화할 사용자 ID',
              required: true,
              schema: { type: 'integer' },
            },
          ],
        },
        callback: async (request) => {
          await request
            .post(`/api/admin/users/${userId}/deactivate`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
        },
      });
    });
  });

  afterAll(async () => {
    await docs.generateDocs();
    await server.close();
  });
});
