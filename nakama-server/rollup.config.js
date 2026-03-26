const resolve = require('@rollup/plugin-node-resolve');
const commonJS = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const typescript = require('@rollup/plugin-typescript');

module.exports = {
  input: './src/main.ts',
  output: {
    file: 'build/index.js',
    format: 'cjs',
  },
  external: ['nakama-runtime'],
  plugins: [
    resolve(),
    commonJS(),
    json(),
    typescript(),
  ],
};
