#!/usr/bin/env python3
"""
ONDA 2 — re-derivação GRADE (schema 2) dos 13 regimes de COLORRETAL (regras C1–C9).

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


# 1. retal-neoadj-crt-capecitabina — Hofheinz 2012: abstract sem HR/IC do efeito (só taxas por braço)
B["retal-neoadj-crt-capecitabina"] = indeterminado(
    "10.1016/S1470-2045(12)70116-X",
    "o abstract (Lancet Oncol 2012, NI, N=392) traz SG 5 a 76% [67–82] vs 67% [58–74] (NI p=0,0004; superioridade post-hoc p=0,05) e SLD 3 a 75% vs 67% (p=0,07) — só taxas por braço, sem HR nem IC da diferença: não há efeito transcritível (regra 7)",
    "Estimativas de efeito são incertas com o abstract: a não-inferioridade da capecitabina ao 5-FU na QRT está declarada, mas sem estimativa de efeito com IC. Pedido: texto completo (HR/IC de SG e SLD). Sem corpo Cochrane para capecitabina vs 5-FU em QRT de reto (CD006041 compara QRT vs RT).")

# 2. retal-tnt-folfox-capox — OPRA: compara DUAS sequências de TNT; não há comparador sem TNT
B["retal-tnt-folfox-capox"] = indeterminado(
    "10.1200/JCO.23.01208",
    "OPRA (fase 2 randomizado, N=324) compara indução→QRT vs QRT→consolidação — ambos os braços são TNT; SLD 5 a 71% vs 69% (p=0,68), sobrevida livre de TME 39% vs 54% (p=0,012). Não há efeito 'TNT vs padrão' na fonte: o ensaio sustenta a taxa de preservação de órgão (~50%), não a eficácia comparativa do regime",
    "Estimativas de efeito comparativo são incertas com este pivô. FATO: OPRA não tem braço sem TNT. DECISÃO: pivô comparativo para TNT com FOLFOX/CAPOX (ex.: RAPIDO, ou a revisão Cochrane CD015590 'Total neoadjuvant therapy for LARC', 2025, ainda protocolo). OPRA fica como referência de preservação de órgão (sobrevida livre de TME 54% com consolidação).")

# 3. retal-tnt-folfirinox — PRODIGE 23 longo prazo (Ann Oncol 2024): RMST (meses) com IC
F = "10.1016_j.annonc.2024.06.019.europepmc.json"
tr = T(F, ("With a median follow-up of 82.2 months, the 7-year DFS", "P = 0.048]"),
          ("The 7-year OS was 81.9%", "P = 0.033)."))
B["retal-tnt-folfirinox"] = bloco(
    doi="10.1016/j.annonc.2024.06.019", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": None, "descricao": "PRODIGE 23 — mFOLFIRINOX ×6 → QRT → cirurgia vs QRT → cirurgia (ambos + adjuvância), fase 3 aberto; N por braço não está no abstract; seguimento 82 m"},
    efeito={"medida": "diferenca_absoluta", "valor": 4.37, "ic95": [0.35, 8.38], "sentido_beneficio": "maior", "eventos": None, "eventos_por": None,
            "analise": ATU, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Oxaliplatina", "Irinotecano", "5-FU/Leucovorina"], "comparador": "QRT pré-operatória padrão", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (mFOLFIRINOX de indução); QRT padrão é o comparador; primário SLD positivo (RMST +5,73 m; 0,05–11,41) e SG a 7 anos positiva (RMST +4,37 m; 0,35–8,38). Medida = diferença de RMST em meses (abstract não traz HR)"},
    dominios=dom((0, "aberto; SG"), (0, "ensaio único; SLD, MFS e SG concordantes"),
                 (0, "população (reto localmente avançado cT3-4) = regime"),
                 (-1, "IC da diferença de RMST em SG encosta em 0 (0,35–8,38); óbitos < 300 certamente (SG 7 a ≈ 80%) e N não transcrito — OIS não atingido"),
                 (0, "registro prévio")),
    certeza="B", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado em alto risco; SLD e SG positivas a 7 anos; ESMO-MCBS A (curativo)", "sem_mcbs_por": None},
    valor_rederivado="1B", justificativa="PRODIGE 23 (7 anos): SG RMST +4,37 m (0,35–8,38), SLD +5,73 m. −1 imprecisão (IC encosta em 0; < 300 eventos). Forte a favor.")

# 4. colon-adj-fluoropirimidina-stageII — C9: corpo = Cochrane CD005390 (adjuvância vs observação em EII; sem grau → teto B); X-ACT adicional
FC = "10.1002_14651858.cd005390.pub2.europepmc.json"
tr = transcrever(FC, "the pooled relative risk ratio for overall survival was 0.96", "(95% confidence interval 0.75, 0.92).")
B["colon-adj-fluoropirimidina-stageII"] = bloco(
    doi="10.1002/14651858.cd005390.pub2", desfecho_critico="SLD",
    desenho={"tipo": "meta_analise_rct", "cegamento": "nao_informado", "n": None, "descricao": "Cochrane CD005390 (Figueredo 2008) — terapia adjuvante vs observação em cólon estádio II ressecado (corpo, C9); revisão sem grau GRADE no abstract → teto B. Ensaio registrado: X-ACT (capecitabina vs 5-FU/LV em estádio III, NI) como adicional — sustenta a equivalência da capecitabina, não o benefício em EII"},
    efeito={"medida": "RR", "valor": 0.83, "ic95": [0.75, 0.92], "sentido_beneficio": "menor", "eventos": None, "eventos_por": None,
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Capecitabina (ou 5-FU/LV)"], "comparador": "observação", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "C9: o valor depende do corpo (QT adjuvante vs observação em EII), não do X-ACT (estádio III, comparador ativo). A revisão avalia 'terapia adjuvante' (fluoropirimidina) vs observação: SLD RR 0,83 (0,75–0,92); SG RR 0,96 (0,88–1,05) não demonstrada",
          "referencia_corpo": {"doi": "10.1002/14651858.cd005390.pub2", "tipo": "cochrane", "comparacao": "adjuvância vs observação, cólon estádio II (SLD)", "certeza_declarada": None,
                               "por": "o ensaio registrado (X-ACT) não responde à pergunta do regime (benefício em EII); o corpo responde"},
          "referencias_adicionais": [{"doi": "10.1093/annonc/mdr366", "papel": "X-ACT final (Ann Oncol 2012) — capecitabina vs 5-FU/LV em estádio III: SLD HR 0,88 (0,77–1,01), NI; sustenta a alternativa oral"}]},
    dominios=dom((0, "RCTs; revisão sistemática"), (0, "sem inconsistência apontada"),
                 (0, "população EII = regime; o recorte 'alto risco' é recomendação da própria revisão (obstrução, perfuração, T4, linfonodos insuficientes)"),
                 (-1, "revisão sem grau declarado (2008) e eventos não transcritos — OIS não demonstrável; SG não demonstrada (RR 0,96; 0,88–1,05)"),
                 (0, "busca sistemática (Cochrane)")),
    certeza="B", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado em EII de alto risco; SLD RR 0,83 (corpo); ESMO-MCBS A (curativo)", "sem_mcbs_por": None},
    valor_rederivado="1B", justificativa="C9: Cochrane CD005390 — adjuvância vs observação em EII: SLD RR 0,83 (0,75–0,92); SG não demonstrada. −1 imprecisão (revisão sem grau; OIS não demonstrável). Forte a favor. (X-ACT, o pivô registrado, é de estádio III — não sustenta a pergunta.)")

# 5. colon-adj-oxaliplatina-stageIII — NO16968; C4: final JCO 2015 (7 anos); eventos de SLD da primária (2011)
F = "10.1200_jco.2015.60.9107.europepmc.json"; F11 = "10.1200_JCO.2010.33.6297.europepmc.json"
tr = T(F, ("Seven-year DFS rates were 63% and 56%", "P = .004)."), ("Seven-year OS rates were 73% and 67%", "P = .04).")) + " | [JCO 2011] " + transcrever(F11, "295 patients (31.3%) in the XELOX group had relapsed", "353 patients (37.5%) in the FU/FA group")
B["colon-adj-oxaliplatina-stageIII"] = bloco(
    doi="10.1200/jco.2015.60.9107", desfecho_critico="SLD",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 1886, "descricao": "NO16968 (XELOXA) — CAPOX vs 5-FU/LV bolus adjuvante em estádio III, fase 3 aberto, N=1.886; 7 anos"},
    efeito={"medida": "HR", "valor": 0.80, "ic95": [0.69, 0.93], "sentido_beneficio": "menor",
            "eventos": 648, "eventos_por": "deduzido de 295 + 353 eventos de SLD transcritos na publicação primária (JCO 2011, 57 m) = 648 (a 7 anos, mais)",
            "analise": ATU, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Oxaliplatina", "Capecitabina"], "comparador": "5-FU/LV bolus", "comparador_padrao_epoca": True, "comparador_padrao_atual": False, "comparador_muda_decisao": False,
          "primario_positivo": True, "sustenta": True,
          "por": "CAPOX = uma das duas formas do regime (FOLFOX6 sustentado por MOSAIC, adicional); 5-FU/LV era o padrão adjuvante e a pergunta 'oxaliplatina + fluoropirimidina vs fluoropirimidina' já foi respondida — sem segunda punição (C2); primário SLD positivo e SG positiva a 7 anos (0,83; 0,70–0,99)",
          "referencia_atualizada": {"doi": "10.1200/jco.2015.60.9107", "pmid": "26324362", "por": "C4: análise final (7 anos) do mesmo ensaio (fonte registrada: JCO 2011, 57 m)"},
          "referencias_adicionais": [{"doi": "10.1200/jco.2015.63.4238", "papel": "MOSAIC 10 anos — FOLFOX4 vs LV5FU2: SG 10 a estádio III HR 0,80 (p=0,016); sustenta a forma FOLFOX"},
                                     {"doi": "10.1056/nejmoa1713709", "papel": "IDEA (NEJM 2018) — 3 vs 6 meses: NI para CAPOX (HR 0,95; 0,85–1,06), não para FOLFOX; base do 'considerar 3 meses'"}]},
    dominios=dom((0, "aberto; SLD corroborada por SG positiva a 7 anos"), (0, "concordante com MOSAIC (FOLFOX)"),
                 (0, "população estádio III pós-ressecção = regime; SLD duro em adjuvância (C8)"),
                 (0, "648 eventos de SLD ≥ 300 (deduzido da primária, C1); IC 0,69–0,93 exclui o nulo"), (0, "registro prévio")),
    certeza="A", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado; SLD HR 0,80 e SG HR 0,83 a 7 anos; ESMO-MCBS A (curativo)", "sem_mcbs_por": None},
    valor_rederivado="1A", justificativa="NO16968 final (7 anos): SLD HR 0,80 (0,69–0,93), 648 eventos; SG HR 0,83. Nenhum domínio rebaixado. Forte a favor. MOSAIC e IDEA como adicionais.")

# 6. crc-met-quimio-doublet — de Gramont 2000: sem HR/IC; SG NS
B["crc-met-quimio-doublet"] = indeterminado(
    "10.1200/JCO.2000.18.16.2938",
    "o abstract (FOLFOX4 vs LV5FU2, N=420) traz SLP mediana 9,0 vs 6,2 m (p=0,0003) e SG 16,2 vs 14,7 m (p=0,12, não significativa) — sem HR nem IC: não há efeito transcritível (regra 7), e a SG (o desfecho que a justificativa antiga afirma) não foi demonstrada neste pivô",
    "Estimativas de efeito são incertas com o pivô registrado; o regime é uma CLASSE (FOLFOX/FOLFIRI/CAPOX) e depende de um corpo. FATO: de Gramont 2000 não traz HR/IC e a SG é NS. DECISÃO: corpo para 'doublet vs fluoropirimidina isolada' (a Cochrane CD001545 de 2000 é QT paliativa vs BSC, sem grau; CD008593 é irinotecano + fluoropirimidina vs irinotecano isolado) ou pivôs por doublet (Saltz 2000/Douillard 2000 para FOLFIRI, NO16966 para CAPOX).")

# 7. crc-met-folfoxiri — TRIBE; C4: final Lancet Oncol 2015 (SG madura)
F = "10.1016_s1470-20451500122-9.europepmc.json"
tr = T(F, ("Between July 17, 2008, and May 31, 2011, 508 patients", "randomly assigned."),
          ("median overall survival was 29·8 months", "p=0·03)."))
B["crc-met-folfoxiri"] = bloco(
    doi="10.1016/s1470-2045(15)00122-9", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 508, "descricao": "TRIBE — FOLFOXIRI + bevacizumabe vs FOLFIRI + bevacizumabe, 1ª linha, fase 3 aberto, N=508; seguimento 48 m"},
    efeito={"medida": "HR", "valor": 0.80, "ic95": [0.65, 0.98], "sentido_beneficio": "menor",
            "eventos": 254, "eventos_por": "deduzido de medianas de SG atingidas nos dois braços (29,8 e 25,8 m) → ≥ 50% de 508 = ≥ 254 (limite inferior)",
            "analise": ATU, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["5-FU", "Oxaliplatina", "Irinotecano", "Bevacizumabe"], "comparador": "FOLFIRI + bevacizumabe", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "o ensaio testou o triplet COM bevacizumabe nos dois braços; o regime do corpus é FOLFOXIRI sem bevacizumabe (não incorporado em 1ª linha na instituição) — indireta de intervenção/comparador; primário SLP positivo (HR 0,75) e SG positiva na análise final",
          "referencia_atualizada": {"doi": "10.1016/s1470-2045(15)00122-9", "pmid": "26338525", "por": "C4: análise de SG madura do mesmo ensaio (fonte registrada: NEJM 2014, SG HR 0,79; 0,63–1,00 não significativa)"}},
    dominios=dom((0, "aberto; SG"), (0, "ensaio único; efeito estável (0,79 → 0,80)"),
                 (-1, "bevacizumabe nos dois braços do ensaio; o regime institucional é o triplet sem bevacizumabe — a magnitude sem o anti-VEGF é extrapolação"),
                 (-1, "limite superior 0,98 > 0,95 (regra 4); ≥ 254 óbitos < 300; RRR 20%"),
                 (0, "registro prévio (NCT00719797)")),
    certeza="C", recomendacao={"forca": "condicional", "direcao": "a_favor", "base": "paciente robusto/cenário selecionado (como já dizia o corpus); SG HR 0,80 com bevacizumabe em ambos os braços; MCBS n/a", "sem_mcbs_por": None},
    valor_rederivado="2C", justificativa="TRIBE final: SG HR 0,80 (0,65–0,98). −1 indireta (bevacizumabe nos dois braços; regime sem bevacizumabe), −1 imprecisão (IC encosta no nulo; < 300 óbitos). Condicional a favor. Antes: 1B.")

# 8. crc-met-anti-egfr — C9: corpo = Cochrane CD007047 (anti-EGFR MAb em RAS wt estendido: SG alta); CRYSTAL/OPUS pooled e PRIME finais como adicionais
FC = "10.1002_14651858.cd007047.pub2.europepmc.json"
tr = transcrever(FC, "For the extended RAS wild-type population", "high-quality evidence).")
B["crc-met-anti-egfr"] = bloco(
    doi="10.1002/14651858.cd007047.pub2", desfecho_critico="SG",
    desenho={"tipo": "meta_analise_rct", "cegamento": "nao_informado", "n": 15025, "descricao": "Cochrane CD007047 (Chan 2017) — inibidores de EGFR em CCR metastático: 33 RCTs, 15.025 participantes (corpo, C9); anti-EGFR MAb + terapia padrão em RAS wt estendido"},
    efeito={"medida": "HR", "valor": 0.77, "ic95": [0.67, 0.88], "sentido_beneficio": "menor", "eventos": None, "eventos_por": None,
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Cetuximabe (ou Panitumumabe)"], "comparador": "terapia padrão sem anti-EGFR", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "C9: o regime é uma classe (cetuximabe ou panitumumabe + QT em RAS/BRAF wt) e o valor depende do corpo; a revisão agrega CRYSTAL, PRIME e outros; SG HR 0,77 (0,67–0,88) alta em RAS wt estendido. Ensaio registrado (CRYSTAL 2009): SLP KRAS wt HR 0,68 (0,50–0,94), SG global NS — não sustenta sozinho",
          "referencia_corpo": {"doi": "10.1002/14651858.cd007047.pub2", "tipo": "cochrane", "comparacao": "anti-EGFR MAb + terapia padrão vs terapia padrão, RAS wt estendido (SG)", "certeza_declarada": "alta",
                               "por": "valor de classe; a fonte registrada (CRYSTAL) não demonstra SG isoladamente"},
          "referencias_adicionais": [{"doi": "10.1016/j.ejca.2012.02.057", "papel": "CRYSTAL + OPUS pooled (KRAS wt, N=845): SG HR 0,81 (p=0,0062)"},
                                     {"doi": "10.1093/annonc/mdu141", "papel": "PRIME final (panitumumabe + FOLFOX4, KRAS wt): SG HR 0,88 (0,73–1,06); atualizada HR 0,83 (0,70–0,98)"},
                                     {"doi": "10.1056/NEJMoa0805019", "papel": "CRYSTAL (fonte registrada): SLP KRAS wt HR 0,68 (0,50–0,94)"}]},
    dominios=dom((0, "Cochrane gradua SG alta apesar de RoB incerto em vários ensaios"), (0, "heterogeneidade apontada em SLP (I² 61%), não em SG (alta)"),
                 (0, "regime restrito a RAS/BRAF wt de cólon esquerdo ⊂ população RAS wt do corpo — subgrupo com benefício esperado maior"),
                 (0, "IC 0,67–0,88 exclui o nulo; certeza declarada alta (OIS pela revisão)"), (0, "busca sistemática (Cochrane)")),
    certeza="A", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado em RAS/BRAF wt esquerdo; SG HR 0,77 (corpo, alta); ESMO-MCBS 3–4", "sem_mcbs_por": None},
    valor_rederivado="1A", justificativa="C9: Cochrane CD007047 — anti-EGFR em RAS wt estendido: SG HR 0,77 (0,67–0,88), alta. Nenhum domínio rebaixado. Forte a favor. (CRYSTAL sozinho: SLP B; SG NS.)")

# 9. crc-met-pembrolizumabe-msi — KEYNOTE-177 5 anos (fonte registrada já é a madura); crossover efetivo 62% documentado → exceção da regra 2 na SLP
F = "10.1016_j.annonc.2024.11.012.europepmc.json"
tr = T(F, ("Overall, 307 patients were assigned", "chemotherapy (n = 154)."),
          ("Median PFS was 16.5 months with pembrolizumab", "0.45-0.79)."))
cross = transcrever(F, "Fifty-seven (37.0%) patients assigned to chemotherapy crossed over", "0.53-0.99);")
B["crc-met-pembrolizumabe-msi"] = bloco(
    doi="10.1016/j.annonc.2024.11.012", desfecho_critico="SLP",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 307, "descricao": "KEYNOTE-177 — pembrolizumabe vs QT ± bev/cetuximabe, MSI-H/dMMR 1ª linha, fase 3 aberto, N=307; > 5 anos; crossover efetivo 62%"},
    efeito={"medida": "HR", "valor": 0.60, "ic95": [0.45, 0.79], "sentido_beneficio": "menor",
            "eventos": 153, "eventos_por": "deduzido de medianas de SLP atingidas nos dois braços (16,5 e 8,2 m) → ≥ 50% de 153 + ≥ 50% de 154 = ≥ 153 (limite inferior)",
            "analise": ATU, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Pembrolizumabe"], "comparador": "QT ± bevacizumabe/cetuximabe", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (200 mg q3w); QT era o padrão; coprimários SLP positiva e SG (HR 0,73; 0,53–0,99) com crossover efetivo de 62% — a SG contaminada não rebaixa a SLP (exceção da regra 2, transcrita)"},
    substituto_excecao={"tipo": "crossover_documentado", "por": "Ann Oncol 2025 (transcrito): " + cross},
    dominios=dom((0, "aberto; SLP por RECIST (BICR na primária)"), (0, "ensaio único; SG concordante em direção apesar do crossover"),
                 (0, "população MSI-H/dMMR 1ª linha = regime. (SLP como substituto NÃO rebaixa: crossover documentado)"),
                 (0, "IC 0,45–0,79 exclui o nulo; RRR 40% com limite ≤ 0,85 = efeito grande (convenção); ≥ 153 eventos"),
                 (0, "registro prévio")),
    certeza="A", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado; SLP HR 0,60 e SG HR 0,73 apesar de 62% de crossover; ESMO-MCBS 4", "sem_mcbs_por": None},
    valor_rederivado="1A", justificativa="KEYNOTE-177 (> 5 anos): SLP HR 0,60 (0,45–0,79), efeito grande; SG HR 0,73 (0,53–0,99) com crossover efetivo de 62% → exceção da regra 2. Nenhum domínio rebaixado. Forte a favor.")

# 10. crc-met-tas-bevacizumab — SUNLIGHT (NEJM 2023)
F = "10.1056_NEJMoa2214963.europepmc.json"
tr = T(F, ("A total of 246 patients were assigned to each group.", "each group."), ("The median overall survival was 10.8 months", "0.49 to 0.77;"))
B["crc-met-tas-bevacizumab"] = bloco(
    doi="10.1056/NEJMoa2214963", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 492, "descricao": "SUNLIGHT — FTD/TPI + bevacizumabe vs FTD/TPI, refratário (3ª linha+), fase 3 aberto, N=492"},
    efeito={"medida": "HR", "valor": 0.61, "ic95": [0.49, 0.77], "sentido_beneficio": "menor",
            "eventos": 246, "eventos_por": "deduzido de medianas de SG atingidas nos dois braços (10,8 e 7,5 m) → ≥ 50% de 246 + ≥ 50% de 246 = ≥ 246 (limite inferior)",
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Trifluridina/Tipiracil", "Bevacizumabe"], "comparador": "FTD/TPI isolado", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True, "por": "braço experimental = regime; FTD/TPI isolado era e é o comparador de 3ª linha; primário SG positivo"},
    dominios=dom((0, "aberto; SG"), (0, "ensaio único"), (0, "população refratária = regime"),
                 (0, "RRR 39% com limite superior 0,77 ≤ 0,85 = efeito grande (convenção; dispensa OIS); ≥ 246 óbitos"), (0, "registro prévio")),
    certeza="A", recomendacao={"forca": "forte", "direcao": "a_favor", "base": "incorporado; SG HR 0,61; ESMO-MCBS 3", "sem_mcbs_por": None},
    valor_rederivado="1A", justificativa="SUNLIGHT: SG HR 0,61 (0,49–0,77), efeito grande. Nenhum domínio rebaixado. Forte a favor.")

# 11. crc-met-bevacizumabe-1l-nao-incorporado — C9: corpo = Cochrane CD005392 (anti-angiogênicos, 1ª linha; sem grau → teto B); Hurwitz pooled adicional
FC = "10.1002_14651858.cd005392.pub3.europepmc.json"
tr = transcrever(FC, "The overall HR s for PFS (0.61, 95% CI 0.45 - 0.83) and OS", "significant heterogeneity.")
B["crc-met-bevacizumabe-1l-nao-incorporado"] = bloco(
    doi="10.1002/14651858.cd005392.pub3", desfecho_critico="SG",
    desenho={"tipo": "meta_analise_rct", "cegamento": "nao_informado", "n": 3101, "descricao": "Cochrane CD005392 (Wagner 2009) — QT 1ª linha ± bevacizumabe: 5 RCTs, 3.101 pacientes (corpo, C9); sem grau GRADE no abstract → teto B. Fonte registrada (Hurwitz 2013, pooled de 7 RCTs, SG HR 0,80; 0,71–0,90) como adicional"},
    efeito={"medida": "HR", "valor": 0.81, "ic95": [0.73, 0.90], "sentido_beneficio": "menor", "eventos": None, "eventos_por": None,
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Bevacizumabe"], "comparador": "QT sem bevacizumabe", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "C9: o valor depende do corpo (bevacizumabe + doublet vs doublet, 1ª linha); a fonte registrada já era um pooled patrocinado — a revisão Cochrane independente é a referência de corpo, o pooled fica adicional",
          "referencia_corpo": {"doi": "10.1002/14651858.cd005392.pub3", "tipo": "cochrane", "comparacao": "QT 1ª linha ± bevacizumabe (SG)", "certeza_declarada": None, "por": "revisão independente; sem grau declarado (2009)"},
          "referencias_adicionais": [{"doi": "10.1634/theoncologist.2013-0107", "papel": "Hurwitz 2013 — pooled de 7 RCTs (N=3.763): SG HR 0,80 (0,71–0,90), SLP HR 0,57"},
                                     {"doi": "10.1200/jco.2007.14.9930", "papel": "NO16966 (Saltz 2008) — bevacizumabe + XELOX/FOLFOX4: SLP HR 0,83; SG HR 0,89 (97,5% IC 0,76–1,03) NS — base do MCBS 1"}]},
    dominios=dom((0, "RCTs; revisão sistemática"), (-1, "heterogeneidade significativa em SLP apontada pela revisão; NO16966 (o maior ensaio com oxaliplatina) não demonstrou SG"),
                 (0, "população 1ª linha metastática = regime"),
                 (0, "IC 0,73–0,90 exclui o nulo; 3.101 pacientes"), (0, "busca sistemática (Cochrane)")),
    certeza="B", recomendacao={"forca": "condicional", "direcao": "contra", "base": "NÃO incorporado (ESMO-MCBS 1; ICER desfavorável): ganho de SG ≈ 1,4–2 m; política institucional; certeza B", "sem_mcbs_por": None},
    valor_rederivado="2B", justificativa="C9: Cochrane CD005392 — bevacizumabe 1ª linha: SG HR 0,81 (0,73–0,90), sem grau (teto B); −1 inconsistência. Não incorporado → condicional CONTRA. Antes: 1A com MCBS 1.")

# 12. crc-met-aflibercepte-nao-incorporado — VELOUR; fonte registrada é a análise de subgrupos → publicação primária (JCO 2012) traz o efeito global
F = "10.1200_jco.2012.42.8201.europepmc.json"
tr = transcrever(F, "Adding aflibercept to FOLFIRI significantly improved overall survival", "12.06 months, respectively.")
B["crc-met-aflibercepte-nao-incorporado"] = bloco(
    doi="10.1200/jco.2012.42.8201", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "duplo_cego", "n": None, "descricao": "VELOUR — aflibercepte + FOLFIRI vs placebo + FOLFIRI após oxaliplatina, fase 3 duplo-cego; N não está no abstract; IC reportado a 95,34%"},
    efeito={"medida": "HR", "valor": 0.817, "ic95": [0.713, 0.937], "ic_nivel": 95.34, "sentido_beneficio": "menor", "eventos": None, "eventos_por": None,
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Aflibercepte"], "comparador": "placebo + FOLFIRI", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True,
          "por": "aflibercepte + FOLFIRI = regime; FOLFIRI era e é o padrão de 2ª linha pós-oxaliplatina; primário SG positivo",
          "referencia_atualizada": {"doi": "10.1200/jco.2012.42.8201", "pmid": "22949147", "por": "publicação PRIMÁRIA do mesmo ensaio — a registrada (Eur J Cancer 2014) é a análise de subgrupos e não traz o efeito global"}},
    dominios=dom((0, "duplo-cego, placebo"), (0, "ensaio único; efeito consistente entre subgrupos (publicação de 2014)"),
                 (0, "população 2ª linha pós-oxaliplatina = regime"),
                 (-1, "RRR 18% < 30%; N e óbitos não transcritos nem dedutíveis do abstract — OIS não demonstrável; IC 95,34% 0,713–0,937 exclui o nulo (C3)"),
                 (0, "registro prévio")),
    certeza="B", recomendacao={"forca": "condicional", "direcao": "contra", "base": "NÃO incorporado (ESMO-MCBS 1; ganho ≈ 1,4 m); política institucional; certeza B", "sem_mcbs_por": None},
    valor_rederivado="2B", justificativa="VELOUR (primária): SG HR 0,817 (95,34% IC 0,713–0,937). −1 imprecisão (óbitos não dedutíveis; RRR 18%). Não incorporado → condicional CONTRA. Antes: 1A com MCBS 1.")

# 13. crc-met-regorafenibe-nao-incorporado — CORRECT (Lancet 2013): interina pré-planejada (sem versão madura com abstract)
F = "10.1016_S0140-67361261900-X.europepmc.json"
tr = T(F, ("760 patients were randomised to receive regorafenib (n=505) or placebo (n=255)", "(n=255)"),
          ("The primary endpoint of overall survival was met at a preplanned interim analysis", "one-sided p=0·0052)."))
B["crc-met-regorafenibe-nao-incorporado"] = bloco(
    doi="10.1016/S0140-6736(12)61900-X", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "duplo_cego", "n": 760, "descricao": "CORRECT — regorafenibe vs placebo em refratários, fase 3 duplo-cego, N=760 (2:1); primário atingido em análise interina pré-planejada"},
    efeito={"medida": "HR", "valor": 0.77, "ic95": [0.64, 0.94], "sentido_beneficio": "menor",
            "eventos": 381, "eventos_por": "deduzido de medianas de SG atingidas nos dois braços (6,4 e 5,0 m) → ≥ 50% de 505 + ≥ 50% de 255 = ≥ 381 (limite inferior)",
            "analise": INT, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Regorafenibe"], "comparador": "placebo", "comparador_padrao_epoca": True, "comparador_padrao_atual": True,
          "primario_positivo": True, "sustenta": True, "por": "braço experimental = regime (160 mg 3/1); placebo + BSC é o comparador legítimo em refratários; primário SG positivo na interina"},
    dominios=dom((0, "duplo-cego, placebo"), (0, "ensaio único"), (0, "população refratária a todas as terapias padrão = regime"),
                 (-1, "análise interina sem versão madura transcritível (C4); ≥ 381 óbitos e IC 0,64–0,94 exclui o nulo — só a interina pesa"),
                 (0, "registro prévio")),
    certeza="B", recomendacao={"forca": "condicional", "direcao": "contra", "base": "NÃO incorporado (ESMO-MCBS 1; ganho 1,4 m; ICER desfavorável); política institucional; certeza B", "sem_mcbs_por": None},
    valor_rederivado="2B", justificativa="CORRECT: SG HR 0,77 (0,64–0,94), ≥ 381 óbitos, interina pré-planejada. −1 imprecisão (interina, C4). Não incorporado → condicional CONTRA. Antes: 1A com MCBS 1.")
# ---------------------------------------------------------------------------------------------
regimes = []
for rid, g in B.items():
    r = copy.deepcopy(por_id[rid])
    r["verificacao"]["grade"] = g
    regimes.append(r)
assert len(regimes) == 13 and {r["tumor"] for r in regimes} == {"colorretal"}
json.dump({"meta": {"titulo": "ONDA 2 — re-derivação GRADE schema 2, COLORRETAL (13 regimes); NÃO promovido",
                    "base": rel, "gerado_em": "2026-09-17"}, "regimes": regimes},
          open(os.path.join(AQUI, "regimes-consolidados.json"), "w"), ensure_ascii=False, indent=1)
json.dump([dict(regimen_id=k, eixo="a qualidade da evidência e a força da recomendação", **v) for k, v in B.items()],
          open(os.path.join(AQUI, "verificacao-grade-colorretal.json"), "w"), ensure_ascii=False, indent=1)
print("13 blocos gravados; transcrições conferidas contra fontes/")
