import { closeGlobalServer, docs } from './setup';
import fs from 'fs-extra';
import path from 'path';

export default async function globalTeardown() {
  const tempDir = path.resolve(process.cwd(), 'temp-docs');
  const files = await fs.readdir(tempDir);
  console.log('[teardown] temp-docs 파일 목록:', files);
  await docs.generateDocs();

  closeGlobalServer();
}
