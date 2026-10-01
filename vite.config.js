import { defineConfig } from 'vite';
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Gera dist/sw.js com a lista de arquivos do build para funcionar offline.
function serviceWorker() {
  const publicDir = path.resolve('public');
  const listPublic = (dir, prefix = '') => readdirSync(dir).flatMap(f => {
    const full = path.join(dir, f);
    return statSync(full).isDirectory() ? listPublic(full, prefix + f + '/') : [prefix + f];
  });
  return {
    name: 'quetzal-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle)
        .filter(f => !f.endsWith('.map') && !f.endsWith('.woff')) // .woff só é usado em navegadores muito antigos
        .concat(listPublic(publicDir).filter(f => f !== '_headers'));
      const files = ['./', ...assets.filter(f => f !== 'index.html').map(f => './' + f)];
      const version = createHash('sha256').update(files.join('\n') + Object.values(bundle).map(c => c.code || c.source || '').join('')).digest('hex').slice(0, 12);
      const template = readFileSync(path.resolve('src/sw-template.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(files)),
      });
    },
    // A CSP do _headers precisa do hash do script inline do index.html (aplicação do tema).
    writeBundle(opts) {
      const dir = opts.dir || 'dist';
      const headers = path.join(dir, '_headers');
      if (!existsSync(headers)) return;
      const html = readFileSync(path.join(dir, 'index.html'), 'utf8');
      const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
      const hashes = inline.map(code => `'sha256-${createHash('sha256').update(code).digest('base64')}'`).join(' ');
      writeFileSync(headers, readFileSync(headers, 'utf8').replace("'sha256-__THEME_HASH__'", hashes));
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
  plugins: [serviceWorker()],
  test: {
    include: ['test/**/*.test.js'],
  },
});
