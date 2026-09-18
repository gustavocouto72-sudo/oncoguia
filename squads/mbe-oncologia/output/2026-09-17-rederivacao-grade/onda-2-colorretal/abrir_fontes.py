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
DOIS = {"Hofheinz CAO/ARO":"10.1016/S1470-2045(12)70116-X","OPRA":"10.1200/JCO.23.01208","PRODIGE 23":"10.1016/j.annonc.2024.06.019",
 "X-ACT":"10.1056/nejmoa043116","NO16968":"10.1200/JCO.2010.33.6297","de Gramont FOLFOX4":"10.1200/JCO.2000.18.16.2938",
 "TRIBE":"10.1056/NEJMoa1403108","CRYSTAL":"10.1056/NEJMoa0805019","KEYNOTE-177 5y":"10.1016/j.annonc.2024.11.012",
 "SUNLIGHT":"10.1056/NEJMoa2214963","Hurwitz pooled":"10.1634/theoncologist.2013-0107","VELOUR subgrupos":"10.1016/j.ejca.2013.09.013",
 "CORRECT":"10.1016/S0140-6736(12)61900-X"}
C4 = {"Hofheinz update":'TITLE:"capecitabine" AND TITLE:"fluorouracil" AND TITLE:"rectal" AND TITLE:"chemoradiotherapy" AND (TITLE:"long-term" OR TITLE:"final")',
 "OPRA":'TITLE:"OPRA" AND TITLE:"rectal"',
 "PRODIGE 23":'TITLE:"PRODIGE 23"',
 "X-ACT final":'TITLE:"X-ACT" OR (TITLE:"capecitabine" AND TITLE:"adjuvant" AND TITLE:"stage III colon" AND TITLE:"final")',
 "MOSAIC":'TITLE:"MOSAIC" AND TITLE:"oxaliplatin" AND TITLE:"colon"',
 "NO16968 final":'TITLE:"XELOXA" OR (TITLE:"capecitabine plus oxaliplatin" AND TITLE:"adjuvant" AND TITLE:"colon" AND TITLE:"final")',
 "IDEA":'TITLE:"IDEA" AND TITLE:"oxaliplatin" AND TITLE:"adjuvant" AND TITLE:"colon"',
 "TRIBE final":'TITLE:"TRIBE" AND TITLE:"FOLFOXIRI"',
 "CRYSTAL final":'TITLE:"CRYSTAL" AND TITLE:"cetuximab"',
 "PRIME":'TITLE:"PRIME" AND TITLE:"panitumumab"',
 "KEYNOTE-177":'TITLE:"KEYNOTE-177"',
 "SUNLIGHT":'TITLE:"SUNLIGHT" AND TITLE:"trifluridine"',
 "NO16966 bevacizumab":'TITLE:"NO16966" OR (TITLE:"bevacizumab" AND TITLE:"first-line" AND TITLE:"metastatic colorectal" AND TITLE:"phase III" AND PUB_YEAR:2008)',
 "VELOUR primária":'TITLE:"aflibercept" AND TITLE:"VELOUR" AND PUB_YEAR:2012',
 "CORRECT":'TITLE:"CORRECT" AND TITLE:"regorafenib"',
 "Cochrane colorretal":'JOURNAL:"Cochrane Database Syst Rev" AND (TITLE:"colorectal" OR TITLE:"colon" OR TITLE:"rectal") AND PUB_YEAR:[2010 TO 2026]'}
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
        st,b=get("https://www.ebi.ac.uk/europepmc/webservices/rest/search?query="+urllib.parse.quote(q)+"&format=json&resultType=core&pageSize=10&sort=P_PDATE_D%20desc")
        print("##",nome)
        for x in json.loads(b).get("resultList",{}).get("result",[]):
            ab=x.get("abstractText") or ""
            print(f"   {x.get('pubYear')} | {x.get('doi')} | PMID {x.get('pmid')} | {x.get('journalTitle')} | {x.get('title','')[:110]} | abs {len(ab)}")
            if ab: salvar_epmc(x)
    except Exception as e: print("  ERRO",e)
    time.sleep(0.4)
