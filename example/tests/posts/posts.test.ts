import { jestRestDocs } from '../setup/setup';
import { postModel } from '../../src/models/postModel';

describe('게시물 API', () => {
  // 성공 케이스: 모든 게시물 조회
  it('GET /api/posts - 모든 게시물 조회', async () => {
    await jestRestDocs.test({
      method: 'GET',
      path: '/api/posts',
      metadata: {
        tags: ['게시물'],
        summary: '모든 게시물 목록 조회',
        description: '시스템에 등록된 모든 게시물 목록을 반환합니다.',
      },
      callback: async (request) => {
        await request.get('/api/posts').expect(200).expect('Content-Type', /json/);
      },
    });
  });

  // 성공 케이스: ID로 게시물 조회
  it('GET /api/posts/:id - 특정 게시물 조회', async () => {
    const postId = '1'; // 존재하는 ID

    await jestRestDocs.test({
      method: 'GET',
      path: '/api/posts/{id}',
      metadata: {
        tags: ['게시물'],
        summary: 'ID로 게시물 조회',
        description: '특정 ID를 가진 게시물 정보를 반환합니다.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: '게시물 ID',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request.get(`/api/posts/${postId}`).expect(200).expect('Content-Type', /json/);
      },
    });
  });

  // 실패 케이스: 존재하지 않는 게시물 조회
  it('GET /api/posts/:id - 존재하지 않는 게시물 조회 시 404 반환', async () => {
    const nonExistentId = '9999';

    await jestRestDocs.test({
      method: 'GET',
      path: '/api/posts/{id}',
      metadata: {
        tags: ['게시물'],
        summary: '존재하지 않는 게시물 조회 시 오류',
        description: '존재하지 않는 ID로 게시물 조회 시 404 오류를 반환합니다.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: '존재하지 않는 게시물 ID',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request.get(`/api/posts/${nonExistentId}`).expect(404).expect('Content-Type', /json/);
      },
    });
  });

  // 성공 케이스: 게시물 생성
  it('POST /api/posts - 새 게시물 생성', async () => {
    const newPost = {
      title: '새 게시물 제목',
      content: '새 게시물 내용입니다.',
      authorId: '1',
    };

    await jestRestDocs.test({
      method: 'POST',
      path: '/api/posts',
      metadata: {
        tags: ['게시물'],
        summary: '새 게시물 생성',
        description: '새로운 게시물을 생성합니다.',
      },
      callback: async (request) => {
        await request.post('/api/posts').send(newPost).expect(201).expect('Content-Type', /json/);
      },
    });
  });

  // 실패 케이스: 잘못된 데이터로 게시물 생성 시도
  it('POST /api/posts - 필수 필드 누락 시 400 반환', async () => {
    const invalidPost = {
      title: '제목만 있는 게시물',
      // content와 authorId 필드 누락
    };

    await jestRestDocs.test({
      method: 'POST',
      path: '/api/posts',
      metadata: {
        tags: ['게시물'],
        summary: '필수 필드 누락 시 게시물 생성 오류',
        description: '필수 필드가 누락된 경우 400 오류를 반환합니다.',
      },
      callback: async (request) => {
        await request
          .post('/api/posts')
          .send(invalidPost)
          .expect(400)
          .expect('Content-Type', /json/);
      },
    });
  });

  // 성공 케이스: 게시물 수정
  it('PUT /api/posts/:id - 게시물 내용 수정', async () => {
    const postId = '2';
    const updateData = {
      title: '수정된 게시물 제목',
      content: '수정된 게시물 내용입니다.',
    };

    await jestRestDocs.test({
      method: 'PUT',
      path: '/api/posts/{id}',
      metadata: {
        tags: ['게시물'],
        summary: '게시물 내용 수정',
        description: '특정 ID의 게시물 내용을 수정합니다.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: '수정할 게시물 ID',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request
          .put(`/api/posts/${postId}`)
          .send(updateData)
          .expect(200)
          .expect('Content-Type', /json/);
      },
    });
  });

  // 성공 케이스: 게시물 삭제
  it('DELETE /api/posts/:id - 게시물 삭제', async () => {
    // 테스트용 게시물 생성
    const tempPost = postModel.addPost({
      id: 'temp-id',
      title: '임시 게시물',
      content: '삭제될 임시 게시물입니다.',
      authorId: '1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await jestRestDocs.test({
      method: 'DELETE',
      path: '/api/posts/{id}',
      metadata: {
        tags: ['게시물'],
        summary: '게시물 삭제',
        description: '특정 ID의 게시물을 삭제합니다.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: '삭제할 게시물 ID',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request.delete(`/api/posts/${tempPost.id}`).expect(204);
      },
    });
  });

  // 성공 케이스: 작성자별 게시물 조회
  it('GET /api/posts/author/:authorId - 작성자별 게시물 조회', async () => {
    const authorId = '1';

    await jestRestDocs.test({
      method: 'GET',
      path: '/api/posts/author/{authorId}',
      metadata: {
        tags: ['게시물'],
        summary: '작성자별 게시물 조회',
        description: '특정 작성자가 작성한 모든 게시물을 조회합니다.',
        parameters: [
          {
            name: 'authorId',
            in: 'path',
            required: true,
            description: '작성자 ID',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request
          .get(`/api/posts/author/${authorId}`)
          .expect(200)
          .expect('Content-Type', /json/);
      },
    });
  });

  // 성공 케이스: 제목으로 게시물 검색
  it('GET /api/posts/search - 제목으로 게시물 검색', async () => {
    const searchTitle = '게시물';

    await jestRestDocs.test({
      method: 'GET',
      path: '/api/posts/search',
      metadata: {
        tags: ['게시물'],
        summary: '제목으로 게시물 검색',
        description: '게시물 제목에 특정 키워드가 포함된 게시물을 검색합니다.',
        parameters: [
          {
            name: 'title',
            in: 'query',
            required: true,
            description: '검색할 게시물 제목 키워드',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request
          .get('/api/posts/search')
          .query({ title: searchTitle })
          .expect(200)
          .expect('Content-Type', /json/);
      },
    });
  });
});
