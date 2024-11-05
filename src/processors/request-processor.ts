import { DocumentationContext } from '../types';

export class RequestProcessor {
  async process(context: DocumentationContext): Promise<void> {
    // Extract method and path from the request
    if (context.requestBody) {
      context.requestHeaders.set('Content-Type', 'application/json');
    }

    // Add common headers if not present
    if (!context.requestHeaders?.has('Accept')) {
      context.requestHeaders?.set('Accept', 'application/json');
    }

    // Process path parameters
    context.pathParameters.forEach((param) => {
      const placeholder = `:${param.name}`;
      if (context.path.includes(placeholder)) {
        context.path = context.path.replace(placeholder, `{${param.name}}`);
      }
    });
  }
}
