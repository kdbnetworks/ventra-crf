// O modelo. Um compartimento: o pulmão e a caixa torácica como duas molas em série, um único input (a pressão
// muscular Pmus) e todo o resto — volume, fluxo, CRF, pressões, gases alveolares, fechamento de vias aéreas — como
// função dele. Sem three.js aqui. Unidades: L, cmH2O, s, mmHg. Valores didáticos de um adulto de ~70 kg.

export const PB = 760; // pressão barométrica, mmHg
export const PH2O = 47; // vapor d'água a 37 °C
export const VD = 0.15; // espaço morto anatómico, L

// Cada cenário muda só parâmetros. CRF, VT real, tau e tudo o mais saem da mesma equação.
//   TLC/RV: capacidade pulmonar total e volume residual (L)
//   CL/Ccw: complacência do pulmão e da caixa torácica (L/cmH2O)
//   V0cw: volume de repouso da caixa torácica (onde a caixa não puxa nem empurra)
//   R: resistência das vias aéreas (cmH2O/L/s)
//   VT/RR: volume corrente alvo (L) e frequência (rpm)
//   CCadd: deslocamento da capacidade de fechamento (L)
//   VO2/VCO2: consumo e produção (mL/min)
export const SCEN = {
  normal: {name: 'Adulto jovem · em pé', sub: 'REFERÊNCIA', TLC: 5.8, RV: 1.2, CL: 0.2, Ccw: 0.2, V0cw: 3.4, R: 2.0, VT: 0.5, RR: 12, CCadd: 0, VO2: 250, VCO2: 200,
    note: 'Pulmão e caixa torácica em equilíbrio a ~40 % da CPT. A reserva está longe da capacidade de fechamento.'},
  supino: {name: 'Decúbito dorsal', sub: 'VÍSCERAS SOBRE O DIAFRAGMA', TLC: 5.8, RV: 1.2, CL: 0.2, Ccw: 0.2, V0cw: 2.6, R: 2.0, VT: 0.5, RR: 12, CCadd: 0, VO2: 250, VCO2: 200,
    note: 'O conteúdo abdominal empurra o diafragma para cima: a caixa descansa num volume menor e a CRF cai 0,4 a 0,5 L.'},
  obeso: {name: 'Obesidade · deitado', sub: 'CAIXA PESADA E RÍGIDA', TLC: 5.4, RV: 1.2, CL: 0.2, Ccw: 0.1, V0cw: 2.2, R: 3.0, VT: 0.5, RR: 16, CCadd: 0, VO2: 330, VCO2: 270,
    note: 'Massa sobre o tórax e o abdómen: a caixa fica rígida e descansa baixo. A CRF cai para perto da capacidade de fechamento.'},
  gestante: {name: 'Gestação · 3º trimestre', sub: 'ÚTERO ELEVA O DIAFRAGMA', TLC: 5.6, RV: 1.0, CL: 0.2, Ccw: 0.15, V0cw: 2.3, R: 2.0, VT: 0.65, RR: 14, CCadd: 0, VO2: 300, VCO2: 240,
    note: 'Diafragma ~4 cm mais alto, CRF menor e consumo de O2 ~20 % maior: a reserva esgota-se em metade do tempo.'},
  anestesia: {name: 'Anestesia geral', sub: 'SEM TÓNUS · DEITADO', TLC: 5.6, RV: 1.2, CL: 0.15, Ccw: 0.2, V0cw: 2.4, R: 2.5, VT: 0.45, RR: 12, CCadd: 0.2, VO2: 220, VCO2: 180,
    note: 'Perda do tónus muscular, diafragma cefálico e atelectasia nas bases: −15 a 20 % além do decúbito, em minutos.'},
  dpoc: {name: 'DPOC · enfisema', sub: 'PERDA DE RETRAÇÃO', TLC: 7.6, RV: 3.0, CL: 0.4, Ccw: 0.2, V0cw: 3.4, R: 12, VT: 0.45, RR: 15, CCadd: 0.2, VO2: 260, VCO2: 210,
    note: 'Pulmão complacente demais e vias aéreas estreitas: tau longo, expiração incompleta, CRF dinâmica acima da estática.'},
  sdra: {name: 'SDRA', sub: '"BABY LUNG"', TLC: 3.5, RV: 1.0, CL: 0.05, Ccw: 0.2, V0cw: 2.6, R: 4.0, VT: 0.4, RR: 24, CCadd: 0.6, VO2: 300, VCO2: 240,
    note: 'Alvéolos inundados ou colapsados deixam de contar: pulmão pequeno e rígido, CRF a um terço do normal, shunt.'},
};
export const SCEN_KEYS = Object.keys(SCEN);

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const pow10 = (x) => {
  const u = clamp(x, 0, 1);
  const u2 = u * u;
  const u5 = u2 * u2 * u;
  return u5 * u5;
};

/** Pressão de retração elástica do pulmão (cmH2O) no volume V: linear, endurecendo perto da CPT. */
export const PL = (p, V) => (V - p.RV) / p.CL + 25 * pow10((V - p.RV) / (p.TLC - p.RV));
/** Pressão de relaxamento da caixa torácica: negativa abaixo de V0cw (quer expandir), rígida perto do VR. */
export const Pcw = (p, V) => (V - p.V0cw) / p.Ccw - 15 * pow10(1 - (V - p.RV) / (p.TLC - p.RV));
/** Pressão de relaxamento do sistema respiratório: zero na CRF estática (ou igual à PEEP, com PEEP). */
export const Prs = (p, V) => PL(p, V) + Pcw(p, V);
/** Complacência do sistema (L/cmH2O) e constante de tempo (s) na faixa linear. */
export const Crs = (p) => 1 / (1 / p.CL + 1 / p.Ccw);
export const tau = (p) => p.R * Crs(p);

/** CRF estática: o volume em que Prs = PEEP, por bissecção. */
export const frcStatic = (p, peep = 0) => {
  let a = p.RV;
  let b = p.TLC;
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2;
    if (Prs(p, m) - peep > 0) b = m;
    else a = m;
  }
  return (a + b) / 2;
};
/** Capacidade de fechamento (L): sobe com a idade; vias aéreas das bases fecham abaixo dela. */
export const closingCap = (p, age) => p.RV + 0.25 + 0.019 * (age - 20) + p.CCadd;
/** Fração das unidades dependentes com vias aéreas fechadas no volume V. */
export const closedFrac = (p, V, age) => {
  const cc = closingCap(p, age);
  return clamp((cc - V) / Math.max(0.2, cc - p.RV), 0, 1);
};
/** Saturação da hemoglobina (Hill, P50 26,8 mmHg, n 2,7) para uma PO2 em mmHg. */
export const sat = (po2) => {
  const x = Math.pow(Math.max(0, po2) / 26.8, 2.7);
  return x / (1 + x);
};
/** Lei de Laplace: pressão (cmH2O) para manter uma bolha de raio r (µm) com tensão T (mN/m). */
export const laplace = (T, r) => (2 * T) / r * 10.2;
/** Tensão superficial da interface alveolar: com surfactante cai quase a zero quando o alvéolo encolhe. */
export const tension = (surf, rRel) => (surf ? 2 + 28 * rRel * rRel : 70);

/** Volumes e capacidades de um cenário, com a CRF que o modelo dá. */
export const volumes = (p, peep, age) => {
  const CRF = frcStatic(p, peep);
  const ERV = Math.max(0, CRF - p.RV);
  const IC = p.TLC - CRF;
  return {TLC: p.TLC, RV: p.RV, CRF, ERV, IC, VC: p.TLC - p.RV, IRV: Math.max(0, IC - p.VT), CC: closingCap(p, age)};
};

/**
 * O estado integrado da máquina. step(dt, cmd) avança o compartimento; cmd traz PEEP, idade, FiO2, as manobras
 * (modo 'tidal' | 'vc' | 'apneia') e o surfactante. Tudo o que o ecrã mostra sai de read().
 */
export function createLung(key = 'normal') {
  const S = {
    key,
    p: {...SCEN[key]},
    t: 0,
    V: 2.3,
    Q: 0,
    phase: 0, // segundos no ciclo
    vi: 0, // volume inspirado neste ciclo (para o espaço morto)
    Vmin: 2.3,
    Vmax: 2.8,
    lastMin: 2.3,
    lastMax: 2.8,
    endExp: 2.3, // volume ao fim da última expiração (CRF dinâmica)
    FA: 0.137, // fração alveolar de O2
    FC: 0.056, // fração alveolar de CO2
    FCv: 0.0645, // CO2 "venoso": o reservatório corporal de CO2 que alimenta o alvéolo (≈ 46 mmHg)
    pmus: 0,
    closed: 0, // fração fechada, média móvel
    apneaT: 0,
    vcT: 0,
    instab: 0, // instabilidade alveolar sem surfactante, 0..1
    saPrev: 0.97,
    ampK: 1,
    trace: new Float32Array(1200), // 20 s a 60 Hz
    ti: 0,
  };
  const setScenario = (k) => {
    S.key = k;
    S.p = {...SCEN[k]};
    S.vcT = 0;
    S.ampK = 1;
  };
  const stepOnce = (dt, c) => {
    const p = S.p;
    const peep = c.peep || 0;
    const Tcyc = 60 / p.RR;
    const Ti = 0.4 * Tcyc;
    // a pressão muscular: um seno na inspiração, nada na expiração (passiva); as manobras sobrepõem-se
    let pmus = 0;
    let mode = c.mode;
    if (mode === 'vc') {
      // capacidade vital: até perto da CPT, pausa, até perto do VR, pausa, volta
      S.vcT += dt;
      const u = S.vcT;
      const pTop = Prs(p, p.TLC - 0.03) - peep + 3;
      const pBot = Prs(p, p.RV + 0.03) - peep - 3;
      const sm = (a, b, x) => {
        const k = clamp((x - a) / (b - a), 0, 1);
        return k * k * (3 - 2 * k);
      };
      if (u < 3.0) pmus = pTop * sm(0, 2.2, u);
      else if (u < 4.0) pmus = pTop;
      else if (u < 8.0) pmus = pTop + (pBot - pTop) * sm(4.0, 6.5, u);
      else if (u < 9.0) pmus = pBot;
      else if (u < 10.5) pmus = pBot * (1 - sm(9.0, 10.5, u));
      else mode = 'done';
      S.phase = 0;
      S.vi = 0;
    } else if (mode === 'apneia') {
      pmus = 0;
      S.apneaT += dt;
      S.phase = 0;
    } else {
      S.phase += dt;
      if (S.phase >= Tcyc) {
        S.phase -= Tcyc;
        S.lastMin = S.Vmin;
        S.lastMax = S.Vmax;
        S.endExp = S.V;
        // o centro respiratório corrige o esforço para manter o volume corrente alvo
        const vt = S.lastMax - S.lastMin;
        if (vt > 0.05) S.ampK = clamp(S.ampK * Math.sqrt(clamp(p.VT / vt, 0.7, 1.4)), 0.4, 3);
        S.Vmin = S.V;
        S.Vmax = S.V;
        S.vi = 0;
      }
      // amplitude que produz ~VT na dinâmica: VT/Crs com margem pela resistência
      const w = (Math.PI * tau(p)) / Ti;
      const amp = (p.VT / Crs(p)) * Math.sqrt(1 + w * w) * S.ampK;
      pmus = S.phase < Ti ? amp * Math.sin((Math.PI * S.phase) / Ti) : 0;
    }
    S.pmus = pmus;
    // a equação do compartimento: R·Q = Pmus + PEEP − Prs(V)
    const Q = (pmus + peep - Prs(p, S.V)) / p.R;
    S.Q = Q;
    S.V = clamp(S.V + Q * dt, p.RV * 0.98, p.TLC * 1.01);
    S.Vmin = Math.min(S.Vmin, S.V);
    S.Vmax = Math.max(S.Vmax, S.V);
    // gases alveolares: o ar novo só chega depois do espaço morto; O2 sai para o sangue, CO2 entra
    const fi = c.preox ? 1.0 : 0.21;
    const vo2 = p.VO2 / 60000;
    const vco2 = p.VCO2 / 60000;
    if (Q > 0) {
      S.vi += Q * dt;
      if (S.vi > VD) {
        S.FA += ((Q * (fi - S.FA)) / S.V) * dt;
        S.FC += ((Q * (0 - S.FC)) / S.V) * dt;
      }
    }
    // o sangue também é reservatório: ~1 L de O2 ligado à hemoglobina, libertado quando a saturação cai
    const saNow = sat(S.FA * (PB - PH2O) - 8);
    const release = (S.saPrev - saNow) * 1.0;
    S.saPrev = saNow;
    S.FA = clamp(S.FA - (vo2 * dt - release) / S.V, 0.0, 1.0);
    // o CO2 entra no alvéolo pelo gradiente venoso–alveolar; o corpo é um reservatório enorme (≈ 40 L
    // equivalentes), por isso na apneia a PACO2 sobe ~3 a 4 mmHg/min e não dispara
    const inflow = Math.max(0, 0.39 * (S.FCv - S.FC));
    S.FC = clamp(S.FC + (inflow / S.V) * dt, 0.0, 0.3);
    S.FCv = clamp(S.FCv + ((vco2 - inflow) / 40) * dt, 0.03, 0.3);
    // fechamento das vias aéreas dependentes, filtrado
    const cf = closedFrac(p, S.V, c.age);
    S.closed += (cf - S.closed) * (1 - Math.exp(-dt / 1.5));
    // sem surfactante, a instabilidade de Laplace cresce; com ele, resolve
    S.instab = clamp(S.instab + (c.surf ? -dt / 1.2 : dt / 2.5), 0, 1);
    S.t += dt;
    return mode;
  };
  return {
    S,
    setScenario,
    startVC() {
      S.vcT = 0;
    },
    startApnea() {
      S.apneaT = 0;
    },
    /** avança dt segundos em subpassos; devolve o modo ('done' quando uma manobra acabou) */
    step(dt, c) {
      const n = Math.max(1, Math.ceil(dt / 0.004));
      const h = dt / n;
      let mode = c.mode;
      for (let i = 0; i < n; i++) mode = stepOnce(h, c);
      S.trace[S.ti] = S.V;
      S.ti = (S.ti + 1) % S.trace.length;
      return mode;
    },
    /** tudo o que a página lê */
    read(c) {
      const p = S.p;
      const vols = volumes(p, c.peep, c.age);
      const PAO2 = S.FA * (PB - PH2O);
      const PACO2 = S.FC * (PB - PH2O);
      const shunt = 0.03 + 0.45 * S.closed;
      const sa = (1 - shunt) * sat(PAO2 - 8) + shunt * 0.75;
      const rRel = clamp((S.V - p.RV) / (p.TLC - p.RV), 0.05, 1);
      return {
        ...vols,
        key: S.key,
        p,
        t: S.t,
        V: S.V,
        Q: S.Q,
        pmus: S.pmus,
        Palv: (c.peep || 0) - p.R * S.Q, // pressão alveolar: a da boca menos a queda resistiva
        PL: PL(p, S.V),
        Pcw: Pcw(p, S.V),
        Prs: Prs(p, S.V),
        Crs: Crs(p),
        tau: tau(p),
        VTreal: Math.max(0, S.lastMax - S.lastMin),
        endExp: S.endExp,
        autoPeep: Math.max(0, Prs(p, S.endExp) - (c.peep || 0)),
        FA: S.FA,
        FC: S.FC,
        PAO2,
        PACO2,
        SaO2: sa,
        shunt,
        closed: S.closed,
        apneaT: S.apneaT,
        vcT: S.vcT,
        instab: S.instab,
        rRel,
        inflate: (S.V - p.RV) / (p.TLC - p.RV),
        phaseName: c.mode === 'apneia' ? 'APNEIA' : c.mode === 'vc' ? (S.pmus > 0 ? 'INSPIRAÇÃO MÁXIMA' : 'EXPIRAÇÃO MÁXIMA') : S.Q > 0.02 ? 'INSPIRAÇÃO' : S.Q < -0.02 ? 'EXPIRAÇÃO PASSIVA' : 'PAUSA · NA CRF',
        trace: S.trace,
        ti: S.ti,
      };
    },
  };
}
