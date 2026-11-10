# Reserva Funcional Respiratória — simulador interativo

Página única e offline (`reserva-funcional-respiratoria.html`, ~790 KB): abra no navegador e pronto. Construída com o skill
[teardown](https://github.com/elvarofficial/teardown) (three.js + console de painéis + tour automático).

## O que a página faz

Um único modelo move tudo: o tórax 3D, os gráficos e os números saem da mesma equação de um compartimento,

    R·Q = Pmus + PEEP − Prs(V)        Prs(V) = PL(V) + Pcw(V)

- **Mola dupla**: PL é a retração do pulmão, Pcw a da caixa torácica. A CRF é o volume em que Prs = PEEP (bissecção).
- **Cenários** (só mudam parâmetros — a CRF, o VT real, τ e a auto-PEEP emergem): normal em pé, decúbito, obesidade,
  gestante, anestesia, DPOC, SDRA.
- **Controlos**: capacidade vital (manobra até a CPT e o VR), apneia (termina sozinha a SaO₂ < 85 %), pré-O₂ 100 %,
  surfactante (liga/desliga a instabilidade de Laplace no ácino), PEEP 0–15 cmH₂O, idade 20–80 (move a capacidade de
  fechamento).
- **Gases**: PAO₂/PACO₂ por balanço de massa alveolar com espaço morto de 150 mL; reservatório de O₂ na hemoglobina
  (~1 L) e de CO₂ corporal (~40 L equivalentes); shunt proporcional à fração de bases fechadas (CRF < CC).
- **Vistas**: hero, frente, lado, árvore (vidro), diafragma, alvéolo (ácino ampliado com dois alvéolos de Laplace).
- **Exibição**: rótulos com guias, vidro, corte coronal, costelas, órbita.
- **Tour automático** de 103 s com cursor; qualquer clique assume o controlo, 25 s parados devolvem-no.

Teclas: 1–6 vistas · V cap. vital · A apneia · O pré-O₂ · S surfactante · R rótulos · G vidro · C corte · K costelas · B órbita.
`?q=2` na URL força a qualidade baixa (GPU integrada fraca).

## Valores

Didáticos, adulto ~70 kg (West, Nunn, Lumb). Não substituem equações de referência por sexo/idade/estatura.

## Reconstruir / iterar

```
git clone https://github.com/elvarofficial/teardown && cd teardown
npm install
cp -r <esta pasta>/src/pulmao-live sims/pulmao-live
node sims/build.mjs pulmao-live     # → teardown-out/dist/pulmao-live.html
```

Ficheiros em `src/pulmao-live/`: `lung.js` (modelo, sem three.js) · `body.js` (geometria) · `stage.js` (estúdio) ·
`console.js` (painéis) · `live.js` (página, tour, controlos) · `main.js`.
