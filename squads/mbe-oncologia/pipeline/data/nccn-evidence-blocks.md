# Framework — NCCN Evidence Blocks (Affordability / sustentabilidade)

O protocolo Orizonti usa o eixo **Affordability** do NCCN Evidence Blocks para ponderar
custo/sustentabilidade da recomendação, numa escala de **1 a 5** (5 = mais acessível/menor
custo total; 1 = mais caro).

## O que compõe o custo total
- Custo da droga (aquisição).
- Administração (infusão, day-clinic, monitorização).
- Suporte (pré-medicação, fatores de crescimento, antieméticos).
- Manejo de toxicidade (internações, eventos adversos).

## Como usar aqui
- Re-derivar a nota 1–5 pela composição acima com base em fontes públicas (NCCN Evidence Blocks quando acessível; senão, estimativa qualitativa transparente).
- **Contexto brasileiro:** a nota NCCN é dos EUA. Sempre sinalizar quando o custo/acesso no Brasil (incorporação SUS/CONITEC, cobertura ANS) provavelmente diverge — **sem inventar** um número local. Isso vira `flag` para o time.

## Saída
`status` + `valor_rederivado` (1–5) + `justificativa` (composição de custo) + `fonte`.

> Este é o 4º eixo pedido: além de "confiável" (GRADE) e "grande" (MCBS), quão **sustentável** é.
