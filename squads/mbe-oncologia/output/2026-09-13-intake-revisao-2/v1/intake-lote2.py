#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
INTAKE REVISÃO — LOTE 2 (decisões de 12–13/09/2026, export revisao-decisoes.json deste run).

Roda SOBRE ESTE RUN (2026-09-13-intake-revisao-2/v1), que nasceu como cópia do run ativo
(2026-08-18-intake-revisao/v1). RUN_ATIVO não é tocado: publicar é decisão humana, depois
do portão. O script é idempotente por desenho de auditoria: roda uma vez sobre a cópia
limpa; se precisar refazer, copie o run ativo de novo.

Regras aplicadas (todas do briefing do lote):
  • conservador — indirectness → re_derivado, nunca confirmado; nada inventado; fonte declarada;
  • refutado fica VISÍVEL como não-incorporado com motivo;
  • referência nova/trocada só entra VERIFICADA (Crossref/PubMed: autor+ano+tema — ver
    VERIFICADAS abaixo; a verificação foi feita antes de rodar, com o resultado transcrito);
  • pedido que não fecha em regra computável sem escolher por conta própria NÃO é
    implementado: vira triagem_manual com nota;
  • manter_anotar não muda dado (hash intacto); corrigir_referencia / ajustar_elegibilidade
    re-derivam o eixo e mudam o hash (parecer expira — reportado, não suprimido).
"""
import json, os, sys, copy, importlib.util, random
from collections import Counter, OrderedDict

AQUI = os.path.dirname(os.path.abspath(__file__))
SQUAD = os.path.abspath(os.path.join(AQUI, "..", "..", ".."))
RAIZ = os.path.abspath(os.path.join(SQUAD, "..", ".."))
AGG = os.path.join(AQUI, "regimes-consolidados.json")
EXPORT = os.path.join(AQUI, "revisao-decisoes.json")
HOJE = "2026-09-13"
REVISOR = "Gustavo Drummond Pinho Ribeiro"
ORIGEM_RUN = "2026-08-18-intake-revisao/v1"

# hash: a MESMA função do app (fonte única da regra de expiração de parecer)
spec = importlib.util.spec_from_file_location("bd", os.path.join(RAIZ, "app", "build-data.py"))
bd = importlib.util.module_from_spec(spec); sys.modules["bd"] = bd; spec.loader.exec_module(bd)
content_hash = bd.content_hash
# composição e expectativa de uso: as MESMAS regras mecânicas do corpus (regime novo)
def _carregar(nome, caminho):
    # cada extrator tem irmãos (lexico.py etc.) importados por nome curto: o diretório entra
    # no sys.path só durante o exec, e o módulo é registrado com nome único (evita colisão regras/regras)
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
# Referências verificadas ANTES de rodar (Crossref works/<doi> + PubMed esummary/efetch,
# 2026-09-13). Transcrição do que o registro devolveu — não do que se esperava.
# ---------------------------------------------------------------------------
VERIFICADAS = {
    "10.1097/JU.0000000000000688": dict(
        ok=True, pmid="31821066", primeiro_autor="Steinberg", ano=2020, estudo="Steinberg 2020 (GemDoce multi-institucional)",
        citacao="STEINBERG RL, Thomas LJ, Brooks N, et al. Multi-Institution Evaluation of Sequential Gemcitabine and Docetaxel as Rescue Therapy for Nonmuscle Invasive Bladder Cancer. J Urol. 2020;203(5):902-909.",
        tema="GemDoce intravesical de resgate em NMIBC pós-BCG — coorte retrospectiva multi-institucional, n=276"),
    "10.1016/S1470-2045(12)70379-0": dict(
        ok=True, pmid="22995653", primeiro_autor="Fizazi", ano=2012, estudo="COU-AA-301",
        citacao="FIZAZI K, Scher HI, Molina A, et al. Abiraterone acetate for treatment of metastatic castration-resistant prostate cancer: final overall survival analysis of the COU-AA-301 randomised, double-blind, placebo-controlled phase 3 study. Lancet Oncol. 2012;13(10):983-992.",
        tema="abiraterona + prednisona em mCRPC pós-docetaxel — SG final"),
    "10.1093/annonc/mdu375": dict(
        ok=True, pmid="25114021", primeiro_autor="Tandstad", ano=2014, estudo="SWENOTECA (BEP x1 adjuvante)",
        citacao="TANDSTAD T, Ståhl O, Håkansson U, et al. One course of adjuvant BEP in clinical stage I nonseminoma mature and expanded results from the SWENOTECA group. Ann Oncol. 2014;25(11):2167-2172.",
        tema="um ciclo de BEP adjuvante em não-seminoma EC I — coorte prospectiva populacional, n=517"),
    "10.1200/JCO.2004.06.068": dict(
        ok=True, pmid="14701772", primeiro_autor="Kollmannsberger", ano=2004, estudo="GTCSG GemOx (Kollmannsberger)",
        citacao="KOLLMANNSBERGER C, Beyer J, Liersch R, et al. Combination chemotherapy with gemcitabine plus oxaliplatin in patients with intensively pretreated or refractory germ cell cancer: a study of the German Testicular Cancer Study Group. J Clin Oncol. 2004;22(1):108-114.",
        tema="GemOx em tumor germinativo refratário/intensamente pré-tratado — fase II braço único, n=35"),
    "10.1016/S1470-2045(23)00515-6": dict(
        ok=True, pmid="37875143", primeiro_autor="Rha", ano=2023, estudo="KEYNOTE-859",
        citacao="RHA SY, Oh DY, Yañez P, et al. Pembrolizumab plus chemotherapy versus placebo plus chemotherapy for HER2-negative advanced gastric cancer (KEYNOTE-859): a multicentre, randomised, double-blind, phase 3 trial. Lancet Oncol. 2023;24(11):1181-1195.",
        tema="pembrolizumabe + QT em gástrico/JEG HER2-negativo 1ª linha — fase 3"),
    "10.1016/S0140-6736(25)00684-1": dict(
        ok=True, pmid="40683290", primeiro_autor="Agarwal", ano=2025, estudo="TALAPRO-2 (SG final)",
        citacao="AGARWAL N, Azad AA, Carles J, et al. Talazoparib plus enzalutamide in men with metastatic castration-resistant prostate cancer: final overall survival results from the randomised, placebo-controlled, phase 3 TALAPRO-2 trial. Lancet. 2025;406(10502):447-460.",
        tema="SG final do TALAPRO-2 (coorte não selecionada por HRR)"),
    "10.1016/S0140-6736(25)00403-9": dict(
        ok=True, pmid="40349714", primeiro_autor="Yau", ano=2025, estudo="CheckMate 9DW",
        citacao="YAU T, et al. Nivolumab plus ipilimumab versus lenvatinib or sorafenib as first-line treatment for unresectable hepatocellular carcinoma (CheckMate 9DW): an open-label, randomised, phase 3 trial. Lancet. 2025;405(10492):1851-1864.",
        tema="nivolumabe + ipilimumabe vs lenvatinibe/sorafenibe em HCC irressecável 1ª linha — fase 3"),
    # Resolve, mas NÃO é o paper do regime (2ª linha pós-IO): é análise de sobrevida ajustada por
    # qualidade do CABOSUN (cabozantinibe vs sunitinibe em 1ª LINHA). Resolver ≠ ser o paper certo.
    "10.1002/cncr.33169": dict(
        ok=False, primeiro_autor="Chen", ano=2020, estudo="CABOSUN (Q-TWiST)",
        citacao="CHEN RC, Choueiri TK, Feuilly M, et al. Quality-adjusted survival with first-line cabozantinib or sunitinib for advanced renal cell carcinoma in the CABOSUN randomized clinical trial (Alliance). Cancer. 2020.",
        tema="1ª linha, cabozantinibe vs sunitinibe — NÃO cobre 2ª linha pós-imunoterapia"),
}
# Lidas dos abstracts (PubMed efetch) — números usados nas re-derivações abaixo.
ABSTRACT = {
    "COU-AA-301": "n=1.195 mCRPC em progressão pós-docetaxel, 2:1 abiraterona+prednisona vs placebo+prednisona; SG mediana 15,8 vs 11,2 meses, HR 0,74 (IC95% 0,64–0,86; p<0,0001); rPFS 5,6 vs 3,6 meses (HR 0,66); tempo a progressão de PSA HR 0,63.",
    "Steinberg2020": "n=276 NMIBC recidivado com história de BCG (seleção: qualquer BCG prévio, não só BCG-unresponsive), mediana 22,9 meses de seguimento; SLR 1 e 2 anos 60% e 46%; SLR de alto grau 65% e 52%; progressão em RTU 3,6%; cistectomia 15,6% (4,0% com progressão a músculo-invasivo).",
    "Tandstad2014": "n=517 não-seminoma EC I tratados com 1 ciclo de BEP em protocolo prospectivo populacional (SWENOTECA); seguimento mediano 7,9 anos; 12 recaídas (todas IGCCCG bom prognóstico); recaída em 5 anos 3,2% com ILV e 1,6% sem ILV; sobrevida câncer-específica 5 anos 100%.",
    "Kollmannsberger2004": "n=35, gemcitabina 1.000 mg/m² D1,D8 + oxaliplatina 130 mg/m² D1; mediana de 6 ciclos prévios de platina; 89% pós-quimioterapia de alta dose; 63% cisplatina-refratários; TRO 46% (IC95% 30–64%), 3 RC; toxicidade grau 3 sobretudo mielossupressão (54%).",
    "KEYNOTE-859": "n=1.579 gástrico/JEG HER2-negativo 1ª linha; SG ITT 12,9 vs 11,5 meses (HR 0,78; 0,70–0,87); CPS≥1 13,0 vs 11,4 (HR 0,74); CPS≥10 15,7 vs 11,8 meses (HR 0,65; 0,53–0,79).",
    "TALAPRO-2-OS": "coorte não selecionada (n=805), seguimento mediano 52,5 meses: SG HR 0,80 (IC95% 0,66–0,96; p=0,016), mediana 45,8 vs 37,0 meses; HRR-deficientes (n=169) HR 0,55 (0,36–0,83; p=0,0035); HRR não-deficiente/desconhecido HR 0,88 (0,71–1,08).",
}

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def carregar():
    return json.load(open(AGG, encoding="utf-8"))

def hist(r, origem, nota, eixos=None, fonte=None, bump=True):
    if bump:
        r["versao"] = int(r.get("versao") or 1) + 1
    r.setdefault("historico_versoes", []).append(OrderedDict([
        ("versao", r["versao"]), ("data", HOJE), ("origem", origem), ("mudanca", nota),
        ("eixos_afetados", eixos or []), ("fonte", fonte), ("decidido_por", REVISOR)]))
    r["atualizado_em"] = HOJE

def anotar(r, dec, decisao_revisao, nota_squad=None):
    """Nota do revisor no card + registro estruturado (lote, data, natureza, eixo)."""
    c = r["consolidacao"]
    c["decisao_revisao"] = decisao_revisao
    c["nota_revisao"] = dec["justificativa"]
    c.setdefault("notas_revisao", []).append(OrderedDict([
        ("lote", 2), ("data", dec["data"]), ("revisor", dec["revisor"]), ("acao", dec["acao"]),
        ("natureza", dec.get("natureza")), ("eixo", dec.get("eixo")), ("nota", dec["justificativa"]),
        ("nota_squad", nota_squad)]))
    r["revisado_por"] = dec["revisor"]; r["revisado_em"] = dec["data"]

def set_flag(r, texto, remover_prefixo=None):
    for lst in (r["consolidacao"].setdefault("flags", []), r.setdefault("flags", [])):
        if remover_prefixo:
            lst[:] = [f for f in lst if not str(f).startswith(remover_prefixo)]
        if texto and texto not in lst:
            lst.append(texto)

def trocar_referencia(r, doi, papel_nota):
    v = VERIFICADAS[doi]; assert v["ok"], doi
    r["referencia_anterior"] = copy.deepcopy(r["referencia"])
    r["referencia"] = OrderedDict([
        ("citacao", v["citacao"]), ("doi", doi), ("pmid", v["pmid"]), ("estudo", v["estudo"]),
        ("ano", v["ano"]), ("primeiro_autor", v["primeiro_autor"]),
        ("verificacao", OrderedDict([("registro", "Crossref + PubMed"), ("data", HOJE),
                                     ("congruente", True), ("tema", v["tema"])])),
        ("nota_troca", papel_nota)])
    set_flag(r, None, remover_prefixo="doi_incongruente")
    set_flag(r, None, remover_prefixo="doi_nao_reparado")
    set_flag(r, None, remover_prefixo="sem_estudo_pivo")

def selo_por_eixos(r, forcar=None):
    """Regra do Step 07, conservadora: diverge > lacuna/indeterminado(incompleto) > re_derivado.
    'confirmado' nunca é atribuído pelo intake (regime re-derivado aguarda re-revisão)."""
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

def crit(campo, op, valor):
    return OrderedDict([("campo", campo), ("operador", op), ("valor", valor)])

def eixo_elegibilidade(r, status, inclusao, exclusao, amplitude, divergencia, justificativa, fonte):
    e = r["verificacao"]["elegibilidade"]
    e.update(OrderedDict([("status", status), ("criterios_inclusao", inclusao), ("criterios_exclusao", exclusao),
                          ("amplitude", amplitude), ("divergencia_vs_protocolo", divergencia),
                          ("justificativa", justificativa), ("fonte", fonte),
                          ("rederivado_em", HOJE), ("rederivado_por", "intake-lote2:verificador-elegibilidade")]))

def add_primitivo(vocab, tumor, campo, tipo, label, secao, **extra):
    """Cria o primitivo no vocabulário do tumor se não existir. Devolve True se criou."""
    lst = vocab[tumor]
    if any(c["campo"] == campo for c in lst):
        return False
    d = OrderedDict([("campo", campo), ("tipo", tipo), ("label", label), ("secao", secao)])
    d.update(extra)
    lst.append(d)
    PRIMITIVOS_NOVOS.append(OrderedDict([("campo", campo), ("tumor", tumor), ("tipo", tipo), ("label", label),
                                         ("secao", secao), ("opcoes", extra.get("opcoes")),
                                         ("ordinal", extra.get("ordinal")), ("motivo", extra.get("_motivo"))]))
    d.pop("_motivo", None)
    return True

PRIMITIVOS_NOVOS = []
RESULTADO = []          # placar por decisão
ELEG_RESULTADO = []     # antes/depois das regras (amostra sorteada sai daqui)
RE_REVISAO = []         # pendências abertas para o revisor
TRIAGEM = []            # triagem_manual

def registrar(dec, status, nota=None, **kw):
    d = OrderedDict([("regimen_id", dec["regimen_id"]), ("acao", dec["acao"]), ("status", status), ("nota", nota)])
    d.update(kw); RESULTADO.append(d)

# ---------------------------------------------------------------------------
def main():
    data = carregar()
    regimes = data["regimes"]
    by = {r["regimen_id"]: r for r in regimes}
    dec_all = json.load(open(EXPORT, encoding="utf-8"))["decisoes"]
    lote2 = [d for d in dec_all if d["data"] >= "2026-09-12"]
    assert len(lote2) == 97, len(lote2)
    D = {d["regimen_id"]: d for d in lote2 if d["decisao"] != "aprovado"}
    assert len(D) == 27, len(D)
    hashes_antes = {r["regimen_id"]: content_hash(r) for r in regimes}
    for rid, d in D.items():
        assert hashes_antes[rid] == d["content_hash"] == d["hash_atual"], rid  # parecer vale para a versão copiada

    # vocabulário por tumor (fatias por tumor deste run) — editado aqui e regravado no fim
    vocab = {}
    for t in sorted(os.listdir(AQUI)):
        f = os.path.join(AQUI, t, "v1", "regimes-consolidados.json")
        if os.path.isfile(f):
            vocab[t] = json.load(open(f, encoding="utf-8")).get("campos_primitivos") or []

    # =========================== 1. APROVADOS (70): só registro ===========================
    aprovados = [d for d in lote2 if d["decisao"] == "aprovado"]
    for d in aprovados:
        r = by[d["regimen_id"]]
        r["consolidacao"].setdefault("aprovacoes", []).append(OrderedDict([("lote", 2), ("data", d["data"]), ("revisor", d["revisor"]), ("content_hash", d["content_hash"])]))
        # aprovado no hash atual e sem outra decisão pendente → decisão de revisão = aprovado
        if r["consolidacao"].get("decisao_revisao") in ("auto_confirmado_pendente_publicacao", "sem_divergencia_nao_requer_decisao", "pendente_oncologista_referencia"):
            r["consolidacao"]["decisao_revisao"] = "aprovado_revisao_clinica"
        r["revisado_por"] = d["revisor"]; r["revisado_em"] = d["data"]

    # =========================== 2. CORRIGIR_REFERENCIA (5) ===========================
    # 2a. GemDoce — Steinberg 2020 J Urol (verificado)
    d = D["bexiga-nmibc-bcg-unresponsive-gem-docetaxel"]; r = by[d["regimen_id"]]
    trocar_referencia(r, "10.1097/JU.0000000000000688",
        "Revisor indicou a coorte multi-institucional (Steinberg 2020, J Urol; n=276) no lugar da série de centro único (Steinberg 2015, Bladder Cancer) que o reparo automático não conseguiu desambiguar (6 candidatos).")
    r["beneficio"] = OrderedDict([("desfecho_principal", "Sobrevida livre de recorrência (resgate intravesical pós-BCG)"),
        ("magnitude", "Steinberg 2020: SLR 60% em 1 ano e 46% em 2 anos; SLR de alto grau 65%/52%; cistectomia em 15,6% (progressão a músculo-invasivo em 4,0%)"),
        ("fonte", "10.1097/JU.0000000000000688")])
    r["verificacao"]["grade"].update(status="re_derivado", valor_rederivado="2C",
        justificativa="Steinberg 2020 (J Urol; PMID 31821066): coorte RETROSPECTIVA multi-institucional, n=276, NMIBC recidivado com história de BCG, sem braço controle. " + ABSTRACT["Steinberg2020"] + " Qualidade baixa (observacional), recomendação condicional → 2C. Continua sem RCT; o próprio estudo pede validação prospectiva.",
        fonte="https://doi.org/10.1097/JU.0000000000000688")
    r["verificacao"]["esmo_mcbs"].update(status="indeterminado", valor_rederivado="n/a",
        justificativa="Coorte retrospectiva sem comparador; ESMO-MCBS não graduável (não é 'sem fonte' — é desenho não graduável).",
        fonte="https://doi.org/10.1097/JU.0000000000000688")
    eixo_elegibilidade(r, "re_derivado",
        [crit("invasao_muscular", "=", False), crit("bcg_unresponsive", "=", True), crit("recusa_ou_inelegivel_cistectomia", "=", True)], [],
        "mais_estreito",
        "Steinberg 2020 incluiu NMIBC recidivado com QUALQUER história de BCG (não só BCG-unresponsive pela definição FDA) e não exigiu recusa/inelegibilidade a cistectomia. A regra do protocolo é mais estreita que a população do estudo — direção segura.",
        "Re-derivado da população de Steinberg 2020; regra inalterada (a decisão era de referência, não de elegibilidade).",
        "https://doi.org/10.1097/JU.0000000000000688")
    r["consolidacao"]["lacunas"] = [l for l in r["consolidacao"]["lacunas"] if l != "grade_sem_estudo_pivo"]
    set_flag(r, "evidencia_retrospectiva: base é coorte retrospectiva multi-institucional (Steinberg 2020), não RCT", remover_prefixo="evidencia_retrospectiva")
    set_flag(r, "posicionamento_diretriz (revisor): NCCN 'outra recomendada' (não preferida) em NMIBC BCG-unresponsive; AUA/SUO reconhece como resgate estabelecido — citado pelo revisor, não verificado pelo squad")
    anotar(r, d, "rederivado_aguarda_revisao")
    selo = selo_por_eixos(r)
    hist(r, "intake-lote2:corrigir_referencia", "Referência trocada para Steinberg 2020 (J Urol) por decisão do revisor; GRADE/ESMO/elegibilidade re-derivados da fonte nova; referencia_anterior preservada.", ["grade", "esmo_mcbs", "elegibilidade"], "10.1097/JU.0000000000000688")
    registrar(d, "executado", f"referência trocada (verificada); selo incompleto→{selo}")

    # 2b. Abiraterona — PACOTE: COU-AA-301 (verificado) + elegibilidade 'todo mCRPC'
    d = D["prostata-mcrpc-1l-abiraterona-prednisona"]; r = by[d["regimen_id"]]
    ref302 = copy.deepcopy(r["referencia"])
    trocar_referencia(r, "10.1016/S1470-2045(12)70379-0",
        "Revisor: COU-AA-301 (pós-docetaxel) incluiu doença visceral (32% vs 25%) com benefício de SG consistente em subgrupos; troca vem JUNTO da ampliação da elegibilidade a todo mCRPC. COU-AA-302 (cenário pré-quimioterapia do card) fica como pivô secundário em referencia.pivos.")
    r["referencia"]["pivos"] = [
        OrderedDict([("papel", "principal (decisão do revisor)"), ("estudo", "COU-AA-301"), ("doi", "10.1016/S1470-2045(12)70379-0"), ("ano", 2012), ("primeiro_autor", "Fizazi"), ("populacao", "mCRPC pós-docetaxel, com doença visceral admitida")]),
        OrderedDict([("papel", "secundário (cenário pré-quimioterapia do card)"), ("estudo", "COU-AA-302"), ("doi", ref302["doi"]), ("ano", ref302["ano"]), ("primeiro_autor", "Ryan"), ("populacao", "mCRPC quimio-naive, assintomático/pouco sintomático, sem doença visceral")]),
    ]
    r["referencia"]["citacao"] += " + RYAN CJ et al. COU-AA-302 final overall survival. Lancet Oncol. 2015;16(2):152-160 (pivô secundário, cenário quimio-naive)."
    r["beneficio"] = OrderedDict([("desfecho_principal", "↑ sobrevida global (COU-AA-301 pós-docetaxel; COU-AA-302 quimio-naive)"),
        ("magnitude", "COU-AA-301: SG 15,8 vs 11,2 meses, HR 0,74 (0,64–0,86). COU-AA-302: SG 34,7 vs 30,3 meses, HR 0,81."),
        ("fonte", "10.1016/S1470-2045(12)70379-0")])
    r["verificacao"]["grade"].update(status="re_derivado", valor_rederivado="1B",
        justificativa="COU-AA-301 (Fizazi 2012; PMID 22995653): fase 3, " + ABSTRACT["COU-AA-301"] + " Em conjunto com COU-AA-302 (quimio-naive), dois RCTs de SG sustentam recomendação FORTE para mCRPC. A QUALIDADE é rebaixada um nível por indirecionalidade de população: o card é 1ª linha (quimio-naive) e a regra passa a admitir sintomáticos e/ou com doença visceral nesse cenário — subgrupo que nenhum dos dois ensaios estudou diretamente (301 é pós-docetaxel; 302 excluiu visceral). 1B, não 1A.",
        fonte="https://doi.org/10.1016/S1470-2045(12)70379-0")
    r["verificacao"]["esmo_mcbs"].update(status="re_derivado", valor_rederivado="4",
        justificativa="COU-AA-301: ganho de SG de 4,6 meses (HR 0,74) em doença metastática → ESMO-MCBS 4 (mesmo grau derivado antes de COU-AA-302).",
        fonte="https://doi.org/10.1016/S1470-2045(12)70379-0")
    antes = json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)
    r["elegibilidade"]["regra"] = {"and": [{"eq": ["metastatico", True]}, {"eq": ["resistente_castracao", True]}]}
    eixo_elegibilidade(r, "re_derivado",
        [crit("metastatico", "=", True), crit("resistente_castracao", "=", True)], [],
        "mais_amplo",
        "Regra do revisor: todo mCRPC ('incluir para todos no cenário de resistência à castração'). Cobertura pelos pivôs: pós-docetaxel (COU-AA-301, visceral admitida) e quimio-naive assintomático sem visceral (COU-AA-302). Fica FORA de ambos o quimio-naive sintomático e/ou com doença visceral — extensão clínica do revisor, sinalizada como mais_amplo (direção insegura), não como divergência: a decisão é explícita e fundamentada.",
        "Re-derivado de COU-AA-301 + COU-AA-302 após a spec do revisor.",
        "https://doi.org/10.1016/S1470-2045(12)70379-0")
    set_flag(r, "elegibilidade:mais_amplo (quimio-naive sintomático/visceral não estudado em 301 nem 302 — extensão do revisor)")
    r["consolidacao"]["spec_revisor_resultado"] = "aplicada"
    anotar(r, d, "rederivado_aguarda_revisao")
    selo = selo_por_eixos(r, forcar="re_derivado")
    ELEG_RESULTADO.append(OrderedDict([("id", r["regimen_id"]), ("mudou", True), ("antes", antes), ("depois", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("texto_revisor", d["acao_detalhe"]), ("novosPrim", [])]))
    hist(r, "intake-lote2:corrigir_referencia+ajustar_elegibilidade", "Pacote: referência principal → COU-AA-301 (302 vira pivô secundário); regra ampliada a todo mCRPC por decisão do revisor; GRADE/ESMO/elegibilidade re-derivados; selo divergencia→re_derivado.", ["grade", "esmo_mcbs", "elegibilidade"], "10.1016/S1470-2045(12)70379-0")
    registrar(d, "executado", f"pacote ref+elegibilidade; selo divergencia→{selo}")

    # 2c. Cabozantinibe pós-IO — DOI resolve para paper ERRADO → triagem_manual
    d = D["renal-met-2l-pos-io-cabozantinibe"]; r = by[d["regimen_id"]]
    v = VERIFICADAS["10.1002/cncr.33169"]
    nota = ("NÃO aplicado. O DOI indicado (10.1002/cncr.33169) resolve no Crossref para " + v["citacao"] +
            " — análise de sobrevida ajustada por qualidade do CABOSUN (1ª linha, cabozantinibe vs sunitinibe). Não é fonte para cabozantinibe em 2ª linha pós-imunoterapia, que é o card. Referência atual (METEOR, pós-TKI) mantida. Pede-se ao revisor o DOI/PMID da fonte pretendida (ex.: série de cabozantinibe pós-ICI).")
    r["consolidacao"]["decisao_revisao"] = "triagem_manual"
    r["consolidacao"]["spec_revisor_nao_computavel"] = nota
    anotar(r, d, "triagem_manual", nota_squad=nota)
    hist(r, "intake-lote2:corrigir_referencia", "Troca de referência NÃO executada: DOI indicado resolve para CABOSUN Q-TWiST (1ª linha), incongruente com o card (2ª linha pós-IO). Triagem manual.", [], None, bump=False)
    TRIAGEM.append(OrderedDict([("regimen_id", r["regimen_id"]), ("acao", d["acao"]), ("motivo", nota)]))
    registrar(d, "triagem_manual", "DOI resolve mas é o paper errado (CABOSUN 1L, Q-TWiST)")

    # 2d. BEP x1 — Tandstad 2014 (SWENOTECA), verificado
    d = D["testiculo-nsgct-eI-bep1"]; r = by[d["regimen_id"]]
    trocar_referencia(r, "10.1093/annonc/mdu375", "Revisor: pivô correto para BEP x1 é SWENOTECA (Tandstad 2014), em vez de Cullen 1996 (BEP x2) — resolve a indirecionalidade de esquema sinalizada antes.")
    r["beneficio"] = OrderedDict([("desfecho_principal", "↓ recaída em EC I não-seminoma com 1 ciclo de BEP adjuvante"),
        ("magnitude", "SWENOTECA (Tandstad 2014): recaída em 5 anos 3,2% com ILV e 1,6% sem ILV; sobrevida câncer-específica 100% em 5 anos (n=517, seguimento mediano 7,9 anos)"),
        ("fonte", "10.1093/annonc/mdu375")])
    r["verificacao"]["grade"].update(status="re_derivado", valor_rederivado="1B",
        justificativa="Tandstad 2014 (Ann Oncol; PMID 25114021): " + ABSTRACT["Tandstad2014"] + " Desenho prospectivo populacional, NÃO randomizado (sem braço de vigilância comparável para ILV+): qualidade moderada; magnitude e consistência sustentam recomendação forte → 1B. O esquema do pivô (BEP x1) agora corresponde ao do regime.",
        fonte="https://doi.org/10.1093/annonc/mdu375")
    r["verificacao"]["esmo_mcbs"].update(status="re_derivado", valor_rederivado="A (curativo)",
        justificativa="Adjuvância curativa em EC I de alto risco (ILV) com recaída ~3% e SCE 100%; formulário curativo qualitativo. Protocolo não afirmou MCBS.",
        fonte="https://doi.org/10.1093/annonc/mdu375")
    eixo_elegibilidade(r, "re_derivado",
        [crit("histologia", "=", "nao_seminoma"), crit("estadio_clinico", "=", "I"), crit("invasao_linfovascular", "=", True)],
        [crit("estadio_clinico", "!=", "I")], None,
        "Concorda: SWENOTECA recomendou 1 ciclo de BEP a EC I não-seminoma COM ILV (a regra); sem ILV era opção do paciente (fora da regra — direção segura).",
        "Re-derivado da população de Tandstad 2014; regra inalterada.",
        "https://doi.org/10.1093/annonc/mdu375")
    set_flag(r, None, remover_prefixo="indirectness_regime")
    anotar(r, d, "rederivado_aguarda_revisao")
    selo = selo_por_eixos(r)
    hist(r, "intake-lote2:corrigir_referencia", "Referência trocada Cullen 1996 → Tandstad 2014 (SWENOTECA, BEP x1) por decisão do revisor; eixos re-derivados; flag de indirecionalidade de esquema removida; referencia_anterior preservada.", ["grade", "esmo_mcbs", "elegibilidade"], "10.1093/annonc/mdu375")
    registrar(d, "executado", f"referência trocada (verificada); selo {selo}")

    # 2e. GemOx — Kollmannsberger 2004, verificado
    d = D["testiculo-refrataria-paliativo-gemox"]; r = by[d["regimen_id"]]
    trocar_referencia(r, "10.1200/JCO.2004.06.068", "Revisor forneceu a fonte primária do GemOx em doença refratária (GTCSG, Kollmannsberger 2004). Cobre o GemOx; o braço alternativo do card (gemcitabina+paclitaxel) segue sem fonte própria.")
    r["beneficio"] = OrderedDict([("desfecho_principal", "Taxa de resposta em tumor germinativo refratário/intensamente pré-tratado"),
        ("magnitude", "Kollmannsberger 2004: TRO 46% (IC95% 30–64%), 3 RC em 35 pacientes (89% pós-quimioterapia de alta dose)"),
        ("fonte", "10.1200/JCO.2004.06.068")])
    r["verificacao"]["grade"].update(status="re_derivado", valor_rederivado="2C",
        justificativa="Kollmannsberger 2004 (JCO; PMID 14701772): fase II braço único, " + ABSTRACT["Kollmannsberger2004"] + " Desfecho de resposta, sem comparador → qualidade baixa, recomendação condicional (2C). Revisor: GemOx/Gem+Pacli são 3ª linha ou além, tipicamente após falha de HDCT — coerente com a população do estudo.",
        fonte="https://doi.org/10.1200/JCO.2004.06.068")
    r["verificacao"]["esmo_mcbs"].update(status="indeterminado", valor_rederivado="n/a",
        justificativa="Fase II braço único com desfecho de resposta; ESMO-MCBS não graduável.", fonte="https://doi.org/10.1200/JCO.2004.06.068")
    eixo_elegibilidade(r, "re_derivado",
        [crit("cenario", "=", "metastatico"), crit("linha_tratamento", "=", "refrataria")], [], None,
        "Concorda: população do estudo = tumor germinativo recidivado/refratário intensamente pré-tratado (mediana 6 ciclos de platina; 89% pós-HDCT) — corresponde a linha_tratamento=refrataria.",
        "Re-derivado da população de Kollmannsberger 2004; regra inalterada.",
        "https://doi.org/10.1200/JCO.2004.06.068")
    r["consolidacao"]["lacunas"] = [l for l in r["consolidacao"]["lacunas"] if l not in ("grade", "elegibilidade")]
    set_flag(r, None, remover_prefixo="incompleto_evidencia")
    set_flag(r, "referencia_cobre_parte_do_card: fonte verificada cobre GemOx; gemcitabina+paclitaxel (alternativa do mesmo card) segue sem fonte primária")
    set_flag(r, "linha_terapia (revisor): 3ª linha ou além — após falha de cisplatina e, na maioria, após HDCT com resgate de células-tronco")
    anotar(r, d, "rederivado_aguarda_revisao")
    selo = selo_por_eixos(r)
    hist(r, "intake-lote2:corrigir_referencia", "Referência (antes ausente) → Kollmannsberger 2004 (GemOx, GTCSG) por decisão do revisor; GRADE/ESMO/elegibilidade re-derivados; selo incompleto→re_derivado.", ["grade", "esmo_mcbs", "elegibilidade"], "10.1200/JCO.2004.06.068")
    registrar(d, "executado", f"referência criada (verificada); selo incompleto→{selo}")

    # =========================== 3. AJUSTAR_ELEGIBILIDADE (9) ===========================
    # 3a. IO isolada em urotelial (pembro CPS≥10 / atezo PD-L1≥5%)
    d = D["bexiga-met-1l-io-isolada-cisplatina-inelegivel"]; r = by[d["regimen_id"]]
    novos = []
    if add_primitivo(vocab, "bexiga", "pdl1_cps", "integer", "PD-L1 CPS (combined positive score)", "Biomarcadores",
                     _motivo="pembrolizumabe em urotelial inelegível a cisplatina exige CPS ≥10 (spec do revisor); numérico — mesmo nome/tipo já usado em esofago-estomago"): novos.append("pdl1_cps")
    if add_primitivo(vocab, "bexiga", "pdl1_expressao_pct", "number", "Expressão de PD-L1 (%) — atezolizumabe: ≥5%", "Biomarcadores",
                     _motivo="atezolizumabe exige 'expressão tumoral de PD-L1 5%' (spec do revisor). O revisor não especificou compartimento/ensaio (IC vs TC; SP142) — rótulo neutro; conferir"): novos.append("pdl1_expressao_pct")
    antes = json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)
    r["elegibilidade"]["criterios"] = [
        OrderedDict([("id", "pdl1_pembrolizumabe"), ("label", "PD-L1 CPS ≥10 (pembrolizumabe)"), ("expr", {"gte": ["pdl1_cps", 10]})]),
        OrderedDict([("id", "pdl1_atezolizumabe"), ("label", "Expressão de PD-L1 ≥5% (atezolizumabe)"), ("expr", {"gte": ["pdl1_expressao_pct", 5]})]),
    ]
    r["elegibilidade"]["regra"] = {"and": [
        {"eq": ["metastatico", True]},
        {"eq": ["elegivel_cisplatina", False]},
        {"or": [{"ref": "pdl1_pembrolizumabe"}, {"ref": "pdl1_atezolizumabe"}]},
        {"not": {"eq": ["doenca_autoimune_ativa", True]}},
    ]}
    eixo_elegibilidade(r, "re_derivado",
        [crit("metastatico", "=", True), crit("elegivel_cisplatina", "=", False), crit("pdl1_cps", ">=", 10), crit("pdl1_expressao_pct", ">=", 5)],
        [crit("doenca_autoimune_ativa", "=", True)], "mais_estreito",
        "Regra do revisor: inelegível a CISPLATINA (antes: 'inelegível a platina') + biomarcador numérico por fármaco (pembrolizumabe CPS ≥10; atezolizumabe PD-L1 ≥5%), no lugar do booleano pdl1_positivo. Confronto: KEYNOTE-052 (Balar 2017, fase 2 braço único, cisplatina-inelegíveis) — o corte CPS ≥10 é o subgrupo de maior resposta do próprio estudo; é mais estreito que a população total (direção segura). A inelegibilidade a enfortumabe vedotina citada na justificativa do revisor NÃO está na spec computável e não virou regra (ressalva).",
        "Re-derivado da spec do revisor, confrontada com KEYNOTE-052 (fase 2). Referência do card segue sem DOI verificado — lacuna anterior, fora deste lote.",
        "https://doi.org/10.1016/S1470-2045(17)30616-2")
    r["consolidacao"]["spec_revisor_resultado"] = "aplicada"
    anotar(r, d, "rederivado_aguarda_revisao")
    selo = selo_por_eixos(r)
    ELEG_RESULTADO.append(OrderedDict([("id", r["regimen_id"]), ("mudou", True), ("antes", antes), ("depois", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("texto_revisor", d["acao_detalhe"]), ("novosPrim", novos)]))
    hist(r, "intake-lote2:ajustar_elegibilidade", "Regra re-derivada da spec do revisor (cisplatina-inelegível + CPS≥10 pembro / PD-L1≥5% atezo); primitivos novos: " + ", ".join(novos), ["elegibilidade"], None)
    registrar(d, "executado", f"regra nova; primitivos {novos}; selo {selo}")

    # 3b. Erdafitinibe — FGFR2/3 + IO prévia
    d = D["bexiga-met-erdafitinibe-fgfr"]; r = by[d["regimen_id"]]
    for c in vocab["bexiga"]:
        if c["campo"] == "alteracao_fgfr":
            c["label"] = "Alteração de FGFR2/FGFR3 (mutação ou fusão)"
    antes = json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)
    r["elegibilidade"]["regra"] = {"and": [
        {"eq": ["metastatico", True]}, {"eq": ["alteracao_fgfr", True]},
        {"eq": ["progressao_pos_platina", True]}, {"eq": ["io_previa", True]},
    ]}
    eixo_elegibilidade(r, "re_derivado",
        [crit("metastatico", "=", True), crit("alteracao_fgfr", "=", True), crit("progressao_pos_platina", "=", True), crit("io_previa", "=", True)], [],
        "mais_estreito",
        "Revisor: restrito a FGFR2/FGFR3 que JÁ receberam anti-PD-1/PD-L1 (bula: não recomendado a elegíveis a IO ainda não tratados). Critério adicionado com o primitivo existente io_previa; o critério anterior de progressão pós-platina foi MANTIDO (o revisor não pediu para removê-lo — ressalva). Confronto: BLC2001 (Loriot 2019, fase 2) admitiu pacientes com ou sem IO prévia — a regra é mais estreita que o estudo (direção segura); o requisito de IO prévia vem da bula, não do BLC2001.",
        "Re-derivado da spec do revisor sobre BLC2001. Referência do card segue sem DOI verificado — lacuna anterior, fora deste lote.",
        "https://doi.org/10.1056/NEJMoa1817323")
    r["consolidacao"]["spec_revisor_resultado"] = "aplicada"
    anotar(r, d, "rederivado_aguarda_revisao")
    selo = selo_por_eixos(r)
    ELEG_RESULTADO.append(OrderedDict([("id", r["regimen_id"]), ("mudou", True), ("antes", antes), ("depois", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("texto_revisor", d["acao_detalhe"]), ("novosPrim", [])]))
    hist(r, "intake-lote2:ajustar_elegibilidade", "Regra re-derivada: acrescido io_previa=true (spec do revisor); rótulo do primitivo alteracao_fgfr explicitado (FGFR2/FGFR3).", ["elegibilidade"], None)
    registrar(d, "executado", f"regra nova (io_previa); selo {selo}")

    # 3c. Nivolumabe adjuvante MIBC — CheckMate 274 em dois ramos
    d = D["bexiga-mibc-adj-nivolumabe"]; r = by[d["regimen_id"]]
    novos = []
    PT_BEX = ["pT0", "pTa", "pTis", "pT1", "pT2", "pT2a", "pT2b", "pT3", "pT3a", "pT3b", "pT4", "pT4a", "pT4b"]
    ORD_BEX = {"pT0": 0, "pTa": 0.1, "pTis": 0.2, "pT1": 1, "pT2": 2, "pT2a": 2.1, "pT2b": 2.2, "pT3": 3, "pT3a": 3.1, "pT3b": 3.2, "pT4": 4, "pT4a": 4.1, "pT4b": 4.2}
    if add_primitivo(vocab, "bexiga", "estadio_pt", "enum", "Estádio T patológico (pT; ypT se houve neoadjuvância)", "Estadiamento patológico",
                     opcoes=PT_BEX, ordinal=ORD_BEX, estadiamento="pT",
                     _motivo="CheckMate 274 (spec do revisor) exige pT3–pT4a sem neoadjuvância ou ypT2–ypT4a com neoadjuvância; comparação ordinal pelo mapa canônico (mesmo padrão do estadio_t de próstata)"): novos.append("estadio_pt")
    if add_primitivo(vocab, "bexiga", "pn_positivo", "boolean", "Linfonodo patológico positivo (pN+ / ypN+)", "Estadiamento patológico",
                     _motivo="spec do revisor: 'pN+' / 'ypN+'"): novos.append("pn_positivo")
    if add_primitivo(vocab, "bexiga", "neoadjuvancia_previa", "boolean", "Quimioterapia neoadjuvante à base de cisplatina realizada", "Contexto",
                     _motivo="spec do revisor distingue os dois ramos por neoadjuvância prévia"): novos.append("neoadjuvancia_previa")
    antes = json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)
    r["elegibilidade"]["criterios"] = [
        OrderedDict([("id", "alto_risco_sem_neoadjuvancia"), ("label", "Sem neoadjuvância: pT3–pT4a ou pN+, inelegível a cisplatina adjuvante"),
                     ("expr", {"and": [{"eq": ["neoadjuvancia_previa", False]}, {"eq": ["elegivel_cisplatina", False]},
                                       {"or": [{"and": [{"gte": ["estadio_pt", "pT3"]}, {"lte": ["estadio_pt", "pT4a"]}]}, {"eq": ["pn_positivo", True]}]}]})]),
        OrderedDict([("id", "alto_risco_pos_neoadjuvancia"), ("label", "Com neoadjuvância (cisplatina, sem IO): ypT2–ypT4a ou ypN+"),
                     ("expr", {"and": [{"eq": ["neoadjuvancia_previa", True]}, {"eq": ["io_previa", False]},
                                       {"or": [{"and": [{"gte": ["estadio_pt", "pT2"]}, {"lte": ["estadio_pt", "pT4a"]}]}, {"eq": ["pn_positivo", True]}]}]})]),
    ]
    r["elegibilidade"]["regra"] = {"and": [
        {"eq": ["invasao_muscular", True]},
        {"or": [{"ref": "alto_risco_sem_neoadjuvancia"}, {"ref": "alto_risco_pos_neoadjuvancia"}]},
        {"not": {"eq": ["doenca_autoimune_ativa", True]}},
    ]}
    eixo_elegibilidade(r, "re_derivado",
        [crit("invasao_muscular", "=", True), crit("estadio_pt", "∈", "pT3–pT4a (sem neoadj.) | pT2–pT4a (pós-neoadj.)"), crit("pn_positivo", "=", True), crit("elegivel_cisplatina", "=", False), crit("neoadjuvancia_previa", "=", "define o ramo"), crit("io_previa", "=", False)],
        [crit("doenca_autoimune_ativa", "=", True)], None,
        "Concorda com CheckMate 274 (Bajorin 2021): elegibilidade do ensaio = pT3–pT4a ou pN+ sem neoadjuvância (inelegível/recusa a cisplatina adjuvante) OU ypT2–ypT4a ou ypN+ após neoadjuvância com cisplatina. A spec computável do revisor cita só 'não elegibilidade' (a justificativa também cita 'recusa') — regra segue a spec; recusa fica como ressalva. 'Sem imunoterapia' virou io_previa=false no ramo pós-neoadjuvância. Bexiga, ureter e pelve renal admitidos (regra não restringe sítio).",
        "Re-derivado da spec do revisor, que reproduz os critérios do CheckMate 274.",
        "https://doi.org/10.1056/NEJMoa2034442")
    r["consolidacao"]["spec_revisor_resultado"] = "aplicada"
    anotar(r, d, "rederivado_aguarda_revisao")
    selo = selo_por_eixos(r, forcar="re_derivado")
    ELEG_RESULTADO.append(OrderedDict([("id", r["regimen_id"]), ("mudou", True), ("antes", antes), ("depois", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("texto_revisor", d["acao_detalhe"]), ("novosPrim", novos)]))
    hist(r, "intake-lote2:ajustar_elegibilidade", "Regra re-derivada em dois ramos (CheckMate 274) a partir da spec do revisor; primitivos novos: " + ", ".join(novos) + "; selo confirmado→re_derivado (política conservadora: regra reescrita aguarda re-revisão).", ["elegibilidade"], None)
    registrar(d, "executado", f"regra nova (2 ramos); primitivos {novos}; selo confirmado→{selo}")

    # 3d. Gástrico IO+QT — CPS ≥5 nivo / ≥10 pembro + KEYNOTE-859 como pivô adicional
    d = D["gastrico-met-1l-io-qt-cps"]; r = by[d["regimen_id"]]
    v = VERIFICADAS["10.1016/S1470-2045(23)00515-6"]
    antes = json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)
    r["elegibilidade"]["criterios"] = [
        OrderedDict([("id", "cps_nivolumabe"), ("label", "PD-L1 CPS ≥5 (nivolumabe + QT — CheckMate 649)"), ("expr", {"gte": ["pdl1_cps", 5]})]),
        OrderedDict([("id", "cps_pembrolizumabe"), ("label", "PD-L1 CPS ≥10 (pembrolizumabe + QT — KEYNOTE-859)"), ("expr", {"gte": ["pdl1_cps", 10]})]),
    ]
    r["elegibilidade"]["regra"] = {"and": [{"eq": ["metastatico", True]}, {"or": [{"ref": "cps_nivolumabe"}, {"ref": "cps_pembrolizumabe"}]}]}
    r["referencia"]["pivos"] = [
        OrderedDict([("papel", "principal"), ("estudo", "CheckMate 649"), ("doi", r["referencia"]["doi"]), ("ano", 2021), ("primeiro_autor", "Janjigian"), ("populacao", "nivolumabe + QT; desfecho primário em CPS ≥5")]),
        OrderedDict([("papel", "adicional (acrescido pelo revisor, verificado)"), ("estudo", "KEYNOTE-859"), ("doi", "10.1016/S1470-2045(23)00515-6"), ("pmid", v["pmid"]), ("ano", 2023), ("primeiro_autor", "Rha"), ("populacao", "pembrolizumabe + QT, HER2-negativo; maior ganho em CPS ≥10 (HR 0,65)")]),
    ]
    r["referencia"]["citacao"] += " + " + v["citacao"]
    r["referencia"]["primeiro_autor"] = "Janjigian"
    r["beneficio"]["magnitude"] += ". KEYNOTE-859 (pembrolizumabe): SG ITT HR 0,78; CPS≥10 15,7 vs 11,8 meses, HR 0,65"
    r["verificacao"]["grade"]["justificativa"] += " KEYNOTE-859 (Rha 2023, fase 3; PMID 37875143) sustenta o braço pembrolizumabe: " + ABSTRACT["KEYNOTE-859"]
    eixo_elegibilidade(r, "re_derivado",
        [crit("metastatico", "=", True), crit("pdl1_cps", ">=", "5 (nivolumabe) | 10 (pembrolizumabe)")], [], "mais_amplo",
        "Revisor: PD-L1 obrigatório com cortes por fármaco — CPS ≥5 para nivolumabe (desfecho primário do CheckMate 649) e CPS ≥10 para pembrolizumabe (subgrupo de maior ganho no KEYNOTE-859). Frente ao PROTOCOLO (incorporar só CPS ≥10; 5–10 em tumor board) a regra é mais ampla no ramo nivolumabe (CPS 5–9 passa a elegível); frente aos pivôs, é concordante (não é extrapolação).",
        "Re-derivado da spec do revisor sobre CheckMate 649 + KEYNOTE-859 (este verificado no Crossref/PubMed e acrescido em referencia.pivos).",
        "https://doi.org/10.1016/S0140-6736(21)00797-2")
    set_flag(r, "elegibilidade:mais_amplo_que_protocolo (CPS 5–9 com nivolumabe — protocolo mandava tumor board; decisão do revisor)")
    r["consolidacao"]["spec_revisor_resultado"] = "aplicada"
    anotar(r, d, "rederivado_aguarda_revisao")
    selo = selo_por_eixos(r)
    ELEG_RESULTADO.append(OrderedDict([("id", r["regimen_id"]), ("mudou", True), ("antes", antes), ("depois", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("texto_revisor", d["acao_detalhe"]), ("novosPrim", [])]))
    hist(r, "intake-lote2:ajustar_elegibilidade", "Regra re-derivada (CPS ≥5 nivolumabe | ≥10 pembrolizumabe); KEYNOTE-859 acrescido como pivô adicional verificado.", ["elegibilidade", "grade"], "10.1016/S1470-2045(23)00515-6")
    registrar(d, "executado", f"regra nova (2 cortes); pivô adicional; selo {selo}")

    # 3e. Gástrico HER2+ — CPS ≥1 já era exigido pela regra
    d = D["gastrico-met-her2-pembro-tras-qt"]; r = by[d["regimen_id"]]
    assert {"gte": ["pdl1_cps", 1]} in r["elegibilidade"]["regra"]["and"]
    r["consolidacao"]["spec_revisor_resultado"] = "ja_satisfeita"
    anotar(r, d, "aprovado_com_ressalva_regra_ja_computavel", nota_squad="Regra já exigia pdl1_cps ≥ 1 (KEYNOTE-811); nenhuma mudança de dado — hash intacto.")
    hist(r, "intake-lote2:ajustar_elegibilidade", "Pedido do revisor (CPS ≥1 obrigatório) já estava na regra computável; registrado sem mudança de dado.", [], None, bump=False)
    ELEG_RESULTADO.append(OrderedDict([("id", r["regimen_id"]), ("mudou", False), ("antes", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("depois", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("texto_revisor", d["acao_detalhe"]), ("novosPrim", [])]))
    registrar(d, "executado_sem_mudanca", "regra já exigia CPS ≥1")

    # 3f. Pênis TIP adjuvante — pN pélvico / ENE / pN2–N3
    d = D["penis-adj-tip"]; r = by[d["regimen_id"]]
    novos = []
    if add_primitivo(vocab, "penis", "linfonodo_pelvico_positivo", "boolean", "Envolvimento linfonodal pélvico (pós-linfadenectomia)", "Estadiamento patológico",
                     _motivo="spec do revisor: 'envolvimento linfonodal pélvico'"): novos.append("linfonodo_pelvico_positivo")
    if add_primitivo(vocab, "penis", "extensao_extranodal", "boolean", "Extensão extranodal (ENE)", "Estadiamento patológico",
                     _motivo="spec do revisor: 'extensão extranodal (ENE)'"): novos.append("extensao_extranodal")
    if add_primitivo(vocab, "penis", "estadio_pn", "enum", "Estádio N patológico (pN) — pós-linfadenectomia", "Estadiamento patológico",
                     opcoes=["pN0", "pN1", "pN2", "pN3"], ordinal={"pN0": 0, "pN1": 1, "pN2": 2, "pN3": 3}, estadiamento="pN",
                     _motivo="spec do revisor: 'doença inguinal bilateral/volumosa (pN2–N3)'; comparação ordinal pelo mapa canônico"): novos.append("estadio_pn")
    antes = json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)
    r["elegibilidade"]["criterios"] = [
        OrderedDict([("id", "alto_risco_linfonodal_penis"), ("label", "Linfonodo pélvico, ENE ou pN2–pN3"),
                     ("expr", {"or": [{"eq": ["linfonodo_pelvico_positivo", True]}, {"eq": ["extensao_extranodal", True]}, {"gte": ["estadio_pn", "pN2"]}]})]),
    ]
    r["elegibilidade"]["regra"] = {"and": [{"eq": ["tumor", "penis_escamoso"]}, {"ref": "alto_risco_linfonodal_penis"}]}
    eixo_elegibilidade(r, "re_derivado",
        [crit("tumor", "=", "penis_escamoso"), crit("linfonodo_pelvico_positivo", "=", True), crit("extensao_extranodal", "=", True), crit("estadio_pn", ">=", "pN2")], [], None,
        "Regra do revisor substitui o booleano composto alto_risco_pos_cirurgia por três critérios explícitos (pN pélvico, ENE, pN2–N3). O protocolo listava ainda '≥4 linfonodos' e 'margens acometidas' — não estão na spec do revisor e saíram da regra (ressalva: se o revisor quiser mantê-los, é pedido novo). Sem RCT para confronto (evidência retrospectiva, resultados conflitantes QT vs RT adjuvante — nota do revisor).",
        "Re-derivado da spec do revisor; fonte de elegibilidade = diretriz ESMO-EURACAN (sem pivô primário).",
        "https://doi.org/10.1016/j.esmoop.2024.103481")
    r["consolidacao"]["spec_revisor_resultado"] = "aplicada"
    anotar(r, d, "rederivado_aguarda_revisao")
    selo = selo_por_eixos(r)
    ELEG_RESULTADO.append(OrderedDict([("id", r["regimen_id"]), ("mudou", True), ("antes", antes), ("depois", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("texto_revisor", d["acao_detalhe"]), ("novosPrim", novos)]))
    hist(r, "intake-lote2:ajustar_elegibilidade", "Regra re-derivada (pN pélvico | ENE | pN2–N3) a partir da spec do revisor; primitivos novos: " + ", ".join(novos), ["elegibilidade"], None)
    registrar(d, "executado", f"regra nova; primitivos {novos}; selo {selo}")

    # 3g. Cabazitaxel não incorporado — texto não fecha em regra computável → triagem_manual
    d = D["prostata-mcrpc-2l-cabazitaxel-nao-incorporado"]; r = by[d["regimen_id"]]
    nota = ("NÃO aplicado como ajustar_elegibilidade: o texto do revisor é 'manter não incorporar, trocar a justificativa' (comparador ARSI vs Lu-PSMA-617; CARD/TheraP; PSMA-PET, disponibilidade e contraindicação à radioligante) — não há regra {campo, operador, valor} derivável sem o squad escolher primitivos (PSMA-PET, disponibilidade de Lu-PSMA) por conta própria. "
            "Balde proposto: refutar (mantém não-incorporado, substitui a justificativa pela do revisor). Executar só após o humano confirmar o balde — refutar muda o corpo publicado e nunca é deduzido de texto livre.")
    r["consolidacao"]["decisao_revisao"] = "triagem_manual"
    r["consolidacao"]["spec_revisor_nao_computavel"] = nota
    anotar(r, d, "triagem_manual", nota_squad=nota)
    hist(r, "intake-lote2:ajustar_elegibilidade", "Spec não computável; balde proposto = refutar (troca de justificativa). Triagem manual — nada mudou no dado.", [], None, bump=False)
    TRIAGEM.append(OrderedDict([("regimen_id", r["regimen_id"]), ("acao", d["acao"]), ("balde_proposto", "refutar"), ("motivo", nota)]))
    registrar(d, "triagem_manual", "sem regra computável; balde proposto refutar (troca de justificativa)")

    # 3h. Zoledrônico — regra já restringe a resistente à castração + metástase óssea
    d = D["prostata-mcrpc-terapia-ossea-zoledronico"]; r = by[d["regimen_id"]]
    regra = r["elegibilidade"]["regra"]["and"]
    assert {"eq": ["resistente_castracao", True]} in regra and {"eq": ["metastase_ossea", True]} in regra
    r["consolidacao"]["spec_revisor_resultado"] = "ja_satisfeita"
    anotar(r, d, "aprovado_com_ressalva_regra_ja_computavel", nota_squad="Regra já exigia resistente_castracao=true + metastase_ossea=true (mHSPC já excluído); STAMPEDE/CALGB 90202 citados pelo revisor ficam como contexto (não entram como referência — não foram verificados nem pedidos como fonte). Hash intacto.")
    set_flag(r, "contexto_revisor: sem benefício em mHSPC (STAMPEDE; CALGB 90202 negativo para ERE e SG) — uso restrito ao cenário resistente à castração")
    hist(r, "intake-lote2:ajustar_elegibilidade", "Pedido do revisor (só mCRPC com metástase óssea) já estava na regra; registrado sem mudança de regra.", [], None, bump=False)
    ELEG_RESULTADO.append(OrderedDict([("id", r["regimen_id"]), ("mudou", False), ("antes", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("depois", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("texto_revisor", d["acao_detalhe"]), ("novosPrim", [])]))
    registrar(d, "executado_sem_mudanca", "regra já restringia a mCRPC ósseo")

    # 3i. Renal pembrolizumabe adjuvante — KEYNOTE-564 explícito
    d = D["renal-adj-pembrolizumab"]; r = by[d["regimen_id"]]
    novos = []
    PT_REN = ["pT1", "pT1a", "pT1b", "pT2", "pT2a", "pT2b", "pT3", "pT3a", "pT3b", "pT3c", "pT4"]
    ORD_REN = {"pT1": 1, "pT1a": 1.1, "pT1b": 1.2, "pT2": 2, "pT2a": 2.1, "pT2b": 2.2, "pT3": 3, "pT3a": 3.1, "pT3b": 3.2, "pT3c": 3.3, "pT4": 4}
    if add_primitivo(vocab, "renal", "estadio_pt", "enum", "Estádio T patológico (pT) da nefrectomia", "Estadiamento patológico",
                     opcoes=PT_REN, ordinal=ORD_REN, estadiamento="pT",
                     _motivo="KEYNOTE-564 (spec do revisor): pT2 grau 4/sarcomatoide, pT3, pT4; comparação ordinal pelo mapa canônico"): novos.append("estadio_pt")
    if add_primitivo(vocab, "renal", "pn_positivo", "boolean", "Linfonodo patológico positivo (pN+)", "Estadiamento patológico",
                     _motivo="spec do revisor: 'qualquer pT e grau, com linfonodos positivos (N+)'"): novos.append("pn_positivo")
    if add_primitivo(vocab, "renal", "grau_nuclear", "integer", "Grau nuclear (WHO/ISUP) 1–4", "Patologia", opcoes=[1, 2, 3, 4],
                     _motivo="spec do revisor: 'pT2 com grau nuclear 4'"): novos.append("grau_nuclear")
    if add_primitivo(vocab, "renal", "diferenciacao_sarcomatoide", "boolean", "Diferenciação sarcomatoide", "Patologia",
                     _motivo="spec do revisor: 'ou diferenciação sarcomatoide'"): novos.append("diferenciacao_sarcomatoide")
    if add_primitivo(vocab, "renal", "m1_ressecado", "boolean", "M1 ao diagnóstico com metástases completamente ressecadas (síncrono ou ≤1 ano da nefrectomia), sem evidência de doença", "Contexto",
                     _motivo="spec do revisor: '3) M1 ressecado'"): novos.append("m1_ressecado")
    antes = json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)
    r["elegibilidade"]["criterios"] = [
        OrderedDict([("id", "kn564_intermediario_alto"), ("label", "Risco intermediário-alto: pT2 G4/sarcomatoide N0 M0, ou pT3 qualquer grau N0 M0"),
                     ("expr", {"and": [{"eq": ["metastatico", False]}, {"eq": ["pn_positivo", False]},
                                       {"or": [{"and": [{"gte": ["estadio_pt", "pT2"]}, {"lt": ["estadio_pt", "pT3"]}, {"or": [{"gte": ["grau_nuclear", 4]}, {"eq": ["diferenciacao_sarcomatoide", True]}]}]},
                                               {"and": [{"gte": ["estadio_pt", "pT3"]}, {"lt": ["estadio_pt", "pT4"]}]}]}]})]),
        OrderedDict([("id", "kn564_alto"), ("label", "Risco alto: pT4 N0 M0, ou qualquer pT com N+ M0"),
                     ("expr", {"and": [{"eq": ["metastatico", False]}, {"or": [{"gte": ["estadio_pt", "pT4"]}, {"eq": ["pn_positivo", True]}]}]})]),
        OrderedDict([("id", "kn564_m1_ressecado"), ("label", "M1 ressecado (NED)"), ("expr", {"eq": ["m1_ressecado", True]})]),
    ]
    r["elegibilidade"]["regra"] = {"and": [
        {"eq": ["histologia_ccrcc", True]}, {"eq": ["ressecado_completo", True]},
        {"or": [{"ref": "kn564_intermediario_alto"}, {"ref": "kn564_alto"}, {"ref": "kn564_m1_ressecado"}]},
        {"not": {"eq": ["doenca_autoimune_ativa", True]}},
    ]}
    eixo_elegibilidade(r, "re_derivado",
        [crit("histologia_ccrcc", "=", True), crit("ressecado_completo", "=", True),
         crit("estadio_pt", "∈", "pT2 (grau 4 ou sarcomatoide) | pT3 | pT4"), crit("pn_positivo", "=", True), crit("m1_ressecado", "=", True), crit("metastatico", "=", False)],
        [crit("doenca_autoimune_ativa", "=", True)], None,
        "Concorda com KEYNOTE-564 (Powles 2022): os três grupos da spec do revisor são exatamente os estratos de elegibilidade do ensaio (intermediário-alto, alto, M1 NED). O booleano composto alto_risco_recidiva foi substituído por critérios explícitos. 'pT2' casa pT2/pT2a/pT2b; 'pT3' casa pT3/pT3a/b/c (mapa ordinal).",
        "Re-derivado da spec do revisor, que reproduz os critérios do KEYNOTE-564.",
        "https://doi.org/10.1016/S1470-2045(22)00487-9")
    r["consolidacao"]["spec_revisor_resultado"] = "aplicada"
    anotar(r, d, "rederivado_aguarda_revisao")
    selo = selo_por_eixos(r, forcar="re_derivado")
    ELEG_RESULTADO.append(OrderedDict([("id", r["regimen_id"]), ("mudou", True), ("antes", antes), ("depois", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("texto_revisor", d["acao_detalhe"]), ("novosPrim", novos)]))
    hist(r, "intake-lote2:ajustar_elegibilidade", "Regra re-derivada em três ramos (KEYNOTE-564) a partir da spec do revisor; primitivos novos: " + ", ".join(novos) + "; selo confirmado→re_derivado (política conservadora).", ["elegibilidade"], None)
    registrar(d, "executado", f"regra nova (3 ramos); primitivos {novos}; selo confirmado→{selo}")

    # =========================== 4. REFUTAR (1) — PARP próstata ===========================
    d = D["prostata-mcrpc-1l-parp-nao-incorporado"]; r = by[d["regimen_id"]]
    v = VERIFICADAS["10.1016/S0140-6736(25)00684-1"]
    nota_verif = ("VERIFICAÇÃO DO SQUAD (não altera a decisão do revisor): a SG final do TALAPRO-2 já foi publicada — " + v["citacao"] +
                  " (PMID 40683290; Crossref 200). Resultado: " + ABSTRACT["TALAPRO-2-OS"] +
                  " Os números da justificativa do revisor (SG 3 anos 78% vs 72%; HR 0,77, IC 0,56–1,04; 'não significativo, dados imaturos') NÃO correspondem a esta publicação final — parecem vir de uma análise interina anterior. A não-incorporação é decisão do revisor e fica; a justificativa numérica precisa de re-revisão à luz da SG final.")
    r["incorporacao"] = OrderedDict([
        ("status", "nao_incorporado"), ("motivo", "refutado"),
        ("nota_revisao", d["justificativa"]), ("revisor", d["revisor"]), ("data", d["data"]),
        ("citacao_verificada", OrderedDict([("estudo", "TALAPRO-2 (SG final)"), ("doi", "10.1016/S0140-6736(25)00684-1"), ("pmid", v["pmid"]), ("citacao", v["citacao"]), ("verificado_em", HOJE)])),
        ("nota_verificacao_squad", nota_verif),
    ])
    for lst in (r["consolidacao"]["flags"], r["flags"]):
        lst[:] = [f for f in lst if not str(f).startswith("nao_incorporado")]
        lst.insert(0, "nao_incorporado")
    set_flag(r, "evidencia_atualizada: TALAPRO-2 SG final (Agarwal 2025, Lancet) positiva — HR 0,80; HRR-deficientes HR 0,55 — diverge da justificativa do revisor; candidato a re-revisão/vigilância")
    r["consolidacao"]["decisao_revisao"] = "refutado_revisao_clinica"
    anotar(r, d, "refutado_revisao_clinica", nota_squad=nota_verif)
    r["consolidacao"]["nota_revisao"] = d["justificativa"]
    RE_REVISAO.append(OrderedDict([("regimen_id", r["regimen_id"]), ("item", "talapro2_sg_final_vs_justificativa"),
        ("descricao", "Justificativa do revisor (SG não significativa/imatura) diverge da SG final publicada do TALAPRO-2 (2025: HR 0,80; HRR-def HR 0,55). Confirmar se a não-incorporação se mantém e com qual justificativa."),
        ("status", "aberto"), ("data", HOJE)]))
    hist(r, "intake-lote2:refutar", "Não-incorporação confirmada pelo revisor (bloco incorporacao explícito); justificativa substituída pela do revisor (TALAPRO-2) com citação verificada; nota de verificação do squad registra que a SG final de 2025 diverge dos números do revisor. Eixos NÃO reprocessados (refutar não reprocessa).", [], "10.1016/S0140-6736(25)00684-1", bump=True)
    registrar(d, "executado_com_ressalva", "não-incorporado + justificativa do revisor; SG final TALAPRO-2 (2025) diverge — re_revisao aberta")

    # =========================== 5. MANTER_ANOTAR (10) ===========================
    def manter(rid, nota_squad=None, flag=None):
        d = D[rid]; r = by[rid]
        anotar(r, d, "revisado_com_ressalva", nota_squad=nota_squad)
        if flag:
            set_flag(r, flag)
        hist(r, "intake-lote2:manter_anotar", "Nota do revisor incorporada ao card (revisado com ressalva); dado, selo e eixos inalterados — hash intacto.", [], None, bump=False)
        registrar(d, "executado", "nota incorporada; hash intacto")
    manter("bexiga-met-1l-enfortumab-pembrolizumabe", flag="nota_revisor: discutir custo frente à manutenção com avelumabe (sem comparação direta entre as estratégias); EV+P é 1ª linha de escolha em la/mUC independente de elegibilidade a cisplatina")
    manter("bexiga-met-1l-gc-nivolumabe", flag="nota_revisor: discutir custo frente à manutenção com avelumabe")
    manter("bexiga-mibc-tmt-5fu-mitomicina", flag="nota_revisor: magnitude/benefício não comparáveis à cistectomia (padrão) — TMT é para quem recusa/não é candidato a cistectomia")
    manter("bexiga-mibc-tmt-cisplatina", flag="nota_revisor: magnitude/benefício não comparáveis à cistectomia (padrão) — TMT é para quem recusa/não é candidato a cistectomia")
    # HCC: CheckMate 9DW verificado → entra como referência complementar (não troca pivô, não muda eixos)
    v = VERIFICADAS["10.1016/S0140-6736(25)00403-9"]
    r = by["hcc-1l-tremelimumabe-durvalumabe"]
    r["consolidacao"].setdefault("referencias_complementares", []).append(OrderedDict([
        ("estudo", "CheckMate 9DW"), ("doi", "10.1016/S0140-6736(25)00403-9"), ("pmid", v["pmid"]), ("citacao", v["citacao"]),
        ("papel", "opção alternativa ao STRIDE citada pelo revisor (nivolumabe + ipilimumabe vs lenvatinibe/sorafenibe, 1ª linha); verificada em Crossref/PubMed; NÃO substitui o pivô HIMALAYA nem altera os eixos"), ("verificado_em", HOJE)]))
    manter("hcc-1l-tremelimumabe-durvalumabe",
           nota_squad="CheckMate 9DW verificado (Yau 2025, Lancet 405:1851-64) e anexado em consolidacao.referencias_complementares; pivô e eixos inalterados.",
           flag="nota_revisor: alta toxicidade financeira — avaliar só com excelente performance e contraindicação a atezolizumabe+bevacizumabe; CheckMate 9DW (nivo+ipi, verificado) como opção ao STRIDE")
    manter("renal-met-favoravel-ipilimumabe-nivolumabe",
           nota_squad="Evidência EMERGENTE citada de memória pelo revisor (metanálise ASCO 2026: ICI sem ganho de SG sobre sunitinibe no risco favorável, HR 0,82; dupla ICI com PFS inferior, HR 1,76) — NÃO verificada pelo squad e NÃO substitui o pivô (CheckMate 214); selo e eixos inalterados. Registrada como nota de evidência emergente para a vigilância.",
           flag="evidencia_emergente (revisor, não verificada): metanálise ASCO 2026 — sem ganho de SG de ICI sobre sunitinibe no risco favorável; considerar custo e nivolumabe monoterapia em 2ª linha pós-TKI")
    manter("renal-met-intalto-nivolumabe-cabozantinibe",
           flag="nota_revisor: ESMO-MCBS 4; escolha frente a ipi+nivo (int/alto) e axitinibe+pembro pondera custo, carga tumoral/necessidade de resposta rápida, risco IMDC, componente sarcomatoide e comorbidades")
    NOTA_TEST = ("Nomenclatura (revisor): 'metastático' não é o termo do estadiamento de testículo — usa-se TNM com categoria S (marcadores séricos), estádios I–III. "
                 "O valor 'metastatico' que aparece no card é o eixo `cenario` da app (taxonomia transversal de agrupamento: adjuvância / localmente avançado / metastático), não o estadiamento; o estadiamento do card está em `estadio_clinico` (I/II/III) e `risco_igcccg`. "
                 "Renomear o rótulo do cenário para testículo é mudança de APP (rótulo do enum), fora deste intake de dados — pendência aberta em re_revisao. Regra e hash intactos; check [5] (estadiamento ordinal) conferido: as regras de testículo usam igualdade em estadio_clinico, sem comparação ordinal crua.")
    for rid in ("testiculo-avancado-baixorisco-bep3-ep4", "testiculo-avancado-intalto-bep4-vip4", "testiculo-recidiva-tip-veip"):
        manter(rid, nota_squad=NOTA_TEST, flag="nomenclatura (revisor): estadiamento de testículo é TNM/S (estádios I–III), não 'localizado vs metastático' — 'metastatico' no card é o cenário da app, não o estádio")
    RE_REVISAO.append(OrderedDict([("regimen_id", "testiculo-*"), ("item", "rotulo_cenario_testiculo"),
        ("descricao", "Os 3 cards de testículo (bep3-ep4, bep4-vip4, tip-veip) pedem que a tela não exiba 'metastático' como estadiamento: é o rótulo do enum `cenario` da app. Ajuste de rótulo (ex.: 'doença avançada — estádio II–III (TNM/S)') é mudança de app, com portão B; dado inalterado."),
        ("status", "aberto"), ("data", HOJE)]))

    # =========================== 6. OUTRO (2) ===========================
    # 6a. biliares 5-FU — título/enquadramento
    d = D["biliares-1l-5fu"]; r = by[d["regimen_id"]]
    r["subtipo_anterior"] = r["subtipo"]
    r["subtipo"] = "Câncer de vias biliares avançado — 1ª linha (monoterapia com fluoropirimidina)"
    r["nome"] = "5-Fluorouracil + Leucovorina (fluoropirimidina em monoterapia)"
    anotar(r, d, "revisado_com_ressalva", nota_squad="Título/enquadramento corrigidos conforme o revisor: 5-FU+LV É a fluoropirimidina (não 'alternativa à fluoropirimidina'). nome/subtipo não entram no hash — parecer intacto. Esquema, eixos e regra inalterados.")
    set_flag(r, "enquadramento (revisor): monoterapia com fluoropirimidina para PS limitado, comorbidades que contraindiquem oxaliplatina/irinotecano ou intolerância a combinações; evidência de séries retrospectivas")
    hist(r, "intake-lote2:outro", "Título e subtipo reenquadrados (fluoropirimidina em monoterapia) por decisão do revisor; nota incorporada; dado de evidência inalterado.", [], None, bump=True)
    registrar(d, "executado", "título/subtipo corrigidos; hash intacto")

    # 6b. Pênis — REGIME NOVO 1ª linha paclitaxel + carboplatina (+ nota no card de 2ª linha)
    d = D["penis-met-2l-paclitaxel"]; r2l = by[d["regimen_id"]]
    anotar(r2l, d, "revisado_com_ressalva", nota_squad="Revisor: paclitaxel SEMANAL em monoterapia na 2ª linha. Esquema do card não traz dose/cadência (o protocolo não as escreve) — nada foi inventado; regra e hash intactos. Pedido de 1ª linha atendido com regime NOVO: penis-met-1l-paclitaxel-carboplatina.")
    set_flag(r2l, "nota_revisor: em 2ª linha, paclitaxel semanal (monoterapia)")
    hist(r2l, "intake-lote2:outro", "Nota do revisor incorporada (paclitaxel semanal em 2ª linha); regime novo de 1ª linha criado à parte.", [], None, bump=False)
    registrar(d, "executado", "nota no card 2L + regime novo criado (penis-met-1l-paclitaxel-carboplatina)")

    novo = OrderedDict()
    novo["regimen_id"] = "penis-met-1l-paclitaxel-carboplatina"
    novo["tumor"] = "penis"; novo["cenario"] = "metastatico"
    novo["subtipo"] = "Doença metastática — 1ª linha (opção acrescida pelo revisor)"
    novo["nome"] = "Paclitaxel + Carboplatina — 1ª linha"
    novo["esquema"] = "Paclitaxel + Carboplatina (doses e periodicidade não especificadas pelo revisor nem pelo protocolo)"
    novo["farmacos"] = [OrderedDict([("nome", "Paclitaxel"), ("dose", None), ("via", "EV"), ("frequencia", None)]),
                        OrderedDict([("nome", "Carboplatina"), ("dose", None), ("via", "EV"), ("frequencia", None)])]
    novo["elegibilidade_protocolo"] = "Não consta do protocolo institucional. Acrescido por decisão do revisor (lote 2, 2026-09-13): 'Paclitaxel + carboplatina como opção de primeira linha para câncer de pênis metastático'."
    novo["elegibilidade"] = OrderedDict([("criterios", []), ("regra", {"and": [
        {"eq": ["tumor", "penis_escamoso"]}, {"eq": ["metastatico", True]}, {"eq": ["segunda_linha", False]}]})])
    novo["referencia"] = OrderedDict([
        ("citacao", "MUNEER A et al. Penile cancer: ESMO–EURACAN Clinical Practice Guideline for diagnosis, treatment and follow-up. ESMO Open. 2024;9(7):103481. (Diretriz; a base primária de paclitaxel+carboplatina em pênis metastático é retrospectiva/relato de caso — PubMed 2026-09-13: Joerger 2004 (Urology, relato de caso); Noronha 2012 (Urol Ann, adjuvante); nenhuma série prospectiva de 1ª linha recuperada.)"),
        ("doi", "10.1016/j.esmoop.2024.103481"), ("pmid", None), ("estudo", "ESMO-EURACAN (Muneer) — sem pivô primário"), ("ano", 2024), ("primeiro_autor", "Muneer"),
        ("verificacao", OrderedDict([("registro", "Crossref"), ("data", HOJE), ("congruente", True), ("tema", "diretriz ESMO-EURACAN de câncer de pênis — mesma referência já verificada nos demais cards de pênis")]))])
    novo["afirmado_protocolo"] = OrderedDict([("grade", None), ("esmo_mcbs", None), ("nccn_affordability", None)])
    novo["beneficio"] = None
    novo["toxicidades"] = [
        OrderedDict([("nome", "Mielossupressão"), ("severidade", "grave"), ("conduta", "monitorar hemograma; G-CSF se indicado"), ("fonte", "Bula/ficha técnica: Carboplatina/Paclitaxel")]),
        OrderedDict([("nome", "Neuropatia periférica"), ("severidade", "moderada"), ("conduta", "ajuste de dose"), ("fonte", "Bula/ficha técnica: Paclitaxel")]),
        OrderedDict([("nome", "Reação de hipersensibilidade"), ("severidade", "moderada"), ("conduta", "pré-medicação"), ("fonte", "Bula/ficha técnica: Paclitaxel/Carboplatina")]),
    ]
    novo["verificacao"] = OrderedDict([
        ("grade", OrderedDict([("status", "indeterminado"), ("valor_rederivado", ""), ("afirmado_protocolo", None),
            ("justificativa", "Sem estudo-pivô: a evidência de paclitaxel+carboplatina em câncer de pênis metastático é retrospectiva/relato de caso; a diretriz ESMO-EURACAN é recuperável mas não sustenta GRADE derivável. Lacuna real (tumor raro) — mesmo padrão dos demais cards de pênis."),
            ("fonte", "https://doi.org/10.1016/j.esmoop.2024.103481")])),
        ("esmo_mcbs", OrderedDict([("status", "indeterminado"), ("valor_rederivado", "n/a"), ("afirmado_protocolo", None),
            ("justificativa", "Sem RCT com desfecho graduável; ESMO-MCBS não graduável."), ("fonte", "")])),
        ("nccn_affordability", OrderedDict([("status", "estimativa"), ("valor_rederivado", 1), ("afirmado_protocolo", None),
            ("justificativa", "Paclitaxel e carboplatina genéricos, disponíveis no SUS. Affordability alta — porém eixo de evidência incompleto."), ("fonte", "estimativa qualitativa")])),
        ("elegibilidade", OrderedDict([("status", "re_derivado"),
            ("criterios_inclusao", [crit("tumor", "=", "penis_escamoso"), crit("metastatico", "=", True), crit("segunda_linha", "=", False)]),
            ("criterios_exclusao", []), ("amplitude", None),
            ("divergencia_vs_protocolo", "Regime não consta do protocolo. Regra derivada literalmente do pedido do revisor (1ª linha em pênis metastático), sem restrição adicional. Ressalva: a diretriz ESMO-EURACAN posiciona combinações com carboplatina para pacientes NÃO candidatos a cisplatina — o revisor não pediu essa restrição e ela não foi imposta; conferir."),
            ("justificativa", "Derivado do texto do revisor; sem RCT para confronto (tumor raro)."),
            ("fonte", "https://doi.org/10.1016/j.esmoop.2024.103481"), ("rederivado_em", HOJE), ("rederivado_por", "intake-lote2:verificador-elegibilidade")])),
    ])
    novo["consolidacao"] = OrderedDict([
        ("status", "incompleto"), ("selo_confianca", "incompleto"), ("eixos_diverge", []), ("lacunas", ["grade_sem_estudo_pivo"]),
        ("flags", ["regime_acrescido_pelo_revisor: não consta do protocolo institucional (lote 2, 2026-09-13)",
                   "evidencia_retrospectiva: paclitaxel+carboplatina em pênis metastático sem série prospectiva de 1ª linha recuperada (PubMed 2026-09-13)",
                   "esquema_sem_dose: revisor e protocolo não especificam dose/periodicidade — composição e expectativa de uso indeterminadas de propósito",
                   "elegibilidade:conferir — diretriz posiciona carboplatina para não candidatos a cisplatina; regra segue o pedido do revisor sem essa restrição"]),
        ("decisao_revisao", "rederivado_aguarda_revisao"),
        ("nota_revisao", d["justificativa"]),
        ("notas_revisao", [OrderedDict([("lote", 2), ("data", d["data"]), ("revisor", d["revisor"]), ("acao", "outro"), ("natureza", d.get("natureza")), ("eixo", d.get("eixo")), ("nota", d["justificativa"]),
                                        ("nota_squad", "Regime criado a partir desta decisão (registrada originalmente em penis-met-2l-paclitaxel).")])]),
        ("origem", OrderedDict([("decisao_em", "penis-met-2l-paclitaxel"), ("lote", 2), ("data", d["data"]), ("revisor", d["revisor"])])),
    ])
    novo["versao"] = 1; novo["atualizado_em"] = HOJE; novo["revisado_por"] = d["revisor"]; novo["revisado_em"] = d["data"]
    novo["historico_versoes"] = [OrderedDict([("versao", 1), ("data", HOJE), ("origem", "intake-lote2:outro (regime novo)"),
        ("mudanca", "Criado por decisão do revisor (lote 2): paclitaxel + carboplatina como opção de 1ª linha em câncer de pênis metastático. Quatro eixos derivados com selo honesto (incompleto: sem pivô primário; diretriz verificada)."),
        ("eixos_afetados", ["grade", "esmo_mcbs", "nccn_affordability", "elegibilidade"]), ("fonte", "10.1016/j.esmoop.2024.103481"), ("decidido_por", REVISOR)])]
    novo["flags"] = list(novo["consolidacao"]["flags"])
    # expectativa de uso e composição pelas MESMAS regras mecânicas do corpus (texto sem dose → indeterminado)
    prop, _tr = _reg_exp.propor(novo)
    novo["expectativa_uso"] = OrderedDict([("tipo", "fixa"), ("ciclos", None), ("periodicidade_dias", None), ("duracao_total_semanas", None),
        ("fonte", "esquema"), ("indeterminado", True), ("nota", f"esquema sem nº de ciclos nem periodicidade declarados (proposta mecânica: {prop.get('tipo')}/{prop.get('motivo')})"), ("selo", "estimativa")])
    comp = compor_composicao(novo); comp["fonte"] = "esquema"; comp["selo"] = "estimativa"
    novo["composicao"] = comp
    assert not comp["completa"] and all(i["indeterminado"] for i in comp["itens"]), comp
    # entra logo após o último regime de pênis (mantém agrupamento por tumor do agregado)
    idx = max(i for i, x in enumerate(regimes) if x["tumor"] == "penis")
    regimes.insert(idx + 1, novo); by[novo["regimen_id"]] = novo

    # =========================== 7. CONSEQUÊNCIAS ===========================
    hashes_depois = {r["regimen_id"]: content_hash(r) for r in regimes}
    rehash = []
    for rid in D:
        rehash.append(OrderedDict([("regimen_id", rid), ("content_hash_antes", hashes_antes[rid]), ("content_hash_depois", hashes_depois[rid]), ("mudou", hashes_antes[rid] != hashes_depois[rid])]))
    mudaram = {x["regimen_id"] for x in rehash if x["mudou"]}
    # regime NÃO tocado por decisão do lote não pode ter mudado de hash
    for rid, h in hashes_antes.items():
        if rid not in D:
            assert hashes_depois[rid] == h, f"hash mudou fora do lote: {rid}"
    # pareceres que expiram: qualquer decisão do export (todos os lotes) cujo content_hash != hash novo
    expirados = []
    for x in dec_all:
        h_novo = hashes_depois.get(x["regimen_id"])
        if h_novo and x["content_hash"] != h_novo and x["hash_atual"] == x["content_hash"]:
            expirados.append(OrderedDict([("regimen_id", x["regimen_id"]), ("decisao", x["decisao"]), ("acao", x["acao"]), ("data", x["data"]), ("content_hash_parecer", x["content_hash"]), ("hash_novo", h_novo)]))
    ja_expirados = [x["regimen_id"] for x in dec_all if x["hash_atual"] != x["content_hash"]]

    # meta do agregado
    placar = Counter(r["consolidacao"]["selo_confianca"] for r in regimes)
    por_tumor = []
    for t in sorted({r["tumor"] for r in regimes}, key=lambda t: [x["tumor"] for x in regimes].index(t)):
        rs = [r for r in regimes if r["tumor"] == t]
        por_tumor.append(OrderedDict([("tumor", t), ("regimes", len(rs)), ("selo", dict(Counter(r["consolidacao"]["selo_confianca"] for r in rs)))]))
    meta_ant = data["meta"]
    rh_ant = meta_ant.pop("revisao_humana", None)
    lotes_ant = meta_ant.pop("revisao_humana_lotes_anteriores", [])
    if rh_ant:
        lotes_ant.append(rh_ant)
    meta = OrderedDict()
    meta["titulo"] = "Protocolos de Oncologia 2025 — consolidado + intake revisão lote 2 (12–13/09/2026) (re-run 2026-07-22, 25 tumores)"
    meta["gerado_em"] = HOJE
    meta["total_tumores"] = len(por_tumor)
    meta["total_regimes"] = len(regimes)
    meta["distribuicao_selo"] = dict(placar)
    meta["por_tumor"] = por_tumor
    meta["politica"] = meta_ant.get("politica")
    meta["substitui"] = ORIGEM_RUN
    meta["publicacao"] = "NÃO publicado: RUN_ATIVO intocado; aguarda Portão A (--check-dois) + conferência humana dos primitivos novos + aviso ao grupo do piloto."
    meta["revisao_humana"] = OrderedDict([
        ("lote", 2), ("status", "aplicada"), ("data", HOJE), ("decidido_por", REVISOR), ("arquivo", "revisao-decisoes.json"),
        ("decisoes_lote", len(lote2)), ("aprovados_registrados", len(aprovados)),
        ("placar_por_acao", [OrderedDict([("acao", a), ("total", n), ("status", dict(Counter(x["status"] for x in RESULTADO if x["acao"] == a)))])
                             for a, n in Counter(x["acao"] for x in RESULTADO).items()]),
        ("resultado", RESULTADO),
        ("triagem_manual", TRIAGEM),
        ("refutados", [OrderedDict([("regimen_id", "prostata-mcrpc-1l-parp-nao-incorporado"), ("nota_revisao", D["prostata-mcrpc-1l-parp-nao-incorporado"]["justificativa"]), ("revisor", REVISOR), ("data", D["prostata-mcrpc-1l-parp-nao-incorporado"]["data"]), ("citacao_verificada", "10.1016/S0140-6736(25)00684-1"), ("ressalva", "SG final TALAPRO-2 (2025) diverge dos números do revisor — re_revisao aberta")])]),
        ("excluidos", []),
        ("regimes_novos", [OrderedDict([("regimen_id", novo["regimen_id"]), ("origem_decisao", "penis-met-2l-paclitaxel"), ("selo", novo["consolidacao"]["selo_confianca"])])]),
        ("referencias_verificadas", [OrderedDict([("doi", k), ("congruente", v["ok"]), ("primeiro_autor", v["primeiro_autor"]), ("ano", v["ano"]), ("estudo", v["estudo"]), ("tema", v["tema"])]) for k, v in VERIFICADAS.items()]),
        ("primitivos_novos", PRIMITIVOS_NOVOS),
        ("primitivos_rotulo_ajustado", [OrderedDict([("campo", "alteracao_fgfr"), ("tumor", "bexiga"), ("label_novo", "Alteração de FGFR2/FGFR3 (mutação ou fusão)")])]),
        ("elegibilidade_resultado", ELEG_RESULTADO),
        ("rehash", rehash),
        ("pareceres_expirados", expirados),
        ("pareceres_ja_expirados_antes_do_lote", sorted(set(ja_expirados))),
        ("re_revisao", RE_REVISAO),
        ("app_pendencias", ["consolidacao.nota_revisao / notas_revisao[] não são renderizados pela app hoje (só incorporacao.nota_revisao) — as notas do manter_anotar estão no dado; exibi-las é mudança de app (portão B)",
                            "rótulo do enum `cenario` para testículo (ver re_revisao)"]),
    ])
    meta["revisao_humana_lotes_anteriores"] = lotes_ant
    for k, vv in meta_ant.items():
        if k not in meta:
            meta[k] = vv
    data["meta"] = meta
    data["regimes"] = regimes
    with open(AGG, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)

    # fatias por tumor: regimes IDÊNTICOS ao agregado (check [8]); vocabulário atualizado
    for t, campos in vocab.items():
        f = os.path.join(AQUI, t, "v1", "regimes-consolidados.json")
        pt = json.load(open(f, encoding="utf-8"))
        rs = [r for r in regimes if r["tumor"] == t]
        pt["meta"]["gerado_em"] = HOJE
        pt["meta"]["total_regimes"] = len(rs)
        pt["meta"]["distribuicao_selo"] = dict(Counter(r["consolidacao"]["selo_confianca"] for r in rs))
        pt["meta"]["derivado_de"] = f"2026-09-13-intake-revisao-2/v1 (agregado; lote 2 de revisão)"
        pt["meta"]["revisao_humana"] = OrderedDict([("status", "lote 2 aplicado"), ("data", HOJE)])
        pt["campos_primitivos"] = campos
        pt["regimes"] = rs
        with open(f, "w", encoding="utf-8") as fh:
            json.dump(pt, fh, ensure_ascii=False, indent=2)

    # sidecar de hashes DESTE run (não toca backend/data)
    with open(os.path.join(AQUI, "content-hashes.json"), "w", encoding="utf-8") as fh:
        json.dump({"gerado_em": HOJE, "run": "2026-09-13-intake-revisao-2/v1", "hashes": hashes_depois}, fh, ensure_ascii=False, indent=0)

    # amostra sorteada (semente fixa = reprodutível) de 4 regras novas com o texto do revisor ao lado
    random.seed(20260913)
    amostra = random.sample([e for e in ELEG_RESULTADO if e["mudou"]], 4)
    relatorio = OrderedDict([
        ("placar_por_acao", meta["revisao_humana"]["placar_por_acao"]), ("resultado", RESULTADO), ("triagem_manual", TRIAGEM),
        ("primitivos_novos", PRIMITIVOS_NOVOS), ("pareceres_expirados", expirados), ("ja_expirados_antes", sorted(set(ja_expirados))),
        ("amostra_sorteada", amostra), ("re_revisao", RE_REVISAO), ("placar_selo", dict(placar)), ("total_regimes", len(regimes)),
        ("hashes_mudaram", sorted(mudaram))])
    with open(os.path.join(AQUI, "relatorio-intake-lote2.json"), "w", encoding="utf-8") as fh:
        json.dump(relatorio, fh, ensure_ascii=False, indent=2)
    print(json.dumps(relatorio, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
