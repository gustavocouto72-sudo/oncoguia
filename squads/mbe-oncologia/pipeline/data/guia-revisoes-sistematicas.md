<!-- Material MBE da direção — copiado de ~/Downloads/MBE/Relatório Técnico_ Guia Metodológico para Apreciação Crítica de Revisões Sistemáticas e Meta-análises.docx em 2026-09-17.
     Conversão .docx → markdown por script próprio (sem pandoc); texto integral, sem edição de conteúdo.
     Tabelas que a fonte trazia em CSV/pipe inline foram reformatadas à mão; nada foi acrescentado além
     do que está marcado em itálico entre parênteses. Base declarada: Guyatt et al., Users' Guides to the
     Medical Literature, 3ª ed. (2014).
     Papel no squad: ficha de consulta — `desenho.tipo = meta_analise_rct`, domínios **inconsistência** e **viés de publicação**. Mapeamento ao schema 2 do eixo `grade`: ver `grade-handbook.md`. -->

# Relatório Técnico: Guia Metodológico para Apreciação Crítica de Revisões Sistemáticas e Meta-análises

A Prática Baseada em Evidências (PBE) fundamenta-se em três princípios fundamentais. Primeiro, a tomada de decisão clínica ideal requer a consciência da melhor evidência disponível, preferencialmente proveniente de sínteses sistemáticas. Segundo, a PBE oferece critérios para distinguir evidências mais ou menos confiáveis. Terceiro, a evidência isolada nunca é suficiente; os tomadores de decisão devem sempre equilibrar benefícios, riscos e custos, considerando o contexto e os valores do paciente. Este relatório detalha os processos críticos para a avaliação de revisões sistemáticas sob esta ótica técnica.

#### 1. Credibilidade do Processo: Qualidade da Síntese de Evidências

##### 1.1. A Pergunta de Pesquisa (Framework PICO)

O rigor de uma revisão sistemática inicia-se na formulação de uma pergunta sensata. Para evitar a ineficiência do "modo de navegação" (browsing) e focar na resolução de problemas, a pergunta deve ser decomposta no framework **PICO**:

- **Pacientes (P):** Define a população de interesse. É essencial avaliar se a revisão detalhou características como idade, comorbidades e gravidade, garantindo aplicabilidade clínica.
- **Intervenção (I):** Especifica a estratégia de manejo, teste diagnóstico ou exposição.
- **Comparação (C):** Identifica a alternativa (placebo, tratamento padrão ou outro agente). A escolha do comparador determina a magnitude relativa do efeito.
- **Desfecho/Outcomes (O):** Devem ser priorizados desfechos clinicamente importantes para o paciente (mortalidade, função). Conforme as diretrizes modernas, deve-se considerar também as consequências para a sociedade, incluindo o uso de recursos e custos.

##### 1.2. Exaustividade da Busca e Reprodutibilidade

A validade de uma revisão depende da minimização do erro aleatório e dos vieses. A busca sistemática é o remédio para as "limitações de ineficiência e frustração" encontradas na busca assistemática.

- **Exaustividade:** A busca deve ser exaustiva para evitar evidências não representativas e de baixa qualidade. Deve consultar múltiplas bases e literatura cinzenta para minimizar o viés de publicação.
- **Reprodutibilidade:** O processo de seleção deve ser transparente. Se o método for seguido rigorosamente por outro pesquisador, este deve chegar ao mesmo conjunto de estudos primários.

##### 1.3. Avaliação do Risco de Viés em Estudos Primários

A qualidade da síntese é limitada pela qualidade dos estudos individuais. Na hierarquia das evidências, os Ensaios Clínicos Randomizados (ECRs) ocupam o topo para questões de terapia devido ao seu potencial de minimizar vieses, iniciando sua avaliação como evidência de "Alta Certeza" no sistema GRADE.A revisão deve avaliar o **risco de viés** (validade interna) de cada estudo. Este termo é mais explícito e transparente que "validade", indicando se os resultados representam uma estimativa imparcial da verdade. Contudo, deve-se recordar o terceiro princípio da PBE: a evidência é necessária, mas nunca suficiente; a decisão clínica exige ponderar os resultados contra os valores e preferências do paciente.

#### 2. Avaliação de Heterogeneidade: Interpretando a Variabilidade

##### 2.1. Heterogeneidade Clínica vs. Estatística

É imperativo discernir por que os resultados dos estudos primários divergem. **Heterogeneidade Clínica:** Diferenças nas características dos pacientes, nas dosagens das intervenções, nas variações dos comparadores ou na mensuração dos desfechos entre os estudos incluídos. **Heterogeneidade Estatística:** Ocorre quando a variabilidade dos efeitos observados entre os estudos excede aquela esperada apenas pelo acaso, sugerindo que as diferenças clínicas ou metodológicas estão impactando os resultados.

##### 2.2. Ferramentas de Avaliação (Forest Plot e Testes Estatísticos)

A análise técnica da variabilidade exige a combinação da inspeção visual e métricas quantitativas:

| Ferramenta/Teste | Função na Interpretação |
| ------ | ------ |
| **Gráfico de Floresta (Forest Plot)** | Inspeção visual da sobreposição dos intervalos de confiança (IC). A falta de sobreposição sugere heterogeneidade importante. |
| **Teste de Cochran Q (valor de p)** | Avalia se a variabilidade é devida ao acaso. Um valor de p baixo (tipicamente < 0,10) sugere que a variação não é apenas aleatória. |
| **Estatística I²** | Quantifica a proporção da variabilidade total que é atribuída à heterogeneidade real entre os estudos e não ao erro de amostragem. |

#### 3. Confiança no Resultado Agrupado (Abordagem GRADE)

##### 3.1. Os 5 Domínios de Rebaixamento da Certeza

A confiança na evidência é pontuada com base em cinco domínios. Em cada item, subtrai-se **-1 ponto** se o problema for "Sério" e **-2 pontos** se for "Muito Sério":

1. **Risco de Viés (Risk of Bias):** Limitações graves no desenho ou execução dos estudos originais.
2. **Inconsistência (Inconsistency):** Resultados divergentes entre os estudos sem explicação plausível (heterogeneidade elevada).
3. **Evidência Indireta (Indirectness):** Diferenças entre a população, intervenção ou desfechos dos estudos e a pergunta clínica real.
4. **Imprecisão (Imprecision):** Intervalos de confiança excessivamente amplos ou amostras insuficientes.
5. **Viés de Publicação (Publication Bias):** Suspeita de que estudos com resultados negativos foram omitidos. Aplica-se **-1 (Provável)** ou **-2 (Muito Provável)**.

##### 3.2. Fatores de Elevação da Certeza

Em estudos observacionais, a certeza inicial (geralmente baixa) pode ser elevada em situações específicas:

- **Magnitude de efeito grande:** Eleva-se em **+1 nível**.
- **Magnitude de efeito muito grande:** Eleva-se em **+2 níveis**.
- **Gradiente dose-resposta:** Evidência de que o efeito aumenta proporcionalmente à exposição eleva a certeza em **+1 nível**.

##### 3.3. Níveis de Certeza da Evidência Final

A classificação final define o grau de confiança no estimador de efeito para fundamentar recomendações clínicas.

| Nível | Definição Técnica |
| ------ | ------ |
| **Alta** | Estamos muito confiantes de que o efeito real está próximo da estimativa do efeito. |
| **Moderada** | Moderadamente confiantes: o efeito real provavelmente está próximo da estimativa, mas há possibilidade de ser substancialmente diferente. |
| **Baixa** | Confiança limitada: o efeito real pode ser substancialmente diferente da estimativa. |
| **Muito Baixa** | Pouquíssima confiança: o efeito real provavelmente é substancialmente diferente da estimativa original. |

---

## Mapeamento ao schema 2 do eixo `grade` (`rederivar-grade.md`)

- `desenho.tipo = meta_analise_rct` → §1 (credibilidade do processo: PICO, exaustividade e reprodutibilidade da busca, risco de viés dos primários)
- `dominios.inconsistencia` → §2 (heterogeneidade clínica × estatística; forest plot, Cochran Q p < 0,10, I²)
- `dominios.vies_publicacao` → §1.2 (busca sem literatura cinzenta = suspeita) e §3.1 (−1 provável / −2 muito provável)
- corpo de evidência quando o pivô único é impreciso (casos COUGAR-02 e RTOG 85-01 da auditoria) → a meta-análise entra em `pivo.referencia_proposta`, nunca substitui a `fonte` por conta própria
