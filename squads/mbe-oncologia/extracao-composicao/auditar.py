#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Roda regras.py sobre o corpus do RUN_ATIVO e imprime o placar: o que a máquina
resolve sozinha e o que sobra. Não escreve nada."""
import json, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from regras import compor
from caminhos import CORPUS

def main():
    data = json.load(open(CORPUS, encoding="utf-8"))
    regimes = data["regimes"]
    n_comp = n_itens = n_itens_ok = 0
    motivos = collections.Counter()
    por_tumor = collections.defaultdict(lambda: [0, 0])
    sem_lexico = []
    for r in regimes:
        b = compor(r)
        n_itens += len(b["itens"])
        n_itens_ok += sum(1 for i in b["itens"] if not i["indeterminado"])
        t = r.get("tumor") or "?"
        por_tumor[t][1] += 1
        if b["completa"]:
            n_comp += 1
            por_tumor[t][0] += 1
        else:
            if not b["itens"]:
                sem_lexico.append(r["regimen_id"])
            for it in b["itens"]:
                if it["indeterminado"]:
                    motivos[(it["nota"] or "")[:60]] += 1
        for it in b["itens"]:
            if it["dose_unidade"]:
                motivos["unidade: " + it["dose_unidade"]] += 0
    print(f"regimes: {len(regimes)}  completos: {n_comp} ({100*n_comp//len(regimes)}%)  "
          f"indeterminados: {len(regimes)-n_comp}")
    print(f"itens: {n_itens}  resolvidos: {n_itens_ok}  indeterminados: {n_itens-n_itens_ok}")
    print(f"regimes sem NENHUM fármaco do léxico: {len(sem_lexico)}")
    print("\nmotivos de item indeterminado:")
    for k, v in motivos.most_common():
        if v: print(f"  {v:4d}  {k}")
    print("\nplacar por tumor (completos/total):")
    for t in sorted(por_tumor):
        a, b = por_tumor[t]
        print(f"  {t:22s} {a:3d}/{b:3d}")
    unid = collections.Counter()
    for r in regimes:
        for it in compor(r)["itens"]:
            if it["dose_unidade"]: unid[it["dose_unidade"]] += 1
    print("\nunidades usadas:", dict(unid.most_common()))
    if sem_lexico:
        print("\nsem léxico (amostra):", ", ".join(sem_lexico[:15]))

main()
