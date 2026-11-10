// O console, a 1600 x 900: cabeçalho, estado do sistema com a coluna de volumes, espirograma, gases, cenários,
// controles (manobras, PEEP, idade), vistas, exibição, a nota do cenário e a curva pressão–volume com a mola dupla.
// update(s) redesenha tudo a partir do estado do frame. Rótulos com guias apontam para as peças no 3D.
import {SCEN, SCEN_KEYS, PL, Pcw, Prs} from './lung.js';

export const C = {ink: '#2a2521', mute: '#9b8f80', faint: '#d9cdbb', line: '#eadfcd', panel: 'rgba(252,249,244,.95)', or: '#e3562a', green: '#2fa36b', blue: '#3c79a8', red: '#c0392b', pink: '#e39a8c'};
export const VIEWS = ['hero', 'frente', 'lado', 'arvore', 'diafragma', 'alveolo'];
export const VIEW_LABEL = {hero: 'GERAL', frente: 'FRENTE', lado: 'LADO', arvore: 'ÁRVORE', diafragma: 'DIAFRAGMA', alveolo: 'ALVÉOLO'};
export const DISPLAY = ['labels', 'vidro', 'corte', 'costelas', 'orbit'];
export const DISPLAY_LABEL = {labels: 'RÓTULOS', vidro: 'VIDRO', corte: 'CORTE', costelas: 'COSTELAS', orbit: 'ÓRBITA'};
export const ACTIONS = ['cv', 'apneia', 'preox', 'surf'];
export const ACTION_LABEL = {cv: 'CAP. VITAL', apneia: 'APNEIA', preox: 'PRÉ-O₂ 100 %', surf: 'SURFACTANTE'};
export const SCEN_LABEL = {normal: 'NORMAL', supino: 'DECÚBITO', obeso: 'OBESIDADE', gestante: 'GESTANTE', anestesia: 'ANESTESIA', dpoc: 'DPOC', sdra: 'SDRA'};

const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.mo{font-family:'JetBrains Mono',ui-monospace,monospace}
.cp{position:absolute;background:${C.panel};border:1px solid ${C.line};border-radius:6px;box-shadow:0 2px 10px rgba(120,90,50,.08)}
.ph{position:absolute;display:flex;align-items:center;gap:9px;font:700 10.5px 'JetBrains Mono',monospace;letter-spacing:1.8px}
.ph i{display:block;width:3px;height:13px;background:${C.or}}
.pn{position:absolute;font:500 9.5px 'JetBrains Mono',monospace;color:${C.mute};letter-spacing:1px}
.sm{font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.6px;color:${C.mute};text-transform:uppercase;white-space:nowrap}
.bt{position:absolute;height:21px;padding:0 10px;display:flex;align-items:center;justify-content:center;border:1px solid ${C.faint};border-radius:4px;background:#fffdf9;font:700 9.4px 'JetBrains Mono',monospace;letter-spacing:1.3px;color:${C.ink};white-space:nowrap}
.call{position:absolute;white-space:nowrap}
.call b{display:flex;align-items:center;gap:6px;font:700 9.4px 'JetBrains Mono',monospace;letter-spacing:1.3px;color:${C.ink}}
.call b i{display:block;width:6px;height:6px;background:${C.or}}
.call span{display:block;font:500 7.8px 'JetBrains Mono',monospace;letter-spacing:1.2px;color:${C.mute};margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.or};opacity:0;z-index:49}
.kv{position:absolute;font:500 9px 'JetBrains Mono',monospace;letter-spacing:1.4px;color:${C.mute};text-transform:uppercase}
.kv b{display:block;font:600 15px 'JetBrains Mono',monospace;letter-spacing:0;color:${C.ink};margin-top:2px}
.kv b small{font-size:9px;color:${C.mute};margin-left:3px;letter-spacing:1px}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
/** Número para texto em PT-BR: vírgula decimal, sinal de menos tipográfico e nada de «−0,0». Só para texto; as
 *  coordenadas de SVG e CSS continuam com toFixed. */
export const fmt = (x, d) => {
  const s = (Math.abs(x) < 0.5 * 10 ** -d ? 0 : x).toFixed(d);
  return s.replace('.', ',').replace('-', '−');
};
const f1 = (x) => fmt(x, 1);
const f2 = (x) => fmt(x, 2);
const T = (x, y, s, fill = C.mute, extra = '') => `<text x="${x}" y="${y}" font-size="7.6" letter-spacing="1" fill="${fill}" font-family="JetBrains Mono" ${extra}>${s}</text>`;

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };
  const panel = (x, y, w, h, title, n) => {
    add(`<div class="cp" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></div>`);
    add(`<div class="ph" style="left:${x + 14}px;top:${y + 13}px"><i></i>${title}</div>`);
    add(`<div class="pn" style="right:${1600 - x - w + 14}px;top:${y + 15}px">${n}</div>`);
  };
  const kv = (x, y, label) => {
    const n = add(`<div class="kv" style="left:${x}px;top:${y}px">${label}<b></b></div>`);
    return n.querySelector('b');
  };

  // ------------------------------------------------------------ cabeçalho
  add(`<div style="position:absolute;left:0;top:0;width:160px;height:89px;background:${C.or}"></div>`);
  add(`<svg style="position:absolute;left:22px;top:22px" width="60" height="44" viewBox="0 0 60 44"><g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M30 2v12"/><path d="M30 14c-6 0-9 4-12 8s-6 10-6 14c0 4 3 6 7 6s8-3 10-8"/><path d="M30 14c6 0 9 4 12 8s6 10 6 14c0 4-3 6-7 6s-8-3-10-8"/></g></svg>`);
  add(`<div class="mo" style="position:absolute;left:92px;top:33px;color:#fff;font-size:17px;font-weight:600;letter-spacing:3px">CRF</div>`);
  add(`<div class="sm" style="position:absolute;left:182px;top:22px;letter-spacing:2.4px">FISIOLOGIA RESPIRATÓRIA</div>`);
  add(`<div style="position:absolute;left:181px;top:37px;font-size:31px;font-weight:700;letter-spacing:-.6px;line-height:1">Reserva Funcional Respiratória <span style="color:${C.or};font-weight:400">/</span></div>`);
  add(`<div class="mo" style="position:absolute;left:182px;top:77px;font-size:11.2px;letter-spacing:2.2px;color:#6d6357">CAPACIDADE RESIDUAL FUNCIONAL / MODELO DE UM COMPARTIMENTO · MOLA DUPLA</div>`);
  add(`<div class="mo" style="position:absolute;left:1000px;top:49px;letter-spacing:2px;font-size:9.6px;color:${C.mute}">R·Q = Pmus + PEEP − Prs(V)</div>`);
  add(`<div class="mo" style="position:absolute;left:1352px;top:47px;color:${C.or};font-size:12px;letter-spacing:-1px">//////</div>`);
  add(`<div style="position:absolute;left:1418px;top:34px;color:${C.or};font-size:39px;font-weight:700;letter-spacing:-.8px;line-height:1">V<sub style="font-size:18px">CRF</sub></div>`);
  add(`<div style="position:absolute;left:1500px;top:33px;width:1px;height:44px;background:${C.faint}"></div>`);
  add(`<div class="sm" style="position:absolute;left:1516px;top:34px;line-height:14px;letter-spacing:2.2px">RESERVA<br>EQUILÍBRIO<br>TAMPÃO</div>`);

  // ------------------------------------------------------------ 01 estado + coluna de volumes
  panel(28, 126, 282, 254, 'ESTADO DO SISTEMA', '01');
  const chip = add(`<div style="position:absolute;left:42px;top:166px;width:13px;height:24px;border-radius:2px;background:${C.green}"></div>`);
  const stTitle = add(`<div style="position:absolute;left:66px;top:164px;font-size:15px;font-weight:600"></div>`);
  const stSub = add(`<div class="sm" style="position:absolute;left:67px;top:183px"></div>`);
  add(`<div style="position:absolute;left:42px;top:202px;width:254px;height:1px;background:${C.line}"></div>`);
  const col = add(`<svg style="position:absolute;left:42px;top:210px" width="254" height="162"></svg>`);

  // ------------------------------------------------------------ 02 espirograma
  panel(28, 394, 282, 232, 'ESPIROGRAMA · 20 S', '02');
  const spiro = add(`<svg style="position:absolute;left:42px;top:428px" width="254" height="120"></svg>`);
  const kvF = kv(42, 560, 'FREQ');
  const kvVT = kv(112, 560, 'VT REAL');
  const kvTau = kv(188, 560, 'τ = R·C');
  const kvAuto = kv(42, 598, 'AUTO-PEEP');
  const kvCrs = kv(112, 598, 'COMPLAC.');
  const kvR = kv(188, 598, 'RESIST.');

  // ------------------------------------------------------------ 03 gases
  panel(28, 640, 282, 220, 'GÁS ALVEOLAR E SANGUE', '03');
  const gasBars = [['PAO₂', 'mmHg', 0, 700], ['PACO₂', 'mmHg', 0, 80], ['SaO₂', '%', 70, 100], ['FECHADAS', '%', 0, 100]].map((b, i) => {
    const y = 680 + i * 26;
    add(`<div class="sm" style="position:absolute;left:42px;top:${y}px">${b[0]}</div>`);
    add(`<div style="position:absolute;left:112px;top:${y + 4}px;width:112px;height:4px;background:#efe6d8;border-radius:2px"></div>`);
    const f = add(`<div style="position:absolute;left:112px;top:${y + 4}px;height:4px;background:${C.or};border-radius:2px"></div>`);
    const v = add(`<div class="mo" style="position:absolute;right:${1600 - 296}px;top:${y - 2}px;font-size:11px;font-weight:600"></div>`);
    return {f, v, lo: b[2], hi: b[3], unit: b[1]};
  });
  add(`<div style="position:absolute;left:42px;top:790px;width:254px;height:1px;background:${C.line}"></div>`);
  const kvO2 = kv(42, 802, 'O₂ NA CRF');
  const kvApn = kv(132, 802, 'APNEIA');
  const kvFi = kv(222, 802, 'FiO₂');

  // ------------------------------------------------------------ 04 cenário
  const btn = {};
  const btnRow = (keys, labels, x0, y, wmax = 230) => {
    let x = x0;
    let yy = y;
    for (const k of keys) {
      const w = Math.round(labels[k].length * 7.1 + 22);
      if (x + w > x0 + wmax) {
        x = x0;
        yy += 29;
      }
      btn[k] = add(`<div class="bt" style="left:${x}px;top:${yy}px;width:${w}px;height:23px">${labels[k]}</div>`);
      x += w + 6;
    }
    return yy + 29;
  };
  panel(1313, 126, 258, 136, 'CENÁRIO', '04');
  btnRow(SCEN_KEYS, SCEN_LABEL, 1327, 163);

  // ------------------------------------------------------------ 05 controles
  panel(1313, 276, 258, 212, 'CONTROLES', '05');
  btnRow(ACTIONS, ACTION_LABEL, 1327, 313);
  const slider = (y, name, x0 = 1327, w = 150) => {
    add(`<div class="sm" style="position:absolute;left:${x0}px;top:${y - 2}px">${name}</div>`);
    add(`<div style="position:absolute;left:${x0}px;top:${y + 16}px;width:${w}px;height:3px;background:#efe6d8;border-radius:2px"></div>`);
    const fill = add(`<div style="position:absolute;left:${x0}px;top:${y + 16}px;height:3px;background:${C.or};border-radius:2px"></div>`);
    const knob = add(`<div style="position:absolute;top:${y + 10}px;width:15px;height:15px;margin-left:-7.5px;border-radius:50%;background:#fff;border:2px solid ${C.or};box-sizing:border-box"></div>`);
    const val = add(`<div class="mo" style="position:absolute;left:${x0 + w + 14}px;top:${y + 9}px;font-size:11px;font-weight:700"></div>`);
    return {x: x0, w, y: y + 17, fill, knob, val};
  };
  const SL = {peep: slider(392, 'PEEP · CPAP  (cmH₂O)'), age: slider(440, 'IDADE  (anos)')};

  // ------------------------------------------------------------ 06 vistas, 07 exibição
  panel(1313, 502, 258, 107, 'VISTAS', '06');
  btnRow(VIEWS, VIEW_LABEL, 1327, 539, 236); // 236: ALVÉOLO cabe na 2ª linha; numa 3ª sairia do painel
  panel(1313, 623, 258, 107, 'EXIBIÇÃO', '07');
  btnRow(DISPLAY, DISPLAY_LABEL, 1327, 660);

  // ------------------------------------------------------------ 08 nota do cenário
  panel(1313, 744, 258, 116, 'O QUE MUDOU', '08');
  const noteT = add(`<div class="mo" style="position:absolute;left:1327px;top:779px;font-size:10.5px;font-weight:700;letter-spacing:1.4px"></div>`);
  const noteB = add(`<div class="mo" style="position:absolute;left:1327px;top:797px;width:232px;font-size:9.2px;line-height:1.6;color:#5f564b"></div>`);

  // ------------------------------------------------------------ 09 curva pressão–volume e a mola dupla
  panel(430, 740, 740, 120, 'CURVA PRESSÃO–VOLUME · PRESSÃO DE RELAXAMENTO', '09');
  const pv = add(`<svg style="position:absolute;left:444px;top:770px" width="480" height="84"></svg>`);
  add(`<div style="position:absolute;left:936px;top:770px;width:1px;height:78px;background:${C.line}"></div>`);
  const spring = add(`<svg style="position:absolute;left:948px;top:768px" width="210" height="86"></svg>`);

  // ------------------------------------------------------------ rodapé e notas de chão
  add(`<div class="sm" style="position:absolute;left:27px;top:882px;letter-spacing:2.2px">ESTUDO DIRIGIDO &nbsp;·&nbsp; MODELO PROCEDURAL &nbsp;·&nbsp; UMA ÚNICA ENTRADA: A PRESSÃO MUSCULAR</div>`);
  add(`<div class="sm" style="position:absolute;right:28px;top:882px;letter-spacing:2.2px">VALORES DIDÁTICOS · ADULTO ~70 KG <span style="color:${C.or}">//////</span></div>`);
  const notes = add(`<div style="position:absolute;inset:0"></div>`);
  notes.innerHTML = `<div class="sm" style="position:absolute;left:367px;top:690px;line-height:16px;letter-spacing:2px">VISTA ANTERIOR<br>O PACIENTE OLHA PARA VOCÊ</div>
    <svg style="position:absolute;left:398px;top:162px" width="90" height="80"><path d="M0 80V0h80" fill="none" stroke="${C.or}" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/></svg>
    <svg style="position:absolute;left:1088px;top:606px" width="80" height="80"><path d="M80 0v76H0" fill="none" stroke="${C.or}" stroke-width="1" stroke-dasharray="3 3" opacity=".6"/></svg>`;

  // ------------------------------------------------------------ rótulos, o ponteiro
  const callSvg = add(`<svg data-callouts style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div data-callouts style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centre = (n) => {
    const r = n.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centre(n)]));
  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };
  const onBtn = (k, on) => {
    btn[k].style.background = on ? C.or : '#fffdf9';
    btn[k].style.color = on ? '#fff' : C.ink;
    btn[k].style.borderColor = on ? C.or : C.faint;
  };
  let noteKey = '';

  return {
    spots,
    btn,
    root: ui,
    SL,
    sliderKnob: (k, u) => [SL[k].x + u * SL[k].w, SL[k].y],
    update(s) {
      const m = s.m; // leitura do modelo
      const p = m.p;
      // estado
      const moving = m.phaseName.startsWith('INSP') || m.phaseName.startsWith('EXP');
      chip.style.background = m.phaseName === 'APNEIA' ? C.red : moving ? C.or : C.green;
      stTitle.textContent = (m.phaseName.charAt(0) + m.phaseName.slice(1).toLowerCase()).replace(/\bcrf\b/, 'CRF');
      stSub.textContent = `${SCEN[m.key].name.toUpperCase()} · V ${f2(m.V)} L`;
      // a coluna de volumes: CPT no topo, zero em baixo; as faixas VRI / VC / VRE / VR, a CRF, a CC e o marcador
      {
        const H = 150;
        const top = 6;
        const VMAX = p.TLC > 6 ? 8 : p.TLC > 4 ? 6 : 4;
        const Y = (v) => top + H * (1 - v / VMAX);
        const x0 = 60;
        const w = 46;
        const band = (a, b, fill, name, sub, dy = 0) => `<rect x="${x0}" y="${Y(b).toFixed(1)}" width="${w}" height="${Math.max(0, Y(a) - Y(b)).toFixed(1)}" fill="${fill}"/>` + T(x0 + w + 8, (Y(a) + Y(b)) / 2 + 3 + dy, `${name} ${sub}`, C.ink);
        const crf = m.CRF;
        let h = '';
        h += band(0, p.RV, '#d9cdbb', 'VR', `${f1(p.RV)} L`);
        h += band(p.RV, crf, '#efc7b9', 'VRE', `${f1(crf - p.RV)} L`, crf - p.RV < 0.9 ? 6 : 0);
        // em transição o VT real é null: a faixa usa o alvo e o rótulo mostra «—»
        const vt = m.VTreal ?? p.VT;
        h += band(crf, Math.min(p.TLC, crf + vt), C.or, 'VC', m.VTreal == null ? '—' : `${f2(m.VTreal)} L`, -5);
        h += band(Math.min(p.TLC, crf + vt), p.TLC, '#f5dccf', 'VRI', `${f1(Math.max(0, p.TLC - crf - vt))} L`);
        // escala
        for (let v = 0; v <= VMAX; v += VMAX > 4 ? 2 : 1) h += `<line x1="${x0 - 6}" x2="${x0 - 2}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.mute}" stroke-width="1"/>` + T(x0 - 26, Y(v) + 3, `${v} L`);
        // CPT, CRF e CC
        h += `<line x1="${x0 - 2}" x2="${x0 + w + 2}" y1="${Y(p.TLC)}" y2="${Y(p.TLC)}" stroke="${C.ink}" stroke-width="1.2"/>` + T(x0 + w + 92, Y(p.TLC) + 3, `CPT ${f1(p.TLC)}`, C.ink);
        h += `<line x1="${x0 - 8}" x2="${x0 + w + 4}" y1="${Y(crf)}" y2="${Y(crf)}" stroke="${C.or}" stroke-width="1.4"/><line x1="${x0 + w + 80}" x2="${x0 + w + 88}" y1="${Y(crf)}" y2="${Y(crf)}" stroke="${C.or}" stroke-width="1.4"/>` + T(x0 + w + 92, Y(crf) + 3, `CRF ${f2(crf)}`, C.or);
        const ccY = Y(m.CC) + (Math.abs(m.CC - crf) < 0.45 ? (m.CC < crf ? 11 : -8) : 3);
        h += `<line x1="${x0 - 8}" x2="${x0 + w + 4}" y1="${Y(m.CC)}" y2="${Y(m.CC)}" stroke="${C.blue}" stroke-width="1.2" stroke-dasharray="3 3"/><line x1="${x0 + w + 80}" x2="${x0 + w + 88}" y1="${Y(m.CC)}" y2="${Y(m.CC)}" stroke="${C.blue}" stroke-width="1.2"/>` + T(x0 + w + 92, ccY, `CC ${f2(m.CC)}`, C.blue);
        // o volume agora
        const yv = Y(m.V);
        h += `<polygon points="${x0 - 14},${yv - 5} ${x0 - 4},${yv} ${x0 - 14},${yv + 5}" fill="${C.ink}"/>`;
        h += `<rect x="${x0 + 1}" y="${(yv - 1).toFixed(1)}" width="${w - 2}" height="2" fill="${C.ink}"/>`;
        col.innerHTML = h;
      }
      // espirograma: o traço dos últimos 20 s, CRF estática, CC
      {
        const W = 254;
        const H = 120;
        const vmin = Math.max(0, p.RV - 0.25);
        const vmax = p.TLC + 0.1;
        const Y = (v) => 4 + (H - 8) * (1 - (v - vmin) / (vmax - vmin));
        const N = m.trace.length;
        let d = '';
        for (let i = 0; i < N; i += 2) {
          const j = (m.ti + i) % N;
          const v = m.trace[j];
          if (v === 0) continue;
          d += `${d ? 'L' : 'M'}${((i / N) * W).toFixed(1)} ${Y(v).toFixed(1)}`;
        }
        let h = `<line x1="0" x2="${W}" y1="${Y(m.CRF)}" y2="${Y(m.CRF)}" stroke="${C.or}" stroke-width="1" stroke-dasharray="4 3"/>`;
        h += `<line x1="0" x2="${W}" y1="${Y(m.CC)}" y2="${Y(m.CC)}" stroke="${C.blue}" stroke-width="1" stroke-dasharray="2 3"/>`;
        h += `<line x1="0" x2="${W}" y1="${Y(p.TLC)}" y2="${Y(p.TLC)}" stroke="${C.faint}" stroke-width="1"/>`;
        h += `<line x1="0" x2="${W}" y1="${Y(p.RV)}" y2="${Y(p.RV)}" stroke="${C.faint}" stroke-width="1"/>`;
        h += T(2, Y(p.TLC) + 9, 'CPT') + T(2, Y(p.RV) - 3, 'VR') + T(W - 42, Y(m.CRF) - 3, 'CRF est.', C.or) + T(W - 20, Y(m.CC) + 9, 'CC', C.blue);
        h += `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="1.4"/>`;
        const vx = W - 1;
        h += `<circle cx="${vx}" cy="${Y(m.V)}" r="2.6" fill="${C.or}"/>`;
        spiro.innerHTML = h;
        kvF.innerHTML = `${p.RR}<small>rpm</small>`;
        kvVT.innerHTML = m.VTreal == null ? '—' : `${f2(m.VTreal)}<small>L</small>`;
        kvTau.innerHTML = `${f2(m.tau)}<small>s</small>`;
        kvAuto.innerHTML = m.autoPeep == null ? '—' : `${f1(m.autoPeep)}<small>cmH₂O</small>`;
        kvCrs.innerHTML = `${Math.round(m.Crs * 1000)}<small>mL/cmH₂O</small>`;
        kvR.innerHTML = `${f1(p.R)}<small>cmH₂O/L/s</small>`;
      }
      // gases
      {
        const vals = [m.PAO2, m.PACO2, m.SaO2 * 100, m.closed * 100];
        const txt = [`${Math.round(m.PAO2)} mmHg`, `${Math.round(m.PACO2)} mmHg`, `${f1(m.SaO2 * 100)} %`, `${Math.round(m.closed * 100)} %`];
        gasBars.forEach((b, i) => {
          const u = Math.min(1, Math.max(0, (vals[i] - b.lo) / (b.hi - b.lo)));
          b.f.style.width = `${(u * 112).toFixed(1)}px`;
          b.v.textContent = txt[i];
          b.f.style.background = i === 2 ? (m.SaO2 < 0.9 ? C.red : C.green) : i === 3 ? C.blue : C.or;
        });
        kvO2.innerHTML = `${Math.round(m.FA * m.V * 1000)}<small>mL</small>`;
        kvApn.innerHTML = s.apnea ? `${Math.round(m.apneaT)}<small>s</small>` : `—`;
        kvFi.innerHTML = s.preox ? `1,00` : `0,21`;
      }
      // botões
      for (const k of SCEN_KEYS) onBtn(k, m.key === k);
      onBtn('cv', s.mode === 'vc');
      onBtn('apneia', s.mode === 'apneia');
      onBtn('preox', !!s.preox);
      onBtn('surf', !!s.surf);
      for (const k of VIEWS) onBtn(k, s.view === k);
      for (const k of DISPLAY) onBtn(k, !!s.display[k]);
      // sliders
      const sl = (k, u, text) => {
        const S = SL[k];
        S.fill.style.width = `${(u * S.w).toFixed(1)}px`;
        S.knob.style.left = `${(S.x + u * S.w).toFixed(1)}px`;
        S.val.textContent = text;
      };
      sl('peep', s.peep / 15, `${Math.round(s.peep)}`);
      sl('age', (s.age - 20) / 60, `${Math.round(s.age)}`);
      // nota
      if (noteKey !== m.key) {
        noteKey = m.key;
        noteT.textContent = SCEN[m.key].sub;
        noteB.textContent = SCEN[m.key].note;
      }
      // curva P–V: V no eixo x, pressão no y; PL tracejada, Pcw tracejada em azul, Prs contínua; o ponto atual
      {
        const W = 480;
        const H = 84;
        const x0 = 26;
        const X = (v) => x0 + ((v - 0) / 8.0) * (W - x0 - 4);
        const Yp = (P) => 42 - (P / 40) * 36;
        let h = `<line x1="${x0}" x2="${W}" y1="${Yp(0)}" y2="${Yp(0)}" stroke="${C.faint}" stroke-width="1"/>`;
        h += `<line x1="${x0}" x2="${x0}" y1="4" y2="80" stroke="${C.faint}" stroke-width="1"/>`;
        for (let v = 0; v <= 8; v += 2) h += T(X(v) - 4, 82, `${v}`);
        for (const P of [-20, 0, 20, 40]) h += T(0, Yp(P) + 3, `${P > 0 ? '+' : ''}${fmt(P, 0)}`);
        const path = (fn, col, dash, wdt = 1.2) => {
          let d = '';
          for (let i = 0; i <= 60; i++) {
            const v = p.RV + ((p.TLC - p.RV) * i) / 60;
            const P = Math.max(-45, Math.min(60, fn(v)));
            d += `${d ? 'L' : 'M'}${X(v).toFixed(1)} ${Yp(P).toFixed(1)}`;
          }
          return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${wdt}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
        };
        h += path((v) => PL(p, v), C.red, '4 3');
        h += path((v) => Pcw(p, v), C.blue, '4 3');
        h += path((v) => Prs(p, v), C.ink, '', 1.6);
        // PEEP e CRF
        if (s.peep > 0.1) h += `<line x1="${x0}" x2="${W}" y1="${Yp(s.peep)}" y2="${Yp(s.peep)}" stroke="${C.or}" stroke-width="1" stroke-dasharray="2 3"/>` + T(W - 60, Yp(s.peep) - 3, `PEEP ${Math.round(s.peep)}`, C.or);
        h += `<line x1="${X(m.CRF)}" x2="${X(m.CRF)}" y1="18" y2="78" stroke="${C.or}" stroke-width="1" stroke-dasharray="3 3"/>` + T(X(m.CRF) + 4, 28, 'CRF', C.or);
        h += `<line x1="${X(m.CC)}" x2="${X(m.CC)}" y1="60" y2="78" stroke="${C.blue}" stroke-width="1" stroke-dasharray="2 3"/>` + T(X(m.CC) + 4, 76, 'CC', C.blue);
        h += `<circle cx="${X(m.V)}" cy="${Yp(Math.max(-45, Math.min(60, m.Prs)))}" r="4" fill="${C.or}" stroke="#fff" stroke-width="1.2"/>`;
        h += T(X(5.4), 14, 'PL pulmão', C.red) + T(X(5.4), 76, 'Pcw caixa', C.blue) + T(X(6.8), 46, 'Prs sistema', C.ink);
        h += T(x0 + 8, 14, `V ${f2(m.V)} L · Prs ${m.Prs >= 0 ? '+' : ''}${f1(m.Prs)} cmH₂O · PL ${f1(m.PL)} · Pcw ${f1(m.Pcw)}`, C.ink);
        pv.innerHTML = h;
      }
      // a mola dupla: o pulmão (comprimido, quer encolher) e a caixa (esticada, quer abrir), presos pela pleura
      {
        const u = Math.min(1, Math.max(0, (m.V - p.RV) / (p.TLC - p.RV)));
        const xP = 30 + 150 * u; // a posição da pleura
        const coil = (xa, xb, y, n, col) => {
          let d = `M${xa} ${y}`;
          const step = (xb - xa) / (n * 2);
          for (let i = 0; i < n * 2; i++) d += ` L${(xa + step * (i + 0.5)).toFixed(1)} ${y + (i % 2 ? -7 : 7)}`;
          d += ` L${xb} ${y}`;
          return `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round"/>`;
        };
        let h = T(0, 10, 'MOLA DUPLA · EQUILÍBRIO NA CRF', C.ink);
        h += `<line x1="4" x2="4" y1="22" y2="62" stroke="${C.ink}" stroke-width="2"/>`; // parede: o esterno/coluna
        h += coil(4, xP, 34, 7, C.red) + T(6, 72, 'pulmão ← retrai', C.red);
        h += coil(xP, 200, 50, 7, C.blue) + T(118, 72, 'caixa → expande', C.blue);
        h += `<line x1="200" x2="200" y1="22" y2="62" stroke="${C.ink}" stroke-width="2"/>`;
        h += `<rect x="${xP - 3}" y="24" width="6" height="36" fill="${C.or}"/>`;
        h += T(xP - 16, 20, 'PLEURA', C.or);
        const xF = 30 + 150 * Math.min(1, Math.max(0, (m.CRF - p.RV) / (p.TLC - p.RV)));
        h += `<line x1="${xF}" x2="${xF}" y1="58" y2="66" stroke="${C.or}" stroke-width="1" stroke-dasharray="2 2"/>`;
        h += T(176, 10, `Ppl ${f1(m.Ppl)}`, C.mute);
        spring.innerHTML = h;
      }
      // rótulos com guias
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = lx > ax;
        const ex = right ? lx - 6 : lx + c.w + 6;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${(ly + 6).toFixed(1)}" fill="none" stroke="${C.or}" stroke-width=".9" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.4" fill="${C.or}" opacity="${c.o.toFixed(2)}"/>`;
        ch += `<div class="call" style="left:${lx.toFixed(1)}px;top:${(ly - 1).toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b><i></i>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
    pointer,
  };
}
