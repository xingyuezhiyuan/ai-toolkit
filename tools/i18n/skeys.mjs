// helper: print exact skeleton keys for the multi-line extracted strings
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NUM_RE = /\d[\d,]*(?:\.\d+)?/g;
function sk(t) {
  return t
    .replace(/"[^"]*"/g, '"#"')
    .replace(NUM_RE, '#')
    .replace(/\s+/g, ' ')
    .trim();
}
const d = JSON.parse(
  readFileSync(path.join(__dirname, '..', '..', 'ui', 'src', 'i18n', 'data', 'extracted.en.json'), 'utf8')
);
for (const i of [2, 6]) {
  console.log('===', i, '===');
  console.log(JSON.stringify(sk(d.strings[i].text)));
}
