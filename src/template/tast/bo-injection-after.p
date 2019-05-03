
// Metodo que esta criando o monitoramento
procedure [@procedureName]:

[@addInputParams]

    // variaveis de controle
    def var GPS_nmArquivo as char no-undo.
    def var GPS_result as JsonArray no-undo.
    def var GPS_object as JsonObject no-undo.
    def var GPS_JsonUtils as GpsJsonUtils no-undo.
    def var GPS_returnValue as char no-undo.
    def var GPS_errorStatus as log no-undo.

    GPS_result = new JsonArray().
    GPS_JsonUtils = new GpsJsonUtils().
    GPS_nmArquivo = "[@bridgeOutput]/[@programName]-[@procedureName]-" 
        + string(year(today), "9999")
        + string(month(today), "99")
        + string(day(today), "99")
        + "-"
        + string(random(1, 9999), "9999") 
        + ".json".

    // grava parametros de entrada (input / input-output)
    GPS_object = new JsonObject().
    GPS_object:add("$method", "[@procedureName]").
    GPS_object:add("$action", "in").
[@addJsonInputParams]
    GPS_result:add(GPS_object).

    // executa metodo original 
    do transaction on error undo,leave on stop undo, leave:
        run GPS_[@procedureName](
[@addCallParams]
        ) no-error.
        GPS_returnValue = return-value.
        GPS_errorStatus = error-status:error.

        undo.
    end.

    // grava parametros de saida (output / input-output)
    GPS_object = new JsonObject().
    GPS_object:add("$method", "[@procedureName]").
    GPS_object:add("$action", "out").
    GPS_object:add("$return", GPS_returnValue).
    GPS_object:add("$error", GPS_errorStatus).
[@addJsonOutputParams]
    GPS_result:add(GPS_object).

    GPS_result:writefile(GPS_nmArquivo).

end procedure.
