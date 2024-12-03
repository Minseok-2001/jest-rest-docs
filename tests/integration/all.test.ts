import * as http from 'http';
import * as fs from 'fs-extra';
import supertest from 'supertest';
import { OpenAPIV3 } from 'openapi-types';
import { JestRestDocs } from '../../src';

jest.mock('fs-extra');

describe('JestRestDocs', () => {
  let server: http.Server;
  let restDocs: JestRestDocs;

  beforeAll(() => {
    server = http.createServer((req, res) => {
      const { url, method } = req;

      if (url === '/api/users' && method === 'POST') {
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 1, name: 'John Doe', email: 'john@example.com' }));
      } else if (url === '/api/users' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ id: 1, name: 'John Doe' }]));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
    });

    server.listen(3000);

    restDocs = new JestRestDocs({
      outputDir: './output',
      openapi: {
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
      },
      serverInstance: server,
    });
  });

  afterAll(() => {
    server.close();
  });

  it('should capture POST /api/users and generate OpenAPI docs', async () => {
    await restDocs.test({
      method: 'POST',
      path: '/api/users',
      metadata: {
        tags: ['Users'],
        summary: 'Create a new user',
        description: 'Creates a new user with the provided details.',
      },
      callback: async (request) => {
        await request.post('/api/users').send({
          name: 'John Doe',
          email: 'john@example.com',
        });
      },
    });

    const tempFilePath = './temp-docs/docs-' + process.pid + '.json';
    if (!(await fs.pathExists(tempFilePath))) {
      throw new Error(`Temporary file not found at ${tempFilePath}`);
    }

    const capturedData = JSON.parse(await fs.readFile(tempFilePath, 'utf8'));
    expect(capturedData.paths['/api/users'].post).toBeDefined();
  });

  it('should capture GET /api/users and generate OpenAPI docs', async () => {
    await restDocs.test({
      method: 'GET',
      path: '/api/users',
      metadata: {
        tags: ['Users'],
        summary: 'Retrieve all users',
        description: 'Retrieves a list of all users.',
      },
      callback: async (request) => {
        await request.get('/api/users');
      },
    });

    const tempFilePath = './temp-docs/docs-' + process.pid + '.json';
    const capturedData = JSON.parse(await fs.readFile(tempFilePath, 'utf8'));
    expect(capturedData.paths['/api/users'].get).toBeDefined();
  });

  it('should merge multiple responses for the same path', async () => {
    // Simulate another file defining the same API
    await restDocs.test({
      method: 'POST',
      path: '/api/users',
      metadata: {
        tags: ['Users'],
        summary: 'Error case for creating a user',
        description: 'Handles errors when creating a new user.',
      },
      callback: async (request) => {
        await request.post('/api/users').send({}).expect(400);
      },
    });

    await restDocs.generateDocs();

    const finalSpecPath = './output/openapi.json';
    const finalSpec = JSON.parse(await fs.readFile(finalSpecPath, 'utf8'));

    const postOperation = finalSpec.paths['/api/users'].post;
    expect(postOperation.responses['201']).toBeDefined();
    expect(postOperation.responses['400']).toBeDefined();
  });

  it('should generate OpenAPI documentation with all captured paths and methods', async () => {
    await restDocs.generateDocs();

    const finalSpecPath = './output/openapi.json';
    const finalSpec = JSON.parse(await fs.readFile(finalSpecPath, 'utf8'));

    expect(finalSpec.openapi).toBe('3.0.0');
    expect(finalSpec.info.title).toBe('Test API');
    expect(finalSpec.paths['/api/users']).toBeDefined();
    expect(finalSpec.paths['/api/users'].post).toBeDefined();
    expect(finalSpec.paths['/api/users'].get).toBeDefined();
  });
});
