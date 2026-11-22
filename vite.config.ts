import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
      {
        name: 'serve-export-zip',
        configureServer(server) {
          const zipPath =
            '/.aistudio/artifacts/brain/ad0a72d6-7e92-4a22-95ad-581887c6cb24/kozuo-store-final.zip';
          server.middlewares.use('/__export/kozuo-store-final.zip', (req, res, next) => {
            if (!fs.existsSync(zipPath)) {
              next();
              return;
            }
            const stat = fs.statSync(zipPath);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Length', String(stat.size));
            res.setHeader(
              'Content-Disposition',
              'attachment; filename="kozuo-store-final.zip"'
            );
            if (req.method === 'HEAD') {
              res.end();
              return;
            }
            fs.createReadStream(zipPath).pipe(res);
          });
        },
        configurePreviewServer(server) {
          const zipPath =
            '/.aistudio/artifacts/brain/ad0a72d6-7e92-4a22-95ad-581887c6cb24/kozuo-store-final.zip';
          server.middlewares.use('/__export/kozuo-store-final.zip', (req, res, next) => {
            if (!fs.existsSync(zipPath)) {
              next();
              return;
            }
            const stat = fs.statSync(zipPath);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Length', String(stat.size));
            res.setHeader(
              'Content-Disposition',
              'attachment; filename="kozuo-store-final.zip"'
            );
            if (req.method === 'HEAD') {
              res.end();
              return;
            }
            fs.createReadStream(zipPath).pipe(res);
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
