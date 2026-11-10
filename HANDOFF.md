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
| `tools/build.mjs` | Build: copia `src/pulmao-live` para o teardown, roda `sims/build.mjs` e grava o HTML com `lang="pt-BR"` e título. Ver §2. |
| `tools/shot.mjs` | Script de revisão: abre o HTML no Chrome via Playwright, executa passos (`press:`, `set:`, `sim:`, `snap`, `shot:`) e tira frames. Ver §5. |

## 2. Como reconstruir

```bash
git clone https://github.com/elvarofficial/teardown && cd teardown
npm install && npx playwright install chromium     # a parte do Chromium falhou no ambiente de chat por rede; aqui deve passar
cp -r "<esta pasta>/src/pulmao-live" sims/pulmao-live
node sims/build.mjs pulmao-live                     # → teardown-out/dist/pulmao-live.html
```
Nesta máquina o clone está em `C:\kdbnetworks\teardown` (commit `a91262a`, instalado com `npm install --ignore-scripts`, sem o Chromium do Playwright). Ele tem `core.autocrlf false`: com a conversão do Windows ligada, o CSS do kit sai com CRLF e o HTML difere do original em 137 bytes. Com ela desligada, o fonte de 2026-11-08 reconstrói o HTML original byte a byte. Para iterar, na raiz do repositório:
```bash
node crf/tools/build.mjs        # TEARDOWN=/outro/clone se não estiver em ../teardown
```
A fonte da verdade é `crf/src/`. A cópia em `teardown/sims/` é apagada e refeita a cada build. O script também corrige `lang="en"` e `<title>pulmao-live</title>`, que o `build.mjs` do teardown escreve fixos.

O skill (`SKILL.md` do teardown) está em `~/.claude/skills/teardown` se instalado via `npx skills add elvarofficial/teardown -g -a claude-code`. As regras dele que mais importam: um input move tudo; números reais de uma fonte só; a peça que trabalha se abre; revisar por frames, nunca declarar pronto sem ler stills.

## 3. Decisões de modelo (não refazer sem motivo)

- Curvas: `PL = (V−RV)/CL + 25·u¹⁰`, `Pcw = (V−V0cw)/Ccw − 15·(1−u)¹⁰`, `u = (V−RV)/(TLC−RV)`. Dão Prs(TLC) ≈ +60 e Prs(RV) ≈ −26 cmH₂O no normal.
- Parâmetros por cenário em `SCEN` (TLC, RV, CL, Ccw, V0cw, R, VT, RR, CCadd, VO2, VCO2). CRF resultante: normal 2,38 · decúbito 2,08 · obeso 1,99 · gestante 1,89 · anestesia 1,93 · DPOC 3,68 (τ 1,6 s, auto-PEEP ~0,5) · SDRA 1,42. Validado em Node (`node` com import direto do `lung.js`).
- Apneia em ar: SaO₂ 90 % em ~40 s; pré-oxigenado: ~8 min. PACO₂ sobe ~3,5 mmHg/min. Ambos dependem dos reservatórios de O₂/CO₂ — não remover.
- Pmus inspiratório é seno em 40 % do ciclo; expiração passiva. Manobra CV usa `Prs(TLC−0,03)+3` e `Prs(RV+0,03)−3` como alvos, então atinge CPT e VR de verdade.
- Pressão pleural: `Ppl = Palv − PL` (= Pcw − Pmus), exposta por `read()` e usada pelo rótulo PLEURA e pela mola dupla. `−PL` só vale sem PEEP e sem fluxo; com PEEP 10 na SDRA errava por 10 cmH₂O (corrigido em 2026-11-09).
- Shunt atrasado: `shunt = 0,03 + 0,45·trapped`, com `trapped` seguindo `closed` em τ 40 s ao fechar e 3 s ao reabrir. Uma unidade fechada ainda tem gás, e o sangue leva ~40 s a esgotar o O₂ dela. Na troca de cenário, `closed` e `trapped` partem do equilíbrio em `CRF + 0,3·VT`. Antes uma capacidade vital derrubava a SaO₂ para 87 %; agora o mínimo é ~94 %.
- VT real e auto-PEEP só depois de um ciclo medido inteiro. `restartCycle()` (troca de cenário, CV, apneia) deixa 3τ fora de Vmin/Vmax e só aceita um ciclo cuja medição começou antes de 0,8·Ti; até lá `read()` devolve `null` e a tela mostra «—». O controlador de esforço (`ampK`) também ignora esses ciclos. Antes o painel mostrava a transição como respiração (2,15 L na DPOC, 4,68 L depois da CV).
- Qualidade (`live.js`, 2026-11-09): o tier sai do custo medido do quadro (JS + GPU, sincronizando com a leitura de um pixel), não do intervalo entre quadros, que também sobe com limites alheios à GPU (30 Hz, economia de bateria, aba em segundo plano). Começa no tier 1 (celular: 2). Mede a cada 0,2 s até juntar 7 amostras e depois a cada 2 s, pela mediana. Desce se o custo passa de 22 ms; sobe se custo × `UP_RATIO` (×3,4 do 1 para o 0, ×1,5 do 2 para o 1, medidos na MX350) cabe em 14 ms. Um tier que falhou vira teto e não é tentado de novo. `?q=` fixa o tier e desliga o ajuste. `window.LIVE` expõe `tier`, `ceiling` e `cost`. Testado com o relógio escalado e carga artificial: 30 Hz fica no 1; GPU fraca desce do 1 para o 2 em 1,2 s e não volta; GPU rápida sobe 2 → 1 → 0, e um tier 0 que não cabe volta para 1 com teto 1.
- A árvore e os pulmões escalam em torno do ápice; a caixa escala por volume absoluto `(V−2,3)/2,3`. Vidro esmaece as costelas (85 %). Corte = plano de clipping `z < 0` em pulmões, coração e ossos.

## 4. Estado da revisão (frames em software renderer, não em GPU real)

Verificado por stills: hero, frente, lado, árvore (vidro), diafragma, alvéolo (com e sem surfactante), corte em SDRA com PEEP, apneia pré-oxigenada. Tudo renderiza e os números batem com o modelo.

### Revisão em GPU real (2026-11-08/09, Claude Code)

Aberto no navegador do app (NVIDIA GeForce MX350, ANGLE D3D11) via `python -m http.server 8092`, entrada `crf` em `.claude/launch.json`. O tour inteiro roda: os 31 passos disparam na ordem, volta ao início aos 103 s, o clique assume e 25 s parados devolvem (reinicia em normal). Sem erros no console.

Custo por quadro com a GPU sincronizada (`readPixels` no framebuffer padrão):

| tier | 1200×675 (notebook 1366×768) | 1680×945 (monitor 1080p) |
| --- | --- | --- |
| 0 (GTAO, MSAA 8, sombra 4096) | 35 ms | 43 ms |
| 1 | 10 ms | 14 ms |
| 2 | 7 ms | 9 ms |

O fps em tempo real não foi medido: o painel do navegador do app ficou oculto e limitava a página a 1, 30 ou 60 fps. Para revisar com o painel oculto, troque `requestAnimationFrame` por `setTimeout(16)` na aba e tire uma captura para destravar o primeiro quadro.

Corrigido em 2026-11-09 (ver §3): rótulo da pleura com PEEP, VT real e auto-PEEP depois de trocas e manobras, queda de SaO₂ na capacidade vital. O original está em `_lixeira/2026-11-08-crf-antes-das-correcoes/`.

O custo medido varia com o estado da máquina: em 2026-11-09 a mesma MX350, na tomada e na mesma resolução, deu tier 1 em 19 ms e tier 2 em 15 ms, uns 40 % acima da véspera. Por isso a qualidade é medida na hora, não suposta.

Pendências conhecidas, por prioridade:
1. **Escolha de qualidade: resolvida em 2026-11-09** (ver §3). Antes escolhia o tier pelo viewport (lado menor < 700 px → tier 2) e só rebaixava, então janelas de notebook ficavam sempre no tier 2, e qualquer limite de 30 Hz também derrubava para o 2.
2. **Tour × leituras.** Cada cenário fica só ~6 s no tour, e o VT real só aparece depois de um ciclo medido inteiro (2,5 a 5 s; DPOC 8 s). Na DPOC (8,3 s) o tour quase não mostra VT nem auto-PEEP. Se a auto-PEEP da DPOC for o ponto, alongar esse trecho do `SCRIPT`.
3. Rótulos: posições fixas em `LABELS` só servem à vista hero. Na lateral o guia da TRAQUEIA atravessa o tórax; na do diafragma há guias apontando para peças fora do quadro.
4. Espirograma: "CC" e "CRF est." se sobrepõem quando a CC fica logo acima da CRF. Entre os cenários, só na SDRA com PEEP 10 (tour, 59–65 s); com a idade alta acontece em qualquer um.
5. Enquadramento: nas vistas diafragma e árvore, a coluna e a traqueia passam por trás do título. A nota de chão diz sempre "VISTA ANTERIOR · O PACIENTE OLHA PARA VOCÊ", mesmo nas vistas lateral e do alvéolo.
6. **Texto: resolvido em 2026-11-09.** UI, notas de cenário e comentários em PT-BR ("CONTROLES", "Gire o celular…", "tônus", "abdome", "tela"); números na tela por `fmt()` do `console.js` (vírgula decimal, "−" tipográfico, sem "−0,0"); "Pausa · na CRF" em vez de "na crf"; a vista `hero` aparece como GERAL (em inglês e com o mesmo nome do Ventra Hero); rodapé "UMA ÚNICA ENTRADA" em vez de "UM INPUT"; `lang="pt-BR"` e título via `tools/build.mjs`. De passagem: o botão ALVÉOLO caía numa 3ª linha e saía 8 px do painel VISTAS; agora cabe na 2ª.
7. Anatomia esquemática: costelas regulares demais ("slinky"), pulmões um pouco cilíndricos, diafragma como cúpula única e larga. Ou refinar o procedural, ou trocar por malhas reais (§6).
8. Sem film/score: não há `*-film`, `timeline.json` nem `score.py`. Se quiser vídeo, seguir o padrão do `cessna-film`.
9. Mobile: só o aviso "Gire o celular na horizontal…"; não testado.

Conferido no Node em 2026-11-09, antes e depois das correções, sem mudança: CRF dos sete cenários; apneia em ar, SaO₂ 90 % aos 38 s; pré-oxigenado, 8,2 min; PACO₂ +3,4 a 3,5 mmHg/min depois do salto dos primeiros ~10 s. SaO₂ de equilíbrio igual, exceto na SDRA (91,2 → 91,9 %).

## 5. Como revisar (padrão do skill: olhar frames)

`tools/shot.mjs` roda com o Chromium do Playwright (ou `CHROMIUM=/caminho/chrome`). Passos: `wait:s`, `press:<botão>`, `set:peep=10`, `sim:s` (avança o modelo s segundos sem esperar), `snap` (câmera direto no alvo), `shot:nome`. Exemplo:

```bash
Q=0 node tools/shot.mjs teardown-out/dist/pulmao-live.html out/rev wait:3 press:labels sim:10 snap wait:1 shot:hero \
  press:vidro press:arvore sim:5 snap wait:1 shot:arvore press:sdra press:corte set:peep=10 sim:30 snap wait:1 shot:sdra
```
Chaves de botão: cenários `normal supino obeso gestante anestesia dpoc sdra` · ações `cv apneia preox surf` · vistas `hero frente lado arvore diafragma alveolo` (o botão de `hero` diz GERAL) · exibição `labels vidro corte costelas orbit`. `window.LIVE` expõe `L` (modelo), `cmd`, `cam`, `press()`, `snap()`, `startTour()`, `takeOver()`.

## 6. Próximos passos acordados

**A. Módulo do ácino (prioridade).** Nova máquina `sims/acino-live` ou uma segunda cena dentro desta. Espuma de 20–40 alvéolos como polígonos com paredes partilhadas (treliça de molas elastina/colágeno) + tensão superficial dinâmica com histerese; bronquíolo terminal embutido cujo calibre vem da tração dos septos; Fick na membrana com capilar e hemácias em trânsito de 0,75 s + curva de dissociação; atelectasia de absorção a partir do balanço de massa já existente. Saídas: pressão de abertura, laço P-V, contador de colapso-reabertura, tensão local nos septos (Mead ~140 cmH₂O), limitação por difusão vs. perfusão. Acoplamento: recebe Ppl local e fluxo do macro, devolve complacência regional. Não modelar CFD da camada líquida nem biologia celular.

**B. Anatomia real.** Z-Anatomy (Blender, CC BY-SA 4.0, derivado do BodyParts3D CC BY-SA 2.1 JP) → exportar pulmões por lobo, traqueia+brônquios, diafragma, costelas, esterno, coluna, clavículas → decimar para 50–100 k tris → GLB → `build.json` `{"external": {...}}` → substituir `body.js` mantendo a assinatura `update(state)`. Alternativa de engenharia: CT segmentado no 3D Slicer (anatomia medida, árvore até ~6ª geração). Atenção ao copyleft se for distribuir.

**C. Depois:** acoplar A e B; vídeo com trilha (`capture.mjs` + `run_sfx.py`); cenário de ventilação mecânica com Ti/Te ajustável (mostra hiperinsuflação dinâmica ao vivo).

## 7. Contexto didático (para manter a linguagem)

A página acompanha um estudo (doc "Reserva Funcional Respiratória — Estudo") e uma conversa que construiu a analogia: CRF como reserva técnica entre fluxos, pulmão + caixa como mola dupla, "meio cheio" como ponto de projeto, religar adutora seca = atelectrauma, PEEP = ancoragem, Laplace/surfactante, Poiseuille (R ∝ 1/r⁴, 80 % da resistência nas vias grandes), constantes de tempo e pendelluft, vasoconstrição hipóxica e broncoconstrição hipocápnica como válvulas locais, ponto de igual pressão como válvula de alívio. Textos da UI em PT-BR, tom técnico, sem bajulação.
