#!/usr/bin/env python3
"""
Casos SINTÉTICOS para provar que o check [11] do Portão A barra cada uma das 7 regras.
NADA aqui é evidência clínica: os blocos `grade` são inventados de propósito (as
transcrições são texto sintético com números escolhidos para o teste). Os regimes
são clones de regimes reais do RUN_ATIVO — só o bloco verificacao.grade é trocado —
para que os demais checks do portão (expectativa_uso, composicao, incorporação...)
passem e a falha observada seja SÓ a do [11].

Uso: python3 gerar_casos.py  → escreve regimes-consolidados.json ao lado.
Esperado ao rodar o portão nesta pasta: 1 controle passa; cada mutante falha na
regra nomeada em `_esperado`.
"""
import json, os, copy, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
SQUAD = os.path.abspath(os.path.join(AQUI, "..", "..", "..", ".."))
rel = [l.strip() for l in open(os.path.join(SQUAD, "RUN_ATIVO")) if l.strip() and not l.startswith("#")][0]
ATIVO = json.load(open(os.path.join(SQUAD, "output", rel, "regimes-consolidados.json")))["regimes"]
por_id = {r["regimen_id"]: r for r in ATIVO}

def clone(rid, novo_id):
    r = copy.deepcopy(por_id[rid])
    r["regimen_id"] = novo_id
    r["consolidacao"]["aprovacoes"] = []
    return r

def bloco_bom(doi, farmacos):
    """Bloco schema 2 que fecha todas as regras (RCT fase 3, SG, IC folgado, >300 eventos)."""
    return {
        "schema": 2, "status": "re_derivado", "afirmado_protocolo": None,
        "desfecho_critico": "SG",
        "desenho": {"tipo": "rct_fase3", "cegamento": "aberto", "n": 861,
                    "descricao": "SINTÉTICO — RCT fase 3 aberto, N=861"},
        "efeito": {"medida": "HR", "valor": 0.68, "ic95": [0.55, 0.84], "sentido_beneficio": "menor",
                   "eventos": 420, "analise": "final",
                   "transcricao": "SINTÉTICO: overall survival was longer with the experimental arm (hazard ratio for death, 0.68; 95% CI, 0.55 to 0.84; P<0.001), 420 deaths.",
                   "fonte_transcricao": "europepmc_abstract"},
        "pivo": {"intervencao": farmacos, "comparador": "padrão da época",
                 "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
                 "primario_positivo": True, "sustenta": True,
                 "por": "SINTÉTICO — braço experimental = regime; primário SG positivo"},
        "dominios": {
            "risco_vies":      {"nota": 0, "por": "aberto, desfecho duro (SG)"},
            "inconsistencia":  {"nota": 0, "por": "ensaio único, sem contradição"},
            "indireta":        {"nota": 0, "por": "PICO = protocolo"},
            "imprecisao":      {"nota": 0, "por": "420 eventos; IC 0,55–0,84 exclui nulo com folga"},
            "vies_publicacao": {"nota": 0, "por": "registro prévio"}},
        "elevacoes": [], "certeza": "A", "substituto_excecao": None, "pivo_nao_sustenta": False,
        "recomendacao": {"forca": "forte", "direcao": "a_favor", "base": "SINTÉTICO — incorporado, MCBS 4", "sem_mcbs_por": None},
        "valor_rederivado": "1A",
        "justificativa": "SINTÉTICO — controle que deve passar.",
        "fonte": "https://doi.org/" + doi, "motivo_indeterminado": None,
    }

casos = []
def add(rid_base, novo_id, esperado, muta):
    r = clone(rid_base, novo_id)
    g = bloco_bom(r["referencia"]["doi"], [f["nome"] for f in r["farmacos"]])
    muta(g, r)
    r["verificacao"]["grade"] = g
    r["_esperado"] = esperado
    casos.append(r)

# Base incorporada com MCBS 4: axitinibe + pembrolizumabe (KEYNOTE-426)
BASE = "renal-met-intalto-axitinibe-pembrolizumabe"

# S0 — controle: deve PASSAR
add(BASE, "sint-00-controle", "PASSA", lambda g, r: None)

# S1 — regra 1: A sem eventos ≥300 e sem efeito grande (HR 0,78; IC sup 0,93 > 0,85), domínios todos 0
def m1(g, r):
    g["efeito"].update({"valor": 0.78, "ic95": [0.65, 0.93], "eventos": None,
        "transcricao": "SINTÉTICO: hazard ratio for death, 0.78; 95% CI, 0.65 to 0.93."})
    g["dominios"]["imprecisao"]["por"] = "IC exclui nulo"
add(BASE, "sint-01-regra1-A-sem-eventos", "FALHA regra 1", m1)

# S2 — regra 2: desfecho crítico SLP (substituto), indireta 0, certeza A
def m2(g, r):
    g["desfecho_critico"] = "SLP"
    g["efeito"]["transcricao"] = "SINTÉTICO: progression-free survival hazard ratio 0.68 (95% CI 0.55–0.84), 420 events."
add(BASE, "sint-02-regra2-SLP-sem-SG-em-A", "FALHA regra 2", m2)

# S3 — regra 3: fase II randomizado com elevação +2 (aritmética C+2=A fecha) — mas nunca A
def m3(g, r):
    g["desenho"]["tipo"] = "rct_fase2"
    g["elevacoes"] = [{"tipo": "magnitude_muito_grande", "valor": 2, "por": "SINTÉTICO — RR < 0,2"}]
add(BASE, "sint-03-regra3-faseII-em-A", "FALHA regra 3", m3)

# S4 — regra 4: HR 0,82 (0,67–1,00) com imprecisão 0 (certeza B pela aritmética via risco de viés -1)
def m4(g, r):
    g["efeito"].update({"valor": 0.82, "ic95": [0.67, 1.00], "eventos": 380,
        "transcricao": "SINTÉTICO: hazard ratio for death 0.82 (95% CI 0.67–1.00), 380 deaths."})
    g["dominios"]["risco_vies"] = {"nota": -1, "por": "SINTÉTICO — perdas de seguimento"}
    g["certeza"] = "B"; g["valor_rederivado"] = "1B"
add(BASE, "sint-04-regra4-IC-cruza-nulo-imprecisao-0", "FALHA regra 4", m4)

# S5a — regra 5: regime NÃO incorporado com forte a favor
add("pancreas-met-nabpac-gem-nao-incorporado", "sint-05a-regra5-nao-incorporado-a-favor-nao-incorporado",
    "FALHA regra 5 (direção)", lambda g, r: None)

# S5b — regra 5: incorporado, mas ESMO-MCBS < 3 com forte a favor (escolhido do corpus: 1º incorporado com MCBS 1–2)
sys.path.insert(0, SQUAD)
from verificar_dados import parse_mcbs, eh_nao_incorporado
def _mcbs_baixo(r):
    p = parse_mcbs(r["verificacao"]["esmo_mcbs"].get("valor_rederivado"))
    return p and p[0] == "paliativo" and p[1] < 3 and not eh_nao_incorporado(r)
base_mcbs = next(r["regimen_id"] for r in ATIVO if _mcbs_baixo(r))
add(base_mcbs, "sint-05b-regra5-forte-com-MCBS-baixo", "FALHA regra 5 (MCBS)", lambda g, r: None)

# S6a — regra 6: pivô cuja intervenção não contém um dos fármacos do regime
def m6a(g, r):
    g["pivo"]["intervencao"] = ["Pembrolizumabe"]        # regime é axitinibe + pembrolizumabe
add(BASE, "sint-06a-regra6-farmaco-fora-do-pivo", "FALHA regra 6 (cobertura)", m6a)

# S6b — regra 6: pivô negativo no primário, mas declarado como sustenta=true e certeza A
def m6b(g, r):
    g["pivo"]["primario_positivo"] = False
add(BASE, "sint-06b-regra6-primario-negativo", "FALHA regra 6 (sustenta)", m6b)

# S7a — regra 7: número do efeito não está na transcrição
def m7a(g, r):
    g["efeito"]["valor"] = 0.53                              # transcrição continua dizendo 0.68
add(BASE, "sint-07a-regra7-valor-fora-da-transcricao", "FALHA regra 7", m7a)

# S7b — regra 7: sem transcrição, mas status re_derivado com certeza A
def m7b(g, r):
    g["efeito"]["transcricao"] = ""
add(BASE, "sint-07b-regra7-sem-transcricao", "FALHA regra 7", m7b)

# S9 — regra 3 (prompts §7): elevação declarada com domínio rebaixado (observacional, risco de viés -1, +2 magnitude)
def m9(g, r):
    g["desenho"]["tipo"] = "observacional"
    g["dominios"]["risco_vies"] = {"nota": -1, "por": "SINTÉTICO — confusão residual"}
    g["elevacoes"] = [{"tipo": "magnitude_muito_grande", "valor": 2, "por": "SINTÉTICO"}]
    g["certeza"] = "B"; g["valor_rederivado"] = "1B"          # aritmética C-1+2 = B fecha; a regra barra
add(BASE, "sint-09-regra3-elevacao-com-rebaixamento", "FALHA regra 3 (elevação c/ rebaixamento)", m9)

# C1 — eventos em algarismo que não está na transcrição, sem "deduzido de"
def mc1(g, r):
    g["efeito"]["eventos"] = 640; g["efeito"]["eventos_por"] = "estimativa"
add(BASE, "sint-C1-eventos-sem-deducao-declarada", "FALHA regra 7 (C1)", mc1)

# C2 — comparador obsoleto sem declarar se muda a decisão de hoje
def mc2(g, r):
    g["pivo"]["comparador_padrao_atual"] = False
add(BASE, "sint-C2-comparador-obsoleto-sem-decisao", "FALHA C2", mc2)

# C4 — análise interina (sem versão madura) com imprecisão 0
def mc4(g, r):
    g["efeito"]["analise"] = "interina"
add(BASE, "sint-C4-interina-sem-rebaixar", "FALHA regra 4 (C4)", mc4)

# C5 — 87 eventos + IC que inclui o nulo, imprecisão só -1 (tem de ser -2); rct_fase2 parte de A
def mc5(g, r):
    g["desenho"]["tipo"] = "rct_fase2"
    g["efeito"].update({"valor": 0.78, "ic95": [0.55, 1.10], "eventos": 87,
        "transcricao": "SINTÉTICO: hazard ratio 0.78 (95% CI 0.55-1.10), 87 events."})
    g["dominios"]["imprecisao"] = {"nota": -1, "por": "SINTÉTICO"}
    g["certeza"] = "B"; g["valor_rederivado"] = "1B"
add(BASE, "sint-C5-faseII-imprecisao-muito-seria", "FALHA regra 4 (C5)", mc5)

# C8a — adjuvante com SLD como desfecho crítico duro, certeza A: deve PASSAR
def mc8a(g, r):
    g["desfecho_critico"] = "SLD"
    g["efeito"]["transcricao"] = "SINTÉTICO: disease-free survival hazard ratio 0.68 (95% CI 0.55-0.84), 420 events."
    g["recomendacao"]["base"] = "SINTÉTICO — adjuvante, MCBS A"
add("renal-adj-pembrolizumab", "sint-C8a-adjuvante-SLD-duro-em-A", "PASSA", mc8a)

# C8b — metastático declarando SLD como desfecho crítico: deve FALHAR
def mc8b(g, r):
    g["desfecho_critico"] = "SLD"
    g["efeito"]["transcricao"] = "SINTÉTICO: disease-free survival hazard ratio 0.68 (95% CI 0.55-0.84), 420 events."
add(BASE, "sint-C8b-metastatico-declara-SLD", "FALHA C8", mc8b)

# C9a — corpo alegado no texto sem referencia_corpo, certeza A: deve FALHAR
def mc9a(g, r):
    g["efeito"].update({"eventos": None, "valor": 0.78, "ic95": [0.65, 0.93], "transcricao": "SINTÉTICO: hazard ratio for death, 0.78; 95% CI, 0.65 to 0.93."})
    g["dominios"]["imprecisao"]["por"] = "eventos < 300 no ensaio, mas o corpo de evidência (meta-análise) sustenta A"
add(BASE, "sint-C9a-corpo-alegado-sem-referencia", "FALHA C9", mc9a)

# C9b — referencia_corpo com certeza declarada MODERADA e certeza A: deve FALHAR (teto)
def mc9b(g, r):
    g["desenho"]["tipo"] = "meta_analise_rct"
    g["efeito"].update({"eventos": None, "valor": 0.81, "ic95": [0.71, 0.92], "transcricao": "SINTÉTICO: pooled HR 0.81 (95% CI 0.71 to 0.92), 750 participants, moderate-quality evidence."})
    g["pivo"]["referencia_corpo"] = {"doi": "10.1002/14651858.cd000000", "tipo": "cochrane", "comparacao": "SINTÉTICO 2L vs BSC", "certeza_declarada": "moderada", "por": "SINTÉTICO"}
    g["fonte"] = "https://doi.org/10.1002/14651858.cd000000"
add(BASE, "sint-C9b-corpo-moderada-em-A", "FALHA C9", mc9b)

# C9c — referencia_corpo com certeza declarada ALTA, IC exclui o nulo, domínios 0, certeza A: deve PASSAR
def mc9c(g, r):
    mc9b(g, r)
    g["pivo"]["referencia_corpo"]["certeza_declarada"] = "alta"
    g["efeito"]["transcricao"] = "SINTÉTICO: pooled HR 0.81 (95% CI 0.71 to 0.92), 750 participants, high-quality evidence."
add(BASE, "sint-C9c-corpo-alta-em-A", "PASSA", mc9c)

# S8 — forma: certeza declarada ≠ aritmética dos domínios (imprecisão -1 e ainda A)
def m8(g, r):
    g["dominios"]["imprecisao"] = {"nota": -1, "por": "SINTÉTICO"}
add(BASE, "sint-08-forma-certeza-nao-e-aritmetica", "FALHA aritmética", m8)

out = {"meta": {"titulo": "CASOS SINTÉTICOS — prova do check [11]; NÃO é corpus", "sintetico": True},
       "regimes": casos}
json.dump(out, open(os.path.join(AQUI, "regimes-consolidados.json"), "w"), ensure_ascii=False, indent=1)
print(f"{len(casos)} casos escritos")
for c in casos:
    print(f"  {c['regimen_id']:60} esperado: {c['_esperado']}")
