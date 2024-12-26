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
          items: data.length > 0 ? inferSchema(data[0]) : { type: 'object' },
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

  let oneOfSchemas: OpenAPIV3.SchemaObject[] = [];

  if (schema1.oneOf) {
    oneOfSchemas = oneOfSchemas.concat(schema1.oneOf as OpenAPIV3.SchemaObject[]);
  } else {
    oneOfSchemas.push(schema1);
  }

  if (schema2.oneOf) {
    oneOfSchemas = oneOfSchemas.concat(schema2.oneOf as OpenAPIV3.SchemaObject[]);
  } else {
    oneOfSchemas.push(schema2);
  }

  // Remove duplicate schemas based on their stringified content
  oneOfSchemas = oneOfSchemas.filter(
    (schema, index, self) =>
      index === self.findIndex((s) => JSON.stringify(s) === JSON.stringify(schema))
  );

  return {
    oneOf: oneOfSchemas,
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
  const descriptions = new Set<string>();

  if (existingResponse.description) {
    existingResponse.description
      .split('\n\n')
      .map((desc) => desc.trim())
      .forEach((desc) => descriptions.add(desc));
  }

  if (newResponse.description) {
    const newDesc = newResponse.description.trim();
    descriptions.add(newDesc);
  }

  existingResponse.description = Array.from(descriptions).join('\n\n');

  if (existingResponse.content && newResponse.content) {
    for (const [contentType, newContent] of Object.entries(newResponse.content)) {
      if (existingResponse.content[contentType]) {
        const existingContent = existingResponse.content[contentType] as OpenAPIV3.MediaTypeObject;
        const newMediaContent = newContent as OpenAPIV3.MediaTypeObject;

        // Merge schemas
        if (existingContent.schema && newMediaContent.schema) {
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
        // Do not merge ReferenceObjects
        continue;
      }

      const existingResObj = existingResponse as OpenAPIV3.ResponseObject;
      const newResObj = newResponse as OpenAPIV3.ResponseObject;

      // Merge the existing response with the new response
      merged[status] = deepMergeResponseObjects(existingResObj, newResObj);
    } else {
      merged[status] = newResponse;
    }
  }

  return merged;
}
