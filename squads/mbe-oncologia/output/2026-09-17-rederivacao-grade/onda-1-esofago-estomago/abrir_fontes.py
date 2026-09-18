#!/usr/bin/env python3
"""Escada de APIs abertas para a onda 1 (esôfago-estômago): Crossref + Europe PMC (abstract) por DOI,
mais busca C4 por versão madura do mesmo ensaio. Salva as respostas cruas."""
import json, urllib.request, urllib.parse, time, re, html, sys
import os as _os
# Vive na pasta da onda (método versionado); as respostas cruas — texto de editora, fora do git —
# vão para fontes/ ao lado, como quando o script rodava de dentro dela.
_os.makedirs(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'fontes'), exist_ok=True)
_os.chdir(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), 'fontes'))
UA={"User-Agent":"oncoguia-rederivacao-grade/1 (mailto:gustavocouto72@gmail.com)"}
TAG=re.compile(r"<(/?[a-zA-Z][^<>]*)>")
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=40) as r: return r.status, r.read().decode("utf-8","replace")
def slug(d): return d.replace("/","_").replace("(","").replace(")","")
def salvar_epmc(x):
    if x.get("doi"):
        open(f"{slug(x['doi'])}.europepmc.json","w").write(json.dumps({"resultList":{"result":[x]}},ensure_ascii=False))
DOIS = {"FLOT4":"10.1016/S0140-6736(18)32557-1","CROSS":"10.1056/NEJMoa1112088","RTOG 85-01":"10.1056/NEJM199206113262403",
 "CheckMate 577":"10.1056/NEJMoa2032125","CLASSIC":"10.1016/S0140-6736(11)61873-4","INT0116":"10.1200/JCO.2011.36.7136",
 "Glimelius":"10.1093/oxfordjournals.annonc.a010676","Al-Batran 2008":"10.1200/JCO.2007.13.9378","RAINBOW":"10.1016/S1470-2045(14)70420-6",
 "Thuss-Patience":"10.1016/j.ejca.2011.06.002","COUGAR-02":"10.1016/S1470-2045(13)70549-7","CheckMate 649":"10.1016/S0140-6736(21)00797-2",
 "ToGA":"10.1016/S0140-6736(10)61121-X","KEYNOTE-811":"10.1016/S0140-6736(23)02033-0","DESTINY-Gastric01":"10.1056/NEJMoa2004413",
 "TAGS":"10.1016/S1470-2045(18)30739-3","SPOTLIGHT":"10.1016/S0140-6736(23)00620-7"}
C4 = {"FLOT4":'TITLE:"FLOT" AND TITLE:"perioperative" AND (TITLE:"survival" OR TITLE:"follow-up")',
 "CROSS":'TITLE:"CROSS" AND TITLE:"chemoradiotherapy" AND (TITLE:"long-term" OR TITLE:"ten-year" OR TITLE:"10-year")',
 "RTOG 85-01":'TITLE:"RTOG 85-01" OR (TITLE:"chemoradiotherapy" AND TITLE:"esophageal" AND TITLE:"long-term follow-up" AND PUB_YEAR:1999)',
 "CheckMate 577":'TITLE:"CheckMate 577" AND (TITLE:"survival" OR TITLE:"follow-up" OR TITLE:"final")',
 "CLASSIC":'TITLE:"CLASSIC" AND TITLE:"capecitabine" AND TITLE:"oxaliplatin" AND TITLE:"5-year"',
 "CheckMate 649":'TITLE:"CheckMate 649" AND (TITLE:"3-year" OR TITLE:"follow-up" OR TITLE:"final" OR TITLE:"long-term")',
 "KEYNOTE-811":'TITLE:"KEYNOTE-811" OR (TITLE:"pembrolizumab" AND TITLE:"HER2-positive gastric" AND PUB_YEAR:[2024 TO 2026])',
 "DESTINY-Gastric01":'TITLE:"DESTINY-Gastric01" AND (TITLE:"final" OR TITLE:"survival" OR TITLE:"updated")',
 "SPOTLIGHT":'TITLE:"SPOTLIGHT" AND TITLE:"zolbetuximab" AND (TITLE:"final" OR TITLE:"overall survival" OR TITLE:"updated")',
 "GLOW":'TITLE:"GLOW" AND TITLE:"zolbetuximab"',
 "TAGS":'TITLE:"TAGS" AND TITLE:"trifluridine" AND (TITLE:"final" OR TITLE:"updated" OR TITLE:"subgroup")',
 "REGARD":'TITLE:"REGARD" AND TITLE:"ramucirumab" AND TITLE:"gastric"',
 "KEYNOTE-859":'TITLE:"KEYNOTE-859" OR (TITLE:"pembrolizumab" AND TITLE:"chemotherapy" AND TITLE:"gastric" AND TITLE:"first-line" AND PUB_YEAR:2023)'}
for nome,doi in DOIS.items():
    print("="*100); print(nome, doi)
    try:
        st,b=get("https://api.crossref.org/works/"+urllib.parse.quote(doi,safe="")); open(f"{slug(doi)}.crossref.json","w").write(b)
        m=json.loads(b)["message"]; print("  Crossref:",st,"|",(m.get("title") or [""])[0][:100],"|",(m.get("container-title") or [""])[0],m.get("issued",{}).get("date-parts"))
    except Exception as e: print("  Crossref: ERRO",e)
    time.sleep(0.4)
    try:
        st,b=get("https://www.ebi.ac.uk/europepmc/webservices/rest/search?query="+urllib.parse.quote(f'DOI:"{doi}"')+"&format=json&resultType=core")
        res=json.loads(b).get("resultList",{}).get("result",[])
        if not res: print("  EuropePMC: SEM RESULTADO")
        else:
            x=res[0]; salvar_epmc(x); ab=html.unescape(TAG.sub(" ",x.get("abstractText") or ""))
            print(f"  EuropePMC: pmid={x.get('pmid')} pmcid={x.get('pmcid')} OA={x.get('isOpenAccess')} | abstract {len(ab)} chars")
            print("  ABSTRACT:", ab[:3500])
    except Exception as e: print("  EuropePMC: ERRO",e)
    time.sleep(0.4)
print("\n\n######## C4 — candidatos a versão madura")
for nome,q in C4.items():
    try:
        st,b=get("https://www.ebi.ac.uk/europepmc/webservices/rest/search?query="+urllib.parse.quote(q)+"&format=json&resultType=core&pageSize=8&sort=P_PDATE_D desc")
        print("##",nome)
        for x in json.loads(b).get("resultList",{}).get("result",[]):
            ab=x.get("abstractText") or ""
            print(f"   {x.get('pubYear')} | {x.get('doi')} | PMID {x.get('pmid')} | {x.get('journalTitle')} | {x.get('title','')[:110]} | abs {len(ab)}")
            if ab: salvar_epmc(x)
    except Exception as e: print("  ERRO",e)
    time.sleep(0.4)
