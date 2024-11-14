import { OpenAPIV3 } from 'openapi-types';
import * as fs from 'fs-extra';
import * as path from 'path';
import supertest, { Response, SuperTest, Test } from 'supertest';
import { IncomingHttpHeaders } from 'http';
import * as http from 'http';

type HTTPMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

interface ApiMetadata {
  tags?: string[];
  summary?: string;
  description?: string;
  deprecated?: boolean;
  parameters?: Array<{
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie';
    description?: string;
    required?: boolean;
    schema?: OpenAPIV3.SchemaObject;
    example?: any;
  }>;
  requestBody?: {
    description?: string;
    required?: boolean;
    content: {
      'application/json': {
        schema: OpenAPIV3.SchemaObject;
        example?: any;
      };
    };
  };
  responses?: {
    [statusCode: string]: {
      description?: string;
      content?: {
        'application/json': {
          schema: OpenAPIV3.SchemaObject;
          example?: any;
        };
      };
    };
  };
  security?: Array<{
    [key: string]: string[];
  }>;
}

export class JestRestDocs {
  private openapi: Partial<OpenAPIV3.Document>;
  private paths: Record<string, OpenAPIV3.PathItemObject> = {};
  private readonly outputDir: string;
  private readonly snippetsDir: string;
  private readonly baseUrl: string;
  private readonly serverInstance: http.Server;
  private currentMetadata?: ApiMetadata;

  constructor(options: {
    outputDir: string;
    snippetsDir: string;
    openapi: Partial<OpenAPIV3.Document>;
    baseUrl?: string;
    serverInstance?: any;
  }) {
    this.outputDir = options.outputDir;
    this.snippetsDir = options.snippetsDir;
    this.openapi = options.openapi;
    this.baseUrl = options.baseUrl || 'http://localhost:3000';
    this.serverInstance = options.serverInstance;

    fs.ensureDirSync(this.outputDir);
    fs.ensureDirSync(this.snippetsDir);
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
        return originalEnd((err: Error, res: Response) => {
          if (!err) {
            this.captureApiDoc(lowercaseMethod, path, {
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

  private getActualPathParamValue(
    pathTemplate: string,
    actualPath: string,
    paramName: string
  ): string | undefined {
    const templateParts = pathTemplate.split('/');
    const actualParts = actualPath.split('/');

    for (let i = 0; i < templateParts.length; i++) {
      const part = templateParts[i];
      if (part === `{${paramName}}`) {
        return actualParts[i];
      }
    }
    return undefined;
  }

  private captureApiDoc(
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
    const metadataParams = this.currentMetadata?.parameters || [];
    const extractedPathParams = this.extractPathParameters(pathTemplate, capture.request.path);
    const extractedQueryParams = this.extractQueryParameters(capture.request.query || {});

    const paramsMap = new Map<string, OpenAPIV3.ParameterObject>();

    metadataParams.forEach((param) => {
      const key = `${param.in}:${param.name}`;
      const actualValue =
        param.in === 'query'
          ? capture.request.query?.[param.name]
          : param.in === 'path'
            ? this.getActualPathParamValue(pathTemplate, capture.request.path, param.name)
            : undefined;

      paramsMap.set(key, this.mergeParameterWithExample(param, actualValue));
    });

    [...extractedPathParams, ...extractedQueryParams].forEach((param) => {
      const key = `${param.in}:${param.name}`;
      if (!paramsMap.has(key)) {
        paramsMap.set(key, param);
      }
    });

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
              schema: this.inferSchema(capture.response.body),
              ...(this.currentMetadata?.responses?.[capture.response.status]?.content?.[
                'application/json'
              ]?.example
                ? {}
                : { example: capture.response.body }),
            },
          },
        },
      },
    };

    if (this.currentMetadata?.requestBody) {
      operation.requestBody = {
        ...this.currentMetadata.requestBody,
        content: {
          'application/json': {
            ...this.currentMetadata.requestBody.content['application/json'],
            ...(this.currentMetadata.requestBody.content['application/json'].example
              ? {}
              : { example: capture.request.body }),
          },
        },
      };
    } else if (capture.request.body) {
      operation.requestBody = {
        content: {
          'application/json': {
            schema: this.inferSchema(capture.request.body),
            example: capture.request.body,
          },
        },
      };
    }

    this.paths[pathTemplate][method] = operation;
  }

  private mergeParameterWithExample(
    definedParam: OpenAPIV3.ParameterObject,
    actualValue: any
  ): OpenAPIV3.ParameterObject {
    if (definedParam.example || (definedParam.schema as OpenAPIV3.SchemaObject)?.default) {
      return definedParam;
    }
    return {
      ...definedParam,
      example: actualValue,
    };
  }

  private extractPathParameters(
    pathTemplate: string,
    actualPath?: string
  ): OpenAPIV3.ParameterObject[] {
    const params: OpenAPIV3.ParameterObject[] = [];
    const templateParts = pathTemplate.split('/');
    const actualParts = actualPath?.split('/') || [];

    templateParts.forEach((part, index) => {
      if (part.startsWith('{') && part.endsWith('}')) {
        const name = part.slice(1, -1);
        params.push({
          name,
          in: 'path',
          required: true,
          schema: { type: 'string' },
          example: actualParts[index], // metadata에서 정의되지 않은 경우 사용될 example
        });
      }
    });

    return params;
  }

  private extractQueryParameters(query: Record<string, any>): OpenAPIV3.ParameterObject[] {
    return Object.entries(query).map(([name, value]) => ({
      name,
      in: 'query',
      required: false,
      schema: this.inferSchema(value),
      example: value, // metadata에서 정의되지 않은 경우 사용될 example
    }));
  }

  private inferSchema(data: any): OpenAPIV3.SchemaObject {
    if (data === null || data === undefined) {
      return { type: 'object', nullable: true };
    }

    switch (typeof data) {
      case 'number':
        return { type: 'number' };
      case 'string':
        return { type: 'string' };
      case 'boolean':
        return { type: 'boolean' };
      case 'object': {
        if (Array.isArray(data)) {
          return {
            type: 'array',
            items: data.length > 0 ? this.inferSchema(data[0]) : {},
          };
        }
        const properties: Record<string, OpenAPIV3.SchemaObject> = {};
        Object.entries(data).forEach(([key, value]) => {
          properties[key] = this.inferSchema(value);
        });
        return {
          type: 'object',
          properties,
        };
      }
      default:
        return { type: 'object' };
    }
  }

  async generateDocs() {
    const spec: OpenAPIV3.Document = {
      openapi: this.openapi.openapi || '3.0.0',
      info: {
        title: this.openapi.info?.title || 'API Documentation',
        version: this.openapi.info?.version || '1.0.0',
        description: this.openapi.info?.description,
        ...this.openapi.info,
      },
      servers: this.openapi.servers || [
        {
          url: this.baseUrl,
          description: 'API Server',
        },
      ],
      paths: this.paths,
      components: this.openapi.components || {},
    };

    await fs.writeJson(path.join(this.outputDir, 'openapi.json'), spec, { spaces: 2 });
  }
}
