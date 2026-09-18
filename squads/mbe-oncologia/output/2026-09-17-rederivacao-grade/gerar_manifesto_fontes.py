#!/usr/bin/env python3
"""Gera o MANIFESTO.md de cada pasta fontes/ das ondas de re-derivação do GRADE.

Por que existe: as pastas fontes/ guardam respostas cruas de Crossref/Europe PMC/OpenAlex/
Unpaywall (com abstract) e, em alguns casos, o texto integral de artigos (PMC/OA em .html).
É texto de editora, regenerável pelos abrir_fontes*.py da pasta de cada onda (método, versionado) — e fica FORA do
repositório (regra `squads/**/fontes/*` no .gitignore, mesma família do cache de abstracts).
O que se versiona é este manifesto: uma linha por fonte, com DOI, PMCID, título, data em que
foi baixada e a licença quando os metadados a declaram. É o que mantém a trilha auditável
sem o repositório carregar texto de editora. Os arquivos continuam no disco para conferência
local e re-rodadas.

Uso: python3 gerar_manifesto_fontes.py   (a partir de qualquer diretório)
"""
import glob, json, os, re, datetime

RAIZ = os.path.dirname(os.path.abspath(__file__))
SUFIXOS = re.compile(r'\.(crossref|europepmc|openalex|unpaywall)\.json$|\.PMC\d+\.pmc\.html$|\.oa\.html$|\.abstract\.txt$')


def deslug(slug):
    # 10.1016_S0140-67361832557-1 → 10.1016/S0140-6736(18)32557-1 não é recuperável do slug (os
    # parênteses foram removidos); o DOI vem dos metadados quando existem, senão o slug fica.
    return slug.replace('_', '/', 1)


def carregar(caminho):
    try:
        return json.load(open(caminho, encoding='utf-8'))
    except Exception:
        return None


def ler_europepmc(j):
    if j is None:
        return None
    res = j.get('resultList', {}).get('result') if isinstance(j, dict) else j
    if not res:
        return None
    r = res[0] if isinstance(res, list) else res
    return {
        'doi': r.get('doi'), 'pmcid': r.get('pmcid'), 'pmid': r.get('pmid'), 'titulo': r.get('title'),
        'ano': r.get('pubYear'), 'revista': (r.get('journalInfo') or {}).get('journal', {}).get('title'),
        'licenca': r.get('license'),
    }


def ler_crossref(j):
    if not j or 'message' not in j:
        return None
    m = j['message']
    # Só licença Creative Commons conta: o campo `license` do Crossref costuma ser a URL dos
    # termos de TDM da editora, que não diz nada sobre redistribuição.
    lic = None
    for l in m.get('license') or []:
        if 'creativecommons' in (l.get('URL') or ''):
            lic = l['URL']; break
    return {
        'doi': m.get('DOI'), 'titulo': (m.get('title') or [None])[0],
        'ano': ((m.get('issued') or {}).get('date-parts') or [[None]])[0][0],
        'revista': (m.get('container-title') or [None])[0], 'licenca': lic,
    }


def ler_openalex(j):
    if not j:
        return None
    best = j.get('best_oa_location') or {}
    prim = j.get('primary_location') or {}
    return {'doi': (j.get('doi') or '').replace('https://doi.org/', '') or None, 'titulo': j.get('title'),
            'ano': j.get('publication_year'), 'licenca': best.get('license') or prim.get('license'),
            'oa_status': (j.get('open_access') or {}).get('oa_status')}


def ler_unpaywall(j):
    if not j:
        return None
    best = j.get('best_oa_location') or {}
    return {'doi': j.get('doi'), 'titulo': j.get('title'), 'ano': j.get('year'), 'licenca': best.get('license')}


def primeiro(*vals):
    for v in vals:
        if v:
            return v
    return None


def manifesto(pasta):
    arquivos = sorted(os.listdir(pasta))
    grupos, auxiliares = {}, []
    for a in arquivos:
        if a == 'MANIFESTO.md':
            continue
        if not SUFIXOS.search(a):
            auxiliares.append(a); continue
        slug = SUFIXOS.sub('', a)
        grupos.setdefault(slug, []).append(a)
    linhas = []
    for slug, arqs in sorted(grupos.items()):
        cam = lambda suf: next((os.path.join(pasta, x) for x in arqs if x.endswith(suf)), None)
        ep = ler_europepmc(carregar(cam('.europepmc.json'))) if cam('.europepmc.json') else None
        cr = ler_crossref(carregar(cam('.crossref.json'))) if cam('.crossref.json') else None
        oa = ler_openalex(carregar(cam('.openalex.json'))) if cam('.openalex.json') else None
        up = ler_unpaywall(carregar(cam('.unpaywall.json'))) if cam('.unpaywall.json') else None
        doi = primeiro(cr and cr['doi'], ep and ep['doi'], oa and oa['doi'], up and up['doi'], deslug(slug))
        pmcid = primeiro(ep and ep['pmcid'])
        if not pmcid:
            m = re.search(r'\.(PMC\d+)\.pmc\.html$', ' '.join(arqs))
            pmcid = m.group(1) if m else None
        titulo = primeiro(cr and cr['titulo'], ep and ep['titulo'], oa and oa['titulo'], up and up['titulo']) or '(título não disponível nos metadados salvos)'
        ano = primeiro(cr and cr['ano'], ep and ep['ano'], oa and oa['ano'], up and up['ano'])
        revista = primeiro(cr and cr['revista'], ep and ep['revista'])
        licenca = primeiro(ep and ep['licenca'], oa and oa['licenca'], up and up['licenca'], cr and cr['licenca'])
        if not licenca and oa and oa.get('oa_status'):
            licenca = f"não declarada (OpenAlex: {oa['oa_status']})"
        licenca = licenca or 'não declarada nos metadados salvos'
        datas = sorted({datetime.date.fromtimestamp(os.path.getmtime(os.path.join(pasta, x))).isoformat() for x in arqs})
        tipos = ', '.join(sorted({re.sub(r'^\.', '', SUFIXOS.search(x).group(0)) for x in arqs}))
        integral = ' · **texto integral salvo**' if any(x.endswith('.html') for x in arqs) else ''
        linhas.append(f"| `{doi}` | {pmcid or '—'} | {str(titulo).replace('|', '/').strip()} | {revista or '—'}{f' ({ano})' if ano else ''} | {' / '.join(datas)} | {licenca} | {tipos}{integral} |")
    onda = os.path.basename(os.path.dirname(pasta))
    hoje = datetime.date.today().isoformat()
    cab = [
        f"# Manifesto das fontes — {onda}",
        "",
        "Os arquivos desta pasta (respostas cruas de Crossref / Europe PMC / OpenAlex / Unpaywall, com",
        "abstract, e texto integral de artigos em `.html` quando havia versão PMC/OA) são texto de editora,",
        "regeneráveis pelos `abrir_fontes*.py` da pasta da onda (método versionado; a saída da escada fica em",
        "`escada*-saida.txt`, ao lado), e **não são versionados** (regra",
        "`squads/**/fontes/*` no .gitignore — só este manifesto entra). Continuam no disco para conferência",
        "local e re-rodadas. Este manifesto é a trilha auditável: uma linha por fonte, com DOI, PMCID, título,",
        "data em que foi baixada (mtime do arquivo) e licença quando os metadados a declaram (Europe PMC →",
        "OpenAlex → Unpaywall → Crossref; \"não declarada\" quando nenhum a traz — o que, para manuscritos de",
        "autor depositados no PMC, é o esperado).",
        "",
        f"Gerado por `../gerar_manifesto_fontes.py` em {hoje}. {len(linhas)} fonte(s); {len(auxiliares)} arquivo(s) auxiliar(es).",
        "",
        "| DOI | PMCID | Título | Revista (ano) | Baixado em | Licença | Artefatos salvos |",
        "|---|---|---|---|---|---|---|",
    ]
    rod = ["", "**Outros arquivos na pasta (não versionados):** " + (', '.join(f'`{a}`' for a in auxiliares) or 'nenhum') + "."]
    open(os.path.join(pasta, 'MANIFESTO.md'), 'w', encoding='utf-8').write('\n'.join(cab + linhas + rod) + '\n')
    return len(linhas), len(auxiliares)


if __name__ == '__main__':
    for pasta in sorted(glob.glob(os.path.join(RAIZ, '*', 'fontes'))):
        n, aux = manifesto(pasta)
        print(f"{os.path.relpath(pasta, RAIZ)}: {n} fontes, {aux} auxiliares → MANIFESTO.md")
