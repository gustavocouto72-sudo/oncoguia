# Relatório de divergências — hepatocarcinoma
_Run 2026-07-21-protocolo-completo · 2026-07-21 · 7 regimes · 6 confirmado / 1 divergência / 0 incompleto_

> O sistema **informa e sinaliza**; a decisão é sempre do oncologista. Nada é publicado sem checkpoint humano.

## 🔴 Divergências (≥1 eixo diverge do protocolo)

### Regorafenibe (NÃO incorporado) — `hcc-2l-regorafenibe-nao-incorporado`
- **Cenário/subtipo:** metastatico · HCC avançado — 2ª linha, pós-sorafenibe (não incorporado)
- **Eixos que divergem:** esmo_mcbs
- **Estudo-pivô:** — (s/DOI)
- **esmo_mcbs:** DIVERGÊNCIA. Protocolo afirma ESMO-MCBS 3 e 'magnitude muito modesta'. Re-derivação: RESORCE tem HR 0,63 (redução de 37% no risco de morte) com ganho de ~2,8 meses — pela regra ESMO-MCBS v1.1 (não-curativo), HR ≤0,65 eleva o escore, alcançando MCBS 4 (o scorecard oficial ESMO grada regorafenibe HCC 2L como 4). A caracterização de 'benefício não expressivo' subestima a magnitude do efeito (embora o argumento de custo-efetividade/ICER para a não incorporação permaneça válido).

## 🟡 Incompletos (lacuna real de fonte)

_Nenhum incompleto neste lote._

## ⚠️ Confirmados com atenção (flags para revisão)

_Selo confirmado (os 4 eixos concordam), mas com sinalização relevante — citação a corrigir, lacuna de cobertura, ressalva regulatória, substituição de fármaco, decisão de não-incorporação verificada, etc._

### Tremelimumabe + Durvalumabe (STRIDE / HIMALAYA) — `hcc-1l-tremelimumabe-durvalumabe`
- **Cenário/subtipo:** metastatico · HCC localmente avançado/metastático — 1ª linha (restrito)
  - ⚠️ preferencia_farmacoeconomica: protocolo prefere IMBRAVE a STRIDE por dados indiretos e custo

### Pembrolizumabe (NÃO incorporado) — `hcc-2l-pembrolizumabe-nao-incorporado`
- **Cenário/subtipo:** metastatico · HCC avançado — 2ª linha, imunoterapia (não incorporado)
  - ⚠️ nao_incorporado: benefício pequeno + aplicabilidade Ásia (KEYNOTE-394); KEYNOTE-240 global negativo
  - ⚠️ doi_nao_validado: buscar DOI do KEYNOTE-394 (Qin JCO 2023)

## 🟢 Confirmados sem atenção adicional (4)

`hcc-1l-atezolizumabe-bevacizumabe`, `hcc-1l-sorafenibe`, `hcc-1l-lenvatinibe`, `hcc-2l-sorafenibe-lenvatinibe`
