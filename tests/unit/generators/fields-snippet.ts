import { DocumentationContext, Field } from '../../../src/types';

export class FieldsSnippetGenerator {
  async generate(context: DocumentationContext): Promise<string> {
    let snippet = '';

    if (context.requestFields.length > 0) {
      snippet += '### Request Fields\n\n';
      snippet += this.generateFieldsTable(context.requestFields);
    }

    if (context.responseFields.length > 0) {
      if (snippet) snippet += '\n\n';
      snippet += '### Response Fields\n\n';
      snippet += this.generateFieldsTable(context.responseFields);
    }

    return snippet;
  }

  private generateFieldsTable(fields: Field[]): string {
    const headers = ['Path', 'Type', 'Required', 'Description', 'Constraints'];
    const rows = fields.map((field) => [
      field.path,
      field.type,
      field.optional ? 'No' : 'Yes',
      field.description,
      field.constraints?.join(', ') || '-',
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
