import { rspack } from '@rspack/core';

const isProduction = process.env.NODE_ENV === 'production';

export default {
  mode: isProduction ? 'production' : 'development',
  entry: './src/main.tsx',
  target: 'web',
  devtool: isProduction ? false : 'source-map',
  output: {
    clean: true,
    publicPath: '/'
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js']
  },
  module: {
    parser: {
      'css/auto': {
        namedExports: false
      }
    },
    rules: [
      {
        test: /\.(?:ts|tsx)$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          detectSyntax: 'auto',
          jsc: {
            transform: {
              react: {
                runtime: 'automatic',
                development: !isProduction
              }
            }
          }
        }
      },
      {
        test: /\.css$/i,
        type: 'css/auto'
      }
    ]
  },
  plugins: [
    new rspack.HtmlRspackPlugin({
      template: './public/index.html',
      title: 'Interiors Editor — POC'
    })
  ],
  devServer: {
    host: '127.0.0.1',
    port: 4173,
    historyApiFallback: true
  }
};
