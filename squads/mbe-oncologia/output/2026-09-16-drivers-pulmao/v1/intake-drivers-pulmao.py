#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
INTAKE — DRIVERS DE PULMÃO (EGFR / ALK / ROS1 / histologia), run 2026-09-16-drivers-pulmao/v1.

Roda SOBRE ESTE RUN, que nasceu como cópia (só dados) do run ativo 2026-09-15-intake-revisao-3/v1.
RUN_ATIVO não é tocado: publicar é decisão humana, depois dos portões. O script roda UMA vez
sobre a cópia limpa; se precisar refazer, copie o run ativo de novo.

Origem da decisão (não veio pelo export da Mesa — os pareceres da Fase A ainda serão gravados em
produção com a mesma origem): decisão clínica do revisor Gustavo Drummond Pinho Ribeiro, relato
via WhatsApp em 16/09/2026, transmitida por Gustavo Couto; proposta técnica (Fase B) aprovada
integralmente em 16/09/2026, incluindo o adendo do escamoso.

  (a) um campo por marcador genético — EGFR, ALK e ROS1 separados;
  (b) qualquer driver positivo exclui imunoterapia de 1ª linha — a regra expressa isso por marcador;
  (c) três estados por driver (mutado/alterado · negativo · não testado); "não testado" NUNCA
      libera verde — token indeterminado declarado no dado → 🟡 nos dois motores;
  (d) adendo: "Para CEC de pulmão só vale a pena ter PD-L1; o resto pouco importa" → primitivo
      histologia {nao_escamoso, escamoso}; exigência de drivers só para não-escamoso; KEYNOTE-407
      vira regime próprio (escamoso, sem drivers), KEYNOTE-189 fica com o id existente.

O que muda: vocabulário de pulmao-nsclc (sai egfr_alk, egfr_mutado, egfr_negativo, egfr_exon20,
alk_positivo, ros1_positivo, mutacao_acionavel; entra histologia, egfr_status, alk_status,
ros1_status); regra de 14 regimes (6 de conteúdo + 8 só vocabulário); 1 regime novo (KEYNOTE-407).
Texto-fonte (elegibilidade_protocolo) NÃO é alterado — é o que o protocolo institucional afirma.
Regras da casa: nada inventado (referência nova só VERIFICADA no Crossref + PubMed, transcrita);
'confirmado' nunca é atribuído pelo intake; hash muda só onde a mudança é de propósito; os
pareceres/aprovações que expiram são reportados, não suprimidos.
"""
import json, os, sys, copy, importlib.util
from collections import Counter, OrderedDict

AQUI = os.path.dirname(os.path.abspath(__file__))
SQUAD = os.path.abspath(os.path.join(AQUI, "..", "..", ".."))
RAIZ = os.path.abspath(os.path.join(SQUAD, "..", ".."))
AGG = os.path.join(AQUI, "regimes-consolidados.json")
TUMOR = "pulmao-nsclc"
POR_TUMOR = os.path.join(AQUI, TUMOR, "v1", "regimes-consolidados.json")
HOJE = "2026-09-16"
LOTE = "drivers-pulmao"
REVISOR = "Gustavo Drummond Pinho Ribeiro"
ORIGEM_RUN = "2026-09-15-intake-revisao-3/v1"
ESTE_RUN = "2026-09-16-drivers-pulmao/v1"

# hash: a MESMA função do app (fonte única da regra de expiração de parecer)
spec = importlib.util.spec_from_file_location("bd", os.path.join(RAIZ, "app", "build-data.py"))
bd = importlib.util.module_from_spec(spec); sys.modules["bd"] = bd; spec.loader.exec_module(bd)
content_hash = bd.content_hash

def _carregar(nome, caminho):
    d = os.path.dirname(caminho); sys.path.insert(0, d)
    try:
        sp = importlib.util.spec_from_file_location(nome, caminho)
        m = importlib.util.module_from_spec(sp); sys.modules[nome] = m; sp.loader.exec_module(m)
    finally:
        sys.path.remove(d)
    return m
_reg_comp = _carregar("regras_composicao", os.path.join(SQUAD, "extracao-composicao", "regras.py"))
_reg_exp = _carregar("regras_expectativa", os.path.join(SQUAD, "extracao-expectativa-uso", "regras.py"))
compor_composicao = _reg_comp.compor

# ---------------------------------------------------------------------------
# A decisão (uma só, aplicada a todos os regimes do lote)
# ---------------------------------------------------------------------------
JUSTIFICATIVA = (
    "Decisão clínica do revisor Gustavo Drummond Pinho Ribeiro (relato via WhatsApp em 16/09/2026, transmitida por Gustavo Couto): "
    "(a) um campo por marcador genético — EGFR, ALK e ROS1 separados; (b) qualquer driver positivo exclui imunoterapia de 1ª linha, "
    "e a regra expressa isso por marcador; (c) três estados por driver (mutado/alterado · negativo · não testado), com 'não testado' "
    "NUNCA liberando verde — fica no amarelo pedindo o dado. Adendo: 'Para CEC de pulmão só vale a pena ter PD-L1; o resto pouco importa' "
    "→ histologia {não-escamoso, escamoso}; exigência de drivers só para não-escamoso. Fase B (proposta técnica) aprovada integralmente em "
    "16/09/2026. Referendo formal do revisor pela própria fila: o ajuste expira o hash e o regime volta para re-revisão.")
DEC = OrderedDict([("regimen_id", None), ("data", HOJE), ("revisor", REVISOR), ("acao", "ajustar_elegibilidade"),
                   ("natureza", "dado"), ("eixo", "elegibilidade"), ("justificativa", JUSTIFICATIVA)])

# Referências VERIFICADAS em 16/09/2026 (Crossref + PubMed; transcrição do que o registro devolveu)
VERIFICADAS = {
    "10.1056/NEJMoa1801005": {"ok": True, "pmid": "29658856", "estudo": "KEYNOTE-189", "ano": 2018, "primeiro_autor": "Gandhi",
        "citacao": "GANDHI L et al. Pembrolizumab plus Chemotherapy in Metastatic Non-Small-Cell Lung Cancer. N Engl J Med. 2018;378:2078-2092.",
        "tema": "fase 3, CPNPC metastático NÃO-ESCAMOSO sem mutação sensibilizante de EGFR ou ALK, pembrolizumabe + pemetrexede + platina vs placebo + QT",
        "abstract_trecho": "metastatic nonsquamous NSCLC without sensitizing EGFR or ALK mutations"},
    "10.1056/NEJMoa1810865": {"ok": True, "pmid": "30280635", "estudo": "KEYNOTE-407", "ano": 2018, "primeiro_autor": "Paz-Ares",
        "citacao": "PAZ-ARES L et al. Pembrolizumab plus Chemotherapy for Squamous Non-Small-Cell Lung Cancer. N Engl J Med. 2018;379:2040-2051.",
        "tema": "fase 3 duplo-cego, n=559, CPNPC metastático ESCAMOSO não tratado, pembrolizumabe 200 mg (até 35 ciclos) + carboplatina + paclitaxel ou nab-paclitaxel (4 ciclos) vs placebo + QT; desfechos primários SG e SLP",
        "abstract_trecho": "median overall survival 15.9 months vs 11.3 months (hazard ratio for death, 0.64); median progression-free survival 6.4 months vs 4.8 months (hazard ratio 0.56)"},
    "10.1056/NEJMoa1606774": {"ok": True, "pmid": "27718847", "estudo": "KEYNOTE-024", "ano": 2016, "primeiro_autor": "Reck",
        "citacao": "RECK M et al. Pembrolizumab versus Chemotherapy for PD-L1-Positive Non-Small-Cell Lung Cancer. N Engl J Med. 2016;375:1823-1833.",
        "tema": "fase 3, CPNPC avançado PD-L1≥50%, pembrolizumabe vs QT à base de platina",
        "abstract_trecho": "no sensitizing mutation of the epidermal growth factor receptor gene or translocation of the anaplastic lymphoma kinase gene"},
}

# ---------------------------------------------------------------------------
# Vocabulário novo de pulmao-nsclc
# ---------------------------------------------------------------------------
APOSENTADOS = ["egfr_alk", "egfr_mutado", "egfr_negativo", "egfr_exon20", "alk_positivo", "ros1_positivo", "mutacao_acionavel"]
SECAO = "Biologia molecular"
NOVOS = [
    OrderedDict([("campo", "histologia"), ("tipo", "enum"), ("label", "Histologia"), ("secao", SECAO),
                 ("opcoes", ["nao_escamoso", "escamoso"]),
                 ("rotulos", OrderedDict([("nao_escamoso", "Não-escamoso (adenocarcinoma, grandes células, adenoescamoso, NOS)"), ("escamoso", "Escamoso (CEC)")])),
                 ("nota", "Default não-escamoso = o lado que exige mais (drivers). Misto/NOS conta como não-escamoso: testa drivers e admite pemetrexede.")]),
    OrderedDict([("campo", "egfr_status"), ("tipo", "enum"), ("label", "EGFR"), ("secao", SECAO),
                 ("opcoes", ["nao_testado", "negativo", "mutado_sensibilizante", "mutado_exon20", "mutado_outra"]),
                 ("indeterminado", ["nao_testado"]),
                 ("rotulos", OrderedDict([("nao_testado", "Não testado"), ("negativo", "Negativo (selvagem)"),
                                          ("mutado_sensibilizante", "Mutado — sensibilizante (ex19del / L858R)"),
                                          ("mutado_exon20", "Mutado — inserção exon 20"), ("mutado_outra", "Mutado — outra mutação")])),
                 ("nota", "'nao_testado' é indeterminado para o motor: nunca libera verde, segura no amarelo pedindo o dado.")]),
    OrderedDict([("campo", "alk_status"), ("tipo", "enum"), ("label", "ALK"), ("secao", SECAO),
                 ("opcoes", ["nao_testado", "negativo", "rearranjado"]), ("indeterminado", ["nao_testado"]),
                 ("rotulos", OrderedDict([("nao_testado", "Não testado"), ("negativo", "Negativo"), ("rearranjado", "Rearranjado / fusão (ALK+)")]))]),
    OrderedDict([("campo", "ros1_status"), ("tipo", "enum"), ("label", "ROS1"), ("secao", SECAO),
                 ("opcoes", ["nao_testado", "negativo", "rearranjado"]), ("indeterminado", ["nao_testado"]),
                 ("rotulos", OrderedDict([("nao_testado", "Não testado"), ("negativo", "Negativo"), ("rearranjado", "Rearranjado / fusão (ROS1+)")]))]),
]
CRIT_ID = "drivers_negativos_ou_escamoso"
CRIT_DEF = OrderedDict([("id", CRIT_ID), ("label", "Sem driver acionável (ou histologia escamosa)"),
    ("expr", {"or": [{"eq": ["histologia", "escamoso"]},
                     {"and": [{"eq": ["egfr_status", "negativo"]}, {"eq": ["alk_status", "negativo"]}, {"eq": ["ros1_status", "negativo"]}]}]}),
    ("nota", "Escamoso passa sem drivers (adendo do revisor). Não-escamoso: os três negativos; qualquer 'nao_testado' → indeterminado (🟡); qualquer positivo → falso (🔴). Um terceiro valor de histologia, se um dia existir, cai no lado que exige drivers.")])

def eq(c, v): return {"eq": [c, v]}
def ref(): return {"ref": CRIT_ID}
def crit(campo, op, valor): return OrderedDict([("campo", campo), ("operador", op), ("valor", valor)])
def crit_ref(): return crit(CRIT_ID, "=", True)   # composto no espelho legado (a app legada trata composto como derivado)

# regimen_id -> (regra nova, espelho criterios_inclusao, usa_ref, nota curta, tipo)
REGRAS = OrderedDict([
    # ---- 6 de conteúdo ----
    ("nsclc-neoadj-nivolumabe-qt", ({"and": [eq("ressecavel", True), eq("pdl1_pos", True), ref()]},
        [crit("ressecavel", "=", True), crit("pdl1_pos", "=", True), crit_ref()], True,
        "egfr_alk='negativos' (enum de opção única) → critério nomeado drivers_negativos_ou_escamoso. Texto-fonte cita EGFR e ALK; ROS1 entra pelo critério único do tumor — PENDÊNCIA DE REFERENDO (ROS1 nos curativos).", "conteudo")),
    ("nsclc-periop-pembrolizumabe-qt", ({"and": [eq("ressecavel", True), ref()]},
        [crit("ressecavel", "=", True), crit_ref()], True,
        "egfr_alk='negativos' → critério nomeado drivers_negativos_ou_escamoso. Texto-fonte cita EGFR e ALK; ROS1 entra pelo critério único do tumor — PENDÊNCIA DE REFERENDO (ROS1 nos curativos).", "conteudo")),
    ("nsclc-def-crt-durvalumab", ({"and": [eq("estadio", "III_irressecavel"), {"or": [eq("histologia", "escamoso"), eq("egfr_status", "negativo")]}]},
        [crit("estadio", "=", "III_irressecavel"), crit("egfr_status", "=", "negativo")], False,
        "egfr_negativo=true (booleano) → (histologia=escamoso ∨ egfr_status=negativo), inline e fiel ao texto (só EGFR). PD-L1≥1% do texto segue fora da regra — item separado para o revisor.", "conteudo")),
    ("nsclc-adj-atezolizumabe-pdl1", ({"and": [eq("ressecado", True), eq("pdl1_alto", True), ref()]},
        [crit("ressecado", "=", True), crit("pdl1_alto", "=", True), crit_ref()], True,
        "Texto-fonte exige EGFR/ALK/ROS1 negativos e a regra não cobrava nenhum driver (verde sem perguntar) → critério nomeado drivers_negativos_ou_escamoso.", "conteudo")),
    ("nsclc-met-io-mono-pdl1alto", ({"and": [eq("metastatico", True), eq("pdl1_alto", True), ref()]},
        [crit("metastatico", "=", True), crit("pdl1_alto", "=", True), crit_ref()], True,
        "mutacao_acionavel=false (booleano composto presumido false) → critério nomeado: escamoso só PD-L1; não-escamoso PD-L1 + drivers negativos. KEYNOTE-024 (PMID 27718847) excluiu EGFR/ALK; ROS1 entra pela decisão (b) — PENDÊNCIA DE REFERENDO.", "conteudo")),
    ("nsclc-met-io-qt-pdl1baixo", ({"and": [eq("metastatico", True), eq("pdl1_alto", False), eq("histologia", "nao_escamoso"),
                                             eq("egfr_status", "negativo"), eq("alk_status", "negativo"), eq("ros1_status", "negativo")]},
        [crit("metastatico", "=", True), crit("pdl1_alto", "=", False), crit("histologia", "=", "nao_escamoso"),
         crit("egfr_status", "=", "negativo"), crit("alk_status", "=", "negativo"), crit("ros1_status", "=", "negativo")], False,
        "Regime conjunto KEYNOTE-189/407 separado: este id fica com o KEYNOTE-189 (não-escamoso, pemetrexede + platina, drivers negativos — histologia aqui é população, não condição). KEYNOTE-407 nasce como regime próprio. ROS1 além do abstract (EGFR/ALK) — PENDÊNCIA DE REFERENDO.", "conteudo")),
    # ---- 8 só de vocabulário (semântica idêntica) ----
    ("nsclc-adj-osimertinibe-egfr", ({"and": [eq("ressecado", True), eq("egfr_status", "mutado_sensibilizante")]},
        [crit("ressecado", "=", True), crit("egfr_status", "=", "mutado_sensibilizante")], False, "egfr_mutado=true → egfr_status=mutado_sensibilizante (texto-fonte: ex19del/L858R).", "vocabulario")),
    ("nsclc-met-osimertinibe-egfr", ({"and": [eq("metastatico", True), eq("egfr_status", "mutado_sensibilizante")]},
        [crit("metastatico", "=", True), crit("egfr_status", "=", "mutado_sensibilizante")], False, "egfr_mutado=true → egfr_status=mutado_sensibilizante (texto-fonte: ex19del/L858R).", "vocabulario")),
    ("nsclc-met-osi-qt-egfr", ({"and": [eq("metastatico", True), eq("egfr_status", "mutado_sensibilizante"), eq("alto_volume_ou_snc", True)]},
        [crit("metastatico", "=", True), crit("egfr_status", "=", "mutado_sensibilizante"), crit("alto_volume_ou_snc", "=", True)], False, "egfr_mutado=true → egfr_status=mutado_sensibilizante.", "vocabulario")),
    ("nsclc-met-amivantamab-nao-incluido", ({"and": [eq("metastatico", True), eq("egfr_status", "mutado_sensibilizante")]},
        [crit("metastatico", "=", True), crit("egfr_status", "=", "mutado_sensibilizante")], False, "egfr_mutado=true → egfr_status=mutado_sensibilizante (MARIPOSA: ex19del/L858R). Segue NÃO incluído.", "vocabulario")),
    ("nsclc-met-papillon-exon20-nao-incluido", ({"and": [eq("metastatico", True), eq("egfr_status", "mutado_exon20")]},
        [crit("metastatico", "=", True), crit("egfr_status", "=", "mutado_exon20")], False, "egfr_exon20=true → egfr_status=mutado_exon20. Segue NÃO incluído.", "vocabulario")),
    ("nsclc-adj-alectinibe-alk", ({"and": [eq("ressecado", True), eq("alk_status", "rearranjado")]},
        [crit("ressecado", "=", True), crit("alk_status", "=", "rearranjado")], False, "alk_positivo=true → alk_status=rearranjado.", "vocabulario")),
    ("nsclc-met-alectinibe-alk", ({"and": [eq("metastatico", True), eq("alk_status", "rearranjado")]},
        [crit("metastatico", "=", True), crit("alk_status", "=", "rearranjado")], False, "alk_positivo=true → alk_status=rearranjado.", "vocabulario")),
    ("nsclc-met-crizotinibe-ros1", ({"and": [eq("metastatico", True), eq("ros1_status", "rearranjado")]},
        [crit("metastatico", "=", True), crit("ros1_status", "=", "rearranjado")], False, "ros1_positivo=true → ros1_status=rearranjado.", "vocabulario")),
])
ID_189 = "nsclc-met-io-qt-pdl1baixo"
ID_407 = "nsclc-met-io-qt-pdl1baixo-escamoso"

# ---------------------------------------------------------------------------
# helpers (mesmos dos lotes 2/3)
# ---------------------------------------------------------------------------
def carregar(p):
    return json.load(open(p, encoding="utf-8"), object_pairs_hook=OrderedDict)

def hist(r, origem, nota, eixos=None, fonte=None, bump=True):
    if bump:
        r["versao"] = int(r.get("versao") or 1) + 1
    r.setdefault("historico_versoes", []).append(OrderedDict([
        ("versao", r["versao"]), ("data", HOJE), ("origem", origem), ("mudanca", nota),
        ("eixos_afetados", eixos or []), ("fonte", fonte), ("decidido_por", REVISOR)]))
    r["atualizado_em"] = HOJE

def anotar(r, dec, decisao_revisao, nota_squad=None):
    c = r["consolidacao"]
    c["decisao_revisao"] = decisao_revisao
    c["nota_revisao"] = dec["justificativa"]
    c.setdefault("notas_revisao", []).append(OrderedDict([
        ("lote", LOTE), ("data", dec["data"]), ("revisor", dec["revisor"]), ("acao", dec["acao"]),
        ("natureza", dec.get("natureza")), ("eixo", dec.get("eixo")), ("nota", dec["justificativa"]),
        ("nota_squad", nota_squad)]))
    r["revisado_por"] = dec["revisor"]; r["revisado_em"] = dec["data"]

def set_flag(r, texto, remover_prefixo=None):
    for lst in (r["consolidacao"].setdefault("flags", []), r.setdefault("flags", [])):
        if remover_prefixo:
            lst[:] = [f for f in lst if not str(f).startswith(remover_prefixo)]
        if texto and texto not in lst:
            lst.append(texto)

def ref_verificada(doi, nota=None):
    v = VERIFICADAS[doi]; assert v["ok"], doi
    d = OrderedDict([
        ("citacao", v["citacao"]), ("doi", doi), ("pmid", v["pmid"]), ("estudo", v["estudo"]),
        ("ano", v["ano"]), ("primeiro_autor", v["primeiro_autor"]),
        ("verificacao", OrderedDict([("registro", "Crossref + PubMed"), ("data", HOJE), ("congruente", True), ("tema", v["tema"])]))])
    if nota:
        d["nota"] = nota
    return d

def selo_por_eixos(r, forcar=None):
    """Regra do Step 07, conservadora: diverge > lacuna/indeterminado(incompleto) > re_derivado.
    'confirmado' nunca é atribuído pelo intake."""
    v = r["verificacao"]; c = r["consolidacao"]
    st = {ax: (v.get(ax) or {}).get("status") for ax in ("grade", "esmo_mcbs", "nccn_affordability", "elegibilidade")}
    c["eixos_diverge"] = [ax for ax, s in st.items() if s == "diverge"]
    if forcar:
        selo = forcar
    elif c["eixos_diverge"]:
        selo = "divergencia"
    elif c.get("lacunas") or st["grade"] == "indeterminado" or not (r.get("referencia") or {}).get("doi"):
        selo = "incompleto"
    else:
        selo = "re_derivado"
    c["status"] = selo; c["selo_confianca"] = selo
    for lst in (c["flags"], r["flags"]):
        lst[:] = [f for f in lst if not str(f).startswith("divergencia:")]
        for ax in c["eixos_diverge"]:
            lst.append(f"divergencia:{ax}")
    return selo

def aplicar_regra(r, regra, espelho, usa_ref, nota):
    e = r["elegibilidade"]
    antes = json.dumps(e["regra"], ensure_ascii=False)
    e["regra"] = regra
    e["criterios"] = [copy.deepcopy(CRIT_DEF)] if usa_ref else []
    ve = r["verificacao"]["elegibilidade"]
    ve["criterios_inclusao"] = espelho
    ve["justificativa"] = (ve.get("justificativa") or "").rstrip() + f" | {HOJE}: {nota}"
    ve["rederivado_em"] = HOJE; ve["rederivado_por"] = "intake-drivers-pulmao:verificador-elegibilidade"
    return antes

# ---------------------------------------------------------------------------
def main():
    data = carregar(AGG)
    regimes = data["regimes"]
    by = {r["regimen_id"]: r for r in regimes}
    assert ID_407 not in by, "script já rodou sobre este run — copie o run ativo de novo"
    for rid in REGRAS:
        assert rid in by, rid
    hashes_antes = {r["regimen_id"]: content_hash(r) for r in regimes}
    aprov_antes = {r["regimen_id"]: [a for a in (r["consolidacao"].get("aprovacoes") or [])] for r in regimes}

    # ---- 1. vocabulário ----
    pt = carregar(POR_TUMOR)
    vocab_antes = [c["campo"] for c in pt["campos_primitivos"]]
    assert set(APOSENTADOS) <= set(vocab_antes), set(APOSENTADOS) - set(vocab_antes)
    novo_vocab = []
    inseriu = False
    for c in pt["campos_primitivos"]:
        if c["campo"] in APOSENTADOS:
            if not inseriu:
                novo_vocab.extend(copy.deepcopy(NOVOS)); inseriu = True   # no lugar do primeiro aposentado (egfr_alk)
            continue
        novo_vocab.append(c)
    vocab_depois = [c["campo"] for c in novo_vocab]
    assert len(vocab_depois) == len(set(vocab_depois))

    # ---- 2. regras dos 14 regimes ----
    ELEG = []
    for rid, (regra, espelho, usa_ref, nota, tipo) in REGRAS.items():
        r = by[rid]
        d = copy.deepcopy(DEC); d["regimen_id"] = rid
        antes = aplicar_regra(r, regra, espelho, usa_ref, nota)
        selo_antes = r["consolidacao"]["selo_confianca"]
        anotar(r, d, "rederivado_aguarda_revisao", nota_squad=nota)
        selo = selo_por_eixos(r)
        hist(r, f"intake-drivers-pulmao:ajustar_elegibilidade ({tipo})",
             ("Drivers por marcador (EGFR/ALK/ROS1) em três estados + histologia: " if tipo == "conteudo" else "Migração de vocabulário (semântica idêntica): ") + nota,
             ["elegibilidade"], None, bump=True)
        ELEG.append(OrderedDict([("regimen_id", rid), ("tipo", tipo), ("antes", antes), ("depois", json.dumps(regra, ensure_ascii=False)),
                                 ("selo_antes", selo_antes), ("selo_depois", selo), ("nota", nota)]))

    # ---- 3. KEYNOTE-189 fica com o id; KEYNOTE-407 nasce ----
    r189 = by[ID_189]
    r407 = copy.deepcopy(r189)   # base ANTES das edições de identidade abaixo; consolidacao/histórico refeitos adiante
    r189["subtipo"] = "CPNPC metastático NÃO-ESCAMOSO sem driver acionável, PD-L1<50% — 1ª linha (QT+IO)"
    r189["nome"] = "Pembrolizumabe + Pemetrexede + Platina (KEYNOTE-189) — não-escamoso"
    r189["esquema"] = "Pembrolizumabe 200 mg + carboplatina/cisplatina + pemetrexede, 21/21d x4 → manutenção (pembrolizumabe + pemetrexede)"
    r189["farmacos"] = [OrderedDict([("nome", "Pembrolizumabe"), ("dose", "200 mg"), ("via", "EV"), ("frequencia", "21/21d")]),
                        OrderedDict([("nome", "Platina + Pemetrexede"), ("dose", "conforme protocolo"), ("via", "EV"), ("frequencia", "21/21d x4")])]
    r189["referencia"] = ref_verificada("10.1056/NEJMoa1801005", nota="Regime conjunto 189/407 separado por decisão do revisor (16/09/2026); KEYNOTE-407 agora em " + ID_407 + ".")
    r189["beneficio"]["magnitude"] = "KEYNOTE-189: SG HR 0,49"
    r189["verificacao"]["grade"]["justificativa"] = "KEYNOTE-189 (fase 3, não-escamoso): QT+pembrolizumabe superior à QT. Recomendação forte independentemente de PD-L1."
    r189["verificacao"]["esmo_mcbs"]["justificativa"] = "Ganho de SG (HR 0,49) → ESMO-MCBS 4 (derivação do squad para o componente 189 do antigo card conjunto)."
    r189["verificacao"]["elegibilidade"]["divergencia_vs_protocolo"] = "Concorda: KEYNOTE-189 em metastático não-escamoso sem driver."
    comp = compor_composicao(r189); comp["fonte"] = "esquema"; comp["selo"] = "estimativa"; r189["composicao"] = comp
    prop, _tr = _reg_exp.propor(r189); assert prop["tipo"] == "ate_progressao", prop   # expectativa_uso (PFS 8,8 m, KEYNOTE-189) permanece válida
    set_flag(r189, "separado_do_conjunto_189_407: escamoso (KEYNOTE-407) agora é regime próprio (" + ID_407 + "); doses de platina/pemetrexede seguem 'conforme protocolo' — não inventadas pelo intake")
    hist(r189, "intake-drivers-pulmao:separacao_189_407",
         "Card conjunto KEYNOTE-189/407 separado: este id passa a ser só o KEYNOTE-189 (não-escamoso; pemetrexede + platina). Nome, esquema, fármacos, referência (verificada), benefício e justificativas ajustados; composição re-derivada pelas regras mecânicas; expectativa de uso (PFS 8,8 m do 189) mantida.",
         [], "10.1056/NEJMoa1801005", bump=False)

    r407["regimen_id"] = ID_407
    r407["subtipo"] = "CPNPC metastático ESCAMOSO, PD-L1<50% — 1ª linha (QT+IO; sem exigência de drivers — adendo do revisor)"
    r407["nome"] = "Pembrolizumabe + Carboplatina + (nab-)Paclitaxel (KEYNOTE-407) — escamoso"
    r407["esquema"] = "Pembrolizumabe 200 mg + carboplatina + paclitaxel ou nab-paclitaxel, 21/21d x4 → manutenção (pembrolizumabe)"
    r407["farmacos"] = [OrderedDict([("nome", "Pembrolizumabe"), ("dose", "200 mg"), ("via", "EV"), ("frequencia", "21/21d")]),
                        OrderedDict([("nome", "Carboplatina + Paclitaxel/nab-Paclitaxel"), ("dose", "conforme protocolo"), ("via", "EV"), ("frequencia", "21/21d x4")])]
    r407["elegibilidade_protocolo"] = ("CPNPC metastático escamoso, PD-L1 1-49% ou <1%, 1ª linha (QT + imunoterapia). Card criado por decisão do revisor "
        "(16/09/2026) ao separar o card institucional conjunto 'sem mutações acionáveis, PD-L1 1-49% ou <1%, conforme histologia': "
        "'para CEC de pulmão só vale a pena ter PD-L1; o resto pouco importa' — sem exigência de drivers.")
    r407["elegibilidade"] = OrderedDict([("criterios", []), ("regra", {"and": [eq("metastatico", True), eq("pdl1_alto", False), eq("histologia", "escamoso")]})])
    r407["referencia"] = ref_verificada("10.1056/NEJMoa1810865")
    r407["beneficio"] = OrderedDict([("desfecho_principal", "↑ sobrevida global vs quimioterapia"),
        ("magnitude", "KEYNOTE-407: SG mediana 15,9 vs 11,3 m, HR 0,64; SLP 6,4 vs 4,8 m, HR 0,56 (abstract, PMID 30280635)"), ("fonte", "10.1056/NEJMoa1810865")])
    v = r407["verificacao"]
    v["grade"] = OrderedDict([("status", "re_derivado"), ("valor_rederivado", "1A"), ("afirmado_protocolo", None),
        ("justificativa", "KEYNOTE-407 (fase 3 duplo-cego, n=559, escamoso): QT+pembrolizumabe superior à QT em SG e SLP. Recomendação forte independentemente de PD-L1."),
        ("fonte", "https://doi.org/10.1056/NEJMoa1810865")])
    v["esmo_mcbs"] = OrderedDict([("status", "re_derivado"), ("valor_rederivado", "4"), ("afirmado_protocolo", None),
        ("justificativa", "Ganho de SG (HR 0,64) → ESMO-MCBS 4 — derivação do squad já existente para o componente 407 do antigo card conjunto ('HR 0,49-0,64 → 4'); transcrita, não re-graduada pelo intake."),
        ("fonte", "https://doi.org/10.1056/NEJMoa1810865")])
    v["nccn_affordability"]["fonte"] = "estimativa qualitativa"
    v["elegibilidade"] = OrderedDict([("status", "re_derivado"),
        ("criterios_inclusao", [crit("metastatico", "=", True), crit("pdl1_alto", "=", False), crit("histologia", "=", "escamoso")]),
        ("criterios_exclusao", []), ("amplitude", None),
        ("divergencia_vs_protocolo", "Concorda: KEYNOTE-407 em metastático escamoso. Sem exigência de drivers por decisão do revisor (o ensaio não exigiu teste em escamoso)."),
        ("justificativa", "Derivado da decisão do revisor (16/09/2026) confrontada com a população do pivô (escamoso, não tratado, qualquer PD-L1). O corte pdl1_alto=false é o do card institucional (mono-IO para ≥50%), mantido — o ensaio incluiu qualquer PD-L1: PENDÊNCIA DE REFERENDO."),
        ("fonte", "https://doi.org/10.1056/NEJMoa1810865"), ("rederivado_em", HOJE), ("rederivado_por", "intake-drivers-pulmao:verificador-elegibilidade")])
    d407 = copy.deepcopy(DEC); d407["regimen_id"] = ID_407
    flags407 = ["regime_separado_pelo_revisor: nasce do card conjunto KEYNOTE-189/407 (" + ID_189 + ") por decisão de 16/09/2026; escamoso sem exigência de drivers",
                "pendencia_referendo: corte pdl1_alto=false herdado do card institucional — o KEYNOTE-407 incluiu qualquer PD-L1",
                "doses de carboplatina/(nab-)paclitaxel 'conforme protocolo' — não inventadas pelo intake (ver pivô)"]
    r407["consolidacao"] = OrderedDict([
        ("status", "re_derivado"), ("selo_confianca", "re_derivado"), ("eixos_diverge", []), ("lacunas", []), ("flags", list(flags407)),
        ("decisao_revisao", "rederivado_aguarda_revisao"), ("nota_revisao", JUSTIFICATIVA),
        ("notas_revisao", [OrderedDict([("lote", LOTE), ("data", HOJE), ("revisor", REVISOR), ("acao", "outro (regime novo)"), ("natureza", "dado"), ("eixo", "elegibilidade"),
                                        ("nota", JUSTIFICATIVA), ("nota_squad", "Regime criado ao separar o card conjunto 189/407. Pivô verificado no Crossref/PubMed; GRADE/ESMO-MCBS transcritos da derivação já existente do squad para o componente 407; elegibilidade re-derivada.")])]),
        ("origem", OrderedDict([("decisao_em", ID_189), ("lote", LOTE), ("data", HOJE), ("revisor", REVISOR)])),
    ])
    r407["versao"] = 1; r407["atualizado_em"] = HOJE; r407["revisado_por"] = REVISOR; r407["revisado_em"] = HOJE
    r407["historico_versoes"] = [OrderedDict([("versao", 1), ("data", HOJE), ("origem", "intake-drivers-pulmao:outro (regime novo)"),
        ("mudanca", "Criado por decisão do revisor (16/09/2026): KEYNOTE-407 (escamoso) separado do card conjunto 189/407; regra metastatico ∧ pdl1_alto=false ∧ histologia=escamoso, sem drivers. Pivô verificado; benefício transcrito do abstract."),
        ("eixos_afetados", ["grade", "esmo_mcbs", "nccn_affordability", "elegibilidade"]), ("fonte", "10.1056/NEJMoa1810865"), ("decidido_por", REVISOR)])]
    r407["flags"] = list(flags407)
    r407["expectativa_uso"] = OrderedDict([("tipo", "ate_progressao"), ("duracao_mediana_tratamento_meses", None), ("proxy", "pfs"), ("pfs_mediana_meses", 6.4),
        ("fonte_doi", "10.1056/NEJMoa1810865"), ("indeterminado", False),
        ("nota", "PFS mediana do braço pembrolizumabe+QT (KEYNOTE-407, abstract PMID 30280635); inclui indução 4 ciclos + manutenção"), ("selo", "estimativa")])
    prop, _tr = _reg_exp.propor(r407); assert prop["tipo"] == "ate_progressao", prop
    comp = compor_composicao(r407); comp["fonte"] = "esquema"; comp["selo"] = "estimativa"; r407["composicao"] = comp
    assert selo_por_eixos(r407) == "re_derivado"
    regimes.insert(regimes.index(r189) + 1, r407)
    by[ID_407] = r407

    # ---- 4. consequências ----
    hashes_depois = {r["regimen_id"]: content_hash(r) for r in regimes}
    mudaram = {rid for rid, h in hashes_antes.items() if hashes_depois[rid] != h}
    assert mudaram == set(REGRAS), (mudaram ^ set(REGRAS))
    rehash = [OrderedDict([("regimen_id", rid), ("content_hash_antes", hashes_antes[rid]), ("content_hash_depois", hashes_depois[rid])]) for rid in REGRAS]
    aprov_expiradas = []
    for rid in REGRAS:
        for a in aprov_antes.get(rid) or []:
            if a.get("content_hash") == hashes_antes[rid]:
                aprov_expiradas.append(OrderedDict([("regimen_id", rid), ("aprovacao", a), ("hash_novo", hashes_depois[rid])]))
    # órfãos: toda folha das regras e do critério nomeado de pulmao-nsclc existe no vocabulário novo
    def folhas(node, out):
        if isinstance(node, dict):
            for k, v in node.items():
                if k in ("eq", "ne", "in", "gt", "gte", "lt", "lte"): out.add(v[0])
                else: folhas(v, out)
        elif isinstance(node, list):
            for x in node: folhas(x, out)
    usados = set()
    for r in regimes:
        if r["tumor"] != TUMOR: continue
        folhas(r["elegibilidade"]["regra"], usados)
        for c in r["elegibilidade"].get("criterios") or []: folhas(c["expr"], usados)
    assert usados <= set(vocab_depois), usados - set(vocab_depois)
    assert not (usados & set(APOSENTADOS))
    nunca_usados = sorted(set(vocab_depois) - usados)

    placar = Counter(r["consolidacao"]["selo_confianca"] for r in regimes)
    por_tumor = []
    for t in sorted({r["tumor"] for r in regimes}, key=lambda t: [x["tumor"] for x in regimes].index(t)):
        rs = [r for r in regimes if r["tumor"] == t]
        por_tumor.append(OrderedDict([("tumor", t), ("regimes", len(rs)), ("selo", dict(Counter(r["consolidacao"]["selo_confianca"] for r in rs)))]))
    meta_ant = data["meta"]
    rh_ant = meta_ant.pop("revisao_humana", None)
    lotes_ant = meta_ant.pop("revisao_humana_lotes_anteriores", [])
    if rh_ant: lotes_ant.append(rh_ant)
    meta = OrderedDict()
    meta["titulo"] = "Protocolos de Oncologia 2025 — consolidado + ajuste dos drivers de pulmão (EGFR/ALK/ROS1/histologia, decisão do revisor 16/09/2026) (re-run 2026-07-22, 25 tumores)"
    meta["gerado_em"] = HOJE
    meta["total_tumores"] = len(por_tumor)
    meta["total_regimes"] = len(regimes)
    meta["distribuicao_selo"] = dict(placar)
    meta["por_tumor"] = por_tumor
    meta["politica"] = meta_ant.get("politica")
    meta["substitui"] = ORIGEM_RUN
    meta["publicacao"] = "NÃO publicado: RUN_ATIVO intocado; aguarda Portão A neste run, Portão B em DEV (app + semaforo.ts com 'indeterminado') e comando humano. Publicação em produção sequenciada DEPOIS do deploy da importação (nunca dois deploys juntos)."
    meta["revisao_humana"] = OrderedDict([
        ("lote", LOTE), ("status", "aplicada"), ("data", HOJE), ("decidido_por", REVISOR),
        ("origem", "decisão clínica do revisor via WhatsApp (16/09/2026), transmitida por Gustavo Couto; Fase B aprovada integralmente em 16/09/2026; pareceres da Fase A a registrar em produção com a mesma origem"),
        ("decisao", JUSTIFICATIVA),
        ("vocabulario", OrderedDict([("tumor", TUMOR), ("aposentados", APOSENTADOS), ("novos", [c["campo"] for c in NOVOS]), ("criterio_nomeado", CRIT_ID),
                                     ("antes", vocab_antes), ("depois", vocab_depois), ("nunca_usados_em_regra", nunca_usados)])),
        ("elegibilidade_resultado", ELEG),
        ("regimes_novos", [OrderedDict([("regimen_id", ID_407), ("origem_decisao", ID_189), ("selo", r407["consolidacao"]["selo_confianca"]), ("doi", r407["referencia"]["doi"])])]),
        ("referencias_verificadas", [OrderedDict([("doi", k), ("congruente", v["ok"]), ("pmid", v["pmid"]), ("primeiro_autor", v["primeiro_autor"]), ("ano", v["ano"]), ("estudo", v["estudo"]), ("tema", v["tema"]), ("abstract_trecho", v["abstract_trecho"])]) for k, v in VERIFICADAS.items()]),
        ("rehash", rehash),
        ("aprovacoes_expiradas", aprov_expiradas),
        ("pendencias_referendo", [
            "ROS1 nos metastáticos: KEYNOTE-024/189 excluíram EGFR/ALK; ROS1 entra pela decisão (b) 'qualquer driver'",
            "ROS1/ALK nos curativos: CheckMate 816 e KEYNOTE-671 herdam o critério único do tumor (inclui ROS1); PACIFIC ficou inline só com EGFR (fiel ao texto)",
            "KEYNOTE-407: corte pdl1_alto=false herdado do card institucional — o ensaio incluiu qualquer PD-L1",
            "PACIFIC: PD-L1≥1% consta do texto e não da regra (fora deste lote)",
            "mutado_outra em FLAURA/ADAURA: hoje 🔴 (≠ sensibilizante) — decisão clínica do revisor",
            "referência do card mono cita 'EMPOWER-Lung 3' (combinação); mono é o EMPOWER-Lung 1 — candidato a corrigir_referencia, fora deste lote",
        ]),
        ("app_pendencias", ["motor (app evalExpr/missingFields e backend semaforo.ts evalExpr/camposFaltando): token em `indeterminado` da spec → null (🟡)",
                            "rótulos de opção (`rotulos` da spec) nos widgets do simulador, da reavaliação, da importação e nos chips; endpoint /importacao/vocabulario passa `indeterminado` e `rotulos`"]),
    ])
    meta["revisao_humana_lotes_anteriores"] = lotes_ant
    for k, vv in meta_ant.items():
        if k not in meta: meta[k] = vv
    data["meta"] = meta
    data["regimes"] = regimes
    with open(AGG, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)

    # fatia de pulmao-nsclc: regimes IDÊNTICOS ao agregado (check [8]) + vocabulário novo; demais fatias intocadas
    rs = [r for r in regimes if r["tumor"] == TUMOR]
    pt["meta"]["gerado_em"] = HOJE
    pt["meta"]["total_regimes"] = len(rs)
    pt["meta"]["distribuicao_selo"] = dict(Counter(r["consolidacao"]["selo_confianca"] for r in rs))
    pt["meta"]["derivado_de"] = f"{ESTE_RUN} (agregado; ajuste dos drivers de pulmão)"
    pt["meta"]["revisao_humana"] = OrderedDict([("status", "drivers de pulmão aplicados"), ("data", HOJE)])
    pt["campos_primitivos"] = novo_vocab
    pt["regimes"] = rs
    with open(POR_TUMOR, "w", encoding="utf-8") as fh:
        json.dump(pt, fh, ensure_ascii=False, indent=2)

    with open(os.path.join(AQUI, "content-hashes.json"), "w", encoding="utf-8") as fh:
        json.dump({"gerado_em": HOJE, "run": ESTE_RUN, "hashes": hashes_depois}, fh, ensure_ascii=False, indent=0)

    relatorio = OrderedDict([
        ("total_regimes", len(regimes)), ("placar_selo", dict(placar)),
        ("vocabulario", meta["revisao_humana"]["vocabulario"]),
        ("elegibilidade_resultado", ELEG), ("regime_novo", meta["revisao_humana"]["regimes_novos"]),
        ("rehash", rehash), ("aprovacoes_expiradas", aprov_expiradas),
        ("selos_que_mudaram", [OrderedDict([("regimen_id", x["regimen_id"]), ("de", x["selo_antes"]), ("para", x["selo_depois"])]) for x in ELEG if x["selo_antes"] != x["selo_depois"]]),
        ("pendencias_referendo", meta["revisao_humana"]["pendencias_referendo"]),
        ("referencias_verificadas", meta["revisao_humana"]["referencias_verificadas"]),
    ])
    with open(os.path.join(AQUI, "relatorio-intake-drivers-pulmao.json"), "w", encoding="utf-8") as fh:
        json.dump(relatorio, fh, ensure_ascii=False, indent=2)
    print(json.dumps(relatorio, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
