// Reconstrói reserva-funcional-respiratoria.html a partir de src/pulmao-live com o teardown.
//   node crf/tools/build.mjs
// O teardown fica ao lado do repositório (C:\kdbnetworks\teardown); TEARDOWN=/caminho aponta para outro clone.
// A fonte da verdade é crf/src/: a cópia em teardown/sims/pulmao-live é apagada e refeita a cada build.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const CRF = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TD = path.resolve(process.env.TEARDOWN || path.join(CRF, '..', '..', 'teardown'));
if (!fs.existsSync(path.join(TD, 'sims', 'build.mjs')) || !fs.existsSync(path.join(TD, 'node_modules'))) {
  console.error(`teardown não encontrado ou sem npm install em ${TD}\n` +
    '  git clone https://github.com/elvarofficial/teardown && cd teardown && git config core.autocrlf false && npm install --ignore-scripts');
  process.exit(1);
}

const sim = path.join(TD, 'sims', 'pulmao-live');
fs.rmSync(sim, {recursive: true, force: true});
fs.cpSync(path.join(CRF, 'src', 'pulmao-live'), sim, {recursive: true});
execFileSync(process.execPath, ['sims/build.mjs', 'pulmao-live'], {cwd: TD, stdio: 'inherit'});

// o build.mjs do teardown grava lang="en" e o nome da pasta como título
const PATCH = [
  ['<html lang="en">', '<html lang="pt-BR">'],
  ['<title>pulmao-live</title>', '<title>Reserva Funcional Respiratória</title>'],
];
let html = fs.readFileSync(path.join(TD, 'teardown-out', 'dist', 'pulmao-live.html'), 'utf8');
for (const [from, to] of PATCH) {
  if (!html.includes(from)) throw new Error(`o HTML do teardown mudou: não achei ${from}`);
  html = html.replace(from, to);
}
const out = path.join(CRF, 'reserva-funcional-respiratoria.html');
fs.writeFileSync(out, html);
console.log(`${out}  ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
