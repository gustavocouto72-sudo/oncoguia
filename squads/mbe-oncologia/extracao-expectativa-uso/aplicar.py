#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Injeta expectativa_uso no consolidado e nos arquivos por tumor do run ativo.
Guardas: content_hash de TODO regime tem de ficar idêntico (senão a extração
expiraria pareceres do revisor) e o conjunto de DOIs tem de ficar idêntico."""
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

import json, os, sys, importlib.util
SP = AQUI

AGG = os.path.join(RUN, "regimes-consolidados.json")

# reusa a função de hash do app (fonte única da regra de expiração)
spec = importlib.util.spec_from_file_location(
    "bd", os.path.join(RAIZ, "app", "build-data.py"))
bd = importlib.util.module_from_spec(spec)
sys.modules["bd"] = bd
spec.loader.exec_module(bd)
content_hash = bd.content_hash

EXP = json.load(open(os.path.join(SP, "expectativa_uso.json")))

def arquivos():
    yield AGG
    for d in sorted(os.listdir(RUN)):
        f = os.path.join(RUN, d, "v1", "regimes-consolidados.json")
        if os.path.isfile(f):
            yield f

def regimes_de(data):
    return data["regimes"] if isinstance(data, dict) else data

def main():
    aplicar = "--aplicar" in sys.argv
    hashes_antes, dois_antes = {}, set()
    hashes_depois, dois_depois = {}, set()
    n_esc = 0
    for f in arquivos():
        data = json.load(open(f))
        rs = regimes_de(data)
        for r in rs:
            rid = r["regimen_id"]
            hashes_antes[rid] = content_hash(r)
            d = (r.get("referencia") or {}).get("doi")
            if d: dois_antes.add(d)
            if rid not in EXP:
                print("!! sem expectativa_uso:", rid); sys.exit(1)
            r["expectativa_uso"] = EXP[rid]
            hashes_depois[rid] = content_hash(r)
            d2 = (r.get("referencia") or {}).get("doi")
            if d2: dois_depois.add(d2)
            n_esc += 1
        if aplicar:
            with open(f, "w", encoding="utf-8") as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2)  # sem \n final: originais não têm
    mudou = [k for k in hashes_antes if hashes_antes[k] != hashes_depois[k]]
    print(f"regimes tocados: {n_esc}")
    print(f"content_hash alterados: {len(mudou)}  {'<-- ERRO' if mudou else '(nenhum: pareceres preservados)'}")
    print(f"DOIs antes={len(dois_antes)} depois={len(dois_depois)} novos={sorted(dois_depois-dois_antes)} sumidos={sorted(dois_antes-dois_depois)}")
    if mudou or (dois_depois - dois_antes):
        sys.exit(1)
    print("APLICADO" if aplicar else "ensaio (dry-run) — nada escrito")

main()
