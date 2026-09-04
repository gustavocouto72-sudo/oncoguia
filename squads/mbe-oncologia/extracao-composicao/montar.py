#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""regras.py sobre o corpus do RUN_ATIVO -> composicao.json (295 blocos).

Não existe arquivo de overrides aqui, ao contrário da extração de expectativa de uso, e
isso é deliberado: lá o julgamento humano escolhia QUAL número do abstract usar; aqui
escolher entre "cisplatina OU carboplatina" seria decidir a conduta em vez de ler o
texto. O que o esquema não resolve fica indeterminado e vai para a tela como "sem dado".
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from regras import compor, UNIDADES_VALIDAS
from caminhos import CORPUS, AQUI

SAIDA = os.path.join(AQUI, "composicao.json")


def main():
    data = json.load(open(CORPUS, encoding="utf-8"))
    fora = []
    out = {}
    for r in data["regimes"]:
        b = compor(r)
        # Todo bloco nasce e permanece 'estimativa': isto é leitura de texto, não
        # prescrição conferida. `fonte` é sempre o esquema — nenhuma bula entra aqui.
        b["fonte"] = "esquema"
        b["selo"] = "estimativa"
        for it in b["itens"]:
            if it["dose_unidade"] and it["dose_unidade"] not in UNIDADES_VALIDAS:
                fora.append(f"{r['regimen_id']}/{it['farmaco']}: {it['dose_unidade']}")
        out[r["regimen_id"]] = b
    if fora:
        print("!! unidade fora do vocabulário fechado:", *fora, sep="\n   ")
        sys.exit(1)
    with open(SAIDA, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)
    comp = sum(1 for b in out.values() if b["completa"])
    print(f"composicao.json: {len(out)} blocos — {comp} completos, {len(out)-comp} indeterminados")


main()
