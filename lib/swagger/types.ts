import { OpenAPIV3 } from 'openapi-types';

export interface SwaggerConfig {
  /** Swagger UI의 타이틀 */
  title?: string;
  /** API 문서 설명 */
  description?: string;
  /** Swagger UI의 커스텀 CSS */
  customCss?: string;
  /** Swagger UI의 테마 (light/dark) */
  theme?: 'light' | 'dark';
  /** favicon 경로 (선택적) */
  favicon?: string;
  /** OpenAPI 스펙의 서버 설정 */
  servers?: OpenAPIV3.ServerObject[];
  /** API 그룹 태그 정보 */
  tags?: OpenAPIV3.TagObject[];
}

export interface SwaggerUIOptions {
  title?: string;
  openapiPath?: string;
  customCss?: string;
}
