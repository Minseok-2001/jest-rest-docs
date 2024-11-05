# Jest REST Docs API Reference

## Core Classes

### JestRestDocs

The main class for creating API documentation from your Jest tests.

```typescript
const docs = new JestRestDocs({
  outputDir: 'build/docs',
  snippetsDir: 'build/docs/snippets',
  openapi: {
    info: {
      title: 'API Documentation',
      version: '1.0.0'
    }
  }
});
```

#### Constructor Options

| Option | Type | Description |
|--------|------|-------------|
| outputDir | string | Directory where the OpenAPI specification will be generated |
| snippetsDir | string | Directory where documentation snippets will be stored |
| openapi | Object | OpenAPI specification configuration |
| baseUrl | string | Base URL for API requests (default: http://localhost:3000) |

#### Methods

##### document(title: string, metadata: DocumentOptions, testFn: Function)

Wraps a test case and generates documentation from it.

```typescript
it('creates a user', 
  docs.document('Create User', {
    tags: ['Users'],
    summary: 'Creates a new user'
  }, async () => {
    // Your test code here
  })
);
```

##### test(options: TestOptions)

Executes an API test and generates documentation.

```typescript
const response = await docs.test({
  method: 'POST',
  path: '/api/users',
  body: newUser,
  expect: {
    statusCode: 201,
    bodySchema: {
      type: 'object',
      properties: {
        id: { type: 'number' }
      }
    }
  }
});
```

## Interfaces

### TestOptions

```typescript
interface TestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: any;
  headers?: Record<string, string>;
  pathParams?: Array<{
    name: string;
    description: string;
    type: string;
    required?: boolean;
  }>;
  queryParams?: Array<{
    name: string;
    description: string;
    type: string;
    required?: boolean;
  }>;
  expect: {
    statusCode: number;
    bodySchema: OpenAPIV3.SchemaObject;
  };
}
```