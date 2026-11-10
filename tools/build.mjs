// Reconstrói reserva-funcional-respiratoria.html a partir de src/pulmao-live com o teardown.
//   node tools/build.mjs            (na raiz do repositório)
// O teardown fica ao lado deste repositório (../teardown); TEARDOWN=/caminho aponta para outro clone.
// A fonte da verdade é src/: a cópia em teardown/sims/pulmao-live é apagada e refeita a cada build.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TD = path.resolve(process.env.TEARDOWN || path.join(ROOT, '..', 'teardown'));
if (!fs.existsSync(path.join(TD, 'sims', 'build.mjs')) || !fs.existsSync(path.join(TD, 'node_modules'))) {
  console.error(`teardown não encontrado ou sem npm install em ${TD}\n` +
    '  git clone https://github.com/elvarofficial/teardown && cd teardown && git config core.autocrlf false && npm install --ignore-scripts');
  process.exit(1);
}

const sim = path.join(TD, 'sims', 'pulmao-live');
fs.rmSync(sim, {recursive: true, force: true});
fs.cpSync(path.join(ROOT, 'src', 'pulmao-live'), sim, {recursive: true});
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

// O HTML embute three.js, o kit do teardown e duas fontes, e o esbuild tira os comentários de licença. As licenças
// MIT e OFL pedem que o aviso acompanhe cada cópia: a deste projeto e as de terceiros vão no fim do <body>, num
// bloco de texto que o navegador não executa.
const notices = ['LICENSE', 'THIRD_PARTY_NOTICES.md'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n\n');
if (/<\/script|<!--/i.test(notices)) throw new Error('os avisos não podem conter </script nem <!--');
const end = html.lastIndexOf('</body>');
if (end < 0) throw new Error('o HTML do teardown mudou: não achei </body>');
html = `${html.slice(0, end)}<script type="text/plain" id="licencas">\n${notices}\n</script>\n${html.slice(end)}`;

const out = path.join(ROOT, 'reserva-funcional-respiratoria.html');
fs.writeFileSync(out, html);
console.log(`${out}  ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
