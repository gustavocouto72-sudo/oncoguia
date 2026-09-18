#!/usr/bin/env python3
"""
ONDA 1 — re-derivação GRADE (schema 2) dos 19 regimes de ESÔFAGO-ESTÔMAGO (regras C1–C8).

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

# 1. eso-perioperatorio-flot — FLOT4 (Lancet 2019, final)
F = "10.1016_S0140-67361832557-1.europepmc.json"
tr = T(F, ("360 patients were assigned to ECF/ECX", "356 patients to FLOT."),
          ("Overall survival was increased in the FLOT group", "vs 35 months [27·35 to 46·26])."))
B["eso-perioperatorio-flot"] = bloco(
    doi="10.1016/S0140-6736(18)32557-1", desfecho_critico="SG",
    desenho={"tipo": "rct_fase2_3", "cegamento": "aberto", "n": 716, "descricao": "FLOT4 — FLOT vs ECF/ECX perioperatório, fase 2/3 aberto, N=716 (fase 3)"},
    efeito={"medida": "HR", "valor": 0.77, "ic95": [0.63, 0.94], "sentido_beneficio": "menor",
            "eventos": 358, "eventos_por": "deduzido de medianas de SG atingidas nos dois braços (50 e 35 m) → ≥ 50% de 356 + ≥ 50% de 360 = ≥ 358 (limite inferior)",
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Docetaxel", "Oxaliplatina", "Leucovorina", "5-Fluorouracil"], "comparador": "ECF/ECX", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": False, "comparador_muda_decisao": False, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (4+4 ciclos); ECF/ECX era o padrão perioperatório (MAGIC) e o FLOT é o padrão que o substituiu — a pergunta já foi respondida, sem segunda punição (C2); primário SG positivo"},
    dominios=dom((0, "aberto; SG"), (0, "ensaio único; sem contradição citada"),
                 (0, "população (adenocarcinoma gástrico/JEG ressecável cT2+ ou N+) = regime"),
                 (0, "≥ 358 óbitos (deduzido, C1); IC 0,63–0,94 exclui o nulo"), (0, "registro prévio")),
    certeza="A", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado; SG HR 0,77; ESMO-MCBS A (curativo); padrão perioperatório", "sem_mcbs_por": None},
    valor_rederivado="1A", justificativa="FLOT4: SG HR 0,77 (0,63–0,94), ≥ 358 óbitos deduzidos. Nenhum domínio rebaixado. Forte a favor.")

# 2. eso-neoadj-crt-carbo-paclitaxel — CROSS; C4: 10 anos (JCO 2021)
F = "10.1200_jco.20.03614.europepmc.json"; F12 = "10.1056_NEJMoa1112088.europepmc.json"
tr = T(F, ("Patients receiving neoadjuvant chemoradiotherapy had better overall survival", "0.55 to 0.89)."),
          ("The absolute 10-year overall survival benefit was 13%", "(38%  v  25%).")) + " | [NEJM 2012] " + transcrever(F12, "Of the 366 patients, 178", "188 to surgery alone.")
B["eso-neoadj-crt-carbo-paclitaxel"] = bloco(
    doi="10.1200/jco.20.03614", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 366, "descricao": "CROSS — QRT neoadjuvante (carbo/paclitaxel + 41,4 Gy) + cirurgia vs cirurgia, fase 3 aberto, N=366; seguimento 147 m"},
    efeito={"medida": "HR", "valor": 0.70, "ic95": [0.55, 0.89], "sentido_beneficio": "menor",
            "eventos": 251, "eventos_por": "deduzido de SG 10 a 38% × 178 (≈ 110 óbitos) + 25% × 188 (≈ 141) = 251 (N por braço da publicação primária, NEJM 2012)",
            "analise": ATU, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Carboplatina", "Paclitaxel"], "comparador": "cirurgia isolada", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": True, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (AUC 2 + 50 mg/m² semanal ×5 + RT); cirurgia isolada era o padrão; primário SG positivo e mantido a 10 anos",
          "referencia_atualizada": {"doi": "10.1200/jco.20.03614", "pmid": "33891478", "por": "C4: desfecho de 10 anos do mesmo ensaio (fonte registrada: NEJM 2012)"}},
    dominios=dom((0, "aberto; SG"), (0, "efeito estável (0,657 → 0,70) e não dependente do tempo"),
                 (0, "população esôfago/JEG (75% adeno, 23% escamoso) = regime"),
                 (-1, "≈251 óbitos (deduzido) < 300; RRR 30% mas limite superior 0,89 > 0,85 — não é 'efeito grande' pela CONVENÇÃO DO SQUAD; OIS não atingido"),
                 (0, "registro prévio (NTR487)")),
    certeza="B", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado; SG HR 0,70 a 10 anos; ESMO-MCBS A (curativo); padrão de cuidado", "sem_mcbs_por": None},
    valor_rederivado="1B", justificativa="CROSS 10 anos: SG HR 0,70 (0,55–0,89), ≈251 óbitos deduzidos. −1 imprecisão pela convenção de efeito grande (IC sup 0,89) e OIS. Forte a favor. Caso-teste da convenção.")

# 3. eso-def-crt-cisplatina-5fu — RTOG 85-01; C4: Cooper 1999 (JAMA), 5 anos
F = "10.1001_jama.281.17.1623.europepmc.json"
tr = T(F, ("In the randomized part of the trial, at 5 years of follow-up", "compared with 0% following RT."),
          ("Persistence of disease (despite therapy) was the most common mode", "treated with RT only (23/62 [37%])."))
B["eso-def-crt-cisplatina-5fu"] = bloco(
    doi="10.1001/jama.281.17.1623", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": None, "descricao": "RTOG 85-01 — QRT (cisplatina/5-FU + 50 Gy) vs RT 64 Gy, fase 3 aberto; N por braço não está nos abstracts (RT isolada = 62, transcrito); seguimento 5 anos"},
    efeito={"medida": "diferenca_absoluta", "valor": 26, "ic95": [15, 37], "sentido_beneficio": "maior",
            "eventos": None, "eventos_por": None,
            "analise": ATU, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Cisplatina", "5-Fluorouracil"], "comparador": "RT isolada (64 Gy)", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": False, "comparador_muda_decisao": False, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (RTOG 85-01); RT isolada era o padrão e a pergunta 'QRT vs RT' já foi respondida — QRT é o padrão que substituiu (C2, sem segunda punição); primário SG positivo",
          "referencia_atualizada": {"doi": "10.1001/jama.281.17.1623", "pmid": "10235156", "por": "C4: seguimento de 5 anos do mesmo ensaio (fonte registrada: NEJM 1992)"}},
    dominios=dom((0, "aberto; SG. Interrupção precoce por benefício (auditoria) não consta nos abstracts — não afirmada"),
                 (0, "ensaio único; efeito consistente entre 1992 e 1999"),
                 (0, "população T1-3 N0-1 M0 escamoso/adeno = regime de QRT definitiva"),
                 (-1, "N < 130 randomizados (RT isolada 62 pts, 0% vivos a 5 a); eventos certamente < 300; diferença absoluta 26% (IC 15–37%) exclui 0, mas OIS longe — medida absoluta não entra na convenção de efeito grande"),
                 (0, "—")),
    certeza="B", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado; SG 5 a 26% vs 0%; ESMO-MCBS A (curativo); padrão de QRT definitiva", "sem_mcbs_por": None},
    valor_rederivado="1B", justificativa="RTOG 85-01 a 5 anos: SG 26% (15–37%) vs 0%. −1 imprecisão (N pequeno, < 300 eventos). Forte a favor. Como derivado na auditoria (1B).")

# 4. gastrico-adj-nivolumabe — CheckMate 577 (NEJM 2021; sem versão madura com abstract); C8: SLD duro em adjuvância
F = "10.1056_NEJMoa2032125.europepmc.json"
tr = transcrever(F, "Among the 532 patients who received nivolumab", "0.56 to 0.86; P<0.001).")
B["gastrico-adj-nivolumabe"] = bloco(
    doi="10.1056/NEJMoa2032125", desfecho_critico="SLD",
    desenho={"tipo": "rct_fase3", "cegamento": "duplo_cego", "n": 794, "descricao": "CheckMate 577 — nivolumabe vs placebo adjuvante após QRT + cirurgia com doença residual, fase 3 duplo-cego, N=794 (2:1)"},
    efeito={"medida": "HR", "valor": 0.69, "ic95": [0.56, 0.86], "ic_nivel": 96.4, "sentido_beneficio": "menor",
            "eventos": 397, "eventos_por": "deduzido de medianas de SLD atingidas nos dois braços (22,4 e 11,0 m) → ≥ 50% de 532 + ≥ 50% de 262 = ≥ 397 (limite inferior)",
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Nivolumabe"], "comparador": "placebo", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (240 mg q2w ×16 sem → 480 mg q4w, 1 ano); placebo/observação era e é o comparador; primário SLD positivo"},
    dominios=dom((0, "duplo-cego, placebo"), (0, "ensaio único; consistente entre subgrupos pré-especificados"),
                 (0, "população (doença residual pós-QRT neoadjuvante + cirurgia) = regime; SLD é desfecho crítico duro em adjuvância (C8)"),
                 (0, "≥ 397 eventos (deduzido, C1); IC 96,4% 0,56–0,86 exclui o nulo (C3)"), (0, "registro prévio (NCT02743494)")),
    certeza="A", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado; SLD HR 0,69 duplo-cego; ESMO-MCBS A (curativo)", "sem_mcbs_por": None},
    valor_rederivado="1A", justificativa="CheckMate 577: SLD HR 0,69 (96,4% IC 0,56–0,86), ≥ 397 eventos deduzidos. Nenhum domínio rebaixado. Forte a favor. Sem versão madura com abstract (3 anos só em congresso).")

# 5. gastrico-adj-capox — CLASSIC; C4: 5 anos (Lancet Oncol 2014)
F = "10.1016_s1470-20451470473-5.europepmc.json"
tr = T(F, ("139 (27%) patients had disease-free survival events", "p<0·0001)."),
          ("By the clinical cutoff date, 103 patients (20%) had died", "p=0·0015)."))
B["gastrico-adj-capox"] = bloco(
    doi="10.1016/s1470-2045(14)70473-5", desfecho_critico="SLD",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 1035, "descricao": "CLASSIC — CAPOX adjuvante ×8 vs observação pós-gastrectomia D2, fase 3 aberto, N=1.035; seguimento 62,4 m"},
    efeito={"medida": "HR", "valor": 0.58, "ic95": [0.47, 0.72], "sentido_beneficio": "menor",
            "eventos": 342, "eventos_por": "deduzido de 139 + 203 eventos de SLD transcritos = 342",
            "analise": ATU, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Capecitabina", "Oxaliplatina"], "comparador": "observação", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (8 ciclos q21d); observação pós-D2 era o padrão no Leste asiático; primário SLD positivo; SG também positiva (HR 0,66; 0,51–0,85)",
          "referencia_atualizada": {"doi": "10.1016/s1470-2045(14)70473-5", "pmid": "25439693", "por": "C4: seguimento de 5 anos do mesmo ensaio (fonte registrada: Lancet 2012, 3 anos)"}},
    dominios=dom((0, "aberto; SLD corroborada por SG positiva"), (0, "ensaio único; efeito estável (0,56 → 0,58)"),
                 (0, "população (estádio II–III pós-D2) = regime; SLD duro em adjuvância (C8)"),
                 (0, "342 eventos de SLD (transcritos) ≥ 300; IC 0,47–0,72 exclui o nulo com folga"), (0, "registro prévio")),
    certeza="A", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado; SLD HR 0,58 e SG HR 0,66 a 5 anos; ESMO-MCBS A (curativo)", "sem_mcbs_por": None},
    valor_rederivado="1A", justificativa="CLASSIC 5 anos: SLD HR 0,58 (0,47–0,72), 342 eventos. Nenhum domínio rebaixado. Forte a favor.")

# 6. gastrico-adj-crt-5fu-lv — INT0116, Smalley 2012 (já a versão madura)
F = "10.1200_JCO.2011.36.7136.europepmc.json"
tr = transcrever(F, "The hazard ratio (HR) for OS is 1.32", "P < .001).")
B["gastrico-adj-crt-5fu-lv"] = bloco(
    doi="10.1200/JCO.2011.36.7136", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 559, "descricao": "Intergroup 0116 — QRT adjuvante (5-FU/LV + 45 Gy) vs observação pós-R0, fase 3 aberto, N=559 (texto PMC); seguimento > 10 anos; HR expresso como observação vs QRT (> 1 favorece QRT)"},
    efeito={"medida": "HR", "valor": 1.32, "ic95": [1.10, 1.60], "sentido_beneficio": "maior", "eventos": None, "eventos_por": None,
            "analise": ATU, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["5-Fluorouracil", "Leucovorina"], "comparador": "observação", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": False, "comparador_muda_decisao": False, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (esquema INT0116); observação era o padrão; para ressecção subótima (54% < D1 no ensaio — texto PMC) a pergunta 'QRT vs nada' segue válida (C2); primário SG positivo"},
    dominios=dom((0, "aberto; SG"), (0, "ensaio único; efeito persistente a 10 anos"),
                 (0, "população (≥ T3/N+, R0, maioria D0/D1) = regime restrito a ressecção subótima"),
                 (-1, "RRR 24% (1/1,32) < 30%; nº de óbitos não transcrito nem dedutível do abstract/texto PMC (sem taxas/medianas) — OIS não demonstrável; pedido upgrade"),
                 (0, "—")),
    certeza="B", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado para ressecção subótima (D0/D1); SG HR 1,32 (obs vs QRT) a 10 anos; ESMO-MCBS A (curativo)", "sem_mcbs_por": None},
    valor_rederivado="1B", justificativa="INT0116 (10 anos): SG HR 1,32 (1,10–1,60) a favor da QRT. −1 imprecisão (óbitos não dedutíveis; RRR 24%). Forte a favor no subgrupo.")

# 7. gastrico-met-1l-cisplatina-5fu — Glimelius: DOI registrado resolve para OUTRO ensaio; o correto não sustenta cisplatina
B["gastrico-met-1l-cisplatina-5fu"] = indeterminado(
    "10.1093/oxfordjournals.annonc.a010676",
    "o DOI registrado (10.1093/oxfordjournals.annonc.a010676, 'doi_reparado' no corpus) resolve para Glimelius 1996 — QT vs BSC em câncer de PÂNCREAS E BILIAR, não o gástrico; o Glimelius 1997 gástrico (10.1023/a:1008243606668, PMID 9093725, N=61) traz SG mediana 8 vs 5 m com p=0,12 (não significativo), sem HR/IC no abstract, e sua QT (ELF / 5-FU-LV) não contém cisplatina — o pivô não sustenta o regime",
    "Estimativas de efeito são incertas para ESTE pivô: DOI errado no corpus e ensaio de N=61 sem HR/IC e sem cisplatina. Referências adicionais propostas (C7, decisão do revisor): Cochrane CD004064 (Wagner 2017: QT vs BSC HR 0,3; 0,24–0,55, certeza moderada) e REAL-2 (10.1056/nejmoa073149) como base de cisplatina + fluoropirimidina em 1ª linha.",
    extras={"referencias_adicionais": [{"doi": "10.1023/a:1008243606668", "papel": "Glimelius 1997 (gástrico) — o artigo que a citação do corpus descreve; DOI a corrigir"},
                                       {"doi": "10.1002/14651858.cd004064.pub4", "papel": "Cochrane 2017 — QT vs BSC em gástrico avançado: HR 0,3 (0,24–0,55), moderada"},
                                       {"doi": "10.1056/nejmoa073149", "papel": "REAL-2 (Cunningham 2008) — braço cisplatina/5-FU como referência de 1ª linha"}]})

# 8/9. gastrico-met-1l-folfox / capox — Al-Batran 2008 (FLO vs FLP): negativo no primário, sem HR/IC
for rid, extra in [("gastrico-met-1l-folfox", ""), ("gastrico-met-1l-capox", "; para CAPOX, a intervenção do ensaio (FLO = 5-FU infusional) não contém capecitabina")]:
    B[rid] = indeterminado(
        "10.1200/JCO.2007.13.9378",
        "o abstract do pivô registrado (Al-Batran 2008, FLO vs FLP, N=220) não traz HR/IC — SLP 5,8 vs 3,9 m com p=0,077 e SG 'sem diferença significativa': PIVÔ NEGATIVO NO PRIMÁRIO (caso 07 da auditoria)" + extra,
        "Estimativas de efeito são incertas para este pivô (comparação de esquemas, negativa no primário, sem HR/IC). A base real de oxaliplatina/fluoropirimidina em 1ª linha é a não-inferioridade do REAL-2 (10.1056/nejmoa073149, N=1.002) — proposta como referência ADICIONAL (C7, decisão do revisor); Cochrane CD004064: oxaliplatina vs cisplatina HR 0,81 (0,67–0,98) baixa; capecitabina vs 5-FU HR 0,94 (0,79–1,11) moderada.",
        extras={"referencias_adicionais": [{"doi": "10.1056/nejmoa073149", "papel": "REAL-2 — NI de oxaliplatina vs cisplatina e capecitabina vs 5-FU (2×2)"},
                                           {"doi": "10.1002/14651858.cd004064.pub4", "papel": "Cochrane 2017 — comparações oxaliplatina/cisplatina e capecitabina/5-FU"}]})

# 10. gastrico-met-2l-paclitaxel — RAINBOW como base de paclitaxel isolado: paclitaxel está nos DOIS braços
B["gastrico-met-2l-paclitaxel"] = indeterminado(
    "10.1016/S1470-2045(14)70420-6",
    "o pivô registrado (RAINBOW) testa ramucirumabe; paclitaxel é o backbone dos DOIS braços — a fonte não contém nenhum efeito do paclitaxel isolado vs comparador (comparação de esquema usada como se fosse 'vs padrão')",
    "Estimativas de efeito são incertas para este pivô: não há efeito do paclitaxel na fonte. Proposta (C7): WJOG4007 (Hironaka 2013 JCO, 10.1200/jco.2012.48.5805 — paclitaxel semanal vs irinotecano em 2ª linha) e Cochrane CD004064/CD004063 (2ª linha vs BSC). Decisão do revisor.",
    extras={"referencias_adicionais": [{"doi": "10.1200/jco.2012.48.5805", "papel": "WJOG4007 — paclitaxel semanal vs irinotecano, 2ª linha (N=223)"},
                                       {"doi": "10.1002/14651858.cd004063.pub4", "papel": "Cochrane 2017 (esôfago/JEG) — 2ª linha vs BSC HR 0,81 (0,71–0,92), alta"}]})

# 11. gastrico-met-2l-irinotecano-folfiri — C9: corpo = Cochrane CD004064 (irinotecano vs regimes sem irinotecano, alta)
FC = "10.1002_14651858.cd004064.pub4.europepmc.json"
tr = transcrever(FC, "Irinotecan extends OS slightly", "high-quality evidence).")
B["gastrico-met-2l-irinotecano-folfiri"] = bloco(
    doi="10.1002/14651858.cd004064.pub4", desfecho_critico="SG",
    desenho={"tipo": "meta_analise_rct", "cegamento": "nao_informado", "n": 2135, "descricao": "Cochrane CD004064 (Wagner 2017) — regimes com irinotecano vs sem irinotecano: 10 RCTs, 2.135 participantes (corpo de evidência, C9). Ensaio registrado no corpus: Thuss-Patience 2011 (irinotecano vs BSC, N=40, HR 0,48; 0,25–0,92) como adicional"},
    efeito={"medida": "HR", "valor": 0.87, "ic95": [0.80, 0.95], "sentido_beneficio": "menor", "eventos": None, "eventos_por": None,
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Irinotecano"], "comparador": "regimes sem irinotecano", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "intervencao_nao_cobre": {"farmacos": ["5-FU/Leucovorina"], "por": "o corpo avalia 'regimes contendo irinotecano' (inclui combinações com fluoropirimidina); FOLFIRI em 2ª linha é extrapolação de linha, não de fármaco"},
          "por": "C9: a certeza é avaliada sobre o corpo (Cochrane, 10 RCTs); a comparação é 'com vs sem irinotecano', majoritariamente 1ª linha e combinações — a lacuna para 2ª linha vai para indireta",
          "referencia_corpo": {"doi": "10.1002/14651858.cd004064.pub4", "tipo": "cochrane", "comparacao": "regimes com irinotecano vs sem irinotecano (SG)", "certeza_declarada": "alta",
                               "por": "o valor do regime depende do corpo (irinotecano em gástrico avançado), não do ensaio de N=40"},
          "referencias_adicionais": [{"doi": "10.1016/j.ejca.2011.06.002", "papel": "Thuss-Patience 2011 — irinotecano vs BSC em 2ª linha (N=40, HR 0,48; 0,25–0,92): ensaio direto do cenário, subdimensionado"}]},
    dominios=dom((0, "Cochrane gradua alta; RCTs"), (0, "10 estudos; sem inconsistência apontada no abstract"),
                 (-1, "corpo majoritariamente de 1ª linha e de combinações vs outra QT; o regime é 2ª linha (irinotecano isolado ou FOLFIRI) — indireta de linha/comparador"),
                 (0, "IC 0,80–0,95 exclui o nulo; 2.135 participantes; certeza declarada alta (OIS pela revisão)"), (0, "busca sistemática (Cochrane)")),
    certeza="B", recomendacao={"forca": "condicional", "direcao": "a_favor", "base": "opção de 2ª linha; corpo sustenta o fármaco, ensaio direto é pequeno; MCBS n/a", "sem_mcbs_por": None},
    valor_rederivado="2B", justificativa="C9: Cochrane CD004064 — irinotecano HR 0,87 (0,80–0,95), 10 RCTs, alta. −1 indireta (corpo de 1ª linha/combinações vs regime de 2ª linha). Condicional a favor. (Antes de C9: 2C pelo ensaio de N=40.)")

# 12. gastrico-met-docetaxel — C9: corpo = Cochrane CD004063 (2ª linha vs BSC em esôfago/JEG, alta); COUGAR-02 como adicional
FC = "10.1002_14651858.cd004063.pub4.europepmc.json"
tr = T(FC, ("Five studies in 750 participants contributed data", "high-quality evidence)."),
           ("Subcomparisons including only people receiving second-line therapies", "showed a similar benefit."))
B["gastrico-met-docetaxel"] = bloco(
    doi="10.1002/14651858.cd004063.pub4", desfecho_critico="SG",
    desenho={"tipo": "meta_analise_rct", "cegamento": "nao_informado", "n": 750, "descricao": "Cochrane CD004063 (Janmaat 2017) — terapia paliativa vs BSC em esôfago/JEG: 5 RCTs, 750 participantes (corpo, C9); subcomparações de 2ª linha e de QT com benefício similar. Ensaio registrado: COUGAR-02 (docetaxel vs controle de sintomas, N=168, 161 óbitos, HR 0,67; 0,49–0,92) como adicional"},
    efeito={"medida": "HR", "valor": 0.81, "ic95": [0.71, 0.92], "sentido_beneficio": "menor", "eventos": None, "eventos_por": None,
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Docetaxel"], "comparador": "BSC", "comparador_padrao_epoca": True, "comparador_padrao_atual": False, "comparador_muda_decisao": False,
          "primario_positivo": True, "sustenta": True,
          "por": "C9: a certeza é avaliada sobre o corpo (Cochrane, 5 RCTs, 2ª linha vs BSC); a pergunta 'tratar vs suporte' segue válida (C2)",
          "referencia_corpo": {"doi": "10.1002/14651858.cd004063.pub4", "tipo": "cochrane", "comparacao": "terapia paliativa (QT e/ou alvo) vs BSC, esôfago/JEG, incl. 2ª linha (SG)", "certeza_declarada": "alta",
                               "por": "caso 05 da auditoria: o valor está certo mas o ensaio isolado (161 óbitos) não prova — o corpo prova"},
          "referencias_adicionais": [{"doi": "10.1016/S1470-2045(13)70549-7", "papel": "COUGAR-02 — docetaxel vs controle ativo de sintomas, 2ª linha: SG HR 0,67 (0,49–0,92), 161 óbitos"}]},
    dominios=dom((0, "Cochrane gradua alta; RCTs"), (0, "subcomparações (2ª linha, QT, adenocarcinoma) com benefício similar"),
                 (-1, "corpo de classe (QT e/ou alvo) em esôfago/JEG; o regime é docetaxel em gástrico/JEG — indireta de intervenção declarada (intervencao_nao_cobre); COUGAR-02 (HR 0,67) é concordante e está no corpo"),
                 (0, "IC 0,71–0,92 exclui o nulo; certeza declarada alta (OIS pela revisão)"), (0, "busca sistemática (Cochrane)")),
    certeza="B", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado como padrão institucional de 2ª linha; corpo (alta) + ensaio direto concordante; melhora de dor/disfagia",
                               "sem_mcbs_por": "ESMO-MCBS n/a no corpus (comparador = suporte); ganho de SG (corpo + COUGAR-02) e de sintomas sustenta a força — a decidir no referendo"},
    valor_rederivado="1B", justificativa="C9: Cochrane CD004063 — 2ª linha vs BSC HR 0,81 (0,71–0,92), alta; COUGAR-02 concordante (0,67). −1 indireta (corpo de classe/sítio vs docetaxel em gástrico). Forte a favor. Nota: sem a indireta de classe seria A — item de referendo (corpo de classe sustenta agente?).")

# 13. gastrico-met-1l-io-qt-cps — CheckMate 649; C4: 5 anos (Ann Oncol 2026); N do CPS≥5 do texto PMC da primária
F = "10.1016_j.annonc.2026.02.003.europepmc.json"
tr = T(F, ("With a minimum follow-up of 60.1 months, the OS benefit", "were sustained."),
          ("Five-year OS and PFS rates were 16% versus 6%", "respectively.")) + " | [Lancet 2021, texto PMC] " + transcrever("10.1016_S0140-67362100797-2.PMC8436782.pmc.html", "A total of 473 (60%) of 789 patients", "PD-L1 CPS ≥5.")
B["gastrico-met-1l-io-qt-cps"] = bloco(
    doi="10.1016/j.annonc.2026.02.003", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 1581, "descricao": "CheckMate 649 — nivolumabe + QT vs QT, 1ª linha, fase 3 aberto, N=1.581 (CPS≥5: 955); 5 anos"},
    efeito={"medida": "HR", "valor": 0.71, "ic95": [0.61, 0.81], "sentido_beneficio": "menor",
            "eventos": 850, "eventos_por": "deduzido de SG 5 a 16% × 473 (≈ 397 óbitos) + 6% × 482 (≈ 453) = 850 — N do CPS≥5 por braço no texto PMC da publicação primária (Lancet 2021)",
            "analise": ATU, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Nivolumabe"], "comparador": "QT (XELOX/FOLFOX)", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "nivolumabe + QT = regime; QT isolada era e segue o comparador; primário SG (CPS≥5) positivo e mantido a 5 anos. A alternativa pembrolizumabe do regime é sustentada pelo KEYNOTE-859 (adicional: CPS≥10 SG HR 0,65; 0,53–0,79)",
          "referencia_atualizada": {"doi": "10.1016/j.annonc.2026.02.003", "pmid": "41687718", "por": "C4: 5 anos do mesmo ensaio (fonte registrada: Lancet 2021, 1ª análise)"},
          "referencias_adicionais": [{"doi": "10.1016/s1470-2045(23)00515-6", "papel": "KEYNOTE-859 (Rha 2023) — sustenta a alternativa pembrolizumabe + QT (CPS≥10 HR 0,65; 0,53–0,79)"}]},
    dominios=dom((0, "aberto; SG"), (0, "efeito estável (0,71 → 0,70 → 0,71) e concordante com KEYNOTE-859"),
                 (0, "regime restrito a CPS≥10 ⊂ população primária CPS≥5 (benefício mantido em CPS≥10 no abstract)"),
                 (0, "≈850 óbitos (deduzido, C1) ≥ 300; IC 0,61–0,81 exclui o nulo com folga"), (0, "registro prévio")),
    certeza="A", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado (CPS≥10); SG HR 0,71 a 5 anos; ESMO-MCBS 4", "sem_mcbs_por": None},
    valor_rederivado="1A", justificativa="CheckMate 649 5 anos (CPS≥5): SG HR 0,71 (0,61–0,81), ≈850 óbitos deduzidos. Nenhum domínio rebaixado. Forte a favor.")

# 14. gastrico-met-her2-trastuzumabe-qt — ToGA (Lancet 2010)
F = "10.1016_S0140-67361061121-X.europepmc.json"
tr = T(F, ("594 patients were randomly assigned to study treatment", "(n=294; n=290)."),
          ("Median overall survival was 13.8 months", "p=0.0046)."))
B["gastrico-met-her2-trastuzumabe-qt"] = bloco(
    doi="10.1016/S0140-6736(10)61121-X", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 594, "descricao": "ToGA — trastuzumabe + cisplatina/fluoropirimidina vs QT, HER2+, fase 3 aberto, N=594 (584 na análise primária)"},
    efeito={"medida": "HR", "valor": 0.74, "ic95": [0.60, 0.91], "sentido_beneficio": "menor",
            "eventos": 292, "eventos_por": "deduzido de medianas de SG atingidas nos dois braços (13,8 e 11,1 m) → ≥ 50% de 294 + ≥ 50% de 290 = ≥ 292 (limite inferior — fica 8 abaixo de 300; contagem real no texto completo)",
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Trastuzumabe", "Cisplatina + Fluoropirimidina"], "comparador": "cisplatina + fluoropirimidina", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime; QT isolada era e segue o comparador em HER2+ (com IO em CPS≥1 sendo a evolução — KEYNOTE-811); primário SG positivo"},
    dominios=dom((0, "aberto; SG"), (0, "ensaio único; padrão consolidado"),
                 (0, "população HER2+ (IHC3+ ou FISH+) avançado = regime"),
                 (-1, "≥ 292 óbitos dedutíveis (limite inferior < 300); RRR 26% < 30% — OIS não demonstrável pela dedução; pedido upgrade (contagem no texto completo)"),
                 (0, "registro prévio")),
    certeza="B", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado; SG HR 0,74; ESMO-MCBS 4; padrão HER2+", "sem_mcbs_por": None},
    valor_rederivado="1B", justificativa="ToGA: SG HR 0,74 (0,60–0,91), ≥ 292 óbitos dedutíveis. −1 imprecisão por 8 eventos abaixo do limiar dedutível — caso-teste de C1 (upgrade provável com a contagem real). Forte a favor.")

# 15. gastrico-met-her2-pembro-tras-qt — KEYNOTE-811 (Lancet 2023, 3ª interina; final = carta NEJM 2024 sem abstract)
F = "10.1016_S0140-67362302033-0.europepmc.json"
tr = transcrever(F, "At the third interim analysis (median follow-up 38·4 months", "will continue to final analysis.")
B["gastrico-met-her2-pembro-tras-qt"] = bloco(
    doi="10.1016/S0140-6736(23)02033-0", desfecho_critico="SLP",
    desenho={"tipo": "rct_fase3", "cegamento": "duplo_cego", "n": 698, "descricao": "KEYNOTE-811 — pembrolizumabe + trastuzumabe + QT vs placebo, HER2+ 1ª linha, fase 3 duplo-cego, N=698; 3ª análise interina"},
    efeito={"medida": "HR", "valor": 0.73, "ic95": [0.61, 0.87], "sentido_beneficio": "menor", "eventos": None, "eventos_por": None,
            "analise": INT, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Pembrolizumabe", "Trastuzumabe", "Quimioterapia"], "comparador": "trastuzumabe + QT", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime; trastuzumabe + QT (ToGA) é o comparador correto; coprimário SLP positivo; SG HR 0,84 (0,70–1,01) não atingiu significância na 3ª interina; análise final publicada como carta (NEJM 2024, 10.1056/nejmc2408121) sem abstract — pedido de PDF"},
    dominios=dom((0, "duplo-cego"), (0, "ensaio único"),
                 (-1, "SLP substituto; SG não demonstrada na fonte (HR 0,84; 0,70–1,01)"),
                 (-1, "análise interina sem versão madura transcritível (C4); eventos não transcritos"),
                 (0, "registro prévio")),
    certeza="C", recomendacao={"forca": "condicional", "direcao": "a_favor", "base": "protocolo: 'discutir se CPS≥1'; SLP HR 0,73 sem SG demonstrada na fonte; ESMO-MCBS 4 no corpus (a rever); certeza C", "sem_mcbs_por": None},
    valor_rederivado="2C", justificativa="KEYNOTE-811 (3ª interina): SLP HR 0,73 (0,61–0,87); SG HR 0,84 (0,70–1,01) não significativa. −1 indireta (substituto), −1 imprecisão (interina). Condicional a favor. Final de SG é carta sem abstract → PEDIDO.")

# 16. gastrico-met-her2-2l-tdxd — DESTINY-Gastric01 (NEJM 2020), fase 2 randomizado (C5: parte de A)
F = "10.1056_NEJMoa2004413.europepmc.json"
tr = T(F, ("Of 187 treated patients, 125 received trastuzumab deruxtecan", "62 chemotherapy"),
          ("Overall survival was longer with trastuzumab deruxtecan", "0.39 to 0.88;"))
B["gastrico-met-her2-2l-tdxd"] = bloco(
    doi="10.1056/NEJMoa2004413", desfecho_critico="SG",
    desenho={"tipo": "rct_fase2", "cegamento": "aberto", "n": 187, "descricao": "DESTINY-Gastric01 — T-DXd vs QT à escolha (irinotecano/paclitaxel), HER2+ com ≥ 2 linhas prévias, fase 2 randomizado 2:1 aberto, Japão/Coreia, N=187"},
    efeito={"medida": "HR", "valor": 0.59, "ic95": [0.39, 0.88], "sentido_beneficio": "menor",
            "eventos": 94, "eventos_por": "deduzido de medianas de SG atingidas nos dois braços (12,5 e 8,4 m) → ≥ 50% de 125 + ≥ 50% de 62 = ≥ 94 (limite inferior)",
            "analise": INT, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Trastuzumabe deruxtecana"], "comparador": "QT à escolha do médico", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (6,4 mg/kg q21d); QT à escolha era o padrão pós-trastuzumabe; primário TRO positivo (51% vs 14%) e SG secundária cruzou o limite de O'Brien-Fleming (análise interina de SG)"},
    dominios=dom((0, "aberto; SG"), (0, "ensaio único"),
                 (-1, "população com ≥ 2 linhas prévias (3ª linha+), asiática — regime é 2ª linha"),
                 (-1, "≥ 94 óbitos (deduzido) < 300; análise interina de SG; IC 0,39–0,88 exclui o nulo (não é −2)"),
                 (0, "registro prévio (NCT03329690)")),
    certeza="C", recomendacao={"forca": "condicional", "direcao": "a_favor", "base": "incorporado em 2ª linha HER2+; SG HR 0,59 em fase 2 randomizado de 3ª linha+; ESMO-MCBS 4; certeza C", "sem_mcbs_por": None},
    valor_rederivado="2C", justificativa="DESTINY-Gastric01 (fase 2 randomizado, N=187): SG HR 0,59 (0,39–0,88). C5: parte de A; −1 indireta (população 3ª linha+), −1 imprecisão (< 300 eventos, interina). Condicional a favor.")

# 17. gastrico-tas102-nao-rotineiro — TAGS (Lancet Oncol 2018); não incorporado rotineiro → direção contra
F = "10.1016_S1470-20451830739-3.europepmc.json"
tr = T(F, ("507 patients were enrolled and randomly assigned", "170 to the placebo group."),
          ("Median overall survival was 5·7 months", "two-sided p=0·00058)."))
B["gastrico-tas102-nao-rotineiro"] = bloco(
    doi="10.1016/S1470-2045(18)30739-3", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "duplo_cego", "n": 507, "descricao": "TAGS — trifluridina/tipiracil vs placebo em ≥ 3ª linha, fase 3 duplo-cego, N=507 (2:1)"},
    efeito={"medida": "HR", "valor": 0.69, "ic95": [0.56, 0.85], "sentido_beneficio": "menor",
            "eventos": 254, "eventos_por": "deduzido de medianas de SG atingidas nos dois braços (5,7 e 3,6 m) → ≥ 50% de 337 + ≥ 50% de 170 = ≥ 254 (limite inferior)",
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Trifluridina/Tipiracil"], "comparador": "placebo", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True, "por": "braço experimental = regime; placebo + BSC é o comparador legítimo em ≥ 3ª linha; primário SG positivo"},
    dominios=dom((0, "duplo-cego, placebo"), (0, "ensaio único"), (0, "população politratada = regime (linhas tardias)"),
                 (0, "RRR 31% com limite superior 0,85 = efeito grande pela CONVENÇÃO DO SQUAD (dispensa OIS; ≥ 254 óbitos dedutíveis); IC exclui o nulo"), (0, "registro prévio")),
    certeza="A", recomendacao={"forca": "condicional", "direcao": "contra", "base": "NÃO incorporado rotineiramente (flag do corpus): benefício de SG modesto (2,1 m), ESMO-MCBS 3, custo — política institucional; certeza A", "sem_mcbs_por": None},
    valor_rederivado="2A", justificativa="TAGS: SG HR 0,69 (0,56–0,85), efeito grande pela convenção. Certeza A; não incorporado → condicional CONTRA (regra 5). Antes: 1B — a letra sobe, o número inverte de direção.")

# 18. gastrico-ramucirumabe-nao-incorporado — RAINBOW (Lancet Oncol 2014) + REGARD (adicional)
F = "10.1016_S1470-20451470420-6.europepmc.json"
tr = T(F, ("665 patients were randomly assigned to treatment", "335 to placebo plus paclitaxel."),
          ("Overall survival was significantly longer in the ramucirumab plus paclitaxel group", "p=0·017)."))
B["gastrico-ramucirumabe-nao-incorporado"] = bloco(
    doi="10.1016/S1470-2045(14)70420-6", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "duplo_cego", "n": 665, "descricao": "RAINBOW — ramucirumabe + paclitaxel vs placebo + paclitaxel, 2ª linha, fase 3 duplo-cego, N=665"},
    efeito={"medida": "HR", "valor": 0.807, "ic95": [0.678, 0.962], "sentido_beneficio": "menor",
            "eventos": 333, "eventos_por": "deduzido de medianas de SG atingidas nos dois braços (9,6 e 7,4 m) → ≥ 50% de 330 + ≥ 50% de 335 = ≥ 333 (limite inferior)",
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Ramucirumabe", "Paclitaxel"], "comparador": "placebo + paclitaxel", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "ramucirumabe + paclitaxel = uma das duas formas do regime; paclitaxel era e é o padrão de 2ª linha; primário SG positivo. Monoterapia (REGARD) como adicional",
          "referencias_adicionais": [{"doi": "10.1016/s0140-6736(13)61719-5", "papel": "REGARD — ramucirumabe isolado vs placebo: SG HR 0,776 (0,603–0,998), N=355"}]},
    dominios=dom((0, "duplo-cego, placebo"), (0, "concordante com REGARD (0,776) e com o Cochrane CD004063 (único agente individual com benefício replicado)"),
                 (0, "população 2ª linha pós-platina/fluoropirimidina = regime"),
                 (-1, "limite superior do IC 0,962 > 0,95 (regra 4): efeito modesto, IC encosta no nulo; ≥ 333 óbitos"),
                 (0, "registro prévio")),
    certeza="B", recomendacao={"forca": "condicional", "direcao": "contra", "base": "NÃO incorporado: ESMO-MCBS 2 (ganho de SG 2,2 m); política institucional; certeza B", "sem_mcbs_por": None},
    valor_rederivado="2B", justificativa="RAINBOW: SG HR 0,807 (0,678–0,962), ≥ 333 óbitos. −1 imprecisão (IC encosta no nulo). Não incorporado → condicional CONTRA. Antes: 1A com MCBS 2 — o caso-síntese da auditoria.")

# 19. gastrico-zolbetuximabe-nao-incorporado — SPOTLIGHT (Lancet 2023) + GLOW (adicional)
F = "10.1016_S0140-67362300620-7.europepmc.json"
tr = T(F, ("565 patients were randomly assigned to receive either zolbetuximab plus mFOLFOX6", "(282 patients; the placebo group)."),
          ("Zolbetuximab treatment also showed a significant reduction in the risk of death versus placebo", "p=0·0053)."))
B["gastrico-zolbetuximabe-nao-incorporado"] = bloco(
    doi="10.1016/S0140-6736(23)00620-7", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "duplo_cego", "n": 565, "descricao": "SPOTLIGHT — zolbetuximabe + mFOLFOX6 vs placebo + mFOLFOX6, CLDN18.2+ HER2−, 1ª linha, fase 3 duplo-cego, N=565"},
    efeito={"medida": "HR", "valor": 0.75, "ic95": [0.60, 0.94], "sentido_beneficio": "menor", "eventos": None, "eventos_por": None,
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Zolbetuximabe"], "comparador": "placebo + mFOLFOX6", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "zolbetuximabe + FOLFOX = regime; QT isolada é o comparador; primário SLP positivo (HR 0,75; 0,60–0,94) e SG secundária positiva. GLOW (CAPOX) como adicional",
          "referencias_adicionais": [{"doi": "10.1038/s41591-023-02465-7", "papel": "GLOW — zolbetuximabe + CAPOX: SG HR 0,771 (0,615–0,965), N=507"}]},
    dominios=dom((0, "duplo-cego, placebo"), (0, "concordante com GLOW (0,771)"),
                 (0, "população CLDN18.2+ HER2− = regime"),
                 (-1, "RRR 25% < 30%; óbitos não transcritos nem dedutíveis do abstract (medianas de SG não reportadas) — OIS não demonstrável; pedido upgrade"),
                 (0, "registro prévio")),
    certeza="B", recomendacao={"forca": "condicional", "direcao": "contra", "base": "NÃO incorporado (política institucional; MCBS 4 SPOTLIGHT / 2 GLOW; custo); certeza B", "sem_mcbs_por": None},
    valor_rederivado="2B", justificativa="SPOTLIGHT: SG HR 0,75 (0,60–0,94); GLOW concordante. −1 imprecisão (óbitos não dedutíveis). Não incorporado → condicional CONTRA. Antes: 1A.")
# ---------------------------------------------------------------------------------------------
regimes = []
for rid, g in B.items():
    r = copy.deepcopy(por_id[rid])
    r["verificacao"]["grade"] = g
    regimes.append(r)
assert len(regimes) == 19 and {r["tumor"] for r in regimes} == {"esofago-estomago"}
json.dump({"meta": {"titulo": "ONDA 1 — re-derivação GRADE schema 2, ESÔFAGO-ESTÔMAGO (19 regimes); NÃO promovido",
                    "base": rel, "gerado_em": "2026-09-17"}, "regimes": regimes},
          open(os.path.join(AQUI, "regimes-consolidados.json"), "w"), ensure_ascii=False, indent=1)
json.dump([dict(regimen_id=k, eixo="a qualidade da evidência e a força da recomendação", **v) for k, v in B.items()],
          open(os.path.join(AQUI, "verificacao-grade-esofago-estomago.json"), "w"), ensure_ascii=False, indent=1)
print("19 blocos gravados; transcrições conferidas contra fontes/")
