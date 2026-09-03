#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Monta expectativa_uso para cada regime = regras mecânicas + overrides curados.
Falha alto se algum regime ficar sem decisão."""
import os, sys

# Raiz do repo e run ATIVO resolvidos a partir da posição deste arquivo: a fonte única do
# corpus publicado é squads/mbe-oncologia/RUN_ATIVO, nunca "o run mais novo" nem um
# caminho absoluto de máquina.
AQUI = os.path.dirname(os.path.abspath(__file__))
SQUAD = os.path.dirname(AQUI)
RAIZ = os.path.dirname(os.path.dirname(SQUAD))

def run_ativo():
    linhas = [l.strip() for l in open(os.path.join(SQUAD, "RUN_ATIVO"), encoding="utf-8")
              if l.strip() and not l.strip().startswith("#")]
    if not linhas:
        sys.exit("RUN_ATIVO vazio — sem corpus publicado para trabalhar.")
    return os.path.join(SQUAD, "output", linhas[-1])

RUN = run_ativo()
CORPUS = os.path.join(RUN, "regimes-consolidados.json")

import json, os, sys
SP = AQUI; sys.path.insert(0, SP)
from regras import propor
import overrides_a, overrides_b

OV = {}
OV.update(overrides_a.OV)
OV.update(overrides_b.OV)

C = CORPUS

CAMPOS_FIXA = ["tipo", "ciclos", "periodicidade_dias", "duracao_total_semanas",
               "fonte", "indeterminado", "nota", "selo"]
CAMPOS_AP = ["tipo", "duracao_mediana_tratamento_meses", "proxy", "pfs_mediana_meses",
             "fonte_doi", "indeterminado", "nota", "selo"]

def normalizar(b):
    """Ordem de chaves estável + selo obrigatório 'estimativa'."""
    b = dict(b)
    b.pop("motivo", None)
    b["selo"] = "estimativa"
    b.setdefault("nota", None)
    b.setdefault("indeterminado", False)
    campos = CAMPOS_FIXA if b["tipo"] == "fixa" else CAMPOS_AP
    for c in campos:
        b.setdefault(c, None)
    return {c: b[c] for c in campos}

def construir():
    corpus = json.load(open(C))
    out, faltando = {}, []
    for r in corpus["regimes"]:
        rid = r["regimen_id"]
        if rid in OV:
            b = dict(OV[rid])
        else:
            p, _ = propor(r)
            if p["tipo"] == "indefinido":
                faltando.append(rid); continue
            b = dict(p)
            b.setdefault("indeterminado", False)
        out[rid] = normalizar(b)
    if faltando:
        print("SEM DECISÃO:", len(faltando)); [print("  ", x) for x in faltando]
        sys.exit(1)
    json.dump(out, open(os.path.join(SP, "expectativa_uso.json"), "w"),
              ensure_ascii=False, indent=1)
    print(f"decidido: {len(out)}/{len(corpus['regimes'])} regimes  (overrides usados: {sum(1 for r in corpus['regimes'] if r['regimen_id'] in OV)})")
    return out

if __name__ == "__main__":
    construir()
