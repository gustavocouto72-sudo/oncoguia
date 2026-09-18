<!-- Material MBE da direção — copiado de ~/Downloads/MBE/Relatório Técnico_ Diretrizes GRADE para Graduação da Certeza da Evidência.docx em 2026-09-17.
     Conversão .docx → markdown por script próprio (sem pandoc); texto integral, sem edição de conteúdo.
     Tabelas que a fonte trazia em CSV/pipe inline foram reformatadas à mão; nada foi acrescentado além
     do que está marcado em itálico entre parênteses. Base declarada: Guyatt et al., Users' Guides to the
     Medical Literature, 3ª ed. (2014).
     Papel no squad: ficha de consulta — domínio **certeza** (regra-mestra). Mapeamento ao schema 2 do eixo `grade`: ver `grade-handbook.md`. -->

# Relatório Técnico: Diretrizes GRADE para Graduação da Certeza da Evidência

#### 1. Introdução ao Sistema GRADE e Fundamentos de Guyatt

O sistema **GRADE** (*Grading of Recommendations Assessment, Development and Evaluation*) é o padrão metodológico contemporâneo para a síntese de evidências e o desenvolvimento de diretrizes clínicas. Conforme detalhado no Prefácio e no Capítulo 2 da obra de Guyatt et al. (2014), o GRADE possui uma natureza dual essencial: ele fornece uma estrutura rigorosa tanto para a graduação da **qualidade da evidência** (ou certeza na estimativa de efeito) quanto para a determinação da **força das recomendações**.

A aplicação do GRADE fundamenta-se nos três princípios pilares da Medicina Baseada em Evidências (MBE):

1. **Necessidade de Sumários Sistemáticos:** A tomada de decisão clínica deve ser baseada na totalidade da evidência disponível, idealmente por meio de revisões sistemáticas e metanálises, para mitigar o risco de conclusões enviesadas por estudos isolados ou não representativos.
2. **Graduação da Confiança nas Estimativas:** Reconhece-se que nem toda evidência possui o mesmo peso. O GRADE categoriza a confiança de que a estimativa de efeito observada nos estudos reflete a realidade, permitindo transparência no processo de decisão.
3. **A Evidência por si só é Insuficiente:** A evidência fornece a estimativa de efeito, mas a recomendação clínica exige um julgamento de valor. O tomador de decisão deve obrigatoriamente ponderar os **benefícios**, **riscos**, **ônus** e **custos** das alternativas, integrando-os às preferências e valores específicos do paciente.

#### 2. A Hierarquia Inicial da Evidência

No framework GRADE, a certeza da evidência não é avaliada globalmente por estudo, mas sim de forma independente para cada **desfecho específico** (PICO). Um mesmo ensaio clínico pode fornecer evidência de alta certeza para mortalidade e de baixa certeza para desfechos subjetivos (como qualidade de vida) caso não tenha havido cegamento adequado.

Abaixo, detalha-se o ponto de partida técnico baseado no design do estudo:

| Design do Estudo | Certeza Inicial | Justificativa Metodológica |
| ------ | ------ | ------ |
| Ensaios Clínicos Randomizados (RCTs) | **Alta** | O processo de randomização protege contra vieses de seleção e confusão. |
| Estudos Observacionais | **Baixa** | Susceptíveis a fatores de confusão residuais e vieses inerentes ao design. |

**Instrução Técnica:** Esta classificação inicial é plástica. Ela serve apenas como um patamar referencial que será refinado — para cima ou para baixo — através da análise sistemática dos domínios subsequentes.

#### 3. Critérios de Rebaixamento (Downgrading): Os 5 Domínios de Incerteza

A certeza da evidência é rebaixada quando há limitações sérias (-1 nível) ou muito sérias (-2 níveis) nos dados coletados para um desfecho.

##### 3.1 Risco de Viés (Limitações Metodológicas)

Avalia falhas no design e execução, como falta de sigilo de alocação, perdas de seguimento ou ausência de cegamento.

- **-1 (Sério):** Limitações em um ou mais critérios chave em estudos que contribuem significativamente para a estimativa.
- **-2 (Muito Sério):** Limitações cruciais na maioria dos estudos disponíveis que comprometem severamente a veracidade dos resultados. (Ref: Capítulo 11 para tópicos avançados em terapias).

##### 3.2 Inconsistência

Refere-se à heterogeneidade inexplicada dos resultados entre os estudos (variabilidade de magnitudes ou direções de efeito).

- **-1 (Sério):** Variabilidade estatística significativa (I² elevado) ou intervalos de confiança com pouca sobreposição.
- **-2 (Muito Sério):** Resultados amplamente divergentes entre todos os estudos sem qualquer explicação biológica ou metodológica plausível.

##### 3.3 Evidência Indireta (Indirecionalidade)

Ocorre quando há discrepâncias entre a evidência disponível e a pergunta clínica real em termos de **P** opulação, **I** ntervenção, **C** omparador ou Desfecho (**O** utcome).

- **-1 (Sério):** Diferenças menores na população ou no comparador utilizado (ex: placebo quando o padrão de cuidado é um fármaco ativo).
- **-2 (Muito Sério):** Uso de **desfechos substitutos** (*surrogate outcomes*) — como densidade mineral óssea em vez de fraturas — ou populações radicalmente diferentes do contexto clínico pretendido.

##### 3.4 Imprecisão

Foca na amplitude dos intervalos de confiança (IC95%) e no "Tamanho da Informação Ideal" (OIS - *Optimal Information Size*), conforme o Capítulo 10.

- **-1 (Sério):** O IC95% é amplo e cruza o limiar de decisão clínica (podendo representar tanto benefício quanto dano).
- **-2 (Muito Sério):** Amostra muito pequena ou número de eventos insuficiente para garantir estabilidade mínima à estimativa.

##### 3.5 Viés de Publicação

Suspeita-se quando estudos pequenos com resultados negativos não são publicados.

- **-1 (Provável):** Evidência de assimetria em gráficos de funil ou forte influência de financiamento industrial.
- **-2 (Muito Provável):** Evidência clara de omissão sistemática de estudos que alterariam a conclusão clínica.

#### 4. Critérios de Elevação (Upgrading): Fatores para Estudos Observacionais

Embora iniciem como "Baixa", a certeza em estudos observacionais pode ser elevada em três cenários técnicos:

##### 4.1 Grande Magnitude de Efeito

Eleva-se a confiança quando o efeito observado é tão robusto que torna implausível que seja apenas fruto de viés.

- **+1 (Grande):** RR < 0,5 ou RR > 2,0.
- **+2 (Muito Grande):** RR < 0,2 ou RR > 5,0.
- *Exemplos:* Insulina para cetoacidose diabética ou prótese de quadril para osteoartrite grave (Capítulo 2).

##### 4.2 Gradiente Dose-Resposta

A confiança é elevada em **+1 nível** quando se observa uma relação clara e proporcional entre a dose de exposição e a magnitude do desfecho clínico. Este fator é particularmente útil em estudos observacionais para sugerir causalidade.

##### 4.3 Confundimento Residual

Cenário técnico em que todos os fatores de confusão plausíveis (vieses) atuariam para **reduzir** o efeito observado, mas o efeito persiste ou é ainda mais forte. Isso aumenta a confiança de que a estimativa real pode ser ainda mais significativa do que o reportado.

#### 5. Classificação Final da Certeza da Evidência

A graduação final reflete a extensão de nossa confiança no fato de que a estimativa de efeito está correta e a probabilidade de que novas pesquisas alterem essa confiança.

- **Alta:** Estamos muito confiantes de que o efeito real está próximo da estimativa. Pesquisas futuras são muito improváveis de alterar nossa confiança na estimativa de efeito.
- **Moderada:** Confiança moderada; o efeito real provavelmente está próximo da estimativa, mas há possibilidade de ser substancialmente diferente. Pesquisas futuras podem ter um impacto importante na confiança da estimativa.
- **Baixa:** Confiança limitada; o efeito real pode ser substancialmente diferente da estimativa. Pesquisas futuras muito provavelmente terão um impacto importante na confiança e na própria estimativa.
- **Muito Baixa:** Pouca ou nenhuma confiança; qualquer estimativa de efeito é muito incerta.

Fórmula lógica de decisão para aplicação sistêmica:

Qualidade Final = Qualidade Inicial - Rebaixamento + Elevação

#### 6. Referências Bibliográficas Consultadas

As diretrizes técnicas aqui expostas baseiam-se estritamente na obra de referência padrão para Epidemiologia Clínica e MBE:

- GUYATT, G.; RENNIE, D.; MEADE, M.; COOK, D. **Users' Guides to the Medical Literature: A Manual for Evidence-Based Clinical Practice**. 3ª Edição, 2014. McGraw-Hill Education / JAMAevidence. (Capítulos 1, 2, 3, 4 e 5).

---

## Mapeamento ao schema 2 do eixo `grade` (`rederivar-grade.md`)

- `desenho.tipo` → certeza inicial (§2: RCT parte de Alta; observacional de Baixa)
- `dominios.risco_vies` · `inconsistencia` · `indireta` · `imprecisao` · `vies_publicacao` → §3 (−1 sério / −2 muito sério, com os critérios de cada um)
- `elevacoes[]` → §4 (magnitude grande +1 / muito grande +2, dose-resposta +1, confusão residual oposta +1; só quando a inicial é C)
- `certeza` A/B/C/D → §5 (definições de Alta/Moderada/Baixa/Muito baixa; fórmula `final = inicial − rebaixamento + elevação`, que o Portão A recalcula)
