// import fs from 'fs-extra';
// import path from 'path';
//
// // const __dirname = path.dirname(fileURLToPath(import.meta.url));
//
// export interface SwaggerUIOptions {
//   title?: string;
//   openapiPath?: string;
//   customCss?: string;
// }
//
// export async function setupSwaggerUI(outputDir: string, options: SwaggerUIOptions = {}) {
//   const { title = 'API Documentation', openapiPath = '/openapi.json', customCss = '' } = options;
//
//   const requiredFiles = [
//     'swagger-ui.css',
//     'swagger-ui-bundle.js',
//     'swagger-ui-standalone-preset.js',
//     'favicon-16x16.png',
//     'favicon-32x32.png',
//   ];
//
//   const swaggerDistPath = require
//     .resolve('swagger-ui-dist')
//     .replace(/\\/g, '/')
//     .replace(/\/swagger-ui-dist\/.*$/, '/swagger-ui-dist');
//
//   for (const file of requiredFiles) {
//     await fs.copy(path.join(swaggerDistPath, file), path.join(outputDir, file));
//   }
//
//   const indexHtml = `
// <!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <title>${title}</title>
//     <link rel="stylesheet" type="text/css" href="./swagger-ui.css" />
//     <link rel="icon" type="image/png" href="./favicon-32x32.png" sizes="32x32" />
//     <link rel="icon" type="image/png" href="./favicon-16x16.png" sizes="16x16" />
//     <style>
//         html {
//             box-sizing: border-box;
//             overflow: -moz-scrollbars-vertical;
//             overflow-y: scroll;
//         }
//
//         *,
//         *:before,
//         *:after {
//             box-sizing: inherit;
//         }
//
//         body {
//             margin: 0;
//             background: #fafafa;
//         }
//         ${customCss}
//     </style>
// </head>
// <body>
//     <div id="swagger-ui"></div>
//
//     <script src="./swagger-ui-bundle.js"></script>
//     <script src="./swagger-ui-standalone-preset.js"></script>
//     <script>
//         window.onload = function() {
//             window.ui = SwaggerUIBundle({
//                 url: "${openapiPath}",
//                 dom_id: '#swagger-ui',
//                 deepLinking: true,
//                 presets: [
//                     SwaggerUIBundle.presets.apis,
//                     SwaggerUIStandalonePreset
//                 ],
//                 plugins: [
//                     SwaggerUIBundle.plugins.DownloadUrl
//                 ],
//                 layout: "StandaloneLayout"
//             });
//         };
//     </script>
// </body>
// </html>
//   `.trim();
//
//   await fs.writeFile(path.join(outputDir, 'index.html'), indexHtml);
// }
