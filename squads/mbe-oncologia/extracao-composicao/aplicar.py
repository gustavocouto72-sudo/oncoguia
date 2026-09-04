#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Injeta `composicao` no consolidado e nos arquivos por tumor do run ativo.

Guardas (as mesmas da extração de expectativa de uso, e pelo mesmo motivo):
  • content_hash de TODO regime tem de ficar idêntico — o hash cobre selo, eixos de
    verificação, referência e regra de elegibilidade, não este bloco. Se algum mudasse,
    os pareceres do revisor daquele regime expirariam sem motivo.
  • o conjunto de DOIs tem de ficar idêntico: composição sai do texto do esquema, e
    texto do esquema não introduz referência nenhuma.
"""
import json, os, sys, importlib.util
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from caminhos import AQUI, RAIZ, RUN

AGG = os.path.join(RUN, "regimes-consolidados.json")

# reusa a função de hash do app (fonte única da regra de expiração)
spec = importlib.util.spec_from_file_location("bd", os.path.join(RAIZ, "app", "build-data.py"))
bd = importlib.util.module_from_spec(spec)
sys.modules["bd"] = bd
spec.loader.exec_module(bd)
content_hash = bd.content_hash

COMP = json.load(open(os.path.join(AQUI, "composicao.json"), encoding="utf-8"))


def arquivos():
    yield AGG
    for d in sorted(os.listdir(RUN)):
        f = os.path.join(RUN, d, "v1", "regimes-consolidados.json")
        if os.path.isfile(f):
            yield f


def main():
    aplicar = "--aplicar" in sys.argv
    hashes_antes, hashes_depois = {}, {}
    dois_antes, dois_depois = set(), set()
    n_esc = 0
    for f in arquivos():
        data = json.load(open(f, encoding="utf-8"))
        rs = data["regimes"] if isinstance(data, dict) else data
        for r in rs:
            rid = r["regimen_id"]
            hashes_antes[rid] = content_hash(r)
            d = (r.get("referencia") or {}).get("doi")
            if d: dois_antes.add(d)
            if rid not in COMP:
                print("!! sem composicao:", rid); sys.exit(1)
            r["composicao"] = COMP[rid]
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
    print(f"DOIs antes={len(dois_antes)} depois={len(dois_depois)} "
          f"novos={sorted(dois_depois - dois_antes)} sumidos={sorted(dois_antes - dois_depois)}")
    if mudou or (dois_depois - dois_antes):
        sys.exit(1)
    print("APLICADO" if aplicar else "ensaio (dry-run) — nada escrito")


main()
