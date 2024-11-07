import { OpenAPIV3 } from 'openapi-types';
import * as fs from 'fs-extra';
import * as path from 'path';
import { sanitizePath } from './utils';
import supertest from 'supertest';
import * as http from 'http';

export interface DocumentOptions {
  tags?: string[];
  summary?: string;
  description?: string;
}

export interface TestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD' | 'TRACE' | 'CONNECT';
  path: string;
  body?: any;
  headers?: Record<string, string>;
  pathParams?: Array<{
    name: string;
    description: string;
    type: string;
    required?: boolean;
  }>;
  queryParams?: Array<{
    name: string;
    description: string;
    type: string;
    required?: boolean;
  }>;
  expect: {
    statusCode: number;
    bodySchema: OpenAPIV3.SchemaObject;
    description?: string;
  };
}

export class JestRestDocs {
  private openapi: Partial<OpenAPIV3.Document>;
  private paths: OpenAPIV3.PathsObject = {};
  private readonly outputDir: string;
  private readonly snippetsDir: string;
  private readonly baseUrl: string;
  private serverInstance: http.Server;

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

    // 디렉토리 생성
    fs.ensureDirSync(this.outputDir);
    fs.ensureDirSync(this.snippetsDir);
  }

  document(title: string, metadata: DocumentOptions, testFn: () => Promise<void>) {
    return async () => {
      const context = {
        title,
        ...metadata,
      };

      try {
        const result = await testFn();
        await this.generateOpenApiSpec();
        await this.generateSnippets(context);

        return result;
      } catch (error) {
        await this.generateOpenApiSpec();
        throw error;
      }
    };
  }

  async test(options: TestOptions): Promise<supertest.Response> {
    const { method, path, body, pathParams = [], queryParams = [], expect: expectations } = options;

    this.addPath(path, method.toLowerCase(), {
      body,
      pathParams,
      queryParams,
      expect: expectations,
      method,
      path,
    });
    let request;
    switch (options.method.toUpperCase()) {
      case 'GET':
        request = supertest(this.serverInstance).get(options.path);
        break;
      case 'POST':
        request = supertest(this.serverInstance).post(options.path);
        break;
      case 'PUT':
        request = supertest(this.serverInstance).put(options.path);
        break;
      case 'DELETE':
        request = supertest(this.serverInstance).delete(options.path);
        break;
      case 'PATCH':
        request = supertest(this.serverInstance).patch(options.path);
        break;
      case 'OPTIONS':
        request = supertest(this.serverInstance).options(options.path);
        break;
      case 'HEAD':
        request = supertest(this.serverInstance).head(options.path);
        break;
      case 'TRACE':
        request = supertest(this.serverInstance).trace(options.path);
        break;
      default:
        throw new Error(`Unsupported method: ${options.method}`);
    }

    const response = await request.set(options.headers || {}).send(options.body || {});

    if (response.status !== options.expect.statusCode) {
      throw new Error(
        `Expected status code ${options.expect.statusCode} but received ${response.status}`
      );
    }
    return response;
  }

  private addPath(path: string, method: string, info: TestOptions) {
    if (!this.paths[path]) {
      this.paths[path] = {} as Record<string, any>;
    }

    (this.paths[path] as Record<string, any>)[method] = {
      parameters: [
        ...(info.pathParams
          ? info.pathParams.map((param: any) => ({
              name: param.name,
              in: 'path',
              description: param.description,
              required: param.required,
              schema: { type: param.type },
            }))
          : []),
        ...(info.queryParams
          ? info.queryParams.map((param: any) => ({
              name: param.name,
              in: 'query',
              description: param.description,
              required: param.required,
              schema: { type: param.type },
            }))
          : []),
      ],
      requestBody: info.body
        ? {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  example: info.body,
                },
              },
            },
          }
        : undefined,
      responses: {
        [info.expect.statusCode]: {
          description: info.expect.description || '',
          content: {
            'application/json': {
              schema: info.expect.bodySchema,
            },
          },
        },
      },
    };
  }

  private async generateOpenApiSpec() {
    const spec: OpenAPIV3.Document = {
      openapi: '3.0.0',
      info: {
        title: this.openapi.info?.title || 'API Documentation',
        version: this.openapi.info?.version || '1.0.0',
        description: this.openapi.info?.description,
        ...this.openapi.info,
      },
      servers: this.openapi.servers || [
        {
          url: this.baseUrl,
          description: 'API server',
        },
      ],
      paths: this.paths,
      components: this.openapi.components || {},
      tags: this.openapi.tags || [],
      security: this.openapi.security,
      externalDocs: this.openapi.externalDocs,
    };

    await fs.writeJson(path.join(this.outputDir, 'openapi.json'), spec, { spaces: 2 });
  }

  private async generateSnippets(context: any) {
    const snippetDir = path.join(this.snippetsDir, sanitizePath(context.title));
    await fs.ensureDir(snippetDir);

    await Promise.all([
      this.generateRequestSnippet(snippetDir, context),
      this.generateResponseSnippet(snippetDir, context),
    ]);
  }

  private async generateRequestSnippet(dir: string, context: any) {
    const requestSnippet = `# ${context.title} - HTTP Request

    ## Overview
    ${context.description || 'API request details'}
    
    ## Request Details
    \`\`\`http
    ${context.method?.toUpperCase()} ${context.path}
    ${Array.from<[string, string]>(context.requestHeaders || [])
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')}
    
    ${context.requestBody ? JSON.stringify(context.requestBody, null, 2) : ''}
    \`\`\`
    
    ${
      context.pathParams?.length
        ? `
    ## Path Parameters
    | Name | Description | Type | Required |
    |------|-------------|------|----------|
    ${context.pathParams
      .map(
        (param: { name: any; description: any; type: any; required: any }) =>
          `| ${param.name} | ${param.description} | ${param.type} | ${param.required ? 'Yes' : 'No'} |`
      )
      .join('\n')}
    `
        : ''
    }
    
    ${
      context.queryParams?.length
        ? `
    ## Query Parameters
    | Name | Description | Type | Required |
    |------|-------------|------|----------|
    ${context.queryParams
      .map(
        (param: { name: any; description: any; type: any; required: any }) =>
          `| ${param.name} | ${param.description} | ${param.type} | ${param.required ? 'Yes' : 'No'} |`
      )
      .join('\n')}
    `
        : ''
    }
`;

    await fs.writeFile(path.join(dir, 'request.md'), requestSnippet);
  }

  private async generateResponseSnippet(dir: string, context: any) {
    const responseSnippet = `# ${context.title} - HTTP Response

    ## Overview
    Response details for ${context.description || 'this API endpoint'}
    
    ## Response Details
    \`\`\`http
    HTTP/1.1 ${context.statusCode}
    ${Array.from<[string, string]>(context.responseHeaders || [])
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n')}
    
    ${context.responseBody ? JSON.stringify(context.responseBody, null, 2) : ''}
    \`\`\`
    
    ## Response Schema
    \`\`\`json
    ${JSON.stringify(context.responseSchema || {}, null, 2)}
    \`\`\`
    
    ${
      context.responseFields?.length
        ? `
    ## Response Fields
    | Field | Type | Description |
    |-------|------|-------------|
    ${context.responseFields
      .map(
        (field: { path: any; type: any; description: any }) =>
          `| ${field.path} | ${field.type} | ${field.description} |`
      )
      .join('\n')}
    `
        : ''
    }
    
    ${
      context.statusCodes
        ? `
    ## Status Codes
    | Code | Description |
    |------|-------------|
    ${Object.entries(context.statusCodes)
      .map(([code, description]) => `| ${code} | ${description} |`)
      .join('\n')}
    `
        : ''
    }
    `;

    await fs.writeFile(path.join(dir, 'response.md'), responseSnippet);
  }
}
export default JestRestDocs;
