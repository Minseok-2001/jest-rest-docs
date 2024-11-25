import { JestRestDocs } from '../../src';
import app from '../setup/test-app';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

const server = app.listen(0);

const docs = new JestRestDocs({
  outputDir: 'build/docs',
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

  afterAll(async () => {
    await docs.generateDocs();
    server.close();
  });
});
