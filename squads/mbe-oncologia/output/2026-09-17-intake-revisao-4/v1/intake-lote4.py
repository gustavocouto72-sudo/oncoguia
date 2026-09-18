#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
INTAKE REVISÃO — LOTE 4 (export revisao-decisoes de 17/09/2026: 334 decisões; 103 de 16/09 =
88 aprovados + 6 do pulmão já aplicados + 9 pareceres novos de conteúdo).

Roda SOBRE ESTE RUN (2026-09-17-intake-revisao-4/v1), cópia só-dados do run ativo
(2026-09-16-drivers-pulmao/v1). RUN_ATIVO não é tocado: publicar é decisão humana (sexta,
2026-09-18, depois da demo). O script roda UMA vez sobre a cópia limpa; para refazer, copie o run
ativo de novo. Depois dele roda `intake-salivar.py` (3 regimes novos), no mesmo run.

Decisões humanas que este lote executa (Gustavo Couto, mensagem de 2026-09-17, sobre o PLANO-lote4.md):
  D1 toripalimabe — caminho A: manter FORA, card atualizado (JUPITER-02 final, ESMO-MCBS 4 diverge
     do protocolo 3, registro Anvisa), motivo custo/política visível por alçada (clínico vê
     "política institucional"; gestor/revisor/auditor/admin veem o motivo). Caminho B (incorporar)
     fica fora de rodada (Gustavo + revisor + direção).
  D2 política de abstract de congresso aprovada (nunca pivô, nunca re-deriva eixo; complementar +
     flag evidencia_emergente + vigilância).
  D3 ovário beva — complementar abstract_congresso + vigilância; card mantido (não troca pivô).
  D4 carbo+paclitaxel — PATTERN pivô; Du 2020 secundário; o aprovado de 16/09 expira (ciente).
  D5 TCH — BCIRG-006 volta como pivô; KRISTINE + TRAIN-2 em pivos; refs do revisor como contexto.
  D6 cetuximabe-RT — nota literal do NRG-HN004 agora + re_revisao (primitivos desenhados, não entram).
  D7 salivar no mesmo run, script separado (intake-salivar.py).
  ACT-docetaxel: pergunta "retirar ramo N0?" vai para a fila do revisor (re_revisao).

Regras de sempre: nada inventado; referência nova só VERIFICADA (Crossref/Europe PMC/PubMed,
transcrição do que o registro devolveu); manter_anotar não muda dado (hash intacto); hash muda
só onde a mudança é de propósito; pareceres que expiram são reportados, não suprimidos;
'confirmado' nunca é atribuído pelo intake.
"""
import json, os, sys, copy, importlib.util, random
from collections import Counter, OrderedDict

AQUI = os.path.dirname(os.path.abspath(__file__))
SQUAD = os.path.abspath(os.path.join(AQUI, "..", "..", ".."))
RAIZ = os.path.abspath(os.path.join(SQUAD, "..", ".."))
AGG = os.path.join(AQUI, "regimes-consolidados.json")
EXPORT = os.path.join(AQUI, "revisao-decisoes.json")
HOJE = "2026-09-17"
LOTE = 4
REVISOR = "Gustavo Drummond Pinho Ribeiro"
ORIGEM_RUN = "2026-09-16-drivers-pulmao/v1"
ESTE_RUN = "2026-09-17-intake-revisao-4/v1"
DECISOR_HUMANO = "Gustavo Couto (mensagem, 2026-09-17, sobre PLANO-lote4.md §7)"

# hash: a MESMA função do app (fonte única da regra de expiração de parecer)
spec = importlib.util.spec_from_file_location("bd", os.path.join(RAIZ, "app", "build-data.py"))
bd = importlib.util.module_from_spec(spec); sys.modules["bd"] = bd; spec.loader.exec_module(bd)
content_hash = bd.content_hash

# ---------------------------------------------------------------------------
# Referências verificadas ANTES de rodar (Crossref works/<doi> + Europe PMC + PubMed esummary,
# 2026-09-16/17). Transcrição do que o registro devolveu — não do que se esperava.
# ---------------------------------------------------------------------------
VERIFICADAS = {
    "10.1001/jamaoncol.2020.2965": dict(
        ok=True, pmid="32789480", primeiro_autor="Yu", ano=2020, estudo="PATTERN",
        citacao="YU KD, Ye FG, He M, et al. Effect of Adjuvant Paclitaxel and Carboplatin on Survival in Women With Triple-Negative Breast Cancer: A Phase 3 Randomized Clinical Trial. JAMA Oncol. 2020;6(9):1390-1396.",
        tema="fase 3, 9 centros (China), n=647, TNBC operável adjuvante (N+ ou N0 com tumor >10 mm; excluídos localmente avançado/metastático e terapia pré-operatória): PCb = paclitaxel 80 mg/m² + carboplatina AUC 2 D1,8,15 a cada 28 d × 6 vs CEF×3→docetaxel×3; desfecho primário DFS"),
    "10.1007/s10549-020-05648-9": dict(
        ok=True, pmid="32394350", primeiro_autor="Du", ano=2020, estudo="Du 2020 (TP vs EC-T, não-inferioridade)",
        citacao="DU F, Wang W, Wang Y, et al. Carboplatin plus taxanes are non-inferior to epirubicin plus cyclophosphamide followed by taxanes as adjuvant chemotherapy for early triple-negative breast cancer. Breast Cancer Res Treat. 2020;182(1):67-77.",
        tema="fase II randomizado de NÃO-INFERIORIDADE, n=308, TNBC após cirurgia: TP = docetaxel 75 ou paclitaxel 175 mg/m² D1 + carboplatina AUC 5 D1, a cada 21 d × 6 vs EC×4→T×4; desfecho primário DFS em 5 anos — esquema DIFERENTE do card (q21, AUC 5), citado pelo revisor como 'fase III'"),
    "10.1056/NEJMoa0910383": dict(
        ok=True, pmid="21991949", primeiro_autor="Slamon", ano=2011, estudo="BCIRG-006",
        citacao="SLAMON D, Eiermann W, Robert N, et al. Adjuvant trastuzumab in HER2-positive breast cancer. N Engl J Med. 2011;365(14):1273-1283.",
        tema="fase 3 ADJUVANTE, n=3.222, HER2+ inicial (N+ ou N0 de alto risco): AC-T vs AC-TH vs TCH (docetaxel + carboplatina + trastuzumabe 52 sem); desfecho primário DFS"),
    "10.1016/S1470-2045(17)30716-7": dict(
        ok=True, pmid="29175149", primeiro_autor="Hurvitz", ano=2018, estudo="KRISTINE",
        citacao="HURVITZ SA, Martin M, Symmans WF, et al. Neoadjuvant trastuzumab, pertuzumab, and chemotherapy versus trastuzumab emtansine plus pertuzumab in patients with HER2-positive breast cancer (KRISTINE): a randomised, open-label, multicentre, phase 3 trial. Lancet Oncol. 2018;19(1):115-126.",
        tema="fase 3 NEOADJUVANTE, HER2+ EC II–III operável (tumor >2 cm): TCHP ×6 (docetaxel + carboplatina + trastuzumabe + pertuzumabe) vs T-DM1 + pertuzumabe; desfecho primário pCR"),
    "10.1016/S1470-2045(18)30570-9": dict(
        ok=True, pmid="30413379", primeiro_autor="van Ramshorst", ano=2018, estudo="TRAIN-2",
        citacao="VAN RAMSHORST MS, van der Voort A, van Werkhoven ED, et al. Neoadjuvant chemotherapy with or without anthracyclines in the presence of dual HER2 blockade for HER2-positive breast cancer (TRAIN-2): a multicentre, open-label, randomised, phase 3 trial. Lancet Oncol. 2018;19(12):1630-1640.",
        tema="fase 3 neoadjuvante, n=438, HER2+ EC II–III, bloqueio DUPLO (trastuzumabe + pertuzumabe): FEC×3→paclitaxel+carbo×6 vs paclitaxel+carbo×9; pCR 67% vs 68% (pivô anterior do card, mantido em pivos)"),
    "10.1016/S0140-6736(16)32417-5": dict(
        ok=True, pmid="27939064", primeiro_autor="Loibl", ano=2017, estudo="Loibl & Gianni 2017 (Seminar, revisão)",
        citacao="LOIBL S, Gianni L. HER2-positive breast cancer. Lancet. 2017;389(10087):2415-2429.",
        tema="REVISÃO (Lancet Series) do tratamento do câncer de mama HER2+ — citada pelo revisor (PMID 27939064) como se fosse ensaio; não é fonte primária"),
    "10.1007/s10549-021-06266-9": dict(
        ok=True, pmid="34086171", primeiro_autor="Lopresti", ano=2021, estudo="BrUOG (wPCbTP)",
        citacao="LOPRESTI M, Bian J, Sakr BJ, et al. Neoadjuvant weekly paclitaxel and carboplatin with trastuzumab and pertuzumab in HER2-positive breast cancer: a Brown University Oncology Research Group (BrUOG) study. Breast Cancer Res Treat. 2021;189(1):93-101.",
        tema="fase II braço único, n=30, HER2+ EC II–III neoadjuvante: paclitaxel semanal 80 + carboplatina AUC 2 + trastuzumabe + pertuzumabe (bloqueio DUPLO, paclitaxel); pCR 77% — esquema diferente do TCH"),
    "10.1200/jco.2026.44.16_suppl.5607": dict(
        ok=True, pmid=None, primeiro_autor="Sousa Filho", ano=2026, estudo="ASCO 2026 abstract 5607 (bevacizumabe em PROC, PSM retrospectivo)",
        citacao="SOUSA FILHO CS, Soares LR, de Albuquerque e Rodrigues de Sousa DG, et al. Bevacizumab rechallenge in platinum-resistant ovarian cancer: Evidence from a propensity score–matched analysis. J Clin Oncol. 2026;44(16_suppl):5607 (ASCO Annual Meeting 2026).",
        tema="ABSTRACT DE CONGRESSO; coorte RETROSPECTIVA unicêntrica (A.C. Camargo, SP), pareamento por escore de propensão 1:2, n=149 com PROC, QT ± bevacizumabe; PFS 7,79 vs 4,37 m (HR 0,49; 0,36–0,68); OS 23,06 vs 10,45 m (HR 0,47; 0,34–0,66); virgens de beva: PFS HR 0,47, OS HR 0,46; re-expostos: PFS HR 0,61 (p=0,15), OS HR 0,54 (0,26–1,11; p=0,09); interação p=0,60",
        tipo_publicacao="abstract_congresso", congresso="ASCO 2026", desenho="retrospectivo, pareado por escore de propensão, unicêntrico"),
    "10.1001/jama.2023.20181": dict(
        ok=True, pmid="38015220", primeiro_autor="Mai", ano=2023, estudo="JUPITER-02 (análise final de SG)",
        citacao="MAI HQ, Chen QY, Chen D, et al. Toripalimab Plus Chemotherapy for Recurrent or Metastatic Nasopharyngeal Carcinoma: The JUPITER-02 Randomized Clinical Trial. JAMA. 2023;330(20):1961-1970.",
        tema="fase 3 duplo-cego, n=289, nasofaringe recidivada/metastática sem QT prévia no cenário R/M: toripalimabe 240 mg vs placebo + gemcitabina-cisplatina ×6 → manutenção até 2 anos; PFS final 21,4 vs 8,2 m (HR 0,52; 0,37–0,73); seguimento mediano 36 m: OS HR 0,63 (0,45–0,89), p=0,008, mediana NR vs 33,7 m; efeito de OS consistente em PD-L1 alto e baixo"),
    "10.1016/s1470-2045(24)00507-2": dict(
        ok=True, pmid="39551064", primeiro_autor="Mell", ano=2024, estudo="NRG-HN004",
        citacao="MELL LK, Torres-Saavedra PA, Wong SJ, et al. Radiotherapy with cetuximab or durvalumab for locoregionally advanced head and neck cancer in patients with a contraindication to cisplatin (NRG-HN004): an open-label, multicentre, parallel-group, randomised, phase 2/3 trial. Lancet Oncol. 2024;25(12):1576-1588.",
        tema="fase 2/3, 89 centros, HNSCC localmente avançado com contraindicação a cisplatina (PS 2, insuficiência renal ou auditiva, neuropatia periférica, ≥70 a c/ comorbidade moderada/grave, <70 a c/ comorbidade grave): RT + cetuximabe vs RT + durvalumabe"),
}
# Lidas ao vivo (abstract / protocolo / scorecard), 2026-09-16 — números usados nas derivações.
ABSTRACT = {
    "PATTERN": "n=647 (322 CEF-T, 325 PCb), seguimento mediano 62 m: DFS 5 anos 86,5% vs 80,3% (HR 0,65; IC95% 0,44–0,96; p=0,03); DDFS e RFS semelhantes; OS HR 0,71 (0,42–1,22; p=0,22, NS); subgrupos exploratórios BRCA1/2 HR 0,44 (0,15–1,31), HRR HR 0,39 (0,15–0,99).",
    "Du2020": "n=308, seguimento mediano 66,9 m: DFS 5 anos 85,8% (EC-T) vs 84,4% (TP), p não-inferioridade 0,034, log-rank 0,712; OS 5 anos 94,4 vs 93,5% (p=0,77); TP com menos neutropenia G3/4 e alopecia, mais trombocitopenia G1–4.",
    "BCIRG-006": "n=3.222, seguimento mediano 65 m, 656 eventos: DFS 5 anos 75% (AC-T), 84% (AC-TH), 81% (TCH); OS 87%, 92%, 91%; sem diferença significativa entre os dois braços com trastuzumabe, ambos superiores a AC-T; ICC/disfunção cardíaca significativamente maiores no AC-TH que no TCH (p<0,001); 8 leucemias agudas (7 nos braços com antraciclina).",
    "KRISTINE": "HER2+ EC II–III operável (>2 cm), PS 0–1; TCHP ×6 como braço comparador; desfecho primário pCR.",
    "JUPITER-02": "n=289 (146 toripalimabe, 143 placebo); PFS final 21,4 vs 8,2 m (HR 0,52; 0,37–0,73); seguimento mediano 36,0 m: OS HR 0,63 (0,45–0,89), p bicaudal 0,008; mediana NR vs 33,7 m; OS 1/2/3 anos 90,9 vs 87,1% · 78,0 vs 65,1% · 64,5 vs 49,2% (corpo do artigo, conferido no dossiê WHO EML 2025 a.28); EA levando a descontinuação 11,6 vs 4,9%; EA imunomediados 54,1 vs 21,7%, G≥3 9,6 vs 1,4%.",
    "ESMO-MCBS-354": "ESMO-MCBS Scorecards, scorecard 354 (lido em 16/09/2026): toripalimabe + gemcitabina/cisplatina, nasofaringe R/M, JUPITER-02; ESMO-MCBS v2.0, Form 2a, desfecho avaliado OS (controle mediana 33,7 m, 3 a 49,2%; ganho estimado 19,8 m, 3 a +15,3%; HR 0,63); QoL pendente; score preliminar 4, score FINAL 4; emitido 22/09/2022, atualizado 02/07/2025.",
    "ANVISA-toripalimabe": "Registro novo Zytorvi (toripalimabe), Dr. Reddy's Farmacêutica do Brasil, Resolução-RE nº 3.085 (DOU 06/08/2026) — conferido em imprensa (O Tempo 07/08/2026; TribeMD); página gov.br/anvisa não lida diretamente.",
    "NRG-HN004-protocolo": "Protocolo NRG-HN004 (NCT03258554, v. 09/03/2022, §3.2, ClinicalTrials.gov): contraindicação absoluta ou relativa a cisplatina = ≥1 de: clearance de creatinina >30 e <60 mL/min (Cockcroft-Gault); Zubrod PS 2; neuropatia periférica pré-existente grau ≥1; história de perda auditiva (necessidade de aparelho auditivo OU queda ≥25 dB em 2 frequências contíguas no audiograma pré-tratamento); ≥70 anos com comorbidade moderada/grave; <70 anos com comorbidade grave.",
    "KEYNOTE-A18": "Lorusso, Lancet 2024 (PFS; PMID 38521086): n=1.060, FIGO 2014 IB2–IIB N+ ou III–IVA; PFS 24 m 68% vs 57%, HR 0,70 (0,55–0,89). Lancet 2024 (OS; PMID 39288779): OS 36 m 82,6 vs 74,8%, HR 0,67 (0,50–0,90), p=0,004. FDA (12/01/2024) aprovou só FIGO 2014 III–IVA: PFS HR 0,59 (0,43–0,82) em III–IVA (n=596) vs 0,91 (0,63–1,31) em IB2–IIB N+ (n=462). PD-L1 CPS<1 ≈ 4–5% dos pacientes (≈50) — subgrupo sem estimativa útil.",
}

# ---------------------------------------------------------------------------
# helpers (mesmos dos lotes 2 e 3)
# ---------------------------------------------------------------------------
def carregar():
    return json.load(open(AGG, encoding="utf-8"), object_pairs_hook=OrderedDict)

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

def crit(campo, op, valor):
    return OrderedDict([("campo", campo), ("operador", op), ("valor", valor)])

def ref_verificada(doi, nota=None, pivos=None):
    v = VERIFICADAS[doi]; assert v["ok"], doi
    d = OrderedDict([
        ("citacao", v["citacao"]), ("doi", doi), ("pmid", v["pmid"]), ("estudo", v["estudo"]),
        ("ano", v["ano"]), ("primeiro_autor", v["primeiro_autor"]),
        ("verificacao", OrderedDict([("registro", "Crossref + Europe PMC + PubMed"), ("data", HOJE), ("congruente", True), ("tema", v["tema"])]))])
    if pivos:
        d["pivos"] = pivos
    if nota:
        d["nota_troca"] = nota
    return d

def pivo(doi, papel, populacao):
    v = VERIFICADAS[doi]
    return OrderedDict([("papel", papel), ("estudo", v["estudo"]), ("doi", doi), ("pmid", v["pmid"]), ("ano", v["ano"]), ("primeiro_autor", v["primeiro_autor"]), ("populacao", populacao)])

def ref_complementar(doi, papel, **extra):
    v = VERIFICADAS[doi]; assert v["ok"], doi
    d = OrderedDict([("estudo", v["estudo"]), ("doi", doi), ("pmid", v["pmid"]), ("citacao", v["citacao"]), ("papel", papel), ("verificado_em", HOJE)])
    d.update(extra)
    return d

def trocar_referencia(r, doi, papel_nota, pivos=None):
    r["referencia_anterior"] = copy.deepcopy(r["referencia"])
    r["referencia"] = ref_verificada(doi, nota=papel_nota, pivos=pivos)
    for p in ("doi_incongruente", "doi_nao_reparado", "sem_estudo_pivo"):
        set_flag(r, None, remover_prefixo=p)

def eixo_elegibilidade(r, status, inclusao, exclusao, amplitude, divergencia, justificativa, fonte):
    e = r["verificacao"]["elegibilidade"]
    e.update(OrderedDict([("status", status), ("criterios_inclusao", inclusao), ("criterios_exclusao", exclusao),
                          ("amplitude", amplitude), ("divergencia_vs_protocolo", divergencia),
                          ("justificativa", justificativa), ("fonte", fonte),
                          ("rederivado_em", HOJE), ("rederivado_por", "intake-lote4:verificador-elegibilidade")]))

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

RESULTADO = []; ELEG_RESULTADO = []; RE_REVISAO = []; TRIAGEM = []; AMOSTRA_EXEC = []; VIGILANCIA = []; DECISOES_HUMANAS = []

def registrar(dec, status, nota=None, **kw):
    d = OrderedDict([("regimen_id", dec["regimen_id"]), ("data_decisao", dec["data"]), ("acao", dec["acao"]), ("status", status), ("nota", nota)])
    d.update(kw); RESULTADO.append(d)

def decisao_humana(codigo, regimen_id, decisao, efeito):
    DECISOES_HUMANAS.append(OrderedDict([("codigo", codigo), ("regimen_id", regimen_id), ("canal", "mensagem do Gustavo Couto ao squad, 2026-09-17 (resposta ao PLANO-lote4.md §7)"),
                                         ("decidido_por", "Gustavo Couto"), ("decisao", decisao), ("efeito", efeito)]))

POLITICA_ABSTRACT = OrderedDict([
    ("aprovada_em", HOJE), ("aprovada_por", "Gustavo Couto (D2)"),
    ("regras", [
        "abstract de congresso nunca é pivô (referencia.doi) e nunca re-deriva eixo (ESMO-MCBS só pontua publicação revisada por pares; GRADE de abstract seria rebaixado por relato incompleto)",
        "pedido corrigir_referencia com abstract → não troca; vira balde manter_anotar + referência complementar (registrado como triagem resolvida com decisão humana)",
        "entra em consolidacao.referencias_complementares[] com tipo=abstract_congresso, congresso, desenho, verificado_em, status_publicacao=aguardando_periodico",
        "flag visível 'evidencia_emergente: …' no card; selo e hash intactos (referências complementares ficam fora do content_hash)",
        "vigilância explícita em meta.revisao_humana.vigilancia[] com gatilho 'publicação em periódico' — quando publicar, vira corrigir_referencia normal",
        "proposta para verificar_dados.py (não deste lote): WARN se referencia.doi de qualquer regime contiver '_suppl'",
    ])])

# ---------------------------------------------------------------------------
def main():
    data = carregar()
    regimes = data["regimes"]
    by = {r["regimen_id"]: r for r in regimes}
    dec_all = json.load(open(EXPORT, encoding="utf-8"))["decisoes"]
    assert len(dec_all) == 334, len(dec_all)
    lote4 = [d for d in dec_all if d["data"] == "2026-09-16"]
    assert len(lote4) == 103, len(lote4)
    aprovados = [d for d in lote4 if d["decisao"] == "aprovado"]
    pulmao = [d for d in lote4 if d["decisao"] != "aprovado" and d["aplicada_em"] == "2026-09-16"]
    novos = [d for d in lote4 if d["decisao"] != "aprovado" and not d["aplicada_em"]]
    assert (len(aprovados), len(pulmao), len(novos)) == (88, 6, 9), (len(aprovados), len(pulmao), len(novos))
    # os 6 do pulmão foram gravados no hash antigo e expiraram pela própria execução (hash_atual = hash novo do corpus)
    assert all(d["acao"] == "ajustar_elegibilidade" and d["regimen_id"].startswith("nsclc-") and d["hash_atual"] != d["content_hash"] for d in pulmao)
    D = {d["regimen_id"]: d for d in novos}
    assert len(D) == 9
    assert set(D) == {"ovario-resistente-bevacizumabe-nao-incluido", "ovario-recidiva-platina-resistente-monoterapia", "colo-qrt-io-keynote-a18",
                      "cp-cec-def-cetuximabe-rt", "cp-naso-toripalimabe-nao-incluido", "sarcoma-ntrk-larotrectinibe-nao-incorporado",
                      "mama-adj-her2neg-act-docetaxel", "mama-neo-her2pos-ct1c-tch", "mama-adj-her2neg-carbo-paclitaxel"}, set(D)
    # a única pendência fora de 16/09: dostarlimabe MSS (triagem do lote 3, sem resposta) — não se toca
    pend_outras = [d for d in dec_all if d["estado_intake"] == "triada_pendente_execucao" and d["regimen_id"] not in D]
    assert [d["regimen_id"] for d in pend_outras] == ["endometrio-met-dostarlimabe-mss-nao-incluido"], pend_outras
    assert by["endometrio-met-dostarlimabe-mss-nao-incluido"]["consolidacao"]["decisao_revisao"] == "triagem_manual"
    # aprovado + crítica no MESMO regime e hash (carbo+pacli): esperado neste lote, tratado explicitamente (D4)
    sobrepostos = {d["regimen_id"] for d in aprovados} & set(D)
    assert sobrepostos == {"mama-adj-her2neg-carbo-paclitaxel"}, sobrepostos
    hashes_antes = {r["regimen_id"]: content_hash(r) for r in regimes}
    for d in aprovados + novos:
        rid = d["regimen_id"]
        assert hashes_antes[rid] == d["content_hash"] == d["hash_atual"], (rid, hashes_antes[rid], d["content_hash"], d["hash_atual"])
    for d in pulmao:
        assert hashes_antes[d["regimen_id"]] == d["hash_atual"], (d["regimen_id"], hashes_antes[d["regimen_id"]], d["hash_atual"])
    # reconciliação: pulmão (Fase A) já está no corpus ativo — só conferir
    for d in pulmao:
        r = by[d["regimen_id"]]
        assert any(str(h.get("origem", "")).startswith("intake-drivers-pulmao") for h in r.get("historico_versoes", [])), d["regimen_id"]

    vocab = {}
    for t in sorted(os.listdir(AQUI)):
        f = os.path.join(AQUI, t, "v1", "regimes-consolidados.json")
        if os.path.isfile(f):
            vocab[t] = json.load(open(f, encoding="utf-8"), object_pairs_hook=OrderedDict).get("campos_primitivos") or []
    campos_colo = {c["campo"]: c for c in vocab["colo-utero"]}
    assert campos_colo["pdl1_cps1"]["tipo"] == "boolean" and campos_colo["estadio_iii_iv_locavancado"]["tipo"] == "boolean"
    campos_cp = {c["campo"] for c in vocab["cabeca-pescoco"]}
    assert "inelegivel_cisplatina" in campos_cp and not ({"clearance_creatinina", "perda_auditiva_clinica", "neuropatia_grau"} & campos_cp)   # D6: não entram

    # =========================== 1. APROVADOS (88): só registro ===========================
    flip = 0
    for d in aprovados:
        r = by[d["regimen_id"]]
        r["consolidacao"].setdefault("aprovacoes", []).append(OrderedDict([("lote", LOTE), ("data", d["data"]), ("revisor", d["revisor"]), ("content_hash", d["content_hash"])]))
        if r["consolidacao"].get("decisao_revisao") in ("auto_confirmado_pendente_publicacao", "sem_divergencia_nao_requer_decisao", "pendente_oncologista_referencia", "rederivado_aguarda_revisao"):
            r["consolidacao"]["decisao_revisao"] = "aprovado_revisao_clinica"; flip += 1
        r["revisado_por"] = d["revisor"]; r["revisado_em"] = d["data"]

    # =========================== 2. MANTER_ANOTAR (4) ===========================
    def manter(rid, nota_squad=None, flag=None, extra_flags=(), origem="intake-lote4:manter_anotar"):
        d = D[rid]; r = by[rid]; assert d["acao"] == "manter_anotar", rid
        anotar(r, d, "revisado_com_ressalva", nota_squad=nota_squad)
        if flag:
            set_flag(r, flag)
        for f in extra_flags:
            set_flag(r, f)
        hist(r, origem, "Nota do revisor incorporada ao card (revisado com ressalva); dado, selo, motivo e eixos inalterados — hash intacto.", [], None, bump=False)
        AMOSTRA_EXEC.append(OrderedDict([("regimen_id", rid), ("acao", "manter_anotar"), ("texto_revisor", d["justificativa"]),
                                         ("nota_gravada", r["consolidacao"]["notas_revisao"][-1]), ("flag_gravada", flag)]))
        registrar(d, "executado", "nota incorporada (visível no card via notas_revisao); hash intacto")

    # 2a. PLD já está no card — sigla grafada por extenso no nome (campo fora do hash)
    r = by["ovario-recidiva-platina-resistente-monoterapia"]
    assert "PLD" in r["nome"] and "doxorrubicina lipossomal peguilada" in r["esquema"]
    nome_antes = r["nome"]
    r["nome"] = "Monoterapia (topotecano / doxorrubicina lipossomal peguilada / gemcitabina / docetaxel)"
    manter("ovario-recidiva-platina-resistente-monoterapia",
           nota_squad=(f"A doxorrubicina lipossomal peguilada JÁ constava do card — no nome como 'PLD' ('{nome_antes}') e no esquema ('doxorrubicina lipossomal peguilada 40 mg/m²'). "
                       "Nada foi acrescentado ao dado; a sigla foi grafada por extenso no nome para não confundir de novo (campo fora do hash). Selo, eixos e aprovação de 14/09 inalterados."),
           flag="nota_revisor: doxorrubicina lipossomal peguilada entre as opções de monoterapia em platino-resistente (já constava; sigla 'PLD' grafada por extenso)")

    # 2b. NTRK — concorda com o card
    manter("sarcoma-ntrk-larotrectinibe-nao-incorporado",
           nota_squad="Nota de contexto do revisor (benefício modesto; SG em sarcoma derivada de análises não randomizadas de fase I/II combinadas) — concorda com o GRADE 2C e com a não incorporação registrados; pivô (Drilon 2018), selo (confirmado) e motivo inalterados. Nenhum número novo a conferir.",
           flag="nota_revisor: benefício modesto — SG específica de sarcoma vem de análises não randomizadas (fase I/II combinadas), coorte TRK-fusão de tecidos moles e ósseos")

    # 2c. ACT-docetaxel — revisor CONFIRMA a divergência; a pergunta (retirar o ramo N0?) vai para a fila
    r = by["mama-adj-her2neg-act-docetaxel"]
    assert r["consolidacao"]["selo_confianca"] == "divergencia" and r["consolidacao"]["eixos_diverge"] == ["elegibilidade"]
    assert any(c["id"] == "alto_risco_tumoral" for c in r["elegibilidade"]["criterios"])
    manter("mama-adj-her2neg-act-docetaxel",
           nota_squad=("O revisor CONFIRMA a análise do squad: nenhum dos três estudos (PACS 01, NSABP B-28, CALGB 9344) avaliou N0, e o backbone do PACS 01 é FEC, não AC. "
                       "A regra NÃO foi alterada (ação = manter_anotar): o ramo 'alto_risco_tumoral' (N0 de alto risco) continua na regra e o eixo elegibilidade continua 'diverge' (mais_amplo). "
                       "Pergunta ao revisor em re_revisao: retirar o ramo N0 (ajustar_elegibilidade → selo vira re_derivado) ou mantê-lo como extensão clínica documentada (eixo passa a decisao_revisor, como abiraterona no lote 2)?"),
           flag="nota_revisor: confirmado — critério 'linfonodo-negativo de alto risco' é inferência clínica extrapolada (PACS 01, B-28 e 9344 são node-positive); PACS 01 usou FEC, não AC",
           extra_flags=["pergunta_ao_revisor: manter ou retirar o ramo N0 de alto risco da regra (decide o selo: divergencia × re_derivado)"])
    RE_REVISAO.append(OrderedDict([("regimen_id", "mama-adj-her2neg-act-docetaxel"), ("item", "ramo_n0_alto_risco"),
        ("descricao", "Revisor confirmou (16/09) que o ramo N0 de alto risco não tem respaldo em PACS 01/B-28/CALGB 9344. Decidir: (a) retirar o ramo — regra vira só N+ (ajustar_elegibilidade; eixo re_derivado; selo re_derivado); ou (b) manter como extensão clínica explícita e documentada — eixo marcado decisao_revisor/mais_amplo (precedente: abiraterona lote 2). Sem resposta, o card fica como está (divergencia)."),
        ("status", "aberto"), ("data", HOJE)]))

    # 2d. Cetuximabe-RT — D6: nota literal do NRG-HN004 agora; regra computável só se o revisor confirmar
    r = by["cp-cec-def-cetuximabe-rt"]
    r["consolidacao"].setdefault("referencias_complementares", []).append(ref_complementar("10.1016/s1470-2045(24)00507-2",
        "Fonte dos critérios de inelegibilidade a cisplatina que o revisor transcreveu (definição operacional do ensaio; protocolo NCT03258554 §3.2) — contexto; NÃO altera o pivô (Bonner 2006) nem os eixos.",
        tipo="artigo", definicao_no_protocolo=ABSTRACT["NRG-HN004-protocolo"]))
    manter("cp-cec-def-cetuximabe-rt",
           nota_squad=("Os 3 critérios do revisor são a definição operacional de contraindicação a cisplatina do NRG-HN004 (protocolo NCT03258554 §3.2; Mell 2024, Lancet Oncol — verificado): "
                       "ClCr >30 e <60 mL/min (Cockcroft-Gault); aparelho auditivo ou queda ≥25 dB em 2 frequências contíguas; neuropatia periférica grau ≥1 — o ensaio ainda lista PS 2 e ≥70 anos com comorbidade moderada/grave "
                       "(o texto do protocolo institucional já cita PS≥2, doença cardiovascular e idade). A ação registrada é manter_anotar; o texto pede 'acrescentar os critérios para aprovar o paciente' = pedido embutido de regra computável, "
                       "que NÃO foi executado (regra nunca nasce de texto livre). Decisão humana D6 (17/09): nota literal agora; primitivos desenhados (clearance_creatinina numérico, perda_auditiva_clinica booleano com a definição NRG, neuropatia_grau ordinal 0–4; "
                       "critério nomeado inelegivel_cisplatina_criterios = clcr<60 ∨ perda_auditiva ∨ neuropatia≥1 ∨ inelegivel_cisplatina) ficam em re_revisao para o revisor confirmar como ação própria (ajustar_elegibilidade) num lote seguinte."),
           flag="nota_revisor: inelegibilidade a cisplatina = ClCr <60 mL/min, perda auditiva (aparelho auditivo ou queda ≥25 dB em 2 frequências contíguas) ou neuropatia periférica ≥G1 (definição do NRG-HN004)",
           extra_flags=["pedido_embutido_nao_executado: critérios computáveis de inelegibilidade a cisplatina (3 primitivos novos) — aguarda ação própria do revisor"])
    RE_REVISAO.append(OrderedDict([("regimen_id", "cp-cec-def-cetuximabe-rt"), ("item", "criterios_inelegibilidade_cisplatina_computaveis"),
        ("descricao", "O parecer manter_anotar de 16/09 lista os critérios do NRG-HN004. Se o revisor quiser que o semáforo os compute, confirmar como ajustar_elegibilidade: entram 3 primitivos em cabeca-pescoco (clearance_creatinina [mL/min, numérico], perda_auditiva_clinica [booleano; aparelho auditivo ou queda ≥25 dB em 2 freq. contíguas], neuropatia_grau [ordinal 0–4]) e a regra vira inelegivel_cisplatina ∨ clcr<60 ∨ perda_auditiva ∨ neuropatia≥1 (o booleano atual fica para PS/idade/cardio). Hash muda nesse lote. Perguntas: ClCr<60 ou a janela do ensaio (>30 e <60)? incluir PS 2 e idade/comorbidade como no ensaio?"),
        ("status", "aberto"), ("data", HOJE)]))
    decisao_humana("D6", "cp-cec-def-cetuximabe-rt", "nota literal do NRG-HN004 agora + re_revisao; primitivos desenhados, não entram", "hash intacto; 0 primitivos novos")

    # =========================== 3. AJUSTAR_ELEGIBILIDADE — KEYNOTE-A18 ===========================
    d = D["colo-qrt-io-keynote-a18"]; r = by[d["regimen_id"]]; assert d["acao"] == "ajustar_elegibilidade"
    antes = json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)
    assert r["elegibilidade"]["regra"] == {"and": [{"eq": ["tumor", "colo_utero"]}, {"eq": ["estadio_iii_iv_locavancado", True]}]}, antes
    r["elegibilidade"]["criterios"] = [OrderedDict([("id", "figo_iii_iva"), ("label", "FIGO 2014 III–IVA (localmente avançado; rótulo FDA/EMA do KEYNOTE-A18)"), ("expr", {"eq": ["estadio_iii_iv_locavancado", True]})]),
                                       OrderedDict([("id", "pdl1_cps1"), ("label", "PD-L1 positivo (CPS ≥1) — decisão do revisor, 16/09"), ("expr", {"eq": ["pdl1_cps1", True]})])]
    r["elegibilidade"]["regra"] = {"and": [{"eq": ["tumor", "colo_utero"]}, {"ref": "figo_iii_iva"}, {"ref": "pdl1_cps1"}]}
    campos_colo["estadio_iii_iv_locavancado"]["label"] = "Estádio FIGO 2014 III–IVA (localmente avançado)"
    campos_colo["pdl1_cps1"]["label"] = "PD-L1 positivo (CPS ≥1)"
    eixo_elegibilidade(r, "re_derivado",
        [crit("tumor", "=", "colo_utero"), crit("estadio_iii_iv_locavancado", "=", True), crit("pdl1_cps1", "=", True)], [],
        "mais_estreito",
        "Regra do revisor: 'FIGO III–IVA e PD-L1 positivo (CPS ≥1)'. KEYNOTE-A18 incluiu FIGO 2014 IB2–IIB N+ E III–IVA, sem seleção por PD-L1. " + ABSTRACT["KEYNOTE-A18"] +
        " A restrição por ESTÁDIO coincide com o rótulo FDA (12/01/2024) e EMA; a restrição por CPS ≥1 vai além do rótulo (é decisão clínica do revisor sobre um subgrupo pequeno e sem estimativa útil). Regra MAIS ESTREITA que o ensaio nas duas frentes — direção segura. "
        "O texto do protocolo institucional ('estádios III e IV') fica intocado; 'localmente avançado' exclui IVB por definição.",
        "Re-derivado da spec do revisor (16/09) confrontada com a população do KEYNOTE-A18 (Lorusso 2024, Lancet) e com o rótulo FDA.",
        "https://doi.org/10.1016/S0140-6736(24)00317-9")
    r["consolidacao"]["correcao"] = d["justificativa"]; r["consolidacao"]["spec_revisor_resultado"] = "aplicada"
    set_flag(r, "elegibilidade:mais_estreito (III–IVA = rótulo FDA/EMA; CPS ≥1 = decisão do revisor além do rótulo)")
    anotar(r, d, "rederivado_aguarda_revisao", nota_squad="Regra computável aplicada com primitivos existentes (estadio_iii_iv_locavancado, pdl1_cps1); eixo elegibilidade re-derivado (mais_estreito); hash muda — o próprio parecer expira pela execução (mecânica ASCENT/drivers). Selo re_derivado mantido.")
    selo = selo_por_eixos(r); assert selo == "re_derivado", selo
    hist(r, "intake-lote4:ajustar_elegibilidade", "Elegibilidade restrita a FIGO III–IVA + PD-L1 CPS ≥1 por decisão do revisor (16/09); eixo re-derivado contra KEYNOTE-A18 e rótulo FDA (mais_estreito).", ["elegibilidade"], "10.1016/S0140-6736(24)00317-9")
    ELEG_RESULTADO.append(OrderedDict([("id", r["regimen_id"]), ("mudou", True), ("antes", antes), ("depois", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("texto_revisor", d["justificativa"]), ("novosPrim", [])]))
    AMOSTRA_EXEC.append(OrderedDict([("regimen_id", r["regimen_id"]), ("acao", "ajustar_elegibilidade"), ("texto_revisor", d["justificativa"]), ("nota_gravada", r["consolidacao"]["notas_revisao"][-1]), ("flag_gravada", "elegibilidade:mais_estreito (…)")]))
    registrar(d, "executado", "regra restrita (III–IVA ∧ CPS≥1); eixo re-derivado mais_estreito; hash muda")

    # =========================== 4. CORRIGIR_REFERENCIA — carbo+paclitaxel (D4: PATTERN pivô) ===========================
    d = D["mama-adj-her2neg-carbo-paclitaxel"]; r = by[d["regimen_id"]]; assert d["acao"] == "corrigir_referencia"
    assert r["referencia"]["estudo"] == "CALGB 40603" and r["consolidacao"]["selo_confianca"] == "divergencia"
    trocar_referencia(r, "10.1001/jamaoncol.2020.2965",
        "Revisor (16/09) indicou Du 2020 (BCRT; 'fase III chinês, carboplatina + taxano não-inferior a EC-T em TNBC adjuvante'). Verificado: Du 2020 é fase II de não-inferioridade com TP a cada 21 d (docetaxel 75/paclitaxel 175 + carboplatina AUC 5) — tema certo, ESQUEMA diferente do card. "
        "O ensaio com o esquema EXATO do card (paclitaxel 80 + carboplatina AUC 2 D1,8,15 q28 ×6, adjuvante TNBC) é o PATTERN (Yu 2020, JAMA Oncol, fase 3). Decisão humana D4 (17/09): PATTERN como pivô; Du 2020 como pivô secundário. CALGB 40603 (neoadjuvante) sai para referencia_anterior.",
        pivos=[pivo("10.1001/jamaoncol.2020.2965", "principal (esquema idêntico ao card; fase 3; decisão D4)", "TNBC operável adjuvante, N+ ou N0 com tumor >10 mm, sem terapia pré-operatória; PCb semanal q28 ×6 vs CEF-T"),
               pivo("10.1007/s10549-020-05648-9", "secundário (a referência dada pelo revisor; não-inferioridade; esquema q21/AUC 5)", "TNBC após cirurgia primária; TP q21 ×6 vs EC×4→T×4; DFS 5 anos não-inferior")])
    r["beneficio"] = OrderedDict([("desfecho_principal", "↑ sobrevida livre de doença (adjuvante, TNBC)"),
        ("magnitude", "PATTERN: DFS 5 anos 86,5% vs 80,3% (HR 0,65; IC95% 0,44–0,96; p=0,03) vs CEF-T; OS HR 0,71 (0,42–1,22; NS). Du 2020 (TP q21): DFS 5 anos 84,4 vs 85,8% (não-inferior a EC-T)."),
        ("fonte", "10.1001/jamaoncol.2020.2965")])
    r["verificacao"]["grade"].update(status="re_derivado", valor_rederivado="1B",
        justificativa="sem_afirmacao_protocolo. PATTERN (Yu 2020; PMID 32789480): fase 3 aberto, 9 centros chineses, " + ABSTRACT["PATTERN"] + " Esquema e cenário IDÊNTICOS ao card (adjuvante, TNBC operável). RCT com desfecho primário (DFS) positivo, mas ensaio único, aberto, OS não significativa e população de um país → qualidade rebaixada um nível (B); benefício claro em DFS → força 1. Du 2020 (não-inferioridade, esquema q21) corrobora a viabilidade do par platina+taxano sem antraciclina.",
        fonte="https://doi.org/10.1001/jamaoncol.2020.2965")
    r["verificacao"]["esmo_mcbs"].update(status="re_derivado", valor_rederivado="B (curativo)", formulario="curativo (A/B/C)",
        justificativa="Form 1 (cenário curativo/adjuvante): DFS como desfecho primário, HR 0,65 (IC 0,44–0,96), sem ganho de OS demonstrado (HR 0,71, NS) → grau B (DFS HR ≤0,65 sem OS madura; limite superior do IC cruza 0,8 — não sobe a A). Re-derivado do PATTERN; sem_afirmacao_protocolo.",
        fonte="https://doi.org/10.1001/jamaoncol.2020.2965")
    antes = json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)
    eixo_elegibilidade(r, "re_derivado",
        [crit("subtipo", "=", "triplo-negativo"), crit("cenario", "=", "adjuvancia"), crit("doenca", "=", "operável (N+ ou N0 com tumor >10 mm)")], [crit("tratamento_previo", "=", "terapia pré-operatória (excluída)")],
        "mais_amplo",
        "Com o PATTERN como pivô, CENÁRIO (adjuvante) e SUBTIPO (TNBC = her2 negativo ∧ rh negativo) batem com a regra do card. Resta uma amplitude: o PATTERN excluiu N0 com tumor ≤10 mm (e doença localmente avançada/metastática); a regra não restringe T/N e admite N0 ≤1 cm — direção insegura, sinalizada como mais_amplo, não como divergência (a regra é a que o revisor fixou em 08/18; restringir T/N seria escolha do squad). "
        "A divergência anterior (fonte neoadjuvante × card adjuvante) está RESOLVIDA pela troca de referência.",
        "Re-derivado da população do PATTERN (Yu 2020) após a troca de referência pedida pelo revisor (16/09) e a decisão D4.",
        "https://doi.org/10.1001/jamaoncol.2020.2965")
    set_flag(r, None, remover_prefixo="cenario_referencia")
    set_flag(r, None, remover_prefixo="elegibilidade:mais_amplo")
    set_flag(r, "elegibilidade:mais_amplo (PATTERN excluiu N0 ≤10 mm; regra não restringe T/N)")
    set_flag(r, "referencia_trocada: CALGB 40603 (neoadjuvante) → PATTERN (adjuvante, esquema idêntico); Du 2020 (DOI do revisor) como pivô secundário — decisão D4")
    r["consolidacao"]["spec_revisor_resultado"] = "aplicada (referência); regra inalterada"
    r["consolidacao"]["spec_revisor_nao_computavel"] = None
    anotar(r, d, "rederivado_aguarda_revisao",
           nota_squad=("Referência trocada por decisão humana D4: o DOI do revisor (Du 2020) resolve para fase II de não-inferioridade com TP a cada 21 dias e carboplatina AUC 5 — não é o esquema do card nem 'fase III'. PATTERN (Yu 2020, JAMA Oncol) tem esquema idêntico ao card e é fase 3 → pivô; Du 2020 fica como pivô secundário. "
                       "GRADE 2C→1B, ESMO-MCBS n/a→B (Form 1), elegibilidade diverge→re_derivado (mais_amplo: N0 ≤10 mm), selo divergencia→re_derivado. Hash muda: o aprovado de 16/09 (mesmo hash da crítica) EXPIRA pela execução — esperado e ciente (D4); o revisor re-aprova na fila."))
    selo = selo_por_eixos(r); assert selo == "re_derivado", selo
    hist(r, "intake-lote4:corrigir_referencia", "Referência trocada para PATTERN (Yu 2020, JAMA Oncol; esquema idêntico) com Du 2020 (DOI do revisor) como pivô secundário; GRADE/ESMO/elegibilidade re-derivados; referencia_anterior (CALGB 40603) preservada.", ["grade", "esmo_mcbs", "elegibilidade"], "10.1001/jamaoncol.2020.2965")
    ELEG_RESULTADO.append(OrderedDict([("id", r["regimen_id"]), ("mudou", False), ("antes", antes), ("depois", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("texto_revisor", d["justificativa"]), ("novosPrim", [])]))
    AMOSTRA_EXEC.append(OrderedDict([("regimen_id", r["regimen_id"]), ("acao", "corrigir_referencia"), ("texto_revisor", d["justificativa"]), ("nota_gravada", r["consolidacao"]["notas_revisao"][-1]), ("flag_gravada", "referencia_trocada: … PATTERN …")]))
    registrar(d, "executado_com_ressalva", "pivô = PATTERN (não o DOI do revisor, que é outro esquema; D4); Du 2020 secundário; selo divergencia→re_derivado; aprovado de 16/09 expira")
    decisao_humana("D4", r["regimen_id"], "PATTERN pivô; Du 2020 secundário; ciente de que o aprovado de 16/09 expira", "hash muda; 1 aprovação expira")

    # =========================== 5. CORRIGIR_REFERENCIA — TCH (D5: BCIRG-006 volta) ===========================
    d = D["mama-neo-her2pos-ct1c-tch"]; r = by[d["regimen_id"]]; assert d["acao"] == "corrigir_referencia"
    assert r["referencia"]["estudo"] == "TRAIN-2" and r["referencia_anterior"]["estudo"] == "BCIRG-006"
    trocar_referencia(r, "10.1056/NEJMoa0910383",
        "Revisor (16/09): 'a afirmação de que o TCH carece de estudo está incorreta' — cita BCIRG-006, TRYPHAENA e KRISTINE e envia PMID 27939064, DOI 10.1007/s10549-021-06266-9 e PMID 29175149. Verificado: 27939064 = Loibl & Gianni 2017 (revisão); s10549-021-06266-9 = BrUOG 2021 (paclitaxel semanal + carbo + trastuzumabe + pertuzumabe, fase II); 29175149 = KRISTINE (TCHP). "
        "Nenhuma das três é o TCH de bloqueio simples; o ensaio do TCH que o revisor descreve é o BCIRG-006 — a referencia_anterior deste card (trocada por TRAIN-2 a pedido dele em 08/18). Decisão humana D5 (17/09): BCIRG-006 volta como pivô; KRISTINE e TRAIN-2 em pivos; Loibl 2017 e BrUOG 2021 como contexto.",
        pivos=[pivo("10.1056/NEJMoa0910383", "principal (o ensaio do TCH; adjuvante; decisão D5)", "HER2+ inicial adjuvante, N+ ou N0 de alto risco (tumor >2 cm, RH−, grau 2–3 ou <35 anos); TCH ×6 + trastuzumabe 52 sem"),
               pivo("10.1016/S1470-2045(17)30716-7", "secundário (TCHP neoadjuvante — bloqueio duplo)", "HER2+ EC II–III operável (>2 cm), neoadjuvante; TCHP ×6 como braço comparador"),
               pivo("10.1016/S1470-2045(18)30570-9", "secundário (neoadjuvante; antraciclina × não-antraciclina sob bloqueio duplo — pivô anterior)", "HER2+ EC II–III neoadjuvante; paclitaxel+carbo ×9 + trastuzumabe + pertuzumabe")])
    r["consolidacao"].setdefault("referencias_complementares", []).extend([
        ref_complementar("10.1016/S0140-6736(16)32417-5", "Contexto: revisão (Lancet Series) enviada pelo revisor como PMID 27939064 — não é fonte primária; não altera eixos.", tipo="revisao"),
        ref_complementar("10.1007/s10549-021-06266-9", "Contexto: fase II de paclitaxel semanal + carboplatina + trastuzumabe + pertuzumabe (bloqueio duplo, paclitaxel) — esquema diferente do TCH; enviada pelo revisor; não altera eixos.", tipo="artigo")])
    r["beneficio"] = OrderedDict([("desfecho_principal", "↑ sobrevida livre de doença e global vs QT sem trastuzumabe (adjuvante); menor cardiotoxicidade que AC-TH"),
        ("magnitude", "BCIRG-006: DFS 5 anos 81% (TCH) vs 75% (AC-T) vs 84% (AC-TH); OS 91% vs 87% vs 92%; ICC/disfunção cardíaca significativamente menores no TCH que no AC-TH. Neoadjuvante: KRISTINE (TCHP) pCR ~56%; TRAIN-2 (bloqueio duplo, sem antraciclina) pCR 68%."),
        ("fonte", "10.1056/NEJMoa0910383")])
    r["verificacao"]["grade"].update(status="re_derivado", valor_rederivado="1B", qualidade_rederivada="B", forca_rederivada="1", indeterminado_parcial=[],
        justificativa="BCIRG-006 (Slamon 2011; PMID 21991949): fase 3, " + ABSTRACT["BCIRG-006"] + " É o ensaio do esquema exato do card (docetaxel + carboplatina + trastuzumabe, bloqueio simples) com DFS e OS maduras. Indireção de CENÁRIO (adjuvante → neoadjuvante) e de população (N+ ou N0 de alto risco vs cT1c do card) → qualidade rebaixada um nível (B); benefício robusto em DFS/OS e perfil cardíaco favorável → força 1. KRISTINE e TRAIN-2 (neoadjuvantes, bloqueio duplo) sustentam o cenário, não o esquema.",
        fonte="https://doi.org/10.1056/NEJMoa0910383")
    r["verificacao"]["esmo_mcbs"].update(status="re_derivado", valor_rederivado="B (curativo)", formulario="curativo (A/B/C)",
        justificativa="Form 1 (curativo), BCIRG-006 TCH vs AC-T: OS 5 anos 91% vs 87% (+4 pontos absolutos com seguimento ≥3 anos) → grau B (≥3% e <5%); DFS 81 vs 75% (HR ≈0,75). Não é 'n/a por ausência de fonte': é desfecho de sobrevida maduro, graduado. Indireção de cenário (adjuvante × neoadjuvante) anotada.",
        fonte="https://doi.org/10.1056/NEJMoa0910383")
    antes = json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)
    eixo_elegibilidade(r, "diverge",
        [crit("her2", "=", "positivo"), crit("cenario", "=", "adjuvancia (BCIRG-006) / neoadjuvancia (KRISTINE, TRAIN-2)"), crit("risco", "=", "N+ ou N0 de alto risco (>2 cm, RH−, grau 2–3, <35 a) [BCIRG-006]; T >2 cm ou N+ [KRISTINE]")], [crit("tratamento_previo", "=", True)],
        "mais_amplo",
        "BCIRG-006 exigiu N+ ou N0 de ALTO RISCO (tumor >2 cm, RH negativo, grau 2–3 ou idade <35); KRISTINE exigiu EC II–III (>2 cm); TRAIN-2 EC II–III. A regra do card (cenario=neoadjuvancia ∧ her2=positivo ∧ cT1/T1a/T1b/T1c, sem exigir N nem fator de risco) admite cT1 N0 sem fator de alto risco — população que NENHUM dos três pivôs estudou (mais_amplo, direção insegura) — e exclui T2–T4, o grosso das três populações. A divergência de elegibilidade PERMANECE; o que a troca resolve é a referência do esquema (TCH tem RCT), não a regra.",
        "Re-derivado da população do BCIRG-006 (pivô) e dos pivos KRISTINE/TRAIN-2 após a decisão D5.",
        "https://doi.org/10.1056/NEJMoa0910383")
    for p in ("indirectness_regime", "indirectness_desfecho", "grade_forca_indeterminada", "elegibilidade:mais_amplo"):
        set_flag(r, None, remover_prefixo=p)
    set_flag(r, "indirectness_cenario: BCIRG-006 é adjuvante; o card é neoadjuvante (KRISTINE/TRAIN-2 cobrem o cenário com bloqueio duplo)")
    set_flag(r, "elegibilidade:mais_amplo (regra cT1c sem N nem fator de risco; BCIRG-006 = N+ ou N0 de alto risco; KRISTINE/TRAIN-2 = EC II–III)")
    set_flag(r, "referencia_trocada: TRAIN-2 → BCIRG-006 (o ensaio do TCH) com KRISTINE e TRAIN-2 em pivos — decisão D5; PMID 27939064 (revisão) e BrUOG 2021 (paclitaxel+HP) como contexto")
    r["consolidacao"]["nota_revisao"] = None
    anotar(r, d, "rederivado_aguarda_revisao",
           nota_squad=("Decisão humana D5: BCIRG-006 volta como pivô (o revisor pediu TRAIN-2 em 08/18 e agora aponta que o TCH tem RCT — o RCT é o BCIRG-006, que já era a referência anterior). Das três referências enviadas, uma é revisão (Loibl 2017), uma é outro esquema (BrUOG: paclitaxel semanal + carbo + HP) e uma é o KRISTINE (TCHP) — só a última entrou em pivos. "
                       "GRADE C→1B, ESMO-MCBS n/a→B (Form 1), elegibilidade continua DIVERGE (regra cT1c sem N nem fator de risco não é a população de nenhum pivô); selo divergencia mantido. Hash muda; o parecer expira pela execução. Contradição 'validado apesar de não ter estudo' corrigida."))
    selo = selo_por_eixos(r); assert selo == "divergencia" and r["consolidacao"]["eixos_diverge"] == ["elegibilidade"], (selo, r["consolidacao"]["eixos_diverge"])
    hist(r, "intake-lote4:corrigir_referencia", "Referência trocada: TRAIN-2 → BCIRG-006 (pivô do TCH), KRISTINE + TRAIN-2 em pivos; Loibl 2017 e BrUOG 2021 como referências complementares; GRADE/ESMO/elegibilidade re-derivados; referencia_anterior (TRAIN-2) preservada.", ["grade", "esmo_mcbs", "elegibilidade"], "10.1056/NEJMoa0910383")
    ELEG_RESULTADO.append(OrderedDict([("id", r["regimen_id"]), ("mudou", False), ("antes", antes), ("depois", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("texto_revisor", d["justificativa"]), ("novosPrim", [])]))
    AMOSTRA_EXEC.append(OrderedDict([("regimen_id", r["regimen_id"]), ("acao", "corrigir_referencia"), ("texto_revisor", d["justificativa"]), ("nota_gravada", r["consolidacao"]["notas_revisao"][-1]), ("flag_gravada", "referencia_trocada: TRAIN-2 → BCIRG-006 …")]))
    registrar(d, "executado_com_ressalva", "pivô = BCIRG-006 (nenhuma das 3 refs do revisor é o TCH; D5); KRISTINE+TRAIN-2 em pivos; elegibilidade segue diverge")
    RE_REVISAO.append(OrderedDict([("regimen_id", r["regimen_id"]), ("item", "regra_ct1c_sem_n"),
        ("descricao", "Com BCIRG-006/KRISTINE/TRAIN-2 como base, a regra 'cT1c sem N nem fator de risco' segue fora de todas as populações estudadas (e exclui T2–T4). Se o revisor quiser alinhar (ex.: N+ ou T>2 cm, ou cT1c com fator de alto risco), é ajustar_elegibilidade num lote seguinte; se mantiver como política institucional, o eixo pode passar a decisao_revisor."),
        ("status", "aberto"), ("data", HOJE)]))
    decisao_humana("D5", r["regimen_id"], "BCIRG-006 volta como pivô do TCH; KRISTINE + TRAIN-2 em pivos; refs do revisor como contexto", "hash muda; selo divergencia mantido")

    # =========================== 6. OVÁRIO BEVA — abstract ASCO 2026 (D2 + D3) ===========================
    d = D["ovario-resistente-bevacizumabe-nao-incluido"]; r = by[d["regimen_id"]]; assert d["acao"] == "corrigir_referencia"
    v = VERIFICADAS["10.1200/jco.2026.44.16_suppl.5607"]
    assert r["referencia"]["doi"] == "10.1200/JCO.2013.51.4489" and r["consolidacao"]["selo_confianca"] == "confirmado"
    r["consolidacao"].setdefault("referencias_complementares", []).append(ref_complementar("10.1200/jco.2026.44.16_suppl.5607",
        "Evidência emergente citada pelo revisor (16/09) — abstract de congresso, retrospectivo; NÃO substitui o pivô (AURELIA, fase 3) nem altera eixos/selo (política de abstract, D2).",
        tipo="abstract_congresso", congresso=v["congresso"], desenho=v["desenho"], status_publicacao="aguardando_periodico", url_asco="https://www.asco.org/abstracts-presentations/258162",
        numeros_conferidos="PFS 7,79 vs 4,37 m (HR 0,49); OS 23,06 vs 10,45 m (HR 0,47); virgens de beva OS HR 0,46; re-expostos OS HR 0,54 (p=0,09) — CONFEREM com a justificativa do revisor"))
    set_flag(r, "evidencia_emergente: ASCO 2026 abstract 5607 (Sousa Filho, A.C. Camargo) — retrospectivo pareado por escore de propensão, n=149, unicêntrico; bevacizumabe em PROC virgens de beva com PFS/OS maiores; rechallenge sem significância. Não altera selo nem eixos; reavaliar quando publicado em periódico")
    anotar(r, d, "revisado_com_ressalva",
           nota_squad=("Ação registrada = corrigir_referencia com um abstract da ASCO 2026. Verificado: " + v["citacao"] + " — " + v["tema"] + ". Os números do revisor conferem com o abstract. "
                       "Pela política de abstract de congresso (D2, 17/09) e decisão D3, o abstract NÃO vira pivô (AURELIA, fase 3, permanece) e não re-deriva eixo: entra como referência complementar tipo abstract_congresso, com flag evidencia_emergente e item de vigilância (gatilho: publicação em periódico). Selo confirmado, motivo de não inclusão e hash INTACTOS. "
                       "O 'considerar a discutir em 2ª linha' é pedido de incorporação de um não-incluído — decisão de política (mesmo trilho do toripalimabe), aberta ao revisor em re_revisao; mesmo publicado, um retrospectivo unicêntrico não destrona o fase 3."))
    hist(r, "intake-lote4:corrigir_referencia→manter_anotar+complementar", "Abstract ASCO 2026 (retrospectivo PSM) verificado e anexado como referência complementar tipo abstract_congresso (política D2; decisão D3); pivô AURELIA, eixos, selo e hash intactos; vigilância aberta.", [], "10.1200/jco.2026.44.16_suppl.5607", bump=False)
    TRIAGEM.append(OrderedDict([("regimen_id", r["regimen_id"]), ("acao", d["acao"]), ("balde_proposto", "manter_anotar + referência complementar (abstract_congresso) + vigilância"), ("resolvida_por", DECISOR_HUMANO + " — D3"),
                                ("motivo", "a referência é abstract de congresso, retrospectivo; trocar o pivô (AURELIA, fase 3) por ela seria rebaixar a base do card; a política de abstract (D2) proíbe abstract como pivô")]))
    VIGILANCIA.append(OrderedDict([("regimen_id", r["regimen_id"]), ("doi_abstract", "10.1200/jco.2026.44.16_suppl.5607"), ("congresso", "ASCO 2026"), ("gatilho", "publicação em periódico revisado por pares (mesma coorte/autores) → corrigir_referencia normal ou complementar tipo artigo"), ("aberto_em", HOJE), ("status", "aberto")]))
    RE_REVISAO.append(OrderedDict([("regimen_id", r["regimen_id"]), ("item", "incorporacao_bevacizumabe_2l_proc"),
        ("descricao", "Revisor sugere 'considerar a discutir em pacientes resistentes a platina em 2ª linha' com base no abstract ASCO 2026 (retrospectivo). O card é 'não incluído' pelo protocolo (AURELIA: SLP sem SG robusta, MCBS 3). Incorporar é decisão de política institucional (revisor + Gustavo + direção), não de dado; a evidência nova é observacional e ainda não publicada. Confirmar se fica como está (nota + vigilância) ou se abre pedido de incorporação."),
        ("status", "aberto"), ("data", HOJE)]))
    AMOSTRA_EXEC.append(OrderedDict([("regimen_id", r["regimen_id"]), ("acao", "corrigir_referencia → manter_anotar+complementar"), ("texto_revisor", d["justificativa"]), ("nota_gravada", r["consolidacao"]["notas_revisao"][-1]), ("flag_gravada", "evidencia_emergente: ASCO 2026 abstract 5607 …")]))
    registrar(d, "executado_com_ressalva", "abstract verificado; complementar tipo abstract_congresso + vigilância (D2/D3); pivô AURELIA, selo e hash intactos; incorporação em 2L → re_revisao")
    decisao_humana("D2", None, "política de abstract de congresso aprovada como proposta (PLANO §2)", "meta.revisao_humana.politica_abstract_congresso")
    decisao_humana("D3", r["regimen_id"], "ovário beva como complementar abstract_congresso + vigilância; card mantido", "hash intacto; pivô AURELIA")

    # =========================== 7. TORIPALIMABE — D1 caminho A (manter FORA; card atualizado; motivo por alçada) ===========================
    d = D["cp-naso-toripalimabe-nao-incluido"]; r = by[d["regimen_id"]]; assert d["acao"] == "refutar" and d["natureza"] == "dado"
    v = VERIFICADAS["10.1001/jama.2023.20181"]
    assert r["referencia"]["doi"] == "10.1001/jama.2023.20181" and r["consolidacao"]["selo_confianca"] == "confirmado"
    assert r["verificacao"]["esmo_mcbs"]["valor_rederivado"] == "3" and r["afirmado_protocolo"]["esmo_mcbs"] == "3"
    # referência: mesmo DOI, metadados/verificação atualizados (o card citava o JAMA 2023 mas descrevia o PFS do Nat Med 2021)
    r["referencia"] = ref_verificada("10.1001/jama.2023.20181", nota="Mesmo DOI do card; verificação e descrição atualizadas para a análise final de SG (o card descrevia só a SLP da análise interina).")
    r["beneficio"] = OrderedDict([("desfecho_principal", "↑ sobrevida global e livre de progressão (1ª linha, nasofaringe R/M)"),
        ("magnitude", "JUPITER-02 (análise final, seguimento 36 m): OS HR 0,63 (IC95% 0,45–0,89; p=0,008), mediana NR vs 33,7 m; OS 3 anos 64,5% vs 49,2%; PFS 21,4 vs 8,2 m (HR 0,52). ESMO-MCBS 4 (scorecard 354)."),
        ("fonte", "10.1001/jama.2023.20181")])
    r["verificacao"]["grade"].update(status="re_derivado", valor_rederivado="1A",
        justificativa="JUPITER-02 (Mai 2023, JAMA; PMID 38015220): fase 3 duplo-cego, " + ABSTRACT["JUPITER-02"] + " Ganho de OS estatisticamente significativo e clinicamente relevante, consistente por PD-L1 → certeza alta, recomendação forte para a EFICÁCIA. A não inclusão institucional NÃO é por evidência: é por custo/política (ver incorporacao).",
        fonte="https://doi.org/10.1001/jama.2023.20181")
    r["verificacao"]["esmo_mcbs"].update(status="diverge", valor_rederivado="4", afirmado_protocolo="3",
        justificativa="Protocolo afirma ESMO-MCBS 3 (derivado da SLP interina do Nat Med 2021). Re-derivação pela análise final de SG (JAMA 2023) e pelo scorecard OFICIAL da ESMO: " + ABSTRACT["ESMO-MCBS-354"] + " → 4. DIVERGE do protocolo (3); o revisor (16/09) aponta o mesmo.",
        fonte="https://www.esmo.org/guidelines/esmo-mcbs/esmo-mcbs-for-solid-tumours/esmo-mcbs-scorecards/scorecard-354-1")
    r["verificacao"]["nccn_affordability"].update(justificativa="Toripalimabe de custo alto; benefício de OS relevante (MCBS 4) — a razão de não inclusão passa a ser custo/impacto orçamentário, não magnitude do benefício. Affordability baixa (estimativa). Registro Anvisa: " + ABSTRACT["ANVISA-toripalimabe"],
        flag_contexto_br="Registrado na Anvisa (Zytorvi, RE 3.085, 06/08/2026); não incluído pelo protocolo institucional (custo).")
    e = r["verificacao"]["elegibilidade"]
    e["divergencia_vs_protocolo"] = "Regra (nasofaringe ∧ metastático) coincide com a população do JUPITER-02 (R/M sem QT prévia no cenário R/M; benefício independente de PD-L1). O texto do protocolo diz 'PD-L1+' — o ensaio não selecionou por PD-L1 (a regra do card já não exige)."
    e["justificativa"] = "Concorda com a população do ensaio; a não inclusão é institucional (custo), não de elegibilidade."
    e["rederivado_em"] = HOJE; e["rederivado_por"] = "intake-lote4:verificador-elegibilidade"
    r["incorporacao"] = OrderedDict([
        ("status", "nao_incorporado"), ("motivo", "custo"),
        ("motivo_publico", "politica_institucional"),
        ("alcada_motivo", ["gestor", "revisor", "auditor", "admin"]),
        ("texto_publico", "Protocolo avaliado e não incorporado por política institucional. Evidência: JUPITER-02 (fase 3) com ganho de sobrevida global; ESMO-MCBS 4; registrado na Anvisa (08/2026)."),
        ("nota_revisao", "Não incluído por custo/impacto orçamentário (ESMO-MCBS 4; OS HR 0,63 no JUPITER-02; registro Anvisa RE 3.085, 06/08/2026). O revisor pede discussão: 'medicação já aprovada no Brasil; discutir devido a custo caro'. Incorporação = decisão de política (Gustavo Couto + revisor + direção), fora desta rodada."),
        ("revisor", d["revisor"]), ("data", d["data"]),
        ("decisao_humana", "D1 — caminho A (Gustavo Couto, 2026-09-17): manter fora; card atualizado; caminho B (incorporar) fora de rodada"),
        ("citacao_verificada", OrderedDict([("estudo", v["estudo"]), ("doi", "10.1001/jama.2023.20181"), ("pmid", v["pmid"]), ("citacao", v["citacao"]), ("verificado_em", HOJE)])),
        ("regulatorio_br", ABSTRACT["ANVISA-toripalimabe"]),
        ("esmo_mcbs_oficial", ABSTRACT["ESMO-MCBS-354"]),
    ])
    for lst in (r["consolidacao"]["flags"], r["flags"]):
        lst[:] = [f for f in lst if not str(f).startswith("nao_incluido")]
        lst.insert(0, "nao_incluido: custo/política institucional (registro Anvisa 08/2026; ESMO-MCBS 4; OS positiva no JUPITER-02) — motivo detalhado visível por alçada")
    set_flag(r, "evidencia_atualizada: JUPITER-02 análise final (JAMA 2023) — OS HR 0,63; ESMO-MCBS oficial 4 (scorecard 354, 07/2025); motivo 'MCBS 3 / benefício modesto' ficou desatualizado")
    set_flag(r, "regulatorio_br: Zytorvi (toripalimabe) registrado na Anvisa — RE 3.085, DOU 06/08/2026 (Dr. Reddy's)")
    set_flag(r, "divergencia_revisor:esmo_mcbs — protocolo 3 × ESMO oficial 4 (revisor concorda com 4); mantida visível para o Portão C")
    r["consolidacao"]["decisao_revisao"] = "rederivado_aguarda_revisao"
    anotar(r, d, "rederivado_aguarda_revisao",
           nota_squad=("Contradição interna do parecer (ação refutar = manter fora × texto 'não colocar como não incorporada / discutir') resolvida por DECISÃO HUMANA D1 (Gustavo Couto, 17/09): caminho A — o card fica FORA (não incorporado), mas passa a dizer a verdade: JUPITER-02 final com OS positiva (números do revisor CONFEREM: HR 0,63, IC 0,45–0,89, p=0,008; taxas 1/2/3 anos conferidas no corpo do artigo), ESMO-MCBS oficial 4 (scorecard 354 — o revisor está certo), registro Anvisa (RE 3.085, 06/08/2026). "
                       "Eixo ESMO-MCBS re-derivado 4 e marcado DIVERGE do protocolo (3); selo confirmado→divergencia; hash muda (parecer expira pela execução). Motivo de não inclusão = custo/política, visível por alçada (clínico vê 'política institucional'; gestor/revisor/auditor/admin veem o motivo). "
                       "Caminho B (incorporar: regime novo + código de app) fica para decisão do Gustavo + revisor + direção, fora desta rodada."))
    selo = selo_por_eixos(r); assert selo == "divergencia" and r["consolidacao"]["eixos_diverge"] == ["esmo_mcbs"], (selo, r["consolidacao"]["eixos_diverge"])
    hist(r, "intake-lote4:refutar→manter_fora+atualizar (D1 caminho A)", "Card atualizado para a análise final do JUPITER-02 (OS), ESMO-MCBS oficial 4 (diverge do protocolo 3), registro Anvisa 08/2026 e motivo custo/política por alçada; permanece não incorporado por decisão humana D1; eixos GRADE/ESMO/elegibilidade re-derivados; selo confirmado→divergencia.", ["grade", "esmo_mcbs", "elegibilidade"], "10.1001/jama.2023.20181")
    TRIAGEM.append(OrderedDict([("regimen_id", r["regimen_id"]), ("acao", d["acao"]), ("balde_proposto", "caminho A: manter fora + atualizar card (MCBS 4 diverge; motivo custo/política por alçada)"), ("resolvida_por", DECISOR_HUMANO + " — D1"),
                                ("motivo", "contradição interna (refutar × justificativa pró-incorporação); incorporação é decisão de política, fora de rodada")]))
    RE_REVISAO.append(OrderedDict([("regimen_id", r["regimen_id"]), ("item", "incorporacao_toripalimabe_politica"),
        ("descricao", "Card corrigido (OS final, MCBS 4, Anvisa) e mantido não incorporado por custo/política (D1-A). Pedido de incorporação ('não colocar como não incorporada') é decisão do Gustavo Couto + revisor + direção — caminho B pronto no PLANO-lote4.md §4 (regime novo cp-naso-met-1l-toripalimabe-gp + destino do card atual + código de app). Portão C: confirmar MCBS 4 × protocolo 3."),
        ("status", "aberto"), ("data", HOJE)]))
    AMOSTRA_EXEC.append(OrderedDict([("regimen_id", r["regimen_id"]), ("acao", "refutar → caminho A"), ("texto_revisor", d["justificativa"]), ("nota_gravada", r["consolidacao"]["notas_revisao"][-1]), ("flag_gravada", "nao_incluido: custo/política institucional …")]))
    registrar(d, "executado_com_ressalva", "D1 caminho A: mantido fora; eixos re-derivados (MCBS 4 diverge); motivo custo/política por alçada; incorporação → decisão de política")
    decisao_humana("D1", r["regimen_id"], "caminho A (manter fora; card atualizado com MCBS 4, JUPITER-02 final e Anvisa; motivo por alçada); caminho B fora de rodada", "hash muda; selo confirmado→divergencia; app: rótulo público por perfil (incorporacao.motivo_publico/alcada_motivo)")
    decisao_humana("D7", None, "salivar no mesmo run, script separado (intake-salivar.py), depois deste", "+3 regimes; vocabulário cabeca-pescoco")

    # =========================== 8. CONSEQUÊNCIAS ===========================
    hashes_depois = {r["regimen_id"]: content_hash(r) for r in regimes}
    rehash = []
    for rid in D:
        rehash.append(OrderedDict([("regimen_id", rid), ("content_hash_antes", hashes_antes[rid]), ("content_hash_depois", hashes_depois[rid]), ("mudou", hashes_antes[rid] != hashes_depois[rid])]))
    mudaram = {x["regimen_id"] for x in rehash if x["mudou"]}
    assert mudaram == {"colo-qrt-io-keynote-a18", "mama-adj-her2neg-carbo-paclitaxel", "mama-neo-her2pos-ct1c-tch", "cp-naso-toripalimabe-nao-incluido"}, mudaram
    for rid, h in hashes_antes.items():
        if rid not in D:
            assert hashes_depois[rid] == h, f"hash mudou fora do lote: {rid}"
    expirados = []
    for x in dec_all:
        h_novo = hashes_depois.get(x["regimen_id"])
        if h_novo and x["content_hash"] != h_novo and x["hash_atual"] == x["content_hash"]:
            expirados.append(OrderedDict([("regimen_id", x["regimen_id"]), ("decisao", x["decisao"]), ("acao", x["acao"]), ("data", x["data"]), ("content_hash_parecer", x["content_hash"]), ("hash_novo", h_novo)]))
    assert any(x["regimen_id"] == "mama-adj-her2neg-carbo-paclitaxel" and x["decisao"] == "aprovado" for x in expirados)   # D4: ciente
    ja_expirados = sorted({x["regimen_id"] for x in dec_all if x["hash_atual"] != x["content_hash"]})

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
    meta["titulo"] = "Protocolos de Oncologia 2025 — consolidado + intake revisão lote 4 (export 17/09/2026: 9 pareceres de 16/09) (re-run 2026-07-22, 25 tumores)"
    meta["gerado_em"] = HOJE
    meta["total_tumores"] = len(por_tumor)
    meta["total_regimes"] = len(regimes)
    meta["distribuicao_selo"] = dict(placar)
    meta["por_tumor"] = por_tumor
    meta["politica"] = meta_ant.get("politica")
    meta["substitui"] = ORIGEM_RUN
    meta["publicacao"] = "NÃO publicado: RUN_ATIVO intocado; aguarda intake-salivar.py neste run, Portão A (--check-dois) com caminho e comando humano (sexta 2026-09-18, pós-demo). Só então: RUN_ATIVO, build-data, restart, Portão A/B, migration de aplicada_em (backend-pendente/), deploy backend + app (rótulo por alçada)."
    meta["revisao_humana"] = OrderedDict([
        ("lote", LOTE), ("status", "aplicada"), ("data", HOJE), ("decidido_por", REVISOR), ("arquivo", "revisao-decisoes.json"),
        ("decisoes_humanas", DECISOES_HUMANAS),
        ("politica_abstract_congresso", POLITICA_ABSTRACT),
        ("reconciliacao", OrderedDict([("pulmao_fase_a", OrderedDict([("decisoes", len(pulmao)), ("nota", "6 pareceres ajustar_elegibilidade de 16/09 já aplicados (aplicada_em 2026-09-16, run drivers-pulmao) — conferidos no corpus, nada re-executado")])),
                                        ("dostarlimabe_mss", "triagem do lote 3 (14/09) segue sem resposta do revisor neste export — intocada")])),
        ("decisoes_lote", len(novos)), ("aprovados_registrados", len(aprovados)), ("aprovados_decisao_revisao_flip", flip),
        ("placar_por_acao", [OrderedDict([("acao", a), ("total", n), ("status", dict(Counter(x["status"] for x in RESULTADO if x["acao"] == a)))])
                             for a, n in Counter(x["acao"] for x in RESULTADO).items()]),
        ("resultado", RESULTADO),
        ("triagem_manual", TRIAGEM),
        ("refutados", []),
        ("excluidos", []),
        ("regimes_novos", []),
        ("referencias_verificadas", [OrderedDict([("doi", k), ("congruente", v["ok"]), ("primeiro_autor", v["primeiro_autor"]), ("ano", v["ano"]), ("estudo", v["estudo"]), ("tema", v["tema"]), ("tipo_publicacao", v.get("tipo_publicacao", "artigo"))]) for k, v in VERIFICADAS.items()]),
        ("primitivos_novos", []),
        ("primitivos_desenhados_nao_aplicados", [OrderedDict([("tumor", "cabeca-pescoco"), ("campo", "clearance_creatinina"), ("tipo", "numero"), ("label", "Clearance de creatinina (mL/min, Cockcroft-Gault)"), ("secao", "Laboratório")]),
                                                 OrderedDict([("tumor", "cabeca-pescoco"), ("campo", "perda_auditiva_clinica"), ("tipo", "boolean"), ("label", "Perda auditiva (aparelho auditivo ou queda ≥25 dB em 2 frequências contíguas)"), ("secao", "Critérios de elegibilidade")]),
                                                 OrderedDict([("tumor", "cabeca-pescoco"), ("campo", "neuropatia_grau"), ("tipo", "ordinal"), ("label", "Neuropatia periférica (grau CTCAE 0–4)"), ("secao", "Critérios de elegibilidade"), ("opcoes", [0, 1, 2, 3, 4])])]),
        ("elegibilidade_resultado", ELEG_RESULTADO),
        ("rehash", rehash),
        ("pareceres_expirados", expirados),
        ("pareceres_ja_expirados_antes_do_lote", ja_expirados),
        ("re_revisao", RE_REVISAO),
        ("vigilancia", VIGILANCIA),
        ("app_pendencias", ["incorporacao.motivo_publico / alcada_motivo / texto_publico (toripalimabe): a app precisa mostrar o rótulo público fora da alçada — código de app deste lote (incorporacao(), incPillHtml, confirmarSeNaoIncorporado)",
                            "consolidacao.referencias_complementares[] (tipo abstract_congresso) segue sem renderização dedicada — flag evidencia_emergente é o que aparece",
                            "verificacao.esmo_mcbs.status='diverge' com afirmado_protocolo 3 × re-derivado 4 (toripalimabe) renderiza como 'diverge' — ok"]),
    ])
    meta["revisao_humana_lotes_anteriores"] = lotes_ant
    for k, vv in meta_ant.items():
        if k not in meta:
            meta[k] = vv
    data["meta"] = meta
    data["regimes"] = regimes
    with open(AGG, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)

    # fatias por tumor: regimes IDÊNTICOS ao agregado (check [8]); vocabulário regravado (labels de colo-utero ajustados; sem primitivo novo)
    for t, campos in vocab.items():
        f = os.path.join(AQUI, t, "v1", "regimes-consolidados.json")
        pt = json.load(open(f, encoding="utf-8"), object_pairs_hook=OrderedDict)
        rs = [r for r in regimes if r["tumor"] == t]
        pt["meta"]["gerado_em"] = HOJE
        pt["meta"]["total_regimes"] = len(rs)
        pt["meta"]["distribuicao_selo"] = dict(Counter(r["consolidacao"]["selo_confianca"] for r in rs))
        pt["meta"]["derivado_de"] = f"{ESTE_RUN} (agregado; lote 4 de revisão)"
        pt["meta"]["revisao_humana"] = OrderedDict([("status", "lote 4 aplicado"), ("data", HOJE)])
        pt["campos_primitivos"] = campos
        pt["regimes"] = rs
        with open(f, "w", encoding="utf-8") as fh:
            json.dump(pt, fh, ensure_ascii=False, indent=2)

    with open(os.path.join(AQUI, "content-hashes.json"), "w", encoding="utf-8") as fh:
        json.dump({"gerado_em": HOJE, "run": ESTE_RUN, "hashes": hashes_depois}, fh, ensure_ascii=False, indent=0)

    random.seed(20260917)
    amostra = random.sample(AMOSTRA_EXEC, 3)
    relatorio = OrderedDict([
        ("decisoes_humanas", DECISOES_HUMANAS), ("politica_abstract_congresso", POLITICA_ABSTRACT),
        ("placar_por_acao", meta["revisao_humana"]["placar_por_acao"]), ("resultado", RESULTADO), ("triagem_manual", TRIAGEM),
        ("pareceres_expirados", expirados), ("ja_expirados_antes", ja_expirados),
        ("amostra_sorteada", amostra), ("re_revisao", RE_REVISAO), ("vigilancia", VIGILANCIA),
        ("elegibilidade_resultado", ELEG_RESULTADO), ("rehash", rehash),
        ("placar_selo", dict(placar)), ("total_regimes", len(regimes)),
        ("hashes_mudaram", sorted(mudaram)), ("aprovados", len(aprovados)), ("aprovados_decisao_revisao_flip", flip),
        ("selos_que_mudaram", [OrderedDict([("regimen_id", "mama-adj-her2neg-carbo-paclitaxel"), ("de", "divergencia"), ("para", "re_derivado")]),
                               OrderedDict([("regimen_id", "cp-naso-toripalimabe-nao-incluido"), ("de", "confirmado"), ("para", "divergencia")])]),
        ("referencias_verificadas", meta["revisao_humana"]["referencias_verificadas"]),
        ("abstracts_lidos", ABSTRACT),
    ])
    with open(os.path.join(AQUI, "relatorio-intake-lote4.json"), "w", encoding="utf-8") as fh:
        json.dump(relatorio, fh, ensure_ascii=False, indent=2)
    print(json.dumps(OrderedDict([("total_regimes", len(regimes)), ("placar_selo", dict(placar)), ("hashes_mudaram", sorted(mudaram)),
                                  ("pareceres_expirados", [(x["regimen_id"], x["decisao"], x["data"]) for x in expirados]),
                                  ("resultado", [(x["regimen_id"], x["status"]) for x in RESULTADO]), ("re_revisao", [x["item"] for x in RE_REVISAO])]), ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
