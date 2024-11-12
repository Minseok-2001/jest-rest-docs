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
export interface PathParam {
  name: string;
  description: string;
  type: string;
  required?: boolean;
  value?: string | number;
}

export interface QueryParam {
  name: string;
  description: string;
  type: string;
  required?: boolean;
  value?: string | number;
}

export interface TestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD' | 'TRACE' | 'CONNECT';
  path: string;
  body?: any;
  headers?: Record<string, string>;
  pathParams?: PathParam[];
  queryParams?: QueryParam[];
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
    this.validatePathParams(path, pathParams);

    this.addPath(path, method.toLowerCase(), {
      body,
      pathParams,
      queryParams,
      expect: expectations,
      method,
      path,
    });
    const actualPath = this.replacePathParams(path, pathParams);

    let request;
    switch (options.method.toUpperCase()) {
      case 'GET':
        request = supertest(this.serverInstance).get(actualPath);
        break;
      case 'POST':
        request = supertest(this.serverInstance).post(actualPath);
        break;
      case 'PUT':
        request = supertest(this.serverInstance).put(actualPath);
        break;
      case 'DELETE':
        request = supertest(this.serverInstance).delete(actualPath);
        break;
      case 'PATCH':
        request = supertest(this.serverInstance).patch(actualPath);
        break;
      case 'OPTIONS':
        request = supertest(this.serverInstance).options(actualPath);
        break;
      case 'HEAD':
        request = supertest(this.serverInstance).head(actualPath);
        break;
      case 'TRACE':
        request = supertest(this.serverInstance).trace(actualPath);
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

  private replacePathParams(templatePath: string, params: PathParam[]): string {
    let actualPath = templatePath;
    const paramRegex = /{([^}]+)}/g;

    return actualPath.replace(paramRegex, (match, paramName) => {
      const param = params.find((p) => p.name === paramName);
      if (!param || param.value == null) {
        throw new Error(`Missing value for path parameter: ${paramName}`);
      }
      return param.value.toString();
    });
  }

  private addPath(path: string, method: string, info: TestOptions) {
    if (!this.paths[path]) {
      this.paths[path] = {} as Record<string, any>;
    }

    const existingOperation = (this.paths[path] as Record<string, any>)[method];
    const existingParams = existingOperation?.parameters || [];

    const newPathParams =
      info.pathParams?.map((param) => ({
        name: param.name,
        in: 'path',
        description: param.description,
        required: param.required ?? true,
        schema: { type: param.type },
      })) || [];

    const newQueryParams =
      info.queryParams?.map((param) => ({
        name: param.name,
        in: 'query',
        description: param.description,
        required: param.required,
        schema: { type: param.type },
      })) || [];

    const mergedParams = this.mergeParameters([
      ...existingParams,
      ...newPathParams,
      ...newQueryParams,
    ]);

    const responses = {
      ...(existingOperation?.responses || {}),
      [info.expect.statusCode]: {
        description: info.expect.description || '',
        content: {
          'application/json': {
            schema: info.expect.bodySchema,
          },
        },
      },
    };

    (this.paths[path] as Record<string, any>)[method] = {
      parameters: mergedParams,
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
      responses,
    };
  }

  private mergeParameters(
    parameters: Array<OpenAPIV3.ParameterObject>
  ): Array<OpenAPIV3.ParameterObject> {
    const paramMap = new Map<string, OpenAPIV3.ParameterObject>();

    parameters.forEach((param) => {
      const key = `${param.in}:${param.name}`;
      if (!paramMap.has(key)) {
        paramMap.set(key, param);
      }
    });

    return Array.from(paramMap.values());
  }

  private validatePathParams(path: string, params: PathParam[]) {
    const templateParams = Array.from(path.matchAll(/{([^}]+)}/g)).map((match) => match[1]);
    const providedParams = params.map((p) => p.name);

    // Check for missing parameters
    const missingParams = templateParams.filter((p) => !providedParams.includes(p));
    if (missingParams.length > 0) {
      throw new Error(`Missing path parameters: ${missingParams.join(', ')}`);
    }

    // Check for extra parameters
    const extraParams = providedParams.filter((p) => !templateParams.includes(p));
    if (extraParams.length > 0) {
      throw new Error(`Unexpected path parameters: ${extraParams.join(', ')}`);
    }
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
