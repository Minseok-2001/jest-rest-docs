import { DocumentationContext, Parameter } from '../../../lib/types';

export class ParametersSnippetGenerator {
  async generate(context: DocumentationContext): Promise<string> {
    let snippet = '';

    if (context.pathParameters.length > 0) {
      snippet += '### Path Parameters\n\n';
      snippet += this.generateParametersTable(context.pathParameters);
    }

    if (context.queryParameters.length > 0) {
      if (snippet) snippet += '\n\n';
      snippet += '### Query Parameters\n\n';
      snippet += this.generateParametersTable(context.queryParameters);
    }

    return snippet;
  }

  private generateParametersTable(parameters: Parameter[]): string {
    const headers = ['Name', 'Required', 'Default', 'Description', 'Type'];
    const rows = parameters.map((param) => [
      param.name,
      param.required ? 'Yes' : 'No',
      param.defaultValue || '-',
      param.description,
      param.type || 'string',
    ]);

    return this.createMarkdownTable(headers, rows);
  }

  private createMarkdownTable(headers: string[], rows: string[][]): string {
    const headerRow = `| ${headers.join(' | ')} |`;
    const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
    const dataRows = rows.map((row) => `| ${row.join(' | ')} |`);

    return [headerRow, separatorRow, ...dataRows].join('\n');
  }
}
