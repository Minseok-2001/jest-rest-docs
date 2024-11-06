export const DEFAULT_OPTIONS = {
  outputDir: 'build/docs',
  snippetsDir: 'build/docs/snippets',
  template: 'default',
  includeHost: false,
  host: 'http://localhost',
};

export const SUPPORTED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

export const CONTENT_TYPES = {
  JSON: 'application/json',
  FORM: 'application/x-www-form-urlencoded',
  MULTIPART: 'multipart/form-data',
  TEXT: 'text/plain',
  HTML: 'text/html',
  XML: 'application/xml',
};

export const DEFAULT_SNIPPETS = [
  'http-request',
  'http-response',
  'request-fields',
  'response-fields',
  'path-parameters',
  'query-parameters',
];

export const ERROR_MESSAGES = {
  NO_CONTEXT: 'No documentation context found',
  INVALID_METHOD: 'Invalid HTTP method',
  MISSING_TITLE: 'Documentation title is required',
  MISSING_PATH: 'API path is required',
};
