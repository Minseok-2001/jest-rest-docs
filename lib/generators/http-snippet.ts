import { DocumentationContext } from '../types';

export class HttpSnippetGenerator {
  async generate(context: DocumentationContext): Promise<string> {
    const { method, path, requestHeaders, responseHeaders, requestBody, responseBody, statusCode } =
      context;

    let snippet = '### HTTP Request\n\n```http\n';
    snippet += `${method} ${path}\n`;

    // Add request headers
    requestHeaders.forEach((value, key) => {
      snippet += `${key}: ${value}\n`;
    });

    // Add request body
    if (requestBody) {
      snippet += '\n' + JSON.stringify(requestBody, null, 2);
    }

    snippet += '\n```\n\n### HTTP Response\n\n```http\n';
    snippet += `HTTP/1.1 ${statusCode}\n`;

    // Add response headers
    responseHeaders.forEach((value, key) => {
      snippet += `${key}: ${value}\n`;
    });

    // Add response body
    if (responseBody) {
      snippet += '\n' + JSON.stringify(responseBody, null, 2);
    }

    snippet += '\n```';

    return snippet;
  }
}
