const path = require('path');
const webpack = require('webpack');

module.exports = [
  // Extension bundle (uses main tsconfig, output to out/ for VSCode loading)
  {
    mode: 'production',
    entry: './src/extension.ts',
    output: {
      path: path.resolve(__dirname, 'out'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2',
      devtoolModuleFilenameTemplate: '../[resource-path]'
    },
    externals: [
      'vscode',
      'fs',
      'path',
      'child_process',
      'os',
    ],
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: ['ts-loader']
        }
      ]
    }
  },
  // Webview React bundle (uses webview tsconfig, skip type check for speed)
  {
    mode: 'production',
    entry: './src/webview/index.tsx',
    output: {
      path: path.resolve(__dirname, 'resources'),
      filename: 'bundle.js',
      library: {
        type: 'var',
        name: 'MDTODO',
      },
      globalObject: 'this',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: 'tsconfig.webview.json',
                transpileOnly: true, // Skip type checking for faster builds
              },
            },
          ],
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    externals: {
      react: 'React',
      'react-dom': 'ReactDOM',
    },
  }
];
