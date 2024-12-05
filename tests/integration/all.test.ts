import { OpenAPIV3 } from 'openapi-types';
import express from 'express';
import supertest from 'supertest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as http from 'http';
import { JestRestDocs } from '../../src';

jest.mock('fs-extra');

const mockOpenAPI: Partial<OpenAPIV3.Document> = {
  openapi: '3.0.0',
  info: {
    title: 'Test API',
    version: '1.0.0',
  },
  paths: {},
};

const mockServer = express();
mockServer.get('/test', (req, res) => {
  res.json({ message: 'Test successful' });
});
const serverInstance = http.createServer(mockServer);

const outputDir = path.resolve('./test-output');
const jestRestDocs = new JestRestDocs({
  outputDir,
  openapi: mockOpenAPI,
  serverInstance,
});

describe('JestRestDocs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.readdir as unknown as jest.Mock).mockResolvedValue([]);
    (fs.readJson as jest.Mock).mockResolvedValue({});
    (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
  });

  afterAll(() => {
    serverInstance.close();
  });

  it('should capture API documentation during a test', async () => {
    await jestRestDocs.test({
      method: 'get',
      path: '/test',
      metadata: {
        description: 'Get test endpoint',
        tags: ['Test'],
      },
      callback: async (request) => {
        const response = await request.get('/test');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Test successful' });
      },
    });

    expect(fs.writeJson).toHaveBeenCalledTimes(1);
    const savedData = (fs.writeJson as jest.Mock).mock.calls[0][1];
    expect(savedData.paths['/test']).toBeDefined();
    expect(savedData.paths['/test'].get).toBeDefined();
    expect(savedData.paths['/test'].get.responses[200]).toBeDefined();
  });

  it('should merge responses correctly when same endpoint is tested multiple times', async () => {
    await jestRestDocs.test({
      method: 'get',
      path: '/test',
      metadata: {
        description: 'First test of endpoint',
        tags: ['Test'],
      },
      callback: async (request) => {
        const response = await request.get('/test');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Test successful' });
      },
    });

    await jestRestDocs.test({
      method: 'get',
      path: '/test',
      metadata: {
        description: 'Second test of endpoint',
        tags: ['Test'],
      },
      callback: async (request) => {
        const response = await request.get('/test');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Test successful' });
      },
    });

    expect(fs.writeJson).toHaveBeenCalledTimes(2);
    const savedData = (fs.writeJson as jest.Mock).mock.calls[1][1];
    expect(
      savedData.paths['/test'].get.responses[200].content['application/json'].examples
    ).toHaveProperty('example2');
  });

  it('should write OpenAPI specification to output directory on generateDocs', async () => {
    (fs.readdir as unknown as jest.Mock).mockResolvedValue(['docs-1.json', 'docs-2.json']);
    (fs.readJson as jest.Mock).mockImplementation(async (filePath) => {
      if (filePath.includes('docs-1.json')) {
        return {
          paths: {
            '/test1': {
              get: {
                responses: {
                  200: {
                    description: 'Test 1 response',
                    content: {
                      'application/json': {
                        schema: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
        };
      }
      if (filePath.includes('docs-2.json')) {
        return {
          paths: {
            '/test2': {
              get: {
                responses: {
                  200: {
                    description: 'Test 2 response',
                    content: {
                      'application/json': {
                        schema: { type: 'object' },
                      },
                    },
                  },
                },
              },
            },
          },
        };
      }
    });

    await jestRestDocs.generateDocs();

    expect(fs.writeJson).toHaveBeenCalledWith(
      expect.stringContaining('openapi.json'),
      expect.objectContaining({
        openapi: '3.0.0',
        paths: {
          '/test1': expect.any(Object),
          '/test2': expect.any(Object),
        },
      }),
      expect.any(Object)
    );
  });

  it('should load existing OpenAPI documentation on initialization', () => {
    const mockOpenAPIDocument = {
      openapi: '3.0.0',
      info: { title: 'Existing API', version: '1.0.0' },
      paths: {
        '/existing': {
          get: {
            responses: {
              200: {
                description: 'Existing response',
                content: {
                  'application/json': {
                    schema: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
    };

    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readJsonSync').mockReturnValue(mockOpenAPIDocument);

    const docs = new JestRestDocs({
      outputDir: './output',
      openapi: { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' } },
      serverInstance: {} as any,
    });

    expect(docs['paths']).toBeDefined();
    expect(docs['paths']['/existing']).toBeDefined();
    expect(docs['paths']['/existing']['get']).toBeDefined();
  });
});
