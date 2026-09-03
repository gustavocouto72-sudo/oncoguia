#!/usr/bin/env python3
"""Baixa os abstracts dos pivotais JÁ presentes no corpus (por DOI).
Não introduz referência nova: só resolve o DOI que já está no regime."""
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

import json, os, sys, time, urllib.parse, urllib.request

SP = AQUI

CACHE = os.path.join(SP, "abstracts.json")
UA = "OncoGuia-extracao/1.0 (mailto:gustavocouto72@gmail.com)"

def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            if i == tries - 1:
                return None
            time.sleep(2 * (i + 1))
    return None

dois = sorted({(r.get("referencia") or {}).get("doi")
               for r in json.load(open(CORPUS))["regimes"]} - {None})

cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
pend = [d for d in dois if d not in cache]
print(f"{len(dois)} DOIs, {len(pend)} pendentes", flush=True)

for n, doi in enumerate(pend, 1):
    rec = {"doi": doi, "pmid": None, "abstract": None, "titulo": None, "erro": None}
    q = urllib.parse.quote(doi, safe="")
    j = get(f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={q}%5BDOI%5D&retmode=json")
    ids = []
    if j:
        try:
            ids = json.loads(j)["esearchresult"].get("idlist", [])
        except Exception:
            pass
    if not ids:
        # tenta busca livre pelo DOI (alguns registros só têm no campo AID)
        j = get(f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term={q}&retmode=json")
        if j:
            try:
                ids = json.loads(j)["esearchresult"].get("idlist", [])[:1]
            except Exception:
                pass
    if ids:
        rec["pmid"] = ids[0]
        txt = get(f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={ids[0]}&rettype=abstract&retmode=text")
        rec["abstract"] = txt
    else:
        rec["erro"] = "sem_pmid"
    cache[doi] = rec
    if n % 10 == 0 or n == len(pend):
        json.dump(cache, open(CACHE, "w"), ensure_ascii=False)
        print(f"  {n}/{len(pend)}", flush=True)
    time.sleep(0.4)

json.dump(cache, open(CACHE, "w"), ensure_ascii=False)
com = sum(1 for v in cache.values() if v.get("abstract"))
print(f"pronto: {com}/{len(cache)} com texto do PubMed")
