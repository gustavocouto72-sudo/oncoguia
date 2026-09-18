<!-- Material MBE da direção — copiado de ~/Downloads/MBE/Relatório Técnico_ Manejo de Evidências Indiretas no Sistema GRADE.docx em 2026-09-17.
     Conversão .docx → markdown por script próprio (sem pandoc); texto integral, sem edição de conteúdo.
     Tabelas que a fonte trazia em CSV/pipe inline foram reformatadas à mão; nada foi acrescentado além
     do que está marcado em itálico entre parênteses. Base declarada: Guyatt et al., Users' Guides to the
     Medical Literature, 3ª ed. (2014).
     Papel no squad: ficha de consulta — domínio **indireta** (PICO). Mapeamento ao schema 2 do eixo `grade`: ver `grade-handbook.md`. -->

# Relatório Técnico: Manejo de Evidências Indiretas no Sistema GRADE

#### 1. Introdução à Evidência Indireta no Sistema GRADE

No sistema GRADE (*Grading of Recommendations Assessment, Development and Evaluation*), a confiança nas estimativas de efeito é o pilar da Prática Baseada em Evidências (PBE). A "evidência indireta" ocorre quando a evidência disponível não aborda diretamente a questão clínica específica formulada sob a estrutura PICO (População, Intervenção, Comparador e Desfecho), exigindo que o clínico ou pesquisador realize inferências para aplicar os resultados ao seu cenário.

Conforme as diretrizes detalhadas no Capítulo 2 (" *Guides to Confidence in Estimates* ") e na Tabela 2-1, a indirecionalidade é um dos cinco domínios fundamentais que podem reduzir a confiança nas estimativas. É imperativo notar que, no GRADE, o ponto de partida para a avaliação difere conforme o desenho do estudo: ensaios clínicos randomizados (RCTs) iniciam com "Alta Confiança", enquanto estudos observacionais iniciam com "Baixa Confiança". A presença de evidência indireta em um RCT pode rebaixar sua classificação ao nível de um estudo observacional bem conduzido, sinalizando que a aplicabilidade dos dados é incerta.

#### 2. Os Quatro Cenários Principais de Indirecionalidade (PICO)

A análise da indirecionalidade exige uma dissecação minuciosa dos componentes PICO (Capítulo 4). A evidência é considerada indireta quando há discrepâncias significativas em uma ou mais das seguintes dimensões:

1. **Diferenças na População:** Quando os participantes do estudo diferem dos pacientes de interesse em termos de idade, gravidade da doença, estágios de comorbidade ou fatores genéticos. Por exemplo, utilizar dados de pacientes jovens e hígidos para tratar idosos com múltiplas falências orgânicas.
2. **Diferenças na Intervenção:** Ocorre quando a intervenção testada não é idêntica à pretendida. Isso inclui variações técnicas, diferenças na via de administração (ex: intravenosa vs. oral), dosagens (doses subterapêuticas ou supraterapêuticas) e a duração do tratamento.
3. **Diferenças no Comparador:** Manifesta-se quando o grupo controle não reflete o "cuidado padrão" atual ou a alternativa clínica mais relevante. O uso de placebos em cenários onde já existem terapias ativas eficazes gera evidência indireta para a escolha entre tratamentos ativos.
4. **Diferenças nos Desfechos:** Ocorre quando os resultados medidos no estudo não são aqueles que os pacientes valorizam diretamente. O exemplo clássico é o uso de desfechos substitutos em vez de desfechos clínicos definitivos.

#### 3. Manejo de Desfechos Substitutos (Surrogate Outcomes)

O Capítulo 13.4 adverte que o uso de desfechos substitutos — como biomarcadores laboratoriais ou densidade mineral óssea — constitui evidência indireta por natureza. A indirecionalidade reside na existência de um **gap inferencial**: o clínico deve pressupor que a alteração no marcador (substituto) resultará necessariamente em uma alteração em um evento clínico real (importante para o paciente).

Para uma prática de excelência, deve-se priorizar desfechos que impactem a vida do paciente, categorizados no Capítulo 4 como: **sintomas, função, morbidade, mortalidade e custos**. Se um estudo demonstra aumento da densidade óssea, mas não avalia a redução de fraturas ou mortalidade, a confiança na estimativa de efeito para o benefício clínico real deve ser rebaixada, pois a "tradução" do marcador biológico para o evento clínico carece de evidência direta.

#### 4. Desafios na Comparação: Metanálise em Rede e a Pirâmide de Evidências

Quando faltam ensaios "head-to-head" (comparação direta), a evidência torna-se inerentemente indireta. O fluxo de processamento de evidências, descrito no Capítulo 5 e na Figura 5-1, organiza os recursos em níveis de processamento: **Summaries** (Sumários e Diretrizes), **Preappraised Research** (Pesquisa Pré-avaliada como Revisões Sistemáticas) e **Nonpreappraised Research** (Pesquisa Não Pré-avaliada, como estudos primários no PubMed).

A Metanálise em Rede (NMA) é a ferramenta avançada para lidar com essa lacuna. Ela permite inferências sobre a eficácia relativa através de um comparador comum (ex: A vs. Placebo e B vs. Placebo, inferindo A vs. B). Contudo, a NMA introduz uma **indirecionalidade estrutural**. Sua validade depende da **transitividade**, ou seja, os estudos na rede devem ser suficientemente similares em termos de PICO para que a comparação indireta seja válida. Na busca por evidências, o pesquisador deve seguir a hierarquia: consultar primeiro os *Summaries* (ex: DynaMed, UpToDate) e apenas recorrer à busca manual de estudos primários em bases como PubMed se os recursos sintetizados falharem em fornecer dados diretos.

#### 5. Critérios para o Rebaixamento da Confiança (Rating Down)

A decisão metodológica de rebaixar a confiança não é meramente burocrática; é uma medida da incerteza sobre se o efeito observado se traduzirá para o paciente real. Com base na Tabela 2-1, a orientação é:

| Gravidade | Ação de Rebaixamento | Justificativa/Exemplo |
| ------ | ------ | ------ |
| **Indirecionalidade Séria** | -1 Nível | Dúvidas moderadas sobre a aplicabilidade. Ex: Diferenças menores em doses ou populações com gravidade similar, mas não idêntica. |
| **Indirecionalidade Muito Séria** | -2 Níveis | Diferenças fundamentais ou dependência total de desfechos substitutos não validados para o desfecho de interesse. |

#### 6. Conclusão e Aplicação Clínica

A aplicação do sistema GRADE reafirma o terceiro princípio fundamental da Medicina Baseada em Evidências (MBE): **"A evidência é necessária, mas nunca suficiente para uma decisão clínica"** (Capítulos 2 e 3). A evidência indireta, embora reduza a confiança nas estimativas de efeito, ainda é "evidência". É um erro afirmar que "não há evidência" apenas por sua indirecionalidade; sempre existem dados que, embora possam ser de confiança "Muito Baixa", devem ser considerados.

A transparência absoluta no relato da indirecionalidade é o que viabiliza a **Decisão Compartilhada** (Capítulo 27). Ao comunicar as incertezas inerentes aos dados indiretos, o clínico permite que os valores e preferências do paciente guiem o peso final da decisão, garantindo que a prática clínica seja cientificamente fundamentada e eticamente responsável.

---

## Mapeamento ao schema 2 do eixo `grade` (`rederivar-grade.md`)

- `dominios.indireta` → §2 (4 cenários: população, intervenção, comparador, desfecho) e §5 (−1 sério / −2 muito sério)
- `desfecho_critico` substituto → §3 (surrogate = indireta por natureza; *gap inferencial*) — é a base da **regra 2** (teto B sem SG)
- `pivo.comparador_padrao_atual` → §2.3 (comparador que não reflete o cuidado padrão atual = indireta) — base da parte final da **regra 6**
- `pivo.intervencao` ⊇ `farmacos[]` → §2.2 (dose, via, duração, variação técnica) — caso mFOLFIRINOX vs FOLFIRINOX pleno
- comparações indiretas / NMA → §4 (transitividade); entra em `pivo.por` quando o protocolo justifica o regime por comparação em rede
- §6: "evidência indireta ainda é evidência" → nunca `indeterminado` por indireta; rebaixa e declara
