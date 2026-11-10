// A página que se conduz: o modelo (lung.js) integrado em tempo real, o tórax (body.js) no estúdio (stage.js) sob o
// console (console.js). Cenários, manobras, PEEP e idade; seis vistas, os modos de exibição, uma órbita que se
// arrasta e um zoom na roda. Deixada em paz, a página percorre um guião com o cursor do operador; qualquer clique,
// arrasto, roda ou tecla entrega o controlo ao visitante, 25 s de mãos quietas devolvem-no.
import {warmComposer} from '../kit/warm.js';
import {G} from './body.js';
import {ACTIONS, createConsole, DISPLAY, SCEN_LABEL, VIEWS} from './console.js';
import {createLung, laplace, SCEN_KEYS, tension, volumes} from './lung.js';
import {createLungStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

const CSS = (top) => `
html,body{background:#f2e6d2;overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.bt{pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.96)}
.hit{position:absolute;pointer-events:auto;cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:150px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:22px;padding:0 11px;border:1px solid #eadfcd;border-radius:4px;background:rgba(252,249,244,.95);color:#2a2521;font:700 9px 'JetBrains Mono',monospace;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#e3562a}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#9b8f80;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

// ------------------------------------------------------------ as vistas (alvo em metros no mundo), u = segundos nela
const AX = G.acinusX;
export const VIEW_FN = {
  hero: (u) => ({tx: 0, ty: 0.04, tz: 0.0, az: 28 + 2 * u, el: 12, d: 1.38, sx: 0, sy: -30}),
  frente: (u) => ({tx: 0, ty: 0.04, tz: 0.0, az: 0 + 1.2 * u, el: 4, d: 1.35, sx: 0, sy: -30}),
  lado: (u) => ({tx: 0, ty: 0.04, tz: 0.0, az: 88 + 1.5 * u, el: 6, d: 1.3, sx: 0, sy: -30}),
  arvore: (u) => ({tx: -0.01, ty: 0.06, tz: 0.0, az: 14 + 3 * u, el: 8, d: 1.05, sx: 0, sy: -30}),
  diafragma: (u) => ({tx: 0, ty: -0.1, tz: 0.02, az: 36 + 2.5 * u, el: -8, d: 1.0, sx: 0, sy: -20}),
  alveolo: (u) => ({tx: AX - 0.01, ty: -0.01, tz: 0, az: 8 + 2 * u, el: 11, d: 1.12, sx: 0, sy: -30}),
};

// ------------------------------------------------------------ o guião do tour: [t, acção]
// acção: {btn} clica um botão; {slider, to} arrasta um deslizador; {reset} volta ao estado inicial
export const SCRIPT = [
  [0.0, {reset: true}],
  [2.6, {btn: 'labels'}],
  [7.5, {btn: 'vidro'}],
  [8.3, {btn: 'arvore'}],
  [14.5, {btn: 'hero'}],
  [15.2, {btn: 'cv'}],
  [27.0, {btn: 'labels'}],
  [27.6, {btn: 'vidro'}],
  [28.4, {btn: 'supino'}],
  [34.5, {btn: 'obeso'}],
  [40.0, {btn: 'lado'}],
  [40.8, {btn: 'gestante'}],
  [46.5, {btn: 'hero'}],
  [47.2, {btn: 'dpoc'}],
  [48.0, {btn: 'vidro'}],
  [55.5, {btn: 'sdra'}],
  [56.3, {btn: 'corte'}],
  [59.0, {slider: 'peep', to: 10}],
  [65.0, {slider: 'peep', to: 0}],
  [65.8, {btn: 'corte'}],
  [66.2, {btn: 'vidro'}],
  [66.7, {btn: 'alveolo'}],
  [69.0, {btn: 'surf'}],
  [76.0, {btn: 'surf'}],
  [78.0, {btn: 'hero'}],
  [78.7, {btn: 'normal'}],
  [79.5, {btn: 'preox'}],
  [83.0, {btn: 'apneia'}],
  [93.0, {btn: 'apneia'}],
  [93.8, {btn: 'preox'}],
  [95.0, {btn: 'orbit'}],
];
export const DURATION = 103;
const REST = [[860, 470], [760, 420], [940, 520], [820, 380]];

export function runLive() {
  const top = Number(document.body.dataset.top || 0);
  const style = document.createElement('style');
  style.textContent = CSS(top);
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createLungStage({canvas});
  const ui = createConsole(app);

  // ------------------------------------------------------------ qualidade
  const TIERS = [
    {samples: 8, ao: true, shadow: 4096, pr: 2},
    {samples: 4, ao: false, shadow: 2048, pr: 1.5},
    {samples: 2, ao: false, shadow: 1024, pr: 1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  const q = new URLSearchParams(location.search).get('q');
  let tier = q != null ? clamp(Number(q), 0, 2) : light ? 2 : 0;
  let scale = 1;
  const fit = () => {
    const h = innerHeight - top;
    scale = Math.min(innerWidth / W, h / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${top + (h - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    st.setQuality(q);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = 'Vire o telemóvel de lado para o console completo';
  document.body.appendChild(note);

  // ------------------------------------------------------------ estado
  let T = 0;
  const L = createLung('normal');
  const cmd = {peep: 0, age: 30, preox: false, surf: true, mode: 'tidal'};
  L.S.V = volumes(L.S.p, 0, 30).CRF;
  let view = 'hero';
  let viewAt0 = 0;
  const disp = Object.fromEntries(DISPLAY.map((k) => [k, {on: k === 'costelas' ? 1 : 0, t: -9}]));
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.hero(0)};
  let ring = {t: -9, x: 0, y: 0};
  const eased = (k, dur = 0.7) => {
    const d = disp[k];
    const x = ss(d.t, d.t + dur, T);
    return d.on ? x : 1 - x;
  };
  const pulse = (k) => (ring = {t: T, x: ui.spots[k][0], y: ui.spots[k][1]});
  const reset = () => {
    L.setScenario('normal');
    Object.assign(cmd, {peep: 0, age: 30, preox: false, surf: true, mode: 'tidal'});
    L.S.V = volumes(L.S.p, 0, 30).CRF;
    L.S.FA = 0.137;
    L.S.FC = 0.056;
    for (const k of DISPLAY) disp[k] = {on: k === 'costelas' ? 1 : 0, t: -9};
    view = 'hero';
    viewAt0 = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };

  // ------------------------------------------------------------ acções (o visitante e o tour usam as mesmas)
  const act = {
    scenario(k) {
      L.setScenario(k);
      cmd.mode = 'tidal';
    },
    cv() {
      if (cmd.mode === 'vc') cmd.mode = 'tidal';
      else {
        L.startVC();
        cmd.mode = 'vc';
      }
    },
    apneia() {
      if (cmd.mode === 'apneia') cmd.mode = 'tidal';
      else {
        L.startApnea();
        cmd.mode = 'apneia';
      }
    },
    preox() {
      cmd.preox = !cmd.preox;
    },
    surf() {
      cmd.surf = !cmd.surf;
    },
    view(v) {
      view = v;
      viewAt0 = T;
      Object.assign(off, {az: 0, el: 0, k: 1});
    },
    display(k) {
      disp[k].on = disp[k].on ? 0 : 1;
      disp[k].t = T;
    },
  };
  const press = (key) => {
    if (SCEN_KEYS.includes(key)) act.scenario(key);
    else if (ACTIONS.includes(key)) act[key]();
    else if (VIEWS.includes(key)) act.view(key);
    else if (DISPLAY.includes(key)) act.display(key);
    pulse(key);
  };

  // ------------------------------------------------------------ o tour
  const AP = {on: true, t0: 0, last: -1};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    AP.last = -1;
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.target !== tourChip) takeOver();
  });
  // o cursor do operador: vai ao botão 0,16 s antes, carrega, descansa
  const SLIDER_SPOT = (k, to) => ui.sliderKnob(k, k === 'peep' ? to / 15 : (to - 20) / 60);
  const WP = [[0, 900, 600]];
  SCRIPT.forEach(([t, a], i) => {
    if (a.reset) return;
    const spot = a.btn ? ui.spots[a.btn] : SLIDER_SPOT(a.slider, a.to);
    if (a.slider) {
      const from = ui.sliderKnob(a.slider, a.slider === 'peep' ? (a.to > 5 ? 0 : 10 / 15) : 0);
      WP.push([t - 0.4, ...from], [t - 0.1, ...from], [t + 0.9, ...spot], [t + 1.2, ...spot]);
    } else WP.push([t - 0.16, ...spot], [t + 0.22, ...spot]);
    WP.push([t + 1.6, ...REST[i % REST.length]]);
  });
  WP.push([DURATION, 900, 600]);
  const cursorAt = (c) => {
    let i = 0;
    while (i < WP.length - 2 && WP[i + 1][0] <= c) i++;
    const [t0, x0, y0] = WP[i];
    const [t1, x1, y1] = WP[i + 1];
    const k = ss(t0, t1, c);
    const ev = SCRIPT.find(([t, a]) => !a.reset && c >= t && c < t + 0.3);
    const rk = ev ? Math.max(0, 1 - (c - ev[0]) / 0.55) : 0;
    const spot = ev ? (ev[1].btn ? ui.spots[ev[1].btn] : SLIDER_SPOT(ev[1].slider, ev[1].to)) : [0, 0];
    return {x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k, press: !!ev && c - ev[0] < 0.12, ring: rk, ringX: spot[0], ringY: spot[1]};
  };
  // um deslizador do tour anda sozinho durante 1 s
  const sliderDrive = (c) => {
    for (const [t, a] of SCRIPT) {
      if (!a.slider) continue;
      if (c >= t && c < t + 1.0) {
        const from = a.slider === 'peep' ? (a.to > 5 ? 0 : 10) : 30;
        cmd[a.slider] = from + (a.to - from) * ss(t, t + 0.9, c);
      }
    }
  };

  // ------------------------------------------------------------ controlos
  for (const k of Object.keys(ui.btn))
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      press(k);
    });
  const slider = (k, lo, hi) => {
    const S = ui.SL[k];
    const d = document.createElement('div');
    d.className = 'hit';
    Object.assign(d.style, {left: `${S.x - 8}px`, top: `${S.y - 11}px`, width: `${S.w + 16}px`, height: '22px'});
    const move = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      cmd[k] = lo + clamp((x - S.x) / S.w, 0, 1) * (hi - lo);
      lastInput = T;
    };
    d.addEventListener('pointerdown', (e) => {
      takeOver();
      d.setPointerCapture(e.pointerId);
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
    ui.root.appendChild(d);
  };
  slider('peep', 0, 15);
  slider('age', 20, 80);
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const map = {1: 'hero', 2: 'frente', 3: 'lado', 4: 'arvore', 5: 'diafragma', 6: 'alveolo', v: 'cv', a: 'apneia', o: 'preox', s: 'surf', r: 'labels', g: 'vidro', c: 'corte', k: 'costelas', b: 'orbit', n: 'normal', d: 'dpoc'};
    const k = map[key];
    if (!k) return;
    takeOver();
    press(k);
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az += ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -30, 60);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.4, 2.4);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ rótulos: pontos no mundo → ecrã
  const LABELS = {
    thorax: [
      {name: 'TRAQUEIA', sub: 'R ∝ 1/r⁴ · 80 % DA RESISTÊNCIA NAS VIAS GRANDES', at: [0, 0.25, -0.028], label: [1100, 196], w: 150},
      {name: 'PULMÃO', sub: 'A MOLA QUE RETRAI · PL = (V − VR)/CL', at: [-0.13, 0.0, 0.045], label: [360, 300], w: 150},
      {name: 'PLEURA', sub: 'ESPAÇO VIRTUAL · Ppl ≈ −5 cmH₂O NA CRF', at: [0.135, 0.02, 0.03], label: [1100, 330], w: 150},
      {name: 'COSTELAS', sub: 'A MOLA QUE EXPANDE · ALÇA DE BALDE', at: [0.15, 0.12, 0.01], label: [1100, 262], w: 150},
      {name: 'DIAFRAGMA', sub: '≈ 1,5 cm POR 0,5 L · O PISTÃO', at: [0.0, -0.145, 0.085], label: [360, 580], w: 150},
      {name: 'BASES', sub: 'FECHAM ABAIXO DA CAPACIDADE DE FECHAMENTO', at: [-0.09, -0.14, 0.03], label: [360, 450], w: 150},
    ],
    acinus: [
      {name: 'BRONQUÍOLO TERMINAL', sub: 'SEM CARTILAGEM · SEGURO PELO PARÊNQUIMA', at: [AX, 0.2, 0], label: [360, 196], w: 170},
      {name: 'ALVÉOLO PEQUENO', sub: '', at: [AX - 0.105, -0.03, 0], label: [360, 300], w: 160},
      {name: 'ALVÉOLO GRANDE', sub: '', at: [AX + 0.135, -0.02, 0.06], label: [1010, 196], w: 160},
      {name: 'CAPILAR', sub: 'O TROCADOR ESTÁ NA PAREDE · SANGUE DO OUTRO LADO', at: [AX + 0.135, -0.145, 0.07], label: [1010, 236], w: 160},
      {name: 'ÁCINO', sub: 'POROS DE KOHN · VENTILAÇÃO COLATERAL', at: [AX - 0.24, -0.13, -0.05], label: [360, 620], w: 160},
    ],
  };

  // ------------------------------------------------------------ o frame
  startTour();
  reset();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.6) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }

    let cursor;
    if (AP.on) {
      const c = (T - AP.t0) % DURATION;
      // dispara as acções do guião pela ordem, uma vez cada
      const idx = SCRIPT.findIndex(([t]) => t > c);
      const upto = idx < 0 ? SCRIPT.length : idx;
      if (upto < AP.last) AP.last = -1; // deu a volta
      for (let i = AP.last + 1; i < upto; i++) {
        const a = SCRIPT[i][1];
        if (a.reset) reset();
        else if (a.btn) press(a.btn);
      }
      AP.last = upto - 1;
      sliderDrive(c);
      cursor = cursorAt(c);
    } else {
      if (T - lastInput > IDLE) startTour();
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
    }
    // o modelo avança; uma manobra acabada volta à respiração corrente; a apneia termina sozinha na dessaturação
    const mode = L.step(dt, cmd);
    if (mode === 'done') cmd.mode = 'tidal';
    const m = L.read(cmd);
    if (cmd.mode === 'apneia' && m.SaO2 < 0.85) cmd.mode = 'tidal';

    // câmara
    const since = T - viewAt0;
    const tgt = VIEW_FN[view](since);
    tgt.az += off.az + (disp.orbit.on ? 12 * (T - disp.orbit.t) : 0);
    tgt.el = clamp(tgt.el + off.el, -25, 88);
    tgt.d *= off.k;
    const k = 1 - Math.exp(-dt / (AP.on ? 0.22 : 0.45));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;

    const acinus = view === 'alveolo' || Math.abs(cam.tx - AX) < 0.8;
    st.frame(
      {V: m.V, inflate: m.inflate, rRel: m.rRel, FA: m.FA, closed: m.closed, glass: eased('vidro'), section: !!disp.corte.on, cage: eased('costelas'), instab: m.instab, acinus, t: T},
      {...cam, az: cam.az * D2R, el: cam.el * D2R},
    );
    // rótulos
    const lab = eased('labels', 0.5) * ss(0.9, 1.5, since);
    const set = view === 'alveolo' ? LABELS.acinus : LABELS.thorax;
    const callouts = set.map((c) => {
      const at = st.project(...c.at);
      let sub = c.sub;
      if (c.name === 'ALVÉOLO PEQUENO' || c.name === 'ALVÉOLO GRANDE') {
        const small = c.name === 'ALVÉOLO PEQUENO';
        const r = small ? 70 * (1 - 0.7 * m.instab) : 100 * (1 + 0.28 * m.instab);
        const Tn = tension(cmd.surf, small ? 0.6 : 1.0);
        sub = `r ${Math.round(r)} µm · T ${Math.round(Tn)} mN/m · P = 2T/r = ${laplace(Tn, r).toFixed(1)} cmH₂O`;
      }
      if (c.name === 'BASES') sub = m.closed > 0.02 ? `${Math.round(m.closed * 100)} % FECHADAS · SHUNT ${Math.round(m.shunt * 100)} %` : `ABERTAS · CRF ${m.CRF.toFixed(2)} > CC ${m.CC.toFixed(2)} L`;
      if (c.name === 'PLEURA') sub = `ESPAÇO VIRTUAL · Ppl ≈ ${(-m.PL).toFixed(1)} cmH₂O AGORA`;
      return {...c, sub, at, o: lab};
    });
    ui.update({m, mode: cmd.mode, apnea: cmd.mode === 'apneia', preox: cmd.preox, surf: cmd.surf, peep: cmd.peep, age: cmd.age, view, display: Object.fromEntries(DISPLAY.map((x) => [x, disp[x].on])), callouts, cursor});
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>TOUR AUTOMÁTICO · CLIQUE PARA ASSUMIR' : '▶ RETOMAR O TOUR';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
  window.LIVE = {st, cam, L, cmd, startTour, takeOver, press, snap: () => Object.assign(cam, VIEW_FN[view](T - viewAt0)), get tier() {
    return tier;
  }, get T() {
    return T;
  }};
  void SCEN_LABEL;
}
