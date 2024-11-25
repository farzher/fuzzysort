import terser from '@rollup/plugin-terser';
import fs from 'fs/promises';
import { defineConfig } from 'rollup';

const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));

const banner = '// https://github.com/farzher/fuzzysort v' + pkg.version;
const exports = 'named';
const sourcemap = true;

export default defineConfig([
  {
    input: 'src/fuzzysort.js',
    output: { banner, exports, sourcemap, file: pkg.browser, format: 'umd', name: 'fuzzysort' },
    plugins: [terser()],
  },
  {
    input: 'src/fuzzysort.js',
    output: [
      { banner, exports, sourcemap, file: pkg.main, format: 'cjs' },
      { banner, exports, sourcemap, file: pkg.module, format: 'es' },
    ],
  },
]);
