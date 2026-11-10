# HANDOFF — Simulador "Reserva Funcional Respiratória" (CRF)

Sessão de origem: chat Claude, 2026-11-08. Continuar no Claude Code a partir desta pasta.
Leia este arquivo inteiro antes de tocar no código; depois `README.md`; depois `src/pulmao-live/lung.js`.

## 1. O que existe

| Arquivo | O que é |
| --- | --- |
| `reserva-funcional-respiratoria.html` | Página interativa, offline, ~790 KB. Build de `src/pulmao-live`. |
| `README.md` | Uso, teclas, como reconstruir. |
| `src/pulmao-live/lung.js` | **O modelo.** Sem three.js. Um compartimento: `R·Q = Pmus + PEEP − Prs(V)`, `Prs = PL + Pcw`. CRF por bissecção de `Prs(V) = PEEP`. Cenários como parâmetros. Gases alveolares (balanço de massa, espaço morto 150 mL, reservatório de O₂ na Hb ~1 L, reservatório corporal de CO₂ ~40 L eq.). Capacidade de fechamento `CC = RV + 0,25 + 0,019·(idade−20) + CCadd`. Laplace e tensão com/sem surfactante. Controlador de esforço (`ampK`) que mantém o VT alvo. |
| `src/pulmao-live/body.js` | Geometria procedural: coluna, esterno, 10 pares de costelas (TubeGeometry), 2 pulmões torneados, cúpula do diafragma, árvore brônquica recursiva (7 gerações), ácino ampliado em `x = 1,6 m`. `update(state)` posiciona tudo. Material do pulmão com `onBeforeCompile` para cinzar as bases fechadas por altura. |
| `src/pulmao-live/stage.js` | Estúdio: fundo pêssego, chão com grelha, sombras VSM 4096, GTAO (fora do chão), ambiente PMREM. Cópia adaptada do `cessna-shared/stage.js`. |
| `src/pulmao-live/console.js` | Overlay 1600×900 em PT: estado + coluna de volumes, espirograma 20 s, gases, cenários, controles (4 botões + 2 sliders), vistas, exibição, nota do cenário, curva P-V + mola dupla, rótulos com guias, cursor do tour. |
| `src/pulmao-live/live.js` | Página: integra o modelo em tempo real (`L.step(dt, cmd)`), câmera por vistas + órbita/zoom, tiers de qualidade (`?q=0..2`), tour automático de 103 s (`SCRIPT`), takeover/idle 25 s, teclas, `window.LIVE` para automação. |
| `src/pulmao-live/main.js` | Entrada: `runLive()`. |
| `tools/shot.mjs` | Script de revisão: abre o HTML no Chrome via Playwright, executa passos (`press:`, `set:`, `sim:`, `snap`, `shot:`) e tira frames. Ver §5. |

## 2. Como reconstruir

```bash
git clone https://github.com/elvarofficial/teardown && cd teardown
npm install && npx playwright install chromium     # a parte do Chromium falhou no ambiente de chat por rede; aqui deve passar
cp -r "<esta pasta>/src/pulmao-live" sims/pulmao-live
node sims/build.mjs pulmao-live                     # → teardown-out/dist/pulmao-live.html
```
O skill (`SKILL.md` do teardown) está em `~/.claude/skills/teardown` se instalado via `npx skills add elvarofficial/teardown -g -a claude-code`. As regras dele que mais importam: um input move tudo; números reais de uma fonte só; a peça que trabalha se abre; revisar por frames, nunca declarar pronto sem ler stills.

## 3. Decisões de modelo (não refazer sem motivo)

- Curvas: `PL = (V−RV)/CL + 25·u¹⁰`, `Pcw = (V−V0cw)/Ccw − 15·(1−u)¹⁰`, `u = (V−RV)/(TLC−RV)`. Dão Prs(TLC) ≈ +60 e Prs(RV) ≈ −26 cmH₂O no normal.
- Parâmetros por cenário em `SCEN` (TLC, RV, CL, Ccw, V0cw, R, VT, RR, CCadd, VO2, VCO2). CRF resultante: normal 2,38 · decúbito 2,08 · obeso 1,99 · gestante 1,89 · anestesia 1,93 · DPOC 3,68 (τ 1,6 s, auto-PEEP ~0,5) · SDRA 1,42. Validado em Node (`node` com import direto do `lung.js`).
- Apneia em ar: SaO₂ 90 % em ~40 s; pré-oxigenado: ~8 min. PACO₂ sobe ~3,5 mmHg/min. Ambos dependem dos reservatórios de O₂/CO₂ — não remover.
- Pmus inspiratório é seno em 40 % do ciclo; expiração passiva. Manobra CV usa `Prs(TLC−0,03)+3` e `Prs(RV+0,03)−3` como alvos, então atinge CPT e VR de verdade.
- A árvore e os pulmões escalam em torno do ápice; a caixa escala por volume absoluto `(V−2,3)/2,3`. Vidro esmaece as costelas (85 %). Corte = plano de clipping `z < 0` em pulmões, coração e ossos.

## 4. Estado da revisão (frames em software renderer, não em GPU real)

Verificado por stills: hero, frente, lado, árvore (vidro), diafragma, alvéolo (com e sem surfactante), corte em SDRA com PEEP, apneia pré-oxigenada. Tudo renderiza e os números batem com o modelo.

Pendências conhecidas, por prioridade:
1. **Nunca foi visto em GPU real nem em tempo real.** Primeira coisa: abrir e assistir o tour inteiro (103 s). Conferir fps nos três tiers, o takeover e o retorno após 25 s.
2. Anatomia esquemática: costelas regulares demais ("slinky"), pulmões um pouco cilíndricos, diafragma como cúpula única e larga. Ou refinar o procedural, ou trocar por malhas reais (§6).
3. Rótulos: em algumas vistas o guia cruza o corpo; posições fixas em `LABELS` de `live.js`. Checar sobreposição com a peça nomeada em cada vista.
4. Espirograma: labels "CC" e "CRF est." colidem quando CC ≈ CRF (SDRA, DPOC).
5. Sem film/score: não há `*-film`, `timeline.json` nem `score.py`. Se quiser vídeo, seguir o padrão do `cessna-film`.
6. Mobile: só a chip "vire o telemóvel"; não testado.

## 5. Como revisar (padrão do skill: olhar frames)

`tools/shot.mjs` roda com o Chromium do Playwright (ou `CHROMIUM=/caminho/chrome`). Passos: `wait:s`, `press:<botão>`, `set:peep=10`, `sim:s` (avança o modelo s segundos sem esperar), `snap` (câmera direto no alvo), `shot:nome`. Exemplo:

```bash
Q=0 node tools/shot.mjs teardown-out/dist/pulmao-live.html out/rev wait:3 press:labels sim:10 snap wait:1 shot:hero \
  press:vidro press:arvore sim:5 snap wait:1 shot:arvore press:sdra press:corte set:peep=10 sim:30 snap wait:1 shot:sdra
```
Chaves de botão: cenários `normal supino obeso gestante anestesia dpoc sdra` · ações `cv apneia preox surf` · vistas `hero frente lado arvore diafragma alveolo` · exibição `labels vidro corte costelas orbit`. `window.LIVE` expõe `L` (modelo), `cmd`, `cam`, `press()`, `snap()`, `startTour()`, `takeOver()`.

## 6. Próximos passos acordados

**A. Módulo do ácino (prioridade).** Nova máquina `sims/acino-live` ou uma segunda cena dentro desta. Espuma de 20–40 alvéolos como polígonos com paredes partilhadas (treliça de molas elastina/colágeno) + tensão superficial dinâmica com histerese; bronquíolo terminal embutido cujo calibre vem da tração dos septos; Fick na membrana com capilar e hemácias em trânsito de 0,75 s + curva de dissociação; atelectasia de absorção a partir do balanço de massa já existente. Saídas: pressão de abertura, laço P-V, contador de colapso-reabertura, tensão local nos septos (Mead ~140 cmH₂O), limitação por difusão vs. perfusão. Acoplamento: recebe Ppl local e fluxo do macro, devolve complacência regional. Não modelar CFD da camada líquida nem biologia celular.

**B. Anatomia real.** Z-Anatomy (Blender, CC BY-SA 4.0, derivado do BodyParts3D CC BY-SA 2.1 JP) → exportar pulmões por lobo, traqueia+brônquios, diafragma, costelas, esterno, coluna, clavículas → decimar para 50–100 k tris → GLB → `build.json` `{"external": {...}}` → substituir `body.js` mantendo a assinatura `update(state)`. Alternativa de engenharia: CT segmentado no 3D Slicer (anatomia medida, árvore até ~6ª geração). Atenção ao copyleft se for distribuir.

**C. Depois:** acoplar A e B; vídeo com trilha (`capture.mjs` + `run_sfx.py`); cenário de ventilação mecânica com Ti/Te ajustável (mostra hiperinsuflação dinâmica ao vivo).

## 7. Contexto didático (para manter a linguagem)

A página acompanha um estudo (doc "Reserva Funcional Respiratória — Estudo") e uma conversa que construiu a analogia: CRF como reserva técnica entre fluxos, pulmão + caixa como mola dupla, "meio cheio" como ponto de projeto, religar adutora seca = atelectrauma, PEEP = ancoragem, Laplace/surfactante, Poiseuille (R ∝ 1/r⁴, 80 % da resistência nas vias grandes), constantes de tempo e pendelluft, vasoconstrição hipóxica e broncoconstrição hipocápnica como válvulas locais, ponto de igual pressão como válvula de alívio. Textos da UI em PT-BR, tom técnico, sem bajulação.
