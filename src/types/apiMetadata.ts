import { OpenAPIV3 } from 'openapi-types';

export type HTTPMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

export interface ApiMetadata {
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
