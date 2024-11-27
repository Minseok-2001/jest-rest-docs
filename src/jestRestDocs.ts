import { OpenAPIV3 } from 'openapi-types';
import { getData, updateData } from './utils/sharedMemory';
import * as fs from 'fs-extra';
import * as path from 'path';
import supertest, { Response, SuperTest, Test } from 'supertest';
import { IncomingHttpHeaders } from 'http';
import * as http from 'http';
import { HTTPMethod, ApiMetadata } from './types/apiMetadata';
import {
  inferSchema,
  getActualPathParamValue,
  extractPathParameters,
  extractQueryParameters,
  mergeParameterWithExample,
} from './utils/schemaUtils';
const tempDir = path.resolve(__dirname, '../temp-docs');

export class JestRestDocs {
  private openapi: Partial<OpenAPIV3.Document>;
  private paths: Record<string, OpenAPIV3.PathItemObject> = {};
  private readonly outputDir: string;
  private readonly baseUrl: string;
  private readonly serverInstance: http.Server;
  private currentMetadata?: ApiMetadata;

  constructor(options: {
    outputDir: string;
    openapi: Partial<OpenAPIV3.Document>;
    baseUrl?: string;
    serverInstance?: any;
  }) {
    this.outputDir = options.outputDir;
    this.openapi = options.openapi;
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.serverInstance = options.serverInstance;
    this.loadExistingDocs();

    fs.ensureDirSync(this.outputDir);
    fs.ensureDirSync(tempDir);
  }

  async test({
    method,
    path,
    metadata = {},
    callback,
  }: {
    method: string;
    path: string;
    metadata: ApiMetadata;
    callback: (request: supertest.SuperTest<supertest.Test>) => Promise<void>;
  }) {
    const request = supertest(this.serverInstance);
    const lowercaseMethod = method.toLowerCase() as HTTPMethod;

    // Store the metadata for this test
    this.currentMetadata = metadata;

    let capturedPath: string;
    let capturedBody: any;
    let capturedHeaders: Record<string, string> = {};
    let capturedQuery: Record<string, any> = {};

    // Extend the test object with our capture logic
    const extendTest = (test: supertest.Test) => {
      const originalSend = test.send.bind(test);
      test.send = function (data: any) {
        capturedBody = data;
        return originalSend(data);
      };

      const originalQuery = test.query.bind(test);
      test.query = function (params: Record<string, any>) {
        capturedQuery = params;
        return originalQuery(params);
      };

      const originalSet = test.set.bind(test);
      const setSpy = function (
        field: 'Cookie' | string | IncomingHttpHeaders,
        val?: string | string[]
      ) {
        if (field === 'Cookie' && Array.isArray(val)) {
          capturedHeaders['Cookie'] = val.join('; ');
          return originalSet(field, val);
        }

        if (typeof field === 'object') {
          Object.entries(field).forEach(([key, value]) => {
            capturedHeaders[key] = String(value);
          });
          return originalSet(field as IncomingHttpHeaders);
        }

        if (typeof field === 'string' && val !== undefined) {
          capturedHeaders[field] = String(val);
          return originalSet(field, val as string);
        }

        return originalSet(field as any, val as any);
      };

      test.set = setSpy;

      const originalEnd = test.end.bind(test);
      test.end = (fn?: (err: Error, res: Response) => void) => {
        return originalEnd(async (err: Error, res: Response) => {
          if (!err) {
            await this.captureApiDoc(lowercaseMethod, path, {
              request: {
                path: capturedPath,
                body: capturedBody,
                headers: capturedHeaders,
                query: capturedQuery,
              },
              response: {
                status: res.status,
                body: res.body,
                headers: res.headers as Record<string, string>,
              },
            });
          }
          if (fn) fn(err, res);
        });
      };

      return test;
    };

    // Create a proxy for the request object
    const proxy = new Proxy(request, {
      get(target: any, prop: string) {
        if (prop === lowercaseMethod) {
          return (url: string) => {
            capturedPath = url;
            const test = target[prop](url);
            return extendTest(test);
          };
        }
        return target[prop];
      },
    });

    try {
      await callback(proxy as SuperTest<Test>);
    } finally {
      // Clear the metadata after the test
      this.currentMetadata = undefined;
    }
  }

  private async captureApiDoc(
    method: HTTPMethod,
    pathTemplate: string,
    capture: {
      request: {
        path: string;
        body?: any;
        headers?: Record<string, string>;
        query?: Record<string, any>;
      };
      response: {
        status: number;
        body: any;
        headers: Record<string, string>;
      };
    }
  ) {
    console.log('captureApiDoc called:', method, pathTemplate);
    // console.log('Current paths:', this.paths);

    // Initialize path if not exists
    if (!this.paths[pathTemplate]) {
      this.paths[pathTemplate] = {};
    }

    const existingOperation = (this.paths[pathTemplate][method] as OpenAPIV3.OperationObject) || {};
    const metadataParams = this.currentMetadata?.parameters || [];
    const extractedPathParams = extractPathParameters(pathTemplate, capture.request.path);
    const extractedQueryParams = extractQueryParameters(capture.request.query || {});

    const paramsMap = new Map<string, OpenAPIV3.ParameterObject>();

    // Merge metadata parameters with actual values
    metadataParams.forEach((param) => {
      const key = `${param.in}:${param.name}`;
      const actualValue =
        param.in === 'query'
          ? capture.request.query?.[param.name]
          : param.in === 'path'
            ? getActualPathParamValue(pathTemplate, capture.request.path, param.name)
            : undefined;

      paramsMap.set(key, mergeParameterWithExample(param, actualValue));
    });

    // Add extracted parameters to paramsMap
    [...extractedPathParams, ...extractedQueryParams].forEach((param) => {
      const key = `${param.in}:${param.name}`;
      if (!paramsMap.has(key)) {
        paramsMap.set(key, param);
      }
    });

    // Handle examples dynamically
    const existingResponse = existingOperation.responses?.[
      capture.response.status
    ] as OpenAPIV3.ResponseObject;

    const currentExamples = existingResponse?.content?.['application/json']?.examples || {};
    const exampleKey = `example${Object.keys(currentExamples).length + 1}`;

    const operation: OpenAPIV3.OperationObject = {
      ...existingOperation,
      tags: this.currentMetadata?.tags,
      summary: this.currentMetadata?.summary,
      description: this.currentMetadata?.description,
      deprecated: this.currentMetadata?.deprecated,
      parameters: Array.from(paramsMap.values()),
      security: this.currentMetadata?.security,
      responses: {
        ...existingOperation.responses,
        [capture.response.status]: {
          description: this.currentMetadata?.description || `${capture.response.status} response`,
          content: {
            'application/json': {
              schema: inferSchema(capture.response.body),
              examples: {
                ...currentExamples,
                [exampleKey]: {
                  summary:
                    this.currentMetadata?.summary ||
                    `Example ${Object.keys(currentExamples).length + 1}`,
                  value: capture.response.body,
                },
              },
            },
          },
        },
      },
    };
    this.paths[pathTemplate][method] = operation;
    const tempFilePath = path.join(tempDir, `docs-${process.pid}.json`);
    const existingData = fs.existsSync(tempFilePath) ? await fs.readJson(tempFilePath) : {};
    const newData = { ...existingData, paths: this.paths };

    // Atomic file write
    const tempFile = `${tempFilePath}.tmp`;
    await fs.writeJson(tempFile, newData, { spaces: 2 });
    await fs.rename(tempFile, tempFilePath);
  }

  private loadExistingDocs() {
    const docPath = path.join(this.outputDir, 'openapi.json');
    if (fs.existsSync(docPath)) {
      const existingDoc = fs.readJsonSync(docPath) as OpenAPIV3.Document;
      this.paths = existingDoc.paths as Record<string, OpenAPIV3.PathItemObject>;
    }
  }

  async generateDocs() {
    const tempDir = path.resolve(__dirname, '../temp-docs');
    const outputFilePath = path.join(this.outputDir, 'openapi.json');
    const files = await fs.readdir(tempDir);

    const mergedPaths: Record<string, any> = {};

    for (const file of files) {
      if (file.startsWith('docs-') && file.endsWith('.json')) {
        const data = await fs.readJson(path.join(tempDir, file));
        const paths = data.paths || {};

        for (const [path, methods] of Object.entries(paths)) {
          if (!mergedPaths[path]) {
            mergedPaths[path] = {};
          }
          for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
            mergedPaths[path][method] = {
              ...mergedPaths[path][method],
              ...operation, // 병합
            };
          }
        }
      }
    }
    const spec: OpenAPIV3.Document = {
      openapi: this.openapi.openapi || '3.0.0',
      info: {
        title: this.openapi.info?.title || 'API Documentation',
        version: this.openapi.info?.version || '1.0.0',
        description: this.openapi.info?.description,
      },
      servers: this.openapi.servers || [
        {
          url: this.baseUrl,
          description: 'API Server',
        },
      ],
      paths: mergedPaths,
      components: this.openapi.components || {},
    };

    await fs.writeJson(path.join(this.outputDir, 'openapi.json'), spec, {
      spaces: 2,
    });
  }
}
