# -*- coding: utf-8 -*-
"""Decisões curadas de expectativa_uso — parte B (demais tumores)."""
from overrides_a import F, FD, FI, AP, AD, API, SEM_NUM, SEM_DOI, NAO_INC

OV = {}

# ================= PULMÃO NSCLC =================
OV.update({
 "nsclc-neoadj-nivolumabe-qt": FI("3 ciclos declarados, periodicidade não declarada no esquema", ciclos=3),
 "nsclc-periop-durva-nivo-nao-incluido": FI(NAO_INC),
 "nsclc-adj-io-estagioI-nao-incluido": FI(NAO_INC + "; regime marcado como não incluído"),
 "nsclc-periop-pembrolizumabe-qt": FI("4 ciclos neoadjuvantes + pembrolizumabe adjuvante 3/3 semanas por 1 ano; total único não derivável"),
 "nsclc-def-crt-durvalumab": F(24, 14, "24 ciclos de durvalumabe de consolidação; a quimiorradioterapia prévia não está contabilizada aqui"),
 "nsclc-met-io-mono-pdl1alto": AP(10.3, "10.1056/NEJMoa1606774", "PFS mediana do braço pembrolizumabe (KEYNOTE-024); o esquema admite atezolizumabe/cemiplimabe"),
 "nsclc-met-io-qt-pdl1baixo": AP(8.8, "10.1056/NEJMoa1801005", "PFS mediana do braço pembrolizumabe+QT (KEYNOTE-189); inclui indução 4 ciclos + manutenção"),
 "nsclc-met-atezo-bev-nao-incluido": AP(8.3, "10.1056/NEJMoa1716948", "PFS mediana do braço ABCP (IMpower150)"),
 "nsclc-met-qt-durva-treme-nao-incluido": API(SEM_NUM),
 "nsclc-met-osimertinibe-egfr": AD(20.7, "10.1056/NEJMoa1913662", "exposição mediana ao osimertinibe na análise de sobrevida global do FLAURA (comparador 11,5 meses) — duração de tratamento reportada, não proxy de PFS"),
 "nsclc-met-osi-qt-egfr": API(SEM_NUM),
 "nsclc-met-amivantamab-nao-incluido": API(SEM_NUM),
 "nsclc-met-papillon-exon20-nao-incluido": AP(11.4, "10.1056/NEJMoa2306441", "PFS mediana do braço amivantamabe+QT (PAPILLON)"),
 "nsclc-met-alectinibe-alk": API(SEM_NUM),
 "nsclc-met-crizotinibe-ros1": AP(19.2, "10.1056/NEJMoa1406766", "PFS mediana do braço único de crizotinibe em ROS1+ (PROFILE 1001)"),
 "nsclc-met-2l-io-ou-docetaxel": AP(2.3, "10.1056/NEJMoa1507643", "PFS mediana do braço nivolumabe (CheckMate 057); o esquema admite outras IO ou docetaxel, com PFS distintas"),
 "nsclc-met-2l-nao-incluidos": API(SEM_DOI),
})

# ================= PULMÃO SCLC =================
OV.update({
 "sclc-limitada-cisplatina-etoposideo-rt-durvalumab": FI("QT 4 ciclos 21/21d concomitante à RT seguida de durvalumabe 28/28d por ATÉ 24 meses (teto, não duração fixa); total único não derivável"),
 "sclc-extensa-cisplatina-etoposideo": FI("esquema prevê faixa de 4 a 6 ciclos; N único não derivável", per=21),
 "sclc-extensa-io-1l-nao-incluido": API(SEM_DOI),
 "sclc-2l-topotecano": API(SEM_NUM),
 "sclc-retratamento-mesmo-esquema": FI(SEM_DOI + "; esquema remete à 1ª linha sem declarar nº de ciclos"),
 "sclc-2l-tarlatamabe-nao-incluido": API(SEM_DOI),
})

# ================= COLORRETAL =================
OV.update({
 "retal-neoadj-crt-capecitabina": FI("capecitabina concomitante à RT; duração amarrada ao curso de radioterapia, não declarada em ciclos no esquema"),
 "retal-tnt-folfox-capox": FI("duas alternativas com periodicidades diferentes (FOLFOX 8 ciclos 14/14d ou CAPOX 21/21d); total único não derivável", ciclos=8),
 "colon-adj-fluoropirimidina-stageII": FI("8 ciclos de capecitabina declarados sem periodicidade explícita; alternativa 5-FU/LV sem nº de ciclos", ciclos=8),
 "colon-adj-oxaliplatina-stageIII": FI("duas alternativas (FOLFOX 12 ciclos 14/14d ou CAPOX 8 ciclos 21/21d) e menção a 3 meses conforme IDEA; total único não derivável"),
 "crc-met-quimio-doublet": AP(9.0, "10.1200/JCO.2000.18.16.2938", "PFS mediana do braço oxaliplatina+LV5FU2 (de Gramont, FOLFOX4); o esquema admite FOLFIRI/CAPOX"),
 "crc-met-folfoxiri": AP(12.1, "10.1056/NEJMoa1403108", "PFS mediana do braço experimental FOLFOXIRI+bevacizumabe (TRIBE)"),
 "crc-met-anti-egfr": API(SEM_NUM),
 "crc-met-pembrolizumabe-msi": AP(16.5, "10.1016/j.annonc.2024.11.012", "PFS mediana do braço pembrolizumabe (KEYNOTE-177)"),
 "crc-met-tas-bevacizumab": AP(5.6, "10.1056/NEJMoa2214963", "PFS mediana do braço TAS-102+bevacizumabe (SUNLIGHT)"),
 "crc-met-bevacizumabe-1l-nao-incorporado": API("análise agrupada referenciada relata efeito por subgrupo, sem PFS mediana no abstract"),
 "crc-met-aflibercepte-nao-incorporado": API(SEM_NUM),
 "crc-met-regorafenibe-nao-incorporado": API(SEM_NUM),
})

# ================= PRÓSTATA =================
OV.update({
 "prostata-loc-altorisco-ebrt-tda": FI("esquema declara faixa de 18 a 36 meses de TDA; duração única não derivável"),
 "prostata-rb-rt-salvamento-tda": FI("TDA concomitante à RT de salvamento, sem duração declarada no esquema"),
 "prostata-mcspc-abiraterona-prednisona": AP(33.0, "10.1056/NEJMoa1704174", "rPFS mediana do braço abiraterona (LATITUDE) — sobrevida livre de progressão radiográfica"),
 "prostata-mcspc-enzalutamida": API(SEM_NUM),
 "prostata-mcspc-apalutamida": API("TITAN reporta rPFS em 24 meses (taxa), não mediana"),
 "prostata-mcspc-tripla-docetaxel-darolutamida": API("terapia contínua (darolutamida + TDA) com docetaxel 6 ciclos embutido; pivotal não reporta duração mediana nem PFS mediana no abstract"),
 "prostata-nmcrpc-enzalutamida": API(SEM_NUM),
 "prostata-nmcrpc-apalutamida": API(SEM_NUM),
 "prostata-nmcrpc-darolutamida": API(SEM_NUM),
 "prostata-mcrpc-1l-abiraterona-prednisona": API(SEM_NUM),
 "prostata-mcrpc-1l-enzalutamida": API("PREVAIL reporta rPFS em 12 meses (taxa), não mediana"),
 "prostata-mcrpc-1l-docetaxel-prednisona": F(6, 21, "6 ciclos de docetaxel; a prednisona contínua e a TDA de base não estão contabilizadas aqui"),
 "prostata-mcspc-docetaxel": F(6, 21, "6 ciclos de docetaxel; a TDA de base é contínua e não está contabilizada aqui"),
 "prostata-mcrpc-1l-parp-nao-incorporado": API(SEM_NUM),
 "prostata-mcrpc-2l-cabazitaxel-nao-incorporado": API(SEM_NUM),
 "prostata-variante-agressiva-carbo-taxano": API(SEM_DOI),
 "prostata-variante-agressiva-cisplatina-etoposideo": API(SEM_DOI),
 "prostata-mcrpc-terapia-ossea-zoledronico": API(SEM_DOI + "; terapia óssea de suporte, sem duração declarada"),
})

# ================= TESTÍCULO =================
OV.update({
 "testiculo-seminoma-eI-carboplatina-adj": FI("esquema prevê 1 ou 2 ciclos; N único não derivável"),
 "testiculo-nsgct-eI-bep1": FI("1 ciclo único de BEP adjuvante; o esquema não declara periodicidade (irrelevante com ciclo único, mas não derivável do texto)", ciclos=1),
 "testiculo-seminoma-eII-bep-ep": FI("duas alternativas com nº distinto (BEP 3 ciclos ou EP 4 ciclos); N único não derivável", per=21),
 "testiculo-avancado-baixorisco-bep3-ep4": FI("duas alternativas com nº distinto (BEP 3 ciclos ou EP 4 ciclos); N único não derivável", per=21),
 "testiculo-avancado-intalto-bep4-vip4": F(4, 21, "BEP 4 ciclos ou VIP 4 ciclos — as duas alternativas têm o mesmo nº de ciclos e a mesma periodicidade"),
 "testiculo-recidiva-tip-veip": FI("TIP ou VeIP, ambos 4 ciclos, mas o esquema não declara a periodicidade", ciclos=4),
 "testiculo-refrataria-paliativo-gemox": API(SEM_DOI),
})

# ================= ESÔFAGO-ESTÔMAGO =================
OV.update({
 "eso-perioperatorio-flot": F(8, 14, "4 ciclos pré + 4 pós-operatórios = 8 ciclos de 14 dias"),
 "eso-def-crt-cisplatina-5fu": FI("2 ciclos concomitantes à RT (semanas 1 e 5); esquema não declara periodicidade em dias", ciclos=2),
 "gastrico-adj-nivolumabe": FI("duas fases (240 mg 14/14d por 16 semanas → 480 mg 28/28d) com duração total de 1 ano; nº de ciclos único não derivável"),
 "gastrico-adj-crt-5fu-lv": FI("esquema trimodal INT0116 sem nº de ciclos nem periodicidade declarados"),
 "gastrico-met-1l-cisplatina-5fu": API("periodicidade declarada em faixa (21 a 28 dias) e pivotal sem PFS mediana no abstract"),
 "gastrico-met-1l-folfox": AP(5.8, "10.1200/JCO.2007.13.9378", "PFS mediana do braço FLO (5-FU/leucovorina/oxaliplatina), o mais próximo do FOLFOX no pivotal"),
 "gastrico-met-1l-capox": API("o pivotal do regime testa FLO (5-FU infusional), não CAPOX; transportar o número seria trocar o esquema"),
 "gastrico-met-2l-paclitaxel": API(SEM_NUM),
 "gastrico-met-2l-irinotecano-folfiri": API(SEM_NUM),
 "gastrico-met-docetaxel": API(SEM_NUM),
 "gastrico-met-1l-io-qt-cps": API("CheckMate 649 reporta apenas hazard ratio de PFS no abstract, sem mediana"),
 "gastrico-met-her2-trastuzumabe-qt": API(SEM_NUM),
 "gastrico-met-her2-pembro-tras-qt": AP(10.0, "10.1016/S0140-6736(23)02033-0", "PFS mediana do braço pembrolizumabe (KEYNOTE-811, 2ª análise interina)"),
 "gastrico-met-her2-2l-tdxd": API("DESTINY-Gastric01 lista PFS como desfecho secundário, sem mediana no abstract"),
 "gastrico-tas102-nao-rotineiro": API(SEM_NUM),
 "gastrico-ramucirumabe-nao-incorporado": API(SEM_NUM),
 "gastrico-zolbetuximabe-nao-incorporado": AP(10.61, "10.1016/S0140-6736(23)00620-7", "PFS mediana do braço zolbetuximabe (SPOTLIGHT)"),
})

# ================= CABEÇA E PESCOÇO =================
OV.update({
 "cp-cec-def-cisplatina-crt": F(3, 21, "3 doses de cisplatina (D1, D22, D43) concomitantes à RT — intervalo de 21 dias explícito nos dias declarados"),
 "cp-cec-def-cisplatina-semanal": FI("cisplatina semanal durante a RT; nº de semanas não declarado no esquema", per=7),
 "cp-cec-def-cetuximabe-rt": FI("cetuximabe semanal durante a RT; nº de semanas não declarado no esquema", per=7),
 "cp-cec-adj-cisplatina-crt": FI("duas alternativas (semanal ou 3 doses D1/D22/D43) e duração amarrada à RT, não declarada"),
 "cp-cec-met-1l-pembrolizumabe-qt-cps1": API("QT por ATÉ 6 ciclos (teto) seguida de pembrolizumabe de manutenção; pivotal sem PFS mediana no abstract"),
 "cp-cec-met-1l-pembrolizumabe-mono-cps": API(SEM_NUM),
 "cp-cec-met-1l-cetuximabe-cps-neg": AP(5.6, "10.1056/NEJMoa0802656", "PFS mediana do braço com cetuximabe (EXTREME); QT por até 6 ciclos + cetuximabe de manutenção"),
 "cp-cec-met-2l-nivolumabe": AP(2.0, "10.1056/NEJMoa1602252", "PFS mediana do braço nivolumabe (CheckMate 141)"),
 "cp-cec-met-2l-nivolumabe-cps-neg-nao-incorporado": API("CheckMate 141 não reporta a mediana de PFS do subgrupo CPS<1, que é a população deste regime"),
 "cp-naso-crt-cisplatina": FI("duas alternativas de periodicidade (21/21d ou semanal) e duração amarrada à RT, não declarada"),
 "cp-naso-inducao-cisplatina-gemcitabina": F(3, 21, "3 ciclos de indução; a quimiorradiação subsequente não está contabilizada aqui"),
 "cp-naso-met-cisplatina-gemcitabina": F(6, 21, "6 ciclos de gencitabina+cisplatina paliativos"),
 "cp-naso-toripalimabe-nao-incluido": AP(21.4, "10.1001/jama.2023.20181", "PFS mediana do braço toripalimabe (JUPITER-02)"),
 "cp-tireoide-diferenciado-lenvatinibe": AP(18.3, "10.1056/NEJMoa1406470", "PFS mediana do braço lenvatinibe (SELECT)"),
 "cp-tireoide-diferenciado-cabozantinibe": API("COSMIC-311: PFS mediana do braço cabozantinibe não atingida na análise interina"),
 "cp-tireoide-medular-quimio": API(SEM_NUM),
 "cp-tireoide-anaplasico-quimio": API(SEM_DOI),
})

# ================= COLO DE ÚTERO =================
OV.update({
 "colo-adj-cisplatina-crt": F(6, 7, "6 doses semanais de cisplatina concomitantes à RT; braquiterapia não contabilizada"),
 "colo-qrt-induction-interlace": F(12, 7, "6 semanas de indução semanal + 6 semanas de cisplatina semanal com RT = 12 aplicações semanais"),
 "colo-qrt-io-keynote-a18": FI("quimiorradiação 5 semanas + pembrolizumabe 21/21d nessa fase e depois 400 mg 42/42d ×15; fases com periodicidades distintas, total único não derivável"),
 "colo-met-1l-pembrolizumabe-qt-cps1": API("pembrolizumabe por ATÉ 35 ciclos (teto) + QT por até 6 ciclos; pivotal sem PFS mediana no abstract"),
 "colo-met-1l-qt-cps-neg": AP(4.8, "10.1200/JCO.2004.04.170", "PFS mediana do braço cisplatina+paclitaxel (GOG-169)"),
 "colo-met-cemiplimabe-refrataria": API("cemiplimabe por ATÉ 2 anos (teto, não duração fixa); pivotal sem PFS mediana no abstract"),
 "colo-met-bevacizumabe-nao-incluido": API(SEM_NUM),
 "colo-met-2l-monoterapia": API(SEM_NUM),
})

# ================= BEXIGA =================
OV.update({
 "bexiga-nmibc-intermediario-gemcitabina-intravesical": FI("indução 6 instilações semanais + manutenção mensal por 12 meses; fases com periodicidades distintas, total único não derivável"),
 "bexiga-nmibc-bcg-intravesical": FI("indução 6 semanais + manutenção 3 instilações nos meses 3, 6 e 12; total único não derivável"),
 "bexiga-nmibc-bcg-unresponsive-gem-docetaxel": FI("indução 6 semanais + manutenção mensal por 12 meses; total único não derivável"),
 "bexiga-mibc-tmt-cisplatina": FI("periodicidade declarada em faixa (2 a 3 semanas) ou semanal durante a RT; não derivável"),
 "bexiga-mibc-tmt-5fu-mitomicina": FI("5-FU em infusão contínua nos ciclos 1 e 5 da RT; esquema amarrado ao curso de radioterapia, sem nº de ciclos"),
 "bexiga-mibc-neoadj-gc-durvalumab": FI(NAO_INC + " (NIAGARA: neoadjuvante + durvalumabe adjuvante, sem nº de ciclos no esquema)"),
 "bexiga-mibc-neoadj-gc": FI("esquema prevê faixa de 3 a 4 ciclos; N único não derivável", per=21),
 "bexiga-mibc-neoadj-mvac-dd": FI("dd-MVAC 14/14d sem nº de ciclos declarado no esquema", per=14),
 "bexiga-mibc-adj-gc-mvac": FI("esquema prevê faixa de 3 a 4 ciclos, sem periodicidade declarada"),
 "bexiga-mibc-adj-nivolumabe": API("nivolumabe por ATÉ 1 ano (teto, não duração fixa); pivotal sem PFS mediana no abstract"),
 "bexiga-met-1l-enfortumab-pembrolizumabe": API(SEM_DOI),
 "bexiga-met-1l-gc-nivolumabe": API(SEM_DOI),
 "bexiga-met-1l-gc-avelumabe-manutencao": API(SEM_DOI),
 "bexiga-met-1l-io-isolada-cisplatina-inelegivel": API(SEM_DOI),
 "bexiga-met-1l-gc": FI("esquema prevê faixa de 4 a 6 ciclos; N único não derivável", per=21),
 "bexiga-met-1l-gcarbo": FI("esquema prevê faixa de 4 a 6 ciclos; N único não derivável", per=21),
 "bexiga-met-2l-pembrolizumabe": API(SEM_DOI),
 "bexiga-met-3l-enfortumab-vedotin": API(SEM_DOI),
 "bexiga-met-erdafitinibe-fgfr": API(SEM_DOI),
})

# ================= MELANOMA =================
OV.update({
 "melanoma-adj-pembrolizumabe-iib-iic": FI("duas alternativas de periodicidade (200 mg 21/21d ou 400 mg 42/42d) por 12 meses; nº de ciclos único não derivável"),
 "melanoma-adj-anti-pd1-iii-iv-braf-wt": FI("quatro alternativas de fármaco/periodicidade por 12 meses; nº de ciclos único não derivável"),
 "melanoma-met-1l-ipi-nivo": API("indução ipi+nivo 4 ciclos seguida de nivolumabe de manutenção 28/28d sem teto; pivotal sem PFS mediana no abstract"),
 "melanoma-met-1l-anti-pd1-mono": API(SEM_NUM),
 "melanoma-met-snc-ipi-nivo": API("indução 4 ciclos + nivolumabe de manutenção 28/28d sem teto; pivotal sem PFS mediana no abstract"),
 "melanoma-met-relatlimabe-nao-incorporado": AP(10.1, "10.1056/nejmoa2109970", "PFS mediana do braço relatlimabe+nivolumabe (RELATIVITY-047)"),
 "melanoma-met-quimio-paliativa": API(SEM_NUM),
})

# ================= RENAL =================
OV.update({
 "renal-met-favoravel-pazopanibe": API(SEM_NUM),
 "renal-met-favoravel-sunitinibe": AP(11.0, "10.1056/NEJMoa065044", "PFS mediana do braço sunitinibe (pivotal sunitinibe vs interferona)"),
 "renal-met-favoravel-ipilimumabe-nivolumabe": API("CheckMate 214 reporta a mediana de PFS da população de risco intermediário/alto; não reporta a do subgrupo de risco favorável, que é a deste regime"),
 "renal-met-intalto-ipilimumabe-nivolumabe": AP(11.6, "10.1056/NEJMoa1712126", "PFS mediana do braço ipilimumabe+nivolumabe na população de risco intermediário/alto (CheckMate 214)"),
 "renal-met-intalto-axitinibe-pembrolizumabe": AP(15.1, "10.1056/NEJMoa1816714", "PFS mediana do braço pembrolizumabe+axitinibe (KEYNOTE-426)"),
 "renal-met-intalto-nivolumabe-cabozantinibe": AP(16.6, "10.1056/NEJMoa2026982", "PFS mediana do braço nivolumabe+cabozantinibe (CheckMate 9ER)"),
 "renal-met-2l-pos-vegfr-nivolumabe": API(SEM_NUM),
 "renal-met-2l-pos-io-cabozantinibe": AP(7.4, "10.1056/NEJMoa1510016", "PFS mediana do braço cabozantinibe (METEOR)"),
 "renal-naoclaras-sunitinibe-pazopanibe": AP(8.3, "10.1016/S1470-2045(15)00515-X", "PFS mediana do braço sunitinibe em não-células claras (ASPEN); o esquema também admite pazopanibe"),
})

# ================= ENDOMÉTRIO =================
OV.update({
 "endometrio-adj-crt-cisplatina": FI("cisplatina D1/D29 concomitante à RT seguida de 4 ciclos de carbo+paclitaxel; total único não derivável"),
 "endometrio-met-1l-carbo-paclitaxel": AP(13.0, "10.1200/JCO.20.01076", "PFS mediana do braço TC (paclitaxel+carboplatina) no GOG-209"),
 "endometrio-met-1l-dostarlimabe-msi": API("6 ciclos de QT + dostarlimabe 42/42d por ATÉ 3 anos (teto); RUBY reporta PFS em 24 meses (taxa), não mediana"),
 "endometrio-met-dostarlimabe-mss-nao-incluido": API(SEM_NUM),
 "endometrio-met-pembrolizumabe-qt-nao-incluido": AP(13.1, "10.1056/NEJMoa2302312", "PFS mediana do braço pembrolizumabe na coorte pMMR (NRG-GY018)"),
 "endometrio-met-2l-lenvatinibe-pembrolizumabe": API(SEM_NUM),
 "endometrio-met-2l-io-msi-nao-incorporado": AP(13.1, "10.1200/JCO.21.01874", "PFS mediana do braço pembrolizumabe em tumores MSI-H (KEYNOTE-158)"),
 "endometrio-met-durva-olaparibe-nao-incluido": API(SEM_NUM),
})

# ================= OVÁRIO =================
OV.update({
 "ovario-epitelial-adj-carbo-paclitaxel": F(6, 21, "6 ciclos 21/21d; a opção semanal dose-densa citada no esquema tem outra periodicidade"),
 "ovario-epitelial-neoadj-carbo-paclitaxel": FI("esquema prevê faixa de 6 a 8 ciclos; N único não derivável", per=21),
 "ovario-bevacizumabe-1l-nao-incluido": AP(14.1, "10.1056/NEJMoa1104390", "PFS mediana do braço bevacizumabe-throughout (GOG-0218), que corresponde ao uso com manutenção"),
 "ovario-manutencao-olaparibe-brca": FD(104, "manutenção com olaparibe por 2 anos declarados no esquema (teto fixo); uso oral contínuo, custo por período e não por ciclo"),
 "ovario-niraparibe-nao-incluido": AP(13.8, "10.1056/NEJMoa1910962", "PFS mediana do braço niraparibe na população geral (PRIMA)"),
 "ovario-olaparibe-bevacizumabe-nao-incluido": API("a publicação referenciada é a atualização de 5 anos do PAOLA-1: traz hazard ratio, não PFS mediana"),
 "ovario-recidiva-platina-sensivel-doublet": API("CALYPSO reporta duas medianas conforme o parceiro da carboplatina (11,3 meses com PLD vs 9,4 com paclitaxel) e o regime admite ambos — número único não atribuível"),
 "ovario-recidiva-manutencao-olaparibe-brca": FD(104, "manutenção com olaparibe por 2 anos declarados no esquema (teto fixo); uso oral contínuo, custo por período e não por ciclo"),
 "ovario-carbo-gem-bevacizumabe-nao-incluido": API(SEM_NUM),
 "ovario-recidiva-platina-resistente-monoterapia": API("o pivotal referenciado não reporta mediana de tempo até progressão nem PFS mediana no abstract"),
 "ovario-resistente-bevacizumabe-nao-incluido": AP(6.7, "10.1200/JCO.2013.51.4489", "PFS mediana do braço com bevacizumabe (AURELIA)"),
 "ovario-estroma-granulosa-peb": FI("esquema prevê faixa de 3 a 4 ciclos, com alternativa carbo+paclitaxel; N único não derivável", per=21),
 "ovario-germinativo-peb": FI("esquema prevê faixa de 3 a 4 ciclos, com alternativa carbo+etoposídeo; N único não derivável", per=21),
})

# ================= PÂNCREAS =================
OV.update({
 "pancreas-adj-mfolfirinox": FI("mFOLFIRINOX 14/14d adjuvante sem nº de ciclos declarado no esquema", per=14),
 "pancreas-adj-gemcitabina": FI("o esquema descreve a estrutura do ciclo (3 semanas on + 1 off), não a duração total do tratamento adjuvante"),
 "pancreas-adj-nabpac-gem-nao-incorporado": FI(NAO_INC),
 "pancreas-adj-gem-cape-nao-incorporado": FI(NAO_INC),
 "pancreas-met-mfolfirinox": AP(6.4, "10.1056/NEJMoa1011923", "PFS mediana do braço FOLFIRINOX (PRODIGE 4/ACCORD 11)"),
 "pancreas-met-gemcitabina": API(SEM_NUM),
 "pancreas-met-nabpac-gem-nao-incorporado": AP(5.5, "10.1056/NEJMoa1304369", "PFS mediana do braço nab-paclitaxel+gencitabina (MPACT)"),
 "pancreas-met-olaparibe-nao-incorporado": API(SEM_DOI),
})

# ================= HEPATOCARCINOMA =================
OV.update({
 "hcc-1l-atezolizumabe-bevacizumabe": AP(6.8, "10.1056/NEJMoa1915745", "PFS mediana do braço atezolizumabe+bevacizumabe (IMbrave150)"),
 "hcc-1l-tremelimumabe-durvalumabe": API(SEM_NUM),
 "hcc-1l-sorafenibe": API(SEM_NUM),
 "hcc-1l-lenvatinibe": API(SEM_NUM),
 "hcc-2l-sorafenibe-lenvatinibe": API(SEM_NUM),
 "hcc-2l-pembrolizumabe-nao-incorporado": API(SEM_DOI),
 "hcc-2l-regorafenibe-nao-incorporado": API(SEM_DOI),
})

# ================= GLIOBLASTOMA =================
OV.update({
 "gbm-stupp": F(6, 28, "6 ciclos de temozolomida adjuvante; a fase concomitante à RT (75 mg/m²/dia) não está contabilizada aqui"),
 "gbm-perry": F(6, 28, "6 ciclos de temozolomida adjuvante; a fase concomitante à RT não está contabilizada aqui"),
 "gbm-recorrencia-tmz-carmustina": FI("duas alternativas distintas (temozolomida dose-densa por 6 meses ou carmustina 56/56d com teto de dose cumulativa); duração única não derivável"),
 "gbm-bevacizumabe-contra": API("o pivotal referenciado reporta PFS do braço lomustina+bevacizumabe, não de bevacizumabe isolado, que é o objeto deste regime"),
})

# ================= SARCOMAS =================
OV.update({
 "sarcoma-pm-eribulina-lipossarcoma": API("o pivotal (eribulina vs dacarbazina) não reporta PFS mediana no abstract — desfecho primário foi sobrevida global"),
 "sarcoma-pm-pazopanibe-nao-incorporado": AP(4.6, "10.1016/S0140-6736(12)60651-5", "PFS mediana do braço pazopanibe (PALETTE)"),
 "sarcoma-kaposi-paclitaxel-pld": API("o pivotal reporta medianas distintas por braço (paclitaxel 17,5 vs PLD 12,2 meses) e o regime admite ambos — número único não atribuível"),
 "sarcoma-angiossarcoma-paclitaxel": API(SEM_NUM),
 "sarcoma-dfsp-imatinibe-contra": API("o pivotal reporta apenas mediana de tempo até progressão (1,7 ano), não PFS mediana"),
 "sarcoma-ntrk-larotrectinibe-nao-incorporado": API(SEM_NUM),
 "osteossarcoma-neoadj-map": FI("esquema MAP descrito por fármacos e marco cirúrgico (semana 11-12), sem nº de ciclos nem periodicidade declarados"),
 "osteossarcoma-paliativo": API(SEM_NUM),
 "ewing-localizado-vdc-ie": FI("17 ciclos declarados, mas a periodicidade depende da idade (14 dias abaixo de 18 anos, 21 dias a partir de 18); duração total não única", ciclos=17),
 "ewing-metastatico-vdc-ie": FI("esquema remete ao regime localizado e a alternativas de resgate, sem nº de ciclos próprio"),
})

# ================= NEUROENDÓCRINOS =================
OV.update({
 "net-baixograu-analogo-somatostatina": API(SEM_NUM),
 "net-baixograu-lu177-dotatate": FI("4 ciclos declarados, periodicidade não declarada no esquema", ciclos=4),
 "net-baixograu-alvo-nao-incluido": API(SEM_DOI),
 "net-baixograu-capetem": AP(22.7, "10.1200/JCO.22.01013", "PFS mediana do braço capecitabina+temozolomida (E2211)"),
 "net-altograu-platina-etoposideo": API(SEM_DOI),
})

# ================= VIAS BILIARES =================
OV.update({
 "biliares-1l-gemcitabina-cisplatina": AP(8.0, "10.1056/NEJMoa0908721", "PFS mediana do braço cisplatina+gencitabina (ABC-02)"),
 "biliares-1l-gemcitabina-mono": AP(5.0, "10.1056/NEJMoa0908721", "PFS mediana do braço gencitabina isolada (ABC-02)"),
 "biliares-1l-5fu": API(SEM_DOI),
 "biliares-2l-folfox": API("FOLFOX por ATÉ 12 ciclos (teto, não duração fixa); pivotal sem PFS mediana no abstract"),
 "biliares-durvalumab-gemcis-nao-incorporado": API(SEM_NUM),
})

# ================= CANAL ANAL =================
OV.update({
 "anal-crt-mitomicina-5fu": F(2, 28, "2 blocos de 5-FU/mitomicina (D1 e D29) concomitantes à RT — intervalo de 28 dias explícito nos dias declarados"),
 "anal-crt-cisplatina-5fu": F(2, 28, "2 blocos de cisplatina/5-FU (D1 e D29) concomitantes à RT — intervalo de 28 dias explícito nos dias declarados"),
 "anal-met-carboplatina-paclitaxel": API(SEM_NUM),
 "anal-met-dcf": API("o pivotal define PFS em 12 meses como desfecho primário e não reporta PFS mediana no abstract"),
 "anal-met-nivolumabe-nao-incorporado": API(SEM_NUM),
})

# ================= GLIOMA BAIXO GRAU =================
OV.update({
 "glioma-astrocitoma-idh-g4-tmz": F(6, 28, "6 ciclos de temozolomida adjuvante; a fase concomitante à RT não está contabilizada aqui"),
 "glioma-oligodendroglioma-g3-tmz": F(12, 28, "12 ciclos de temozolomida adjuvante; a fase concomitante à RT não está contabilizada aqui"),
})

# ================= PÊNIS =================
OV.update({
 "penis-locregional-neoadj-tip": FI("periodicidade declarada em faixa (3 a 4 semanas) e nº de ciclos não declarado"),
 "penis-adj-tip": FI("TIP por ATÉ 4 ciclos (teto, não nº fixo) e sem periodicidade declarada"),
 "penis-met-1l-tip": FI("TIP 21/21d sem nº de ciclos declarado no esquema", per=21),
 "penis-met-1l-5fu-cisplatina": FI("cisplatina+5-FU 28/28d sem nº de ciclos declarado no esquema", per=28),
 "penis-met-1l-tpf": FI("TPF 21/21d sem nº de ciclos declarado no esquema", per=21),
 "penis-met-2l-paclitaxel": API("o esquema cita sobrevida global média (~23 semanas), não duração de tratamento nem PFS mediana"),
})

# ================= VULVA =================
OV.update({
 "vulva-neoadj-cisplatina-crt": FI("cisplatina semanal durante a RT; nº de semanas não declarado no esquema", per=7),
 "vulva-avancada-recidivada": API(SEM_DOI),
})

# ================= TROFOBLÁSTICA =================
OV.update({
 "trofo-baixo-risco-metotrexato": FI("duração amarrada à normalização do beta-HCG + 3 ciclos de consolidação; nº total de ciclos depende da resposta, não do esquema"),
 "trofo-alto-risco-emaco": FI("EMA-CO 14/14d mantido até normalização do beta-HCG mais consolidação; nº de ciclos não declarado no esquema", per=14),
 "trofo-resistente-ema-ep": FI("EMA-EP 14/14d de resgate; nº de ciclos não declarado no esquema", per=14),
})
