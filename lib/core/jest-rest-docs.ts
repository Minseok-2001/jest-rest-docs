import { OpenAPIV3 } from 'openapi-types';
import * as fs from 'fs-extra';
import * as path from 'path';
import { SwaggerProvider, SwaggerConfig } from '../swagger';
import { SnippetGenerator } from '../generators';
import { DocumentOptions, TestOptions } from '../types';
import axios, { AxiosResponse } from 'axios';

interface JestRestDocsOptions {
  outputDir: string;
  snippetsDir: string;
  openapi: Partial<OpenAPIV3.Document>;
  baseUrl?: string;
  swagger?: SwaggerConfig;
}

export class JestRestDocs {
  private openapi: Partial<OpenAPIV3.Document>;
  private paths: OpenAPIV3.PathsObject = {};
  private readonly snippetGenerator: SnippetGenerator;
  private readonly swaggerProvider: SwaggerProvider;
  private readonly baseUrl: string;

  constructor(private readonly options: JestRestDocsOptions) {
    const { outputDir, snippetsDir, openapi, swagger, baseUrl } = options;

    this.openapi = openapi;
    this.snippetGenerator = new SnippetGenerator(snippetsDir);
    this.swaggerProvider = new SwaggerProvider(outputDir, swagger);
    this.baseUrl = baseUrl || 'http://localhost:3000';

    fs.ensureDirSync(outputDir);
    fs.ensureDirSync(snippetsDir);
  }

  document(title: string, metadata: DocumentOptions, testFn: () => Promise<void>) {
    return async () => {
      try {
        const testResult = await testFn();

        this.addPath(testResult.request.path, testResult.request.method.toLowerCase(), testResult);

        await this.generateOpenApiSpec();
        await this.snippetGenerator.generateSnippets({
          title,
          ...metadata,
          ...testResult,
        });

        return testResult;
      } catch (error) {
        this.paths = {};
        throw error;
      }
    };
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
      servers:
        this.openapi.servers ||
        ([
          {
            url: this.options.baseUrl,
            description: 'API server',
          },
        ] as OpenAPIV3.ServerObject[]),
      paths: this.paths,
      components: this.openapi.components || {},
      tags: this.openapi.tags || [],
      security: this.openapi.security,
      externalDocs: this.openapi.externalDocs,
    };

    await fs.writeJson(path.join(this.options.outputDir, 'openapi.json'), spec, { spaces: 2 });

    await this.swaggerProvider.generateSwaggerFiles();
  }
}
