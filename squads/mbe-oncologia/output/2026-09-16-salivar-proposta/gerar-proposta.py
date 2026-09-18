#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""FASE 1 — PROPOSTA (não é intake). Gera `regimes-propostos-salivar.json` com os 3 regimes de
glândula salivar pedidos pelo revisor (WhatsApp 16/09/2026, transmitido por Gustavo Couto), no
formato do corpus, + vocabulário novo de cabeca-pescoco + registro da decisão fora do fluxo.
NÃO toca em nenhum run, nem em RUN_ATIVO, nem em backend/data. O intake (sexta, por comando
humano) copiará o run ativo e inserirá estes regimes — este script só materializa a proposta e
confere que ela é coerente com o run ativo (vocabulário, ids livres, hash calculável)."""
import json, os, sys, importlib.util
from collections import OrderedDict as OD

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..", "..", ".."))
spec = importlib.util.spec_from_file_location("bd", os.path.join(RAIZ, "app", "build-data.py"))
bd = importlib.util.module_from_spec(spec); sys.modules["bd"] = bd; spec.loader.exec_module(bd)

RUN_ATIVO = open(os.path.join(RAIZ, "squads/mbe-oncologia/RUN_ATIVO")).read().strip().splitlines()[-1].strip()
ativo = json.load(open(os.path.join(RAIZ, "squads/mbe-oncologia/output", RUN_ATIVO, "regimes-consolidados.json"), encoding="utf-8"))
fatia = json.load(open(os.path.join(RAIZ, "squads/mbe-oncologia/output", RUN_ATIVO, "cabeca-pescoco/v1/regimes-consolidados.json"), encoding="utf-8"))
HOJE = "2026-09-16"; REVISOR = "Gustavo Drummond Pinho Ribeiro"

# ---------------------------------------------------------------------------
# Decisão fora do fluxo (precedente: cabozantinibe, lote 2 — `triagem_resolvida`/`origem`)
# ---------------------------------------------------------------------------
ORIGEM = OD([("canal", "WhatsApp ao Gustavo Couto (fora da app; não veio pelo export da Mesa)"),
             ("decidido_por", f"{REVISOR} (revisor)"), ("data", HOJE), ("relatado_por", "Gustavo Couto"),
             ("texto", "Acrescentar 3 regimes para carcinoma de glândula salivar (cabeça e pescoço): "
                       "(1) cisplatina + doxorrubicina + ciclofosfamida (CAP) — PMID 21147032; "
                       "(2) carboplatina + paclitaxel — PMID 27094013; (3) cisplatina + vinorelbina — DOI 10.1002/hed.24933."),
             ("efeito", "3 regimes novos em cabeca-pescoco, nascidos pendentes de referendo do revisor (como todo regime novo); "
                        "vocabulário de cabeca-pescoco ganha tumor=glandula_salivar (+ histologia_salivar). Nenhum regime existente muda."),
             ("precedente", "renal-met-2l-pos-io-cabozantinibe (lote 2, 2026-09-13): decisão por mensagem registrada com canal e origem")])

# ---------------------------------------------------------------------------
# Referências verificadas AO VIVO em 2026-09-16 (Europe PMC + Crossref + OpenAlex)
# ---------------------------------------------------------------------------
REFS = OD([
    ("10.1016/s1470-2045(10)70245-x", OD([("pmid", "21147032"), ("primeiro_autor", "Laurie"), ("ano", 2011), ("tipo", "revisão sistemática (OpenAlex: review; 401 citações)"),
        ("citacao", "LAURIE SA, HO AL, FURY MG, SHERMAN E, PFISTER DG. Systemic therapy in the management of metastatic or locally recurrent adenoid cystic carcinoma of the salivary glands: a systematic review. Lancet Oncol. 2011;12(8):815-824."),
        ("congruente_com_pedido", "PARCIAL — o revisor citou este PMID para o CAP; é uma revisão sistemática de terapia sistêmica em carcinoma ADENOIDE CÍSTICO (34 ensaios, 441 pacientes), não um ensaio do CAP. O CAP está dentro dela; a fonte primária do esquema com dose é Licitra 1996 / Dreyfuss 1987 (abaixo)."),
        ("abstract_trecho", "34 trials involving 441 patients are included. We give evidence-based recommendations for management of ACC with chemotherapy"),
        ("registro", "Europe PMC + Crossref + OpenAlex")])),
    ("10.1093/oxfordjournals.annonc.a010684", OD([("pmid", "8879381"), ("primeiro_autor", "Licitra"), ("ano", 1996), ("tipo", "fase II braço único, n=22"),
        ("citacao", "LICITRA L, CAVINA R, GRANDI C, et al. Cisplatin, doxorubicin and cyclophosphamide in advanced salivary gland carcinoma. A phase II trial of 22 patients. Ann Oncol. 1996;7(6):640-642."),
        ("congruente_com_pedido", True),
        ("abstract_trecho", "Of 22 patients, six achieved a partial response (27%, 95% CI: 11%-50%): no complete response was observed. Response duration ranged between 3 and 13 months (median seven months). The median survival time for the entire series was 21 months. [...] The most common histologies were included."),
        ("registro", "Europe PMC (abstract) + Crossref")])),
    ("10.1002/1097-0142(19871215)60:12<2869::aid-cncr2820601203>3.0.co;2-y", OD([("pmid", "2824016"), ("primeiro_autor", "Dreyfuss"), ("ano", 1987), ("tipo", "série prospectiva, n=13 (9 adenoide cístico + 4 adenocarcinoma)"),
        ("citacao", "DREYFUSS AI, CLARK JR, FALLON BG, et al. Cyclophosphamide, doxorubicin, and cisplatin combination chemotherapy for advanced carcinomas of salivary gland origin. Cancer. 1987;60(12):2869-2872."),
        ("congruente_com_pedido", True),
        ("abstract_trecho", "cyclophosphamide (500 mg/m2), doxorubicin (50 mg/m2), and cisplatin (50 mg/m2) (CAP) by intravenous injections on the first day of a 28-day regimen [...] Three complete and three partial responses to chemotherapy were noted for an overall response rate of 46%. The median duration of response in palliative patients was 5 months"),
        ("registro", "Europe PMC (abstract)")])),
    ("10.3109/00016489.2016.1170876", OD([("pmid", "27094013"), ("primeiro_autor", "Nakano"), ("ano", 2016), ("tipo", "retrospectivo, n=38 (18 ductal salivar, 9 adenoide cístico, 11 outros)"),
        ("citacao", "NAKANO K, SATO Y, SASAKI T, et al. Combination chemotherapy of carboplatin and paclitaxel for advanced/metastatic salivary gland carcinoma patients: differences in responses by different pathological diagnoses. Acta Otolaryngol. 2016;136(9):948-951."),
        ("congruente_com_pedido", True),
        ("abstract_trecho", "A total of 38 patients [...] 18 had salivary duct carcinomas (SDCs), nine had adenoid cystic carcinomas (ACCs), and 11 had other pathological diagnoses. Objective responses were observed in 15 (39%) patients. The median progression-free survival (PFS) was 6.5 months, and the median overall survival (OS) was 26.5 months. ACC patients had relatively low response rates (9%)"),
        ("doses_no_abstract", False),
        ("registro", "Europe PMC + Crossref + OpenAlex; texto completo fechado (Taylor & Francis) — dose NÃO recuperável de fonte aberta")])),
    ("10.1002/hed.24933", OD([("pmid", "29044862"), ("primeiro_autor", "Hong"), ("ano", 2018), ("tipo", "fase II braço único, n=40"),
        ("citacao", "HONG MH, KIM CG, KOH YW, et al. Efficacy and safety of vinorelbine plus cisplatin chemotherapy for patients with recurrent and/or metastatic salivary gland cancer of the head and neck. Head Neck. 2018;40(1):55-62."),
        ("congruente_com_pedido", True),
        ("abstract_trecho", "vinorelbine (25 mg/m2) on days 1 and 8 plus cisplatin (80 mg/m2) on day 1 every 3 weeks for 4 or 6 cycles [...] The objective response rate was 35.0%, including 1 complete response. Median PFS and OS rates were 6.3 months and 16.9 months, respectively. No treatment-related deaths occurred."),
        ("registro", "Crossref (abstract JATS) + Europe PMC + OpenAlex; online 2017-10-16, vol. 40, 2018")])),
    ("10.1002/1097-0142(20010201)91:3<541::aid-cncr1032>3.0.co;2-y", OD([("pmid", "11169936"), ("primeiro_autor", "Airoldi"), ("ano", 2001), ("tipo", "fase II randomizado, n=36 (16 cis+VNB vs 20 VNB)"),
        ("citacao", "AIROLDI M, PEDANI F, SUCCO G, et al. Phase II randomized trial comparing vinorelbine versus vinorelbine plus cisplatin in patients with recurrent salivary gland malignancies. Cancer. 2001;91(3):541-547."),
        ("congruente_com_pedido", "corroboração (não citada pelo revisor) — mesmo esquema exato do Hong 2018"),
        ("abstract_trecho", "cisplatin, 80 mg/m(2), on Day 1 plus VNB, 25 mg/m(2), on Days 1 and 8 (every 3 weeks) [...] 22 patients had adenoid cystic carcinoma [...] Arm A: CR 3 (19%), PR 4 (25%); Arm B: CR 0, PR 4 (20%)"),
        ("registro", "Europe PMC (abstract)")])),
])

# ---------------------------------------------------------------------------
# Vocabulário novo de cabeca-pescoco (mesma mecânica do intake dos drivers de pulmão)
# ---------------------------------------------------------------------------
VOCAB = OD([
    ("tumor", OD([("acao", "acrescentar opção ao enum existente"), ("opcao_nova", "glandula_salivar"),
                  ("rotulo", "Carcinoma de glândula salivar (maior ou menor)"),
                  ("nota", "Nenhuma regra existente de cabeca-pescoco dispara para este valor (todas as 18 têm eq tumor=<outro>). Nenhum hash muda: vocabulário é do arquivo, não do regime.")])),
    ("histologia_salivar", OD([("campo", "histologia_salivar"), ("tipo", "enum"), ("label", "Histologia (glândula salivar)"), ("secao", "Biologia molecular"),
        ("opcoes", ["nao_informada", "adenoide_cistico", "ductal_salivar", "adenocarcinoma_nos", "mucoepidermoide", "outra"]),
        ("indeterminado", ["nao_informada"]),
        ("rotulos", OD([("nao_informada", "Não informada"), ("adenoide_cistico", "Adenoide cístico"), ("ductal_salivar", "Ductal salivar"),
                        ("adenocarcinoma_nos", "Adenocarcinoma NOS"), ("mucoepidermoide", "Mucoepidermoide"), ("outra", "Outra")])),
        ("nota", "Registrado, mas NÃO condiciona nenhuma das 3 regras nesta proposta (o revisor não restringiu por histologia e as fontes misturam histologias). "
                 "Fica no dado para (a) o oncologista ver a ressalva certa no card e (b) o revisor poder restringir depois sem vocabulário novo. "
                 "Seção 'Biologia molecular' → estavel:true pelo classificador do build-data.")])),
])

def eq(c, v): return {"eq": [c, v]}
def crit(campo, op, valor): return OD([("campo", campo), ("operador", op), ("valor", valor)])
REGRA = {"and": [eq("tumor", "glandula_salivar"), eq("metastatico", True)]}
CRITS = [crit("tumor", "=", "glandula_salivar"), crit("metastatico", "=", True)]
ELEG_PROT = ("Não consta do protocolo institucional. Acrescido por decisão do revisor (WhatsApp, 2026-09-16): carcinoma de glândula salivar "
             "recidivado (sem opção de resgate local) ou metastático, tratamento sistêmico paliativo. Sem restrição de linha nem de histologia no pedido.")

def tox(nome, sev, conduta, fonte): return OD([("nome", nome), ("severidade", sev), ("conduta", conduta), ("fonte", fonte)])
def eixo(status, valor, just, fonte, **extra):
    o = OD([("status", status), ("valor_rederivado", valor), ("afirmado_protocolo", None), ("justificativa", just), ("fonte", fonte)]); o.update(extra); return o
def farm(nome, dose, via, freq): return OD([("nome", nome), ("dose", dose), ("via", via), ("frequencia", freq)])
def comp_item(f, val, unid, via, dias, indet=False, nota=None):
    return OD([("farmaco", f), ("dose_valor", val), ("dose_unidade", unid), ("via", via), ("dias_do_ciclo", dias), ("indeterminado", indet), ("nota", nota)])

def regime(rid, subtipo, nome, esquema, farmacos, ref_doi, ref_estudo, ref_ano, ref_autor, ref_tema, beneficio, toxs, grade, mcbs, aff, eleg_div, selo, lacunas, flags, exp, comp):
    r = REFS[ref_doi]
    return OD([
        ("regimen_id", rid), ("tumor", "cabeca-pescoco"), ("cenario", "metastatico"), ("subtipo", subtipo), ("nome", nome), ("esquema", esquema), ("farmacos", farmacos),
        ("elegibilidade_protocolo", ELEG_PROT),
        ("elegibilidade", OD([("criterios", []), ("regra", REGRA)])),
        ("referencia", OD([("citacao", r["citacao"]), ("doi", ref_doi), ("pmid", r["pmid"]), ("estudo", ref_estudo), ("ano", ref_ano), ("primeiro_autor", ref_autor),
                           ("verificacao", OD([("registro", r["registro"]), ("data", HOJE), ("congruente", True), ("tema", ref_tema)]))])),
        ("afirmado_protocolo", OD([("grade", None), ("esmo_mcbs", None), ("nccn_affordability", None)])),
        ("beneficio", beneficio), ("toxicidades", toxs),
        ("verificacao", OD([("grade", grade), ("esmo_mcbs", mcbs), ("nccn_affordability", aff),
            ("elegibilidade", eixo("re_derivado", None, "Derivado do texto do revisor (sítio + doença recidivada/metastática); sem RCT para confronto (tumor raro).", "https://doi.org/" + ref_doi,
                criterios_inclusao=CRITS, criterios_exclusao=[], amplitude=None, divergencia_vs_protocolo=eleg_div, rederivado_em=HOJE, rederivado_por="proposta-salivar:verificador-elegibilidade"))])),
        ("consolidacao", OD([("status", selo), ("selo_confianca", selo), ("eixos_diverge", []), ("lacunas", lacunas), ("flags", flags),
            ("decisao_revisao", "rederivado_aguarda_revisao"),
            ("nota_revisao", ORIGEM["texto"]),
            ("notas_revisao", [OD([("lote", "salivar"), ("data", HOJE), ("revisor", REVISOR), ("acao", "outro"), ("natureza", "clinico"), ("eixo", "geral"),
                                   ("nota", ORIGEM["texto"]), ("nota_squad", "Regime criado a partir desta decisão (recebida por WhatsApp, fora do fluxo de parecer da app). Nasce pendente de referendo do revisor.")])]),
            ("origem", OD([("decisao_em", None), ("lote", "salivar"), ("data", HOJE), ("revisor", REVISOR), ("canal", ORIGEM["canal"])]))])),
        ("versao", 1), ("atualizado_em", HOJE), ("revisado_por", REVISOR), ("revisado_em", HOJE),
        ("historico_versoes", [OD([("versao", 1), ("data", HOJE), ("origem", "intake-salivar:outro (regime novo)"),
            ("mudanca", f"Criado por decisão do revisor (WhatsApp, {HOJE}): {nome} em carcinoma de glândula salivar recidivado/metastático. Quatro eixos derivados com selo honesto; referência verificada ao vivo."),
            ("eixos_afetados", ["grade", "esmo_mcbs", "nccn_affordability", "elegibilidade"]), ("fonte", ref_doi), ("decidido_por", f"{REVISOR} (por WhatsApp; relatado por Gustavo Couto)")])]),
        ("flags", list(flags)), ("expectativa_uso", exp), ("composicao", comp)])

FLAG_ACRESCIDO = f"regime_acrescido_pelo_revisor: não consta do protocolo institucional (WhatsApp, {HOJE})"
FLAG_HISTO = "histologia:conferir — regra por sítio (glandula_salivar) sem restrição de histologia, como no pedido; histologia_salivar fica registrada para o revisor restringir se quiser"
AFF = eixo("estimativa", 1, "Genéricos, disponíveis no SUS. Affordability alta — porém eixo de evidência incompleto (tumor raro).", "estimativa qualitativa", flag_contexto_br="No SUS.")
MCBS_NA = lambda just: eixo("indeterminado", "n/a", just, "")

R1 = regime("cp-salivar-met-cap", "Carcinoma de glândula salivar recidivado/metastático — quimioterapia paliativa (opção acrescida pelo revisor)",
    "Cisplatina + Doxorrubicina + Ciclofosfamida (CAP)",
    "Ciclofosfamida 500 mg/m² EV D1 + Doxorrubicina 50 mg/m² EV D1 + Cisplatina 50 mg/m² EV D1, a cada 21–28 dias (Dreyfuss 1987: D1 de ciclo de 28 dias; Licitra 1996 não declara periodicidade no abstract)",
    [farm("Ciclofosfamida", "500 mg/m²", "EV", "D1 21–28/21–28d"), farm("Doxorrubicina", "50 mg/m²", "EV", "D1 21–28/21–28d"), farm("Cisplatina", "50 mg/m²", "EV", "D1 21–28/21–28d")],
    "10.1093/oxfordjournals.annonc.a010684", "Licitra (CAP, fase II) / Dreyfuss 1987 / Laurie 2011 (RS)", 1996, "Licitra",
    "fase II braço único, n=22, carcinoma de glândula salivar avançado ('most common histologies included'), CAP; TRO 27% (IC95% 11–50%), duração mediana de resposta 7 m, sobrevida mediana 21 m. Dose do esquema vem do Dreyfuss 1987 (n=13; TRO 46%). O PMID 21147032 citado pelo revisor (Laurie 2011) é a revisão sistemática de ACC que enquadra o CAP — mantida como referência de contexto, não como pivô.",
    OD([("desfecho_principal", "Taxa de resposta objetiva (braço único)"), ("magnitude", "Licitra 1996: TRO 27% (6/22, só RP), resposta mediana 7 m, SG mediana 21 m; Dreyfuss 1987: TRO 46% (6/13, 3 RC), resposta mediana 5 m"), ("fonte", "10.1093/oxfordjournals.annonc.a010684")]),
    [tox("Mielossupressão", "grave", "monitorar hemograma; G-CSF conforme risco", "Bula/ficha técnica: quimioterapia"),
     tox("Cardiotoxicidade (doxorrubicina)", "grave", "monitorar FEVE; dose cumulativa", "Bula/ficha técnica: Doxorrubicina"),
     tox("Nefrotoxicidade/ototoxicidade (cisplatina)", "grave", "hidratação; audiometria", "Bula/ficha técnica: Cisplatina"),
     tox("Náuseas/vômitos", "moderada", "antiemese de alto risco emetogênico", "Bula/ficha técnica: Cisplatina/Ciclofosfamida"),
     tox("Cistite hemorrágica (ciclofosfamida)", "moderada", "hidratação", "Bula/ficha técnica: Ciclofosfamida")],
    eixo("re_derivado", "2C", "sem_afirmacao_protocolo. Licitra 1996: fase II braço único, n=22, TRO 27% sem RC; Dreyfuss 1987: série de 13, TRO 46%. Laurie 2011 (RS de ACC, 34 ensaios/441 pts) conclui que o esquema ótimo é incerto. Desfecho de resposta, sem comparador, n pequeno → certeza baixa; recomendação condicional (paliação sintomática).", "https://doi.org/10.1093/oxfordjournals.annonc.a010684"),
    MCBS_NA("Estudos de braço único → ESMO-MCBS não graduável."), AFF,
    "Regime não consta do protocolo. Regra derivada literalmente do pedido (glândula salivar recidivada/metastática), sem restrição de histologia. Ressalva: a referência dada pelo revisor (Laurie 2011) é específica de adenoide cístico; Licitra/Dreyfuss incluíram outras histologias — conferir se o revisor quer restringir a adenoide cístico.",
    "incompleto", ["grade_sem_estudo_pivo"],
    [FLAG_ACRESCIDO, "referencia:conferir — PMID 21147032 (Laurie 2011) é revisão sistemática de ACC, não ensaio do CAP; pivô proposto = Licitra 1996 (PMID 8879381), dose = Dreyfuss 1987 (PMID 2824016)",
     "periodicidade:conferir — Dreyfuss usa ciclo de 28 dias; Licitra não declara no abstract", FLAG_HISTO],
    OD([("tipo", "fixa"), ("ciclos", None), ("periodicidade_dias", None), ("duracao_total_semanas", None), ("fonte", "esquema"), ("indeterminado", True),
        ("nota", "nº de ciclos não fixado pelas fontes (Dreyfuss: média 4,7 ciclos; ciclo de 28 d); periodicidade 21–28 d — indeterminado de propósito"), ("selo", "estimativa")]),
    OD([("itens", [comp_item("Ciclofosfamida", 500.0, "mg_m2", "EV", [1]), comp_item("Doxorrubicina", 50.0, "mg_m2", "EV", [1]), comp_item("Cisplatina", 50.0, "mg_m2", "EV", [1])]),
        ("completa", True), ("indeterminado", False), ("nota", "doses do Dreyfuss 1987 (abstract); periodicidade em aberto (21–28 d)"), ("fonte", "esquema"), ("selo", "estimativa")]))

R2 = regime("cp-salivar-met-carboplatina-paclitaxel", "Carcinoma de glândula salivar recidivado/metastático — quimioterapia paliativa (opção acrescida pelo revisor)",
    "Carboplatina + Paclitaxel",
    "Carboplatina + Paclitaxel a cada 21 dias (doses não constam do abstract do Nakano 2016; texto completo fechado — dose a informar pelo revisor)",
    [farm("Carboplatina", None, "EV", "21/21d"), farm("Paclitaxel", None, "EV", "21/21d")],
    "10.3109/00016489.2016.1170876", "Nakano (carbo+paclitaxel, retrospectivo)", 2016, "Nakano",
    "retrospectivo, n=38, carcinoma de glândula salivar avançado/metastático (18 ductal salivar, 9 adenoide cístico, 11 outros), carboplatina + paclitaxel; TRO 39%, PFS mediana 6,5 m, SG mediana 26,5 m; TRO 9% em adenoide cístico; bem tolerado.",
    OD([("desfecho_principal", "Taxa de resposta objetiva por histologia (retrospectivo)"), ("magnitude", "Nakano 2016: TRO 39% (15/38), PFS mediana 6,5 m, SG mediana 26,5 m; TRO 9% em adenoide cístico (sem diferença de PFS/SG entre histologias)"), ("fonte", "10.3109/00016489.2016.1170876")]),
    [tox("Mielossupressão", "grave", "monitorar hemograma; G-CSF se indicado", "Bula/ficha técnica: Carboplatina/Paclitaxel"),
     tox("Neuropatia periférica", "moderada", "ajuste de dose", "Bula/ficha técnica: Paclitaxel"),
     tox("Reação de hipersensibilidade", "moderada", "pré-medicação", "Bula/ficha técnica: Paclitaxel/Carboplatina"),
     tox("Alopecia", "leve", "orientação", "Bula/ficha técnica: Paclitaxel")],
    eixo("re_derivado", "2C", "sem_afirmacao_protocolo. Nakano 2016: retrospectivo, n=38, TRO 39%, PFS 6,5 m, SG 26,5 m; resposta concentrada em ductal salivar/outros (ACC 9%). Evidência observacional, sem comparador → certeza baixa; recomendação condicional.", "https://doi.org/10.3109/00016489.2016.1170876"),
    MCBS_NA("Estudo retrospectivo sem comparador → ESMO-MCBS não graduável."), AFF,
    "Regime não consta do protocolo. Regra derivada literalmente do pedido (glândula salivar recidivada/metastática), sem restrição de histologia nem de elegibilidade a cisplatina. Ressalva: TRO 9% em adenoide cístico no Nakano 2016 — o card avisa, a regra não restringe; conferir com o revisor.",
    "incompleto", ["grade_sem_estudo_pivo"],
    [FLAG_ACRESCIDO, "evidencia_retrospectiva: Nakano 2016 é série retrospectiva (n=38); nenhuma série prospectiva de carbo+paclitaxel em salivar citada pelo revisor",
     "esquema_sem_dose: abstract não traz dose/AUC; texto completo fechado (Taylor & Francis) — dose a informar pelo revisor; composição e expectativa de uso indeterminadas de propósito",
     "histologia:conferir — TRO 9% em adenoide cístico (Nakano); regra por sítio sem restrição, como no pedido", FLAG_HISTO],
    OD([("tipo", "fixa"), ("ciclos", None), ("periodicidade_dias", 21), ("duracao_total_semanas", None), ("fonte", "esquema"), ("indeterminado", True),
        ("nota", "nº de ciclos não declarado no abstract; periodicidade 21 d é convenção do par carbo+paclitaxel, não do abstract — indeterminado"), ("selo", "estimativa")]),
    OD([("itens", [comp_item("Carboplatina", None, None, "EV", None, True, "dose/AUC não recuperável de fonte aberta"), comp_item("Paclitaxel", None, None, "EV", None, True, "dose não recuperável de fonte aberta")]),
        ("completa", False), ("indeterminado", True), ("nota", "2 de 2 itens indeterminados (abstract sem dose; texto completo fechado)"), ("fonte", "esquema"), ("selo", "estimativa")]))

R3 = regime("cp-salivar-met-cisplatina-vinorelbina", "Carcinoma de glândula salivar recidivado/metastático — quimioterapia paliativa (opção acrescida pelo revisor)",
    "Cisplatina + Vinorelbina",
    "Cisplatina 80 mg/m² EV D1 + Vinorelbina 25 mg/m² EV D1,D8, a cada 21 dias, por 4 a 6 ciclos",
    [farm("Cisplatina", "80 mg/m²", "EV", "D1 21/21d"), farm("Vinorelbina", "25 mg/m²", "EV", "D1,D8 21/21d")],
    "10.1002/hed.24933", "Hong (cis+vinorelbina, fase II) / Airoldi 2001 (fase II randomizado)", 2018, "Hong",
    "fase II braço único, n=40, carcinoma de glândula salivar recidivado e/ou metastático, vinorelbina 25 mg/m² D1,D8 + cisplatina 80 mg/m² D1 q3s × 4–6 ciclos; TRO 35% (1 RC), PFS mediana 6,3 m, SG mediana 16,9 m, sem morte relacionada. Corroborado por Airoldi 2001 (fase II randomizado, n=36, mesmo esquema exato: RC 19% + RP 25% no braço combinado vs RP 20% com vinorelbina isolada).",
    OD([("desfecho_principal", "Taxa de resposta objetiva (desfecho primário do Hong 2018)"), ("magnitude", "Hong 2018: TRO 35% (1 RC), PFS mediana 6,3 m, SG mediana 16,9 m; Airoldi 2001 (randomizado): TRO 44% (3 RC) vs 20% (0 RC) com vinorelbina isolada"), ("fonte", "10.1002/hed.24933")]),
    [tox("Mielossupressão (neutropenia)", "grave", "monitorar hemograma; G-CSF conforme risco", "Bula/ficha técnica: Vinorelbina/Cisplatina"),
     tox("Nefrotoxicidade/ototoxicidade (cisplatina)", "grave", "hidratação; audiometria", "Bula/ficha técnica: Cisplatina"),
     tox("Náuseas/vômitos", "moderada", "antiemese de alto risco emetogênico", "Bula/ficha técnica: Cisplatina"),
     tox("Neuropatia periférica / constipação", "moderada", "ajuste de dose", "Bula/ficha técnica: Vinorelbina"),
     tox("Flebite no local da infusão", "leve", "infusão em veia calibrosa; lavagem", "Bula/ficha técnica: Vinorelbina")],
    eixo("re_derivado", "2B", "sem_afirmacao_protocolo. Hong 2018: fase II braço único, n=40, TRO 35%, PFS 6,3 m, SG 16,9 m (desfecho primário = TRO). Airoldi 2001: fase II RANDOMIZADO, n=36, mesmo esquema, resposta e RC maiores com cisplatina (19% RC vs 0). Duas séries prospectivas concordantes, uma randomizada de n pequeno → certeza moderada/baixa; recomendação condicional. Melhor base entre os 3 regimes propostos.", "https://doi.org/10.1002/hed.24933"),
    MCBS_NA("Hong 2018 é braço único; Airoldi 2001 é fase II randomizado sem desfecho de sobrevida graduável no abstract → ESMO-MCBS não graduável."), AFF,
    "Regime não consta do protocolo. Regra derivada literalmente do pedido (glândula salivar recidivada/metastática), sem restrição de histologia. Populações do Hong 2018 e do Airoldi 2001 (61% adenoide cístico) concordam com a regra ampla.",
    "incompleto", ["grade_sem_estudo_pivo"],
    [FLAG_ACRESCIDO, "corroboracao: Airoldi 2001 (PMID 11169936, fase II randomizado, mesmo esquema) não foi citado pelo revisor — acrescido pelo squad como 2ª referência", FLAG_HISTO],
    OD([("tipo", "fixa"), ("ciclos", 6), ("periodicidade_dias", 21), ("duracao_total_semanas", 18.0), ("fonte", "esquema"), ("indeterminado", False),
        ("nota", "4 a 6 ciclos (Hong 2018); teto de 6 ciclos usado no cálculo"), ("selo", "estimativa")]),
    OD([("itens", [comp_item("Cisplatina", 80.0, "mg_m2", "EV", [1]), comp_item("Vinorelbina", 25.0, "mg_m2", "EV", [1, 8])]),
        ("completa", True), ("indeterminado", False), ("nota", None), ("fonte", "esquema"), ("selo", "estimativa")]))

REGIMES = [R1, R2, R3]

# ---------------------------------------------------------------------------
# Conferências contra o run ativo (a proposta tem de encaixar sem surpresa)
# ---------------------------------------------------------------------------
ids = {r["regimen_id"] for r in ativo["regimes"]}
for r in REGIMES: assert r["regimen_id"] not in ids, r["regimen_id"]
campos = {c["campo"]: c for c in fatia["campos_primitivos"]}
assert "glandula_salivar" not in campos["tumor"]["opcoes"] and "histologia_salivar" not in campos
assert "metastatico" in campos and campos["metastatico"]["tipo"] == "boolean"
for r in ativo["regimes"]:
    if r["tumor"] == "cabeca-pescoco":
        s = json.dumps(r["elegibilidade"]["regra"]); assert '"tumor"' in s and "glandula_salivar" not in s
hashes = OD((r["regimen_id"], bd.content_hash(r)) for r in REGIMES)

out = OD([
    ("meta", OD([("titulo", "PROPOSTA (Fase 1) — 3 regimes de glândula salivar a pedido do revisor — NÃO É RUN, NÃO É INTAKE"),
                 ("gerado_em", HOJE), ("sobre_run_ativo", RUN_ATIVO), ("status", "proposta aguardando apresentação; intake e publicação só por comando humano (sexta, pós-demo)"),
                 ("decisao_fora_do_fluxo", ORIGEM),
                 ("referencias_verificadas", [OD([("doi", k)] + list(v.items())) for k, v in REFS.items()]),
                 ("vocabulario_cabeca_pescoco", VOCAB),
                 ("hashes_previstos", hashes),
                 ("consequencias_previstas", OD([("regimes", f"{ativo['meta']['total_regimes']} → {ativo['meta']['total_regimes'] + 3}"), ("hashes_existentes_que_mudam", 0), ("aprovacoes_que_expiram", 0),
                     ("selos_novos", {"incompleto": 3}), ("fila_do_revisor", "3 em Pendente (rederivado_aguarda_revisao)"),
                     ("app", "sem código novo: enum + campo com indeterminado/rotulos já são suportados pelo motor desde os drivers de pulmão (94dc6cd)")])),
                 ("pendencias_referendo", [
                     "CAP: restringir a adenoide cístico? (a referência dada, Laurie 2011, é RS de ACC; Licitra/Dreyfuss incluíram outras histologias)",
                     "CAP: periodicidade 21 ou 28 dias? (Dreyfuss: 28; Licitra não declara no abstract)",
                     "Carbo+paclitaxel: dose/AUC e nº de ciclos (não recuperáveis de fonte aberta) — revisor informa ou fica indeterminado",
                     "Carbo+paclitaxel: posicionar só para inelegíveis a cisplatina? (não pedido; não imposto) e avisar sobre TRO 9% em ACC",
                     "Cis+vinorelbina: aceitar Airoldi 2001 como 2ª referência (corroboração não citada pelo revisor)?",
                     "Linha: os três nascem sem restrição de linha (Licitra/Airoldi tinham pré-tratados; Hong 'recidivado e/ou metastático') — confirmar",
                     "histologia_salivar: manter só registrada (proposta) ou já condicionar regras?"])])),
    ("regimes", REGIMES)])
dest = os.path.join(AQUI, "regimes-propostos-salivar.json")
json.dump(out, open(dest, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("ok —", dest); print("run ativo:", RUN_ATIVO, "| regimes hoje:", ativo["meta"]["total_regimes"])
for k, v in hashes.items(): print("  ", k, v)
