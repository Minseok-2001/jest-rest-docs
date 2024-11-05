import { RequestProcessor } from '../../../src/processors';
import { DocumentationContext } from '../../../src/types';

describe('RequestProcessor', () => {
  let processor: RequestProcessor;

  beforeEach(() => {
    processor = new RequestProcessor();
  });

  it('processes path parameters correctly', async () => {
    const context: Partial<DocumentationContext> = {
      path: '/api/users/:id',
      pathParameters: [{ name: 'id', description: 'User ID', type: 'string', required: true }],
    };

    await processor.process(context as DocumentationContext);
    expect(context.path).toBe('/api/users/{id}');
  });
});
