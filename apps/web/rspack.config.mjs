import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { rspack } from '@rspack/core';
import { LegalDocumentsPlugin, publicLegalPaths } from './scripts/legal-documents-build.mjs';

class InteriorsServiceWorkerPlugin {
  apply(compiler) {
    const serviceWorkerTemplate = readFileSync(new URL('./public/sw.template.js', import.meta.url), 'utf8');
    compiler.hooks.thisCompilation.tap('InteriorsServiceWorkerPlugin', (compilation) => {
      compilation.hooks.processAssets.tap({
        name: 'InteriorsServiceWorkerPlugin',
        stage: rspack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE
      }, () => {
        const assetPaths = compilation.getAssets()
          .map(({ name }) => `/${name}`)
          .filter((path) => /\.(?:css|js)$/.test(path) && !path.includes('.hot-update.'))
          .sort();
        const appShell = [
          '/',
          '/index.html',
          '/manifest.webmanifest',
          '/icon.svg',
		  '/release-manifest.json',
          ...publicLegalPaths.map((path) => `/${path}`),
          ...assetPaths
        ];
        const shellAssetNames = new Set(appShell
          .filter((path) => path !== '/')
          .map((path) => path.slice(1)));
        const cacheFingerprint = compilation.getAssets()
          .filter(({ name }) => shellAssetNames.has(name))
          .sort(({ name: first }, { name: second }) => first.localeCompare(second))
          .reduce(
            (hash, { name, source }) => hash.update(name).update('\0').update(source.buffer()).update('\0'),
            createHash('sha256').update(serviceWorkerTemplate).update('\0')
          );
        const cacheId = cacheFingerprint.digest('hex').slice(0, 16);
		const releaseManifest = {
		  appBuildId: cacheId,
		  assetSchemas: { readable: [1], writable: [1] },
		  catalogSchemas: { readable: [1], writable: [1] },
		  minimumCapabilities: ['indexeddb'],
		  projectSchemas: { readable: [1], writable: [1] },
		  version: 1,
		  workerProtocolVersion: 1
		};
        const source = serviceWorkerTemplate
          .replace('__INTERIORS_APP_SHELL_CACHE__', `interiors-editor-shell-${cacheId}`)
          .replace('__INTERIORS_BROWSE_CACHE__', `interiors-editor-browse-${cacheId}`)
          .replace('__INTERIORS_APP_SHELL__', JSON.stringify(appShell))
		  .replace('__INTERIORS_RELEASE_MANIFEST__', JSON.stringify(releaseManifest));

        compilation.emitAsset('sw.js', new rspack.sources.RawSource(source));
		compilation.emitAsset(
		  'release-manifest.json',
		  new rspack.sources.RawSource(JSON.stringify(releaseManifest))
		);
      });
    });
  }
}

export default (_environment, arguments_) => {
  const isProduction = arguments_.mode === 'production';
  const configuredDevServerPort = Number(
    process.env.INTERIORS_DEV_SERVER_PORT ?? 4173
  );
  const devServerPort = Number.isInteger(configuredDevServerPort) && configuredDevServerPort > 0
    ? configuredDevServerPort
    : 4173;

  return {
  mode: isProduction ? 'production' : 'development',
  entry: './src/main.tsx',
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
  plugins: [
    new rspack.DefinePlugin({
      __INTERIORS_TEST_SEAM__: JSON.stringify(!isProduction),
    }),
    new rspack.HtmlRspackPlugin({
      template: './public/index.html',
      title: 'InteriorsEditor'
    }),
    new LegalDocumentsPlugin(),
    new InteriorsServiceWorkerPlugin(),
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: './public/manifest.webmanifest', to: 'manifest.webmanifest' },
        { from: './public/icon.svg', to: 'icon.svg' },
        // Catalog thumbnails are tiny and shown immediately; the matching GLB
        // files stay outside the app shell and are cache-first on selection.
        { from: './public/catalog', to: 'catalog' },
        {
          from: '../catalog-control-plane/src/main/resources/catalog/evidence-assets/*.glb',
          to: 'catalog/[name][ext]'
        }
      ]
    })
  ],
    devServer: {
      allowedHosts: 'all',
      host: '0.0.0.0',
      port: devServerPort,
      historyApiFallback: true,
      proxy: [
        {
          context: ['/catalog-api'],
          target: process.env.INTERIORS_CATALOG_ORIGIN ?? 'http://127.0.0.1:4174',
          changeOrigin: false
        }
      ]
    }
  };
};
