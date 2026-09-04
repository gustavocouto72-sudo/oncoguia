# -*- coding: utf-8 -*-
"""Léxico de fármacos canônicos — o vocabulário que o parser reconhece no `esquema`.

Por que existe uma lista fechada em vez de "toda palavra capitalizada seguida de número":
o texto do esquema mistura fármaco, radioterapia ("RT 60 Gy"), suporte ("G-CSF"),
sigla de combinação ("AC", "FOLFOX", "TIP") e nome de estudo ("ALEX", "CROWN"). Sem
léxico, "Gy" viraria dose de fármaco e "AC" viraria um fármaco chamado AC. Com léxico, o
que não está na lista simplesmente não vira item — e o regime cai em indeterminado com
nota, que é o lado seguro do erro.

CANONICO: nome canônico -> lista de grafias que aparecem no texto (sem acento, minúsculas
já são aplicadas pelo parser). A primeira grafia da lista NÃO precisa repetir o canônico:
o parser junta as duas. Casamento é o MAIS LONGO primeiro, para "trastuzumabe deruxtecan"
ganhar de "trastuzumabe".

COMBINACOES: siglas que designam DUAS OU MAIS drogas ("AC", "CMF", "FOLFOX", "THP"). Não
são fármacos: quando aparecem, o regime é marcado indeterminado com nota, porque expandir
a sigla seria escolher doses que o texto não escreveu.
"""

CANONICO = {
    # --- citotóxicos clássicos ---
    "Cisplatina": ["cisplatina", "cddp"],
    "Carboplatina": ["carboplatina", "carbo"],
    "Oxaliplatina": ["oxaliplatina"],
    "Paclitaxel": ["paclitaxel"],
    "Nab-paclitaxel": ["nab-paclitaxel", "nab paclitaxel", "paclitaxel ligado a albumina"],
    "Docetaxel": ["docetaxel"],
    "Cabazitaxel": ["cabazitaxel"],
    "Gemcitabina": ["gemcitabina", "gencitabina"],
    "5-Fluorouracil": ["5-fluorouracil", "5-fu", "fluorouracil", "5fu"],
    "Capecitabina": ["capecitabina"],
    "Leucovorina": ["leucovorina", "folinato de calcio", "acido folinico", "lv"],
    "Doxorrubicina": ["doxorrubicina", "adriamicina"],
    "Doxorrubicina lipossomal peguilada": [
        "doxorrubicina lipossomal peguilado", "doxorrubicina lipossomal peguilada",
        "doxorrubicina lipossomal", "pld", "doxil", "caelyx"],
    "Epirrubicina": ["epirrubicina"],
    "Ciclofosfamida": ["ciclofosfamida"],
    "Ifosfamida": ["ifosfamida"],
    "Etoposídeo": ["etoposideo", "vp-16", "vp16"],
    "Irinotecano": ["irinotecano", "cpt-11"],
    "Topotecano": ["topotecano"],
    "Vinorelbina": ["vinorelbina"],
    "Vimblastina": ["vimblastina"],
    "Vincristina": ["vincristina"],
    "Eribulina": ["eribulina"],
    "Metotrexato": ["metotrexato", "mtx"],
    "Pemetrexede": ["pemetrexede", "pemetrexed"],
    "Bleomicina": ["bleomicina"],
    "Dacarbazina": ["dacarbazina", "dtic"],
    "Temozolomida": ["temozolomida", "tmz"],
    "Carmustina": ["carmustina", "bcnu"],
    "Mitomicina C": ["mitomicina c", "mitomicina"],
    "Actinomicina D": ["actinomicina d", "dactinomicina"],
    "Trifluridina/Tipiracil": ["trifluridina/tipiracil", "tas-102", "tas102"],
    "Mesna": ["mesna"],
    "Ácido zoledrônico": ["acido zoledronico", "zoledronato"],

    # --- anticorpos e conjugados ---
    "Trastuzumabe": ["trastuzumabe"],
    "Trastuzumabe deruxtecana": [
        "trastuzumabe deruxtecana", "trastuzumabe deruxtecan", "t-dxd", "tdxd"],
    "Trastuzumabe entansina": [
        "trastuzumabe emtansina", "trastuzumabe entansina", "trastuzumabe etamsina",
        "t-dm1", "tdm-1"],
    "Pertuzumabe": ["pertuzumabe"],
    "Bevacizumabe": ["bevacizumabe"],
    "Cetuximabe": ["cetuximabe"],
    "Panitumumabe": ["panitumumabe"],
    "Ramucirumabe": ["ramucirumabe"],
    "Aflibercepte": ["aflibercepte", "ziv-aflibercepte"],
    "Zolbetuximabe": ["zolbetuximabe"],
    "Enfortumabe vedotina": ["enfortumab vedotin", "enfortumabe vedotina", "enfortumabe"],
    "Sacituzumabe govitecana": [
        "sacituzumabe govitecana", "sacituzumabe govitecan", "sacituzumab govitecan"],
    "Amivantamabe": ["amivantamab", "amivantamabe"],
    "Tarlatamabe": ["tarlatamabe"],

    # --- checkpoint ---
    "Pembrolizumabe": ["pembrolizumabe", "pembrolizumab", "pembro"],
    "Nivolumabe": ["nivolumabe", "nivo"],
    "Ipilimumabe": ["ipilimumabe", "ipi"],
    "Atezolizumabe": ["atezolizumabe", "atezo"],
    "Durvalumabe": ["durvalumabe", "durvalumab"],
    "Tremelimumabe": ["tremelimumabe"],
    "Avelumabe": ["avelumabe"],
    "Cemiplimabe": ["cemiplimabe"],
    "Dostarlimabe": ["dostarlimabe"],
    "Toripalimabe": ["toripalimabe"],
    "Relatlimabe": ["relatlimabe"],

    # --- alvo-dirigidos orais ---
    "Osimertinibe": ["osimertinibe"],
    "Alectinibe": ["alectinibe"],
    "Lorlatinibe": ["lorlatinibe"],
    "Brigatinibe": ["brigatinibe"],
    "Crizotinibe": ["crizotinibe"],
    "Lazertinibe": ["lazertinibe"],
    "Erdafitinibe": ["erdafitinibe"],
    "Larotrectinibe": ["larotrectinibe"],
    "Imatinibe": ["imatinibe"],
    "Sunitinibe": ["sunitinibe"],
    "Pazopanibe": ["pazopanibe"],
    "Sorafenibe": ["sorafenibe"],
    "Lenvatinibe": ["lenvatinibe"],
    "Cabozantinibe": ["cabozantinibe"],
    "Axitinibe": ["axitinibe"],
    "Regorafenibe": ["regorafenibe"],
    "Dabrafenibe": ["dabrafenibe"],
    "Trametinibe": ["trametinibe"],
    "Everolimo": ["everolimo", "everolimus"],
    "Palbociclibe": ["palbociclibe"],
    "Ribociclibe": ["ribociclibe"],
    "Abemaciclibe": ["abemaciclibe"],
    "Alpelisibe": ["alpelisibe"],
    "Capivasertibe": ["capivasertibe"],
    "Olaparibe": ["olaparibe"],
    "Niraparibe": ["niraparibe"],
    "Talazoparibe": ["talazoparibe"],

    # --- hormonal e suporte ---
    "Tamoxifeno": ["tamoxifeno"],
    "Anastrozol": ["anastrozol"],
    "Letrozol": ["letrozol"],
    "Exemestano": ["exemestano"],
    "Fulvestranto": ["fulvestranto"],
    "Abiraterona": ["abiraterona"],
    "Enzalutamida": ["enzalutamida"],
    "Apalutamida": ["apalutamida"],
    "Darolutamida": ["darolutamida"],
    "Gosserrelina": ["gosserrelina", "goserrelina"],
    "Leuprolida": ["leuprolida", "leuprorrelina"],
    "Triptorrelina": ["triptorrelina"],
    "Degarelix": ["degarelix"],
    "Octreotídeo LAR": ["octreotideo lar", "octreotide lar", "octreotideo"],
    "Lanreotídeo": ["lanreotideo"],
    "Prednisona": ["prednisona"],
    "G-CSF": ["g-csf", "filgrastim", "pegfilgrastim"],

    # --- outros ---
    "BCG": ["bcg", "bacilo calmette-guerin"],
    "177Lu-DOTATATE": ["177lu-dotatate", "lutecio-177", "lu-177"],
}

# Siglas de COMBINAÇÃO — duas ou mais drogas num nome só. Nunca viram item; presença
# marca o regime indeterminado com nota (expandir a sigla escolheria dose que o texto
# não escreveu).
COMBINACOES = {
    "ac": "AC (doxorrubicina + ciclofosfamida)",
    "cmf": "CMF (ciclofosfamida + metotrexato + 5-FU)",
    "ec": "EC (epirrubicina + ciclofosfamida)",
    "fec": "FEC (5-FU + epirrubicina + ciclofosfamida)",
    "tc": "TC (docetaxel + ciclofosfamida)",
    "thp": "THP (docetaxel + trastuzumabe + pertuzumabe)",
    "tch": "TCH (docetaxel + carboplatina + trastuzumabe)",
    "tchp": "TCHP (docetaxel + carboplatina + trastuzumabe + pertuzumabe)",
    "folfox": "FOLFOX (5-FU + leucovorina + oxaliplatina)",
    "folfiri": "FOLFIRI (5-FU + leucovorina + irinotecano)",
    "folfirinox": "FOLFIRINOX (5-FU + leucovorina + irinotecano + oxaliplatina)",
    "folfoxiri": "FOLFOXIRI (5-FU + leucovorina + oxaliplatina + irinotecano)",
    "capox": "CAPOX (capecitabina + oxaliplatina)",
    "xelox": "XELOX (capecitabina + oxaliplatina)",
    "flot": "FLOT (5-FU + leucovorina + oxaliplatina + docetaxel)",
    "bep": "BEP (bleomicina + etoposídeo + cisplatina)",
    "vip": "VIP (etoposídeo + ifosfamida + cisplatina)",
    "veip": "VeIP (vimblastina + ifosfamida + cisplatina)",
    "tip": "TIP (paclitaxel + ifosfamida + cisplatina)",
    "mvac": "MVAC (metotrexato + vimblastina + doxorrubicina + cisplatina)",
    "ddmvac": "ddMVAC (MVAC dose-densa)",
    "gemcis": "GemCis (gemcitabina + cisplatina)",
    "vdc": "VDC (vincristina + doxorrubicina + ciclofosfamida)",
    "ie": "IE (ifosfamida + etoposídeo)",
    "abvd": "ABVD",
    "emaco": "EMA-CO",
    "pcv": "PCV (procarbazina + lomustina + vincristina)",
    "cav": "CAV (ciclofosfamida + doxorrubicina + vincristina)",
    "ap": "AP (doxorrubicina + cisplatina)",
    "ai": "AI (doxorrubicina + ifosfamida)",
}

# Classes/genéricos que aparecem no lugar de um fármaco ("QT platina", "inibidor de
# aromatase", "agente único"). Também não viram item — marcam indeterminado.
GENERICOS = [
    "inibidor de aromatase", "agente citotoxico", "agente unico", "agente conforme",
    "quimioterapia", "imunoterapia", "fluoropirimidina", "qt platina", "platina",
    "terapia endocrina", "analogo lhrh", "agonista lhrh", "antagonista lhrh",
    "icdk4/6", "icdk 4/6", "inibidor de ciclina", "combinacoes de 2a linha",
]


def grafias():
    """[(grafia_sem_acento, nome_canonico)] ordenado do mais longo para o mais curto —
    o parser precisa casar 'trastuzumabe deruxtecan' antes de 'trastuzumabe'."""
    pares = []
    for canon, alts in CANONICO.items():
        vistos = set()
        for g in alts:
            g = g.strip().lower()
            if g and g not in vistos:
                vistos.add(g)
                pares.append((g, canon))
    pares.sort(key=lambda p: -len(p[0]))
    return pares
