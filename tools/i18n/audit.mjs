// V2 acceptance: walk 7 main routes in zh, fail on any untranslated miss.
// Run (UI must be up on :8675): node tools/i18n/audit.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const BASE = process.env.BASE || 'http://localhost:8675';
const ROUTES = ['/', '/dashboard', '/jobs', '/jobs/new', '/datasets', '/generate', '/settings'];
const ART_DIR = fileURLToPath(new URL('./artifacts', import.meta.url));
mkdirSync(ART_DIR, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => localStorage.setItem('aitk_lang', 'zh'));

let fail = 0;
const allTemplateHits = new Set();
for (const r of ROUTES) {
  await page.goto(BASE + r, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000); // allow settings fetch + rAF translation passes
  const misses = await page.evaluate(() => window.__i18nMisses || []);
  const hits = await page.evaluate(() => window.__i18nTemplateHits || []);
  hits.forEach(h => allTemplateHits.add(h));
  const safe = r === '/' ? 'index' : r.replace(/\W+/g, '_');
  await page.screenshot({ path: path.join(ART_DIR, `${safe}.zh.png`), fullPage: true });
  console.log(`${r}: misses=${misses.length}`);
  misses.forEach(m => console.log('   MISS:', m));
  if (misses.length) fail = 1;
}
console.log('\n--- template hits (human proofread these) ---');
[...allTemplateHits].sort().forEach(t => console.log('  ', t));
await browser.close();
process.exit(fail);
