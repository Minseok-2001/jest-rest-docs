import { OpenAPIV3 } from 'openapi-types';
import * as fs from 'fs-extra';
import * as path from 'path';
import { sanitizePath } from './utils';
import axios, { AxiosResponse } from 'axios';

export interface DocumentOptions {
  tags?: string[];
  summary?: string;
  description?: string;
}

export interface TestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
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
  };
}

export class JestRestDocs {
  private openapi: Partial<OpenAPIV3.Document>;
  private paths: OpenAPIV3.PathsObject = {};
  private outputDir: string;
  private snippetsDir: string;
  private baseUrl: string;

  constructor(options: {
    outputDir: string;
    snippetsDir: string;
    openapi: Partial<OpenAPIV3.Document>;
    baseUrl?: string;
  }) {
    this.outputDir = options.outputDir;
    this.snippetsDir = options.snippetsDir;
    this.openapi = options.openapi;
    this.baseUrl = options.baseUrl || 'http://localhost:3000';

    // 디렉토리 생성
    fs.ensureDirSync(this.outputDir);
    fs.ensureDirSync(this.snippetsDir);
  }

  document(title: string, metadata: DocumentOptions, testFn: () => Promise<void>) {
    return async () => {
      // 문서화 컨텍스트 초기화
      const context = {
        title,
        ...metadata,
      };

      try {
        // 테스트 실행
        const result = await testFn();

        // OpenAPI 문서 생성
        await this.generateOpenApiSpec();

        // 스니펫 생성
        await this.generateSnippets(context);

        return result;
      } catch (error) {
        // 에러 발생 시에도 문서화
        await this.generateOpenApiSpec();
        throw error;
      }
    };
  }

  async test(options: TestOptions): Promise<AxiosResponse> {
    const {
      method,
      path,
      body,
      headers = {},
      pathParams = [],
      queryParams = [],
      expect: expectations,
    } = options;

    // OpenAPI 경로 정보 저장
    this.addPath(path, method.toLowerCase(), {
      body,
      pathParams,
      queryParams,
      response: expectations,
    });

    // 실제 API 호출
    const response = await axios({
      method,
      url: `${this.baseUrl}${path}`,
      data: body,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      validateStatus: () => true, // 모든 상태 코드 허용
    });

    // 응답 검증
    if (response.status !== expectations.statusCode) {
      throw new Error(
        `Expected status code ${expectations.statusCode} but received ${response.status}`
      );
    }

    return response;
  }

  private addPath(path: string, method: string, info: any) {
    if (!this.paths[path]) {
      this.paths[path] = {} as Record<string, any>;
    }

    (this.paths[path] as Record<string, any>)[method] = {
      parameters: [
        ...info.pathParams.map((param: any) => ({
          name: param.name,
          in: 'path',
          description: param.description,
          required: param.required,
          schema: { type: param.type },
        })),
        ...info.queryParams.map((param: any) => ({
          name: param.name,
          in: 'query',
          description: param.description,
          required: param.required,
          schema: { type: param.type },
        })),
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
        [info.response.statusCode]: {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: info.response.bodySchema,
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

    // 각종 스니펫 생성
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
