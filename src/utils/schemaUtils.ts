// src/utils/schemaUtils.ts
import { OpenAPIV3 } from 'openapi-types';

/**
 * Determines if the given object is a ReferenceObject.
 * @param obj The object to check.
 * @returns True if the object is a ReferenceObject, false otherwise.
 */
export function isReferenceObject(obj: any): obj is OpenAPIV3.ReferenceObject {
  return obj && typeof obj === 'object' && '$ref' in obj;
}

/**
 * Infers an OpenAPI schema from the given data.
 * @param data The data to infer the schema from.
 * @returns The inferred schema object.
 */
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
          items: data.length > 0 ? inferSchema(data[0]) : { type: 'object' }, // 기본 객체 스키마 설정
        };
      }
      const properties: Record<string, OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject> = {};
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

/**
 * Retrieves the actual path parameter value from the actual path.
 * @param pathTemplate The path template with placeholders.
 * @param actualPath The actual request path.
 * @param paramName The name of the parameter.
 * @returns The actual value of the path parameter.
 */
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

/**
 * Extracts path parameters from the path template and actual path.
 * @param pathTemplate The path template with placeholders.
 * @param actualPath The actual request path.
 * @returns An array of extracted path parameters.
 */
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

/**
 * Extracts query parameters from the query object.
 * @param query The query parameters.
 * @returns An array of extracted query parameters.
 */
export function extractQueryParameters(query: Record<string, any>): OpenAPIV3.ParameterObject[] {
  return Object.entries(query).map(([name, value]) => ({
    name,
    in: 'query',
    required: false,
    schema: inferSchema(value),
    example: value,
  }));
}

/**
 * Merges a defined parameter with its actual value.
 * @param definedParam The defined parameter object.
 * @param actualValue The actual value of the parameter.
 * @returns The merged parameter object.
 */
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

/**
 * Deep merges two OpenAPI schemas using oneOf when schemas differ.
 * @param schema1 Existing schema.
 * @param schema2 New schema to merge.
 * @returns Merged schema.
 */
export function deepMergeSchemas(
  schema1: OpenAPIV3.SchemaObject,
  schema2: OpenAPIV3.SchemaObject
): OpenAPIV3.SchemaObject {
  console.log(
    'Merging schemas:',
    JSON.stringify(schema1, null, 2),
    JSON.stringify(schema2, null, 2)
  );

  if (schemasAreEqual(schema1, schema2)) {
    return schema1;
  }

  // If both schemas are objects, attempt to merge their properties
  if (schema1.type === 'object' && schema2.type === 'object') {
    const mergedProperties: Record<string, OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject> = {
      ...schema1.properties,
    };

    for (const [key, schema2Prop] of Object.entries(schema2.properties || {})) {
      if (mergedProperties[key]) {
        const schema1Prop = mergedProperties[key] as OpenAPIV3.SchemaObject;
        mergedProperties[key] = deepMergeSchemas(
          schema1Prop,
          schema2Prop as OpenAPIV3.SchemaObject
        );
      } else {
        mergedProperties[key] = schema2Prop;
      }
    }

    return {
      type: 'object',
      properties: mergedProperties,
    };
  }

  // If both schemas are arrays, attempt to merge their items
  if (schema1.type === 'array' && schema2.type === 'array') {
    if (schema1.items && schema2.items) {
      const mergedItems = deepMergeSchemas(
        schema1.items as OpenAPIV3.SchemaObject,
        schema2.items as OpenAPIV3.SchemaObject
      );
      return {
        type: 'array',
        items: mergedItems,
      };
    }
    return schema1.type === 'array' ? schema1 : schema2;
  }

  // If schemas differ, use oneOf
  console.log('Schemas differ. Using oneOf.');
  return {
    oneOf: [schema1, schema2],
  };
}

/**
 * Checks if two schemas are equal.
 * @param schema1 First schema.
 * @param schema2 Second schema.
 * @returns True if schemas are equal, false otherwise.
 */
function schemasAreEqual(
  schema1: OpenAPIV3.SchemaObject,
  schema2: OpenAPIV3.SchemaObject
): boolean {
  return JSON.stringify(schema1) === JSON.stringify(schema2);
}

/**
 * Determines if a schema is a generic object schema (no properties defined).
 * @param schema The schema to check.
 * @returns True if the schema is a generic object schema, false otherwise.
 */
export function isGenericObjectSchema(
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
): boolean {
  if (isReferenceObject(schema)) return false;
  return (
    schema.type === 'object' && (!schema.properties || Object.keys(schema.properties).length === 0)
  );
}

/**
 * Deep merges two OpenAPI ResponseObjects using deepMergeSchemas.
 * @param existingResponse Existing response.
 * @param newResponse New response to merge.
 * @returns Merged response.
 */
export function deepMergeResponseObjects(
  existingResponse: OpenAPIV3.ResponseObject,
  newResponse: OpenAPIV3.ResponseObject
): OpenAPIV3.ResponseObject {
  console.log(
    'Merging responses:',
    JSON.stringify(existingResponse, null, 2),
    JSON.stringify(newResponse, null, 2)
  );

  // Merge descriptions
  if (existingResponse.description && newResponse.description) {
    existingResponse.description = `${existingResponse.description}\n\n${newResponse.description}`;
  } else {
    existingResponse.description = existingResponse.description || newResponse.description;
  }

  // Merge content
  if (existingResponse.content && newResponse.content) {
    for (const [contentType, newContent] of Object.entries(newResponse.content)) {
      if (existingResponse.content[contentType]) {
        const existingContent = existingResponse.content[contentType] as OpenAPIV3.MediaTypeObject;
        const newMediaContent = newContent as OpenAPIV3.MediaTypeObject;

        // Merge schemas
        if (existingContent.schema && newMediaContent.schema) {
          console.log(`Merging schemas for content type: ${contentType}`);
          existingContent.schema = deepMergeSchemas(
            existingContent.schema as OpenAPIV3.SchemaObject,
            newMediaContent.schema as OpenAPIV3.SchemaObject
          );
        }

        // Merge examples
        existingContent.examples = {
          ...existingContent.examples,
          ...newMediaContent.examples,
        };
      } else {
        existingResponse.content[contentType] = newContent;
      }
    }
  }

  return existingResponse;
}

/**
 * Deep merges two OpenAPI ResponsesObjects.
 * @param responses1 Existing responses.
 * @param responses2 New responses to merge.
 * @returns Merged responses.
 */
export function deepMergeResponses(
  responses1: OpenAPIV3.ResponsesObject,
  responses2: OpenAPIV3.ResponsesObject
): OpenAPIV3.ResponsesObject {
  const merged: OpenAPIV3.ResponsesObject = { ...responses1 };

  for (const [status, newResponse] of Object.entries(responses2)) {
    if (merged[status]) {
      const existingResponse = merged[status];
      if (isReferenceObject(existingResponse) || isReferenceObject(newResponse)) {
        // ReferenceObject인 경우 병합하지 않음
        continue;
      }

      const existingResObj = existingResponse as OpenAPIV3.ResponseObject;
      const newResObj = newResponse as OpenAPIV3.ResponseObject;

      // 기존 응답과 새로운 응답을 병합
      merged[status] = deepMergeResponseObjects(existingResObj, newResObj);
    } else {
      merged[status] = newResponse;
    }
  }

  return merged;
}
