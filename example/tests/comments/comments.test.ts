import { jestRestDocs } from '../setup/setup';
import { commentModel } from '../../src/models/commentModel';

describe('댓글 API', () => {
  // 성공 케이스: 모든 댓글 조회
  it('GET /api/comments - 모든 댓글 조회', async () => {
    await jestRestDocs.test({
      method: 'GET',
      path: '/api/comments',
      metadata: {
        tags: ['댓글'],
        summary: '모든 댓글 목록 조회',
        description: '시스템에 등록된 모든 댓글 목록을 반환합니다.',
      },
      callback: async (request) => {
        await request.get('/api/comments').expect(200).expect('Content-Type', /json/);
      },
    });
  });

  // 성공 케이스: ID로 댓글 조회
  it('GET /api/comments/:id - 특정 댓글 조회', async () => {
    const commentId = '1'; // 존재하는 ID

    await jestRestDocs.test({
      method: 'GET',
      path: '/api/comments/{id}',
      metadata: {
        tags: ['댓글'],
        summary: 'ID로 댓글 조회',
        description: '특정 ID를 가진 댓글 정보를 반환합니다.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: '댓글 ID',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request.get(`/api/comments/${commentId}`).expect(200).expect('Content-Type', /json/);
      },
    });
  });

  // 실패 케이스: 존재하지 않는 댓글 조회
  it('GET /api/comments/:id - 존재하지 않는 댓글 조회 시 404 반환', async () => {
    const nonExistentId = '9999';

    await jestRestDocs.test({
      method: 'GET',
      path: '/api/comments/{id}',
      metadata: {
        tags: ['댓글'],
        summary: '존재하지 않는 댓글 조회 시 오류',
        description: '존재하지 않는 ID로 댓글 조회 시 404 오류를 반환합니다.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: '존재하지 않는 댓글 ID',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request
          .get(`/api/comments/${nonExistentId}`)
          .expect(404)
          .expect('Content-Type', /json/);
      },
    });
  });

  // 성공 케이스: 댓글 생성
  it('POST /api/comments - 새 댓글 생성', async () => {
    const newComment = {
      postId: '1',
      authorId: '2',
      content: '새 댓글 내용입니다.',
    };

    await jestRestDocs.test({
      method: 'POST',
      path: '/api/comments',
      metadata: {
        tags: ['댓글'],
        summary: '새 댓글 생성',
        description: '새로운 댓글을 생성합니다.',
      },
      callback: async (request) => {
        await request
          .post('/api/comments')
          .send(newComment)
          .expect(201)
          .expect('Content-Type', /json/);
      },
    });
  });

  // 실패 케이스: 잘못된 데이터로 댓글 생성 시도
  it('POST /api/comments - 필수 필드 누락 시 400 반환', async () => {
    const invalidComment = {
      postId: '1',
      // authorId 필드 누락
      content: '작성자 없는 댓글',
    };

    await jestRestDocs.test({
      method: 'POST',
      path: '/api/comments',
      metadata: {
        tags: ['댓글'],
        summary: '필수 필드 누락 시 댓글 생성 오류',
        description: '필수 필드가 누락된 경우 400 오류를 반환합니다.',
      },
      callback: async (request) => {
        await request
          .post('/api/comments')
          .send(invalidComment)
          .expect(400)
          .expect('Content-Type', /json/);
      },
    });
  });

  // 성공 케이스: 댓글 수정
  it('PUT /api/comments/:id - 댓글 내용 수정', async () => {
    const commentId = '2';
    const updateData = {
      content: '수정된 댓글 내용입니다.',
    };

    await jestRestDocs.test({
      method: 'PUT',
      path: '/api/comments/{id}',
      metadata: {
        tags: ['댓글'],
        summary: '댓글 내용 수정',
        description: '특정 ID의 댓글 내용을 수정합니다.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: '수정할 댓글 ID',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request
          .put(`/api/comments/${commentId}`)
          .send(updateData)
          .expect(200)
          .expect('Content-Type', /json/);
      },
    });
  });

  // 성공 케이스: 댓글 삭제
  it('DELETE /api/comments/:id - 댓글 삭제', async () => {
    // 테스트용 댓글 생성
    const tempComment = commentModel.addComment({
      id: 'temp-id',
      postId: '1',
      authorId: '1',
      content: '삭제될 임시 댓글입니다.',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await jestRestDocs.test({
      method: 'DELETE',
      path: '/api/comments/{id}',
      metadata: {
        tags: ['댓글'],
        summary: '댓글 삭제',
        description: '특정 ID의 댓글을 삭제합니다.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: '삭제할 댓글 ID',
            schema: {
              type: 'string',
            },
          },
        ],
      },
      callback: async (request) => {
        await request.delete(`/api/comments/${tempComment.id}`).expect(204);
      },
    });
  });

  // 성공 케이스: 게시물별 댓글 조회
  it('GET /api/comments/post/:postId - 게시물별 댓글 조회', async () => {
    const postId = '1';

    await jestRestDocs.test({
      method: 'GET',
      path: '/api/comments/post/{postId}',
      metadata: {
        tags: ['댓글'],
        summary: '게시물별 댓글 조회',
        description: '특정 게시물에 달린 모든 댓글을 조회합니다.',
        parameters: [
          {
            name: 'postId',
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
        await request
          .get(`/api/comments/post/${postId}`)
          .expect(200)
          .expect('Content-Type', /json/);
      },
    });
  });

  // 성공 케이스: 작성자별 댓글 조회
  it('GET /api/comments/author/:authorId - 작성자별 댓글 조회', async () => {
    const authorId = '1';

    await jestRestDocs.test({
      method: 'GET',
      path: '/api/comments/author/{authorId}',
      metadata: {
        tags: ['댓글'],
        summary: '작성자별 댓글 조회',
        description: '특정 작성자가 작성한 모든 댓글을 조회합니다.',
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
          .get(`/api/comments/author/${authorId}`)
          .expect(200)
          .expect('Content-Type', /json/);
      },
    });
  });
});
