# Fontes confiáveis (hierarquia)

Ordem de preferência ao verificar e ao vigiar:

1. **Estudo-pivô** (texto integral): NEJM, JCO, Lancet Oncol, Annals of Oncology, JAMA Oncol — via DOI/PMID.
2. **Diretrizes:** NCCN, ASCO, ESMO (guidelines + **scorecards ESMO-MCBS**), SBOC (Brasil).
3. **Bases de regimes:** HemOnc.org (regimes + referências).
4. **Contexto BR:** PCDT/CONITEC, INCA (Manual de Bases Técnicas da Oncologia), ANS.
5. **Segurança/bula:** ANVISA, FDA/EMA (alertas, atualizações de bula).
6. **Registros de ensaios:** ClinicalTrials.gov (para elegibilidade e estudos em curso).

## Regras
- Preferir sempre a fonte primária à secundária. Blog/resumo não fundamenta veredito firme.
- Registrar SEMPRE o link/DOI consultado no campo `fonte`.
- Preprint ou nota de imprensa = sinal fraco (nunca candidato firme de atualização).
- Direitos autorais: NCCN exige licença para uso comercial do conteúdo — nesta fase (verificação/estudo) usamos as fontes abertas e as diretrizes como referência, sem redistribuir conteúdo licenciado.

---

# APIs abertas das bases científicas (consultar ANTES de marcar "inacessível")

Antes de concluir que um artigo está inacessível (paywall / página JS / link quebrado), **esgote as APIs abertas abaixo**. Todas são gratuitas, respondem a `GET` e retornam JSON/XML — dá para buscar com o próprio `web_fetch` (as APIs não têm login; não confundir com o paywall da página do editor). Só depois de a escada inteira falhar é que o item vira "precisa de acesso institucional" e vai para `fontes-a-buscar.json` (Caso A).

**E-mail de contato obrigatório** (Unpaywall exige; OpenAlex/PubMed pedem por etiqueta): use um e-mail real nos parâmetros `email=` / `mailto=`. E-mail de contato do projeto: **`gustavocouto72@gmail.com`**.

## Endpoints

### 1. Europe PMC — abstract, metadados e texto completo OA
- Busca por DOI: `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:<DOI>&format=json&resultType=core`
- Busca por termo: `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=<termos>&format=json&resultType=core`
- Texto completo OA (quando `isOpenAccess=Y`, usar o `pmcid` do resultado, sem o prefixo `PMC`): `https://www.ebi.ac.uk/europepmc/webservices/rest/PMC/<PMCID>/fullTextXML`
- Campos úteis no resultado `core`: `abstractText`, `isOpenAccess`, `pmcid`, `doi`, `pmid`, `authorString`, `journalTitle`, `pubYear`.

### 2. Unpaywall — versão de acesso aberto de um artigo com paywall
- `https://api.unpaywall.org/v2/<DOI>?email=gustavocouto72@gmail.com`
- Usar `best_oa_location.url_for_pdf` (ou `best_oa_location.url`); se `is_oa=false`, não há versão aberta conhecida.

### 3. OpenAlex — metadados + status OA (sem chave)
- `https://api.openalex.org/works/doi:<DOI>?mailto=gustavocouto72@gmail.com`
- Usar `open_access.oa_url` (URL da versão aberta) e `open_access.is_oa`.

### 4. Crossref — DOI → metadados canônicos
- `https://api.crossref.org/works/<DOI>`
- Confirma título, autores, periódico, ano; útil para validar o DOI antes de gastar as demais chamadas.

### 5. PubMed E-utilities — fallback de abstract
- Busca (termo → PMID): `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=<termos>&retmode=json`
- Abstract (PMID → texto): `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=<PMID>&rettype=abstract&retmode=text`

### 6. ClinicalTrials.gov API v2 — critérios de elegibilidade ESTRUTURADOS
- Por NCT: `https://clinicaltrials.gov/api/v2/studies/<NCTID>?format=json`
- Por termo: `https://clinicaltrials.gov/api/v2/studies?query.term=<termos>&format=json`
- Elegibilidade em `protocolSection.eligibilityModule`: `eligibilityCriteria` (texto de inclusão/exclusão), `sex`, `minimumAge`, `maximumAge`, `healthyVolunteers`.
- **Esta é a fonte preferencial do eixo de elegibilidade** — traz os critérios de inclusão/exclusão já estruturados, o que muitas vezes o abstract do artigo não traz.

## Escada de tentativa (fallback ladder) — por regime

Aplicar em ordem; parar assim que o eixo estiver resolvido com fonte primária:

1. **Tem DOI** → **Crossref**(`<DOI>`) confirma metadados **+** **Europe PMC**(`DOI:<DOI>`) para abstract e, se `isOpenAccess=Y`, texto completo (`PMC/<PMCID>/fullTextXML`).
2. **Não é OA** → **Unpaywall**(`<DOI>`) **e** **OpenAlex**(`doi:<DOI>`) para achar a versão de acesso aberto; se achar `url_for_pdf`/`oa_url`, `web_fetch` nela.
3. **Sem DOI** → buscar por nome do estudo/regime + tumor no **Europe PMC** (`search?query=<termos>`) **/PubMed** (`esearch`) → obter PMID/DOI → voltar ao passo 1.
4. **Eixo de elegibilidade** → **sempre** tentar **ClinicalTrials.gov** pelo nome/NCT do estudo (`query.term=<nome do estudo> <tumor>`) para pegar os critérios de inclusão/exclusão estruturados (`eligibilityModule`), mesmo que o artigo esteja acessível.
5. **Só depois de tudo falhar** → marcar `motivo_nao_acesso` apropriado, selo "incompleto"/"precisa de acesso institucional" e enviar para `fontes-a-buscar.json` (Caso A). Nunca chutar valor não confirmado pela fonte.

## Regras da escada
- **E-mail real** nos parâmetros `email=`/`mailto=` — Unpaywall recusa sem e-mail; OpenAlex/PubMed pedem para não limitar a taxa.
- **Nada de inventar.** Se a API não retornar o dado, o eixo é `indeterminado` (ou "acesso institucional"), nunca um valor chutado.
- **Honestidade adversarial:** a fonte primária consultada (DOI/URL/NCT) é SEMPRE citada no campo `fonte`. Metadado de agregador (OpenAlex/Crossref) não substitui a leitura da fonte primária para o veredito — serve para localizá-la.
- Registrar no `fonte` qual degrau da escada resolveu o item (ex.: `EuropePMC fullTextXML PMC…`, `ClinicalTrials.gov NCT…`, `Unpaywall→PDF …`).
