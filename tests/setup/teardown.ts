import { closeGlobalServer, docs } from './setup';

export default async function globalTeardown() {
  await docs.generateDocs();
  closeGlobalServer();
}
