// Revisão da página viva: abre o HTML no Chrome, deixa correr, carrega botões e tira frames.
//   node shot.mjs <html> <out-prefix> [steps...]   step = "wait:2" | "press:dpoc" | "shot:name" | "set:peep=10"
import {chromium} from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const [html, prefix, ...steps] = process.argv.slice(2);
const browser = await chromium.launch({executablePath: process.env.CHROMIUM || undefined, args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--no-sandbox']});
const page = await browser.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: 1});
const errs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text().slice(0, 200)));
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await page.goto('file://' + path.resolve(html) + (process.env.Q ? '?q=' + process.env.Q : ''));
await page.waitForFunction(() => window.SIM_SHOWN, null, {timeout: 60000}).catch(() => errs.push('no first frame'));
console.log('gpu:', await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; }));
for (const s of steps) {
  const [k, v] = s.split(':');
  if (k === 'wait') await page.waitForTimeout(Number(v) * 1000);
  else if (k === 'press') await page.evaluate((key) => { window.LIVE.takeOver(); window.LIVE.press(key); }, v);
  else if (k === 'set') { const [kk, vv] = v.split('='); await page.evaluate(([a, b]) => { window.LIVE.takeOver(); window.LIVE.cmd[a] = Number(b); }, [kk, vv]); }
  else if (k === 'sim') await page.evaluate((sec) => { for (let i = 0; i < sec * 60; i++) { const m = window.LIVE.L.step(1 / 60, window.LIVE.cmd); if (m === 'done') window.LIVE.cmd.mode = 'tidal'; } }, Number(v));
  else if (k === 'snap') await page.evaluate(() => window.LIVE.snap());
  else if (k === 'tour') await page.evaluate(() => window.LIVE.startTour());
  else if (k === 'shot') { const f = `${prefix}-${v}.png`; await page.screenshot({path: f, timeout: 120000}); console.log('wrote', f, 'tier', await page.evaluate(() => window.LIVE.tier), 'T', (await page.evaluate(() => window.LIVE.T)).toFixed(1)); }
}
if (errs.length) console.log('console:', [...new Set(errs)].slice(0, 12).join('\n  '));
await browser.close();
