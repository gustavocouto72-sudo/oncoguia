# Backlog — pendências registradas (OncoGuia)

Itens deixados **explicitamente em aberto** no código, com o gancho já no lugar. Cada um
diz o que falta, quem decide e onde está o gancho. Pendência registrada é pendência que
alguém pode fechar; pendência implícita vira dado inventado.

---

## 1. Listas de exames de reestadiamento por tumor (guia SADT)

**Estado:** gancho no lugar, devolvendo vazio de propósito.

- **Gancho:** `examesReestadiamento(tumor)` em `app/index.html` — hoje `return []`.
- **Onde aparece:** botão **Gerar guia SADT** no item de reestadiamento da trilha do
  paciente — hoje a guia TISS SP/SADT, bloco *Procedimentos ou Itens Assistenciais
  Solicitados* (campos 24–28). Com o gancho vazio, a guia abre com as **5 linhas do
  formulário oficial** em branco e o médico **digita os exames na hora** (o código TUSS ao
  lado é opcional e também digitado). O fluxo está completo e funcionando assim — a lista
  por tumor é conveniência, não pré-requisito.
- **O que falta:** as listas de exames por tumor (ex.: mama → TC de tórax/abdome, cintilografia
  óssea…) precisam ser **definidas pelo oncologista de referência na Revisão clínica**, do
  mesmo jeito que o resto da camada clínica: informação assinada por humano, não derivada
  por agente.
- **Por que NÃO foi feito agora:** escrever essas listas aqui seria protocolo escrito à mão
  dentro da app — exatamente o que este projeto não faz (tudo vem do corpus do squad ou da
  Revisão clínica). Um agente sugerindo "exames de rotina" é palpite com cara de protocolo.
- **Como fechar quando houver decisão clínica:** persistir as listas na camada de revisão
  (uma decisão por tumor, como os pareceres em `revisoes`), expor no payload que a app já
  carrega e trocar o corpo do gancho pela leitura desse dado. Nenhuma outra parte da guia
  muda: `abrirSADT()` já usa o retorno do gancho para pré-preencher as linhas de
  `SADT.proc` (descrição + quantidade 1), respeitando o limite de 5 do formulário. **O
  código TUSS continua fora do gancho** — ele não é decisão clínica e a app não o gera;
  virá da tabela da operadora ou da mão do humano.

**Portão:** o check `R14 gancho examesReestadiamento(tumor) devolve vazio (pendência
registrada)` em `scripts/portao-retorno.js` falha no dia em que alguém preencher isso à mão
sem passar pela Revisão clínica — é o alarme desta pendência.

---

## 2. ~~Tipo "Autorização" na trilha do paciente~~ — FECHADO

Fechado no merge das duas features (2026-09-02). A trilha traz os três tipos: `avaliacao`,
`retorno` e `autorizacao`. A decisão do auditor entra como item próprio **no dia em que foi
decidida** (quase nunca o dia da seleção), com selo ⏳/✅/⛔ e o parecer; a solicitação em si
viaja no item da avaliação, que é onde ela nasceu. Ordenação inalterada: dia → instante do
registro → id → tipo.
