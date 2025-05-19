import { server } from '../../src/server';
import path from 'path';
import { JestRestDocs } from '../../../src/jestRestDocs';

// OpenAPI 문서 설정
export const jestRestDocs = new JestRestDocs({
  outputDir: path.resolve(__dirname, '../../docs'),
  openapi: {
    openapi: '3.0.0',
    info: {
      title: '블로그 API 문서',
      version: '1.0.0',
      description: '사용자, 게시물, 댓글에 대한 API 문서입니다.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: '개발 서버',
      },
    ],
  },
  serverInstance: server,
  baseUrl: 'http://localhost:3000',
});

// 테스트 전역 설정
beforeAll(async () => {
  // 필요한 초기화 작업 수행
});

// 모든 테스트 완료 후
afterAll(async () => {
  // OpenAPI 문서 생성
  await jestRestDocs.generateDocs();
  // 서버 종료
  server.close();
});

// 전역 Jest 타임아웃 설정 (10초)
jest.setTimeout(10000);
