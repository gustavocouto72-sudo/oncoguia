#!/usr/bin/env python3
"""
ONDA 3 — re-derivação GRADE (schema 2) dos 8 regimes de COLO DE ÚTERO (regras C1–C9).

v2: referência do card = publicação mais madura do MESMO estudo (C4); eventos deduzidos com o
cálculo escrito (C1); comparador obsoleto só rebaixa se muda a decisão (C2); IC ≠ 95% é fato (C3);
fase II randomizado parte de A (C5); direção controversa fica pendente do revisor (C6);
referências extras são adicionais (C7). A v1 está em v1/.

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
        # espaços finos/não-quebráveis (\u2009, \u00a0) do editor viram espaço comum
        return re.sub(r"[\u2009\u00a0]", " ", html.unescape(TAG.sub(" ", j["resultList"]["result"][0]["abstractText"])))
    t = html.unescape(TAG.sub(" ", b))
    return re.sub(r"\s+", " ", t)


def T(nome, *pares):
    """Vários trechos do mesmo arquivo, unidos por ' | '."""
    return " | ".join(transcrever(nome, a, b) for a, b in pares)


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
FIN, ATU, INT = "final", "atualizada", "interina"


def indeterminado(doi, motivo, justificativa, extras=None):
    g = {"schema": 2, "status": "indeterminado", "afirmado_protocolo": None,
         "motivo_indeterminado": "fonte_inacessivel: " + motivo,
         "desfecho_critico": None, "desenho": None, "efeito": None, "pivo": None, "dominios": None,
         "elevacoes": [], "certeza": None, "substituto_excecao": None, "pivo_nao_sustenta": True,
         "recomendacao": None, "valor_rederivado": None, "justificativa": justificativa,
         "fonte": "https://doi.org/" + doi}
    if extras: g["pivo_info"] = extras
    return g



# 1. colo-adj-cisplatina-crt — Peters 2000 sem IC no abstract → C9: Cochrane CD005342 (QRT vs RT adjuvante, moderada)
FC = "10.1002_14651858.cd005342.pub4.europepmc.json"
tr = T(FC, ("Compared with adjuvant radiotherapy, chemotherapy combined with radiotherapy significantly reduced the risk of death", "(I² = 0% for both meta-analyses)."),
           ("We considered the evidence for all three outcomes to be of a moderate quality", "included studies."))
B["colo-adj-cisplatina-crt"] = bloco(
    doi="10.1002/14651858.cd005342.pub4", desfecho_critico="SG",
    desenho={"tipo": "meta_analise_rct", "cegamento": "nao_informado", "n": 297, "descricao": "Cochrane CD005342 (Rosa 2016) — QT + RT vs RT adjuvante pós-cirurgia em colo inicial: 2 RCTs, 297 mulheres (corpo, C9), GRADE moderada. Ensaio registrado (Peters 2000, N=243): HR SG 1,96 (RT vs RT+QT), P=0,007, SEM IC no abstract — adicional"},
    efeito={"medida": "HR", "valor": 0.56, "ic95": [0.36, 0.87], "sentido_beneficio": "menor", "eventos": None, "eventos_por": None,
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Cisplatina"], "comparador": "RT adjuvante isolada", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "C9: o abstract do Peters não traz IC → a certeza é avaliada sobre o corpo (QRT à base de platina vs RT pós-cirurgia). Esquema do regime (cisplatina semanal 40 mg/m²) difere do Peters (cisplatina + 5-FU q3s) — o corpo é de classe 'QT + RT' e o CCCMAC (CD008285) não achou diferença por esquema/dose de QT; não penalizado (juízo, ver referendo)",
          "referencia_corpo": {"doi": "10.1002/14651858.cd005342.pub4", "tipo": "cochrane", "comparacao": "QT combinada com RT vs RT adjuvante, colo inicial pós-cirurgia (SG)", "certeza_declarada": "moderada",
                               "por": "fonte registrada sem IC; corpo com grau declarado"},
          "referencias_adicionais": [{"doi": "10.1200/JCO.2000.18.8.1606", "papel": "Peters 2000 (SWOG 8797/GOG 109): SG HR 1,96 (RT vs RT+QT), P=0,007; SLP 4 a 80% vs 63%"},
                                     {"doi": "10.1002/14651858.cd008285", "papel": "CCCMAC (Cochrane 2010): QRT vs RT em 13 RCTs HR 0,81; sem diferença por dose/esquema de QT"}]},
    dominios=dom((0, "RCTs; Cochrane não rebaixa por RoB"), (0, "I² = 0% nos dois desfechos"),
                 (0, "população (colo inicial alto risco pós-histerectomia) = regime; esquema semanal ≠ cis+5-FU do Peters, tratado como classe (juízo)"),
                 (-1, "297 mulheres, 2 ensaios; Cochrane gradua moderada 'por números pequenos e seguimento limitado'"),
                 (0, "busca sistemática (Cochrane)")),
    certeza="B", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado; SG HR 0,56 (corpo, moderada); ESMO-MCBS A (curativo); padrão pós-cirurgia de alto risco", "sem_mcbs_por": None},
    valor_rederivado="1B", justificativa="C9: Cochrane CD005342 — QRT vs RT adjuvante: SG HR 0,56 (0,36–0,87), moderada (teto B). −1 imprecisão (297 mulheres). Forte a favor. Peters (registrado) sem IC no abstract.")

# 2. colo-qrt-induction-interlace — INTERLACE (Lancet 2024)
F = "10.1016_S0140-67362401438-7.europepmc.json"
tr = T(F, ("500 eligible patients were enrolled and randomly assigned", "chemoradiotherapy group."),
          ("5-year overall survival rates were 80%", "p=0·015)."))
B["colo-qrt-induction-interlace"] = bloco(
    doi="10.1016/S0140-6736(24)01438-7", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 500, "descricao": "INTERLACE — indução carbo/paclitaxel semanal ×6 → QRT vs QRT, colo localmente avançado, fase 3 aberto, N=500; seguimento 67 m"},
    efeito={"medida": "HR", "valor": 0.60, "ic95": [0.40, 0.91], "sentido_beneficio": "menor",
            "eventos": 120, "eventos_por": "deduzido de SG 5 a 80% × 250 (≈ 50 óbitos) + 72% × 250 (≈ 70) = 120",
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Carboplatina + Paclitaxel (indução)", "Cisplatina"], "comparador": "QRT padrão (cisplatina semanal + RT + braquiterapia)", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True, "por": "braço experimental = regime; QRT padrão é o comparador; primário SLP positivo (HR 0,65; 0,46–0,91) e SG positiva"},
    dominios=dom((0, "aberto; SG"), (0, "ensaio único; SLP e SG concordantes"),
                 (0, "população (70% IIB, 11% IIIB) = regime IB3/IIA/IIB"),
                 (-1, "≈120 óbitos (deduzido) < 300; RRR 40% mas limite superior 0,91 > 0,85 (convenção) — OIS não atingido"),
                 (0, "registro prévio")),
    certeza="B", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado; SG HR 0,60 e SLP HR 0,65; ESMO-MCBS A (curativo)", "sem_mcbs_por": None},
    valor_rederivado="1B", justificativa="INTERLACE: SG HR 0,60 (0,40–0,91), ≈120 óbitos. −1 imprecisão (IC largo; < 300 eventos; convenção). Forte a favor.")

# 3. colo-qrt-io-keynote-a18 — C4: 2ª interina de SG (Lancet out/2024)
F = "10.1016_s0140-67362401808-7.europepmc.json"
tr = T(F, ("1060 patients at 176 sites", "placebo-chemoradiotherapy group."),
          ("36-month overall survival was 82·6%", "p=0·0040),"))
B["colo-qrt-io-keynote-a18"] = bloco(
    doi="10.1016/s0140-6736(24)01808-7", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "duplo_cego", "n": 1060, "descricao": "KEYNOTE-A18 — pembrolizumabe + QRT → pembrolizumabe vs placebo, colo localmente avançado de alto risco, fase 3 duplo-cego, N=1.060; 2ª análise interina (29,9 m)"},
    efeito={"medida": "HR", "valor": 0.67, "ic95": [0.50, 0.90], "sentido_beneficio": "menor",
            "eventos": 226, "eventos_por": "deduzido de SG 36 m 82,6% × 529 (≈ 92 óbitos) + 74,8% × 531 (≈ 134) = 226",
            "analise": INT, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Pembrolizumabe", "Cisplatina + RT"], "comparador": "placebo + QRT", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime; QRT padrão + placebo é o comparador; coprimários SLP (HR 0,70; 0,55–0,89) e SG positivos",
          "referencia_atualizada": {"doi": "10.1016/s0140-6736(24)01808-7", "pmid": "39288779", "por": "C4: 2ª interina com SG significativa (fonte registrada: 1ª interina, SG HR 0,73; 0,49–1,07 não significativa)"}},
    dominios=dom((0, "duplo-cego, placebo"), (0, "ensaio único; SLP e SG concordantes"),
                 (0, "regime (III–IVA, rótulo) ⊂ população do ensaio (IB2–IIB N+ e III–IVA)"),
                 (-1, "análise interina sem final (C4); ≈226 óbitos < 300; limite superior 0,90 > 0,85 (convenção)"),
                 (0, "registro prévio (NCT04221945)")),
    certeza="B", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado (III–IVA); SG HR 0,67 e SLP HR 0,70; ESMO-MCBS A (curativo)", "sem_mcbs_por": None},
    valor_rederivado="1B", justificativa="KEYNOTE-A18 (2ª interina): SG HR 0,67 (0,50–0,90), ≈226 óbitos. −1 imprecisão (interina; OIS). Forte a favor.")

# 4. colo-met-1l-pembrolizumabe-qt-cps1 — KEYNOTE-826 SG final (JCO 2023) — já é a madura
F = "10.1200_JCO.23.00914.europepmc.json"
tr = transcrever(F, "In the PD-L1 CPS ≥1 (N = 548)", "0.49 to 0.74]),")
B["colo-met-1l-pembrolizumabe-qt-cps1"] = bloco(
    doi="10.1200/JCO.23.00914", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "duplo_cego", "n": 548, "descricao": "KEYNOTE-826 — pembrolizumabe + QT à base de platina ± bevacizumabe vs placebo + QT, colo persistente/recidivado/metastático; SG final, CPS≥1 N=548 (toda a coorte 617)"},
    efeito={"medida": "HR", "valor": 0.60, "ic95": [0.49, 0.74], "sentido_beneficio": "menor",
            "eventos": 274, "eventos_por": "deduzido de medianas de SG atingidas nos dois braços (28,6 e 16,5 m) → ≥ 50% de 548 = ≥ 274 (limite inferior)",
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Pembrolizumabe", "Cisplatina/Carboplatina + Paclitaxel"], "comparador": "placebo + platina/paclitaxel ± bevacizumabe", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True, "por": "braço experimental = regime; QT à base de platina é o comparador; SG final positiva em CPS≥1 (população do regime)"},
    dominios=dom((0, "duplo-cego, placebo"), (0, "ensaio único; consistente entre CPS≥1, toda a coorte e CPS≥10"),
                 (0, "população CPS≥1 = regime; bevacizumabe opcional nos dois braços (não incorporado aqui) — sem impacto no contraste"),
                 (0, "RRR 40% com limite superior 0,74 ≤ 0,85 = efeito grande (convenção); ≥ 274 óbitos; SG final"), (0, "registro prévio")),
    certeza="A", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado; SG HR 0,60 final; ESMO-MCBS 4", "sem_mcbs_por": None},
    valor_rederivado="1A", justificativa="KEYNOTE-826 SG final (CPS≥1): HR 0,60 (0,49–0,74), efeito grande. Nenhum domínio rebaixado. Forte a favor.")

# 5. colo-met-1l-qt-cps-neg — GOG-169 (DOI registrado): sem HR/IC; SG sem diferença
B["colo-met-1l-qt-cps-neg"] = indeterminado(
    "10.1200/JCO.2004.04.170",
    "o pivô registrado (GOG-169, Moore 2004: cisplatina ± paclitaxel, N=264) traz TRO 36% vs 19% (p=0,002) e SLP mediana 4,8 vs 2,8 m (p<0,001) SEM HR/IC, e 'sem diferença' em SG (9,7 vs 8,8 m): não há efeito transcritível (regra 7) e a SG não foi demonstrada. GOG-204 (2009) só confirma cisplatina + paclitaxel como o melhor dos 4 doublets (HRs dos outros vs PC 1,15–1,32, sem superioridade); JCOG0505 (2015) sustenta carboplatina como não inferior (SG HR 0,994; IC 90% 0,79–1,25)",
    "Estimativas de efeito são incertas com o pivô registrado (backbone de classe). FATO: GOG-169 sem HR/IC e SG NS; Cochrane CD006469 (2012) diz que SG/SLP 'não foram adequadamente reportadas' e não há comparação com BSC. DECISÃO: qual pivô sustenta 'paclitaxel + platina' como 1ª linha em CPS<1 — GOG-204 (referência entre doublets) + JCOG0505 (carboplatina) como adicionais, ou os braços de QT do GOG-240/KEYNOTE-826 como padrão de fato.",
    extras={"referencias_adicionais": [{"doi": "10.1200/jco.2009.21.8909", "papel": "GOG-204 — 4 doublets de cisplatina: PC é a referência (VC/GC/TC não superiores)"},
                                       {"doi": "10.1200/jco.2014.58.4391", "papel": "JCOG0505 — carboplatina + paclitaxel NI a cisplatina + paclitaxel (SG HR 0,994; IC 90% 0,79–1,25)"},
                                       {"doi": "10.1002/14651858.cd006469.pub2", "papel": "Cochrane 2012 — QT em colo metastático: sem dados vs BSC; SG/SLP inadequadamente reportadas"}]})

# 6. colo-met-cemiplimabe-refrataria — EMPOWER-Cervical 1; C4: análise final de SG (EJC 2025)
F = "10.1016_j.ejca.2024.115146.europepmc.json"; F22 = "10.1056_NEJMoa2112187.europepmc.json"
tr = transcrever(F, "median OS was 11.7 versus 8.5 months", "0.56-0.80, p < .00001).") + " | [NEJM 2022] " + transcrever(F22, "A total of 608 women were enrolled", "each group).")
B["colo-met-cemiplimabe-refrataria"] = bloco(
    doi="10.1016/j.ejca.2024.115146", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 608, "descricao": "EMPOWER-Cervical 1 — cemiplimabe vs QT à escolha após platina, fase 3 aberto, N=608; análise final de SG (47,3 m)"},
    efeito={"medida": "HR", "valor": 0.67, "ic95": [0.56, 0.80], "sentido_beneficio": "menor",
            "eventos": 304, "eventos_por": "deduzido de medianas de SG atingidas nos dois braços (11,7 e 8,5 m) → ≥ 50% de 304 + ≥ 50% de 304 = ≥ 304 (limite inferior)",
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Cemiplimabe"], "comparador": "QT à escolha do investigador", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True, "por": "braço experimental = regime (350 mg q3s); QT de agente único era o padrão de 2ª linha; primário SG positivo, mantido na análise final",
          "referencia_atualizada": {"doi": "10.1016/j.ejca.2024.115146", "pmid": "39798514", "por": "C4: análise final de SG do mesmo ensaio (fonte registrada: NEJM 2022, HR 0,69; 0,56–0,84)"}},
    dominios=dom((0, "aberto; SG"), (0, "ensaio único; efeito estável (0,69 → 0,67); consistente por histologia e PD-L1"),
                 (0, "população (recidiva pós-platina, sem IO prévia) = regime"),
                 (0, "≥ 304 óbitos ≥ 300 (deduzido, C1); IC 0,56–0,80 exclui o nulo; RRR 33% com limite ≤ 0,85"), (0, "registro prévio (NCT03257267)")),
    certeza="A", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado; SG HR 0,67 final; ESMO-MCBS 5", "sem_mcbs_por": None},
    valor_rederivado="1A", justificativa="EMPOWER-Cervical 1 final: SG HR 0,67 (0,56–0,80), ≥ 304 óbitos. Nenhum domínio rebaixado. Forte a favor.")

# 7. colo-met-bevacizumabe-nao-incluido — GOG-240; C4: SG final (Lancet 2017); não incluído → contra
F = "10.1016_s0140-67361731607-0.europepmc.json"
tr = T(F, ("By March 7, 2014, 348 deaths had occurred", "final analysis."),
          ("16·8 months in the chemotherapy plus bevacizumab groups versus 13·3 months", "p=0·007)."))
B["colo-met-bevacizumabe-nao-incluido"] = bloco(
    doi="10.1016/s0140-6736(17)31607-0", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 452, "descricao": "GOG-240 — QT (cis/paclitaxel ou topotecano/paclitaxel) ± bevacizumabe, fatorial 2×2, fase 3 aberto, N=452; SG final com 348 óbitos"},
    efeito={"medida": "HR", "valor": 0.77, "ic95": [0.62, 0.95], "sentido_beneficio": "menor", "eventos": 348, "eventos_por": "transcrito",
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Bevacizumabe + QT"], "comparador": "QT isolada (cis/paclitaxel ou topotecano/paclitaxel)", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "bevacizumabe + QT = regime; desenho fatorial (a comparação de QT é ortogonal, não confunde o contraste do bevacizumabe); primário SG positivo, mantido na final",
          "referencia_atualizada": {"doi": "10.1016/s0140-6736(17)31607-0", "pmid": "28756902", "por": "C4: análise final de SG (fonte registrada: NEJM 2014, HR 0,71; IC 98% 0,54–0,95)"},
          "referencias_adicionais": [{"doi": "10.1002/14651858.cd013348.pub2", "papel": "Cochrane CD013348 (2021): mesmo ensaio, SG HR 0,77 (0,62–0,95) graduado BAIXA certeza (1 estudo, 452 pts) — divergência a registrar"}]},
    dominios=dom((0, "aberto; SG (desfecho duro — cegamento não afeta; a revisão externa citada em pivo.por rebaixou — juízo, ver referendo)"), (0, "ensaio único"),
                 (0, "população (persistente/recidivada/metastática) = regime"),
                 (0, "348 óbitos ≥ 300 (transcrito); IC 0,62–0,95 exclui o nulo (limite exatamente no colchão da regra 4)"), (0, "registro prévio (NCT00803062)")),
    certeza="A", recomendacao={"forca": "condicional", "direcao": "contra", "base": "NÃO incluído (flag do corpus: MCBS 3, custo; Cochrane: ICER USD 295.164/QALY, fístulas RR 18); política institucional; certeza A", "sem_mcbs_por": None},
    valor_rederivado="2A", justificativa="GOG-240 final: SG HR 0,77 (0,62–0,95), 348 óbitos. Nenhum domínio rebaixado pelas regras (a revisão CD013348 gradua o mesmo ensaio como baixa — divergência registrada em pivo.por). Não incluído → condicional CONTRA. Antes: 1A.")

# 8. colo-met-2l-monoterapia — McGuire 1996: fase 2 braço único de UM agente (ORR 17%, sem IC) para uma classe de 7
B["colo-met-2l-monoterapia"] = indeterminado(
    "10.1200/JCO.1996.14.3.792",
    "o pivô registrado (McGuire 1996, GOG) é fase 2 de braço único de paclitaxel com TRO 17% (2 RC + 7 RP) sem IC — não há efeito comparativo transcritível, e o regime é uma CLASSE de 7 agentes (paclitaxel, vinorelbina, ifosfamida, irinotecano, gemcitabina, pemetrexede, topotecano)",
    "Estimativas de efeito são incertas: evidência de atividade (fase 2, um agente), não de benefício. FATO: sem comparador, sem IC. DECISÃO: corpo para monoterapia pós-platina (Cochrane CD006469, 2012, sem dados de SG adequados) ou o braço de QT do EMPOWER-Cervical 1 (agente único como comparador, SG mediana 8,5 m) como referência do que a monoterapia entrega. O valor antigo (2C) já era o mais baixo do corpus; indeterminado é o registro honesto de que não há estimativa.",
    extras={"referencias_adicionais": [{"doi": "10.1002/14651858.cd006469.pub2", "papel": "Cochrane 2012 — QT em colo metastático/recidivado"},
                                       {"doi": "10.1056/NEJMoa2112187", "papel": "EMPOWER-Cervical 1 — braço de QT de agente único (comparador): SG mediana 8,5 m"}]})
# ---------------------------------------------------------------------------------------------
regimes = []
for rid, g in B.items():
    r = copy.deepcopy(por_id[rid])
    r["verificacao"]["grade"] = g
    regimes.append(r)
assert len(regimes) == 8 and {r["tumor"] for r in regimes} == {"colo-utero"}
json.dump({"meta": {"titulo": "ONDA 3 — re-derivação GRADE schema 2, COLO DE ÚTERO (8 regimes); NÃO promovido",
                    "base": rel, "gerado_em": "2026-09-17"}, "regimes": regimes},
          open(os.path.join(AQUI, "regimes-consolidados.json"), "w"), ensure_ascii=False, indent=1)
json.dump([dict(regimen_id=k, eixo="a qualidade da evidência e a força da recomendação", **v) for k, v in B.items()],
          open(os.path.join(AQUI, "verificacao-grade-colo-utero.json"), "w"), ensure_ascii=False, indent=1)
print("8 blocos gravados; transcrições conferidas contra fontes/")
