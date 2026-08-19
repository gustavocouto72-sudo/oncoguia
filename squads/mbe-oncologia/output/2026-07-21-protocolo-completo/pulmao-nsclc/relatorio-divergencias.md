# Relatório de divergências — pulmao-nsclc
_Run 2026-07-21-protocolo-completo · 2026-07-21 · 21 regimes · 21 confirmado / 0 divergência / 0 incompleto_

> O sistema **informa e sinaliza**; a decisão é sempre do oncologista. Nada é publicado sem checkpoint humano.

## 🔴 Divergências (≥1 eixo diverge do protocolo)

_Nenhuma divergência neste lote._

## 🟡 Incompletos (lacuna real de fonte)

_Nenhum incompleto neste lote._

## ⚠️ Confirmados com atenção (flags para revisão)

_Selo confirmado (os 4 eixos concordam), mas com sinalização relevante — citação a corrigir, lacuna de cobertura, ressalva regulatória, substituição de fármaco, decisão de não-incorporação verificada, etc._

### Durvalumabe (AEGEAN) / Nivolumabe (CheckMate 77T) perioperatório (NÃO incluído) — `nsclc-periop-durva-nivo-nao-incluido`
- **Cenário/subtipo:** neoadjuvancia · CPNPC ressecável — perioperatório com durvalumabe/nivolumabe (não incluído)
  - ⚠️ nao_incluido: EFS positivo mas SG imatura (AEGEAN/CheckMate 77T); reavaliar com dados maduros

### Imunoterapia adjuvante em estágio I (NÃO incluída) — `nsclc-adj-io-estagioI-nao-incluido`
- **Cenário/subtipo:** adjuvancia · CPNPC estágio I — imunoterapia adjuvante (não incluída)
  - ⚠️ nao_incluido: sem benefício de imunoterapia adjuvante em estágio I; risco de toxicidade em cenário curativo

### Atezolizumabe + Bevacizumabe + QT (IMpower150) — NÃO incluído — `nsclc-met-atezo-bev-nao-incluido`
- **Cenário/subtipo:** metastatico · CPNPC metastático — atezolizumabe + bevacizumabe + QT (não incluído)
  - ⚠️ nao_incluido: ganho de SG marginal (~1,7 mês) e maior toxicidade (IMpower150)

### QT + Durvalumabe + Tremelimumabe (POSEIDON) — NÃO incluído — `nsclc-met-qt-durva-treme-nao-incluido`
- **Cenário/subtipo:** metastatico · CPNPC metastático — QT + durvalumabe + tremelimumabe (não incluído)
  - ⚠️ nao_incluido: benefício marginal + toxicidade da dupla imunoterapia (POSEIDON)

### Amivantamab + Lazertinibe (MARIPOSA) / + QT (MARIPOSA2) — NÃO incluído — `nsclc-met-amivantamab-nao-incluido`
- **Cenário/subtipo:** metastatico · CPNPC metastático EGFR mutado — amivantamab (não incluído)
  - ⚠️ nao_incluido: benefício incremental marginal + toxicidade (MARIPOSA/MARIPOSA2, MCBS 2)

### Carboplatina + Pemetrexede + Amivantamab (PAPILLON) — NÃO incluído — `nsclc-met-papillon-exon20-nao-incluido`
- **Cenário/subtipo:** metastatico · CPNPC metastático EGFR exon 20 — amivantamab+QT PAPILLON (não incluído)
  - ⚠️ nao_incluido: SG imatura, MCBS 3 (PAPILLON)
  - ⚠️ cobertura: único alvo para EGFR exon 20; não inclusão deixa subgrupo raro só com QT — revisar com SG madura

### Dupla imuno / Atezo+Bev / Ramucirumab+Docetaxel / ADCs (NÃO incluídos) — `nsclc-met-2l-nao-incluidos`
- **Cenário/subtipo:** metastatico · CPNPC metastático — combinações de 2ª linha (não incluídas)
  - ⚠️ nao_incluido: dupla imuno (benefício SLP), ramucirumab+docetaxel (marginal), ADCs (SG imatura/conflitante)

## 🟢 Confirmados sem atenção adicional (14)

`nsclc-neoadj-nivolumabe-qt`, `nsclc-periop-pembrolizumabe-qt`, `nsclc-adj-qt-platina`, `nsclc-adj-osimertinibe-egfr`, `nsclc-adj-alectinibe-alk`, `nsclc-adj-atezolizumabe-pdl1`, `nsclc-def-crt-durvalumab`, `nsclc-met-io-mono-pdl1alto`, `nsclc-met-io-qt-pdl1baixo`, `nsclc-met-osimertinibe-egfr`, `nsclc-met-osi-qt-egfr`, `nsclc-met-alectinibe-alk`, `nsclc-met-crizotinibe-ros1`, `nsclc-met-2l-io-ou-docetaxel`
