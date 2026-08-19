# Squad: MBE Oncologia — Fábrica de Evidência

Transforma protocolos institucionais de oncologia (PDF) em **evidência computável, viva e
auditável**. Cada regime é extraído, **confrontado de forma adversarial** em quatro eixos
(GRADE, ESMO-MCBS, NCCN Evidence Blocks, elegibilidade), consolidado com selo de confiança,
revisado por um oncologista e **vigiado** por atualizações.

## Estado
Instalado e executável em `squads/mbe-oncologia/`. Agentes em `.agent.md` completo +
`squad-party.csv` (formato do runner opensquad).

## Como rodar
```
/opensquad run mbe-oncologia
```
O pipeline pausa nos 3 checkpoints (escolha do lote, revisão humana, triagem de updates).
Processe **um tumor por lote** para manter lotes revisáveis.

## Pipeline
1. **Entrada** — escolher tumor + PDF (checkpoint)
2. **Extração** — Elisa → `regimes-extraidos.json`
3–6. **Verificação adversarial** — Gael (GRADE), Bruna (ESMO-MCBS), Caio (custo), Elton (elegibilidade)
7. **Consolidação** — Consuelo → selo de confiança + `relatorio-divergencias.md`
8. **Revisão humana** — oncologista (checkpoint) 🔴
9. **Vigilância** — Vitor → `candidatos-atualizacao.json`
10. **Triagem de updates** — oncologista (checkpoint)

## Saída
`output/regimes-consolidados.json` segue o schema em `pipeline/data/schema-regime.md` —
é o mesmo contrato que a aplicação (o protótipo de solicitação) consome.

## Princípios
- O protocolo é confrontado, não copiado.
- Divergência é o produto (é o valor sobre um PDF).
- Nada entra no ar sem checkpoint humano → correto, auditável e do lado "informa, médico decide".
