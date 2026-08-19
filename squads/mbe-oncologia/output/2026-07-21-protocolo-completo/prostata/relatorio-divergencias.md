# Relatório de divergências — prostata
_Run 2026-07-21-protocolo-completo · 2026-07-21 · 18 regimes · 14 confirmado / 1 divergência / 3 incompleto_

> O sistema **informa e sinaliza**; a decisão é sempre do oncologista. Nada é publicado sem checkpoint humano.

## 🔴 Divergências (≥1 eixo diverge do protocolo)

### Abiraterona + Prednisona — `prostata-mcrpc-1l-abiraterona-prednisona`
- **Cenário/subtipo:** metastatico · Metastático resistente à castração (mCRPC) — 1ª linha
- **Eixos que divergem:** elegibilidade
- **Estudo-pivô:** COU-AA-302 (10.1016/S1470-2045(14)71205-7)
- **elegibilidade:** DIVERGÊNCIA. COU-AA-302 restringiu a chemo-naive, assintomático/pouco sintomático e SEM metástase visceral. O protocolo aplica abiraterona a mCRPC de 1ª linha de forma ampla — inclui pacientes sintomáticos e/ou com metástase visceral que o estudo-pivô excluiu (indicação além da elegibilidade do pivô).

## 🟡 Incompletos (lacuna real de fonte)

### Carboplatina + Docetaxel/Paclitaxel — `prostata-variante-agressiva-carbo-taxano`
- **Cenário/subtipo:** metastatico · Variante histológica agressiva (anaplásico/pequenas células/neuroendócrino)
- **Lacunas:** grade_sem_estudo_pivo
- **Motivo:** Protocolo não cita estudo-pivô para este esquema; sem fonte primária recuperável para re-derivar GRADE. Lacuna real.

### Cisplatina + Etoposídeo — `prostata-variante-agressiva-cisplatina-etoposideo`
- **Cenário/subtipo:** metastatico · Variante histológica agressiva (pequenas células/neuroendócrino)
- **Lacunas:** grade_sem_estudo_pivo
- **Motivo:** Extrapolação do carcinoma de pequenas células; protocolo não cita estudo-pivô próprio. Lacuna de fonte primária.

### Ácido Zoledrônico — `prostata-mcrpc-terapia-ossea-zoledronico`
- **Cenário/subtipo:** metastatico · mCRPC com metástases ósseas — prevenção de eventos ósseos
- **Lacunas:** grade_sem_estudo_pivo
- **Motivo:** Protocolo não cita estudo-pivô específico; benefício de prevenção de eventos ósseos é padrão consolidado mas sem fonte primária citada. Lacuna de fonte.

## ⚠️ Confirmados com atenção (flags para revisão)

_Selo confirmado (os 4 eixos concordam), mas com sinalização relevante — citação a corrigir, lacuna de cobertura, ressalva regulatória, substituição de fármaco, decisão de não-incorporação verificada, etc._

### Docetaxel (quimio-hormonioterapia) — `prostata-mcspc-docetaxel`
- **Cenário/subtipo:** metastatico · Metastático sensível à castração (mCSPC)
  - ⚠️ magnitude_subgrupo: benefício de SG concentrado em doença de alto volume (CHAARTED)
  - ⚠️ magnitude_subgrupo: benefício de SG concentrado em doença de alto volume (CHAARTED)

### Olaparibe+Abiraterona / Talazoparibe+Enzalutamida (NÃO incorporado) — `prostata-mcrpc-1l-parp-nao-incorporado`
- **Cenário/subtipo:** metastatico · mCRPC com mutação BRCA1/2 (HRR) — inibidores de PARP
  - ⚠️ nao_incorporado: decisão do protocolo confirmada pela re-derivação (MCBS 2, affordability baixa)

### Cabazitaxel (NÃO incorporado) — `prostata-mcrpc-2l-cabazitaxel-nao-incorporado`
- **Cenário/subtipo:** metastatico · mCRPC pós-docetaxel — 2ª linha
  - ⚠️ nao_incorporado: decisão do protocolo confirmada pela re-derivação (MCBS 2, benefício modesto)

## 🟢 Confirmados sem atenção adicional (11)

`prostata-loc-altorisco-ebrt-tda`, `prostata-rb-rt-salvamento-tda`, `prostata-mcspc-abiraterona-prednisona`, `prostata-mcspc-enzalutamida`, `prostata-mcspc-apalutamida`, `prostata-mcspc-tripla-docetaxel-darolutamida`, `prostata-nmcrpc-enzalutamida`, `prostata-nmcrpc-apalutamida`, `prostata-nmcrpc-darolutamida`, `prostata-mcrpc-1l-enzalutamida`, `prostata-mcrpc-1l-docetaxel-prednisona`
