import * as fs from 'fs-extra';
import * as path from 'path';
import { sanitizePath } from '../utils';

export class SnippetGenerator {
  constructor(private snippetsDir: string) {}

  async generateSnippets(context: any) {
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
