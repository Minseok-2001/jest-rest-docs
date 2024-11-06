export interface Field {
  path: string;
  description: string;
  type: string;
  optional?: boolean;
  constraints?: string[];
}

export interface Parameter {
  name: string;
  description: string;
  required?: boolean;
  defaultValue?: string;
  type?: string;
}

export interface DocumentationContext {
  title: string;
  method: string;
  path: string;
  snippets: string[];
  requestHeaders: Map<string, string>;
  responseHeaders: Map<string, string>;
  requestBody?: any;
  responseBody?: any;
  statusCode?: number;
  requestFields: Field[];
  responseFields: Field[];
  pathParameters: Parameter[];
  queryParameters: Parameter[];
  description?: string;
  tags?: string[];
}
