import { afterAll, describe, expect, it } from '@jest/globals';
import { docs } from '../setup/setup';

describe('User API Integration Tests', () => {
  let userId: number;

  describe('User CRUD Operations', () => {
    it('should create a new user', async () => {
      await docs.test({
        method: 'POST',
        path: '/api/users',
        metadata: {
          tags: ['Users'],
          summary: '새로운 사용자 생성',
          description: '닉네임은 문자열이어야합니다.',
        },
        callback: async (request) => {
          const response = await request
            .post('/api/users')
            .send({
              name: 123,
              email: 'hong@example.com',
              age: 30,
              address: {
                street: '테헤란로',
                city: '서울',
              },
            })
            .expect(400);

          userId = response.body.id;
          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toBe('Name must be a string');
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
            .expect(404)
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
            .post('/api/users')
            .send({
              name: '홍길동',
              email: 'test@example.com',
              age: 30,
              address: {
                street: '테헤란로',
                city: '서울',
              },
            })
            .expect(201);

          const response = await request
            .get('/api/users')
            .query({
              page: 1,
              limit: 10,
              sort: 'name:asc',
            })
            .expect(200);

          expect(response.body.users[0].name).toBe('홍길동');
        },
      });
    });

    it('should validate email format', async () => {
      await docs.test({
        method: 'POST',
        path: '/api/users',
        metadata: {
          tags: ['Users'],
          responses: {
            400: {
              description: '이메일 형식이 올바르지 않은 경우 400 에러를 반환합니다',
            },
          },
        },
        callback: async (request) => {
          const response = await request
            .post('/api/users')
            .send({
              name: '테스트',
              email: 'invalid-email',
            })
            .expect(400);

          expect(response.body).toHaveProperty('error');
          expect(response.body.error).toBe('Invalid email123 format');
        },
      });
    });
  });

  afterAll(async () => {});
});
