import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MapFile, MapMethod } from './models';
import { getConfig } from './configFile';
import { changePath, mkdir } from './utils';
import { isString } from 'util';
import { outputChannel } from './notification';

export class HealthcareTastExtension {

    private context: vscode.ExtensionContext;
    private readonly PREFIX_FIELDCOLLECTION = 'oFd';
    private readonly EXT_OPENEDGE = 'ezequielgandolfi.openedge-zext';
    private readonly EXT_GETMAP = 'abl.currentFile.getMap';
    private readonly THIS_EXTENSION = 'totvs-healthcare.totvs-healthcare-dev'

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.registerCommands();
    }

    private registerCommands() {
        this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.tast.generateBridge', () => { this.execGenerateBridge() }));
        this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.tast.generateCenario', () => { this.execGenerateCenario() }));
    }

    private execGenerateBridge() {
        let config = getConfig();

        if (vscode.extensions.all.find(item => item.id == this.EXT_OPENEDGE)) {
            // Busca todos os métodos do arquivo atual
            vscode.commands.executeCommand(this.EXT_GETMAP).then((data: MapFile) => {
                let methods = data.methods;
                let list = methods.map(item => { return item.name }).sort(function (a, b) { return a.localeCompare(b) });
                // Mostra escolha do método para monitorar
                vscode.window.showQuickPick(list, { placeHolder: 'Escolha a função para interceptar dados' }).then(item => {
                    if ((item != null) && (item != '')) {
                        let method = methods.find(v => v.name == item);
                        let data = this.createBridgeProgram(method);
                        let wf = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
                        let tempDest = [wf.uri.fsPath, '.' + path.basename(vscode.window.activeTextEditor.document.uri.fsPath)].join('\\');
                        let rcodeName = tempDest.substring(0, tempDest.lastIndexOf('.')) + '.r';
                        fs.writeFileSync(tempDest, data);

                        vscode.window.showInformationMessage('Compilando o programa...');
                        vscode.commands.executeCommand('abl.compile', tempDest, config.tast.config).then(() => {
                            if (fs.existsSync(rcodeName)) {
                                let dest = changePath(vscode.window.activeTextEditor.document.uri.fsPath, config.tast.bridge.path, wf);
                                dest = dest.substring(0, dest.lastIndexOf('.')) + '.r';
                                mkdir(path.dirname(dest));
                                fs.copyFileSync(rcodeName, dest);
                                vscode.window.showInformationMessage('Programa de interceptação gerado');
                            }
                            else {
                                vscode.window.showErrorMessage('Erro na compilação');
                                vscode.workspace.openTextDocument({content: data, language: 'abl'}).then(doc => vscode.window.showTextDocument(doc));
                            }
                            fs.unlinkSync(tempDest);
                            fs.unlinkSync(rcodeName);
                        });
                    }
                });
            });
        }
        else {
            vscode.window.showErrorMessage('Necessário instalar a extensão "' + this.EXT_OPENEDGE + '" !!!');
        }
    }

    private execGenerateCenario() {
        let config = getConfig();

        if (vscode.extensions.all.find(item => item.id == this.EXT_OPENEDGE)) {
            // Busca todos os métodos do arquivo atual
            vscode.commands.executeCommand(this.EXT_GETMAP).then((data: MapFile) => {

                let files = fs.readdirSync(config.tast.cenario.input);
                let baseName = path.basename(vscode.window.activeTextEditor.document.uri.fsPath);
                files = files.filter(item => item.startsWith(baseName) && item.endsWith('.json'));

                vscode.window.showQuickPick(files.map(item => path.basename(item))).then(fName => {
                    let jsonName = [config.tast.cenario.input, fName].join('\\');
                    let strJson = fs.readFileSync(jsonName).toString();
                    let dataJson = JSON.parse(strJson);

                    let templatePath = [vscode.extensions.getExtension(this.THIS_EXTENSION).extensionPath, 'resources', 'template', 'tast'].join('\\');
                    let dataCenario = fs.readFileSync([templatePath, 'test-case.p'].join('\\')).toString();

                    vscode.window.showInputBox({ prompt: 'Nome do arquivo do caso de teste (sem a extensão)', value: 'CT_' }).then(testName => {
                        let newFile = this.parseAndSaveCenarioTemplate(dataCenario, dataJson, data, testName);
                        vscode.workspace.openTextDocument(newFile).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                    });
                });
            });
        }
        else {
            vscode.window.showErrorMessage('Necessário instalar a extensão "' + this.EXT_OPENEDGE + '" !!!');
        }
    }

    private createBridgeProgram(method: MapMethod): string {
        let templatePath = [vscode.extensions.getExtension(this.THIS_EXTENSION).extensionPath, 'resources', 'template', 'tast'].join('\\');
        let dataBefore = fs.readFileSync([templatePath, 'bo-injection-before.p'].join('\\')).toString();
        let dataAfter = fs.readFileSync([templatePath, 'bo-injection-after.p'].join('\\')).toString();
        let dataActive = vscode.window.activeTextEditor.document.getText();
        // renomeia a procedure original
        let reProc: RegExp = new RegExp('(?:proc[edure]*){1}[\\s\\t\\n]+(' + method.name + '){1}[\\s\\t\\n\\.\\:]+', 'gim');
        dataActive = dataActive.replace(reProc, 'procedure GPS_' + method.name + ':\n\t');
        // altera template
        dataBefore = this.parseBridgeTemplate(dataBefore, method);
        dataAfter = this.parseBridgeTemplate(dataAfter, method);
        //
        return dataBefore + dataActive + dataAfter;
    }

    private parseBridgeTemplate(source: string, method: MapMethod): string {
        let config = getConfig();
        let templateInputParams = this.buildBridgeSourceInputParams(method);
        let templateJsonInputParams = this.buildBridgeSourceJsonInputParams(method);
        let templateCallParams = this.buildBridgeSourceCallParams(method);
        let templateJsonOutputParams = this.buildBridgeSourceJsonOutputParams(method);

        return source
            .replace(/\[@procedureName\]/g, method.name)
            .replace(/\[@programName\]/g, path.basename(vscode.window.activeTextEditor.document.uri.fsPath))
            .replace(/\[@bridgeOutput\]/g, config.tast.bridge.output)
            .replace(/\[@addInputParams\]/g, templateInputParams)
            .replace(/\[@addJsonInputParams\]/g, templateJsonInputParams)
            .replace(/\[@addJsonOutputParams\]/g, templateJsonOutputParams)
            .replace(/\[@addCallParams\]/g, templateCallParams);
    }

    private buildBridgeSourceInputParams(method: MapMethod): string {
        let result = '';
        method.params.forEach(param => {
            let line = '\tdef ' + param.direction + ' parameter ';
            if (param.dataType == 'temp-table') {
                line += 'table for ' + param.name;
            }
            else {
                line += param.name + ' ' + param.asLike + ' ' + param.dataType + ' no-undo';
            }
            result += line + '.\n';
        });
        return result;
    }

    private buildBridgeSourceCallParams(method: MapMethod): string {
        let result = '';
        method.params.forEach(param => {
            let line = '\t\t\t' + param.direction + ' ';
            if (result != '')
                result += ',\n';
            if (param.dataType == 'temp-table') {
                line += 'table ' + param.name;
            }
            else {
                line += param.name;
            }
            result += line;
        });
        return result;
    }

    private buildBridgeSourceJsonInputParams(method: MapMethod): string {
        let result = '';
        method.params.filter(param => param.direction == 'input' || param.direction == 'input-output').forEach(param => {
            let line = '\tGPS_object:add("' + param.name + '", ';
            if (param.dataType == 'temp-table') {
                line += 'GPS_JsonUtils:getJsonArrayFromTable(temp-table ' + param.name + ':default-buffer-handle)).';
            }
            else {
                line += param.name + ').';
            }
            result += line + '\n';
        });
        return result;
    }

    private buildBridgeSourceJsonOutputParams(method: MapMethod): string {
        let result = '';
        method.params.filter(param => param.direction == 'output' || param.direction == 'input-output').forEach(param => {
            let line = '\tGPS_object:add("' + param.name + '", ';
            if (param.dataType == 'temp-table') {
                line += 'GPS_JsonUtils:getJsonArrayFromTable(temp-table ' + param.name + ':default-buffer-handle)).';
            }
            else {
                line += param.name + ').';
            }
            result += line + '\n';
        });
        return result;
    }

    private parseAndSaveCenarioTemplate(source: string, data: any[], mapFile: MapFile, testCaseId: string): string {
        let wf = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);

        let inputData = data.filter(item => item.$action == 'in')[0];
        let outputData = data.filter(item => item.$action == 'out')[0];
        let programName = path.basename(vscode.window.activeTextEditor.document.uri.fsPath, '.p');
        let programPath = path.dirname(vscode.window.activeTextEditor.document.uri.fsPath.replace(wf.uri.fsPath + '\\', '').replace(/\\/g, '/'));
        let procedureName = inputData.$method;
        let method = mapFile.methods.find(item => item.name.toLowerCase() == procedureName.toLowerCase());

        let config = getConfig();
        let templateIncludes = this.buildCenarioSourceIncludes(method, inputData, outputData, mapFile, testCaseId);
        let templateTempDefinition = this.buildCenarioSourceTempDefinition(method, inputData, outputData, mapFile, testCaseId);
        let templateVarDefinition = this.buildCenarioSourceVariableDefinition(method, inputData, outputData, mapFile, testCaseId);
        let templateVarAssign = this.buildCenarioSourceVariableAssign(method, inputData, outputData, mapFile, testCaseId);
        let templateVarInstance = this.buildCenarioSourceVariableInstance(method, inputData, outputData, mapFile, testCaseId);
        let templateLoadInputData = this.buildCenarioSourceLoadInputData(method, inputData, outputData, mapFile, testCaseId);
        let templateLoadOutputData = this.buildCenarioSourceLoadOutputData(method, inputData, outputData, mapFile, testCaseId);
        let templateCallParams = this.buildCenarioSourceCallParams(method, inputData, outputData, mapFile, testCaseId);
        let templateCompareResults = this.buildCenarioSourceCompareResults(method, inputData, outputData, mapFile, testCaseId);
        let templateDeleteInstance = this.buildCenarioSourceDeleteInstance(method, inputData, outputData, mapFile, testCaseId);

        source = source
            .replace(/\[@programName\]/g, programName)
            .replace(/\[@programPath\]/g, programPath)
            .replace(/\[@procedureName\]/g, procedureName)
            .replace(/\[@testId\]/g, testCaseId)
            .replace(/\[@testFile\]/g, this.assemblyTestCaseFileName(testCaseId)+'.p')
            .replace(/\[@date\]/g, (new Date()).toLocaleDateString())
            .replace(/\[@includes\]/g, templateIncludes)
            .replace(/\[@tempDefinition\]/g, templateTempDefinition)
            .replace(/\[@variableDefinition\]/g, templateVarDefinition)
            .replace(/\[@variableAssign\]/g, templateVarAssign)
            .replace(/\[@variableInstance\]/g, templateVarInstance)
            .replace(/\[@loadInputData\]/g, templateLoadInputData)
            .replace(/\[@loadOutputData\]/g, templateLoadOutputData)
            .replace(/\[@addCallParams\]/g, templateCallParams)
            .replace(/\[@addCompareResults\]/g, templateCompareResults)
            .replace(/\[@deleteInstance\]/g, templateDeleteInstance);
        
        let newFile = [config.tast.cenario.output,this.assemblyTestCaseFileName(testCaseId)+'.p'].join('\\');
        fs.writeFileSync(newFile, source);

        // armazena dados das temp-tables utilizadas
        Object.keys(inputData).filter(item => Array.isArray(inputData[item])).forEach(item => {
            let dataTt: Object = inputData[item];
            let fn = this.assemblyTestDataFileName(item.toLowerCase(), testCaseId, 'input');
            fs.writeFileSync([config.tast.cenario.output,fn].join('\\'), JSON.stringify(dataTt));
        });
        Object.keys(outputData).filter(item => Array.isArray(outputData[item])).forEach(item => {
            let dataTt: Object = outputData[item];
            let fn = this.assemblyTestDataFileName(item.toLowerCase(), testCaseId, 'output');
            fs.writeFileSync([config.tast.cenario.output,fn].join('\\'), JSON.stringify(dataTt));
        });

        return newFile;
    }

    private assemblyTestCaseFileName(testId: string): string {
        return testId;
    }

    private assemblyTestDataFileName(name: string, testId: string, dataType: 'input' | 'output'): string {
        return this.assemblyTestCaseFileName(testId) + '.' + name + '.' + dataType + '.json';
    }

    private buildCenarioSourceIncludes(method: MapMethod, dataInput: any, dataOutput: any, mapFile: MapFile, testCaseId: string): string {
        let tempTables: string[] = [];
        let includes: string[] = [];

        Object.keys(dataInput).concat(Object.keys(dataOutput)).forEach(item => {
            if ((Array.isArray(dataInput[item])) || (Array.isArray(dataOutput[item])))
                tempTables.push(item.toLowerCase());
        });
        tempTables = tempTables.filter(function (value, index, self) {
            return self.indexOf(value) === index;
        });

        tempTables.forEach(ttName => {
            let tt = mapFile.tempTables.find(item => item.label.toLowerCase() == ttName);
            if (!tt) {
                let include = mapFile.includes.find(incFile => {
                    let incTt;
                    if (incFile.map)
                        incTt = incFile.map.tempTables.find(item => item.label.toLowerCase() == ttName);
                    return (incTt != null);
                });
                if (include)
                    includes.push(include.name);
            }
        });

        let result = '';
        includes = includes.filter(function (value, index, self) {
            return self.indexOf(value) === index;
        });
        includes.forEach(item => { result += '{' + item + '}\n'; });
        return result;
    }

    private buildCenarioSourceTempDefinition(method: MapMethod, dataInput: any, dataOutput: any, mapFile: MapFile, testCaseId: string): string {
        let tempTables: string[] = [];

        Object.keys(dataOutput).forEach(item => {
            if (Array.isArray(dataOutput[item]))
                tempTables.push(item.toLowerCase());
        });
        tempTables = tempTables.filter(function (value, index, self) {
            return self.indexOf(value) === index;
        });

        let result = '';
        tempTables.forEach(ttName => { result += 'def temp-table GPS_' + ttName + ' like ' + ttName + '.\n'; });
        return result;
    }

    private buildCenarioSourceVariableDefinition(method: MapMethod, dataInput: any, dataOutput: any, mapFile: MapFile, testCaseId: string): string {
        let result = '';
        // variaveis
        let variables = method.params.filter(item => item.dataType != 'temp-table');
        variables.forEach(v => { result += '\tdef var ' + v.name + ' ' + v.asLike + ' ' + v.dataType + ' no-undo.\n'; })
        // controle de campos das temp-tables de saida
        variables = method.params.filter(item => item.dataType == 'temp-table' && item.direction != 'input');
        variables.forEach(v => {
            result += '\tdef var ' + this.PREFIX_FIELDCOLLECTION + v.name + ' as AssertFieldCollection no-undo.\n';
        })

        return result;
    }

    private buildCenarioSourceVariableAssign(method: MapMethod, dataInput: any, dataOutput: any, mapFile: MapFile, testCaseId: string): string {
        let result = '';

        // variaveis
        let variables = method.params.filter(item => item.dataType != 'temp-table' && item.direction != 'output');
        variables.forEach(v => {
            let value = dataInput[v.name];
            if (isString(value))
                value = '"' + value + '"';
            result += '\t\t' + v.name + ' = ' + value + '\n';
        })

        return result;
    }

    private buildCenarioSourceVariableInstance(method: MapMethod, dataInput: any, dataOutput: any, mapFile: MapFile, testCaseId: string): string {
        let result = '';

        // controle de campos das temp-tables de saida
        let variables = method.params.filter(item => item.dataType == 'temp-table' && item.direction != 'input');
        variables.forEach(v => {
            result += '\t// lista de campos a adicionar/ignorar para na comparacao da ' + v.name + '\n\trun cria-configuracao-campos(\n\t\tinput true,\n\t\tinput "",\n\t\toutput ' + this.PREFIX_FIELDCOLLECTION + v.name + ').\n';
        })

        return result;
    }

    private buildCenarioSourceLoadInputData(method: MapMethod, dataInput: any, dataOutput: any, mapFile: MapFile, testCaseId: string): string {
        let tempTables: string[] = [];

        Object.keys(dataInput).forEach(item => {
            if (Array.isArray(dataInput[item]))
                tempTables.push(item.toLowerCase());
        });
        tempTables = tempTables.filter(function (value, index, self) {
            return self.indexOf(value) === index;
        });

        let result = '';
        tempTables.forEach(ttName => {
            let tcFile = this.assemblyTestDataFileName(ttName, testCaseId, 'input');
            result += '\ttemp-table ' + ttName + ':read-json("file", cFilePath + "' + tcFile + '").\n';
        });
        return result;
    }

    private buildCenarioSourceLoadOutputData(method: MapMethod, dataInput: any, dataOutput: any, mapFile: MapFile, testCaseId: string): string {
        let tempTables: string[] = [];

        Object.keys(dataOutput).forEach(item => {
            if (Array.isArray(dataOutput[item]))
                tempTables.push(item.toLowerCase());
        });
        tempTables = tempTables.filter(function (value, index, self) {
            return self.indexOf(value) === index;
        });

        let result = '';
        tempTables.forEach(ttName => {
            let tcFile = this.assemblyTestDataFileName(ttName, testCaseId, 'output');
            result += '\ttemp-table GPS_' + ttName + ':read-json("file", cFilePath + "' + tcFile + '").\n';
        });
        return result;
    }

    private buildCenarioSourceCallParams(method: MapMethod, dataInput: any, dataOutput: any, mapFile: MapFile, testCaseId: string): string {
        let result = '';
        method.params.forEach(param => {
            let line = '\t\t' + param.direction + ' ';
            if (result != '')
                result += ',\n';
            if (param.dataType == 'temp-table') {
                line += 'table ' + param.name;
            }
            else {
                line += param.name;
            }
            result += line;
        });
        return result;
    }

    private buildCenarioSourceCompareResults(method: MapMethod, dataInput: any, dataOutput: any, mapFile: MapFile, testCaseId: string): string {
        let result = '';
        let testValue;

        // adiciona comparação do error-status
        testValue = dataOutput['$error'];
        result += '\toAssert:' + (testValue === true ? 'true' : 'false') + '("error-status", lError).\n';
        // adiciona comparação do return value
        testValue = dataOutput['$return'];
        result += '\toAssert:equal("return-value", "' + testValue + '", cReturn).\n';

        // adiciona comparação de parametros de saida
        method.params.filter(item => item.direction != 'input').forEach(param => {
            if (param.dataType == 'temp-table') {
                result += '\toAssert:matchTable(temp-table GPS_' + param.name + ':default-buffer-handle, temp-table ' + param.name + ':default-buffer-handle, ' + this.PREFIX_FIELDCOLLECTION + param.name + ').\n';
            }
            else {
                let value = dataOutput[param.name];
                if (isString(value))
                    value = '"' + value + '"';
                result += '\toAssert:equal("' + param.name + '", ' + value + ', ' + param.name + ').\n';
            }
        });

        return result;
    }

    private buildCenarioSourceDeleteInstance(method: MapMethod, dataInput: any, dataOutput: any, mapFile: MapFile, testCaseId: string): string {
        let result = '';

        // controle de campos das temp-tables de saida
        let variables = method.params.filter(item => item.dataType == 'temp-table' && item.direction != 'input');
        variables.forEach(v => {
            result += '\t\tdelete object ' + this.PREFIX_FIELDCOLLECTION + v.name + '.\n';
        })

        return result;
    }

}
