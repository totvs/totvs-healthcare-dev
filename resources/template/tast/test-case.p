/*******************************************************************************
 CT.............: [@testFile]
 Data ..........: [@date]
 Programador ...: 
 Objetivo ......: Caso de testes para o metodo [@procedureName] de [@programName].p
 ******************************************************************************/
using classes.test.*.

{hdp/hdrunpersis.iv "new"}
// includes com definicoes de temp-tables utilizadas no caso de teste
[@includes]
// temp-tables utilizadas para comparacao de dados de saida
[@tempDefinition]

def var h-[@programName]-aux as handle no-undo.
def var oAssert as GpsAssert no-undo.
def var cFilePath as char no-undo.

procedure piBeforeExecute:
    assign cFilePath = replace(program-name(1), "~\", "/")
           cFilePath = substring(cFilePath, 1, r-index(cFilePath, "/")).
end procedure.
 
procedure piExecute:
    
    define output parameter lPassed as logical  no-undo.
    define output parameter cText   as longchar no-undo.

    oAssert = new GpsAssert().

    do transaction on error undo,leave:
        run executa-teste no-error.
        oAssert:checkError("Erro na execucao do teste").
        undo.
    end.

    assign lPassed = oAssert:passed
           cText   = oAssert:errorMessage.

    finally:
        delete object oAssert.
        {hdp/hddelpersis.i}
    end finally.

end procedure.
 
procedure executa-teste:

    // define variaveis de controle de entrada e saida
[@variableDefinition]
    
    // variaveis de controle
    def var lError as log no-undo.
    def var cReturn as char no-undo.   
    def var h-[@programName]-aux as handle no-undo.

    // configuracoes de campos das temp-tables de comparacao
    // parametro 1 = ignorar os campos? (true = todos campos serao considerados, exceto os informados / false = considerados somente os campos informados)
    // parametro 2 = lista de campos (separados por virgula)
    // parametro 3 = instancia gerada para o objeto

[@variableInstance]
 
    // atribui dados de entrada
    assign
[@variableAssign]
        .
    run carrega-dados-temp-tables no-error.
    oAssert:checkError("Erro ao carregar dados do teste").

    // executa teste
    {hdp/hdrunpersis.i "[@programPath]/[@programName].p" "h-[@programName]-aux"}
    run [@procedureName] in h-[@programName]-aux (
[@addCallParams]
    ) no-error.

    // processa saida
    assign cReturn = return-value
           lError  = error-status:error.
 
    // realiza comparacoes
[@addCompareResults]

    finally:
[@deleteInstance]
    end finally.

    /* 
        OBSERVACOES
        Metodos de comparacao da temp-table:
            - matchTable: todos os registros entre as temp-tables devem ser considerados
            - atLeast: temp de retorno deve conter pelo menos os registros da temp esperada (podendo conter mais)
    */

end.

procedure carrega-dados-temp-tables:

    // carrega dados de entrada
[@loadInputData]

    // carrega dados de saida
[@loadOutputData]

end procedure.

procedure cria-configuracao-campos:
    def input param lIgnorar as log no-undo.
    def input param cListaCampos as char no-undo.
    def output param oFields as AssertFieldCollection no-undo.

    def var iItem as int no-undo.

    oFields = new AssertFieldCollection().

    if lIgnorar
    then do:
        oFields:returnSameFieldWhenNotFound = true.

        repeat iItem = 1 to num-entries(cListaCampos):
            oFields:ignore(entry(iItem, cListaCampos)).
        end.
    end.
    else do:
        oFields:returnSameFieldWhenNotFound = false.

        repeat iItem = 1 to num-entries(cListaCampos):
            oFields:add(entry(iItem, cListaCampos)).
        end.
    end.

end procedure.
 
procedure piAfterExecute:
end procedure.
