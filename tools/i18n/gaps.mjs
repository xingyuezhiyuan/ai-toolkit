// helper: print all coverage gaps (extracted strings missing from zh dictionary)
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..', '..');

const NUM_RE = /\d[\d,]*(?:\.\d+)?/g;
function sk(t) {
  return t
    .replace(/"[^"]*"/g, '"#"')
    .replace(NUM_RE, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

const extracted = JSON.parse(
  readFileSync(path.join(REPO, 'ui', 'src', 'i18n', 'data', 'extracted.en.json'), 'utf8')
);
// crude parse of zh.ts maps — enough for gap listing (keys are quoted strings)
const zhSrc = readFileSync(path.join(REPO, 'ui', 'src', 'i18n', 'data', 'zh.ts'), 'utf8');
const exactBlock = zhSrc.slice(zhSrc.indexOf('exact: {'), zhSrc.indexOf('templates: {'));
const tplBlock = zhSrc.slice(zhSrc.indexOf('templates: {'), zhSrc.indexOf('allowEnglish: ['));
const allowBlock = zhSrc.slice(zhSrc.indexOf('allowEnglish: ['));
const keys = block => {
  const out = new Set();
  let m;
  const reI = /(?:^|[\s,{])([A-Za-z_$][\w$]*)\s*:/g; // bare identifier keys
  while ((m = reI.exec(block))) out.add(m[1]);
  const re = /'((?:[^'\\]|\\.)*)'\s*:/g;
  while ((m = re.exec(block))) out.add(m[1]);
  const reD = /"((?:[^"\\]|\\.)*)"\s*:/g; // double-quoted keys (e.g. strings containing ')
  while ((m = reD.exec(block))) out.add(m[1]);
  return out;
};
const allowVals = new Set();
{
  const re = /'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(allowBlock))) allowVals.add(m[1] ?? m[2]);
}
const exactKeys = keys(exactBlock);
const tplKeys = keys(tplBlock);

const missing = extracted.strings
  .map(s => s.text)
  .filter(t => !exactKeys.has(t) && !tplKeys.has(sk(t)) && !allowVals.has(t) && !allowVals.has(sk(t)));
console.log('missing', missing.length);
missing.forEach(t => console.log(JSON.stringify(t)));
