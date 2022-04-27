import typescript from 'rollup-plugin-typescript2';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

const config = {
  input: 'main.ts',
  output: [
    {
      file: 'lib/main.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'default',
    },
    {
      file: 'lib/main.esm.js',
      format: 'es',
      sourcemap: true,
      exports: 'default',
    },
  ],
  external: ['@solana/web3.js'],
  plugins: [
    commonjs(),
    nodeResolve(),
    typescript({
      tsconfigOverride: {
        exclude: ["*.test.ts"],
        compilerOptions: {
          module: "esnext"
        }
      }
    }),
    json()
  ],
}

export default config;
