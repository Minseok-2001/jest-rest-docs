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

const defaultTempDir = path.resolve(process.cwd(), './temp-docs');

export class JestRestDocs {
  private openapi: Partial<OpenAPIV3.Document>;
  private paths: Record<string, OpenAPIV3.PathItemObject> = {};
  private components: OpenAPIV3.ComponentsObject = { schemas: {} };
  private readonly outputDir: string;
  private readonly baseUrl: string;
  private readonly serverInstance: http.Server;
  private currentMetadata?: ApiMetadata;
  private schemaCounter: number = 1; // Counter for unique schema names
  private readonly tempDir: string;

  constructor(options: {
    outputDir: string;
    openapi: Partial<OpenAPIV3.Document>;
    serverInstance: http.Server;
    baseUrl?: string;
    tempDir?: string;
  }) {
    this.outputDir = options.outputDir;
    this.openapi = options.openapi;
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.serverInstance = options.serverInstance;
    this.components = { schemas: {} };
    this.tempDir = defaultTempDir;
    this.loadExistingDocs();

    fs.ensureDirSync(this.outputDir);
    fs.ensureDirSync(this.tempDir);
  }

  /**
   * Executes a test case and captures API documentation.
   * @param method The HTTP method (e.g., GET, POST).
   * @param path The API endpoint path.
   * @param metadata Additional metadata for the API.
   * @param callback The test function to execute.
   */
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
      // Capture request body
      const originalSend = test.send.bind(test);
      test.send = function (data: any) {
        capturedBody = data;
        return originalSend(data);
      };

      // Capture query parameters
      const originalQuery = test.query.bind(test);
      test.query = function (params: Record<string, any>) {
        capturedQuery = params;
        return originalQuery(params);
      };

      // Capture headers
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

      // Capture response and generate documentation
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

  /**
   * Captures API documentation for a specific endpoint and method.
   * @param method The HTTP method.
   * @param pathTemplate The API endpoint path template.
   * @param capture The captured request and response data.
   */
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
    const newParams = (paramsMap as any)._uniqueParams || Array.from(paramsMap.values());
    const existingParams = (existingOperation?.parameters as OpenAPIV3.ParameterObject[]) || [];

    // 기존 + 새 parameters를 합치고 완전히 중복 제거 (name+in 기준)
    const paramMap = new Map<string, OpenAPIV3.ParameterObject>();

    // 기존 파라미터 추가
    existingParams.forEach((param: OpenAPIV3.ParameterObject) => {
      const key = `${param.in}:${param.name}`;
      paramMap.set(key, param);
    });

    // 새 파라미터 추가 (동일한 키가 있으면 덮어씀)
    newParams.forEach((param: OpenAPIV3.ParameterObject) => {
      const key = `${param.in}:${param.name}`;
      paramMap.set(key, param);
    });

    const uniqueParams = Array.from(paramMap.values());

    const requestBody = this.generateRequestBody(capture.request.body);

    const existingResponses: OpenAPIV3.ResponsesObject = existingOperation?.responses || {};

    const responses = this.mergeResponses(existingResponses, capture);

    const descriptions = new Set<string>();
    if (existingOperation?.description) {
      existingOperation.description
        .split('\n\n')
        .map((desc) => desc.trim())
        .forEach((desc) => descriptions.add(desc));
    }
    if (this.currentMetadata?.description) {
      const newDesc = this.currentMetadata.description.trim();
      if (!descriptions.has(newDesc)) {
        descriptions.add(newDesc);
      }
    }

    const operation: OpenAPIV3.OperationObject = {
      ...existingOperation,
      tags: this.currentMetadata?.tags,
      summary: this.currentMetadata?.summary,
      description: Array.from(descriptions).join('\n\n'), // Combine descriptions without duplication
      deprecated: this.currentMetadata?.deprecated,
      parameters: uniqueParams,
      security: this.currentMetadata?.security,
      requestBody,
      responses,
    };
    this.paths[pathTemplate][method] = operation;

    await this.writeTemporaryDocs();
  }

  /**
   * Merges path and query parameters.
   * @param pathTemplate The path template.
   * @param capture The captured request data.
   * @returns A map of merged parameters.
   */
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

    // 완전히 동일한 파라미터 객체가 여러 번 들어가는 경우 중복 제거
    const uniqueParams = Array.from(paramsMap.values()).filter(
      (param, idx, arr) => arr.findIndex((p) => JSON.stringify(p) === JSON.stringify(param)) === idx
    );

    // Map 대신 중복 없는 배열을 반환하도록 수정 (호출부에서 parameters: uniqueParams로 사용)
    // 하지만 기존 인터페이스를 유지하기 위해 Map을 그대로 반환하되, 사용 시 중복 없는 배열로 변환
    // (아래에서 parameters: Array.from(paramsMap.values()) 대신 uniqueParams 사용)
    // 실제 적용은 captureApiDoc에서 parameters 할당 시 uniqueParams로 대체
    (paramsMap as any)._uniqueParams = uniqueParams;
    return paramsMap;
  }

  /**
   * Generates the request body schema.
   * @param body The request body data.
   * @returns The RequestBodyObject or undefined.
   */
  private generateRequestBody(body?: any): OpenAPIV3.RequestBodyObject | undefined {
    if (!body) return undefined;

    const schema = inferSchema(body);
    if (!schema) return undefined;

    // 기존 requestBody schema와 다르면 oneOf로 병합
    // (이전 테스트에서 기록된 requestBody가 있으면 병합)
    let mergedSchema = schema;
    const lastOperation = Object.values(this.paths)
      .flatMap((p) => Object.values(p))
      .find(
        (op): op is OpenAPIV3.OperationObject =>
          !!(
            op &&
            typeof op === 'object' &&
            'requestBody' in op &&
            op.requestBody &&
            'responses' in op
          )
      );
    if (
      lastOperation &&
      lastOperation.requestBody &&
      typeof lastOperation.requestBody === 'object' &&
      !('$ref' in lastOperation.requestBody) &&
      lastOperation.requestBody.content &&
      lastOperation.requestBody.content['application/json'] &&
      lastOperation.requestBody.content['application/json'].schema
    ) {
      const prevSchema = lastOperation.requestBody.content['application/json']
        .schema as OpenAPIV3.SchemaObject;
      if (JSON.stringify(prevSchema) !== JSON.stringify(schema)) {
        // oneOf로 병합
        mergedSchema = { oneOf: [prevSchema, schema] };
      }
    }

    return {
      description: this.currentMetadata?.description || 'Request body',
      content: {
        'application/json': {
          schema: mergedSchema,
          example: body,
        },
      },
      required: true,
    };
  }

  /**
   * Merges response objects.
   * @param existingResponses The existing responses.
   * @param capture The captured response data.
   * @returns The merged responses.
   */
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

    const testName = expect.getState().currentTestName || `Response${this.schemaCounter++}`;

    const sanitizedTestName = this.sanitizeSchemaName(testName);
    if (!this.components.schemas) {
      this.components.schemas = {};
    }
    this.components.schemas[sanitizedTestName] = inferSchema(capture.response.body);

    const newResponse: OpenAPIV3.ResponseObject = {
      description: `${status} response`,
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${sanitizedTestName}` },
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

  /**
   * Sanitizes a test name to be a valid OpenAPI schema name.
   * Removes or replaces invalid characters.
   * @param name The original test name.
   * @returns The sanitized schema name.
   */
  private sanitizeSchemaName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/__+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  /**
   * Writes the temporary documentation to a file.
   */
  private async writeTemporaryDocs() {
    const tempFilePath = path.join(this.tempDir, `docs-${process.pid}.json`);
    try {
      const existingData = fs.existsSync(tempFilePath) ? await fs.readJson(tempFilePath) : {};
      const newData = { ...existingData, paths: this.paths, components: this.components };
      const tempFile = `${tempFilePath}.tmp`;
      await fs.writeJson(tempFile, newData, { spaces: 2, mode: 0o644 });
      await fs.rename(tempFile, tempFilePath);
    } catch (err) {
      console.error('[JestRestDocs] 임시 파일 생성 실패:', err);
    }
  }

  /**
   * Loads existing OpenAPI documentation if it exists.
   */
  private loadExistingDocs() {
    const docPath = path.join(this.outputDir, 'openapi.json');

    if (fs.existsSync(docPath)) {
      try {
        const existingDoc = fs.readJsonSync(docPath) as OpenAPIV3.Document;

        // Load paths
        if (existingDoc.paths) {
          this.paths = existingDoc.paths as Record<string, OpenAPIV3.PathItemObject>;
        } else {
          this.paths = {};
        }

        // Load components
        if (existingDoc.components && existingDoc.components.schemas) {
          this.components = existingDoc.components as OpenAPIV3.ComponentsObject;
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

  /**
   * Generates the final OpenAPI documentation by merging temporary files.
   */
  async generateDocs() {
    const outputFilePath = path.join(this.outputDir, 'openapi.json');

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }

    const files = await fs.readdir(this.tempDir);

    const mergedPaths: Record<string, OpenAPIV3.PathItemObject> = { ...this.paths };
    const mergedComponents: OpenAPIV3.ComponentsObject = { ...this.components };

    for (const file of files) {
      if (file.startsWith('docs-') && file.endsWith('.json')) {
        const filePath = path.join(this.tempDir, file);
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

                // Merge summaries without duplication
                if (existingOperation.summary && newOperation.summary) {
                  // 세미콜론으로 분리된 summary 배열로 변환
                  const existingSummaries = existingOperation.summary
                    .split(';')
                    .map((s) => s.trim());
                  const newSummary = newOperation.summary.trim();

                  // 중복 확인
                  if (!existingSummaries.includes(newSummary)) {
                    existingOperation.summary = `${existingOperation.summary}; ${newSummary}`;
                  }
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
                const paramMap = new Map<string, any>();

                // 기존 파라미터 맵에 추가
                (existingOperation.parameters || []).forEach((param: any) => {
                  const key = `${param.in}:${param.name}`;
                  paramMap.set(key, param);
                });

                // 새 파라미터 추가 (동일한 키가 있으면 덮어씀)
                (newOperation.parameters || []).forEach((param: any) => {
                  const key = `${param.in}:${param.name}`;
                  paramMap.set(key, param);
                });

                // 중복 제거된 파라미터 배열로 변환
                existingOperation.parameters = Array.from(paramMap.values());
              }
            });
          }

          // Merge components
          if (components && components.schemas) {
            mergedComponents.schemas = mergedComponents.schemas || {};
            for (const [schemaName, schema] of Object.entries(components.schemas)) {
              if (!mergedComponents.schemas[schemaName]) {
                mergedComponents.schemas[schemaName] = schema;
              }
              // If schema already exists, you can add logic to handle conflicts if necessary
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
    await Promise.all(files.map((file) => fs.unlink(path.join(this.tempDir, file))));

    console.log(`OpenAPI documentation written to ${outputFilePath}`);
  }
}
