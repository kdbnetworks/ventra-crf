// A geometria do tórax, construída em código: coluna, esterno, 10 pares de costelas, os dois pulmões (torneados),
// o diafragma em cúpula, a árvore brônquica (6 gerações) e, à parte, um ácino ampliado para a vista ALVÉOLO.
// update(state) posiciona tudo a partir do modelo (lung.js). Metros; y para cima, +z é anterior, +x é a esquerda do
// paciente (direita do observador que o encara).
import * as THREE from 'three';
import {rng} from '../kit/util.js';

const V3 = THREE.Vector3;
export const COL = {
  bone: '#efe4d2',
  boneEdge: '#c9b89c',
  lung: '#e39a8c',
  lungGlass: '#f0b4a6',
  lungLow: '#9fb0bd',
  lungO2: '#ffd2a8',
  grey: '#a39a92',
  muscle: '#b4584a',
  airway: '#d9b48c',
  airwayEdge: '#8a7c6c',
  accent: '#e3562a',
  cap: '#c84a4a',
  vein: '#5a6fb0',
};
// medidas de referência (m): tórax de um adulto
export const G = {
  apexY: 0.2, // ápice pulmonar
  baseY: -0.1, // base pulmonar na CRF
  spineZ: -0.11,
  sternumZ: 0.112,
  lungX: 0.078, // afastamento de cada pulmão da linha média
  ribs: 10,
  tracheaR: 0.009,
  tracheaTop: 0.275,
  carinaY: 0.105,
  acinusX: 1.6, // onde fica o ácino ampliado, fora do tórax
};
export const CRF_REF = 2.3;

const lathe = (prof, seg = 56) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg);
// pulmão: do ápice (y 0) à base (y −h), com a base côncava sobre o diafragma
const lungProfile = (h) => {
  const pts = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const u = i / N; // 0 ápice, 1 base
    // ápice arredondado (um quarto de círculo nos primeiros 8 %), depois alarga depressa até os 7,5 cm da base
    const cap = u < 0.08 ? Math.sqrt(1 - Math.pow(1 - u / 0.08, 2)) : 1;
    const r = 0.075 * cap * Math.pow(Math.sin((Math.PI / 2) * Math.min(1, 0.3 + u * 0.85)), 0.8);
    pts.push([Math.max(0.0015, r), -h * u]);
  }
  // a base: um rebordo para dentro e a concavidade sobre a cúpula
  pts.push([0.074, -h * 1.0], [0.055, -h * 0.975], [0.03, -h * 0.955], [0.001, -h * 0.945]);
  return pts;
};

/** uma material standard cuja cor fica cinzenta abaixo de uma altura (as bases com vias aéreas fechadas) e que
 * pode ficar translúcida (vidro) e cortada (corte) */
function lungMaterial(side) {
  const m = new THREE.MeshStandardMaterial({color: COL.lung, roughness: 0.55, metalness: 0.0, envMapIntensity: 0.5, transparent: true, opacity: 1, side: THREE.DoubleSide});
  m.userData.u = {uClose: {value: -9}, uGrey: {value: new THREE.Color(COL.grey)}, uK: {value: 0}};
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWy;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vWy = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vWy; uniform float uClose; uniform vec3 uGrey; uniform float uK;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity );\n diffuseColor.rgb = mix(diffuseColor.rgb, uGrey, uK * (1.0 - smoothstep(uClose - 0.012, uClose + 0.012, vWy)));');
  };
  m.userData.side = side;
  return m;
}

export function buildBody() {
  const root = new THREE.Group();
  const parts = {};
  const r = rng(7);
  const boneMat = new THREE.MeshStandardMaterial({color: COL.bone, roughness: 0.6, metalness: 0, envMapIntensity: 0.45, transparent: true, opacity: 1});
  const muscleMat = new THREE.MeshStandardMaterial({color: COL.muscle, roughness: 0.65, metalness: 0, envMapIntensity: 0.4, side: THREE.DoubleSide});
  const airMat = new THREE.MeshStandardMaterial({color: COL.airway, roughness: 0.5, metalness: 0, envMapIntensity: 0.5});
  const smallMat = new THREE.MeshStandardMaterial({color: '#c9a07a', roughness: 0.5, metalness: 0, envMapIntensity: 0.5});
  const closedMat = new THREE.MeshStandardMaterial({color: COL.grey, roughness: 0.7, metalness: 0});
  const shadow = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // ------------------------------------------------------------ esqueleto
  const cage = new THREE.Group();
  root.add(cage);
  parts.cage = cage;
  {
    const spine = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.5, 20), boneMat));
    spine.position.set(0, 0.0, G.spineZ);
    cage.add(spine);
    for (let i = 0; i < 12; i++) {
      const v = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.014, 18), boneMat));
      v.position.set(0, 0.2 - i * 0.034, G.spineZ);
      cage.add(v);
      const sp = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.03), boneMat));
      sp.position.set(0, 0.2 - i * 0.034, G.spineZ - 0.025);
      cage.add(sp);
    }
    const sternum = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.012), boneMat));
    sternum.position.set(0, 0.07, G.sternumZ);
    cage.add(sternum);
    parts.sternum = sternum;
    const ribs = [];
    for (let i = 0; i < G.ribs; i++) {
      const u = i / (G.ribs - 1);
      const rx = 0.088 + 0.068 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.14 + u * 0.86)), 0.75);
      const rz = 0.082 + 0.032 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.15 + u * 0.85)), 0.8);
      const y0 = 0.2 - i * 0.034;
      const aMax = i < 7 ? 2.78 : 2.78 - (i - 6) * 0.22; // as últimas não chegam ao esterno (flutuantes)
      for (const s of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 28; k++) {
          const a = 0.14 + (aMax - 0.14) * (k / 28);
          const w = a / 2.78;
          pts.push(new V3(s * rx * Math.sin(a), y0 - 0.08 * Math.pow(w, 1.5), G.spineZ + rz - rz * Math.cos(a)));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const rib = shadow(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.0065 - u * 0.001, 8, false), boneMat));
        cage.add(rib);
        if (i < 7) {
          // cartilagem costal até o esterno
          const p0 = pts[pts.length - 1];
          const p1 = new V3(s * 0.016, Math.min(y0 - 0.075, 0.15) - 0.004 * i, G.sternumZ - 0.004);
          const c = shadow(new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(p0, p1), 1, 0.005, 8, false), boneMat));
          cage.add(c);
        }
        ribs.push(rib);
      }
    }
    // clavículas
    for (const s of [-1, 1]) {
      const cl = shadow(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(s * 0.02, 0.225, 0.1), new V3(s * 0.085, 0.235, 0.08), new V3(s * 0.165, 0.228, 0.02)]), 16, 0.006, 8, false), boneMat));
      cage.add(cl);
    }
  }

  // ------------------------------------------------------------ pulmões
  const lungs = {};
  const lungMats = [];
  const H0 = G.apexY - G.baseY;
  for (const s of [-1, 1]) {
    const mat = lungMaterial(s);
    lungMats.push(mat);
    const g = lathe(lungProfile(H0));
    const mesh = shadow(new THREE.Mesh(g, mat));
    mesh.scale.set(0.82, 1, 1.0);
    const grp = new THREE.Group();
    grp.position.set(s * G.lungX, G.apexY, 0.0);
    grp.add(mesh);
    // o pulmão direito do paciente (x negativo no observador) é um pouco maior; o esquerdo cede espaço ao coração
    mesh.scale.x *= s < 0 ? 1.0 : 0.94;
    root.add(grp);
    lungs[s] = {grp, mesh, mat};
  }
  parts.lungs = lungs;
  // o coração, entre os pulmões, só para a escala ler
  const heart = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.042, 32, 24), new THREE.MeshStandardMaterial({color: '#b87070', roughness: 0.65})));
  heart.scale.set(0.9, 1.15, 0.8);
  heart.position.set(0.02, -0.03, 0.04);
  heart.rotation.z = 0.5;
  root.add(heart);
  parts.heart = heart;

  // ------------------------------------------------------------ diafragma
  const dome = shadow(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), muscleMat));
  dome.position.set(0, G.baseY - 0.07, 0.0);
  root.add(dome);
  parts.dome = dome;
  // o tendão central, mais claro
  const tendon = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 5), new THREE.MeshStandardMaterial({color: '#e9dccb', roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -1}));
  dome.add(tendon);
  tendon.scale.set(1.002, 1.002, 1.002);

  // ------------------------------------------------------------ árvore brônquica
  const tree = new THREE.Group();
  root.add(tree);
  parts.tree = tree;
  const branches = [];
  const tube = (a, b, rad, mat) => {
    const d = new V3().subVectors(b, a);
    const len = d.length();
    const m = shadow(new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.86, rad, len, 12, 1, false), mat));
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.clone().normalize());
    m.userData.rad = rad;
    return m;
  };
  // traqueia com anéis
  const trach = tube(new V3(0, G.tracheaTop, -0.03), new V3(0, G.carinaY, -0.015), G.tracheaR, airMat);
  tree.add(trach);
  for (let i = 0; i < 12; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(G.tracheaR * 1.02, 0.0016, 8, 24), new THREE.MeshStandardMaterial({color: '#dcd0bc', roughness: 0.5}));
    ring.position.set(0, G.tracheaTop - 0.01 - i * 0.0135, -0.03 + (0.015 * i) / 12);
    ring.rotation.x = Math.PI / 2;
    tree.add(ring);
  }
  const grow = (a, dir, len, rad, gen, side) => {
    const b = a.clone().addScaledVector(dir, len);
    const m = tube(a, b, rad, gen >= 3 ? smallMat : airMat);
    m.userData.gen = gen;
    m.userData.yEnd = b.y;
    m.userData.side = side;
    tree.add(m);
    branches.push(m);
    if (gen >= 7) return;
    // duas filhas: abrem ±35°, tendem para baixo e para fora, e rodam em torno do eixo da mãe
    const up = new V3(0, 1, 0);
    let n = new V3().crossVectors(dir, up);
    if (n.lengthSq() < 1e-4) n = new V3(1, 0, 0);
    n.normalize();
    const twist = (r() - 0.5) * 1.6 + (gen % 2) * 1.5;
    n.applyAxisAngle(dir, twist);
    for (const sgn of [-1, 1]) {
      const ang = (28 + r() * 16) * (Math.PI / 180);
      const d2 = dir.clone().applyAxisAngle(n, sgn * ang);
      d2.y -= 0.26; // para baixo
      d2.x += side * 0.12 * (1 - gen / 6); // para fora
      d2.normalize();
      grow(b, d2, len * (0.76 + r() * 0.08), rad * 0.74, gen + 1, side);
    }
  };
  const carina = new V3(0, G.carinaY, -0.015);
  grow(carina, new V3(-0.5, -0.78, 0.08).normalize(), 0.048, 0.0068, 1, -1); // brônquio direito: mais vertical e largo
  grow(carina, new V3(0.72, -0.62, 0.08).normalize(), 0.056, 0.006, 1, 1); // esquerdo: mais horizontal
  parts.branches = branches;

  // ------------------------------------------------------------ o ácino ampliado (vista ALVÉOLO)
  const ac = new THREE.Group();
  ac.position.set(G.acinusX, 0.02, 0);
  ac.visible = false;
  root.add(ac);
  parts.acinus = ac;
  const memMat = new THREE.MeshPhysicalMaterial({color: '#f1b7aa', roughness: 0.35, metalness: 0, transmission: 0.0, transparent: true, opacity: 0.86, side: THREE.DoubleSide, envMapIntensity: 0.6});
  const capMat = new THREE.MeshStandardMaterial({color: COL.cap, roughness: 0.5});
  const veinMat = new THREE.MeshStandardMaterial({color: COL.vein, roughness: 0.5});
  // bronquíolo terminal e o Y para os dois alvéolos de Laplace
  const bt = tube(new V3(0, 0.26, 0), new V3(0, 0.1, 0), 0.016, airMat);
  ac.add(bt);
  const yA = new V3(-0.075, 0.0, 0);
  const yB = new V3(0.085, -0.02, 0);
  ac.add(tube(new V3(0, 0.1, 0), yA, 0.012, airMat));
  ac.add(tube(new V3(0, 0.1, 0), yB, 0.012, airMat));
  const alvA = shadow(new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), memMat));
  const alvB = shadow(new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), memMat.clone()));
  alvA.position.copy(yA).add(new V3(-0.03, -0.03, 0));
  alvB.position.copy(yB).add(new V3(0.05, -0.05, 0));
  ac.add(alvA, alvB);
  // capilares: anéis finos a envolver cada alvéolo, alternando arteríola (azul, sangue venoso) e vénula (vermelho)
  const wrap = (alv, n) => {
    const grp = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.012, 6, 48), i % 2 ? capMat : veinMat);
      ring.rotation.set(r() * Math.PI, r() * Math.PI, 0);
      grp.add(ring);
    }
    alv.add(grp);
    return grp;
  };
  wrap(alvA, 4);
  wrap(alvB, 4);
  // um cacho de alvéolos menores num ducto, à esquerda, para a escala
  const cluster = new THREE.Group();
  cluster.position.set(-0.24, -0.13, -0.05);
  ac.add(cluster);
  ac.add(tube(new V3(0, 0.1, 0), new V3(-0.19, -0.07, -0.04), 0.009, airMat));
  const small = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const s = shadow(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), memMat));
    s.position.set(0.055 * Math.cos(a), 0.05 * Math.sin(a) * 0.8, 0.04 * Math.sin(a * 2));
    s.userData.r0 = 0.03 + 0.008 * r();
    cluster.add(s);
    small.push(s);
    if (i % 2 === 0) wrap(s, 2);
  }
  parts.alvA = alvA;
  parts.alvB = alvB;
  parts.small = small;

  // ------------------------------------------------------------ pose
  const tmpC = new THREE.Color();
  const cLung = new THREE.Color(COL.lung);
  const cLow = new THREE.Color(COL.lungLow);
  const cO2 = new THREE.Color(COL.lungO2);
  const cGlass = new THREE.Color(COL.lungGlass);
  const clipPlane = new THREE.Plane(new V3(0, 0, -1), 0.0);
  const update = (st) => {
    // st: {V, inflate (0..1 da CV), rRel, FA, closed, yClose (fração da altura), glass (0..1), section (bool),
    //      cage (0..1 visibilidade), instab, surf, acinus (bool)}
    const vol = Math.max(0.6, st.V);
    const s = Math.cbrt(vol / CRF_REF);
    const sy = Math.pow(s, 1.2);
    const sxz = Math.pow(s, 0.9);
    for (const side of [-1, 1]) {
      const L = lungs[side];
      L.grp.scale.set(sxz, sy, sxz);
      L.grp.position.x = side * (G.lungX + 0.01 * (sxz - 1));
      // cor: hipóxia puxa para o cinzento-azul, pré-oxigenação para o dourado
      const k = Math.min(1, Math.max(0, (st.FA - 0.06) / 0.09));
      tmpC.copy(cLow).lerp(cLung, k);
      if (st.FA > 0.16) tmpC.lerp(cO2, Math.min(1, (st.FA - 0.16) / 0.6));
      if (st.glass > 0) tmpC.lerp(cGlass, st.glass);
      L.mat.color.copy(tmpC);
      L.mat.opacity = 1 - 0.78 * st.glass;
      L.mat.depthWrite = st.glass < 0.5;
      L.mat.roughness = 0.55 - 0.3 * st.glass;
      L.mesh.castShadow = st.glass < 0.5;
      // bases fechadas: a altura do corte em metros, no referencial do mundo
      const baseY = G.apexY - H0 * sy;
      L.mat.userData.u.uClose.value = baseY + (G.apexY - baseY) * 0.42 * st.closed;
      L.mat.userData.u.uK.value = st.closed > 0.01 ? 0.85 : 0;
      L.mat.clippingPlanes = st.section ? [clipPlane] : null;
      L.mat.needsUpdate = false;
    }
    heart.material.clippingPlanes = st.section ? [clipPlane] : null;
    boneMat.clippingPlanes = st.section ? [clipPlane] : null;
    // diafragma: a cúpula desce com o volume (≈ 1,5 cm por 0,5 L, até ~9 cm na CV)
    const baseY = G.apexY - H0 * sy;
    const descent = (vol - CRF_REF) * 0.03;
    dome.position.y = G.baseY - 0.075 - descent * 0.5;
    const domeH = Math.max(0.012, 0.072 - descent * 0.75);
    dome.scale.set(0.135 * (1 + 0.04 * (sxz - 1)), domeH, 0.095 * (1 + 0.04 * (sxz - 1)));
    void baseY;
    // caixa torácica: alça de balde, cresce em x e z e sobe um pouco
    const f = (vol - CRF_REF) / CRF_REF;
    cage.scale.set(1 + 0.11 * f, 1 + 0.03 * f, 1 + 0.14 * f);
    cage.position.y = 0.02 * f;
    const cageA = st.cage * (1 - 0.85 * st.glass);
    cage.visible = cageA > 0.02;
    boneMat.opacity = cageA;
    boneMat.depthWrite = cageA > 0.5;
    for (const o of cage.children) o.castShadow = cageA > 0.5;
    // vias aéreas pequenas: o calibre segue a tração do parênquima, ∝ V^(1/3); as das bases fecham abaixo de CC
    const tether = Math.cbrt(vol / CRF_REF);
    const yClose = baseY + (G.apexY - baseY) * 0.42 * st.closed;
    for (const b of branches) {
      const small = b.userData.gen >= 3;
      const closed = small && st.closed > 0.01 && b.userData.yEnd * sy + G.apexY * (1 - sy) < yClose;
      const k = closed ? 0.3 : small ? 0.75 + 0.25 * tether * tether : 1;
      b.scale.x = k;
      b.scale.z = k;
      b.material = closed ? closedMat : small ? smallMat : airMat;
      // a árvore acompanha o pulmão: escala em torno do ápice
      b.position.y = b.userData.y0 ?? (b.userData.y0 = b.position.y);
    }
    tree.scale.set(sxz, sy, sxz);
    tree.position.y = G.apexY * (1 - sy) + (G.carinaY * sy - G.carinaY) * 0; // escala em torno do ápice do pulmão
    tree.visible = st.glass > 0.05 || st.section;
    // ácino: raios ∝ V^(1/3); sem surfactante o pequeno esvazia no grande (Laplace)
    ac.visible = !!st.acinus;
    if (ac.visible) {
      const ra = 0.055 * tether * (1 - 0.7 * st.instab);
      const rb = 0.075 * tether * (1 + 0.28 * st.instab);
      alvA.scale.setScalar(ra);
      alvB.scale.setScalar(rb);
      alvA.material.opacity = 0.86;
      alvB.material.color.set('#f1b7aa').lerp(new THREE.Color(COL.accent), 0.35 * st.instab);
      alvA.material.color.set('#f1b7aa').lerp(new THREE.Color(COL.grey), 0.6 * st.instab);
      for (let i = 0; i < small.length; i++) {
        const sm = small[i];
        const jitter = 1 + 0.08 * Math.sin(st.t * 1.3 + i * 1.7) * st.instab;
        sm.scale.setScalar(sm.userData.r0 * tether * (1 - 0.35 * st.instab * (i % 2)) * jitter);
      }
    }
  };
  return {root, parts, update, lungMats};
}
