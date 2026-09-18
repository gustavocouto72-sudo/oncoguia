#!/usr/bin/env python3
"""Gera a tabela do REFERENDO-CLINICO a partir dos JSONs (antes = RUN_ATIVO; depois = ondas)."""
import json, os, re
AQUI = os.path.dirname(os.path.abspath(__file__)); SQUAD = os.path.abspath(os.path.join(AQUI, "..", ".."))
rel = [l.strip() for l in open(os.path.join(SQUAD, "RUN_ATIVO")) if l.strip() and not l.startswith("#")][0]
ANTES = {r["regimen_id"]: r for r in json.load(open(os.path.join(SQUAD, "output", rel, "regimes-consolidados.json")))["regimes"]}
ONDAS = [("Renal (piloto v2.1)", "piloto-renal"), ("Esôfago-estômago (onda 1)", "onda-1-esofago-estomago"),
         ("Colorretal (onda 2)", "onda-2-colorretal"), ("Colo de útero (onda 3)", "onda-3-colo-utero")]
NUM = {"forte": "1", "condicional": "2"}
def pratica(antes, g):
    if g["status"] == "indeterminado":
        return "**virou indeterminado** — o pivô registrado não sustenta / não traz efeito"
    dep = g["valor_rederivado"]; rec = g["recomendacao"]; out = []
    if rec["direcao"] == "pendente_revisor": out.append("**direção pendente (C6)**")
    elif rec["direcao"] == "contra": out.append("**direção: contra** (não incorporado)")
    if antes and dep:
        if antes == dep: out.append("mesmo valor")
        else:
            if antes[0] != dep[0]: out.append(f"força {antes[0]}→{dep[0]}")
            if antes[1:] != dep[1:]: out.append(f"certeza {antes[1:]}→{dep[1:]}")
    elif not antes: out.append("sem valor antes")
    return "; ".join(out)
def decisivo(g):
    if g["status"] == "indeterminado": return g["motivo_indeterminado"][:160].replace("|", "/")
    d = g["dominios"]; neg = [f"{k} {v['nota']}" for k, v in d.items() if v["nota"] < 0]
    tags = []
    pv = g.get("pivo") or {}
    if pv.get("referencia_corpo"): tags.append("C9 corpo")
    if pv.get("referencia_atualizada"): tags.append("C4 madura")
    if g.get("substituto_excecao"): tags.append("exceção crossover")
    return (", ".join(neg) if neg else "nenhum domínio rebaixado") + (" · " + "/".join(tags) if tags else "")
linhas = ["| # | regime | antes | depois | certeza · força · direção | o que muda na prática | domínio decisivo | fonte do card | ✓/✗ |",
          "|---|---|---|---|---|---|---|---|---|"]
tot = {"n": 0, "igual": 0, "mudou": 0, "contra": 0, "indet": 0, "pend": 0}
placar_antes, placar_depois = {}, {}
n = 0
for titulo, pasta in ONDAS:
    regs = json.load(open(os.path.join(AQUI, pasta, "regimes-consolidados.json")))["regimes"]
    linhas.append(f"| **{titulo}** | | | | | | | | |")
    for r in regs:
        n += 1; tot["n"] += 1
        rid = r["regimen_id"]; g = r["verificacao"]["grade"]
        antes = (ANTES[rid]["verificacao"]["grade"].get("valor_rederivado") or "—")
        placar_antes[antes] = placar_antes.get(antes, 0) + 1
        if g["status"] == "indeterminado":
            dep, cfd = "indet.", "—"; tot["indet"] += 1
        else:
            dep = g["valor_rederivado"]; rec = g["recomendacao"]
            cfd = f"{g['certeza']} · {rec['forca']} · {rec['direcao'].replace('_', ' ')}"
            if rec["direcao"] == "contra": tot["contra"] += 1
            if rec["direcao"] == "pendente_revisor": tot["pend"] += 1
            if antes == dep and rec["direcao"] == "a_favor": tot["igual"] += 1
            else: tot["mudou"] += 1
        placar_depois[dep] = placar_depois.get(dep, 0) + 1
        fonte = g["fonte"].replace("https://doi.org/", "")
        linhas.append(f"| {n} | `{rid}` | {antes} | **{dep}** | {cfd} | {pratica(antes, g)} | {decisivo(g)} | {fonte} | ☐ concordo ☐ discordo |")
tabela = "\n".join(linhas)
placar = "| valor | antes | depois |\n|---|---|---|\n" + "\n".join(f"| {k} | {placar_antes.get(k, 0)} | {placar_depois.get(k, 0)} |" for k in ["1A", "1B", "2A", "2B", "2C", "2D", "indet.", "—"] if placar_antes.get(k) or placar_depois.get(k))
open(os.path.join(AQUI, "_tabela_clinica.md"), "w").write(tabela)
open(os.path.join(AQUI, "_placar.md"), "w").write(placar)
print(placar); print(tot)
