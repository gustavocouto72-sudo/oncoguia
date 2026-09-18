#!/usr/bin/env python3
"""
Piloto de calibração — re-derivação GRADE (schema 2) dos 10 regimes de RENAL — v2 (após C1–C7).

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

# 1. renal-adj-pembrolizumab — C4: KEYNOTE-564 (NEJM 2024) é a versão madura; C8: SLD é desfecho crítico DURO em adjuvância
F = "10.1056_nejmoa2312695.europepmc.json"
tr = T(F, ("A total of 496 participants", "498 to receive placebo."),
          ("The disease-free survival benefit was consistent", "0.59 to 0.87)."),
          ("A significant improvement in overall survival", "0.44 to 0.87;"))
B["renal-adj-pembrolizumab"] = bloco(
    doi="10.1056/nejmoa2312695", desfecho_critico="SLD",
    desenho={"tipo": "rct_fase3", "cegamento": "duplo_cego", "n": 994,
             "descricao": "KEYNOTE-564 — pembrolizumabe vs placebo pós-nefrectomia, fase 3 duplo-cego, N=994; SLD primária (já atingida na 1ª interina), atualizada a 57,2 m; SG secundária-chave positiva na mesma análise"},
    efeito={"medida": "HR", "valor": 0.72, "ic95": [0.59, 0.87], "sentido_beneficio": "menor",
            "eventos": None, "eventos_por": None,
            "analise": ATU, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Pembrolizumab"], "comparador": "placebo", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": True, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime; placebo era e é o comparador em adjuvância; primário SLD positivo (0,63 na 1ª interina → 0,72 a 57 m) e SG secundária-chave positiva (0,62; 0,44–0,87) na mesma publicação",
          "referencia_atualizada": {"doi": "10.1056/nejmoa2312695", "pmid": "38631003", "por": "C4: análise mais madura do mesmo ensaio (57 m; SLD atualizada + SG) — a fonte registrada (Lancet Oncol 2022) era a de 30 m"}},
    dominios=dom((0, "duplo-cego com placebo, ITT, randomização central"),
                 (0, "ensaio único; SLD consistente entre as análises (0,63 → 0,72)"),
                 (0, "população = critérios do protocolo; comparador placebo; SLD é desfecho crítico duro em adjuvância (C8)"),
                 (-1, "IC 0,59–0,87 exclui o nulo, mas RRR 28% < 30% (convenção do squad para efeito grande) e nº de eventos de SLD não transcrito nem dedutível do abstract — OIS não demonstrável; pedido de texto completo (upgrade)"),
                 (0, "registro prévio (NCT03142334)")),
    certeza="B",
    recomendacao={"forca": "forte", "direcao": "a_favor",
                  "base": "incorporado; SLD HR 0,72 e SG HR 0,62 duplo-cego; ESMO-MCBS A (curativo)", "sem_mcbs_por": None},
    valor_rederivado="1B",
    justificativa="KEYNOTE-564 a 57 m (NEJM 2024): SLD HR 0,72 (0,59–0,87) como desfecho crítico duro (C8). −1 imprecisão só por OIS não demonstrável (eventos de SLD não estão no abstract; RRR 28% fica abaixo da convenção de 30%). Forte a favor. Com a SLD de 30 m (0,63; 0,50–0,80) seria A; com a contagem de eventos do texto completo, provavelmente A.")

# 2. renal-met-favoravel-pazopanibe — COMPARZ 2013 (a única versão com abstract; a SG final de 2014 é carta)
F = "10.1056_NEJMoa1303989.europepmc.json"
tr = transcrever(F, "Pazopanib was noninferior to sunitinib", "0.91; 95% CI, 0.76 to 1.08).")
B["renal-met-favoravel-pazopanibe"] = bloco(
    doi="10.1056/NEJMoa1303989", desfecho_critico="SLP",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 1110,
             "descricao": "COMPARZ — pazopanibe vs sunitinibe, fase 3 aberto de NÃO-INFERIORIDADE, N=1.110; SLP por revisão independente"},
    efeito={"medida": "HR", "valor": 1.05, "ic95": [0.90, 1.22], "sentido_beneficio": "menor", "eventos": None, "eventos_por": None,
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Pazopanibe"], "comparador": "sunitinibe", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": True, "primario_positivo": True, "sustenta": True,
          "por": "desenho de não-inferioridade: o pivô sustenta EQUIVALÊNCIA ao sunitinibe (margem 1,25 atingida), não superioridade; TKI mono segue opção em risco favorável. Atualização de SG (NEJM 2014) é carta sem abstract — não transcritível",
          "referencias_adicionais": [{"doi": "10.1200/jco.2009.23.9764", "papel": "Sternberg 2010 JCO — pazopanibe vs placebo (fase 3): eficácia absoluta do pazopanibe, ausente do corpus (C7)"}]},
    dominios=dom((0, "aberto, mas SLP por revisão independente; ITT"),
                 (0, "ensaio único; sem contradição citada"),
                 (-1, "SLP é substituto; SG 'similar' (HR 0,91; 0,76–1,08) não demonstra benefício"),
                 (-1, "não-inferioridade com limite superior 1,22 encostado na margem 1,25; IC inclui o nulo (regra 4)"),
                 (0, "registro prévio (NCT00720941)")),
    certeza="C",
    recomendacao={"forca": "condicional", "direcao": "a_favor",
                  "base": "TKI oral equivalente ao sunitinibe (NI) com melhor tolerabilidade/QoL; certeza C pela fonte registrada (NI + substituto); MCBS n/a", "sem_mcbs_por": None},
    valor_rederivado="2C",
    justificativa="RCT fase 3 aberto de não-inferioridade (N=1.110): SLP HR 1,05 (0,90–1,22). −1 indireta (substituto), −1 imprecisão (limite 1,22 vs margem 1,25). Condicional a favor. Inalterado da v1.")

# 3. renal-met-favoravel-sunitinibe — SLP (primário, NEJM 2007) com exceção da regra 2: crossover documentado no JCO 2009
F = "10.1056_NEJMoa065044.europepmc.json"
tr = transcrever(F, "The median progression-free survival was significantly longer", "0.32 to 0.54; P<0.001).")
F9 = "10.1200_jco.2008.20.1293.europepmc.json"
cross = T(F9, ("Median overall survival was greater in the sunitinib group", "0.673 to 1.001;"),
              ("Within the IFN-alpha group, 33% of patients received sunitinib", "discontinuation from the trial."))
B["renal-met-favoravel-sunitinibe"] = bloco(
    doi="10.1056/NEJMoa065044", desfecho_critico="SLP",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 750,
             "descricao": "Motzer 2007 — sunitinibe vs interferon-α, fase 3 aberto, N=750, população toda-risco; SLP primária. SG final (JCO 2009) com 33% de crossover para sunitinibe + 32% para outros anti-VEGF"},
    efeito={"medida": "HR", "valor": 0.42, "ic95": [0.32, 0.54], "sentido_beneficio": "menor", "eventos": None, "eventos_por": None,
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Sunitinibe"], "comparador": "interferon-α", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": False, "comparador_muda_decisao": True, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime; IFN-α era o padrão em 2007; hoje ninguém escolhe contra IFN em 1ª linha — o comparador muda a decisão (C2 → indireta). Primário SLP positivo. A SG final (JCO 2009: HR 0,821; 0,673–1,001) está contaminada por crossover documentado (33% + 32%) — exceção da regra 2, transcrita abaixo",
          "referencias_adicionais": [{"doi": "10.1200/jco.2008.20.1293", "papel": "Motzer 2009 JCO — SG final e documentação do crossover (33% para sunitinibe, 32% para outros anti-VEGF): base da exceção 'crossover_documentado' (C7: adicional, o pivô da SLP segue sendo o de 2007)"}]},
    substituto_excecao={"tipo": "crossover_documentado",
                        "por": "JCO 2009 (transcrito): " + cross},
    dominios=dom((0, "aberto; SLP — revisão independente não afirmada no abstract (registrado, não penalizado)"),
                 (0, "ensaio único vs IFN; sem contradição citada"),
                 (-1, "comparador IFN-α obsoleto que muda a decisão de hoje (C2); população toda-risco vs regime restrito a favorável. (SLP como substituto NÃO rebaixa: crossover documentado — exceção da regra 2)"),
                 (0, "IC 0,32–0,54 exclui o nulo com folga; RRR 58% = efeito grande"),
                 (0, "registro prévio (NCT00098657)")),
    certeza="B",
    recomendacao={"forca": "condicional", "direcao": "a_favor",
                  "base": "TKI de referência histórica em risco favorável; escolha frente a IO-TKI sensível a preferência/custo; MCBS n/a (comparador histórico)", "sem_mcbs_por": None},
    valor_rederivado="2B",
    justificativa="RCT fase 3 aberto (N=750): SLP HR 0,42 (0,32–0,54) vs IFN-α. SG final contaminada por crossover documentado (33%+32%, JCO 2009) → exceção da regra 2, SLP não rebaixa. −1 indireta (IFN muda a decisão, C2). Condicional a favor. = gabarito da auditoria (2B).")

# 4. renal-met-favoravel-ipilimumabe-nivolumabe — C4: Tannir 2024 (8 anos), subgrupo favorável (exploratório)
F = "10.1016_j.annonc.2024.07.727.europepmc.json"
tr = T(F, ("the hazard ratio [HR; 95% confidence interval (CI)] for OS", "0.82 (0.60-1.13) in FAV patients."),
          ("PFS probabilities at 90 months", "12.7% versus 17.0% (FAV), respectively."),
          ("ORR with NIVO+IPI versus SUN was 39.5%", "29.6% versus 51.6% (FAV)."))
B["renal-met-favoravel-ipilimumabe-nivolumabe"] = bloco(
    doi="10.1016/j.annonc.2024.07.727", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 1096,
             "descricao": "CheckMate 214, 8 anos (99,1 m) — nivo+ipi vs sunitinibe; primários em int/alto; risco FAVORÁVEL (N=249) é desfecho EXPLORATÓRIO"},
    efeito={"medida": "HR", "valor": 0.82, "ic95": [0.60, 1.13], "sentido_beneficio": "menor", "eventos": None, "eventos_por": None,
            "analise": ATU, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Ipilimumabe", "Nivolumabe"], "comparador": "sunitinibe", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": True, "primario_positivo": True, "sustenta": True,
          "por": "cobertura e comparador ok; primário positivo em OUTRA população (int/alto). No subgrupo favorável, a 8 anos: SG HR 0,82 (IC inclui o nulo), SLP a 90 m 12,7% vs 17,0% e TRO 29,6% vs 51,6% a favor do sunitinibe; RC 12,8% vs 6,5% a favor de nivo+ipi",
          "referencia_atualizada": {"doi": "10.1016/j.annonc.2024.07.727", "pmid": "39098455", "por": "C4: seguimento de 8 anos do mesmo ensaio (já citado no corpus sem DOI)"}},
    dominios=dom((0, "aberto; SG"),
                 (0, "ensaio único; direção do efeito no subgrupo estável entre a 1ª interina e os 8 anos"),
                 (-1, "desfecho exploratório em subgrupo (249 pts) fora do primário; SLP e TRO favorecem o sunitinibe"),
                 (-1, "IC 0,60–1,13 inclui o nulo (regra 4); óbitos não transcritos nem dedutíveis do abstract"),
                 (0, "—")),
    certeza="C",
    recomendacao={"forca": "condicional", "direcao": "pendente_revisor",
                  "base": "C6/Portão C: o protocolo lista o regime em risco favorável; a fonte madura mostra SG sem diferença demonstrada e SLP/TRO a favor do sunitinibe, com mais RC para nivo+ipi — direção é decisão clínica do revisor; MCBS 2 (subgrupo)", "sem_mcbs_por": None},
    valor_rederivado="2C",
    justificativa="8 anos do CheckMate 214, subgrupo favorável: SG HR 0,82 (0,60–1,13); SLP/TRO a favor do sunitinibe. −1 indireta (exploratório), −1 imprecisão. Condicional; direção pendente do revisor (C6).")

# 5. renal-met-intalto-ipilimumabe-nivolumabe — C4: Tannir 2024, int/alto (primário)
tr = T(F, ("Patients with aRCC (N = 1096)", "2 weeks off."),
          ("With 8 years (99.1 months) of median follow-up", "0.69 (0.59-0.81) in I/P patients,"))
B["renal-met-intalto-ipilimumabe-nivolumabe"] = bloco(
    doi="10.1016/j.annonc.2024.07.727", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 1096,
             "descricao": "CheckMate 214, 8 anos (99,1 m) — nivo+ipi vs sunitinibe; SG coprimária em risco int/alto (N=847)"},
    efeito={"medida": "HR", "valor": 0.69, "ic95": [0.59, 0.81], "sentido_beneficio": "menor", "eventos": None, "eventos_por": None,
            "analise": ATU, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Ipilimumabe", "Nivolumabe"], "comparador": "sunitinibe", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": True, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime; sunitinibe era o padrão em 2018 e segue referência de comparação; coprimário SG positivo na população do regime, mantido a 8 anos",
          "referencia_atualizada": {"doi": "10.1016/j.annonc.2024.07.727", "pmid": "39098455", "por": "C4: seguimento de 8 anos do mesmo ensaio — a fonte registrada (NEJM 2018) era a 1ª interina com IC 99,8%"}},
    dominios=dom((0, "aberto; SG"),
                 (0, "ensaio único; efeito estável da 1ª interina (0,63) aos 8 anos (0,69)"),
                 (0, "população int/alto = regime; comparador sunitinibe padrão da época"),
                 (0, "IC 0,59–0,81 exclui o nulo com folga; RRR 31% com limite ≤ 0,85 = efeito grande (regra 1); 8 anos de seguimento"),
                 (0, "registro prévio (NCT02231749)")),
    certeza="A",
    recomendacao={"forca": "forte", "direcao": "a_favor",
                  "base": "incorporado; SG HR 0,69 a 8 anos; ESMO-MCBS 4; padrão de 1ª linha em int/alto", "sem_mcbs_por": None},
    valor_rederivado="1A",
    justificativa="8 anos do CheckMate 214, int/alto: SG HR 0,69 (0,59–0,81), efeito grande. Nenhum domínio rebaixado. Forte a favor. (v1: 1B pela 1ª interina — C4 resolve.)")

# 6. renal-met-intalto-axitinibe-pembrolizumabe — C4: KEYNOTE-426 43 m (Eur Urol 2023), análise final
F = "10.1016_j.eururo.2023.06.006.europepmc.json"
tr = T(F, ("We report results of the final protocol-prespecified analysis", "KEYNOTE-426."),
          ("The median study follow-up was 43", "0.60-0.88]),"))
B["renal-met-intalto-axitinibe-pembrolizumabe"] = bloco(
    doi="10.1016/j.eururo.2023.06.006", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 861,
             "descricao": "KEYNOTE-426, 43 m — pembro+axitinibe vs sunitinibe, fase 3 aberto, N=861, ITT toda-risco; análise final pré-especificada"},
    efeito={"medida": "HR", "valor": 0.73, "ic95": [0.60, 0.88], "sentido_beneficio": "menor", "eventos": None, "eventos_por": None,
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Axitinibe", "Pembrolizumabe"], "comparador": "sunitinibe", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": True, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime; sunitinibe padrão em 2019; coprimário SG positivo, mantido na análise final",
          "referencia_atualizada": {"doi": "10.1016/j.eururo.2023.06.006", "pmid": "37500340", "por": "C4: análise final (43 m) do mesmo ensaio — a fonte registrada (NEJM 2019) era a 1ª interina (HR 0,53)"}},
    dominios=dom((0, "aberto; SG"),
                 (0, "ensaio único; efeito atenuado da interina (0,53) à final (0,73) — esperado, não contraditório"),
                 (0, "ITT toda-risco; benefício declarado em todos os grupos IMDC (fonte de 2019); regime int/alto ⊂ população"),
                 (-1, "RRR 27% < 30% e óbitos não transcritos nem dedutíveis do abstract (sem taxas/medianas) — OIS não demonstrável; pedido de texto completo (upgrade)"),
                 (0, "registro prévio (NCT02853331)")),
    certeza="B",
    recomendacao={"forca": "forte", "direcao": "a_favor",
                  "base": "incorporado; SG HR 0,73 na análise final; ESMO-MCBS 4", "sem_mcbs_por": None},
    valor_rederivado="1B",
    justificativa="Análise final do KEYNOTE-426 (43 m): SG HR 0,73 (0,60–0,88). −1 imprecisão (óbitos não dedutíveis do abstract; RRR < 30%). Forte a favor. (v1: 1A pela interina de 2019 — C4 usa a madura; converge com Cochrane 'moderada'.)")

# 7. renal-met-intalto-nivolumabe-cabozantinibe — C4: CheckMate 9ER 44 m (ESMO Open 2024)
F = "10.1016_j.esmoop.2024.102994.europepmc.json"
tr = T(F, ("Overall, 323 patients were randomised", "328 to SUN."),
          ("median OS favoured NIVO + CABO versus SUN", "0.56-0.87)."))
B["renal-met-intalto-nivolumabe-cabozantinibe"] = bloco(
    doi="10.1016/j.esmoop.2024.102994", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 651,
             "descricao": "CheckMate 9ER, 44 m — nivo+cabozantinibe vs sunitinibe, fase 3 aberto, N=651; primário SLP (BICR); SG secundária"},
    efeito={"medida": "HR", "valor": 0.70, "ic95": [0.56, 0.87], "sentido_beneficio": "menor",
            "eventos": 326, "eventos_por": "deduzido de medianas de SG atingidas nos DOIS braços (49,5 e 35,5 m) → ≥ 50% de 323 + ≥ 50% de 328 = ≥ 326 óbitos (limite inferior)",
            "analise": ATU, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Nivolumabe", "Cabozantinibe"], "comparador": "sunitinibe", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": True, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime; sunitinibe padrão em 2021; primário SLP positivo (HR 0,59; 0,49–0,71 a 44 m) e SG secundária positiva",
          "referencia_atualizada": {"doi": "10.1016/j.esmoop.2024.102994", "pmid": "38642472", "por": "C4: seguimento de 44 m do mesmo ensaio — a fonte registrada (NEJM 2021) só tinha IC 98,89% e mediana não atingida"}},
    dominios=dom((0, "aberto; SG (SLP por BICR)"),
                 (0, "ensaio único; efeito estável (0,60 → 0,70) com maturação"),
                 (0, "ITT toda-risco; benefício em int, alto e int/alto declarado; comparador padrão"),
                 (0, "≥ 326 óbitos (deduzido, C1) ≥ 300; IC 0,56–0,87 exclui o nulo"),
                 (0, "registro prévio (NCT03141177)")),
    certeza="A",
    recomendacao={"forca": "forte", "direcao": "a_favor",
                  "base": "incorporado; SG HR 0,70 e SLP HR 0,59 a 44 m; ESMO-MCBS 4 re-derivado (protocolo afirmou 1 — divergência do eixo MCBS já registrada)", "sem_mcbs_por": None},
    valor_rederivado="1A",
    justificativa="44 m do CheckMate 9ER: SG HR 0,70 (0,56–0,87), ≥ 326 óbitos (deduzido das medianas). Nenhum domínio rebaixado. Forte a favor. (v1: 1B por IC 98,89% e óbitos não escritos — C1/C3/C4 resolvem.)")

# 8. renal-met-2l-pos-vegfr-nivolumabe — CheckMate 025 5 anos (já é a versão madura); C1 + C2
F = "10.1002_cncr.33033.europepmc.json"
tr = T(F, ("Eight hundred twenty-one patients were randomized", "everolimus (n = 411);"),
          ("With a minimum follow-up of 64 months", "26% and 18%, respectively."))
B["renal-met-2l-pos-vegfr-nivolumabe"] = bloco(
    doi="10.1002/cncr.33033", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 821,
             "descricao": "CheckMate 025 — nivolumabe vs everolimo pós-antiangiogênico, fase 3 aberto, N=821; primário SG; seguimento mínimo 64 m"},
    efeito={"medida": "HR", "valor": 0.73, "ic95": [0.62, 0.85], "sentido_beneficio": "menor",
            "eventos": 640, "eventos_por": "deduzido de SG 5 anos 26% × 410 (≈ 303 óbitos) + 18% × 411 (≈ 337 óbitos) = 640",
            "analise": ATU, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Nivolumabe"], "comparador": "everolimo", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": False, "comparador_muda_decisao": False, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime; everolimo era o padrão de 2ª linha pós-TKI em 2015 e a indicação do regime é exatamente essa (2ª linha pós-TKI VEGFR); o nivolumabe É o padrão que substituiu o comparador — não muda a decisão de hoje (C2: sem segunda punição). Primário SG positivo"},
    dominios=dom((0, "aberto; SG"),
                 (0, "consistente com a análise primária do mesmo ensaio (HR 0,73; 0,57–0,93)"),
                 (0, "população (pós-1–2 antiangiogênicos) = regime; comparador da época segue referência para esta pergunta (C2)"),
                 (0, "≈640 óbitos (deduzido, C1) ≥ 300; IC 0,62–0,85 exclui o nulo; 5 anos"),
                 (0, "registro prévio (NCT01668784)")),
    certeza="A",
    recomendacao={"forca": "forte", "direcao": "a_favor",
                  "base": "incorporado; SG HR 0,73 mantida a 5 anos; ESMO-MCBS 5", "sem_mcbs_por": None},
    valor_rederivado="1A",
    justificativa="CheckMate 025, 5 anos: SG HR 0,73 (0,62–0,85), ≈640 óbitos (deduzido das taxas de SG). Nenhum domínio rebaixado. Forte a favor. (v1: 2C por eventos não escritos + comparador obsoleto — C1/C2 resolvem.)")

# 9. renal-met-2l-pos-io-cabozantinibe — C4: METEOR final (Lancet Oncol 2016)
F = "10.1016_s1470-20451630107-3.europepmc.json"
tr = T(F, ("Between Aug 8, 2013, and Nov 24, 2014, 658 patients", "everolimus (n=328)."),
          ("Median overall survival was 21·4 months", "0·53-0·83];"))
B["renal-met-2l-pos-io-cabozantinibe"] = bloco(
    doi="10.1016/s1470-2045(16)30107-3", desfecho_critico="SG",
    desenho={"tipo": "rct_fase3", "cegamento": "aberto", "n": 658,
             "descricao": "METEOR final — cabozantinibe vs everolimo após terapia anti-VEGFR, fase 3 aberto, N=658; SG (secundária) na análise final, seguimento 18,7 m"},
    efeito={"medida": "HR", "valor": 0.66, "ic95": [0.53, 0.83], "sentido_beneficio": "menor",
            "eventos": 329, "eventos_por": "deduzido de medianas de SG atingidas nos DOIS braços (21,4 e 16,5 m) → ≥ 50% de 330 + ≥ 50% de 328 = ≥ 329 óbitos (limite inferior)",
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Cabozantinibe"], "comparador": "everolimo", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": False, "comparador_muda_decisao": False, "primario_positivo": True, "sustenta": True,
          "por": "braço experimental = regime (60 mg/d); everolimo padrão de 2ª linha em 2015; primário SLP positivo. A lacuna relevante é de POPULAÇÃO (ensaio pós-TKI VEGFR; regime = 2ª linha PÓS-IMUNOTERAPIA — nota do revisor 13/09 'METEOR mantido'), tratada em indireta; o comparador não recebe segunda punição (C2)",
          "referencia_atualizada": {"doi": "10.1016/s1470-2045(16)30107-3", "pmid": "27279544", "por": "C4: análise final de SG do mesmo ensaio — a fonte registrada (NEJM 2015) era a interina com 202 óbitos"}},
    dominios=dom((0, "aberto; SG"),
                 (0, "ensaio único; efeito estável da interina (0,67) à final (0,66)"),
                 (-1, "população pós-TKI ≠ regime pós-IO — extrapolação"),
                 (0, "≥ 329 óbitos (deduzido, C1); IC 0,53–0,83 exclui o nulo; RRR 34% com limite ≤ 0,85 = efeito grande"),
                 (0, "registro prévio (NCT01865747)")),
    certeza="B",
    recomendacao={"forca": "forte", "direcao": "a_favor",
                  "base": "incorporado em 2ª linha (nota do revisor); SG HR 0,66 na análise final; ESMO-MCBS 3; evidência indireta para o cenário pós-IO", "sem_mcbs_por": None},
    valor_rederivado="1B",
    justificativa="METEOR final: SG HR 0,66 (0,53–0,83), ≥ 329 óbitos (deduzido). −1 indireta (população pós-TKI → pós-IO). Forte a favor. (v1: 2C pela interina + comparador — C4/C2 resolvem; a indireta de população permanece.)")

# 10. renal-naoclaras-sunitinibe-pazopanibe — ASPEN; C5: RCT parte de A, imprecisão −2
F = "10.1016_S1470-20451500515-X.europepmc.json"
tr = T(F, ("108 patients were randomly assigned", "everolimus (n=57)."),
          ("As of December, 2014, 87 progression-free survival events", "p=0·16)"))
B["renal-naoclaras-sunitinibe-pazopanibe"] = bloco(
    doi="10.1016/S1470-2045(15)00515-X", desfecho_critico="SLP",
    desenho={"tipo": "rct_fase2", "cegamento": "aberto", "n": 108,
             "descricao": "ASPEN — everolimo vs sunitinibe em não-células claras (papilífero/cromófobo/inclassificado), fase 2 randomizado aberto, N=108, 87 eventos; desenhado com IC 80%"},
    efeito={"medida": "HR", "valor": 1.41, "ic95": [1.03, 1.92], "ic_nivel": 80, "sentido_beneficio": "maior", "eventos": 87, "eventos_por": "transcrito",
            "analise": FIN, "transcricao": tr, "fonte_transcricao": "europepmc_abstract"},
    pivo={"intervencao": ["Sunitinibe"], "comparador": "everolimo", "comparador_padrao_epoca": True,
          "comparador_padrao_atual": False, "comparador_muda_decisao": False, "primario_positivo": True, "sustenta": True,
          "intervencao_nao_cobre": {"farmacos": ["Pazopanibe"], "por": "ASPEN testou só sunitinibe; pazopanibe no regime é extrapolação de classe"},
          "por": "sunitinibe = braço do ensaio; HR 1,41 é do everolimo em relação ao sunitinibe (>1 favorece sunitinibe); critério do desenho (IC 80%) atingido, p=0,16. Comparador everolimo: não havia padrão; a pergunta 'sunitinibe vs everolimo' segue válida em não-células claras sem cabozantinibe disponível — não muda a decisão por si (C2); a lacuna vai para indireta (pazopanibe, população mista)"},
    dominios=dom((0, "aberto; SLP RECIST 1.1; ITT; banco fechado aos 87 eventos por financiamento (poder 82%)"),
                 (0, "ensaio único; heterogeneidade por histologia notada no abstract (não penalizada aqui — vai para indireta)"),
                 (-1, "SLP substituto (SG não diferente: HR 1,12; 0,7–2,1 no texto completo); pazopanibe não testado; população mista vs regime 'papilífero'"),
                 (-2, "muito séria (C5): 87 eventos < 300 E IC reportado a 80% (1,03–1,92; p=0,16) — o IC 95% inclui o nulo"),
                 (0, "—")),
    certeza="D",
    recomendacao={"forca": "condicional", "direcao": "a_favor",
                  "base": "opção em não-células claras na ausência de padrão; certeza muito baixa; MCBS n/a (fase 2, comparador ativo)", "sem_mcbs_por": None},
    valor_rederivado="2D",
    justificativa="Fase 2 randomizado (N=108): SLP HR 1,41 (IC 80% 1,03–1,92; p=0,16), 87 eventos. C5 ortodoxo: RCT parte de A, −1 indireta, −2 imprecisão (muito séria) → D. Mesmo resultado da v1 (2D), agora pelo caminho ortodoxo.")
# ---------------------------------------------------------------------------------------------
regimes = []
for rid, g in B.items():
    r = copy.deepcopy(por_id[rid])
    r["verificacao"]["grade"] = g
    regimes.append(r)
assert len(regimes) == 10 and {r["tumor"] for r in regimes} == {"renal"}
json.dump({"meta": {"titulo": "PILOTO de calibração v2 (após C1–C7) — re-derivação GRADE schema 2, RENAL (10 regimes); NÃO promovido",
                    "base": rel, "gerado_em": "2026-09-17"}, "regimes": regimes},
          open(os.path.join(AQUI, "regimes-consolidados.json"), "w"), ensure_ascii=False, indent=1)
json.dump([dict(regimen_id=k, eixo="a qualidade da evidência e a força da recomendação", **v) for k, v in B.items()],
          open(os.path.join(AQUI, "verificacao-grade-renal.json"), "w"), ensure_ascii=False, indent=1)
print("10 blocos gravados; transcrições conferidas contra fontes/")
