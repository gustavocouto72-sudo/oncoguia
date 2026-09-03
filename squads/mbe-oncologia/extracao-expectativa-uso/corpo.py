# -*- coding: utf-8 -*-
"""Isola o corpo do abstract no formato texto do PubMed."""
import re

DESCARTE = re.compile(r"^(Collaborators:|Author information:|Comment (in|on)|Erratum|Update (in|of)|"
                      r"Expression of Concern|©|Copyright|Conflict of interest|Trial registration|"
                      r"ClinicalTrials\.gov|Funding:|DOI:|PMID:|PMCID:|Free (PMC )?article|In:)", re.I)

def _eh_lista_autores(s):
    """Lista de autores: densidade alta de marcadores (n) — ~1 a cada 40 chars."""
    n = len(re.findall(r"\(\d+\)", s))
    return n >= 3 and n * 40 > len(s)

def corpo_abstract(txt):
    if not txt:
        return ""
    corpo, meta = [], 0
    for b in re.split(r"\n\s*\n", txt):
        s = re.sub(r"\s+", " ", b).strip()
        if not s:
            continue
        if re.match(r"^\d+\.\s", s) and meta == 0:      # linha de citação
            meta += 1; continue
        if DESCARTE.match(s):
            if re.match(r"^(DOI:|PMID:|PMCID:|©|Copyright)", s, re.I) and corpo:
                break
            continue
        if not corpo and _eh_lista_autores(s):
            meta += 1; continue
        if not corpo and meta >= 1 and len(s.split()) < 25 and s.endswith("."):
            meta += 1; continue                          # provável título
        corpo.append(s)
    return " ".join(corpo)
