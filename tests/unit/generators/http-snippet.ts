import { HttpSnippetGenerator } from '../../../src/generators';
import { DocumentationContext } from '../../../src/types';

describe('HttpSnippetGenerator', () => {
  let generator: HttpSnippetGenerator;

  beforeEach(() => {
    generator = new HttpSnippetGenerator();
  });

  it('generates HTTP request snippet correctly', async () => {
    const context: Partial<DocumentationContext> = {
      title: 'Test API',
      method: 'POST',
      path: '/api/users',
      requestHeaders: new Map([['Content-Type', 'application/json']]),
      requestBody: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    };

    const snippet = await generator.generate(context as DocumentationContext);

    expect(snippet).toContain('POST /api/users');
    expect(snippet).toContain('Content-Type: application/json');
    expect(snippet).toContain('"name": "John Doe"');
  });
});
