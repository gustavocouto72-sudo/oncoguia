# Casos sintéticos — resultado do check [11] (gerado por matriz_casos.py)

| caso | esperado | falhas do portão | veredito |
|---|---|---|---|
| `sint-00-controle` | PASSA | — | ✓ passou |
| `sint-01-regra1-A-sem-eventos` | FALHA regra 1 | regra 1: certeza A exige eventos ≥ 300 ou efeito grande (RRR ≥ 30%, IC sup ≤ 0,85) ou corpo com certeza declarada alta — eventos=None | ✓ barrou na regra esperada |
| `sint-02-regra2-SLP-sem-SG-em-A` | FALHA regra 2 | regra 2: desfecho crítico SLP é substituto sem SG — indireta tem de ser ≤ -1<br>regra 2: desfecho crítico SLP é substituto sem SG — teto B (está A)<br>regra 1: certeza A com desfecho crítico substituto | ✓ barrou na regra esperada |
| `sint-03-regra3-faseII-em-A` | FALHA regra 3 | regra 3: elevações só se aplicam a desenho que parte de C (fase II/observacional) | ✓ barrou na regra esperada |
| `sint-04-regra4-IC-cruza-nulo-imprecisao-0` | FALHA regra 4 | regra 4: imprecisão tem de ser ≤ -1 (limite superior do IC 1.0 > 0,95) | ✓ barrou na regra esperada |
| `sint-05a-regra5-nao-incorporado-a-favor-nao-incorporado` | FALHA regra 5 (direção) | regra 5: regime NÃO incorporado com direção a_favor — a instituição não o recomenda; direção é contra | ✓ barrou na regra esperada |
| `sint-05b-regra5-forte-com-MCBS-baixo` | FALHA regra 5 (MCBS) | regra 5: forte a favor com ESMO-MCBS 2 (paliativo) — exige ≥ 3 paliativo / A-B curativo | ✓ barrou na regra esperada |
| `sint-06a-regra6-farmaco-fora-do-pivo` | FALHA regra 6 (cobertura) | regra 6: fármaco(s) do regime ausente(s) da intervenção do pivô: ['axitinibe']<br>regra 6: pivo.sustenta=True contradiz cobertura/comparador da época/primário (calculado False)<br>regra 6: pivo_nao_sustenta tem de ser True<br>regra 6: pivô não sustenta o regime — certeza ≤ B até trocar a referência | ✓ barrou na regra esperada |
| ↳ WARN | | regra 6: pivô NÃO sustenta (fármaco ausente; SINTÉTICO — braço experimental = regime; primário SG positivo) | |
| `sint-06b-regra6-primario-negativo` | FALHA regra 6 (sustenta) | regra 6: pivo.sustenta=True contradiz cobertura/comparador da época/primário (calculado False)<br>regra 6: pivo_nao_sustenta tem de ser True<br>regra 6: pivô não sustenta o regime — certeza ≤ B até trocar a referência | ✓ barrou na regra esperada |
| ↳ WARN | | regra 6: pivô NÃO sustenta (primário negativo; SINTÉTICO — braço experimental = regime; primário SG positivo) | |
| `sint-07a-regra7-valor-fora-da-transcricao` | FALHA regra 7 | regra 7: valor=0.53 NÃO aparece na transcrição da fonte | ✓ barrou na regra esperada |
| `sint-07b-regra7-sem-transcricao` | FALHA regra 7 | regra 7: efeito.transcricao vazia — sem transcrição da fonte o status é indeterminado | ✓ barrou na regra esperada |
| `sint-09-regra3-elevacao-com-rebaixamento` | FALHA regra 3 (elevação c/ rebaixamento) | regra 3: elevação com domínio rebaixado — guia de prompts §7: elevar só quando não houve rebaixamento | ✓ barrou na regra esperada |
| `sint-C1-eventos-sem-deducao-declarada` | FALHA regra 7 (C1) | regra 7/C1: eventos=640 não está na transcrição e eventos_por não começa com 'deduzido de <cálculo>' | ✓ barrou na regra esperada |
| `sint-C2-comparador-obsoleto-sem-decisao` | FALHA C2 | C2: comparador_padrao_atual=false exige comparador_muda_decisao true/false (com o porquê em pivo.por) | ✓ barrou na regra esperada |
| `sint-C4-interina-sem-rebaixar` | FALHA regra 4 (C4) | regra 4: imprecisão tem de ser ≤ -1 (análise interina sem versão mais madura (C4)) | ✓ barrou na regra esperada |
| `sint-C5-faseII-imprecisao-muito-seria` | FALHA regra 4 (C5) | regra 4/C5: eventos 87 < 300 e IC que não exclui o nulo a 95% — imprecisão tem de ser -2 | ✓ barrou na regra esperada |
| `sint-C8a-adjuvante-SLD-duro-em-A` | PASSA | — | ✓ passou |
| `sint-C8b-metastatico-declara-SLD` | FALHA C8 | C8: desfecho 'SLD' é duro só em cenário curativo — regime é 'metastatico' (metastático: só SG/mortalidade são duros; SLP/ORR são substitutos) | ✓ barrou na regra esperada |
| `sint-C9a-corpo-alegado-sem-referencia` | FALHA C9 | C9: corpo de evidência / meta-análise alegado no texto sem pivo.referencia_corpo — não sustenta A<br>regra 1: certeza A exige eventos ≥ 300 ou efeito grande (RRR ≥ 30%, IC sup ≤ 0,85) ou corpo com certeza declarada alta — eventos=None | ✓ barrou na regra esperada |
| `sint-C9b-corpo-moderada-em-A` | FALHA C9 | C9: certeza A acima do teto da revisão (declarada moderada)<br>regra 1: certeza A exige eventos ≥ 300 ou efeito grande (RRR ≥ 30%, IC sup ≤ 0,85) ou corpo com certeza declarada alta — eventos=None | ✓ barrou na regra esperada |
| ↳ WARN | | C9: certeza avaliada sobre corpo de evidência 10.1002/14651858.cd000000 (cochrane; SINTÉTICO 2L vs BSC; declarada: moderada) | |
| `sint-C9c-corpo-alta-em-A` | PASSA | — | ✓ passou |
| ↳ WARN | | C9: certeza avaliada sobre corpo de evidência 10.1002/14651858.cd000000 (cochrane; SINTÉTICO 2L vs BSC; declarada: alta) | |
| `sint-08-forma-certeza-nao-e-aritmetica` | FALHA aritmética | certeza A ≠ aritmética B (inicial A 0+0+0+-1+0)<br>regra 1: certeza A com domínio rebaixado | ✓ barrou na regra esperada |

**Resultado: todos os casos se comportaram como esperado.**
