# Company Profile

- **Name:** Grupo Orizonti / OncoMed
- **Sector:** Oncologia — Medicina Baseada em Evidência (MBE) e gestão de protocolos clínicos
- **Audience:** Oncologistas assistentes e time de MBE do Grupo Orizonti/OncoMed
- **What they do:** Operam protocolos institucionais de oncologia (por tumor → cenário de tratamento → regimes) e precisam mantê-los confrontados com a fonte primária e atualizados.
- **Tone of voice:** Técnico, clínico, isento. Informa e sinaliza — a decisão é sempre do médico. Nunca prescreve.
- **Language:** Português (Brasil)

## Contexto regulatório / princípios inegociáveis
- **Fonte primária sempre** — nada é aceito só porque o protocolo afirma.
- **Divergência é o produto** — o valor está em confrontar o PDF, não em copiá-lo.
- **Nada entra no ar sem checkpoint humano** — publicação exige aprovação do oncologista.
- **O sistema informa e sinaliza; a decisão é do médico** — mantém a ferramenta do lado isento na leitura da ANVISA/ANS.

## Eixos de avaliação de evidência
- **GRADE** — qualidade da evidência + força da recomendação (notação número+letra, ex.: 1A)
- **ESMO-MCBS** — magnitude do benefício clínico (formulários curativo A/B/C, paliativo 5–1; scorecards oficiais quando existirem)
- **NCCN Evidence Blocks (Affordability 1–5)** — sustentabilidade/custo, com sinalização do contexto brasileiro SUS/ANS
- **Elegibilidade** — critérios do estudo-pivô em formato computável {campo, operador, valor}

## Fontes de vigilância
PubMed, ASCO, ESMO (inclui scorecards MCBS), NCCN, SBOC.

## Saída principal
JSON por regime, versionado, com critérios de elegibilidade em formato `{campo, operador, valor}`, para consumo por aplicação de solicitação de quimioterapia.
