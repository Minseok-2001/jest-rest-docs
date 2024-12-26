import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import sourcemaps from 'rollup-plugin-sourcemaps';

const extensions = ['.js', '.ts'];

const external = [
  '@jest/globals',
  'express',
  'supertest',
  'fs-extra',
  'path',
  'http',
  'openapi-types',
];

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true,
    },
  ],
  external,
  plugins: [
    peerDepsExternal(),
    resolve({
      extensions,
      preferBuiltins: true,
    }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: './dist/types',
      module: 'ESNext',
    }),
    sourcemaps(),
  ],
};
