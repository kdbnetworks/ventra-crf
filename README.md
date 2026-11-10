# Reserva Funcional Respiratória — simulador interativo

**Abrir no navegador: https://kdbnetworks.github.io/ventra-crf/**

Página única e offline (`reserva-funcional-respiratoria.html`, ~800 KB): abra pelo link acima ou baixe o arquivo e
abra no navegador, sem instalar nada. Construída com o [teardown](https://github.com/elvarofficial/teardown) (three.js + console de painéis + tour
automático).

É material de estudo de fisiologia respiratória: não serve para avaliar pacientes nem para orientar condutas clínicas.

## O que a página faz

Um único modelo move tudo: o tórax 3D, os gráficos e os números saem da mesma equação de um compartimento,

    R·Q = Pmus + PEEP − Prs(V)        Prs(V) = PL(V) + Pcw(V)

- **Mola dupla**: PL é a retração do pulmão, Pcw a da caixa torácica. A CRF é o volume em que Prs = PEEP (bissecção).
- **Cenários** (só mudam parâmetros — a CRF, o VT real, τ e a auto-PEEP emergem): normal em pé, decúbito, obesidade,
  gestante, anestesia, DPOC, SDRA.
- **Controles**: capacidade vital (manobra até a CPT e o VR), apneia (termina sozinha a SaO₂ < 85 %), pré-O₂ 100 %,
  surfactante (liga/desliga a instabilidade de Laplace no ácino), PEEP 0–15 cmH₂O, idade 20–80 (move a capacidade de
  fechamento).
- **Gases**: PAO₂/PACO₂ por balanço de massa alveolar com espaço morto de 150 mL; reservatório de O₂ na hemoglobina
  (~1 L) e de CO₂ corporal (~40 L equivalentes); shunt pela fração de bases fechadas (CRF < CC) há tempo bastante
  para o sangue esgotar o O₂ delas (~40 s); reabrir devolve a ventilação em segundos.
- **Vistas**: geral, frente, lado, árvore (vidro), diafragma, alvéolo (ácino ampliado com dois alvéolos de Laplace).
- **Exibição**: rótulos com guias, vidro, corte coronal, costelas, órbita.
- **Tour automático** de 103 s com cursor; qualquer clique assume o controle, e 25 s parados o devolvem ao tour.

Teclas: 1–6 vistas · N normal · D DPOC · V cap. vital · A apneia · O pré-O₂ · S surfactante · R rótulos · G vidro ·
C corte · K costelas · B órbita.
A qualidade se ajusta sozinha pelo custo medido de cada quadro. `?q=0`, `?q=1` ou `?q=2` na URL fixa um nível
(0 é o mais alto) e desliga o ajuste.

## Valores

Didáticos, adulto ~70 kg (West, Nunn, Lumb). Não substituem equações de referência por sexo/idade/estatura.

## Reconstruir / iterar

Testado com Node 24. O teardown fica ao lado deste repositório, em `../teardown` (outro lugar com
`TEARDOWN=/caminho`). Uma vez, na pasta que contém `ventra-crf`:

```bash
git clone https://github.com/elvarofficial/teardown && cd teardown && git config core.autocrlf false && npm install --ignore-scripts
```

Depois de mexer em `src/`, na raiz deste repositório:

```bash
node tools/build.mjs
```

O script copia `src/pulmao-live` para o teardown, roda o build e grava `reserva-funcional-respiratoria.html` com
`lang="pt-BR"`, o título da página (o teardown escreveria `en` e `pulmao-live`) e, no fim, o `LICENSE` e o
`THIRD_PARTY_NOTICES.md`.

Arquivos em `src/pulmao-live/`: `lung.js` (modelo, sem three.js) · `body.js` (geometria) · `stage.js` (estúdio) ·
`console.js` (painéis) · `live.js` (página, tour, controles) · `main.js`. Números na tela passam por `fmt()` do
`console.js` (vírgula decimal, sinal de menos tipográfico).

O [HANDOFF.md](HANDOFF.md) guarda as decisões de modelo, o estado da revisão e as pendências. Leia antes de mexer no
código.

## Licença

MIT © 2026 KDB Networks ([LICENSE](LICENSE)). A página embute three.js e o kit do teardown (MIT) e as fontes
JetBrains Mono e Inter (SIL OFL 1.1); os avisos estão em [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) e no fim do
próprio HTML.
