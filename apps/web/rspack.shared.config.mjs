export default (_environment, arguments_) => {
  const isProduction = arguments_.mode === 'production';

  return {
  mode: isProduction ? 'production' : 'development',
  target: 'web',
  devtool: isProduction ? false : 'source-map',
  output: {
    clean: true,
    chunkFilename: isProduction ? '[name].[contenthash].js' : '[name].js',
    cssChunkFilename: isProduction ? '[name].[contenthash].css' : '[name].css',
    cssFilename: isProduction ? '[name].[contenthash].css' : '[name].css',
    filename: isProduction ? '[name].[contenthash].js' : '[name].js',
    publicPath: '/'
  },
  // glTF preview/rendering is loaded only for the explicit custom-model or
  // 3D route.  Keep its vendor implementation below the phone-first asset
  // budget instead of making a furniture import inflate the editor shell.
  optimization: {
    splitChunks: {
      chunks: 'all',
      maxSize: 240 * 1024,
      cacheGroups: {
        three: {
          chunks: 'all',
          enforce: true,
          maxSize: 240 * 1024,
          name: 'three-runtime',
          test: /[\\/]node_modules[\\/]three[\\/]/
        }
      }
    }
  },
    performance: isProduction
      ? {
          // Three's renderer and the curated model files are on-demand assets.
          // Keep the strict 280 KiB limit for every app-shell asset; model bytes
          // still pass the 25 MiB GLB preflight before they enter a Project.
          assetFilter: (assetFilename) =>
            !assetFilename.startsWith('three-runtime') &&
            !assetFilename.startsWith('catalog/'),
          hints: 'error',
          maxAssetSize: 280 * 1024,
          maxEntrypointSize: 290 * 1024
        }
      : false,
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
            target: 'es2020',
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
  plugins: []
  };
};
