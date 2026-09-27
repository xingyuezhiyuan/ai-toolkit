// AST-extract UI copy from ui/src (JSX text, string literals, template skeletons)
// into a base table for dictionary authoring. Run: node tools/i18n/extract.mjs
import { createRequire } from 'module';
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const REPO = path.resolve(__dirname, '..', '..');
const ts = require(path.join(REPO, 'ui', 'node_modules', 'typescript'));

const SRC = path.join(REPO, 'ui', 'src');
// Embedded docs are deliberately phase 2 (ADR-0002) — keep them out of the base table.
const SKIP_FILES = new Set(['docs.tsx']);
// Only collect from positions that can render into the DOM as visible text —
// a string anywhere else (module paths, classNames, config keys) is noise.
const ATTRS = new Set(['placeholder', 'title', 'alt', 'aria-label', 'label', 'instruction']);
const PROP_NAMES = new Set(['title', 'message', 'instruction', 'label', 'text', 'ok', 'cancel']);

const found = new Map(); // trimmed text -> Set(relfile)

const ENTITIES = { '&nbsp;': '\u00a0', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
function decodeEntities(s) {
  return s.replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, m => ENTITIES[m]);
}

function add(raw, file) {
  const t = decodeEntities(raw.trim());
  if (!t || !/[A-Za-z]{2}/.test(t)) return;
  if (!found.has(t)) found.set(t, new Set());
  found.get(t).add(path.relative(REPO, file));
}

function templateToSkeleton(node) {
  // `Upsample (${n})` -> "Upsample (#)"; expressions collapse to '#'
  let out = node.head?.text ?? '';
  const spans = node.templateSpans || [];
  for (const s of spans) {
    out += '#';
    if (s.literal) out += s.literal.text;
  }
  return out;
}

function rendersInDom(node) {
  // string is a JSX attribute value in ATTRS, or a whitelisted object property
  const p = node.parent;
  if (!p) return false;
  if (ts.isJsxAttribute(p) && ATTRS.has(p.name.getText())) return true;
  if (ts.isPropertyAssignment(p)) {
    const n = p.name.getText().replace(/["']/g, '');
    if (PROP_NAMES.has(n)) return true;
  }
  // string (or a branch of a ternary) sitting directly inside JSX children
  let cur = p;
  for (let depth = 0; depth < 3 && cur; depth++) {
    if (ts.isJsxExpression(cur) && cur.parent && ts.isJsxElement(cur.parent)) return true;
    cur = cur.parent;
  }
  return false;
}

function parseFile(file) {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(
    file,
    src,
    ts.ScriptTarget.Latest,
    true,
    /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const visit = node => {
    if (ts.isJsxText(node)) add(node.text, file);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (rendersInDom(node)) add(node.text, file);
    }
    if (ts.isTemplateExpression(node) && rendersInDom(node)) add(templateToSkeleton(node), file);
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

function walkDir(dir) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (e === 'i18n' || e === 'node_modules' || e === '.next' || e.startsWith('__')) continue;
      walkDir(p);
    } else if (/\.tsx?$/.test(e) && !SKIP_FILES.has(e)) parseFile(p);
  }
}

walkDir(SRC);

const strings = [...found.entries()]
  .map(([text, files]) => ({ text, files: [...files] }))
  .sort((a, b) => a.text.localeCompare(b.text));

const outFile = path.join(REPO, 'ui', 'src', 'i18n', 'data', 'extracted.en.json');
mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(
  outFile,
  JSON.stringify({ generatedBy: 'tools/i18n/extract.mjs', count: strings.length, strings }, null, 2)
);
console.log(`extracted ${strings.length} unique strings -> ${path.relative(REPO, outFile)}`);
