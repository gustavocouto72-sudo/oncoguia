# Lote de processamento

**Tumor:** canal-anal
**Arquivo fonte:** `data/input/Protocolos de Oncologia 2025 2.pdf (cap. gastrointestinal — neoplasias de margem/canal anal, pp. 71-72)`
**Escopo do lote:** todos os cenários sistêmicos do capítulo (localizado/adjuvante quando há regime sistêmico, metastático/avançado)
**Data:** 2026-07-21
**Run:** 2026-07-21-protocolo-completo

## Método
- Extração fiel dos regimes do protocolo (esquema, elegibilidade, referência com DOI/estudo).
- Confronto adversarial dos 4 eixos (GRADE, ESMO-MCBS, NCCN affordability, elegibilidade) contra a fonte primária.
- Verificação por escada de APIs abertas: Crossref (valida DOI/citação), Europe PMC/PubMed (desenho/desfecho), ClinicalTrials.gov (elegibilidade), Unpaywall/OpenAlex (íntegra aberta).
- Selo determinístico: confirmado | divergencia | incompleto (precedência diverge > lacuna).
- Campo ausente = null. Nada inventado.
