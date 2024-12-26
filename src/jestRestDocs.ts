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
  private schemaCounter: number = 1; // Counter for unique schema names

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
    this.components = { schemas: {} };
    this.loadExistingDocs();

    fs.ensureDirSync(this.outputDir);
    fs.ensureDirSync(tempDir);
    fs.emptyDirSync(tempDir);
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
      parameters: Array.from(paramsMap.values()),
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
    const tempFilePath = path.join(tempDir, `docs-${process.pid}.json`);
    const existingData = fs.existsSync(tempFilePath) ? await fs.readJson(tempFilePath) : {};
    const newData = { ...existingData, paths: this.paths, components: this.components };

    const tempFile = `${tempFilePath}.tmp`;
    await fs.writeJson(tempFile, newData, { spaces: 2, mode: 0o644 });
    await fs.rename(tempFile, tempFilePath);
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
    await Promise.all(files.map((file) => fs.unlink(path.join(tempDir, file))));

    console.log(`OpenAPI documentation written to ${outputFilePath}`);
  }
}
