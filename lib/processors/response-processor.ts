import { DocumentationContext } from '../types';

export class ResponseProcessor {
  async process(context: DocumentationContext): Promise<void> {
    // Add common response headers if not present
    if (context.responseBody) {
      context.responseHeaders.set('Content-Type', 'application/json');
    }

    // Add content length header
    if (context.responseBody) {
      const contentLength = Buffer.from(JSON.stringify(context.responseBody)).length;
      context.responseHeaders.set('Content-Length', contentLength.toString());
    }

    // Process response status
    if (!context.statusCode) {
      context.statusCode = this.getDefaultStatusCode(context.method);
    }
  }

  private getDefaultStatusCode(method: string): number {
    switch (method.toUpperCase()) {
      case 'POST':
        return 201;
      case 'DELETE':
        return 204;
      default:
        return 200;
    }
  }
}
