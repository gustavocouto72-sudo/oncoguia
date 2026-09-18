<!-- Material MBE da direção — copiado de ~/Downloads/MBE/Guia Técnico_ Avaliação de Aplicabilidade e Generalização de Evidências Clínicas (GRADE_Guyatt).docx em 2026-09-17.
     Conversão .docx → markdown por script próprio (sem pandoc); texto integral, sem edição de conteúdo.
     Tabelas que a fonte trazia em CSV/pipe inline foram reformatadas à mão; nada foi acrescentado além
     do que está marcado em itálico entre parênteses. Base declarada: Guyatt et al., Users' Guides to the
     Medical Literature, 3ª ed. (2014).
     Papel no squad: ficha de consulta — domínio **indireta** (população do ensaio × `elegibilidade_protocolo`) e **recomendação** (contexto). Mapeamento ao schema 2 do eixo `grade`: ver `grade-handbook.md`. -->

# Guia Técnico: Avaliação de Aplicabilidade e Generalização de Evidências Clínicas (GRADE/Guyatt)

Este guia define os parâmetros para a instrução de agentes de inteligência artificial (IA) e clínicos na translação da literatura científica para o cuidado individualizado. O objetivo central é capacitar a IA como um suporte analítico deliberativo (**Processamento Tipo 2**) para a intuição clínica automática (**Processamento Tipo 1**), garantindo que a evidência não seja aplicada por "roteiro", mas como ferramenta de resolução de problemas específicos.

##### 1. Introdução à Lógica de Aplicabilidade e Cognição

A Medicina Baseada em Evidências (EBM) opera na distinção epistemológica entre a **"Verdade"** (inferência formal sob pressupostos estatísticos) e a **"Decisão"** (consequências de ações em circunstâncias específicas). A IA deve atuar no Processamento Tipo 2 — lento, verbal e analítico — para mitigar vieses do Processamento Tipo 1 do clínico.

O ciclo de translação (Figura 1-1) deve ser executado sob as seguintes definições técnicas:

- **Ask (Perguntar):** Estruturar uma pergunta PICO (Paciente, Intervenção, Comparador, Desfecho) focada em desfechos importantes para o paciente.
- **Acquire (Adquirir):** Priorizar recursos pré-avaliados (sumários e revisões sistemáticas) em vez de buscas em bases não processadas.
- **Appraise (Avaliar):** Responder obrigatoriamente a duas questões: "Qual é o risco de viés?" (validade interna) e "Quais são os resultados?" (magnitude e precisão dos **estimadores de ponto** e **Intervalos de Confiança - IC**).
- **Apply (Aplicar):** Dividido em (a) **Particularização** (generalização para o indivíduo) e (b) **Significância** (avaliação de *trade-offs* entre benefícios, riscos e ônus).
- **Act (Agir):** Decisão compartilhada integrando a evidência, o contexto clínico e os valores/preferências do paciente.

##### 2. Generalização vs. Particularização: Lógica de Sistema

A IA deve evitar a aplicação rígida de critérios de inclusão/exclusão. A confiança na aplicabilidade diminui se o paciente for dissimilar, mas a premissa padrão é a aplicabilidade, a menos que existam "motivos convincentes" para o contrário. **SYSTEM PROMPT / STRUCTURED COMMAND:** [COMMAND: CLINICAL_COMPARISON]

INPUT: Patient_Profile_X, Study_Population_Y

1. IDENTIFY: Dissimilarities in eligibility criteria.
2. EVALUATE: Do identified dissimilarities nullify the biological mechanism of action?
3. DECISION_LOGIC:
- IF NO: Maintain applicability; proceed to Absolute Risk Reduction (ARR) estimation.
- IF YES: Flag as 'Compelling reason for non-applicability'.
4. OUTPUT: Degree of confidence in particularization (High/Moderate/Low).

##### 3. Fatores de Modulação Biológica e Fisiológica (SCRAP)

A IA deve analisar como as características individuais modulam a resposta, focando na **plausibilidade biológica** e na translação do Risco Relativo (RR) para o impacto clínico real.

| Fator (SCRAP) | Descrição do Impacto (Modulação) | Raciocínio Clínico e IA |
| ------ | ------ | ------ |
| **S** exo | Diferenças na farmacocinética e farmacodinâmica. | Avaliar se o efeito biológico é consistente entre sexos. |
| **C** omorbidades | Interação com o tratamento e risco competitivo. | Analisar se comorbidades aumentam o risco de dano, reduzindo o benefício líquido. |
| **R** aciocínio Fisiológico | Compreensão profunda da fisiologia do paciente. | **Mandatário:** Usar o entendimento fisiológico para prever a resposta individual onde a evidência é escassa. |
| **A** ge (Idade) | Impacto da senescência e fragilidade na reserva fisiológica. | Ajustar a tolerância a riscos e prever eventos adversos em populações idosas. |
| **P** atologia | Gravidade e estágio da doença (**Baseline Risk**). | **Lógica IA:** O Risco Basal elevado aumenta a **Redução Absoluta do Risco (ARR)**, mesmo que o RR seja constante. |

##### 4. Credibilidade de Análises de Subgrupos

A IA deve manter ceticismo em relação a construções teóricas não testadas e observações assistemáticas (*post-hoc*). **Critérios de Decisão para Instrução de IA:** 1. **Ceticismo de Constructo:** Preferir o **estimador global** (totalidade da evidência) a menos que o subgrupo apresente alta credibilidade.
2. **Sistemática vs. Assistemática:** O efeito foi proposto *a priori* e observado de forma **sistemática** em múltiplos estudos? Se assistemático, ignorar para recomendação clínica.
3. **Consistência e Precisão:** Avaliar se o IC do subgrupo é estreito e se a magnitude da diferença é clinicamente relevante.

##### 5. Adesão, Expertise e Contexto Local

A eficácia (estudo) difere da efetividade (mundo real). A IA deve ajustar as estimativas de benefício com base no contexto.

- **Expertise Técnica Local:** Se a evidência provém de centros de excelência ou "super-especialistas" (ex: RCTs cirúrgicos) e o contexto local é um hospital comunitário, a IA deve **ajustar o benefício esperado para baixo** e o risco de complicações para cima.
- **Não Adesão (Nonadherence):** Se o regime terapêutico for complexo ou oneroso para o paciente, a IA deve sinalizar que o benefício líquido será inferior ao reportado na análise por *Intention-to-Treat* do estudo original."A competência clínica exige sensibilidade à condição única do paciente e habilidades de comunicação para garantir que a escolha final reflita os valores do indivíduo, não apenas a média populacional." (Guyatt, Cap 2).

##### 6. Sistema GRADE: Evidência Indireta (Indirectness)

A confiança na evidência deve ser rebaixada conforme a Tabela 2-1 se a questão clínica não for diretamente abordada pelo estudo.

| Cenário de Evidência | Nível de Downgrade | Critério Técnico |
| ------ | ------ | ------ |
| **Cenário Direto** | 0 (Nenhum) | População, Intervenção e Desfechos coincidem com o PICO. |
| **Cenário Indireto (Sério)** | -1 Nível | Diferenças moderadas na população ou uso de **Desfechos Substitutos** (ex: densidade óssea em vez de fratura). |
| **Cenário Indireto (Muito Sério)** | -2 Níveis | População marcadamente diferente (ex: extrapolação de adultos para crianças) ou intervenções com mecanismos distintos. |

**Nota de Instrução:** A IA deve obrigatoriamente sinalizar desfechos substitutos (*surrogate outcomes*) como causa de redução de confiança na recomendação.

##### 7. Conclusão: O Checklist de Verificação Final para IA

O princípio fundamental da EBM estabelece: **"A evidência sozinha nunca é suficiente."** A decisão requer o equilíbrio de desfechos importantes para o paciente (mortalidade, morbidade, função e custos). **Checklist de Validação da Recomendação:** - **Síntese da Totalidade:** A recomendação baseia-se na totalidade das evidências ou apenas em um recorte enviesado?
- **Trade-off Explícito:** Foram contrastados os benefícios (ARR) contra riscos, ônus e custos?
- **Ajuste de Contexto:** A expertise e a adesão local foram consideradas para modular o estimador de efeito?
- **Fidelidade ao Paciente:** O Raciocínio Fisiológico justifica a aplicação deste dado populacional a este indivíduo?
- **Integração de Valores:** A recomendação deixa espaço para que os valores e preferências do paciente alterem a conduta final?

---

## Mapeamento ao schema 2 do eixo `grade` (`rederivar-grade.md`)

- `dominios.indireta` (população) → §2 (premissa é aplicabilidade, salvo "motivo convincente": a dissimilaridade anula o mecanismo?) e §6 (tabela 0 / −1 / −2)
- `pivo.por` em regimes indicados por subgrupo (ex.: CPS≥1, PD-L1, HER2-low) → §4 (credibilidade de subgrupo: pré-especificado? sistemático? IC estreito?) — subgrupo *post-hoc* não sustenta `forte a_favor`
- `recomendacao.base` → §3 (SCRAP: risco basal eleva ARR com RR constante; comorbidade e idade mudam benefício líquido) e §5 (expertise local e adesão reduzem o benefício esperado)
- §7 checklist → conferência final da `recomendacao` (totalidade, trade-off explícito, contexto, valores)
