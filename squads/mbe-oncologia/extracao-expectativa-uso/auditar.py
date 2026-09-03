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
C = CORPUS
regs = json.load(open(C))["regimes"]
cand = json.load(open(os.path.join(SP, "candidatos.json")))
por_tipo = {}
linhas = []
for r in regs:
    p, tr = propor(r)
    por_tipo[p["tipo"]] = por_tipo.get(p["tipo"], 0) + 1
    doi = (r.get("referencia") or {}).get("doi")
    tem_pfs = bool(doi and cand.get(doi, {}).get("frases_pfs"))
    linhas.append({"id": r["regimen_id"], "tumor": r.get("tumor"), "cen": r.get("cenario"),
                   "prop": p, "trace": tr, "doi": doi, "pfs?": tem_pfs,
                   "esq": (r.get("esquema") or "")[:150]})
json.dump(linhas, open(os.path.join(SP, "auditoria.json"), "w"), ensure_ascii=False, indent=1)
print(por_tipo)
