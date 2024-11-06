import { OpenAPIV3 } from 'openapi-types';

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
