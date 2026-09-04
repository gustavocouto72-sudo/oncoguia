#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Amostra SORTEADA de composições, com o texto original do esquema ao lado — para
conferência humana antes de qualquer tela usar o dado.

O sorteio é reprodutível e o comando fica visível no cabeçalho: quem duvida da amostra
roda de novo com outra semente e confere outras cinco. Sem semente, usa 5 aleatórias e
imprime a semente usada, para a conferência poder ser repetida.

  python3 amostra.py [--n 5] [--semente 20260904] [--completas | --indeterminadas]
"""
import json, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from caminhos import CORPUS


def arg(nome, default=None):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else default


def main():
    n = int(arg("--n", 5))
    semente = int(arg("--semente", random.randrange(10 ** 8)))
    regimes = json.load(open(CORPUS, encoding="utf-8"))["regimes"]
    pool = [r for r in regimes if r.get("composicao")]
    if not pool:
        sys.exit("corpus sem bloco `composicao` — rode aplicar.py --aplicar antes.")
    if "--completas" in sys.argv:
        pool = [r for r in pool if r["composicao"]["completa"]]
    if "--indeterminadas" in sys.argv:
        pool = [r for r in pool if not r["composicao"]["completa"]]
    random.seed(semente)
    amostra = random.sample(pool, min(n, len(pool)))
    filtro = " --completas" if "--completas" in sys.argv else (
        " --indeterminadas" if "--indeterminadas" in sys.argv else "")
    print(f"# Amostra de composição — {len(amostra)} de {len(pool)} regimes elegíveis")
    print(f"# Comando para reproduzir exatamente esta amostra:")
    print(f"#   python3 amostra.py --n {n} --semente {semente}{filtro}\n")
    for i, r in enumerate(amostra, 1):
        c = r["composicao"]
        print(f"[{i}] {r['regimen_id']}  ({r.get('tumor')} · {r.get('cenario')})")
        print(f"    ESQUEMA (texto original, fonte de tudo abaixo):")
        print(f"      {r.get('esquema')}")
        print(f"    COMPOSIÇÃO derivada — completa={c['completa']} indeterminado={c['indeterminado']}")
        for it in c["itens"]:
            dose = ("indeterminado" if it["indeterminado"]
                    else f"{it['dose_valor']:g} {it['dose_unidade']}")
            print(f"      · {it['farmaco']}: {dose}"
                  f" | via={it['via'] or '—'} | dias={it['dias_do_ciclo'] or '—'}")
            if it["nota"]:
                print(f"          nota: {it['nota']}")
        if c.get("nota"):
            print(f"    NOTA DO BLOCO: {c['nota']}")
        print()


main()
