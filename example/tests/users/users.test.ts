import { jestRestDocs } from '../setup/setup';
import { userModel } from '../../src/models/userModel';

describe('사용자 API', () => {
  // 성공 케이스: 모든 사용자 조회
  it('GET /api/users - 모든 사용자 조회', async () => {
    await jestRestDocs.test({
      method: 'GET',
      path: '/api/users',
      metadata: {
        tags: ['사용자'],
        summary: '모든 사용자 목록 조회',
        description: '시스템에 등록된 모든 사용자 목록을 반환합니다.',
      },
      callback: async (request) => {
        await request.get('/api/users').expect(200).expect('Content-Type', /json/);
      },
    });
  });

  // 성공 케이스: ID로 사용자 조회
  it('GET /api/users/:id - 특정 사용자 조회', async () => {
    const userId = '1'; // 존재하는 ID

    await jestRestDocs.test({
      method: 'GET',
      path: '/api/users/{id}',
      metadata: {
        tags: ['사용자'],
        summary: 'ID로 사용자 조회',
        description: '특정 ID를 가진 사용자 정보를 반환합니다.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: '사용자 ID',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request.get(`/api/users/${userId}`).expect(200).expect('Content-Type', /json/);
      },
    });
  });

  // 실패 케이스: 존재하지 않는 사용자 조회
  it('GET /api/users/:id - 존재하지 않는 사용자 조회 시 404 반환', async () => {
    const nonExistentId = '9999';

    await jestRestDocs.test({
      method: 'GET',
      path: '/api/users/{id}',
      metadata: {
        tags: ['사용자'],
        summary: '존재하지 않는 사용자 조회 시 오류',
        description: '존재하지 않는 ID로 사용자 조회 시 404 오류를 반환합니다.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: '존재하지 않는 사용자 ID',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request.get(`/api/users/${nonExistentId}`).expect(404).expect('Content-Type', /json/);
      },
    });
  });

  // 성공 케이스: 사용자 생성
  it('POST /api/users - 새 사용자 생성', async () => {
    const newUser = {
      username: 'newuser',
      email: 'newuser@example.com',
      name: '새로운 사용자',
    };

    await jestRestDocs.test({
      method: 'POST',
      path: '/api/users',
      metadata: {
        tags: ['사용자'],
        summary: '새 사용자 생성',
        description: '새로운 사용자를 생성합니다.',
      },
      callback: async (request) => {
        await request.post('/api/users').send(newUser).expect(201).expect('Content-Type', /json/);
      },
    });
  });

  // 실패 케이스: 잘못된 데이터로 사용자 생성 시도
  it('POST /api/users - 필수 필드 누락 시 400 반환', async () => {
    const invalidUser = {
      username: 'invaliduser',
      // email 필드 누락
      name: '잘못된 사용자',
    };

    await jestRestDocs.test({
      method: 'POST',
      path: '/api/users',
      metadata: {
        tags: ['사용자'],
        summary: '필수 필드 누락 시 사용자 생성 오류',
        description: '필수 필드가 누락된 경우 400 오류를 반환합니다.',
      },
      callback: async (request) => {
        await request
          .post('/api/users')
          .send(invalidUser)
          .expect(400)
          .expect('Content-Type', /json/);
      },
    });
  });

  // 성공 케이스: 사용자 수정
  it('PUT /api/users/:id - 사용자 정보 수정', async () => {
    const userId = '2';
    const updateData = {
      name: '수정된 사용자 이름',
    };

    await jestRestDocs.test({
      method: 'PUT',
      path: '/api/users/{id}',
      metadata: {
        tags: ['사용자'],
        summary: '사용자 정보 수정',
        description: '특정 ID의 사용자 정보를 수정합니다.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: '수정할 사용자 ID',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request
          .put(`/api/users/${userId}`)
          .send(updateData)
          .expect(200)
          .expect('Content-Type', /json/);
      },
    });
  });

  // 성공 케이스: 사용자 삭제
  it('DELETE /api/users/:id - 사용자 삭제', async () => {
    // 테스트용 사용자 생성
    const tempUser = userModel.addUser({
      id: 'temp-id',
      username: 'tempuser',
      email: 'temp@example.com',
      name: '임시 사용자',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await jestRestDocs.test({
      method: 'DELETE',
      path: '/api/users/{id}',
      metadata: {
        tags: ['사용자'],
        summary: '사용자 삭제',
        description: '특정 ID의 사용자를 삭제합니다.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: '삭제할 사용자 ID',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request.delete(`/api/users/${tempUser.id}`).expect(204);
      },
    });
  });

  // 성공 케이스: 이름으로 사용자 검색
  it('GET /api/users/search - 이름으로 사용자 검색', async () => {
    const searchName = '사용자';

    await jestRestDocs.test({
      method: 'GET',
      path: '/api/users/search',
      metadata: {
        tags: ['사용자'],
        summary: '이름으로 사용자 검색',
        description: '사용자 이름으로 검색합니다.',
        parameters: [
          {
            name: 'name',
            in: 'query',
            required: true,
            description: '검색할 사용자 이름',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request
          .get('/api/users/search')
          .query({ name: searchName })
          .expect(200)
          .expect('Content-Type', /json/);
      },
    });
  });
});
