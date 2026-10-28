/** Compile Tailwind utility classes used by one PWA into a local offline stylesheet.
 * Run: node scripts/generate_tailwind_css.mjs public/modules-staging/tungkinh/index.html public/modules-staging/tungkinh/vendor/tailwind.css
 * Requires tailwindcss 4.x installed by npm install.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { compile } from 'tailwindcss';
const require = createRequire(import.meta.url);
const [, , htmlPath, cssPath] = process.argv;
if (!htmlPath || !cssPath) throw Error('Usage: node generate_tailwind_css.mjs <html> <css>');
const html = fs.readFileSync(htmlPath, 'utf8');
const candidates = new Set();
const classAttrs = /\bclass\s*=\s*["']([^"']+)["']/gi;
for (const match of html.matchAll(classAttrs)) for (const x of match[1].split(/\s+/)) if (x) candidates.add(x);
// Additional classes assigned by JavaScript code, rather than existing in HTML markup.
for (const match of html.matchAll(/\bclassList\.(?:add|remove|toggle)\s*\(([^)]*)\)/gi)) {
  for (const str of match[1].matchAll(/["']([^"']+)["']/g)) candidates.add(str[1]);
}
for (const match of html.matchAll(/\.className\s*=\s*["']([^"']+)["']/gi)) {
  for (const x of match[1].split(/\s+/)) if (x) candidates.add(x);
}
const tailwindRoot = path.dirname(require.resolve('tailwindcss/package.json'));
const result = await compile('@import "tailwindcss";', {
  loadStylesheet: async (id) => {
    const target = path.resolve(tailwindRoot, id === 'tailwindcss' ? 'index.css' : id);
    if (!target.startsWith(tailwindRoot + path.sep)) throw Error(`Invalid Tailwind import: ${id}`);
    return { content: fs.readFileSync(target, 'utf8'), base: tailwindRoot };
  }
});
const css = result.build([...candidates]);
fs.mkdirSync(path.dirname(cssPath), { recursive: true });
fs.writeFileSync(cssPath, css);
console.log(`Tailwind offline: ${candidates.size} candidates, ${css.length} bytes`);
