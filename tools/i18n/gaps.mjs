// helper: print all coverage gaps (extracted strings missing from zh dictionary)
// Loads the real dictionary modules (via TypeScript transpile) so the report
// matches ui/src/i18n/__tests__/coverage.test.ts exactly.
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { createRequire } from 'module';
import { tmpdir } from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');
const DATA = path.join(REPO, 'ui', 'src', 'i18n', 'data');
const require = createRequire(import.meta.url);
const ts = require(path.join(REPO, 'ui', 'node_modules', 'typescript'));

const dir = mkdtempSync(path.join(tmpdir(), 'aitk-i18n-'));
const transpile = (src, name) => {
  const js = ts.transpileModule(readFileSync(src, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const out = path.join(dir, `${name}.mjs`);
  writeFileSync(out, js.replace(/from '\.\/docs\.zh'/g, "from './docs.zh.mjs'"));
  return pathToFileURL(out).href;
};

transpile(path.join(DATA, 'docs.zh.ts'), 'docs.zh');
const zh = (await import(transpile(path.join(DATA, 'zh.ts'), 'zh'))).default;

const extracted = JSON.parse(readFileSync(path.join(DATA, 'extracted.en.json'), 'utf8'));
const NUM_RE = /\d[\d,]*(?:\.\d+)?/g;
const sk = t => t.replace(/"[^"]*"/g, '"#"').replace(NUM_RE, '#').replace(/\s+/g, ' ').trim();
const allow = new Set(zh.allowEnglish);
const missing = extracted.strings
  .map(s => s.text)
  .filter(t => {
    const k = sk(t);
    return zh.exact[t] === undefined && zh.templates[k] === undefined && !allow.has(t) && !allow.has(k);
  });

console.log('missing', missing.length);
missing.forEach(t => console.log(JSON.stringify(t)));
