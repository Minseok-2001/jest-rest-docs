# Jest REST Docs

[![npm version](https://badge.fury.io/js/jest-rest-docs.svg)](https://badge.fury.io/js/jest-rest-docs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![codecov](https://codecov.io/github/Minseok-2001/jest-rest-docs/graph/badge.svg?token=9F57SFCD68)](https://codecov.io/github/Minseok-2001/jest-rest-docs)

Generate OpenAPI documentation from your Jest API tests - inspired by Spring REST Docs.

## Features

- 🔄 Write tests, get documentation for free
- 📚 Generates OpenAPI 3.0 specification
- ✅ Documentation always in sync with tests
- 🎯 Type-safe API documentation
- 🔍 Automatic request/response validation
- 📝 Markdown snippets generation

## Installation

```bash
npm install --save-dev jest-rest-docs
```

## Quick Start

```typescript
import { JestRestDocs } from 'jest-rest-docs';

const docs = new JestRestDocs({
  outputDir: 'build/docs',
  snippetsDir: 'build/docs/snippets',
  openapi: {
    info: {
      title: 'My API',
      version: '1.0.0'
    }
  }
});

describe('User API', () => {
  it('creates a new user', 
    docs.document('Create User', {
      tags: ['Users'],
      summary: 'Creates a new user'
    }, async () => {
      const response = await docs.test({
        method: 'POST',
        path: '/api/users',
        body: {
          name: 'John Doe',
          email: 'john@example.com'
        },
        expect: {
          statusCode: 201,
          bodySchema: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              email: { type: 'string' }
            }
          }
        }
      });

      expect(response.data).toHaveProperty('id');
    })
  );
});
```

## Generated Documentation

After running your tests, Jest REST Docs will generate:

1. OpenAPI specification (`build/docs/openapi.json`)
2. Documentation snippets (`build/docs/snippets/`)
3. Ready-to-use API documentation

## Features

### Automatic Schema Generation

Your test assertions are automatically converted to OpenAPI schemas:

```typescript
expect: {
  statusCode: 201,
  bodySchema: {
    type: 'object',
    properties: {
      id: { type: 'number' }
    }
  }
}
```

### Path & Query Parameters

Document URL parameters with full type information:

```typescript
pathParams: [{
  name: 'id',
  description: 'User ID',
  type: 'string',
  required: true
}]
```

### Request/Response Examples

Real request and response examples are automatically captured and included in the documentation.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.