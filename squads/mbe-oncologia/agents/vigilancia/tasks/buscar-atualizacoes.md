---
task: "Buscar atualizações"
order: 1
input:
  - consolidado: output/regimes-consolidados.json
  - fontes: pipeline/data/fontes-confiaveis.md
output:
  - candidatos: output/candidatos-atualizacao.json
---

# Buscar atualizações

Para cada regime consolidado, procura evidência nova que possa mudar algum eixo e propõe o delta (sem aplicar).

## Process
1. Montar consultas por regime/tumor nas fontes (PubMed, ASCO, ESMO+scorecards, NCCN, SBOC, alertas de bula).
2. **Usar as APIs abertas para localizar e ler o achado antes de descartá-lo como inacessível** (ver `pipeline/data/fontes-confiaveis.md`, seção "APIs abertas"): Europe PMC/PubMed (`search`/`esearch` por termo+tumor+data) para varrer novidades; Crossref/Unpaywall/OpenAlex para confirmar DOI e achar a versão OA; ClinicalTrials.gov (API v2) para ensaios em curso e mudanças de elegibilidade. Não marcar um sinal como não-verificável no paywall sem tentar a escada. Usar e-mail de contato real em `email=`/`mailto=`.
3. Filtrar por data > última revisão do regime; descartar o que não muda conduta/elegibilidade/benefício.
4. Para cada achado relevante: registrar `regimen_id`, `tipo` (novo RCT | meta-análise | diretriz | scorecard | segurança), `eixo_afetado`, `delta_proposto`, `fonte` (DOI/URL/NCT consultado), `forca_do_sinal` (forte | fraco).
5. Salvar `candidatos-atualizacao.json`.

## Veto Conditions
- Preprint isolado ou nota de imprensa → `forca_do_sinal: fraco`, nunca candidato firme.
- Achado já incorporado numa versão anterior → não repetir.
- Descartar um achado como inacessível no paywall sem ter tentado a escada de APIs abertas (Europe PMC / Unpaywall / OpenAlex / PubMed / ClinicalTrials.gov) → proibido.
- Inventar delta não confirmado pela fonte → proibido.

