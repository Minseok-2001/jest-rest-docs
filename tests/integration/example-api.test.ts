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

    it('should fail to create user with non-string name', async () => {
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
              name: 123,
              email: 'hong123@example.com',
              age: 30,
              address: {
                street: '테헤란로',
                city: '서울',
              },
            })
            .expect(400);

          expect(response.body.error).toBe('Name must be a string');
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
          const response = await request
            .get('/api/users/search')
            .query({
              name: '홍',
              city: '서울',
              minAge: 20,
              maxAge: 40,
            })
            .expect(200);

          expect(response.body[0].name).toBe('홍길동');
        },
      });
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
        const response = await request
          .patch(`/api/users/${userId}`)
          .send({
            name: '홍길동 (수정됨)',
            address: {
              street: '강남대로',
            },
          })
          .expect(200);

        expect(response.body.name).toBe('홍길동 (수정됨)');
        expect(response.body.address.street).toBe('강남대로');
      },
    });
  });

  afterAll(async () => {});
});
