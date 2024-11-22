import { OpenAPIV3 } from 'openapi-types';

export function inferSchema(data: any): OpenAPIV3.SchemaObject {
  if (data === null || data === undefined) {
    return { type: 'object', nullable: true };
  }

  switch (typeof data) {
    case 'number':
      return { type: 'number' };
    case 'string':
      return { type: 'string' };
    case 'boolean':
      return { type: 'boolean' };
    case 'object': {
      if (Array.isArray(data)) {
        return {
          type: 'array',
          items: data.length > 0 ? inferSchema(data[0]) : {},
        };
      }
      const properties: Record<string, OpenAPIV3.SchemaObject> = {};
      Object.entries(data).forEach(([key, value]) => {
        properties[key] = inferSchema(value);
      });
      return {
        type: 'object',
        properties,
      };
    }
    default:
      return { type: 'object' };
  }
}

export function getActualPathParamValue(
  pathTemplate: string,
  actualPath: string,
  paramName: string
): string | undefined {
  const templateParts = pathTemplate.split('/');
  const actualParts = actualPath.split('/');

  for (let i = 0; i < templateParts.length; i++) {
    const part = templateParts[i];
    if (part === `{${paramName}}`) {
      return actualParts[i];
    }
  }
  return undefined;
}

export function extractPathParameters(
  pathTemplate: string,
  actualPath?: string
): OpenAPIV3.ParameterObject[] {
  const params: OpenAPIV3.ParameterObject[] = [];
  const templateParts = pathTemplate.split('/');
  const actualParts = actualPath?.split('/') || [];

  templateParts.forEach((part, index) => {
    if (part.startsWith('{') && part.endsWith('}')) {
      const name = part.slice(1, -1);
      params.push({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
        example: actualParts[index],
      });
    }
  });

  return params;
}

export function extractQueryParameters(query: Record<string, any>): OpenAPIV3.ParameterObject[] {
  return Object.entries(query).map(([name, value]) => ({
    name,
    in: 'query',
    required: false,
    schema: inferSchema(value),
    example: value,
  }));
}

export function mergeParameterWithExample(
  definedParam: OpenAPIV3.ParameterObject,
  actualValue: any
): OpenAPIV3.ParameterObject {
  if (definedParam.example || (definedParam.schema as OpenAPIV3.SchemaObject)?.default) {
    return definedParam;
  }
  return {
    ...definedParam,
    example: actualValue,
  };
}
