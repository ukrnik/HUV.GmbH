// scripts/build.mjs
import { promises as fs } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }

async function copyFile(src, dest) {
    await ensureDir(path.dirname(dest));
    await fs.copyFile(src, dest);
}

async function copyDir(srcDir, destDir) {
    try {
        const entries = await fs.readdir(srcDir, { withFileTypes: true });
        for (const e of entries) {
        const s = path.join(srcDir, e.name);
        const d = path.join(destDir, e.name);
        if (e.isDirectory()) await copyDir(s, d);
        else if (e.isFile()) await copyFile(s, d);
        }
    } catch (e) {
        if (e.code !== 'ENOENT') throw e;
    }
}

function stripComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

async function bundleCss(entry, seen = new Set()) {
  const abs = path.isAbsolute(entry) ? entry : path.join(ROOT, entry);
  if (seen.has(abs)) return '';
  seen.add(abs);
  let css = await fs.readFile(abs, 'utf8');
  // Удаляем комментарии перед разбором @import, чтобы игнорировать закомментированные импорты
  css = stripComments(css);
    const dir = path.dirname(abs);
    const importRe = /@import\s+(?:url\(\s*["']?([^"')]+)["']?\s*\)|["']([^"']+)["'])\s*;/g;
    let out = '';
    let lastIndex = 0; let m;
    while ((m = importRe.exec(css))) {
        out += css.slice(lastIndex, m.index);
        const rel = m[1] || m[2];
        const target = path.resolve(dir, rel);
        out += await bundleCss(target, seen);
        lastIndex = importRe.lastIndex;
    }
    out += css.slice(lastIndex);
    return out;
}

function parseAttrs(attrStr) {
    const attrs = {};
    const re = /([:\\w-]+)\s*=\s*"([\s\S]*?)"|([:\\w-]+)\s*=\s*'([\s\S]*?)'/g;
    let m;
    while ((m = re.exec(attrStr))) {
        const key = (m[1] || m[3])?.trim();
        const val = (m[2] || m[4]) ?? '';
        if (key) attrs[key] = val;
    }
    return attrs;
}

async function inlineLoadsOnce(html, baseDir) {
    // Заменяет один <load ...> за проход, чтобы сохранить управление
    const re = /<load\s+([^>]*?)src=["']([^"']+)["']([^>]*)>\s*<\/load>/i;
    const m = html.match(re);
    if (!m) return html;
    const attrs = { ...parseAttrs(m[1] || ''), ...parseAttrs(m[3] || '') };
    const src = m[2];
    const includePath = path.resolve(baseDir, src);
    let part = await fs.readFile(includePath, 'utf8');
    // плейсхолдеры {{key}}
    part = part.replace(/\{\{\s*([\w:-]+)\s*\}\}/g, (_, key) => attrs[key] ?? '');
    // разрешаем вложенные <load>
    part = await inlineLoads(part, path.dirname(includePath));
    return html.replace(m[0], part);
}

async function inlineLoads(html, baseDir) {
    let current = html;
    let guard = 0;
    while (true) {
        const next = await inlineLoadsOnce(current, baseDir);
        if (next === current) break;
        if (++guard > 200) throw new Error('Too many <load> replacements (possible recursion).');
        current = next;
    }
    return current;
    }

    function tweakPathsForSubdir(html) {
    // Подправляем корневые ссылки на фавиконки/манифест, если деплоим в подпапку
    return html
        .replace(/href="\/(favicon[^"]+)"/g, 'href="./$1"')
        .replace(/href="\/apple-touch-icon\.png"/g, 'href="./apple-touch-icon.png"')
        .replace(/href="\/site\.webmanifest"/g, 'href="./site.webmanifest"');
}

function removeRuntimeLoader(html) {
    // Убрать <script src="./js/main.js"></script>, если он не нужен на проде
    return html.replace(/<script[^>]*src="\.\s*\/js\/main\.js"[^>]*>\s*<\/script>\s*/i, '');
}

async function buildHTML() {
    const entry = path.join(ROOT, 'index.html');
    let html = await fs.readFile(entry, 'utf8');
    html = await inlineLoads(html, ROOT);
    html = tweakPathsForSubdir(html);
    // оставь removeRuntimeLoader(html) если действительно не нужен main.js
    // html = removeRuntimeLoader(html);
    await ensureDir(DIST);
    await fs.writeFile(path.join(DIST, 'index.html'), html, 'utf8');
}

async function buildCSS() {
    const bundled = await bundleCss('css/styles.css');
    const cleaned = stripComments(bundled);
    const out = path.join(DIST, 'css');
    await ensureDir(out);
    await fs.writeFile(path.join(out, 'styles.css'), cleaned, 'utf8');
}

async function copyStatic() {
    // images
    await copyDir(path.join(ROOT, 'img'), path.join(DIST, 'img'));

    // icons & root files
    const rootFiles = [
        'favicon.ico',
        'favicon.svg',
        'favicon-96x96.png',
        'apple-touch-icon.png',
        'web-app-manifest-192x192.png',
        'web-app-manifest-512x512.png',
        'robots.txt',
        'sitemap.xml',
        'sw.js'
    ];
    for (const f of rootFiles) {
        try { await copyFile(path.join(ROOT, f), path.join(DIST, f)); } catch {}
    }

    // site.webmanifest: делаем пути относительными
    try {
        const mfPath = path.join(ROOT, 'site.webmanifest');
        let mf = await fs.readFile(mfPath, 'utf8');
        mf = mf.replace(/"\/(web-app-manifest-[^"]+)"/g, '"./$1"');
        await fs.writeFile(path.join(DIST, 'site.webmanifest'), mf, 'utf8');
    } catch {}

    // js (оставляем, если надо для SW/инициализации)
    await copyDir(path.join(ROOT, 'js'), path.join(DIST, 'js'));

    // серверные/конфиги
    for (const f of ['.htaccess', 'contact.php']) {
        try { await copyFile(path.join(ROOT, f), path.join(DIST, f)); } catch {}
    }
}

async function cleanDist() {
    try { await fs.rm(DIST, { recursive: true, force: true }); } catch {}
    await ensureDir(DIST);
}

async function main() {
    await cleanDist();
    await Promise.all([buildHTML(), buildCSS()]);
    await copyStatic();
    console.log('✅ Build complete →', DIST);
}

main().catch((err) => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});
