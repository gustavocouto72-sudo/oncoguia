# -*- coding: utf-8 -*-
"""Raiz do repo e run ATIVO resolvidos a partir da posição deste arquivo. A fonte única
do corpus publicado é squads/mbe-oncologia/RUN_ATIVO — nunca "o run mais novo" nem
caminho absoluto de máquina."""
import os, sys

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
