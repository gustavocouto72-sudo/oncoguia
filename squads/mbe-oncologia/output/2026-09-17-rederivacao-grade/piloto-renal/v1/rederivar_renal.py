#!/usr/bin/env python3
"""
Piloto de calibração — re-derivação GRADE (schema 2) dos 10 regimes de RENAL.

Disciplina:
  - toda `transcricao` é EXTRAÍDA dos arquivos salvos em fontes/ (resposta crua do Europe PMC
    ou página PMC do manuscrito de autor) por busca literal — o script aborta se a frase não
    estiver no arquivo. Nada vem de memória.
  - o juízo por domínio (nota + frase) é o do verificador; o Portão A recalcula a certeza e
    barra o que não fecha.
  - saída: regimes-consolidados.json (clone dos 10 regimes do RUN_ATIVO, SÓ o bloco
    verificacao.grade trocado) + verificacao-grade-renal.json (os blocos) — em output/, nada
    promovido.
"""
import json, os, re, html, copy, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
SQUAD = os.path.abspath(os.path.join(AQUI, "..", "..", ".."))
FONTES = os.path.join(AQUI, "fontes")
rel = [l.strip() for l in open(os.path.join(SQUAD, "RUN_ATIVO")) if l.strip() and not l.startswith("#")][0]
ATIVO = json.load(open(os.path.join(SQUAD, "output", rel, "regimes-consolidados.json")))["regimes"]
por_id = {r["regimen_id"]: r for r in ATIVO}


# só tags reais (<h4>, </p>, <a href=…>) — "P<0.001" e "<1.25" são texto, não tag
TAG = re.compile(r"<(/?[a-zA-Z][^<>]*)>")


def _texto(nome):
    b = open(os.path.join(FONTES, nome), encoding="utf-8", errors="replace").read()
    if nome.endswith(".json"):
        j = json.loads(b)
        return html.unescape(TAG.sub(" ", j["resultList"]["result"][0]["abstractText"]))
    t = html.unescape(TAG.sub(" ", b))
    return re.sub(r"\s+", " ", t)


def transcrever(nome, inicio, fim):
    """Copia do arquivo-fonte o trecho que começa em `inicio` e termina em `fim` (inclusivo).
    Aborta se não existir — é a garantia de que a frase não foi lembrada."""
    t = _texto(nome)
    i = t.find(inicio)
    if i < 0:
        sys.exit(f"TRANSCRIÇÃO NÃO ENCONTRADA em {nome}: {inicio!r}")
    j = t.find(fim, i)
    if j < 0:
        sys.exit(f"FIM NÃO ENCONTRADO em {nome}: {fim!r}")
    return t[i:j + len(fim)]


def dom(rv, inc, ind, imp, pub):
    return {"risco_vies": {"nota": rv[0], "por": rv[1]}, "inconsistencia": {"nota": inc[0], "por": inc[1]},
            "indireta": {"nota": ind[0], "por": ind[1]}, "imprecisao": {"nota": imp[0], "por": imp[1]},
            "vies_publicacao": {"nota": pub[0], "por": pub[1]}}


def bloco(**k):
    g = {"schema": 2, "status": "re_derivado", "afirmado_protocolo": None, "elevacoes": [],
         "substituto_excecao": None, "pivo_nao_sustenta": False, "motivo_indeterminado": None}
    g.update(k)
    g["fonte"] = "https://doi.org/" + k["doi"]
    del g["doi"]
    return g


B = {}

# ---------------------------------------------------------------------------------------------
# 1. renal-adj-pembrolizumab — KEYNOTE-564, 30 meses (Lancet Oncol 2022)
tr = transcrever("10.1016_S1470-20452200487-9.europepmc.json",
                 "Disease-free survival was better with pembrolizumab", "not reached in either group.")
B["renal-adj-pembrolizumab"] = bloco(
    doi="10.1016/S1470-2045(22)00487-9", desfecho_critico="SLD",
    desenho={"tipo": "rct_fase3", "cegamento": "duplo_cego", "n": 994,
             "descricao": "KEYNOTE-564 — pembrolizumabe vs placebo pós-nefrectomia, fase 3 duplo-cego, N=994, seguimento mediano 30,1 m"},
    efeito={"medida": "HR", "valor": 0.63, "ic95": [0.50, 0.80], "sentido_beneficio": "menor", "eventos": None,
            "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Pembrolizumab"], "comparador": "placebo", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": True, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (200 mg q3w, 17 ciclos); placebo era e é o comparador em adjuvância; primário SLD positivo",
          "referencia_proposta": "10.1056/nejmoa2312695 — Choueiri 2024 NEJM (SG do KEYNOTE-564): a justificativa antiga cita ganho de SG que NÃO está na fonte registrada"},
    dominios=dom((0, "duplo-cego com placebo, ITT, randomização central; SLD por investigador mas mascarado"),
                 (0, "ensaio único; sem ensaio contraditório citado na fonte"),
                 (0, "população = critérios do protocolo (pT2 G4/sarcomatoide, pT3+, N+, M1 NED); comparador placebo"),
                 (0, "IC 0,50–0,80 exclui o nulo com folga; RRR 37% com limite superior ≤ 0,85 = efeito grande (regra 1) — nº de eventos não transcrito no abstract"),
                 (0, "registro prévio (NCT03142334); análise pré-especificada")),
    certeza="A",
    recomendacao={"forca": "forte", "direcao": "a_favor",
                  "base": "incorporado; SLD HR 0,63 duplo-cego; ESMO-MCBS A (curativo); único adjuvante com benefício demonstrado nesta indicação", "sem_mcbs_por": None},
    valor_rederivado="1A",
    justificativa="RCT fase 3 duplo-cego (N=994): SLD HR 0,63 (0,50–0,80). Nenhum domínio rebaixado. Forte a favor (MCBS A, incorporado). Obs.: o ganho de SG citado na justificativa anterior não está nesta fonte — proposta a referência de 2024.")

# ---------------------------------------------------------------------------------------------
# 2. renal-met-favoravel-pazopanibe — COMPARZ (NEJM 2013)
tr = transcrever("10.1056_NEJMoa1303989.europepmc.json",
                 "Pazopanib was noninferior to sunitinib", "0.91; 95% CI, 0.76 to 1.08).")
B["renal-met-favoravel-pazopanibe"] = bloco(
    doi="10.1056/NEJMoa1303989", desfecho_critico="SLP",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 1110,
             "descricao": "COMPARZ — pazopanibe vs sunitinibe, fase 3 aberto de NÃO-INFERIORIDADE, N=1.110; SLP por revisão independente"},
    efeito={"medida": "HR", "valor": 1.05, "ic95": [0.90, 1.22], "sentido_beneficio": "menor", "eventos": None,
            "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Pazopanibe"], "comparador": "sunitinibe", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": True, "primario_positivo": True, "sustenta": True,
          "por": "desenho de não-inferioridade: o pivô sustenta EQUIVALÊNCIA ao sunitinibe (margem 1,25 atingida), não superioridade; TKI mono segue opção em risco favorável",
          "referencia_proposta": "10.1200/jco.2009.23.9764 — Sternberg 2010 JCO (pazopanibe vs placebo, fase 3): a base de eficácia absoluta do pazopanibe, ausente do corpus"},
    dominios=dom((0, "aberto, mas SLP por revisão independente; ITT"),
                 (0, "ensaio único; sem contradição citada"),
                 (-1, "SLP é substituto; SG 'similar' (HR 0,91; 0,76–1,08) não demonstra benefício"),
                 (-1, "não-inferioridade com limite superior 1,22 encostado na margem 1,25; IC inclui o nulo (regra 4)"),
                 (0, "registro prévio (NCT00720941)")),
    certeza="C",
    recomendacao={"forca": "condicional", "direcao": "a_favor",
                  "base": "TKI oral equivalente ao sunitinibe (NI) com melhor tolerabilidade/QoL; certeza C pela fonte registrada (NI + substituto); MCBS n/a", "sem_mcbs_por": None},
    valor_rederivado="2C",
    justificativa="RCT fase 3 aberto de não-inferioridade (N=1.110): SLP HR 1,05 (0,90–1,22). −1 indireta (substituto) e −1 imprecisão (limite 1,22 vs margem 1,25). Condicional a favor.")

# ---------------------------------------------------------------------------------------------
# 3. renal-met-favoravel-sunitinibe — Motzer 2007 (NEJM)
tr = transcrever("10.1056_NEJMoa065044.europepmc.json",
                 "The median progression-free survival was significantly longer", "0.32 to 0.54; P<0.001).")
B["renal-met-favoravel-sunitinibe"] = bloco(
    doi="10.1056/NEJMoa065044", desfecho_critico="SLP",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 750,
             "descricao": "Motzer 2007 — sunitinibe vs interferon-α, fase 3 aberto, N=750, população toda-risco"},
    efeito={"medida": "HR", "valor": 0.42, "ic95": [0.32, 0.54], "sentido_beneficio": "menor", "eventos": None,
            "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Sunitinibe"], "comparador": "interferon-α", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": False, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (50 mg 4/2); IFN-α era o padrão em 2007 e hoje é obsoleto; primário SLP positivo. A citação do corpus menciona 'COMPARZ' como comparador contemporâneo — é outro ensaio, não esta fonte",
          "referencia_proposta": "10.1200/jco.2008.20.1293 — Motzer 2009 JCO (SG final do mesmo ensaio): fecharia o desfecho duro"},
    dominios=dom((0, "aberto; SLP — o abstract não afirma revisão independente (não penalizado; registrar)"),
                 (0, "ensaio único vs IFN; sem contradição citada"),
                 (-1, "três razões no mesmo domínio: SLP substituto sem SG nesta fonte; comparador IFN-α obsoleto; população toda-risco vs regime restrito a favorável. Leitura −2 é defensável (item de calibração)"),
                 (0, "IC 0,32–0,54 exclui o nulo com folga; RRR 58% = efeito grande (regra 1)"),
                 (0, "registro prévio (NCT00098657)")),
    certeza="B",
    recomendacao={"forca": "condicional", "direcao": "a_favor",
                  "base": "TKI de referência histórica em risco favorável; escolha frente a IO-TKI é sensível a preferência/custo; MCBS n/a (comparador histórico)", "sem_mcbs_por": None},
    valor_rederivado="2B",
    justificativa="RCT fase 3 aberto (N=750): SLP HR 0,42 (0,32–0,54) vs IFN-α. −1 indireta (substituto + comparador obsoleto + população toda-risco). Condicional a favor. Gabarito da auditoria (caso 01): 2B — coincide.")

# ---------------------------------------------------------------------------------------------
# 4. renal-met-favoravel-ipilimumabe-nivolumabe — CheckMate 214, subgrupo favorável (exploratório)
tr = transcrever("10.1056_NEJMoa1712126.PMC5972549.pmc.html",
                 "the hazard ratio for death favored sunitinib: 1.45", "16 in the sunitinib group)")
tr2 = transcrever("10.1056_NEJMoa1712126.PMC5972549.pmc.html",
                  "The objective response rate was 29%", "both favoring sunitinib.")
B["renal-met-favoravel-ipilimumabe-nivolumabe"] = bloco(
    doi="10.1056/NEJMoa1712126", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 1096,
             "descricao": "CheckMate 214 — nivo+ipi vs sunitinibe, fase 3 aberto, N=1.096; primários em risco int/alto (N=847); risco FAVORÁVEL (N=249) é desfecho EXPLORATÓRIO"},
    efeito={"medida": "HR", "valor": 1.45, "ic95": [0.51, 4.12], "ic_nivel": 99.8, "sentido_beneficio": "menor", "eventos": 37,
            "transcricao": tr + " | " + tr2, "fonte_transcricao": "pmc_fulltext"},
    pivo={"intervencao": ["Ipilimumabe", "Nivolumabe"], "comparador": "sunitinibe", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": True, "primario_positivo": True, "sustenta": True,
          "por": "cobertura e comparador ok; o primário do ensaio foi positivo — mas em OUTRA população (int/alto). Para o regime de risco favorável a fonte mostra SG, SLP e TRO favorecendo o sunitinibe: o problema é indireta de população, tratado no domínio",
          "referencia_proposta": "10.1016/j.annonc.2024.07.727 — Tannir 2024 Ann Oncol (8 anos; já citado no corpus sem DOI)"},
    dominios=dom((0, "aberto; SG"),
                 (0, "ensaio único"),
                 (-2, "desfecho exploratório em subgrupo (249 pts) fora do primário; ponto estimado desfavorável (SG HR 1,45; SLP HR 2,18; TRO 29% vs 52%) — muito séria"),
                 (-2, "37 óbitos; IC 99,8% 0,51–4,12 inclui dano importante e benefício grande — muito séria"),
                 (0, "—")),
    certeza="D",
    recomendacao={"forca": "condicional", "direcao": "a_favor",
                  "base": "o protocolo lista o regime em risco favorável (por isso 'a favor'); a fonte registrada NÃO mostra benefício nesse subgrupo — direção é decisão do revisor (Portão C); MCBS 2 (subgrupo)", "sem_mcbs_por": None},
    valor_rederivado="2D",
    justificativa="Subgrupo exploratório do CheckMate 214: SG HR 1,45 (99,8% IC 0,51–4,12; 37 óbitos), SLP e TRO a favor do sunitinibe. −2 indireta, −2 imprecisão → certeza muito baixa. Condicional; direção para o revisor.")

# ---------------------------------------------------------------------------------------------
# 5. renal-met-intalto-ipilimumabe-nivolumabe — CheckMate 214, int/alto (primário)
tr = transcrever("10.1056_NEJMoa1712126.PMC5972549.pmc.html",
                 "the 18-month overall survival rate was 75%", "0.44 to 0.89; P<0.001).")
B["renal-met-intalto-ipilimumabe-nivolumabe"] = bloco(
    doi="10.1056/NEJMoa1712126", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 1096,
             "descricao": "CheckMate 214 — nivo+ipi vs sunitinibe, fase 3 aberto; coprimários (SG, TRO, SLP) em risco int/alto (N=847); 1ª análise interina (51% dos óbitos planejados)"},
    efeito={"medida": "HR", "valor": 0.63, "ic95": [0.44, 0.89], "ic_nivel": 99.8, "sentido_beneficio": "menor", "eventos": None,
            "transcricao": tr, "fonte_transcricao": "pmc_fulltext"},
    pivo={"intervencao": ["Ipilimumabe", "Nivolumabe"], "comparador": "sunitinibe", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": True, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime; sunitinibe era o padrão em 2018; coprimário SG positivo na população do regime",
          "referencia_proposta": "10.1016/j.annonc.2024.07.727 — Tannir 2024 Ann Oncol (8 anos): eventos maduros; provável retorno a A na repescagem"},
    dominios=dom((0, "aberto; SG"),
                 (0, "ensaio único; sem contradição citada"),
                 (0, "população int/alto = regime; comparador sunitinibe padrão da época"),
                 (-1, "1ª interina (51% dos óbitos planejados); IC disponível é 99,8% (0,44–0,89), limite 0,89 > 0,85; nº de óbitos não transcrito — OIS não demonstrável na fonte (regra 1)"),
                 (0, "registro prévio (NCT02231749)")),
    certeza="B",
    recomendacao={"forca": "forte", "direcao": "a_favor",
                  "base": "incorporado; SG HR 0,63 no primário; ESMO-MCBS 4; padrão de 1ª linha em int/alto", "sem_mcbs_por": None},
    valor_rederivado="1B",
    justificativa="RCT fase 3 aberto: SG HR 0,63 (99,8% IC 0,44–0,89) em int/alto, 1ª interina. −1 imprecisão (interina, IC 99,8%, eventos não transcritos). Forte a favor. Repescagem com 8 anos tende a A.")

# ---------------------------------------------------------------------------------------------
# 6. renal-met-intalto-axitinibe-pembrolizumabe — KEYNOTE-426 (NEJM 2019)
tr = transcrever("10.1056_NEJMoa1816714.europepmc.json",
                 "After a median follow-up of 12.8 months", "0.38 to 0.74; P<0.0001).")
B["renal-met-intalto-axitinibe-pembrolizumabe"] = bloco(
    doi="10.1056/NEJMoa1816714", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 861,
             "descricao": "KEYNOTE-426 — pembro+axitinibe vs sunitinibe, fase 3 aberto, N=861, ITT toda-risco; 1ª análise interina pré-especificada (seguimento 12,8 m)"},
    efeito={"medida": "HR", "valor": 0.53, "ic95": [0.38, 0.74], "sentido_beneficio": "menor", "eventos": None,
            "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Axitinibe", "Pembrolizumabe"], "comparador": "sunitinibe", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": True, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (200 mg q3w + 5 mg 2x/d); sunitinibe padrão em 2019; coprimário SG positivo"},
    dominios=dom((0, "aberto; SG"),
                 (0, "ensaio único; sem contradição citada"),
                 (0, "ITT toda-risco; abstract afirma benefício 'across IMDC risk groups'; regime int/alto ⊂ população"),
                 (0, "IC 0,38–0,74 exclui o nulo com folga; RRR 47% com limite ≤ 0,85 = efeito grande (regra 1) — mas é 1ª INTERINA com eventos não transcritos: item de calibração (GRADE rebaixa por parada precoce; aqui não houve parada)"),
                 (0, "registro prévio (NCT02853331)")),
    certeza="A",
    recomendacao={"forca": "forte", "direcao": "a_favor",
                  "base": "incorporado; SG HR 0,53; ESMO-MCBS 4", "sem_mcbs_por": None},
    valor_rederivado="1A",
    justificativa="RCT fase 3 aberto (N=861): SG HR 0,53 (0,38–0,74), efeito grande. Nenhum domínio rebaixado. Forte a favor. Ressalva: análise interina precoce — calibração.")

# ---------------------------------------------------------------------------------------------
# 7. renal-met-intalto-nivolumabe-cabozantinibe — CheckMate 9ER (NEJM 2021)
tr = transcrever("10.1056_NEJMoa2026982.europepmc.json",
                 "The probability of overall survival at 12 months was 85.7%", "98.89% CI, 0.40 to 0.89")
B["renal-met-intalto-nivolumabe-cabozantinibe"] = bloco(
    doi="10.1056/NEJMoa2026982", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 651,
             "descricao": "CheckMate 9ER — nivo+cabozantinibe vs sunitinibe, fase 3 aberto, N=651; primário SLP (BICR); SG secundária, seguimento 18,1 m"},
    efeito={"medida": "HR", "valor": 0.60, "ic95": [0.40, 0.89], "ic_nivel": 98.89, "sentido_beneficio": "menor", "eventos": None,
            "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Nivolumabe", "Cabozantinibe"], "comparador": "sunitinibe", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": True, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (240 mg q2w + 40 mg/d); sunitinibe padrão em 2021; primário SLP positivo (HR 0,51; 0,41–0,64) e SG secundária positiva"},
    dominios=dom((0, "aberto; SG (SLP por BICR)"),
                 (0, "ensaio único; sem contradição citada"),
                 (0, "ITT toda-risco, 'consistent across subgroups'; comparador padrão"),
                 (-1, "IC reportado para SG é 98,89% (0,40–0,89), limite 0,89 > 0,85; mediana não atingida, óbitos não transcritos — OIS não demonstrável (regra 1)"),
                 (0, "registro prévio (NCT03141177)")),
    certeza="B",
    recomendacao={"forca": "forte", "direcao": "a_favor",
                  "base": "incorporado; SG HR 0,60 e SLP HR 0,51; ESMO-MCBS 4 re-derivado (protocolo afirmou 1 — divergência do eixo MCBS já registrada)", "sem_mcbs_por": None},
    valor_rederivado="1B",
    justificativa="RCT fase 3 aberto (N=651): SG HR 0,60 (98,89% IC 0,40–0,89). −1 imprecisão (IC não-95%, eventos não transcritos). Forte a favor. Upgrade possível com tabela de eventos.")

# ---------------------------------------------------------------------------------------------
# 8. renal-met-2l-pos-vegfr-nivolumabe — CheckMate 025, seguimento longo (Cancer 2020)
tr = transcrever("10.1002_cncr.33033.europepmc.json",
                 "With a minimum follow-up of 64 months", "26% and 18%, respectively.")
B["renal-met-2l-pos-vegfr-nivolumabe"] = bloco(
    doi="10.1002/cncr.33033", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 821,
             "descricao": "CheckMate 025 — nivolumabe vs everolimo pós-antiangiogênico, fase 3 aberto, N=821; primário SG; seguimento mínimo 64 m"},
    efeito={"medida": "HR", "valor": 0.73, "ic95": [0.62, 0.85], "sentido_beneficio": "menor", "eventos": None,
            "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Nivolumabe"], "comparador": "everolimo", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": False, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (3 mg/kg q2w); everolimo era o padrão de 2ª linha em 2015; hoje o comparador pós-TKI seria outro (cabozantinibe/IO), mas o regime é exatamente esta indicação; primário SG positivo"},
    dominios=dom((0, "aberto; SG"),
                 (0, "consistente com a análise primária do mesmo ensaio (HR 0,73; 0,57–0,93)"),
                 (-1, "comparador everolimo não é padrão atual (regra 6) — população (pós-1–2 antiangiogênicos) = regime"),
                 (-1, "IC 0,62–0,85 exclui o nulo, mas RRR 27% < 30% e nº de óbitos NÃO transcrito (deduzível ≥ 600 das probabilidades de SG em 5 anos × N, mas não escrito) — OIS não demonstrável pela regra 7: item de calibração nº 1"),
                 (0, "registro prévio (NCT01668784)")),
    certeza="C",
    recomendacao={"forca": "condicional", "direcao": "a_favor",
                  "base": "incorporado; SG HR 0,73 mantida a 5 anos; ESMO-MCBS 5 — a certeza C é artefato das regras 6/7 sobre esta fonte (comparador obsoleto + eventos não transcritos); ver calibração", "sem_mcbs_por": None},
    valor_rederivado="2C",
    justificativa="RCT fase 3 aberto (N=821): SG HR 0,73 (0,62–0,85), 5 anos. −1 indireta (comparador everolimo obsoleto), −1 imprecisão (eventos não transcritos, RRR < 30%). Resultado 2C é o caso-teste das regras: o revisor decide se eventos deduzíveis contam e se comparador obsoleto rebaixa quando a indicação é a mesma.")

# ---------------------------------------------------------------------------------------------
# 9. renal-met-2l-pos-io-cabozantinibe — METEOR (NEJM 2015), texto PMC
tr = transcrever("10.1056_NEJMoa1510016.PMC5024539.pmc.html",
                 "At the prespecified interim analysis of overall survival, 202 deaths", "0.51 to 0.89; P=0.005)")
B["renal-met-2l-pos-io-cabozantinibe"] = bloco(
    doi="10.1056/NEJMoa1510016", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 658,
             "descricao": "METEOR — cabozantinibe vs everolimo após terapia anti-VEGFR, fase 3 aberto, N=658; primário SLP; SG em análise interina (202 óbitos de 408 planejados)"},
    efeito={"medida": "HR", "valor": 0.67, "ic95": [0.51, 0.89], "sentido_beneficio": "menor", "eventos": 202,
            "transcricao": tr, "fonte_transcricao": "pmc_fulltext"},
    pivo={"intervencao": ["Cabozantinibe"], "comparador": "everolimo", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": False, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (60 mg/d); everolimo padrão de 2ª linha em 2015; primário SLP positivo (HR 0,58; 0,45–0,75). População do ensaio = pós-TKI VEGFR; o regime é 2ª linha PÓS-IMUNOTERAPIA — extrapolação (nota do revisor 13/09: 'METEOR mantido')",
          "referencia_proposta": "10.1016/s1470-2045(16)30107-3 — Choueiri 2016 Lancet Oncol (METEOR final): SG madura"},
    dominios=dom((0, "aberto; SG"),
                 (0, "ensaio único; sem contradição citada"),
                 (-1, "população pós-TKI ≠ regime pós-IO; comparador everolimo obsoleto"),
                 (-1, "202 óbitos < 300; interina que não cruzou o limite de significância (p exigido ≤ 0,0019); limite 0,89 > 0,85"),
                 (0, "registro prévio (NCT01865747)")),
    certeza="C",
    recomendacao={"forca": "condicional", "direcao": "a_favor",
                  "base": "incorporado em 2ª linha (nota do revisor); ESMO-MCBS 3; evidência indireta para o cenário pós-IO", "sem_mcbs_por": None},
    valor_rederivado="2C",
    justificativa="RCT fase 3 aberto (N=658): SG interina HR 0,67 (0,51–0,89), 202 óbitos. −1 indireta (pós-TKI → pós-IO), −1 imprecisão (< 300 eventos, interina). Condicional a favor. Referência final proposta.")

# ---------------------------------------------------------------------------------------------
# 10. renal-naoclaras-sunitinibe-pazopanibe — ASPEN (Lancet Oncol 2016), fase 2 randomizado
tr = transcrever("10.1016_S1470-20451500515-X.europepmc.json",
                 "As of December, 2014, 87 progression-free survival events", "p=0·16)")
B["renal-naoclaras-sunitinibe-pazopanibe"] = bloco(
    doi="10.1016/S1470-2045(15)00515-X", desfecho_critico="SLP",
    desenho={"tipo": "rct_fase2", "cegamento": "aberto", "n": 108,
             "descricao": "ASPEN — everolimo vs sunitinibe em não-células claras (papilífero/cromófobo/inclassificado), fase 2 randomizado aberto, N=108, 87 eventos; desenhado com IC 80%"},
    efeito={"medida": "HR", "valor": 1.41, "ic95": [1.03, 1.92], "ic_nivel": 80, "sentido_beneficio": "maior", "eventos": 87,
            "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Sunitinibe"], "comparador": "everolimo", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": False, "primario_positivo": True, "sustenta": True,
          "intervencao_nao_cobre": {"farmacos": ["Pazopanibe"], "por": "ASPEN testou só sunitinibe; pazopanibe no regime é extrapolação de classe"},
          "por": "sunitinibe = braço do ensaio; HR 1,41 é do everolimo em relação ao sunitinibe (>1 favorece sunitinibe); critério do desenho (IC 80%) atingido, p=0,16; comparador atual em papilífero é cabozantinibe (SWOG 1500, citado no corpus)"},
    dominios=dom((0, "aberto; SLP RECIST 1.1; ITT; banco fechado aos 87 eventos por financiamento (poder 82%)"),
                 (0, "ensaio único; heterogeneidade por histologia notada no abstract (não penalizada aqui — vai para indireta)"),
                 (-1, "SLP substituto (SG não diferente: HR 1,12; 0,7–2,1); pazopanibe não testado; população mista vs regime 'papilífero'"),
                 (-1, "IC 80% (1,03–1,92), p=0,16; 87 eventos; IC 95% incluiria o nulo (regra 4)"),
                 (0, "—")),
    certeza="D",
    recomendacao={"forca": "condicional", "direcao": "a_favor",
                  "base": "opção em não-células claras na ausência de padrão; certeza muito baixa; MCBS n/a (fase 2, comparador ativo)", "sem_mcbs_por": None},
    valor_rederivado="2D",
    justificativa="Fase 2 randomizado (N=108): SLP HR 1,41 (IC 80% 1,03–1,92; p=0,16), 87 eventos. Regra do squad: parte de C, −1 indireta, −1 imprecisão → D. Cálculo ortodoxo (RCT parte de A): A −1 −1 = B, ou A −1 −2 (imprecisão muito séria) = C — ver tabela do piloto.")

# ---------------------------------------------------------------------------------------------
regimes = []
for rid, g in B.items():
    r = copy.deepcopy(por_id[rid])
    r["verificacao"]["grade"] = g
    regimes.append(r)
assert len(regimes) == 10 and {r["tumor"] for r in regimes} == {"renal"}
json.dump({"meta": {"titulo": "PILOTO de calibração — re-derivação GRADE schema 2, RENAL (10 regimes); NÃO promovido",
                    "base": rel, "gerado_em": "2026-09-17"}, "regimes": regimes},
          open(os.path.join(AQUI, "regimes-consolidados.json"), "w"), ensure_ascii=False, indent=1)
json.dump([dict(regimen_id=k, eixo="a qualidade da evidência e a força da recomendação", **v) for k, v in B.items()],
          open(os.path.join(AQUI, "verificacao-grade-renal.json"), "w"), ensure_ascii=False, indent=1)
print("10 blocos gravados; transcrições conferidas contra fontes/")
