# TOTVS Healthcare Development Utilities
> Extensão para processos da unidade TOTVS Caxias do Sul

## OpenEdge ABL (Progress)
Para as funcionalidades que tratam de fontes Progress, é necessário instalar um dos plugins abaixo:
- [EzequielGandolfi.openedge-zext](https://marketplace.visualstudio.com/items?itemName=EzequielGandolfi.openedge-zext)
- [rafaelcanal.gps-abl](https://marketplace.visualstudio.com/items?itemName=rafaelcanal.gps-abl)
    _(alguns recursos não são compatíveis com este plugin)_

## TAST - Testes Automatizados
- Geração de casos de teste (TAST)
- Executar casos de teste associados ao código-fonte ativo
- Painel do TAST
    - Lista de suites e casos de teste
    - Cadastro de casos de teste
    - Execução de casos de teste cadastrados
    - Execução de casos de teste não cadastrados

### Bridge
- Gera o programa de interceptação de dados

### Test Case
- Gera o script de teste unitário baseado nos dados interceptados
- Gera o script de teste unitário para um método específico

## Alertas
- Emissão de alertas de palavras específicas no código (para evitar o commit de linhas de teste)

## Metricas
- Análise de métricas do código-fonte 
> Experimental

## Formatação
- Formatação do código-fonte nos padrões da unidade
> Experimental

## Snippets

### runp
- Bloco de código para rodar um programa com persistência, utilizando as includes do produto
### logtt
- Bloco que escreve cada um dos registros de uma temp-table para o log manager
### if
- Comando IF-THEN
### fore
- Bloco de comando FOR EACH
### forf
- Bloco de comando FOR FIRST
### forl
- Bloco de comando FOR LAST
