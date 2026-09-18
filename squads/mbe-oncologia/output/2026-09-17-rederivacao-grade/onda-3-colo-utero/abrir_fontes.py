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
DOIS = {"Peters 2000":"10.1200/JCO.2000.18.8.1606","INTERLACE":"10.1016/S0140-6736(24)01438-7","KEYNOTE-A18":"10.1016/S0140-6736(24)00317-9",
 "KEYNOTE-826 final OS":"10.1200/JCO.23.00914","GOG-169 (DOI registrado)":"10.1200/JCO.2004.04.170","EMPOWER-Cervical 1":"10.1056/NEJMoa2112187",
 "GOG-240":"10.1056/NEJMoa1309748","McGuire 1996":"10.1200/JCO.1996.14.3.792"}
C4 = {"Peters update":'TITLE:"cervical" AND TITLE:"adjuvant" AND (TITLE:"chemoradiation" OR TITLE:"chemoradiotherapy") AND TITLE:"high-risk" AND (TITLE:"long-term" OR TITLE:"update")',
 "KEYNOTE-A18 OS":'TITLE:"KEYNOTE-A18" OR (TITLE:"pembrolizumab" AND TITLE:"chemoradiotherapy" AND TITLE:"cervical" AND TITLE:"overall survival")',
 "GOG-204":'TITLE:"GOG 204" OR TITLE:"GOG-204" OR (TITLE:"phase III trial of four cisplatin-containing doublet")',
 "GOG-169":'TITLE:"cisplatin with or without paclitaxel" AND TITLE:"cervix"',
 "JCOG0505 carboplatina":'TITLE:"JCOG0505" OR (TITLE:"paclitaxel plus carboplatin versus paclitaxel plus cisplatin" AND TITLE:"cervical")',
 "GOG-240 final":'TITLE:"GOG 240" OR TITLE:"GOG-240" OR (TITLE:"bevacizumab" AND TITLE:"cervical" AND TITLE:"final overall survival")',
 "EMPOWER final":'TITLE:"cemiplimab" AND TITLE:"cervical" AND (TITLE:"final" OR TITLE:"long-term" OR TITLE:"follow-up")',
 "Cochrane colo":'JOURNAL:"Cochrane Database Syst Rev" AND (TITLE:"cervical cancer" OR TITLE:"cervix") AND PUB_YEAR:[2005 TO 2026]'}
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
