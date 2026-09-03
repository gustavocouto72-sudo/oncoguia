#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Frases candidatas do abstract do pivotal: duração mediana de tratamento e PFS mediana.
Não decide nada — entrega a frase; a atribuição de braço exige leitura humana."""
import json, os, re, sys
SP = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SP)
from corpo import corpo_abstract

cache = json.load(open(os.path.join(SP, "abstracts.json")))

DUR_PAT = re.compile(
    r"median (?:duration|time) of (?:treatment|therapy|exposure|study treatment|study drug|"
    r"(?:the )?study (?:treatment|drug))"
    r"|median treatment duration|median duration of (?:study |trial |drug )*(?:treatment|exposure|therapy)"
    r"|treated for a median|median number of (?:treatment )?(?:cycles|doses|infusions)"
    r"|median of [\d.,·]+ (?:cycles|doses|infusions)|median (?:cycles|doses)"
    r"|received a median of", re.I)
PFS_PAT = re.compile(r"progression-free survival|progression free survival|median PFS|\bPFS\b|\brPFS\b|"
                     r"time to progression|\bTTP\b", re.I)
# Lancet/Elsevier usam ponto médio como separador decimal (13·5)
TEM_NUM = re.compile(r"\d+(?:[.,·]\d+)?\s*(?:months?|weeks?|years?|cycles|doses|infusions|mo\b)", re.I)

def frases(t):
    return [s.strip() for s in re.split(r"(?<=[.;])\s+(?=[A-Z(\d])", t) if s.strip()]

out = {}
for doi, rec in cache.items():
    if rec.get("doi_confere") is False or not rec.get("abstract"):
        out[doi] = {"ok": False, "motivo": rec.get("erro") or "doi_nao_confere"}
        continue
    t = corpo_abstract(rec["abstract"])
    fr = frases(t)
    out[doi] = {"ok": True, "pmid": rec.get("pmid"), "n_corpo": len(t),
                "frases_duracao": [s for s in fr if DUR_PAT.search(s) and TEM_NUM.search(s)][:4],
                "frases_pfs": [s for s in fr if PFS_PAT.search(s) and TEM_NUM.search(s)][:6],
                "corpo": t}

json.dump(out, open(os.path.join(SP, "candidatos.json"), "w"), ensure_ascii=False, indent=1)
nd = sum(1 for v in out.values() if v.get("frases_duracao"))
npf = sum(1 for v in out.values() if v.get("frases_pfs"))
nn = sum(1 for v in out.values() if v.get("ok") and not v.get("frases_duracao") and not v.get("frases_pfs"))
print(f"DOIs={len(out)}  frase de DURAÇÃO={nd}  frase de PFS={npf}  abstract sem nenhuma={nn}")
