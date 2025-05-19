import { JestRestDocs } from '../../src';
import app from './test-app';
import path from 'path';

const server = app.listen(0);

export const docs = new JestRestDocs({
  outputDir: 'docs',
  tempDir: path.join('docs', 'temp-docs'),
  openapi: {
    info: {
      title: 'User Management API',
      version: '1.0.0',
      description: '사용자 관리를 위한 RESTful API 문서입니다.',
    },
  },
  serverInstance: server,
});

export function closeGlobalServer() {
  server.close();
}
