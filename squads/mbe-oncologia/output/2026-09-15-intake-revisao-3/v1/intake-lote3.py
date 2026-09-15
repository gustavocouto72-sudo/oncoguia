#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
INTAKE REVISÃO — LOTE 3 (export revisao-decisoes de 15/09/2026: 65 aprovados + 8 novos de
14/09 + as duas pendências de 16/08 pedidas duas vezes).

Roda SOBRE ESTE RUN (2026-09-15-intake-revisao-3/v1), que nasceu como cópia do run ativo
(2026-09-13-intake-revisao-2/v1). RUN_ATIVO não é tocado: publicar é decisão humana, depois
do portão E depois de a frente da secretária liberar o backend. O script roda UMA vez sobre
a cópia limpa; se precisar refazer, copie o run ativo de novo.

O que este lote NÃO faz (reconciliação, passo 0 do briefing): as 27 decisões de 12–13/09
(17 em triada_pendente_execucao + 10 em aguardando_re_revisao) já foram executadas no lote
2 e conferidas no corpus ativo (hash, nota, histórico, prova por ação) — nada é re-executado.
A marcação de aplicada_em fica pronta em backend-pendente/ e só entra quando o backend
estiver livre.

Regras aplicadas (todas do briefing):
  • conservador — nada inventado; fonte declarada; referência nova só VERIFICADA (Crossref +
    PubMed, transcrição do que o registro devolveu — ver VERIFICADAS);
  • manter_anotar não muda dado (hash intacto): nota do revisor visível no card;
  • contradição interna (dostarlimabe MSS) NÃO é implementada em nenhum lado: triagem_manual
    com a pergunta objetiva para o revisor;
  • pedido que não fecha em regra computável sem o squad escolher por conta própria vira
    indeterminado com nota (fragilidade em HT isolada);
  • divergência de MCBS (ASCENT: revisor 5 × squad 4) NÃO se resolve sobrescrevendo — fica
    visível como diverge para o Portão C;
  • hash muda só onde a mudança é de propósito (ASCENT: eixo elegibilidade re-derivado); os
    pareceres que expiram são reportados, não suprimidos.
"""
import json, os, sys, copy, importlib.util, random
from collections import Counter, OrderedDict

AQUI = os.path.dirname(os.path.abspath(__file__))
SQUAD = os.path.abspath(os.path.join(AQUI, "..", "..", ".."))
RAIZ = os.path.abspath(os.path.join(SQUAD, "..", ".."))
AGG = os.path.join(AQUI, "regimes-consolidados.json")
EXPORT = os.path.join(AQUI, "revisao-decisoes.json")
HOJE = "2026-09-15"
LOTE = 3
REVISOR = "Gustavo Drummond Pinho Ribeiro"
ORIGEM_RUN = "2026-09-13-intake-revisao-2/v1"
ESTE_RUN = "2026-09-15-intake-revisao-3/v1"

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
# Referências verificadas ANTES de rodar (Crossref works/<doi> + PubMed esearch/efetch,
# 2026-09-15). Transcrição do que o registro devolveu — não do que se esperava.
# ---------------------------------------------------------------------------
VERIFICADAS = {
    "10.1056/NEJMoa2502099": dict(
        ok=True, pmid="40454646", primeiro_autor="Mountzios", ano=2025, estudo="DeLLphi-304",
        citacao="MOUNTZIOS G, Sun L, Cho BC, et al; DeLLphi-304 Investigators. Tarlatamab in Small-Cell Lung Cancer after Platinum-Based Chemotherapy. N Engl J Med. 2025;393(4):349-361.",
        tema="tarlatamabe vs quimioterapia (topotecano, lurbinectedina ou amrubicina) em 2ª linha de SCLC após platina — fase 3 aberto, n=509, desfecho primário SG"),
    "10.1200/JCO.2000.18.22.3758": dict(
        ok=True, pmid="11078488", primeiro_autor="Nabholtz", ano=2000, estudo="Arimidex Study Group — North American trial (anastrozol vs tamoxifeno, 1ª linha)",
        citacao="NABHOLTZ JM, Buzdar A, Pollak M, et al. Anastrozole is superior to tamoxifen as first-line therapy for advanced breast cancer in postmenopausal women: results of a North American multicenter randomized trial. J Clin Oncol. 2000;18(22):3758-3767.",
        tema="anastrozol 1 mg/dia vs tamoxifeno 20 mg/dia, 1ª linha, pós-menopausa, RH+ ou desconhecido — RCT duplo-cego, n=353"),
    "10.1200/JCO.2000.18.22.3748": dict(
        ok=True, pmid="11078487", primeiro_autor="Bonneterre", ano=2000, estudo="TARGET (anastrozol vs tamoxifeno, 1ª linha)",
        citacao="BONNETERRE J, Thürlimann B, Robertson JF, et al. Anastrozole versus tamoxifen as first-line therapy for advanced breast cancer in 668 postmenopausal women: results of the Tamoxifen or Arimidex Randomized Group Efficacy and Tolerability study. J Clin Oncol. 2000;18(22):3748-3757.",
        tema="anastrozol 1 mg/dia vs tamoxifeno 20 mg/dia, 1ª linha, pós-menopausa — RCT duplo-cego, n=668"),
    "10.1200/JCO.2001.19.10.2596": dict(
        ok=True, pmid="11352951", primeiro_autor="Mouridsen", ano=2001, estudo="P025 / International Letrozole Breast Cancer Group (letrozol vs tamoxifeno, 1ª linha)",
        citacao="MOURIDSEN H, Gershanovich M, Sun Y, et al. Superior efficacy of letrozole versus tamoxifen as first-line therapy for postmenopausal women with advanced breast cancer: results of a phase III study of the International Letrozole Breast Cancer Group. J Clin Oncol. 2001;19(10):2596-2606.",
        tema="letrozol 2,5 mg/dia vs tamoxifeno 20 mg/dia, 1ª linha, pós-menopausa, RH+ ou desconhecido — RCT fase 3, n=907, desfecho primário TTP"),
    "10.1200/JCO.2003.04.194": dict(
        ok=True, pmid="12775735", primeiro_autor="Mouridsen", ano=2003, estudo="P025 — atualização de eficácia e sobrevida",
        citacao="MOURIDSEN H, Gershanovich M, Sun Y, et al. Phase III study of letrozole versus tamoxifen as first-line therapy of advanced breast cancer in postmenopausal women: analysis of survival and update of efficacy from the International Letrozole Breast Cancer Group. J Clin Oncol. 2003;21(11):2101-2109.",
        tema="atualização (seguimento mediano 32 meses; n=916): TTP 9,4 vs 6,0 meses; SG mediana 34 vs 30 meses (não significativa; ~50% de cross-over)"),
    "10.1200/JCO.2007.14.4659": dict(
        ok=True, pmid="18794551", primeiro_autor="Paridaens", ano=2008, estudo="EORTC 10951 (exemestano vs tamoxifeno, 1ª linha)",
        citacao="PARIDAENS RJ, Dirix LY, Beex LV, et al. Phase III study comparing exemestane with tamoxifen as first-line hormonal treatment of metastatic breast cancer in postmenopausal women: the European Organisation for Research and Treatment of Cancer Breast Cancer Cooperative Group. J Clin Oncol. 2008;26(30):4883-4890.",
        tema="exemestano 25 mg/dia vs tamoxifeno 20 mg/dia, 1ª linha hormonal, pós-menopausa, doença hormônio-sensível — RCT fase 3 aberto, n=371, desfecho primário PFS"),
    "10.1093/jnci/djj357": dict(
        ok=True, pmid="16985247", primeiro_autor="Mauri", ano=2006, estudo="Mauri 2006 (metanálise IA/inativadores vs HT padrão em doença avançada)",
        citacao="MAURI D, Pavlidis N, Polyzos NP, Ioannidis JP. Survival with aromatase inhibitors and inactivators versus standard hormonal therapy in advanced breast cancer: meta-analysis. J Natl Cancer Inst. 2006;98(18):1285-1291.",
        tema="25 comparações, n=8.504: IA de 3ª geração vs HT padrão (tamoxifeno/progestágenos) — SG RH 0,87 (IC95% 0,82–0,93); em 1ª linha vs tamoxifeno, redução de 11% (IC 1–19%)"),
    "10.1200/JCO.2025.43.16_suppl.5601": dict(
        ok=True, pmid=None, primeiro_autor="Mathews", ano=2025, estudo="RUBY — TFST/TSST (ASCO 2025, abstract 5601)",
        citacao="MATHEWS CA, et al. Time to subsequent therapy in patients with primary advanced or recurrent endometrial cancer receiving dostarlimab plus carboplatin-paclitaxel compared with placebo plus CP in the ENGOT-EN6-NSGO/GOG-3031/RUBY trial. J Clin Oncol. 2025;43(16_suppl):5601 (ASCO Annual Meeting 2025).",
        tema="análise post hoc do RUBY (2º interino, corte 22/09/2023): TFST e TSST no geral, dMMR/MSI-H e MMRp/MSS — em MMRp/MSS, TFST mediana 2,5 meses maior e TSST 8,1 meses maior com dostarlimabe; HRs consistentes entre TFST e TSST"),
    "10.1530/ERC-15-0075": dict(
        ok=True, pmid=None, primeiro_autor="Hadoux", ano=2015, estudo="Hadoux 2015 (FOLFOX pós-1ª linha em NEC G3)",
        citacao="HADOUX J, et al. Post-first-line FOLFOX chemotherapy for grade 3 neuroendocrine carcinoma. Endocr Relat Cancer. 2015.",
        tema="série retrospectiva de FOLFOX após 1ª linha em carcinoma neuroendócrino G3 (citada pelo revisor; DOI resolve no Crossref — abstract não conferido nesta rodada)"),
}
# Lidas dos abstracts (PubMed efetch, 2026-09-15) — números usados nas derivações abaixo.
ABSTRACT = {
    "DeLLphi-304": "n=509 (254 tarlatamabe, 255 QT: topotecano, lurbinectedina ou amrubicina), 2ª linha após progressão durante/depois de platina; análise interina pré-especificada (corte 29/01/2025): SG mediana 13,6 (IC95% 11,1–NA) vs 8,3 meses (7,0–10,2), HR estratificado 0,60 (IC95% 0,47–0,77; p<0,001); benefício significativo em PFS e em dispneia/tosse relacionadas ao câncer; EA grau ≥3 54% vs 80%; descontinuação por EA 5% vs 12%.",
    "Nabholtz2000": "n=353, duplo-cego, anastrozol 1 mg vs tamoxifeno 20 mg 1x/dia; RO 21% vs 17%; benefício clínico 59% vs 46% (p=0,0098, retrospectivo); TTP mediana 11,1 vs 5,6 meses (p=0,005); HR tamoxifeno:anastrozol 1,44 (limite inferior unilateral IC95% 1,16); menos tromboembolismo (4,1% vs 8,2%) e sangramento vaginal com anastrozol.",
    "Bonneterre2000": "n=668 (340 anastrozol, 328 tamoxifeno), duplo-cego, seguimento mediano 19 meses; TTP mediana 8,2 vs 8,3 meses; HR tamoxifeno:anastrozol 0,99 (limite inferior 0,86) — equivalência; RO 32,9% vs 32,6%; benefício clínico 56,2% vs 55,5%; menos tromboembolismo (4,8% vs 7,3%) e sangramento vaginal com anastrozol.",
    "Mouridsen2001": "n=907 (453 letrozol 2,5 mg, 454 tamoxifeno 20 mg), RH+ ou desconhecido; excluída recidiva durante/≤12 meses de antiestrogênio adjuvante e HT prévia para doença avançada; 1 QT prévia para doença metastática permitida; TTP mediana 41 vs 26 semanas, HR 0,70 (IC95% 0,60–0,82; p=0,0001); TTF 40 vs 25 semanas; RO 30% vs 20% (p=0,0006); benefício clínico 49% vs 38%.",
    "Mouridsen2003": "n=916, seguimento mediano 32 meses: TTP 9,4 vs 6,0 meses (p<0,0001); TTF 9 vs 5,7 meses; RO 32% vs 21%; SG mediana 34 vs 30 meses (não significativa; ~metade cruzou de braço); tempo até quimioterapia 16 vs 9 meses (p=0,005); tempo até piora do Karnofsky retardado com letrozol (p=0,001).",
    "Paridaens2008": "n=371 (182 exemestano 25 mg, 189 tamoxifeno 20 mg), aberto, pós-menopausa, doença hormônio-sensível metastática/localmente avançada; 1 QT prévia permitida, sem HT prévia para doença avançada; RO 46% vs 31% (OR 1,85; p=0,005); PFS mediana 9,9 (IC95% 8,7–11,8) vs 5,8 meses (5,3–8,1) — diferença precoce (Wilcoxon p=0,028) NÃO sustentada no desfecho primário (log-rank p=0,121); sem diferença de SG.",
    "Mauri2006": "25 comparações, n=8.504; IA/inativadores de 3ª geração vs HT padrão: SG RH 0,87 (IC95% 0,82–0,93; p<0,001); em ensaios de 1ª linha vs tamoxifeno, redução de 11% no risco (IC95% 1–19%; p=0,03).",
    "RUBY-TFST": "n=494 (118 dMMR/MSI-H; 376 MMRp/MSS); TFST mediana 5,1 (geral) e 2,5 meses (MMRp/MSS) maior com dostarlimabe+CP; TSST 11,4 (geral) e 8,1 meses (MMRp/MSS) maior; HRs a favor de dostarlimabe consistentes entre TFST e TSST em todas as populações.",
}

# ---------------------------------------------------------------------------
# helpers (mesmos do lote 2)
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
    """Nota do revisor no card (consolidacao.notas_revisao — a app renderiza) + registro estruturado."""
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
        ("verificacao", OrderedDict([("registro", "Crossref + PubMed"), ("data", HOJE), ("congruente", True), ("tema", v["tema"])]))])
    if pivos:
        d["pivos"] = pivos
    if nota:
        d["nota"] = nota
    return d

def ref_complementar(doi, papel):
    v = VERIFICADAS[doi]; assert v["ok"], doi
    return OrderedDict([("estudo", v["estudo"]), ("doi", doi), ("pmid", v["pmid"]), ("citacao", v["citacao"]),
                        ("papel", papel), ("verificado_em", HOJE)])

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

RESULTADO = []          # placar por decisão
ELEG_RESULTADO = []     # antes/depois das regras
RE_REVISAO = []         # pendências abertas para o revisor
TRIAGEM = []            # triagem_manual
AMOSTRA_EXEC = []       # (regimen_id, texto do revisor, nota gravada) — amostra sorteada sai daqui

def registrar(dec, status, nota=None, **kw):
    d = OrderedDict([("regimen_id", dec["regimen_id"]), ("data_decisao", dec["data"]), ("acao", dec["acao"]), ("status", status), ("nota", nota)])
    d.update(kw); RESULTADO.append(d)

# ---------------------------------------------------------------------------
# Regime novo de hormonioterapia isolada de 1ª linha (pendência de 16/08, ht-isolada)
# ---------------------------------------------------------------------------
def novo_ht(rid, farmaco, dose_txt, doi_principal, pivos, grade_valor, grade_just, beneficio_desfecho, beneficio_mag,
            toxicidades, exige_pos_menopausa, expectativa, esmo_just, dec, notas_extra, amplitude, amplitude_nota, flags_extra):
    novo = OrderedDict()
    novo["regimen_id"] = rid
    novo["tumor"] = "mama"; novo["cenario"] = "metastatico"
    novo["subtipo"] = "HR+ / HER2 negativo — 1ª linha (hormonioterapia isolada; opção acrescida pelo revisor)"
    novo["nome"] = f"{farmaco} isolado — 1ª linha (sem iCDK4/6)"
    novo["esquema"] = f"{farmaco} {dose_txt} VO 1x/dia, contínuo até progressão ou toxicidade inaceitável (dose do estudo-pivô)"
    novo["farmacos"] = [OrderedDict([("nome", farmaco), ("dose", dose_txt), ("via", "VO"), ("frequencia", "1x/dia, contínuo")])]
    novo["elegibilidade_protocolo"] = ("O protocolo institucional traz só o card genérico 'Hormonioterapia isolada (IA ou fulvestranto)' com "
        "'considerar em situações de contraindicação à associação com inibidores de ciclina'. Esta opção individualizada foi acrescida por decisão "
        "do revisor (parecer de 2026-08-16, executado no lote 3): as hormonioterapias de 1ª linha da era pré-iCDK4/6 (anastrozol, letrozol, "
        "exemestano, tamoxifeno), hoje para pacientes frágeis ou com contraindicação a iCDK4/6.")
    regra_and = [{"eq": ["cenario", "metastatico"]}, {"eq": ["rh", "positivo"]}, {"eq": ["her2", "negativo"]}, {"eq": ["contraindicacao_icdk46", True]}]
    incl = [crit("cenario", "=", "metastatico"), crit("rh", "=", "positivo"), crit("her2", "=", "negativo"), crit("contraindicacao_icdk46", "=", True)]
    if exige_pos_menopausa:
        regra_and.append({"eq": ["menopausa", "pos"]}); incl.append(crit("menopausa", "=", "pos"))
    novo["elegibilidade"] = OrderedDict([("criterios", []), ("regra", {"and": regra_and})])
    novo["referencia"] = ref_verificada(doi_principal, pivos=pivos)
    novo["afirmado_protocolo"] = OrderedDict([("grade", None), ("esmo_mcbs", None), ("nccn_affordability", None)])
    novo["beneficio"] = OrderedDict([("desfecho_principal", beneficio_desfecho), ("magnitude", beneficio_mag), ("fonte", doi_principal)])
    novo["toxicidades"] = toxicidades
    novo["verificacao"] = OrderedDict([
        ("grade", OrderedDict([("status", "re_derivado"), ("valor_rederivado", grade_valor), ("afirmado_protocolo", None),
            ("justificativa", grade_just), ("fonte", "https://doi.org/" + doi_principal)])),
        ("esmo_mcbs", OrderedDict([("status", "indeterminado"), ("valor_rederivado", "n/a"), ("afirmado_protocolo", None),
            ("formulario", "nao-curativo (5/4/3/2/1)"),
            ("justificativa", esmo_just), ("fonte", "https://doi.org/" + doi_principal)])),
        ("nccn_affordability", OrderedDict([("status", "estimativa"), ("valor_rederivado", 5), ("afirmado_protocolo", None),
            ("justificativa", f"{farmaco} oral genérico, de custo mínimo; sem administração hospitalar; suporte mínimo. Affordability máxima."),
            ("flag_contexto_br", "Disponível no SUS; sem barreira de acesso relevante no Brasil."),
            ("fonte", "PCDT Câncer de Mama / estimativa qualitativa")])),
        ("elegibilidade", OrderedDict([("status", "re_derivado"),
            ("criterios_inclusao", incl), ("criterios_exclusao", []), ("amplitude", amplitude),
            ("divergencia_vs_protocolo", amplitude_nota),
            ("justificativa", "Derivado do texto do revisor ('frágeis ou com contraindicação a iCDK4/6') confrontado com a população dos pivôs. "
                              "Computável: contraindicacao_icdk46=true (primitivo existente). NÃO computável: 'fragilidade' — o revisor não definiu "
                              "(sem primitivo, sem corte de ECOG/idade derivável); fica INDETERMINADA com nota, em vez de o squad escolher um corte. "
                              "Paciente frágil sem contraindicação formal aparece como inelegível na app — a seleção confirma com ressalva (política: botão nunca escondido)."),
            ("fonte", "https://doi.org/" + doi_principal), ("rederivado_em", HOJE), ("rederivado_por", "intake-lote3:verificador-elegibilidade")])),
    ])
    flags = ["regime_acrescido_pelo_revisor: não consta como opção individualizada do protocolo institucional (parecer 2026-08-16; lote 3, 2026-09-15)",
             "elegibilidade:parcialmente_computavel — 'fragilidade' (revisor) sem primitivo nem definição; só contraindicacao_icdk46 virou regra",
             "esmo_mcbs_nao_graduado: ensaio anterior à escala ESMO-MCBS, sem scorecard publicado — nota deixada ao revisor (números do pivô transcritos)"] + flags_extra
    novo["consolidacao"] = OrderedDict([
        ("status", "incompleto"), ("selo_confianca", "incompleto"), ("eixos_diverge", []), ("lacunas", ["esmo_mcbs_nao_graduado"]),
        ("flags", flags),
        ("decisao_revisao", "rederivado_aguarda_revisao"),
        ("nota_revisao", dec["justificativa"]),
        ("notas_revisao", [OrderedDict([("lote", LOTE), ("data", dec["data"]), ("revisor", dec["revisor"]), ("acao", "outro (regime novo)"), ("natureza", dec.get("natureza")), ("eixo", dec.get("eixo")), ("nota", dec["justificativa"]),
                                        ("nota_squad", "Regime criado a partir desta decisão (registrada originalmente em mama-met-hrpos-1l-ht-isolada, 2026-08-16; pedida duas vezes; executada no lote 3). " + notas_extra)])]),
        ("origem", OrderedDict([("decisao_em", "mama-met-hrpos-1l-ht-isolada"), ("lote", LOTE), ("data", dec["data"]), ("revisor", dec["revisor"])])),
    ])
    novo["versao"] = 1; novo["atualizado_em"] = HOJE; novo["revisado_por"] = dec["revisor"]; novo["revisado_em"] = dec["data"]
    novo["historico_versoes"] = [OrderedDict([("versao", 1), ("data", HOJE), ("origem", "intake-lote3:outro (regime novo)"),
        ("mudanca", f"Criado por decisão do revisor (16/08, executada no lote 3): {farmaco} isolado como opção de 1ª linha em HR+/HER2- metastático para frágeis ou com contraindicação a iCDK4/6. Pivô verificado no Crossref/PubMed; GRADE re-derivado; ESMO-MCBS não graduado (selo incompleto honesto); elegibilidade computável só na parte derivável."),
        ("eixos_afetados", ["grade", "esmo_mcbs", "nccn_affordability", "elegibilidade"]), ("fonte", doi_principal), ("decidido_por", REVISOR)])]
    novo["flags"] = list(flags)
    # expectativa de uso: 'até progressão' está no texto do esquema (regra mecânica) + proxy declarado do pivô
    prop, _tr = _reg_exp.propor(novo)
    assert prop["tipo"] == "ate_progressao", prop
    novo["expectativa_uso"] = expectativa
    # composição pelas MESMAS regras mecânicas do corpus (uso contínuo diário → indeterminado, como nos demais cards orais)
    comp = compor_composicao(novo); comp["fonte"] = "esquema"; comp["selo"] = "estimativa"
    novo["composicao"] = comp
    return novo

def expectativa_ate_progressao(proxy_meses, doi, nota):
    if proxy_meses is None:
        return OrderedDict([("tipo", "ate_progressao"), ("duracao_mediana_tratamento_meses", None), ("proxy", None), ("pfs_mediana_meses", None),
                            ("fonte_doi", None), ("indeterminado", True), ("nota", nota), ("selo", "estimativa")])
    return OrderedDict([("tipo", "ate_progressao"), ("duracao_mediana_tratamento_meses", None), ("proxy", "pfs"), ("pfs_mediana_meses", proxy_meses),
                        ("fonte_doi", doi), ("indeterminado", False), ("nota", nota), ("selo", "estimativa")])

TOX_IA = lambda f: [
    OrderedDict([("nome", "Osteoporose/fraturas"), ("severidade", "grave"), ("conduta", "monitorar DMO; cálcio/vitamina D"), ("fonte", f"Bula/ficha técnica: {f}")]),
    OrderedDict([("nome", "Artralgia/mialgia"), ("severidade", "moderada"), ("conduta", None), ("fonte", f"Bula/ficha técnica: {f}")]),
    OrderedDict([("nome", "Fogachos"), ("severidade", "leve"), ("conduta", None), ("fonte", f"Bula/ficha técnica: {f}")]),
]
TOX_TAM = [
    OrderedDict([("nome", "Eventos tromboembólicos"), ("severidade", "grave"), ("conduta", None), ("fonte", "Bula/ficha técnica: Tamoxifeno")]),
    OrderedDict([("nome", "Câncer de endométrio / sangramento vaginal"), ("severidade", "grave"), ("conduta", "vigilância ginecológica"), ("fonte", "Bula/ficha técnica: Tamoxifeno")]),
    OrderedDict([("nome", "Fogachos"), ("severidade", "leve"), ("conduta", None), ("fonte", "Bula/ficha técnica: Tamoxifeno")]),
    OrderedDict([("nome", "Alterações do humor"), ("severidade", "leve"), ("conduta", None), ("fonte", "Bula/ficha técnica: Tamoxifeno")]),
]

# ---------------------------------------------------------------------------
def main():
    data = carregar()
    regimes = data["regimes"]
    by = {r["regimen_id"]: r for r in regimes}
    dec_all = json.load(open(EXPORT, encoding="utf-8"))["decisoes"]
    lote3 = [d for d in dec_all if d["data"] >= "2026-09-14"]
    assert len(lote3) == 73, len(lote3)
    aprovados = [d for d in lote3 if d["decisao"] == "aprovado"]
    novos = [d for d in lote3 if d["decisao"] != "aprovado"]
    assert len(aprovados) == 65 and len(novos) == 8, (len(aprovados), len(novos))
    pend = [d for d in dec_all if d["data"] == "2026-08-16" and d["estado_intake"] == "triada_pendente_execucao"]
    assert {d["regimen_id"] for d in pend} == {"mama-met-hrpos-1l-ht-isolada", "mama-met-tnbc-3l-sacituzumab-ascent"}, pend
    D = {d["regimen_id"]: d for d in novos + pend}
    assert len(D) == 10
    assert not ({d["regimen_id"] for d in aprovados} & set(D)), "aprovado e crítica no mesmo regime neste lote"
    hashes_antes = {r["regimen_id"]: content_hash(r) for r in regimes}
    for d in aprovados + novos + pend:
        rid = d["regimen_id"]
        assert hashes_antes[rid] == d["content_hash"] == d["hash_atual"], (rid, hashes_antes[rid], d["content_hash"], d["hash_atual"])
    # reconciliação (passo 0): nada do lote 2 é tocado — só se confere que está lá
    lote2 = [d for d in dec_all if "2026-09-12" <= d["data"] <= "2026-09-13" and d["decisao"] != "aprovado"]
    assert len(lote2) == 27
    for d in lote2:
        r = by[d["regimen_id"]]
        assert any(n.get("lote") == 2 for n in r["consolidacao"].get("notas_revisao", [])), d["regimen_id"]
        assert any(str(h.get("origem", "")).startswith("intake-lote2") for h in r.get("historico_versoes", [])), d["regimen_id"]

    vocab = {}
    for t in sorted(os.listdir(AQUI)):
        f = os.path.join(AQUI, t, "v1", "regimes-consolidados.json")
        if os.path.isfile(f):
            vocab[t] = json.load(open(f, encoding="utf-8"), object_pairs_hook=OrderedDict).get("campos_primitivos") or []
    campos_mama = {c["campo"] for c in vocab["mama"]}
    for campo in ("cenario", "rh", "her2", "contraindicacao_icdk46", "menopausa", "linhas_previas", "exposicao_previa_taxano"):
        assert campo in campos_mama, campo   # nenhum primitivo novo neste lote

    # =========================== 1. APROVADOS (65): só registro ===========================
    flip = 0
    for d in aprovados:
        r = by[d["regimen_id"]]
        r["consolidacao"].setdefault("aprovacoes", []).append(OrderedDict([("lote", LOTE), ("data", d["data"]), ("revisor", d["revisor"]), ("content_hash", d["content_hash"])]))
        if r["consolidacao"].get("decisao_revisao") in ("auto_confirmado_pendente_publicacao", "sem_divergencia_nao_requer_decisao", "pendente_oncologista_referencia", "rederivado_aguarda_revisao"):
            r["consolidacao"]["decisao_revisao"] = "aprovado_revisao_clinica"; flip += 1
        r["revisado_por"] = d["revisor"]; r["revisado_em"] = d["data"]

    # =========================== 2. MANTER_ANOTAR (7) ===========================
    def manter(rid, nota_squad=None, flag=None, extra_flags=()):
        d = D[rid]; r = by[rid]; assert d["acao"] == "manter_anotar", rid
        anotar(r, d, "revisado_com_ressalva", nota_squad=nota_squad)
        if flag:
            set_flag(r, flag)
        for f in extra_flags:
            set_flag(r, f)
        hist(r, "intake-lote3:manter_anotar", "Nota do revisor incorporada ao card (revisado com ressalva); dado, selo, motivo de não-incorporação e eixos inalterados — hash intacto.", [], None, bump=False)
        AMOSTRA_EXEC.append(OrderedDict([("regimen_id", rid), ("acao", "manter_anotar"), ("texto_revisor", d["justificativa"]),
                                         ("nota_gravada", r["consolidacao"]["notas_revisao"][-1]), ("flag_gravada", flag)]))
        registrar(d, "executado", "nota incorporada (visível no card via notas_revisao); hash intacto")

    manter("pancreas-adj-gem-cape-nao-incorporado",
           nota_squad="Nota de contexto do revisor (PRODIGE-24 vs ESPAC-4): não incorporação mantida; os números citados são do revisor e não foram verificados nesta rodada; pivô (ESPAC-4), selo e motivo inalterados.",
           flag="nota_revisor: mFOLFIRINOX é o adjuvante preferido em aptos (PRODIGE-24: SG 54,4 vs 35,0 m, HR 0,64; DFS 21,6 vs 12,8 m) — GemCap fica para menos aptos ao tríplice (ESPAC-4: 28,0 vs 25,5 m)")
    manter("crc-met-bevacizumabe-1l-nao-incorporado",
           nota_squad="Nota de contexto do revisor; não incorporação mantida; pivô, selo (confirmado) e motivo inalterados.",
           flag="nota_revisor: bevacizumabe + QT em CCR metastático — ganho de RO e SLP, SG modesta e inconsistente entre esquemas")
    r_rego = by["crc-met-regorafenibe-nao-incorporado"]
    coincide = "6,4 vs 5,0" in str(r_rego.get("beneficio") or {}) or "6.4" in str(r_rego.get("beneficio") or {})
    manter("crc-met-regorafenibe-nao-incorporado",
           nota_squad=("Nota de contexto do revisor (CORRECT: SG 6,4 vs 5,0 m, HR 0,77; interrupção/modificação de dose >70%); não incorporação mantida; pivô (CORRECT), selo e motivo inalterados."
                       + (" Números de SG coincidem com o benefício já registrado no card." if coincide else " Números do revisor não conferidos contra o card nesta rodada.")),
           flag="nota_revisor: regorafenibe — SG 6,4 vs 5,0 m (HR 0,77; p=0,0052; +1,4 m) contra toxicidade com interrupção/modificação de dose em >70% — por isso não incorporado habitualmente")
    manter("net-altograu-platina-etoposideo",
           nota_squad=("Nota do revisor incorporada (platina+etoposídeo como 1ª linha padrão em NEC G3, extrapolado do SCLC; RO ~30–42%, SLP 5,4–6,4 m, SG 10,6–19 m). "
                       "ATENÇÃO: o texto embute um PEDIDO DE REGIME NOVO ('acrescentar FOLFOX como 2ª linha', Hadoux 2015 — DOI 10.1530/ERC-15-0075 resolve no Crossref) que NÃO foi executado: a ação registrada é manter_anotar, e regime novo nunca é deduzido de texto livre. Pendência aberta em re_revisao para o revisor confirmar como ação própria."),
           flag="nota_revisor: platina+etoposídeo = 1ª linha padrão em NEC G3 (extrapolação do SCLC); sem padrão de 2ª linha — FOLFOX com evidência retrospectiva pequena (Hadoux 2015, n=20: SLP 4,5 m, SG 9,9 m; respostas mesmo pós-platina)",
           extra_flags=["pedido_embutido_nao_executado: FOLFOX 2ª linha em NEC G3 (regime novo) — aguarda ação própria do revisor"])
    RE_REVISAO.append(OrderedDict([("regimen_id", "net-altograu-platina-etoposideo"), ("item", "folfox_2l_nec_regime_novo"),
        ("descricao", "O parecer manter_anotar de 14/09 pede 'acrescentar FOLFOX como 2ª linha' (Hadoux 2015, série retrospectiva n=20). Regime novo não se cria a partir de manter_anotar: se o revisor confirmar, entra como ação própria (outro/regime novo) num lote seguinte, com selo incompleto honesto (evidência retrospectiva)."),
        ("status", "aberto"), ("data", HOJE)]))
    manter("nsclc-adj-io-estagioI-nao-incluido",
           nota_squad="Nota de contexto do revisor (IMpower010 e PEARLS/KEYNOTE-091 incluíram a partir de IB ≥4 cm, 7ª ed. AJCC; nenhum incluiu IA); não inclusão mantida; selo e motivo inalterados.",
           flag="nota_revisor: sem evidência de IO adjuvante em estágio IA — IMpower010 e KEYNOTE-091 restringiram a inclusão a ≥IB (tumor ≥4 cm), e mesmo aí o resultado é limitado")
    manter("sclc-retratamento-mesmo-esquema",
           nota_squad="Nota do revisor incorporada. O texto chegou SEM o valor do intervalo livre de platina ('quando o intervalo livre de platina é após o término...'); o card mantém '>6 meses de remissão' como está — nada foi completado pelo squad. Se o revisor quiser fixar o corte (ex.: ≥90 dias vs ≥6 meses), é ajuste de elegibilidade num parecer próprio.",
           flag="nota_revisor: retratamento com platina indicado conforme o intervalo livre de platina após o fim da 1ª linha — critério clássico de 'sensibilidade à platina' no SCLC (valor do intervalo não informado no parecer)",
           extra_flags=["parecer_incompleto: intervalo livre de platina sem valor no texto do revisor — card inalterado (>6 meses)"])
    # Tarlatamabe — DeLLphi-304 VERIFICADO (Crossref + PubMed) → referência complementar com nota do squad; selo e motivo INALTERADOS
    v = VERIFICADAS["10.1056/NEJMoa2502099"]
    r = by["sclc-2l-tarlatamabe-nao-incluido"]
    r["consolidacao"].setdefault("referencias_complementares", []).append(ref_complementar("10.1056/NEJMoa2502099",
        "Fase 3 confirmatório citado pelo revisor (SG como desfecho primário) — verificado em Crossref/PubMed em 2026-09-15; os números da justificativa do revisor (n=509; SG 13,6 vs 8,3 m; HR 0,60, IC95% 0,47–0,77; p<0,001) CONFEREM com o abstract. NÃO substitui o pivô do card (sem pivô com DOI; base DeLLphi-301) nem altera GRADE/ESMO/selo: mudar o motivo de não inclusão é decisão do revisor na re-revisão."))
    manter("sclc-2l-tarlatamabe-nao-incluido",
           nota_squad=("DeLLphi-304 verificado: " + v["citacao"] + " (PMID " + v["pmid"] + "). Abstract: " + ABSTRACT["DeLLphi-304"] +
                       " Os números de SG/HR/n do revisor conferem; PFS (RMST 5,3 vs 4,3 m; 20% vs 4% em 12 m; HR 0,71) e RO (35% vs 20%) não constam do abstract — citados pelo revisor, não conferidos. "
                       "A análise de custo-efetividade citada (Markov, 0,15 QALY; ICER US$ 1,3 mi/QALY EUA) não foi verificada. Anexado em referencias_complementares; selo, eixos e motivo de não inclusão inalterados (hash intacto). "
                       "Ressalva ao revisor: a flag de não inclusão do card diz 'baixa qualidade de evidência (DeLLphi-301)' — com o fase 3 positivo, o argumento que sobra é o de custo; atualizar o motivo é decisão dele."),
           flag="nota_revisor: ganho clínico confirmado pelo DeLLphi-304 (fase 3, n=509: SG 13,6 vs 8,3 m, HR 0,60) — não incluído por custo-efetividade desfavorável nos preços atuais (ICER muito acima dos limiares)",
           extra_flags=["evidencia_atualizada: DeLLphi-304 (Mountzios 2025, NEJM; verificado) confirma SG em fase 3 — motivo 'baixa qualidade de evidência (DeLLphi-301)' ficou desatualizado; candidato a re-revisão do motivo (custo)"])
    RE_REVISAO.append(OrderedDict([("regimen_id", "sclc-2l-tarlatamabe-nao-incluido"), ("item", "motivo_nao_inclusao_pos_dellphi304"),
        ("descricao", "DeLLphi-304 (fase 3, SG positiva) verificado e anexado como referência complementar. O motivo registrado no card ('MCBS 2, baixa qualidade de evidência — DeLLphi-301') não descreve mais a evidência; o revisor argumenta custo. Confirmar se o motivo passa a 'custo' e se GRADE/ESMO devem ser re-derivados do fase 3 (isso muda o hash)."),
        ("status", "aberto"), ("data", HOJE)]))

    # =========================== 3. DOSTARLIMABE MSS — contradição interna → triagem_manual ===========================
    d = D["endometrio-met-dostarlimabe-mss-nao-incluido"]; r = by[d["regimen_id"]]
    assert d["acao"] == "refutar" and d["decisao"] == "contestado"
    va = VERIFICADAS["10.1200/JCO.2025.43.16_suppl.5601"]
    nota = ("NÃO implementado em nenhum lado — CONTRADIÇÃO INTERNA no parecer: a AÇÃO registrada é 'refutar' (manter fora do corpo de candidatos, motivo refutado), "
            "mas a JUSTIFICATIVA cita evidência A FAVOR do esquema na população MMRp/MSS (ASCO 2025: TFST +2,5 m e TSST +8,1 m com dostarlimabe vs placebo). "
            "Verificação do squad (não altera nada): a citação existe — " + va["citacao"] + " — e os números conferem com o abstract (" + ABSTRACT["RUBY-TFST"] + "). "
            "Como refutar muda o corpo publicado e nunca é deduzido de texto livre, e a justificativa aponta na direção oposta, o card fica como está (não incluído; SG não significativa em MSS no RUBY, HR 0,79 com IC cruzando 1) até o revisor responder. "
            "PERGUNTA OBJETIVA AO REVISOR: manter o esquema FORA (não incluído) com nota da evidência emergente (TFST/TSST, ASCO 2025), ou pedir a INCORPORAÇÃO na população MSS? "
            "Ressalva do squad: TFST/TSST são desfechos post hoc de análise interina; a SG no subgrupo MSS segue não significativa na fonte pivô do card.")
    r["consolidacao"]["decisao_revisao"] = "triagem_manual"
    r["consolidacao"]["spec_revisor_nao_computavel"] = nota
    anotar(r, d, "triagem_manual", nota_squad=nota)
    set_flag(r, "triagem_manual: parecer com ação 'refutar' e justificativa a favor (ASCO 2025 TFST/TSST em MSS) — aguarda resposta do revisor; nada mudou no dado")
    hist(r, "intake-lote3:refutar", "NÃO executado: contradição interna (ação refutar × justificativa favorável). Triagem manual com pergunta ao revisor; citação ASCO 2025 verificada no Crossref (não incorporada). Hash intacto.", [], None, bump=False)
    TRIAGEM.append(OrderedDict([("regimen_id", r["regimen_id"]), ("acao", d["acao"]), ("motivo", "contradição interna: ação refutar × justificativa a favor"),
                                ("pergunta_ao_revisor", "manter fora com nota da evidência emergente, ou pedir incorporação?"),
                                ("citacao_verificada", "10.1200/JCO.2025.43.16_suppl.5601")]))
    AMOSTRA_EXEC.append(OrderedDict([("regimen_id", r["regimen_id"]), ("acao", "refutar → triagem_manual"), ("texto_revisor", d["justificativa"]),
                                     ("nota_gravada", r["consolidacao"]["notas_revisao"][-1]), ("flag_gravada", None)]))
    registrar(d, "triagem_manual", "contradição interna (refutar × justificativa a favor); pergunta ao revisor; citação verificada; hash intacto")

    # =========================== 4a. HT ISOLADA 1ª LINHA — quatro opções (pendência de 16/08) ===========================
    d = D["mama-met-hrpos-1l-ht-isolada"]; rg = by[d["regimen_id"]]
    assert rg["consolidacao"]["decisao_revisao"] == "triagem_manual"
    PIVOS_ANA = [OrderedDict([("papel", "principal"), ("estudo", "North American trial (Nabholtz 2000)"), ("doi", "10.1200/JCO.2000.18.22.3758"), ("pmid", "11078488"), ("ano", 2000), ("primeiro_autor", "Nabholtz"), ("populacao", "pós-menopausa, RH+ ou desconhecido, 1ª linha; n=353")]),
                 OrderedDict([("papel", "co-pivô"), ("estudo", "TARGET (Bonneterre 2000)"), ("doi", "10.1200/JCO.2000.18.22.3748"), ("pmid", "11078487"), ("ano", 2000), ("primeiro_autor", "Bonneterre"), ("populacao", "pós-menopausa, RH+ ou desconhecido, 1ª linha; n=668")]),
                 OrderedDict([("papel", "complementar (SG, metanálise)"), ("estudo", "Mauri 2006"), ("doi", "10.1093/jnci/djj357"), ("pmid", "16985247"), ("ano", 2006), ("primeiro_autor", "Mauri"), ("populacao", "IA 3ª geração vs HT padrão em doença avançada; n=8.504")])]
    PIVOS_LET = [OrderedDict([("papel", "principal"), ("estudo", "P025 (Mouridsen 2001)"), ("doi", "10.1200/JCO.2001.19.10.2596"), ("pmid", "11352951"), ("ano", 2001), ("primeiro_autor", "Mouridsen"), ("populacao", "pós-menopausa, RH+ ou desconhecido, 1ª linha; n=907")]),
                 OrderedDict([("papel", "atualização (SG)"), ("estudo", "P025 update (Mouridsen 2003)"), ("doi", "10.1200/JCO.2003.04.194"), ("pmid", "12775735"), ("ano", 2003), ("primeiro_autor", "Mouridsen"), ("populacao", "mesma coorte, seguimento mediano 32 meses; n=916")]),
                 OrderedDict([("papel", "complementar (SG, metanálise)"), ("estudo", "Mauri 2006"), ("doi", "10.1093/jnci/djj357"), ("pmid", "16985247"), ("ano", 2006), ("primeiro_autor", "Mauri"), ("populacao", "IA 3ª geração vs HT padrão em doença avançada; n=8.504")])]
    PIVOS_EXE = [OrderedDict([("papel", "principal"), ("estudo", "EORTC 10951 (Paridaens 2008)"), ("doi", "10.1200/JCO.2007.14.4659"), ("pmid", "18794551"), ("ano", 2008), ("primeiro_autor", "Paridaens"), ("populacao", "pós-menopausa, hormônio-sensível, 1ª linha hormonal; n=371")]),
                 OrderedDict([("papel", "complementar (SG, metanálise)"), ("estudo", "Mauri 2006"), ("doi", "10.1093/jnci/djj357"), ("pmid", "16985247"), ("ano", 2006), ("primeiro_autor", "Mauri"), ("populacao", "IA/inativadores 3ª geração vs HT padrão; n=8.504")])]
    PIVOS_TAM = [OrderedDict([("papel", "principal (braço COMPARADOR — tamoxifeno 20 mg/dia)"), ("estudo", "P025 update (Mouridsen 2003)"), ("doi", "10.1200/JCO.2003.04.194"), ("pmid", "12775735"), ("ano", 2003), ("primeiro_autor", "Mouridsen"), ("populacao", "pós-menopausa, 1ª linha; braço tamoxifeno n=458: TTP 6,0 m, SG 30 m")]),
                 OrderedDict([("papel", "comparador"), ("estudo", "North American trial (Nabholtz 2000)"), ("doi", "10.1200/JCO.2000.18.22.3758"), ("pmid", "11078488"), ("ano", 2000), ("primeiro_autor", "Nabholtz"), ("populacao", "braço tamoxifeno: TTP 5,6 m; RO 17%")]),
                 OrderedDict([("papel", "comparador"), ("estudo", "TARGET (Bonneterre 2000)"), ("doi", "10.1200/JCO.2000.18.22.3748"), ("pmid", "11078487"), ("ano", 2000), ("primeiro_autor", "Bonneterre"), ("populacao", "braço tamoxifeno: TTP 8,3 m; RO 32,6%")]),
                 OrderedDict([("papel", "comparador"), ("estudo", "EORTC 10951 (Paridaens 2008)"), ("doi", "10.1200/JCO.2007.14.4659"), ("pmid", "18794551"), ("ano", 2008), ("primeiro_autor", "Paridaens"), ("populacao", "braço tamoxifeno: PFS 5,8 m; RO 31%")])]
    ESMO_NAO_GRAD = ("NÃO graduado pelo squad: ensaio anterior à escala ESMO-MCBS (sem scorecard publicado), desfecho primário TTP/PFS com SG secundária/imatura ou não significativa. "
                     "Graduação retroativa é mérito clínico (Portão C) — números do pivô transcritos na justificativa do GRADE para o revisor decidir. Lacuna declarada (selo incompleto).")
    AMPL_POS = ("Regra = HR+/HER2- metastático com contraindicação a iCDK4/6, pós-menopausa. Frente aos pivôs (pós-menopausa, RH+ ou desconhecido, 1ª linha endócrina; 1 QT prévia permitida) a regra é MAIS ESTREITA "
                "(exige contraindicação a iCDK4/6, que não existia na época) — direção segura. Não modelado: pré-menopausa com supressão ovariana (sem primitivo; fica fora), crise visceral (revisor não pediu; abstracts não a mencionam) e 'fragilidade' (indeterminada).")
    AMPL_TAM = ("Regra = HR+/HER2- metastático com contraindicação a iCDK4/6, SEM restrição de status menopausal. Frente aos pivôs (todos em pós-menopausa, tamoxifeno como braço comparador) a regra é MAIS AMPLA no eixo menopausa "
                "(pré-menopausa não estudada nesses ensaios) — extensão clínica do revisor ('tamoxifeno' listado sem restrição), sinalizada como mais_amplo (direção insegura) e pendente de confirmação. Não modelado: crise visceral e 'fragilidade' (indeterminada).")
    novos_ht = [
        novo_ht("mama-met-hrpos-1l-anastrozol", "Anastrozol", "1 mg", "10.1200/JCO.2000.18.22.3758", PIVOS_ANA, "1B",
                "Dois RCTs duplo-cegos de 1ª linha vs tamoxifeno em pós-menopausa. Nabholtz 2000 (PMID 11078488): " + ABSTRACT["Nabholtz2000"] + " Bonneterre 2000/TARGET (PMID 11078487): " + ABSTRACT["Bonneterre2000"] +
                " Metanálise (Mauri 2006): " + ABSTRACT["Mauri2006"] + " Qualidade rebaixada de A para B por INDIRECIONALIDADE de população: os ensaios são da era pré-iCDK4/6 e não estudaram a população-alvo do revisor (frágeis/contraindicação a iCDK4/6). Recomendação forte (HT isolada é o padrão quando iCDK4/6 não é opção; alternativa seria QT) → 1B.",
                "Tempo até progressão (1ª linha, pós-menopausa) — equivalência/superioridade a tamoxifeno",
                "Nabholtz 2000: TTP 11,1 vs 5,6 m (p=0,005); TARGET: TTP 8,2 vs 8,3 m (equivalência); menos tromboembolismo/sangramento vaginal que tamoxifeno. SG (metanálise Mauri 2006, IA 3ª geração): RH 0,87.",
                TOX_IA("Anastrozol"), True,
                expectativa_ate_progressao(None, None, "pivôs reportam TTP (11,1 m Nabholtz; 8,2 m TARGET), não PFS nem duração mediana de tratamento — sem proxy declarável pelas regras do corpus (proxy aceito = PFS)"),
                ESMO_NAO_GRAD, d, "Pivôs: Nabholtz 2000 + TARGET (Bonneterre 2000), verificados; Mauri 2006 (SG) como complementar.", "mais_estreito", AMPL_POS, []),
        novo_ht("mama-met-hrpos-1l-letrozol", "Letrozol", "2,5 mg", "10.1200/JCO.2001.19.10.2596", PIVOS_LET, "1B",
                "RCT fase 3 de 1ª linha vs tamoxifeno em pós-menopausa. Mouridsen 2001 (PMID 11352951): " + ABSTRACT["Mouridsen2001"] + " Atualização (Mouridsen 2003, PMID 12775735): " + ABSTRACT["Mouridsen2003"] +
                " Metanálise (Mauri 2006): " + ABSTRACT["Mauri2006"] + " Qualidade rebaixada de A para B por INDIRECIONALIDADE de população (era pré-iCDK4/6; população frágil/contraindicada não estudada). Recomendação forte → 1B.",
                "Tempo até progressão (1ª linha, pós-menopausa) — superioridade a tamoxifeno",
                "P025: TTP 9,4 vs 6,0 m (HR 0,70; IC95% 0,60–0,82); RO 32% vs 21%; SG 34 vs 30 m (não significativa, cross-over ~50%); tempo até QT 16 vs 9 m.",
                TOX_IA("Letrozol"), True,
                expectativa_ate_progressao(None, None, "pivô reporta TTP mediana (9,4 m, Mouridsen 2003), não PFS nem duração mediana de tratamento — sem proxy declarável pelas regras do corpus (proxy aceito = PFS)"),
                ESMO_NAO_GRAD, d, "Pivô: P025 (Mouridsen 2001; atualização 2003), verificado; Mauri 2006 (SG) como complementar.", "mais_estreito", AMPL_POS, []),
        novo_ht("mama-met-hrpos-1l-exemestano", "Exemestano", "25 mg", "10.1200/JCO.2007.14.4659", PIVOS_EXE, "2B",
                "RCT fase 3 ABERTO de 1ª linha hormonal vs tamoxifeno em pós-menopausa. Paridaens 2008 (PMID 18794551): " + ABSTRACT["Paridaens2008"] +
                " Desfecho primário (PFS) NÃO atingido no longo prazo e sem diferença de SG; ganho em RO e PFS precoce. Metanálise de classe (Mauri 2006): " + ABSTRACT["Mauri2006"] +
                " Qualidade B (aberto; desfecho primário negativo) e recomendação CONDICIONAL (opção de IA de 3ª geração, sem superioridade demonstrada sobre tamoxifeno no primário) → 2B. Indirecionalidade de população (era pré-iCDK4/6) também presente.",
                "Resposta objetiva e SLP precoce (1ª linha, pós-menopausa) — sem superioridade sustentada sobre tamoxifeno",
                "EORTC 10951: RO 46% vs 31% (OR 1,85; p=0,005); PFS mediana 9,9 vs 5,8 m (diferença precoce; log-rank p=0,121 no primário); sem diferença de SG.",
                TOX_IA("Exemestano"), True,
                expectativa_ate_progressao(9.9, "10.1200/JCO.2007.14.4659", "PFS mediana do braço exemestano (EORTC 10951, Paridaens 2008) — proxy declarado; o desfecho primário de PFS não foi significativo no longo prazo"),
                ESMO_NAO_GRAD, d, "Pivô: EORTC 10951 (Paridaens 2008), verificado; Mauri 2006 (SG de classe) como complementar.", "mais_estreito", AMPL_POS, []),
        novo_ht("mama-met-hrpos-1l-tamoxifeno", "Tamoxifeno", "20 mg", "10.1200/JCO.2003.04.194", PIVOS_TAM, "2B",
                "Tamoxifeno é o braço COMPARADOR (padrão histórico de 1ª linha) dos quatro RCTs de IA de 1ª linha em pós-menopausa — não há ensaio moderno de tamoxifeno vs placebo/observação nesse cenário. Braço tamoxifeno 20 mg/dia: P025 (Mouridsen 2003, PMID 12775735) TTP 6,0 m, RO 21%, SG 30 m; Nabholtz 2000 TTP 5,6 m; TARGET TTP 8,3 m; EORTC 10951 PFS 5,8 m. "
                "Nos pós-menopausa, letrozol e (em um dos dois ensaios) anastrozol foram superiores em TTP e a metanálise (Mauri 2006) mostra SG melhor com IA de 3ª geração (RH 0,87) — tamoxifeno é opção quando IA não é adequado. Qualidade B (evidência indireta, como comparador); recomendação condicional → 2B.",
                "Tempo até progressão como braço comparador padrão (1ª linha, pós-menopausa)",
                "Braço tamoxifeno 20 mg/dia: TTP 6,0 m e SG 30 m (P025); TTP 5,6 m (Nabholtz 2000) e 8,3 m (TARGET); PFS 5,8 m (EORTC 10951). Inferior a letrozol em TTP (HR 0,70) e a IA em SG na metanálise (RH 0,87).",
                TOX_TAM, False,
                expectativa_ate_progressao(None, None, "pivô principal (P025) reporta TTP do braço tamoxifeno (6,0 m), não PFS; a PFS de 5,8 m do braço tamoxifeno do EORTC 10951 está em referencia.pivos, mas o proxy do corpus só vem do DOI do próprio regime (check [9]) — sem proxy declarável"),
                ESMO_NAO_GRAD, d, "Fonte: braço comparador dos RCTs de IA (P025 principal), verificados; sem ensaio dedicado.", "mais_amplo", AMPL_TAM,
                ["elegibilidade:mais_amplo (pré-menopausa não estudada nos pivôs — tamoxifeno listado pelo revisor sem restrição menopausal; conferir)",
                 "referencia_e_comparador: tamoxifeno é o braço controle dos pivôs de IA — sem ensaio dedicado de 1ª linha"]),
    ]
    for novo in novos_ht:
        assert novo["regimen_id"] not in by
    # entram logo após o card genérico de HT isolada (mantém agrupamento por tumor e vizinhança)
    idx = next(i for i, x in enumerate(regimes) if x["regimen_id"] == "mama-met-hrpos-1l-ht-isolada")
    for k, novo in enumerate(novos_ht):
        regimes.insert(idx + 1 + k, novo); by[novo["regimen_id"]] = novo
    # o card genérico fica (não foi pedido excluir; inclui fulvestranto): fecha a triagem apontando as 4 opções
    ids_novos = [n["regimen_id"] for n in novos_ht]
    nota_g = ("Pendência de 16/08 (pedida duas vezes) EXECUTADA no lote 3: as hormonioterapias de 1ª linha pedidas pelo revisor viraram quatro regimes próprios — " + ", ".join(ids_novos) +
              " — cada um com pivô verificado (Crossref/PubMed), GRADE re-derivado, ESMO-MCBS não graduado (selo incompleto honesto) e elegibilidade computável só no que é derivável (contraindicação a iCDK4/6; 'fragilidade' indeterminada com nota). "
              "Este card genérico (IA ou fulvestranto, sem pivô) permanece como está — o revisor não pediu exclusão e ele cobre o fulvestranto, que não está entre as quatro opções pedidas. Regra, eixos e hash intactos.")
    rg["consolidacao"]["decisao_revisao"] = "revisado_com_ressalva"
    rg["consolidacao"]["spec_revisor_nao_computavel"] = None
    rg["consolidacao"]["desdobrado_em"] = ids_novos
    rg["consolidacao"].setdefault("notas_revisao", []).append(OrderedDict([("lote", LOTE), ("data", d["data"]), ("revisor", d["revisor"]), ("acao", "outro (regimes novos criados)"),
        ("natureza", d.get("natureza")), ("eixo", d.get("eixo")), ("nota", d["justificativa"]), ("nota_squad", nota_g)]))
    rg["revisado_por"] = d["revisor"]; rg["revisado_em"] = d["data"]
    set_flag(rg, "desdobrado_em (lote 3): " + ", ".join(ids_novos) + " — opções individualizadas de HT isolada de 1ª linha pedidas pelo revisor", remover_prefixo="triagem")
    hist(rg, "intake-lote3:outro", "Triagem de 16/08 fechada: pedido do revisor executado como quatro regimes novos (anastrozol, letrozol, exemestano, tamoxifeno); card genérico mantido (fulvestranto), dado e hash intactos.", [], None, bump=False)
    for novo in novos_ht:
        ELEG_RESULTADO.append(OrderedDict([("id", novo["regimen_id"]), ("mudou", True), ("antes", None), ("depois", json.dumps(novo["elegibilidade"]["regra"], ensure_ascii=False)), ("texto_revisor", d["justificativa"]), ("novosPrim", [])]))
    RE_REVISAO.append(OrderedDict([("regimen_id", "mama-met-hrpos-1l-{anastrozol,letrozol,exemestano,tamoxifeno}"), ("item", "fragilidade_e_menopausa_ht_isolada"),
        ("descricao", "Quatro regimes novos de HT isolada 1ª linha. Abertos para o revisor: (1) 'fragilidade' não virou regra — quer um primitivo de julgamento clínico (como alto_risco_clinico) ou um corte (ECOG/idade)?; (2) tamoxifeno ficou sem restrição menopausal (mais_amplo que os pivôs) — confirmar; (3) IA exigem menopausa=pos — pré-menopausa com supressão ovariana ficou fora (sem primitivo); (4) ESMO-MCBS não graduado (ensaios pré-escala) — o revisor pode graduar."),
        ("status", "aberto"), ("data", HOJE)]))
    AMOSTRA_EXEC.append(OrderedDict([("regimen_id", "mama-met-hrpos-1l-ht-isolada → 4 regimes novos"), ("acao", "outro"), ("texto_revisor", d["justificativa"]),
                                     ("nota_gravada", rg["consolidacao"]["notas_revisao"][-1]), ("flag_gravada", None)]))
    registrar(d, "executado", "4 regimes novos (anastrozol, letrozol, exemestano, tamoxifeno) com pivôs verificados; card genérico mantido; hash do genérico intacto", regimes_novos=ids_novos)

    # =========================== 4b. ASCENT — elegibilidade computável; MCBS diverge visível ===========================
    d = D["mama-met-tnbc-3l-sacituzumab-ascent"]; r = by[d["regimen_id"]]
    assert r["consolidacao"]["decisao_revisao"] == "triagem_manual"
    regra = r["elegibilidade"]["regra"]; crits = {c["id"]: c for c in r["elegibilidade"]["criterios"]}
    assert crits["duas_linhas_taxano"]["expr"] == {"and": [{"gte": ["linhas_previas", 2]}, {"eq": ["exposicao_previa_taxano", True]}]}, crits
    antes = json.dumps(regra, ensure_ascii=False)
    # A regra computável pedida (≥2 linhas prévias; uma com taxano) JÁ É a regra do card — não muda (hash da regra intacto);
    # o rótulo do critério passa a dizer o que o revisor escreveu.
    crits["duas_linhas_taxano"]["label"] = "≥2 linhas sistêmicas prévias no cenário avançado, ≥1 delas com taxano (paclitaxel ou docetaxel — revisor, 16/08)"
    e = r["verificacao"]["elegibilidade"]
    e.update(OrderedDict([("status", "re_derivado"),
        ("criterios_inclusao", [crit("cenario", "=", "metastatico"), crit("rh", "=", "negativo"), crit("her2", "=", "negativo"), crit("linhas_previas", ">=", 2), crit("exposicao_previa_taxano", "=", True)]),
        ("criterios_exclusao", []), ("amplitude", "mais_estreito"),
        ("divergencia_vs_protocolo", "O revisor fixou a elegibilidade: 'pelo menos 2 linhas de tratamento prévio (uma tem que ser paclitaxel ou docetaxel)'. É a regra do protocolo e a que o card já computava (linhas_previas ≥2 no cenário avançado + exposicao_previa_taxano). "
                                      "Frente ao ASCENT (≥2 QT prévias no TOTAL, ≥1 metastática; taxano podia ser da (neo)adjuvância) a regra segue MAIS ESTREITA — direção segura; a divergência anterior (protocolo × estudo) está resolvida por decisão do revisor. "
                                      "Ressalvas: (a) o primitivo 'exposição prévia a taxano' não distingue nab-paclitaxel de paclitaxel/docetaxel — se o revisor quiser excluir nab-paclitaxel, é primitivo novo; (b) o taxano pode ter sido em qualquer cenário (leitura mais ampla, coerente com o ASCENT); (c) ECOG 0–1 do estudo não está na regra (não pedido)."),
        ("justificativa", "Re-derivado da spec do revisor (16/08, executada no lote 3) confrontada com a elegibilidade do ASCENT (Bardia 2021)."),
        ("fonte", "https://doi.org/10.1056/NEJMoa2028485"), ("rederivado_em", HOJE), ("rederivado_por", "intake-lote3:verificador-elegibilidade")]))
    # ESMO-MCBS: revisor pede 5, squad re-derivou 4 (Form 2a, teto com SG do controle <12 m) — NÃO se sobrescreve: fica diverge, visível, com a posição dos dois lados
    m = r["verificacao"]["esmo_mcbs"]; assert m["status"] == "diverge" and m["valor_rederivado"] == "4"
    m["divergencia_revisor"] = OrderedDict([("revisor_pede", "5"), ("squad_rederivou", "4"), ("data", d["data"]), ("lote", LOTE),
        ("nota", "O revisor pede 'CORRIGIR ESMO = 5' (mesmo valor afirmado pelo protocolo). O squad manteve 4: pelo Form 2a (SG do controle <12 m), o teto é 4 mesmo com HR 0,48 e ganho de 4,9 m, e a análise sistemática ESMO de ADCs confirma 4 após bônus de QoL. Não se resolve sobrescrevendo — eixo fica 'diverge' e visível; decisão é do Portão C (revisor). Se o revisor mantiver 5 como decisão clínica documentada, o intake seguinte grava valor_rederivado=5 com status 'decisao_revisor'.")])
    set_flag(r, "divergencia_revisor:esmo_mcbs — revisor pede 5, squad re-derivou 4 (Form 2a); mantida visível para o Portão C")
    r["consolidacao"]["spec_revisor_resultado"] = "aplicada (regra já computável; eixo elegibilidade re-derivado)"
    r["consolidacao"]["spec_revisor_nao_computavel"] = None
    anotar(r, d, "rederivado_aguarda_revisao",
           nota_squad="Elegibilidade computável (≥2 linhas prévias, ≥1 com taxano) confirmada — a regra já era essa; eixo re-derivado (diverge→re_derivado, mais_estreito que o ASCENT), o que muda o hash (parecer de 16/08 expira por sua própria execução). ESMO-MCBS: revisor 5 × squad 4 fica DIVERGE e visível — não sobrescrito; decisão do Portão C. Selo permanece 'divergencia' por causa do MCBS.")
    selo = selo_por_eixos(r)
    assert selo == "divergencia" and r["consolidacao"]["eixos_diverge"] == ["esmo_mcbs"], (selo, r["consolidacao"]["eixos_diverge"])
    ELEG_RESULTADO.append(OrderedDict([("id", r["regimen_id"]), ("mudou", False), ("antes", antes), ("depois", json.dumps(r["elegibilidade"]["regra"], ensure_ascii=False)), ("texto_revisor", d["justificativa"]), ("novosPrim", [])]))
    RE_REVISAO.append(OrderedDict([("regimen_id", r["regimen_id"]), ("item", "esmo_mcbs_5_vs_4"),
        ("descricao", "Revisor pede ESMO-MCBS 5; squad re-derivou 4 (Form 2a, SG do controle <12 m limita a 4; análise ESMO de ADCs = 4). Eixo mantido 'diverge' e visível. O revisor decide: manter 5 como decisão clínica documentada (o intake grava com status decisao_revisor) ou aceitar 4."),
        ("status", "aberto"), ("data", HOJE)]))
    hist(r, "intake-lote3:outro (elegibilidade+mcbs)", "Pendência de 16/08 executada: elegibilidade computável confirmada (regra inalterada, rótulo explicitado), eixo elegibilidade re-derivado (diverge→re_derivado, mais_estreito); divergência de ESMO-MCBS (5 × 4) mantida visível com a posição dos dois lados. Selo divergencia mantido.", ["elegibilidade"], "10.1056/NEJMoa2028485", bump=True)
    AMOSTRA_EXEC.append(OrderedDict([("regimen_id", r["regimen_id"]), ("acao", "outro"), ("texto_revisor", d["justificativa"]),
                                     ("nota_gravada", r["consolidacao"]["notas_revisao"][-1]), ("flag_gravada", "divergencia_revisor:esmo_mcbs — revisor pede 5, squad re-derivou 4 (Form 2a); mantida visível para o Portão C")]))
    registrar(d, "executado", "regra já computável (inalterada); eixo elegibilidade re-derivado (hash muda); MCBS 5×4 diverge visível")

    # =========================== 5. CONSEQUÊNCIAS ===========================
    hashes_depois = {r["regimen_id"]: content_hash(r) for r in regimes}
    rehash = []
    for rid in D:
        rehash.append(OrderedDict([("regimen_id", rid), ("content_hash_antes", hashes_antes[rid]), ("content_hash_depois", hashes_depois[rid]), ("mudou", hashes_antes[rid] != hashes_depois[rid])]))
    mudaram = {x["regimen_id"] for x in rehash if x["mudou"]}
    assert mudaram == {"mama-met-tnbc-3l-sacituzumab-ascent"}, mudaram   # o único hash que muda de propósito
    for rid, h in hashes_antes.items():
        if rid not in D:
            assert hashes_depois[rid] == h, f"hash mudou fora do lote: {rid}"
    expirados = []
    for x in dec_all:
        h_novo = hashes_depois.get(x["regimen_id"])
        if h_novo and x["content_hash"] != h_novo and x["hash_atual"] == x["content_hash"]:
            expirados.append(OrderedDict([("regimen_id", x["regimen_id"]), ("decisao", x["decisao"]), ("acao", x["acao"]), ("data", x["data"]), ("content_hash_parecer", x["content_hash"]), ("hash_novo", h_novo)]))
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
    meta["titulo"] = "Protocolos de Oncologia 2025 — consolidado + intake revisão lote 3 (export 15/09/2026: 14/09 + pendências de 16/08) (re-run 2026-07-22, 25 tumores)"
    meta["gerado_em"] = HOJE
    meta["total_tumores"] = len(por_tumor)
    meta["total_regimes"] = len(regimes)
    meta["distribuicao_selo"] = dict(placar)
    meta["por_tumor"] = por_tumor
    meta["politica"] = meta_ant.get("politica")
    meta["substitui"] = ORIGEM_RUN
    meta["publicacao"] = "NÃO publicado: RUN_ATIVO intocado; aguarda (1) frente da secretária liberar o backend, (2) Portão A (--check-dois) neste run, (3) autorização humana. Só então: build-data, restart, migration de aplicada_em (backend-pendente/)."
    meta["revisao_humana"] = OrderedDict([
        ("lote", LOTE), ("status", "aplicada"), ("data", HOJE), ("decidido_por", REVISOR), ("arquivo", "revisao-decisoes.json"),
        ("reconciliacao_lote2", OrderedDict([("decisoes_conferidas", len(lote2)), ("re_executadas", 0),
            ("nota", "27 decisões de 12–13/09 (17 triada_pendente_execucao + 10 aguardando_re_revisao) conferidas no corpus ativo: hash, notas_revisao[lote=2], historico intake-lote2 e prova por ação. Marcação de aplicada_em preparada em backend-pendente/ — entra quando o backend estiver livre.")])),
        ("decisoes_lote", len(lote3) + len(pend)), ("aprovados_registrados", len(aprovados)), ("aprovados_decisao_revisao_flip", flip),
        ("placar_por_acao", [OrderedDict([("acao", a), ("total", n), ("status", dict(Counter(x["status"] for x in RESULTADO if x["acao"] == a)))])
                             for a, n in Counter(x["acao"] for x in RESULTADO).items()]),
        ("resultado", RESULTADO),
        ("triagem_manual", TRIAGEM),
        ("refutados", []),
        ("excluidos", []),
        ("regimes_novos", [OrderedDict([("regimen_id", n["regimen_id"]), ("origem_decisao", "mama-met-hrpos-1l-ht-isolada (2026-08-16)"), ("selo", n["consolidacao"]["selo_confianca"]), ("doi", n["referencia"]["doi"])]) for n in novos_ht]),
        ("referencias_verificadas", [OrderedDict([("doi", k), ("congruente", v["ok"]), ("primeiro_autor", v["primeiro_autor"]), ("ano", v["ano"]), ("estudo", v["estudo"]), ("tema", v["tema"])]) for k, v in VERIFICADAS.items()]),
        ("primitivos_novos", []),
        ("elegibilidade_resultado", ELEG_RESULTADO),
        ("rehash", rehash),
        ("pareceres_expirados", expirados),
        ("pareceres_ja_expirados_antes_do_lote", ja_expirados),
        ("re_revisao", RE_REVISAO),
        ("app_pendencias", ["consolidacao.referencias_complementares[] (DeLLphi-304 no tarlatamabe; CheckMate 9DW no HCC) não é renderizado pela app — está no dado; exibir é mudança de app (portão B)",
                            "verificacao.esmo_mcbs.divergencia_revisor (ASCENT 5×4) não é renderizado — a app mostra o eixo como 'diverge' (flag divergencia_revisor visível nas flags)",
                            "rótulo do enum `cenario` para testículo (pendência do lote 2, segue aberta)"]),
    ])
    meta["revisao_humana_lotes_anteriores"] = lotes_ant
    for k, vv in meta_ant.items():
        if k not in meta:
            meta[k] = vv
    data["meta"] = meta
    data["regimes"] = regimes
    with open(AGG, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)

    # fatias por tumor: regimes IDÊNTICOS ao agregado (check [8]); vocabulário regravado (sem primitivo novo neste lote)
    for t, campos in vocab.items():
        f = os.path.join(AQUI, t, "v1", "regimes-consolidados.json")
        pt = json.load(open(f, encoding="utf-8"), object_pairs_hook=OrderedDict)
        rs = [r for r in regimes if r["tumor"] == t]
        pt["meta"]["gerado_em"] = HOJE
        pt["meta"]["total_regimes"] = len(rs)
        pt["meta"]["distribuicao_selo"] = dict(Counter(r["consolidacao"]["selo_confianca"] for r in rs))
        pt["meta"]["derivado_de"] = f"{ESTE_RUN} (agregado; lote 3 de revisão)"
        pt["meta"]["revisao_humana"] = OrderedDict([("status", "lote 3 aplicado"), ("data", HOJE)])
        pt["campos_primitivos"] = campos
        pt["regimes"] = rs
        with open(f, "w", encoding="utf-8") as fh:
            json.dump(pt, fh, ensure_ascii=False, indent=2)

    # sidecar de hashes DESTE run (não toca backend/data)
    with open(os.path.join(AQUI, "content-hashes.json"), "w", encoding="utf-8") as fh:
        json.dump({"gerado_em": HOJE, "run": ESTE_RUN, "hashes": hashes_depois}, fh, ensure_ascii=False, indent=0)

    # amostra sorteada (semente fixa = reprodutível) de 3 execuções: nota gravada × texto do revisor lado a lado
    random.seed(20260915)
    amostra = random.sample(AMOSTRA_EXEC, 3)
    relatorio = OrderedDict([
        ("placar_por_acao", meta["revisao_humana"]["placar_por_acao"]), ("resultado", RESULTADO), ("triagem_manual", TRIAGEM),
        ("regimes_novos", meta["revisao_humana"]["regimes_novos"]), ("pareceres_expirados", expirados), ("ja_expirados_antes", ja_expirados),
        ("amostra_sorteada", amostra), ("re_revisao", RE_REVISAO), ("placar_selo", dict(placar)), ("total_regimes", len(regimes)),
        ("hashes_mudaram", sorted(mudaram)), ("aprovados", len(aprovados)), ("aprovados_decisao_revisao_flip", flip),
        ("verificacao_dellphi304", OrderedDict([("doi", "10.1056/NEJMoa2502099"), ("pmid", VERIFICADAS["10.1056/NEJMoa2502099"]["pmid"]), ("citacao", VERIFICADAS["10.1056/NEJMoa2502099"]["citacao"]), ("abstract", ABSTRACT["DeLLphi-304"]),
            ("confere_com_revisor", "n=509; SG 13,6 vs 8,3 m; HR 0,60 (0,47–0,77); p<0,001 — SIM. PFS/RO citados pelo revisor não constam do abstract. Custo-efetividade citada não verificada.")]))])
    with open(os.path.join(AQUI, "relatorio-intake-lote3.json"), "w", encoding="utf-8") as fh:
        json.dump(relatorio, fh, ensure_ascii=False, indent=2)
    print(json.dumps(relatorio, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
