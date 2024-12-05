import { OpenAPIV3 } from 'openapi-types';
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
const tempDir = path.resolve(process.cwd(), './temp-docs');

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
    serverInstance: http.Server;
    baseUrl?: string;
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

    this.currentMetadata = metadata;

    let capturedPath: string;
    let capturedBody: any;
    let capturedHeaders: Record<string, string> = {};
    let capturedQuery: Record<string, any> = {};

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
    if (!this.paths[pathTemplate]) {
      this.paths[pathTemplate] = {};
    }

    const existingOperation = (this.paths[pathTemplate][method] as OpenAPIV3.OperationObject) || {};

    const paramsMap = this.mergeParameters(pathTemplate, capture);
    const requestBody = this.generateRequestBody(capture.request.body);

    const responses = this.mergeResponses(existingOperation.responses || {}, capture);

    const operation: OpenAPIV3.OperationObject = {
      ...existingOperation,
      tags: this.currentMetadata?.tags,
      summary: this.currentMetadata?.summary,
      description: undefined,
      deprecated: this.currentMetadata?.deprecated,
      parameters: Array.from(paramsMap.values()),
      security: this.currentMetadata?.security,
      requestBody,
      responses,
    };

    this.paths[pathTemplate][method] = operation;

    await this.writeTemporaryDocs();
  }

  private mergeParameters(
    pathTemplate: string,
    capture: {
      request: {
        path: string;
        query?: Record<string, any>;
      };
    }
  ): Map<string, OpenAPIV3.ParameterObject> {
    const metadataParams = this.currentMetadata?.parameters || [];
    const extractedPathParams = extractPathParameters(pathTemplate, capture.request.path);
    const extractedQueryParams = extractQueryParameters(capture.request.query || {});

    const paramsMap = new Map<string, OpenAPIV3.ParameterObject>();

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

    [...extractedPathParams, ...extractedQueryParams].forEach((param) => {
      const key = `${param.in}:${param.name}`;
      if (!paramsMap.has(key)) {
        paramsMap.set(key, param);
      }
    });

    return paramsMap;
  }

  private generateRequestBody(body?: any): OpenAPIV3.RequestBodyObject | undefined {
    if (!body) return undefined;

    return {
      description: this.currentMetadata?.description || 'Request body',
      content: {
        'application/json': {
          schema: inferSchema(body),
          example: body,
        },
      },
      required: true,
    };
  }

  private mergeResponses(
    existingResponses: OpenAPIV3.ResponsesObject,
    capture: {
      response: {
        status: number;
        body: any;
      };
    }
  ): OpenAPIV3.ResponsesObject {
    const status = capture.response.status;

    const testName = expect.getState().currentTestName || 'Unknown test';

    const existingResponseForStatus = existingResponses[status] as OpenAPIV3.ResponseObject;
    const existingExamples =
      existingResponseForStatus?.content?.['application/json']?.examples || {};

    const duplicateKey = Object.keys(existingExamples).find(
      (key) => 'summary' in existingExamples[key] && existingExamples[key].summary === testName
    );
    const newExampleKey = duplicateKey || `example${Object.keys(existingExamples).length + 1}`;

    const updatedExamples = {
      ...existingExamples,
      [newExampleKey]: {
        summary: testName,
        value: capture.response.body,
      },
    };

    const updatedResponse: OpenAPIV3.ResponseObject = {
      description: this.currentMetadata?.responses?.[status]?.description || `${status} response`,
      content: {
        'application/json': {
          schema: inferSchema(capture.response.body),
          examples: updatedExamples,
        },
      },
    };

    return {
      ...existingResponses,
      [status]: updatedResponse,
    };
  }

  private async writeTemporaryDocs() {
    const tempFilePath = path.join(tempDir, `docs-${process.pid}.json`);
    const existingData = fs.existsSync(tempFilePath) ? await fs.readJson(tempFilePath) : {};
    const newData = { ...existingData, paths: this.paths };

    const tempFile = `${tempFilePath}.tmp`;
    await fs.writeJson(tempFile, newData, { spaces: 2, mode: 0o644 });
    await fs.rename(tempFile, tempFilePath);
  }

  private loadExistingDocs() {
    const docPath = path.join(this.outputDir, 'openapi.json');

    if (fs.existsSync(docPath)) {
      try {
        const existingDoc = fs.readJsonSync(docPath) as OpenAPIV3.Document;

        // Ensure paths is a valid object
        if (existingDoc.paths) {
          this.paths = existingDoc.paths as Record<string, OpenAPIV3.PathItemObject>;
          console.log('Existing OpenAPI documentation loaded:', docPath);
        } else {
          console.warn('No "paths" object found in the existing OpenAPI documentation.');
          this.paths = {};
        }
      } catch (error) {
        console.error('Failed to load existing OpenAPI documentation:', error);
        this.paths = {};
      }
    } else {
      console.warn('No existing OpenAPI documentation found at:', docPath);
      this.paths = {};
    }
  }

  async generateDocs() {
    const outputFilePath = path.join(this.outputDir, 'openapi.json');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const files = await fs.readdir(tempDir);

    const mergedPaths: Record<string, OpenAPIV3.PathItemObject> = {};

    for (const file of files) {
      if (file.startsWith('docs-') && file.endsWith('.json')) {
        const filePath = path.join(tempDir, file);

        try {
          const data = await fs.readJson(filePath);
          const paths = data.paths as Record<string, OpenAPIV3.PathItemObject>;

          for (const [path, methods] of Object.entries(paths)) {
            if (!mergedPaths[path]) {
              mergedPaths[path] = {};
            }

            Object.entries(methods).forEach(([method, operation]) => {
              const methodKey = method as keyof OpenAPIV3.PathItemObject;

              if (!mergedPaths[path][methodKey]) {
                mergedPaths[path][methodKey] = operation as any;
              } else {
                const existingOperation = mergedPaths[path][methodKey] as OpenAPIV3.OperationObject;
                const newOperation = operation as OpenAPIV3.OperationObject;

                existingOperation.description = [
                  existingOperation.description,
                  newOperation.description,
                ]
                  .filter(Boolean)
                  .join('\n\n');

                existingOperation.summary = Array.from(
                  new Set([existingOperation.summary, newOperation.summary].filter(Boolean))
                ).join('; ');

                existingOperation.responses = {
                  ...existingOperation.responses,
                  ...Object.entries(newOperation.responses || {}).reduce(
                    (acc, [status, response]) => {
                      const existingResponse = existingOperation.responses?.[
                        status
                      ] as OpenAPIV3.ResponseObject;
                      const newResponse = response as OpenAPIV3.ResponseObject;

                      acc[status] = {
                        ...existingResponse,
                        ...newResponse,
                        content: {
                          ...existingResponse?.content,
                          ...newResponse.content,
                        },
                      };

                      return acc;
                    },
                    {} as OpenAPIV3.ResponsesObject
                  ),
                };

                existingOperation.tags = Array.from(
                  new Set([...(existingOperation.tags || []), ...(newOperation.tags || [])])
                );

                existingOperation.parameters = Array.from(
                  new Set([
                    ...(existingOperation.parameters || []),
                    ...(newOperation.parameters || []),
                  ])
                );
              }
            });
          }
        } catch (err) {
          console.error(`Failed to read or parse ${filePath}:`, err);
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

    await fs.writeJson(outputFilePath, spec, { spaces: 2, mode: 0o644 });
    await Promise.all(files.map((file) => fs.unlink(path.join(tempDir, file))));

    console.log(`OpenAPI documentation written to ${outputFilePath}`);
  }
}
