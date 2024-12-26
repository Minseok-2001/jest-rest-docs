// src/jestRestDocs.ts
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
  deepMergeResponses,
} from './utils/schemaUtils';

const tempDir = path.resolve(process.cwd(), './temp-docs');

export class JestRestDocs {
  private openapi: Partial<OpenAPIV3.Document>;
  private paths: Record<string, OpenAPIV3.PathItemObject> = {};
  private components: OpenAPIV3.ComponentsObject = { schemas: {} };
  private readonly outputDir: string;
  private readonly baseUrl: string;
  private readonly serverInstance: http.Server;
  private currentMetadata?: ApiMetadata;
  private schemaCounter: number = 1; // 고유한 스키마 이름 생성을 위한 카운터

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
      get: (target: any, prop: string) => {
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

    const existingOperation = this.paths[pathTemplate][method] as
      | OpenAPIV3.OperationObject
      | undefined;

    const paramsMap = this.mergeParameters(pathTemplate, capture);
    const requestBody = this.generateRequestBody(capture.request.body);

    const existingResponses: OpenAPIV3.ResponsesObject = existingOperation?.responses || {};

    const responses = this.mergeResponses(existingResponses, capture);

    // Description을 배열로 관리하여 중복 방지
    const descriptions = new Set<string>();
    if (existingOperation?.description) {
      existingOperation.description.split('\n\n').forEach((desc) => descriptions.add(desc));
    }
    if (this.currentMetadata?.description) {
      descriptions.add(this.currentMetadata.description);
    }

    const operation: OpenAPIV3.OperationObject = {
      ...existingOperation,
      tags: this.currentMetadata?.tags,
      summary: this.currentMetadata?.summary,
      // descriptions를 하나의 문자열로 결합
      description: Array.from(descriptions).join('\n\n'),
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

    const schema = inferSchema(body);
    if (!schema) return undefined;

    return {
      description: this.currentMetadata?.description || 'Request body',
      content: {
        'application/json': {
          schema,
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
    const status = capture.response.status.toString();

    const testName = expect.getState().currentTestName || 'Unknown test';

    // 스키마를 컴포넌트에 추가하고, 이름을 부여
    const schemaName = `Response${this.schemaCounter++}`;
    const schema = inferSchema(capture.response.body);
    if (!this.components.schemas) {
      this.components.schemas = {};
    }
    this.components.schemas[schemaName] = schema;

    const newResponse: OpenAPIV3.ResponseObject = {
      description: `${status} response`,
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${schemaName}` },
          examples: {
            [testName]: {
              summary: testName,
              value: capture.response.body,
            },
          },
        },
      },
    };

    const newResponses: OpenAPIV3.ResponsesObject = {
      [status]: newResponse,
    };

    const mergedResponses = deepMergeResponses(existingResponses, newResponses);

    return mergedResponses;
  }

  private async writeTemporaryDocs() {
    const tempFilePath = path.join(tempDir, `docs-${process.pid}.json`);
    const existingData = fs.existsSync(tempFilePath) ? await fs.readJson(tempFilePath) : {};
    const newData = { ...existingData, paths: this.paths, components: this.components };

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

        // Load existing components
        if (existingDoc.components && existingDoc.components.schemas) {
          this.components = existingDoc.components as OpenAPIV3.ComponentsObject;
          console.log('Existing OpenAPI components loaded.');
        }
      } catch (error) {
        console.error('Failed to load existing OpenAPI documentation:', error);
        this.paths = {};
        this.components = { schemas: {} };
      }
    } else {
      console.warn('No existing OpenAPI documentation found at:', docPath);
      this.paths = {};
      this.components = { schemas: {} };
    }
  }

  async generateDocs() {
    const outputFilePath = path.join(this.outputDir, 'openapi.json');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const files = await fs.readdir(tempDir);

    const mergedPaths: Record<string, OpenAPIV3.PathItemObject> = { ...this.paths };
    const mergedComponents: OpenAPIV3.ComponentsObject = { ...this.components };

    for (const file of files) {
      if (file.startsWith('docs-') && file.endsWith('.json')) {
        const filePath = path.join(tempDir, file);

        try {
          const data = await fs.readJson(filePath);
          const paths = data.paths as Record<string, OpenAPIV3.PathItemObject>;
          const components = data.components as OpenAPIV3.ComponentsObject;

          // Merge paths
          for (const [path, methods] of Object.entries(paths)) {
            if (!mergedPaths[path]) {
              mergedPaths[path] = {};
            }

            Object.entries(methods).forEach(([method, operation]) => {
              const methodKey = method as keyof OpenAPIV3.PathItemObject;

              if (!mergedPaths[path][methodKey]) {
                (mergedPaths[path] as Record<string, OpenAPIV3.OperationObject>)[methodKey] =
                  operation as OpenAPIV3.OperationObject;
              } else {
                const existingOperation = mergedPaths[path][methodKey] as OpenAPIV3.OperationObject;
                const newOperation = operation as OpenAPIV3.OperationObject;

                // Merge descriptions (already handled in captureApiDoc)
                if (existingOperation.description && newOperation.description) {
                  existingOperation.description = `${existingOperation.description}\n\n${newOperation.description}`;
                } else {
                  existingOperation.description =
                    existingOperation.description || newOperation.description;
                }

                // Merge summaries
                if (existingOperation.summary && newOperation.summary) {
                  existingOperation.summary = `${existingOperation.summary}; ${newOperation.summary}`;
                } else {
                  existingOperation.summary = existingOperation.summary || newOperation.summary;
                }

                // Merge responses
                existingOperation.responses = deepMergeResponses(
                  existingOperation.responses || {},
                  newOperation.responses || {}
                );

                // Merge tags
                existingOperation.tags = Array.from(
                  new Set([...(existingOperation.tags || []), ...(newOperation.tags || [])])
                );

                // Merge parameters
                existingOperation.parameters = Array.from(
                  new Set([
                    ...(existingOperation.parameters || []),
                    ...(newOperation.parameters || []),
                  ])
                );
              }
            });
          }

          // Merge components
          if (components && components.schemas) {
            if (!mergedComponents.schemas) {
              mergedComponents.schemas = {};
            }
            for (const [schemaName, schema] of Object.entries(components.schemas)) {
              if (!mergedComponents.schemas[schemaName]) {
                mergedComponents.schemas[schemaName] = schema;
              } else {
              }
            }
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
      components: mergedComponents,
    };

    await fs.writeJson(outputFilePath, spec, { spaces: 2, mode: 0o644 });
    await Promise.all(files.map((file) => fs.unlink(path.join(tempDir, file))));

    console.log(`OpenAPI documentation written to ${outputFilePath}`);
  }
}
