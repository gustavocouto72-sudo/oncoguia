# -*- coding: utf-8 -*-
"""Decisões curadas de expectativa_uso — parte A.
F  = fixa determinada (ciclos x periodicidade)
FD = fixa por duração total declarada (uso contínuo, sem contagem de ciclos)
FI = fixa mas NÃO derivável com certeza -> indeterminado
AP = até progressão com PFS mediana do pivotal como proxy declarado
API= até progressão sem número reportado -> indeterminado
"""
def F(c, p, nota=None):
    return {"tipo": "fixa", "ciclos": c, "periodicidade_dias": p,
            "duracao_total_semanas": round(c * p / 7, 1), "fonte": "esquema",
            "indeterminado": False, "nota": nota}
def FD(sem, nota):
    return {"tipo": "fixa", "ciclos": None, "periodicidade_dias": None,
            "duracao_total_semanas": sem, "fonte": "esquema",
            "indeterminado": False, "nota": nota}
def FI(nota, ciclos=None, per=None):
    return {"tipo": "fixa", "ciclos": ciclos, "periodicidade_dias": per,
            "duracao_total_semanas": None, "fonte": "esquema",
            "indeterminado": True, "nota": nota}
def AP(meses, doi, nota=None):
    return {"tipo": "ate_progressao", "duracao_mediana_tratamento_meses": None,
            "proxy": "pfs", "pfs_mediana_meses": meses, "fonte_doi": doi,
            "indeterminado": False, "nota": nota}
def AD(meses, doi, nota=None):
    """até progressão com DURAÇÃO MEDIANA DE TRATAMENTO reportada no pivotal
    (preferência 1 da extração; não é proxy)."""
    return {"tipo": "ate_progressao", "duracao_mediana_tratamento_meses": meses,
            "proxy": None, "pfs_mediana_meses": None, "fonte_doi": doi,
            "indeterminado": False, "nota": nota}
def API(nota):
    return {"tipo": "ate_progressao", "duracao_mediana_tratamento_meses": None,
            "proxy": None, "pfs_mediana_meses": None, "fonte_doi": None,
            "indeterminado": True, "nota": nota}

SEM_NUM = "pivotal do regime não reporta duração mediana de tratamento nem PFS mediana no abstract"
SEM_DOI = "regime sem pivotal com DOI no corpus — sem fonte para derivar duração"
NAO_INC = "esquema descreve a intervenção sem posologia/duração; sem número derivável"

OV = {}

# ================= MAMA =================
OV.update({
 "mama-adj-her2neg-act": FI("duas fases (AC ×4 → paclitaxel semanal) e duas alternativas (convencional/dose-densa) — nº total de ciclos e periodicidade não únicos no esquema"),
 "mama-adj-her2neg-tc": FI("esquema prevê faixa de 4 a 6 ciclos (3/3 semanas); N único não derivável", per=21),
 "mama-adj-her2neg-ac": FI("esquema declara 4 ciclos mas não declara a periodicidade; intervalo não derivável do texto", ciclos=4),
 "mama-adj-her2neg-act-docetaxel": FI("AC seguido de docetaxel com duas alternativas (4 ciclos 21/21d ou 12 semanas semanal); total não único"),
 "mama-adj-her2neg-cmf": FI("duas variantes (CMF clássico 28 dias e CMF EV 21 dias) e nº de ciclos não declarado"),
 "mama-adj-her2pos-th": FI("paclitaxel+trastuzumabe 12 semanas seguido de trastuzumabe até 1 ano total; fases com periodicidades diferentes"),
 "mama-adj-her2pos-tp-aphinity": F(17, 21, "17 ciclos = 1 ano de trastuzumabe+pertuzumabe 21/21d; a QT associada (TC ou AC-T) não está contabilizada aqui"),
 "mama-adj-ht-tamoxifeno-pre": FI("esquema declara faixa de 5 a 10 anos; duração única não derivável"),
 "mama-adj-ht-lhrh-ia-pre": FI("esquema declara faixa de 5 a 10 anos; duração única não derivável"),
 "mama-adj-ht-ia-pos": FI("esquema declara faixa de 5 a 10 anos; duração única não derivável"),
 "mama-adj-ht-tam-ia-switch-pos": FI("switch com faixas (2–3 anos + 2–3 anos, ou 5+5 anos); duração única não derivável"),
 "mama-neo-her2pos-ct1c-acth": FI("4 ciclos AC + 4 ciclos docetaxel+trastuzumabe, com trastuzumabe até 1 ano; fases somam mas o texto não fecha um total único"),
 "mama-neo-her2pos-ct1c-tch": FI("6 ciclos de QT + trastuzumabe por 1 ano; periodicidade da QT não declarada no esquema", ciclos=6),
 "mama-neo-her2pos-gtct1c-acthp": FI("4 ciclos AC + 4 ciclos THP (24 semanas de QT) e anti-HER2 até 1 ano; total único não derivável"),
 "mama-neo-her2pos-gtct1c-tchp": FI("6 ciclos de QT (18 semanas) mas trastuzumabe+pertuzumabe seguem até 1 ano; total único não derivável", ciclos=6, per=21),
 "mama-neo-her2pos-gtct1c-thp": FI("6 ciclos de QT (18 semanas) mas trastuzumabe+pertuzumabe seguem até 1 ano; total único não derivável", ciclos=6, per=21),
 "mama-neo-her2pos-phesgo-nao-incorporado": FI(NAO_INC),
 "mama-neo-tnbc-pembro-keynote522": F(17, 21, "8 ciclos neoadjuvantes (4+4) + 9 adjuvantes = 17 ciclos de 21 dias, todos com pembrolizumabe"),
 "mama-neo-tnbc-acdd-ct": FI("ACdd 4 ciclos 14/14d seguido de paclitaxel semanal ×12 + carboplatina com duas periodicidades; total único não derivável"),
 "mama-neo-tnbc-tc": FI("esquema prevê faixa de 4 a 6 ciclos; N único não derivável", per=21),
 "mama-neo-rhpos-act-acddt": FI("duas fases e duas alternativas (convencional/dose-densa); total único não derivável"),
 "mama-neo-rhpos-tc": FI("esquema prevê faixa de 4 a 6 ciclos; N único não derivável", per=21),
 "mama-met-hrpos-1l-ia-cdk46": AP(25.3, "10.1093/annonc/mdy155", "PFS mediana do braço ribociclibe+letrozol (MONALEESA-2); o esquema admite outros iCDK4/6"),
 "mama-met-hrpos-1l-fulvestranto-cdk46": API(SEM_NUM),
 "mama-met-hrpos-1l-ia-abemaciclibe": API(SEM_NUM),
 "mama-met-hrpos-1l-ht-isolada": API(SEM_DOI),
 "mama-met-hrpos-1l-qt-crise-visceral": API(SEM_DOI),
 "mama-met-hrpos-1l-ribociclibe-crise-visceral": AP(21.8, "10.1200/JCO.24.00144", "PFS mediana do braço ribociclibe+TE (RIGHT Choice)"),
 "mama-met-hrpos-2l-seq-cdk46-nao-incorporado": API(SEM_NUM),
 "mama-met-hrpos-2l-capivasertibe-nao-incorporado": AP(7.2, "10.1056/nejmoa2214131", "PFS mediana do braço capivasertibe+fulvestranto, população geral (CAPItello-291)"),
 "mama-met-hrpos-2l-alpelisibe-nao-incorporado": API(SEM_DOI),
 "mama-met-hrpos-2l-tdxd-db04": AP(10.1, "10.1056/NEJMoa2203690", "PFS mediana do braço T-DXd na coorte receptor hormonal positivo (DESTINY-Breast04)"),
 "mama-met-hrpos-2l-tdxd-db06-nao-incorporado": AP(13.2, "10.1056/NEJMoa2407086", "PFS mediana do braço T-DXd na população HER2-low (DESTINY-Breast06)"),
 "mama-met-hrpos-2l-capecitabina": API("X-7/7 reporta PFS por média restrita aos 33 meses (10,1 vs 9,1 meses), não mediana — não usável como proxy declarado"),
 "mama-met-hrpos-2l-paclitaxel": API(SEM_NUM),
 "mama-met-hrpos-2l-eribulina": API(SEM_NUM),
 "mama-met-hrpos-2l-docetaxel": API(SEM_DOI),
 "mama-met-hrpos-2l-vinorelbina-iv": API(SEM_DOI),
 "mama-met-hrpos-2l-vinorelbina-vo": API(SEM_DOI),
 "mama-met-hrpos-2l-gencitabina": API(SEM_DOI),
 "mama-met-hrpos-2l-doxo-lipossomal": API(SEM_DOI),
 "mama-met-hrpos-2l-sacituzumab-govitecan": API(SEM_NUM),
 "mama-met-her2pos-1l-thp-cleopatra": API("CLEOPATRA: a publicação referenciada é a análise final de sobrevida global; não traz PFS mediana no abstract"),
 "mama-met-her2pos-2l-tdxd-db03": API(SEM_NUM),
 "mama-met-her2pos-2l-tdm1-emilia": API("EMILIA: publicação referenciada é a análise descritiva final de SG; sem PFS mediana no abstract"),
 "mama-met-her2pos-3l-tdm1-th3resa": AP(6.2, "10.1016/S1470-2045(14)70178-0", "PFS mediana do braço T-DM1 (TH3RESA)"),
 "mama-met-her2pos-3l-trastuzumabe-citotoxico": API(SEM_NUM),
 "mama-met-tnbc-1l-pembro-keynote355": AP(9.7, "10.1016/S0140-6736(20)32531-9", "PFS mediana do braço pembrolizumabe+QT na população CPS≥10 (KEYNOTE-355), que é a indicação do regime"),
 "mama-met-tnbc-1l-atezolizumabe-nao-incorporado": AP(6.0, "10.1016/j.annonc.2021.05.801", "PFS mediana do braço atezolizumabe+paclitaxel (IMpassion131)"),
 "mama-met-tnbc-1l-qt-opcoes": API(SEM_DOI),
 "mama-met-tnbc-2l-qt-opcoes": API(SEM_DOI),
 "mama-met-tnbc-3l-sacituzumab-ascent": AP(5.6, "10.1056/NEJMoa2028485", "PFS mediana do braço sacituzumabe govitecana (ASCENT)"),
 "mama-met-tnbc-3l-tdxd-nao-incorporado": API("DESTINY-Breast04 reporta PFS da coorte RH+ e da população total; não reporta a coorte RH-negativa, que é a deste regime"),
 "mama-met-tnbc-3l-qt-opcoes": API(SEM_DOI),
 "mama-met-tnbc-bevacizumabe-nao-incorporado": API(SEM_NUM),
})
