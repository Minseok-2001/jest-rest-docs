import { DocumentationContext } from './context';

export interface JestRestDocsOptions {
  outputDir: string;
  snippetsDir: string;
  template?: string;
  includeHost?: boolean;
  host?: string;
  preprocessors?: Array<(context: DocumentationContext) => Promise<void>>;
  postprocessors?: Array<(context: DocumentationContext) => Promise<void>>;
  formatters?: {
    code?: (code: string, language?: string) => string;
    table?: (headers: string[], rows: string[][]) => string;
  };
}
