// List of files extensions for watching & hard reload

import pkg from 'gulp';
import browserSync from 'browser-sync';
import bSsi from 'browsersync-ssi';
import Ssi from 'ssi';
import webpack from 'webpack-stream';
import gulpSass from 'gulp-sass';
import sass from 'sass';
import sassGlob from 'gulp-sass-glob';
import postCss from 'gulp-postcss';
import cssnano from 'cssnano';
import autoprefixer from 'autoprefixer';
import imagemin from 'gulp-imagemin';
import changed from 'gulp-changed';
import rename from 'gulp-rename';
import rsync from 'gulp-rsync';
import del from 'del';

const watchFiles = 'html,htm,txt,json,md,woff2';
const {
  src, dest, parallel, series, watch,
} = pkg;
const sassСompiler = gulpSass(sass);

function browserSyncInit() {
  browserSync.init({
    server: {
      baseDir: 'app/',
      middleware: bSsi({ baseDir: 'app/', ext: '.html' }),
    },
    ghostMode: { clicks: false },
    notify: false,
    online: true,
    // tunnel: 'yousutename', // Attempt to use the URL https://yousutename.loca.lt
  });
}

function scripts() {
  return src(['app/js/*.js', '!app/js/*.min.js'])
    .pipe(webpack({
      mode: 'production',
      performance: { hints: false },
      module: {
        rules: [
          {
            test: /\.(js)$/,
            exclude: /(node_modules)/,
            loader: 'babel-loader',
            query: {
              presets: ['@babel/env'],
              plugins: ['babel-plugin-root-import'],
            },
          },
        ],
      },
    })).on('error', function handleError() {
      this.emit('end');
    })
    .pipe(rename('app.min.js'))
    .pipe(dest('app/js'))
    .pipe(browserSync.stream());
}

function styles() {
  return src(['app/styles/sass/*.*', '!app/styles/sass/_*.*'])
    .pipe(sassGlob())
    .pipe(sassСompiler())
    .pipe(postCss([
      autoprefixer({ grid: 'autoplace' }),
      cssnano({ preset: ['default', { discardComments: { removeAll: true } }] }),
    ]))
    .pipe(rename({ suffix: '.min' }))
    .pipe(dest('app/css'))
    .pipe(browserSync.stream());
}

function images() {
  return src(['app/images/src/**/*'])
    .pipe(changed('app/images/dist'))
    .pipe(imagemin())
    .pipe(dest('app/images/dist'))
    .pipe(browserSync.stream());
}

function buildcopy() {
  return src([
    '{app/js,app/css}/*.min.*',
    'app/images/**/*.*',
    '!app/images/src/**/*',
    'app/fonts/**/*',
  ], { base: 'app/' })
    .pipe(dest('dist'));
}

async function buildhtml() {
  const includes = new Ssi('app/', 'dist/', '/**/*.html');
  includes.compile();
  del('dist/parts', { force: true });
}

async function cleandist() {
  del('dist/**/*', { force: true });
}

function deploy() {
  return src('dist/')
    .pipe(rsync({
      root: 'dist/',
      hostname: 'username@yousite.com',
      destination: 'yousite/public_html/',
      // clean: true, // Mirror copy with file deletion
      include: [/* '*.htaccess' */], // Included files to deploy,
      exclude: ['**/Thumbs.db', '**/*.DS_Store'],
      recursive: true,
      archive: true,
      silent: false,
      compress: true,
    }));
}

function startwatch() {
  watch('app/styles/sass/**/*', { usePolling: true }, styles);
  watch(['app/js/**/*.js', '!app/js/**/*.min.js'], { usePolling: true }, scripts);
  watch('app/images/src/**/*', { usePolling: true }, images);
  watch(`app/**/*.{${watchFiles}}`, { usePolling: true }).on('change', browserSync.reload);
}

export {
  scripts, styles, images, deploy,
};
export const assets = series(scripts, styles, images);
export const build = series(cleandist, images, scripts, styles, buildcopy, buildhtml);
export default series(scripts, styles, images, parallel(browserSyncInit, startwatch));
