import fs from 'fs-extra';
import path from 'path';
// import { fileURLToPath } from 'url';
import { SwaggerConfig } from './types';

// const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class SwaggerProvider {
  constructor(
    private readonly outputDir: string,
    private readonly config: SwaggerConfig = {}
  ) {}

  /**
   * Swagger UI 파일들을 생성하고 설정 정보를 반환합니다.
   */
  async generateSwaggerFiles(): Promise<{
    staticFiles: string[];
    openApiPath: string;
    uiPath: string;
  }> {
    // Swagger UI 파일 복사
    const staticFiles = await this.copySwaggerFiles();

    // index.html 생성
    const uiPath = path.join(this.outputDir, 'index.html');
    const htmlContent = this.generateSwaggerHtml();
    await fs.writeFile(uiPath, htmlContent);

    // OpenAPI 경로
    const openApiPath = path.join(this.outputDir, 'openapi.json');

    return {
      staticFiles,
      openApiPath,
      uiPath,
    };
  }

  /**
   * Swagger UI에 필요한 정적 파일들을 복사합니다.
   */
  private async copySwaggerFiles(): Promise<string[]> {
    const swaggerDistPath = require.resolve('swagger-ui-dist').replace(/index\.js$/, '');

    const filesToCopy = [
      'swagger-ui.css',
      'swagger-ui-bundle.js',
      'swagger-ui-standalone-preset.js',
      'favicon-32x32.png',
      'favicon-16x16.png',
    ];

    await Promise.all(
      filesToCopy.map((file) =>
        fs.copy(path.join(swaggerDistPath, file), path.join(this.outputDir, file))
      )
    );

    return filesToCopy;
  }

  /**
   * Swagger UI의 HTML 콘텐츠를 생성합니다.
   */
  private generateSwaggerHtml(): string {
    const {
      title = 'API Documentation',
      description = '',
      customCss = '',
      theme = 'light',
      favicon = './favicon-32x32.png',
    } = this.config;

    const themeStyles = theme === 'dark' ? this.getDarkThemeStyles() : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <meta name="description" content="${description || title}">
    <link rel="stylesheet" type="text/css" href="./swagger-ui.css" />
    <link rel="icon" type="image/png" href="${favicon}" sizes="32x32" />
    <style>
        ${themeStyles}
        ${customCss}
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin: 0; background: ${theme === 'dark' ? '#1a1a1a' : '#fafafa'}; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="./swagger-ui-bundle.js"></script>
    <script src="./swagger-ui-standalone-preset.js"></script>
    <script>
        import { SwaggerUIBundle } from 'swagger-ui-dist'; 
window.onload = function() {
            window.ui = SwaggerUIBundle({
                url: "./openapi.json",
                dom_id: '#swagger-ui',
                deepLinking: true,
                defaultModelsExpandDepth: 3,
                defaultModelExpandDepth: 3,
                displayRequestDuration: true,
                filter: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                syntaxHighlight: {
                    theme: "${theme === 'dark' ? 'monokai' : 'agate'}"
                },
                ${this.config.servers ? `servers: ${JSON.stringify(this.config.servers)},` : ''}
                ${this.config.tags ? `tags: ${JSON.stringify(this.config.tags)},` : ''}
            });
        };
    </script>
</body>
</html>`.trim();
  }

  /**
   * 다크 테마용 CSS 스타일을 반환합니다.
   */
  private getDarkThemeStyles(): string {
    return `
      .swagger-ui {
        color: #ffffff;
      }
      .swagger-ui .info .title,
      .swagger-ui .opblock-tag,
      .swagger-ui table thead tr td,
      .swagger-ui table thead tr th,
      .swagger-ui .response-col_status,
      .swagger-ui .response-col_description,
      .swagger-ui .response-col_links,
      .swagger-ui .responses-inner h4,
      .swagger-ui .responses-inner h5,
      .swagger-ui .opblock-description-wrapper p,
      .swagger-ui .opblock-external-docs-wrapper p,
      .swagger-ui .opblock-title_normal p {
        color: #ffffff;
      }
      .swagger-ui .scheme-container {
        background: #2a2a2a;
      }
      .swagger-ui select {
        background: #1a1a1a;
        color: #ffffff;
      }
      .swagger-ui .opblock {
        background: #2a2a2a;
        border-color: #404040;
      }
      .swagger-ui .opblock .opblock-summary-description {
        color: #cccccc;
      }
      .swagger-ui .tab li {
        color: #cccccc;
      }
      .swagger-ui section.models {
        background: #2a2a2a;
        border-color: #404040;
      }
      .swagger-ui .model-box {
        background: #1a1a1a;
      }
    `;
  }
}

export { SwaggerConfig } from './types';
