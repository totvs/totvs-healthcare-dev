/*******************************************************************************
 CT.............: [@testFile]
 Data ..........: [@date]
 Programador ...:
 Objetivo ......: Caso de testes para o metodo [@procedureName] de [@programName].p
 ******************************************************************************/
using classes.test.*.

{hdp/hdrunpersis.iv}
[@includes]
def var oAssert as GpsAssert no-undo.

procedure piBeforeExecute:
end procedure.

procedure piExecute:

    define output parameter lPassed as logical  no-undo.
    define output parameter cText   as longchar no-undo.

    oAssert = new GpsAssert().
[@setAssertSpool]
    do transaction on error undo,leave:
        run executa-teste no-error.
        oAssert:checkError("Erro na execucao do teste").
        undo.
    end.

    assign lPassed = oAssert:passed
           cText   = oAssert:errorMessage.

    finally:
        delete object oAssert.
    end finally.

end procedure.

procedure executa-teste:

    // variaveis de controle
    def var lError as log no-undo.
    def var cReturn as char no-undo.
    def var h-[@programName]-aux as handle no-undo.

    // define variaveis de controle de entrada e saida
[@variableDefinition]
    // atribui dados de entrada
    assign
[@variableAssign]
        .

    // executa teste
    do on stop undo, return error:
        {hdp/hdrunpersis.i "[@programPath]/[@programName].p" "h-[@programName]-aux"}
        run [@procedureName] in h-[@programName]-aux (
[@addCallParams]
        ) no-error.
    end.

    // processa saida
    assign cReturn = return-value
           lError  = error-status:error.

    // realiza comparacoes
[@addCompareResults]
end.

procedure piAfterExecute:
end procedure.
