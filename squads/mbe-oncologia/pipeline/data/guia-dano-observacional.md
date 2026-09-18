<!-- Material MBE da direção — copiado de ~/Downloads/MBE/Guia Técnico_ Avaliação Crítica de Estudos Observacionais de Dano e Efeitos Adversos.docx em 2026-09-17.
     Conversão .docx → markdown por script próprio (sem pandoc); texto integral, sem edição de conteúdo.
     Tabelas que a fonte trazia em CSV/pipe inline foram reformatadas à mão; nada foi acrescentado além
     do que está marcado em itálico entre parênteses. Base declarada: Guyatt et al., Users' Guides to the
     Medical Literature, 3ª ed. (2014).
     Papel no squad: ficha de consulta — `desenho.tipo = observacional` (certeza inicial C), **elevações** e lado do dano na **recomendação**. Mapeamento ao schema 2 do eixo `grade`: ver `grade-handbook.md`. -->

# Guia Técnico: Avaliação Crítica de Estudos Observacionais de Dano e Efeitos Adversos

Este guia estabelece as diretrizes rigorosas para a análise de evidências sobre danos, fundamentando-se nos princípios da Medicina Baseada em Evidências (MBE) e no sistema GRADE, conforme detalhado na obra *Users' Guides to the Medical Literature* (Guyatt et al., 3ª Edição, 2014).

#### 1. Fundamentos da Pergunta Clínica de Dano

O clínico deve, imperativamente, transformar sua incerteza em uma pergunta estruturada para minimizar o ruído na busca por evidências. A estruturação correta é o primeiro passo para garantir que a evidência encontrada seja diretamente aplicável ao dilema do paciente (Capítulo 4).

##### Estrutura PICO para Cenários de Dano

| Componente | Descrição aplicada ao dano |
|---|---|
| P (Paciente) | Definição clara da população, incluindo comorbidades que podem aumentar a vulnerabilidade à exposição. |
| I (Exposição) | O agente nocivo, intervenção, fator de risco ou droga cuja segurança está sob escrutínio. |
| C (Comparador) | O grupo não exposto ou exposto a um nível diferente do agente, permitindo a comparação de riscos. |
| O (Desfecho) | Eventos adversos específicos, morbidade ou mortalidade de relevância clínica para o paciente. |

##### Perguntas de Background vs. Foreground

Perguntas de **background** tratam do conhecimento geral sobre fisiopatologia ou epidemiologia (ex: "Qual o mecanismo de ação da varfarina?"). Já estudos de dano inserem-se na categoria de **foreground questions**, pois focam na gestão clínica e em decisões específicas sobre a relação entre uma exposição e um desfecho nocivo em pacientes reais. Conforme o Capítulo 4, a resposta a essas dúvidas exige evidência de pesquisa atual, indo além do conhecimento básico de livros-texto.

#### 2. Estrutura dos Estudos Observacionais para Dano

A arquitetura metodológica determina a confiança inicial no estimador de efeito. No contexto de danos, os estudos observacionais são frequentemente a "melhor evidência disponível" devido a limitações éticas (Capítulo 4).

- **Estudo de Coorte (Figura 4-4):** Identifica grupos expostos e não expostos, acompanhando-os prospectivamente para observar a incidência do desfecho. É a estrutura ideal para estabelecer temporalidade.
- **Estudo de Caso-Controle:** Inicia-se pelo desfecho (casos que já sofreram o dano) e busca, retrospectivamente, a presença da exposição em comparação a controles saudáveis.
- **Limitações Éticas dos RCTs:** Embora o ensaio clínico randomizado (RCT) ocupe o topo da hierarquia de evidência para terapia, seria antiético randomizar pacientes para exposições sabidamente nocivas (como o tabagismo). Portanto, os estudos observacionais são pilares essenciais na toxicologia clínica e farmacovigilância (Capítulos 4 e 14).

#### 3. Avaliação do Risco de Viés (Validade Interna)

O termo "Risco de Viés" substituiu "Validade" na terceira edição do guia por ser uma terminologia mais explícita e transparente (Capítulo 1). Ele define a probabilidade de que os resultados representem uma distorção da verdade devido a falhas no design ou condução.

##### Checklist de Comandos Ativos para o Avaliador

- **Auditie a similaridade prognóstica dos grupos:** Examine a "Tabela 1" (características basais) para verificar se os grupos expostos e não expostos eram similares em todos os fatores, exceto na exposição de interesse. Desequilíbrios sugerem fatores de confusão.
- **Avalie o cegamento da aferição de desfechos:** Instrua se os avaliadores dos desfechos estavam cegos para o status de exposição. O conhecimento da exposição pode induzir ao viés de aferição, especialmente em desfechos subjetivos.
- **Verifique a completude do acompanhamento (*Follow-up*):** Comande a análise de quantos pacientes foram perdidos. O seguimento deve ser longo o suficiente para que o dano se manifeste e deve contabilizar todos os pacientes que iniciaram o estudo.

#### 4. Análise dos Resultados e Força de Associação

A interpretação estatística deve distinguir a magnitude da precisão (Capítulo 10).

- **Magnitude do Efeito:** O clínico deve associar o **Risco Relativo (RR)** primariamente a estudos de **Coorte**, enquanto a **Razão de Chances (OR)** é a medida padrão para estudos de **Caso-Controle**. Valores muito distantes da unidade (1.0) sugerem associações fortes.
- **Precisão e o Intervalo de Confiança (IC 95%):** Um estudo é considerado "grande o suficiente" quando o IC é estreito. Se o IC for amplo o suficiente para cruzar limiares de significância clínica opostos, a evidência é imprecisa e o estudo pode não ter atingido o "Tamanho de Informação Ideal".
- **Gradiente Dose-Resposta:** Este é um indicador crítico de causalidade. Se o aumento da dose da exposição eleva proporcionalmente o risco do dano, a plausibilidade biológica é reforçada, reduzindo a chance de o efeito ser fruto de confusão residual.

#### 5. Aplicação do Sistema GRADE para Estudos Observacionais

A confiança na evidência é atribuída conforme os critérios da **Tabela 2-1**. Estudos observacionais iniciam com confiança **Baixa**.

##### Fatores de Rebaixamento (*Rating Down*)

A confiança pode cair para "Muito Baixa" em incrementos de -1 (Sério) ou -2 (Muito Sério) se houver:

1. Risco de viés grave.
2. Inconsistência (resultados divergentes entre estudos).
3. Evidência indireta (diferença entre a população/exposição do estudo e a PICO do clínico).
4. Imprecisão (IC muito amplo).
5. Viés de publicação.

##### Fatores de Elevação (*Rating Up*)

Estudos observacionais podem ser elevados para confiança **Moderada (+1)** ou **Alta (+2)** em condições específicas:

- **Magnitude de efeito grande (+1):** RR > 2 ou < 0.5 em estudos sem vieses graves.
- **Magnitude de efeito muito grande (+2):** RR > 5 ou < 0.2 (ex: insulina em cetoacidose).
- **Gradiente dose-resposta (+1):** Evidência clara de relação proporcional.
- **Confusão residual oposta:** Quando todos os fatores de confusão não medidos reduziriam o efeito observado, mas o efeito ainda assim é detectado.

#### 6. Aplicabilidade Clínica e Tomada de Decisão

A prática da MBE exige o ciclo: **Ask, Acquire, Appraise, Apply, Act** (Figura 1-1). O terceiro princípio fundamental da MBE afirma que "a evidência sozinha nunca é suficiente" (Capítulo 2).

##### Valores e Preferências do Paciente

O clínico deve integrar os resultados com os valores individuais. O exemplo da paciente com câncer terminal e pneumonia pneumocócica (Capítulo 2) ilustra isso: embora a evidência para antibióticos seja de alta confiança, os valores da paciente (focados em cuidados paliativos e não em prolongamento da vida) podem levar à recusa do tratamento. O julgamento clínico é a ponte entre a evidência e a ação.

##### Perguntas Reflexivas para Particularização

- O meu paciente é tão diferente daqueles do estudo que os resultados não podem ser aplicados?
- O estudo mensurou todos os desfechos que são importantes para o meu paciente?
- O potencial de benefício supera o risco de dano no contexto das preferências deste paciente?

#### 7. Recursos e Ferramentas de Busca

Para eficiência clínica, priorize recursos pré-avaliados utilizando a **Pirâmide 6-S** (Figura 5-1 e Tabela 5-1).

1. **Sistemas (Systems):** Integração automática em prontuários eletrônicos.
2. **Sumários (Summaries):** Textos atualizados regularmente (ex: UpToDate, DynaMed).
3. **Sinopses de Sínteses (Synopses of Syntheses):** Resumos de revisões sistemáticas (ex: ACP Journal Club).
4. **Sínteses (Syntheses):** Revisões sistemáticas e Meta-análises (ex: Cochrane Library).
5. **Sinopses de Estudos (Synopses of Studies):** Resumos críticos de estudos primários únicos.
6. **Estudos Primários (Primary Studies):** Pesquisas originais indexadas em bases como PubMed/MEDLINE. Utilize o **Clinical Queries** do PubMed com filtros para "Harm" para maior precisão (Capítulo 5).

#### 8. Referências e Citações

As diretrizes contidas neste guia fundamentam-se na obra:

- **Guyatt G, Rennie D, Meade MO, Cook DJ.*Users' Guides to the Medical Literature: A Manual for Evidence-Based Clinical Practice*. 3rd Edition. McGraw-Hill Education; 2014.**
- Capítulos referenciados: 1 (Conceitos), 2 (Princípios e GRADE), 4 (PICO e Estrutura), 5 (Recursos 6-S), 10 (Confiança e Precisão) e 14 (Dano).

---

## Mapeamento ao schema 2 do eixo `grade` (`rederivar-grade.md`)

- `desenho.tipo = observacional | serie_casos` → §2 e §5 (parte de Baixa) — base da **regra 3** (nunca A)
- `dominios.risco_vies` em observacional → §3 (similaridade prognóstica na Tabela 1; cegamento da aferição; completude do seguimento)
- `elevacoes[]` → §5 (magnitude grande +1: RR > 2 ou < 0,5; muito grande +2: RR > 5 ou < 0,2; dose-resposta +1; confusão residual oposta)
- `efeito.medida` → §4 (RR em coorte, OR em caso-controle)
- `recomendacao` (benefício × dano) → §6 (valores do paciente; perguntas de particularização) — usa `toxicidades[]` do regime como o lado do dano
