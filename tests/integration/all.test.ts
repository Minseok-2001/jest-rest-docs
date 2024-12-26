import { JestRestDocs } from '../../src';
import { OpenAPIV3 } from 'openapi-types';
import * as fs from 'fs-extra';
import * as path from 'path';
import express from 'express';
import * as http from 'http';

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
mockServer.post('/test', (req, res) => {
  res.status(201).json({ message: 'Resource created' });
});
const serverInstance = http.createServer(mockServer);

const outputDir = path.resolve('./test-output');
const jestRestDocs = new JestRestDocs({
  outputDir,
  openapi: mockOpenAPI,
  serverInstance,
});

describe('JestRestDocs Extended Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jestRestDocs['paths'] = {};
    (fs.readdir as unknown as jest.Mock).mockResolvedValue([]);
    (fs.readJson as jest.Mock).mockResolvedValue({});
    (fs.writeJson as jest.Mock).mockResolvedValue(undefined);
  });

  afterAll(() => {
    serverInstance.close();
  });

  it('should handle paths with parameters', async () => {
    mockServer.get('/users/:id', (req, res) => {
      res.json({ id: req.params.id });
    });

    await jestRestDocs.test({
      method: 'get',
      path: '/users/{id}',
      metadata: {
        description: 'Get user by ID',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            example: '123',
          },
        ],
      },
      callback: async (request) => {
        const response = await request.get('/users/123');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id: '123' });
      },
    });

    const savedData = (fs.writeJson as jest.Mock).mock.calls[0][1];
    expect(savedData.paths['/users/{id}']).toBeDefined();
    expect(savedData.paths['/users/{id}'].get.parameters).toHaveLength(1);
  });

  it('should support POST requests with request bodies', async () => {
    await jestRestDocs.test({
      method: 'post',
      path: '/test',
      metadata: {
        description: 'Create resource',
        requestBody: {
          description: 'Resource data',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { name: { type: 'string' } } },
            },
          },
        },
      },
      callback: async (request) => {
        const response = await request.post('/test').send({ name: 'New Resource' });
        expect(response.status).toBe(201);
        expect(response.body).toEqual({ message: 'Resource created' });
      },
    });

    const savedData = (fs.writeJson as jest.Mock).mock.calls[0][1];
    expect(savedData.paths['/test'].post).toBeDefined();
    expect(savedData.paths['/test'].post.requestBody).toBeDefined();
  });

  it('should handle multiple tags for the same path', async () => {
    await jestRestDocs.test({
      method: 'get',
      path: '/test',
      metadata: {
        description: 'Tagged test',
        tags: ['Tag1', 'Tag2'],
      },
      callback: async (request) => {
        const response = await request.get('/test');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Test successful' });
      },
    });

    const savedData = (fs.writeJson as jest.Mock).mock.calls[0][1];
    expect(savedData.paths['/test'].get.tags).toEqual(['Tag1', 'Tag2']);
  });

  it('should merge parameters correctly without duplicates', async () => {
    await jestRestDocs.test({
      method: 'get',
      path: '/test',
      metadata: {
        description: 'Test with query params',
        parameters: [
          {
            name: 'search',
            in: 'query',
            schema: { type: 'string' },
          },
        ],
      },
      callback: async (request) => {
        const response = await request.get('/test').query({ search: 'test' });
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ message: 'Test successful' });
      },
    });

    const savedData = (fs.writeJson as jest.Mock).mock.calls[0][1];
    const parameters = savedData.paths['/test'].get.parameters;
    expect(parameters).toHaveLength(1);
    expect(parameters[0].name).toBe('search');
  });

  it('should handle loadExistingDocs with invalid JSON gracefully', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readJsonSync').mockImplementation(() => {
      throw new Error('Invalid JSON');
    });

    expect(() => {
      new JestRestDocs({
        outputDir,
        openapi: mockOpenAPI,
        serverInstance,
      });
    }).not.toThrow();

    const savedPaths = jestRestDocs['paths'];
    expect(savedPaths).toEqual({});
  });

  it('should write temporary docs without errors', async () => {
    await jestRestDocs.test({
      method: 'get',
      path: '/test',
      metadata: {
        description: 'Test for temporary docs',
      },
      callback: async (request) => {
        const response = await request.get('/test');
        expect(response.status).toBe(200);
      },
    });

    expect(fs.writeJson).toHaveBeenCalledWith(
      expect.stringMatching(/docs-\d+\.json/),
      expect.any(Object),
      expect.any(Object)
    );
  });
});
