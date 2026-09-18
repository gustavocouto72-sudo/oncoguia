<!-- Material MBE da direção — copiado de ~/Downloads/MBE/Manual Técnico_ Interpretação de Magnitude, Precisão e Importância Clínica (Normas Guyatt & GRADE).docx em 2026-09-17.
     Conversão .docx → markdown por script próprio (sem pandoc); texto integral, sem edição de conteúdo.
     Tabelas que a fonte trazia em CSV/pipe inline foram reformatadas à mão; nada foi acrescentado além
     do que está marcado em itálico entre parênteses. Base declarada: Guyatt et al., Users' Guides to the
     Medical Literature, 3ª ed. (2014).
     Papel no squad: ficha de consulta — bloco **efeito** e domínio **imprecisão**. Mapeamento ao schema 2 do eixo `grade`: ver `grade-handbook.md`. -->

# Manual Técnico: Interpretação de Magnitude, Precisão e Importância Clínica (Normas Guyatt & GRADE)

Este manual estabelece as diretrizes normativas para agentes de inteligência artificial e clínicos na análise de evidências científicas, fundamentadas na obra "Users' Guides to the Medical Literature" e nos padrões do sistema GRADE. A análise deve ser rigorosamente técnica, priorizando a magnitude do efeito e a precisão das estimativas sobre a simples significância estatística.

#### 1. Fundamentos das Medidas de Associação e Efeito

O Agente de IA deve obrigatoriamente expressar resultados de desfechos binários utilizando medidas de efeito absoluto e relativo. A interpretação clínica deve focar no benefício real e no esforço terapêutico.

##### Tabela 1: Medidas de Efeito para Desfechos Binários

| Medida | Definição técnica e fórmula | Interpretação clínica |
|---|---|---|
| Risco Relativo (RR) | Razão entre o risco no grupo intervenção e no grupo controle: RR = [a/(a+b)] / [c/(c+d)] | Quantifica a força da associação. RR < 1 indica proteção; RR > 1 indica risco aumentado. |
| Redução do Risco Relativo (RRR) | Proporção do risco basal removida pelo tratamento: RRR = 1 − RR | Indica a eficácia relativa. Interpretar com cautela: tende a inflar a percepção do benefício. |
| Redução Absoluta do Risco (ARR) | Diferença aritmética entre as taxas de eventos: ARR = c/(c+d) − a/(a+b) | Impacto real da intervenção. Priorizar sobre a RRR. *(célula truncada no .docx de origem; interpretação completada conforme a "Lógica Normativa" abaixo)* |
| Número Necessário para Tratar (NNT) | Inverso da redução absoluta do risco: NNT = 1/ARR | Métrica de esforço clínico: quantos pacientes tratar para evitar um evento adicional. |

##### Lógica Normativa: ARR e NNT

O Agente de IA deve priorizar a ARR para descrever o impacto da intervenção. O NNT deve ser utilizado como a ferramenta primária para o clínico ponderar o esforço terapêutico necessário. Um NNT elevado em uma condição de baixo risco basal pode tornar a intervenção clinicamente irrelevante, independentemente da significância estatística.

#### 2. Avaliação da Precisão: O Papel do Erro Aleatório

A precisão da estimativa de efeito é governada pelo erro aleatório. O parâmetro normativo para esta avaliação é o Intervalo de Confiança (IC) de 95%.

##### Determinantes da Precisão

A amplitude do IC 95% é determinada por dois fatores fundamentais, conforme o Capítulo 10 da fonte:

1. **Tamanho da Amostra (N):** A variabilidade da estimativa é inversamente proporcional ao tamanho da amostra.
2. **Número de Eventos:** Em desfechos binários, a precisão é ditada primariamente pelo total de eventos acumulados, não apenas pelo N total.

##### Protocolo de Avaliação de Fragilidade

O Agente de IA deve classificar a "fragilidade" de um estudo seguindo estes critérios:

1. Identifique o número total de eventos em ambos os grupos.
2. Calcule se a troca de um ou dois eventos (de "não-evento" para "evento") inverteria o p-valor para > 0,05.
3. Classifique como "Frágil" qualquer resultado onde o número de eventos seja baixo, resultando em estimativas instáveis que podem ser meros artefatos do erro aleatório, mesmo com p-valor < 0,05.

#### 3. Julgamento da Importância Clínica e Limiares de Ação

A evidência estatística é necessária, mas insuficiente para a decisão (Princípio 3 do EBM). O julgamento clínico exige a aplicação de limiares.

##### Limiar de Ação Clínica (Clinical Action Threshold)

O clínico deve agir apenas quando o benefício líquido (benefícios menos riscos e custos) for positivo. O Agente de IA deve projetar se o IC 95% da estimativa reside inteiramente acima do limiar onde o tratamento é justificado.

##### Diferença Mínima Importante (MID)

Para desfechos contínuos, o Agente de IA **deve ignorar** a significância estatística se a magnitude do efeito não atingir a MID. A MID é a menor mudança em um desfecho que o paciente percebe como relevante. Efeitos estatísticos menores que a MID são considerados clinicamente irrelevantes.

##### Guia de Balanço de Danos: NNT vs. NNH

O Agente de IA deve obrigatoriamente comparar o NNT com o **Number Needed to Harm (NNH)**:

- **Regra de Recomendação:** Se o NNH for próximo ao NNT, a intervenção é marginal.
- **Integração de Valores:** A decisão final depende das preferências do paciente sobre os desfechos evitados vs. os danos causados.

#### 4. Regras de Decisão para o Agente de IA: Sistema GRADE para Imprecisão

O Agente de IA deve executar este protocolo normativo para decidir pelo rebaixamento (*downgrade*) da certeza da evidência:

1. **Regra de Ouro (Limiares de Importância):** Rebaixe a certeza (em 1 ou 2 níveis) se o IC de 95% cruzar o limiar de importância clínica. Se o intervalo incluir tanto um benefício clinicamente importante quanto um efeito irrelevante ou dano, a imprecisão é grave.
2. **Critério do Optimal Information Size (OIS):** O Agente de IA **deve** rebaixar a certeza se o tamanho total da amostra na meta-análise for menor que o OIS. O OIS é definido como o tamanho de amostra necessário para um RCT isolado com poder estatístico de 80% ou 90% para detectar o efeito observado.
3. **Monitoramento de Eventos:** Rebaixe a certeza se o número total de eventos acumulados for inferior a 300 (critério de estabilidade para desfechos dicotômicos).
4. **Incerteza na Recomendação:** Se o limite inferior do IC 95% levaria a uma recomendação e o limite superior a outra, rebaixe por imprecisão.

#### 5. Síntese Hierárquica da Evidência

A confiança na evidência é o parâmetro supremo, sobrepondo-se ao design do estudo.

##### Transição de Design para Certeza

De acordo com a Hierarquia de Evidência (Figura 2-3), os Ensaios Clínicos Randomizados (RCTs) iniciam o processo como evidência de **Alta Certeza**. Contudo, essa classificação é provisória e depende da qualidade intrínseca e da precisão dos resultados.

##### Critérios Normativos de Rebaixamento (Tabela 2-1)

O Agente de IA deve auditar cada corpo de evidência e aplicar rebaixamentos baseados nos seguintes domínios:

- **Risco de viés:** Falhas metodológicas graves na condução ou relato.
- **Inconsistência:** Variabilidade inexplicada dos resultados entre estudos.
- **Evidência Indireta:** Diferenças entre a população/intervenção do estudo e a questão clínica real.
- **Imprecisão:** Conforme os critérios de IC 95%, OIS e número de eventos detalhados na Seção 4.
- **Viés de publicação:** Alta probabilidade de estudos negativos não publicados. **Regra Final:** Um RCT com imprecisão grave ou risco de viés crítico deve ser classificado com certeza inferior a um estudo observacional bem conduzido que apresente um efeito de grande magnitude. No sistema GRADE, o rigor da confiança suplanta o "selo" do design.

---

## Mapeamento ao schema 2 do eixo `grade` (`rederivar-grade.md`)

- `efeito.medida` / `valor` / `ic95` / `eventos` → §1 (RR, RRR, ARR, NNT; **priorizar o absoluto**) e §2 (IC 95% governado por N e nº de eventos)
- `dominios.imprecisao` → §4 (as 4 regras: IC cruza limiar de importância; N < OIS; **eventos < 300**; limites do IC levariam a recomendações opostas) — é a base da **regra 4** (limite superior > 0,95 / eventos < 300 sem efeito grande)
- fragilidade (§2) → `dominios.imprecisao.por` quando 1–2 eventos inverteriam a significância
- `recomendacao` → §3 (limiar de ação; MID em desfecho contínuo; NNT ≈ NNH = intervenção marginal → não é `forte`) — conversa com a **regra 5** (MCBS ≥ 3)
- §5 "regra final": RCT impreciso pode ficar abaixo de observacional com efeito grande — o desenho não é selo
