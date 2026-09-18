#!/usr/bin/env python3
"""Escada de APIs abertas (fontes-confiaveis.md) para os DOIs do piloto renal.
Salva a resposta CRUA de cada degrau (evidência) e imprime o abstract."""
import json, urllib.request, urllib.parse, time, sys, os
import os as _os
# Vive na pasta da onda (método versionado); as respostas cruas — texto de editora, fora do git —
# vão para fontes/ ao lado, como quando o script rodava de dentro dela.
_os.makedirs(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'fontes'), exist_ok=True)
_os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'fontes'))
UA = {"User-Agent": "oncoguia-rederivacao-grade/1 (mailto:gustavocouto72@gmail.com)"}
DOIS = ["10.1016/S1470-2045(22)00487-9", "10.1056/NEJMoa1303989", "10.1056/NEJMoa065044",
        "10.1056/NEJMoa1712126", "10.1056/NEJMoa1816714", "10.1056/NEJMoa2026982",
        "10.1002/cncr.33033", "10.1056/NEJMoa1510016", "10.1016/S1470-2045(15)00515-X"]
def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, r.read().decode("utf-8", "replace")
def slug(doi): return doi.replace("/", "_").replace("(", "").replace(")", "")
for doi in DOIS:
    s = slug(doi); print("=" * 100); print("DOI", doi)
    # 1. Crossref
    try:
        st, body = get("https://api.crossref.org/works/" + urllib.parse.quote(doi, safe=""))
        open(f"{s}.crossref.json", "w").write(body)
        m = json.loads(body)["message"]
        print("  Crossref:", st, "|", (m.get("title") or [""])[0][:110], "|", m.get("container-title", [""])[0], m.get("issued", {}).get("date-parts"))
    except Exception as e:
        print("  Crossref: ERRO", e)
    time.sleep(0.5)
    # 2. Europe PMC
    try:
        q = urllib.parse.quote(f'DOI:"{doi}"')
        st, body = get(f"https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={q}&format=json&resultType=core")
        open(f"{s}.europepmc.json", "w").write(body)
        res = json.loads(body).get("resultList", {}).get("result", [])
        if not res:
            print("  EuropePMC: SEM RESULTADO"); continue
        r0 = res[0]
        print(f"  EuropePMC: {st} | pmid={r0.get('pmid')} pmcid={r0.get('pmcid')} OA={r0.get('isOpenAccess')} | {r0.get('title','')[:100]}")
        ab = r0.get("abstractText")
        print("  ABSTRACT:", (ab or "(ausente)")[:4000])
    except Exception as e:
        print("  EuropePMC: ERRO", e)
    time.sleep(0.5)
