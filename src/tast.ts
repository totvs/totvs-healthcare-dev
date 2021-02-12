import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ITastFileMap, MapFile, MapMethod } from './models';
import { getConfig } from './configFile';
import { changePath, mkdir } from './utils';
import { HealthcareOpenEdgeUtils } from './openEdgeUtils';

export class HealthcareTastExtension {

    private context: vscode.ExtensionContext;
    private readonly PREFIX_FIELDCOLLECTION = 'oFd';
    private readonly EXT_GETMAP = 'abl.getMap';
    private readonly EXT_CURRENT_GETMAP = 'abl.currentFile.getMap';
    private readonly THIS_EXTENSION = 'totvs-healthcare.totvs-healthcare-dev'
    private readonly MIN_VER_OPENEDGE = '1.0.3';
    private fileMapping: ITastFileMap[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.registerCommands();
        this.subscribeEvents();
    }

    private registerCommands() {
        this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.tast.bridge.show', () => { this.execShowBridge() }));
        this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.tast.bridge.method.clipboard', () => { this.execClipboardBridgeMethod() }));
        this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.tast.bridge.compile', () => { this.execGenerateBridge() }));
        this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.tast.cenario.compile', () => { this.execGenerateCenario() }));
        this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.tast.cenario.unit', () => { this.execGenerateUnitCenario() }));
    }

    private subscribeEvents() {
        vscode.workspace.textDocuments.forEach(document => this.onOpenDocument(document));

        vscode.workspace.onDidOpenTextDocument(document => this.onOpenDocument(document));
        vscode.workspace.onDidSaveTextDocument(document => this.onSaveDocument(document));
    }

    private templatePath(): string {
        return [vscode.extensions.getExtension(this.THIS_EXTENSION).extensionPath, 'resources', 'template', 'tast'].join('\\');
    }

    private onOpenDocument(document: vscode.TextDocument) {
        let config = getConfig();
        if ((config?.tast?.cenario?.autosuggest)&&(path.extname(document.fileName).toLowerCase() == '.p')) {
            let oeUtils = new HealthcareOpenEdgeUtils();
            if (oeUtils.hasMinimalOpenEdgeExtension(this.MIN_VER_OPENEDGE)) {
                this.insertDocumentMap(document);
            }
        }
    }

    private onSaveDocument(document: vscode.TextDocument) {
        let config = getConfig();
        if ((config?.tast?.cenario?.autosuggest)&&(path.extname(document.fileName).toLowerCase() == '.p')) {
            let oeUtils = new HealthcareOpenEdgeUtils();
            if (oeUtils.hasMinimalOpenEdgeExtension(this.MIN_VER_OPENEDGE)) {
                let item = this.fileMapping.find(f => f.fsPath == document.uri.fsPath);
                if (item?.mapFile) {
                    setTimeout(() => this.compareDocumentMethods(document), 2000);
                }
            }
        }
    }

    private insertDocumentMap(document: vscode.TextDocument) {
        if (!document.isUntitled) {
            let item = this.fileMapping.find(f => f.fsPath == document.uri.fsPath);
            if (!item) {
                item = { fsPath: document.uri.fsPath };
                this.fileMapping.push(item);
            }
            this.updateDocumentMap(document);
        }
    }

    private updateDocumentMap(document: vscode.TextDocument) {
        const item = this.fileMapping.find(f => f.fsPath == document.uri.fsPath);
        if (!item) {
            return;
        }
        let oeUtils = new HealthcareOpenEdgeUtils();
        let _getMap = this.EXT_GETMAP;
        if (oeUtils.hasMinimalOpenEdgeExtension(this.MIN_VER_OPENEDGE)) {
            setTimeout(() => vscode.commands.executeCommand(_getMap, document.uri.fsPath).then((data: MapFile) => item.mapFile = data), 2000);
        }
    }

    private compareDocumentMethods(document: vscode.TextDocument) {
        const item = this.fileMapping.find(f => f.fsPath == document.uri.fsPath);
        if (!item?.mapFile) {
            return;
        }
        let oeUtils = new HealthcareOpenEdgeUtils();
        let _getMap = this.EXT_GETMAP;
        if (oeUtils.hasMinimalOpenEdgeExtension(this.MIN_VER_OPENEDGE)) {
            vscode.commands.executeCommand(_getMap, document.uri.fsPath).then((data: MapFile) => {
                const oldMethods = item.mapFile.methods?.map(m => m.name.toLowerCase()) || [];
                const newMethods = data.methods?.map(m => m.name.toLowerCase()) || [];
                const dif = [];
                newMethods.forEach(name => {
                    if (!oldMethods.includes(name)) {
                        dif.push(name);
                    }
                });
                if (dif.length > 0) {
                    vscode.window.showInformationMessage('Deseja criar casos de teste para os novos métodos?', ...['Sim', 'Não']).then(result => {
                        if (result == 'Sim') {
                            const methods = data.methods.filter(m => dif.includes(m.name.toLowerCase()));
                            methods.forEach(m => this.createUnitCenario(m));
                            this.updateDocumentMap(document);
                        }
                    });
                }
            });
        }
    }

    private chooseMethod(): Promise<MapMethod> {
        let oeUtils = new HealthcareOpenEdgeUtils();

        if (oeUtils.hasOpenEdgeExtension(true)) {
            let _getMap = this.EXT_CURRENT_GETMAP;
            return new Promise(resolve =>  {
                vscode.commands.executeCommand(_getMap).then((data: MapFile) => {
                    try {
                        let methods = data.methods;
                        let list = methods.map(item => { return item.name }).sort(function (a, b) { return a.localeCompare(b) });
                        vscode.window.showQuickPick(list, { placeHolder: 'Escolha a função para interceptar dados' }).then(item => {
                            if ((item != null) && (item != ''))
                                resolve(methods.find(v => v.name == item));
                            else
                                resolve(null);
                        });
                    }
                    catch(e) {
                        resolve(null);
                    }
                });
            });
            
        }
        return Promise.resolve(null);
    }

    private getBridgeSource(): Promise<string> {
        return this.chooseMethod().then(method => {
            if (!method) {
                return null;
            }
            return this.createBridgeProgram(method);
        });
    }

    private execShowBridge() {
        this.getBridgeSource().then(data => {
            if (data) {
                vscode.workspace.openTextDocument({ content: data, language: 'abl' }).then(doc => vscode.window.showTextDocument(doc));
            }
        });
    }

    private execClipboardBridgeMethod() {
        return this.chooseMethod().then(method => {
            if (!method) {
                return;
            }
            let templatePath = this.templatePath();
            let dataAfter = fs.readFileSync([templatePath, 'bo-injection-after.p'].join('\\')).toString();
            dataAfter = this.parseBridgeTemplate(dataAfter, method);
            vscode.env.clipboard.writeText(dataAfter).then(() => vscode.window.showInformationMessage('Método copiado para seu clipboard!'));
        });
    }

    private execGenerateBridge() {
        let config = getConfig();
        let oeUtils = new HealthcareOpenEdgeUtils();

        if (oeUtils.hasOpenEdgeExtension(true)) {
            this.chooseMethod().then(method => {
                if (!method) {
                    return;
                }
                let data = this.createBridgeProgram(method);
                let wf = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);
                let tempDest = [wf.uri.fsPath, '.' + path.basename(vscode.window.activeTextEditor.document.uri.fsPath)].join('\\');
                let rcodeName = tempDest.substring(0, tempDest.lastIndexOf('.')) + '.r';
                fs.writeFileSync(tempDest, data);

                vscode.window.showInformationMessage('Compilando o programa...');
                let openEdgeUtils = new HealthcareOpenEdgeUtils();
                openEdgeUtils.compile(tempDest, config.tast.config).then(() => {
                    if (fs.existsSync(rcodeName)) {
                        let dest = changePath(vscode.window.activeTextEditor.document.uri.fsPath, (config.tast.bridge.path || config.tast.deploymentPath), wf);
                        dest = dest.substring(0, dest.lastIndexOf('.')) + '.r';
                        mkdir(path.dirname(dest));
                        fs.copyFileSync(rcodeName, dest);
                        vscode.window.showInformationMessage('Programa de interceptação gerado');
                    }
                    else {
                        vscode.window.showErrorMessage('Erro na compilação');
                        vscode.workspace.openTextDocument({content: data, language: 'abl'}).then(doc => vscode.window.showTextDocument(doc));
                    }
                    if (fs.existsSync(tempDest))
                        fs.unlinkSync(tempDest);
                    if (fs.existsSync(rcodeName))
                        fs.unlinkSync(rcodeName);
                });
            })
        }
    }

    private execGenerateCenario() {
        let config = getConfig();
        let oeUtils = new HealthcareOpenEdgeUtils();

        if (oeUtils.hasOpenEdgeExtension(true)) {
            // Busca todos os métodos do arquivo atual
            vscode.commands.executeCommand(this.EXT_CURRENT_GETMAP).then((data: MapFile) => {

                let files = fs.readdirSync(config.tast.cenario.input);
                let baseName = path.basename(vscode.window.activeTextEditor.document.uri.fsPath);
                files = files.filter(item => item.startsWith(baseName) && item.endsWith('.json'));

                vscode.window.showQuickPick(files.map(item => path.basename(item))).then(fName => {
                    let jsonName = [config.tast.cenario.input, fName].join('\\');
                    let strJson = fs.readFileSync(jsonName).toString();
                    let dataJson = JSON.parse(strJson);

                    let templatePath = this.templatePath();
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
    }

    private execGenerateUnitCenario() {
        this.chooseMethod().then(method => {
            if (method) {
                this.createUnitCenario(method);
            }
        });
    }

    private createUnitCenario(method: MapMethod) {
        if (!method) {
            return;
        }
        let templatePath = this.templatePath();
        let data = fs.readFileSync([templatePath, 'unit-test-case.p'].join('\\')).toString();
        return vscode.commands.executeCommand(this.EXT_CURRENT_GETMAP).then((mapFile: MapFile) => this.parseAnsSaveUnitCenarioTemplate(data, method, mapFile));
    }

    private createBridgeProgram(method: MapMethod): string {
        let templatePath = this.templatePath();
        let dataBefore = fs.readFileSync([templatePath, 'bo-injection-before.p'].join('\\')).toString();
        let dataAfter = fs.readFileSync([templatePath, 'bo-injection-after.p'].join('\\')).toString();
        let dataActive = vscode.window.activeTextEditor.document.getText();
        // renomeia a procedure original
        let reProc: RegExp = new RegExp('(?:proc[edure]*){1}[\\s\\t\\n]+(' + method.name + '){1}([\\s\\t\\n\\.\\:]+)', 'gim');
        dataActive = dataActive.replace(reProc, 'procedure GPS_$1$2');
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
            let line = '\t';
            if (param.dataType == 'temp-table') {
                line += `def ${param.direction} parameter table for ${param.name}`;
            }
            else if (param.dataType == 'buffer') {
                line += `def parameter buffer ${param.name} for ${param.additional}`;
            }
            else {
                line += `def ${param.direction} parameter ${param.name} ${param.asLike} ${param.dataType} ${param.additional || 'no-undo'}`;
            }
            result += line + '.\n';
        });
        return result;
    }

    private buildBridgeSourceCallParams(method: MapMethod): string {
        let result = '';
        method.params.forEach(param => {
            let line = '\t\t\t';
            if (result != '')
                result += ',\n';
            if (param.dataType == 'temp-table') {
                line += `${param.direction} table ${param.name}`;
            }
            else if (param.dataType == 'buffer') {
                line += `buffer ${param.name}`;
            }
            else {
                line += `${param.direction} ${param.name}`;
            }
            result += line;
        });
        return result;
    }

    private buildBridgeSourceJsonInputParams(method: MapMethod): string {
        let result = '';
        method.params.filter(param => param.direction == 'input' || param.direction == 'input-output').forEach(param => {
            // ignores extent
            if ((param.additional || '').toLowerCase().includes('extent')) {
                return;
            }

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
            // ignores extent
            if ((param.additional || '').toLowerCase().includes('extent')) {
                return;
            }
            
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
        let templateIncludes = this.buildCenarioSourceIncludes(inputData, outputData, mapFile);
        let templateTempDefinition = this.buildCenarioSourceTempDefinition(outputData);
        let templateVarDefinition = this.buildCenarioSourceVariableDefinition(method, true);
        let templateVarAssign = this.buildCenarioSourceVariableAssign(method, inputData);
        let templateVarInstance = this.buildCenarioSourceVariableInstance(method);
        let templateLoadInputData = this.buildCenarioSourceLoadInputData(inputData, testCaseId);
        let templateLoadOutputData = this.buildCenarioSourceLoadOutputData(outputData, testCaseId);
        let templateCallParams = this.buildCenarioSourceCallParams(method);
        let templateCompareResults = this.buildCenarioSourceCompareResults(method, outputData, true);
        let templateDeleteInstance = this.buildCenarioSourceDeleteInstance(method);
        let templateSetFilePath = this.buildCenarioSetFilePath();
        let templateAssertSpool = this.buildCenarioSetAssertSpool(testCaseId);

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
            .replace(/\[@deleteInstance\]/g, templateDeleteInstance)
            .replace(/\[@setFilePath\]/g, templateSetFilePath)
            .replace(/\[@setAssertSpool\]/g, templateAssertSpool);
        
        let newFile = [config.tast.cenario.output,this.assemblyTestCaseFileName(testCaseId)+'.p'].join('\\');
        fs.writeFileSync(newFile, source);

        // armazena dados das temp-tables utilizadas
        let fileOutput = config.tast.cenario.output;
        if (config.tast.cenario.dataFiles)
            fileOutput = config.tast.cenario.dataFiles.output;
        Object.keys(inputData).filter(item => Array.isArray(inputData[item])).forEach(item => {
            let dataTt: Object = inputData[item];
            let fn = this.assemblyTestDataFileName(item.toLowerCase(), testCaseId, 'input');
            fs.writeFileSync([fileOutput,fn].join('\\'), JSON.stringify(dataTt));
        });
        Object.keys(outputData).filter(item => Array.isArray(outputData[item])).forEach(item => {
            let dataTt: Object = outputData[item];
            let fn = this.assemblyTestDataFileName(item.toLowerCase(), testCaseId, 'output');
            fs.writeFileSync([fileOutput,fn].join('\\'), JSON.stringify(dataTt));
        });

        return newFile;
    }

    private parseAnsSaveUnitCenarioTemplate(source: string, method: MapMethod, mapFile: MapFile) {
        let wf = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri);

        let config = getConfig();
        let programName = path.basename(vscode.window.activeTextEditor.document.uri.fsPath, '.p');
        let programPath = path.dirname(vscode.window.activeTextEditor.document.uri.fsPath.replace(wf.uri.fsPath + '\\', '').replace(/\\/g, '/'));
        let procedureName = method.name;
        let testCaseId = this.getNextFileName(`CT_${programName}_${procedureName}`, config?.tast?.cenario?.output, '.p');

        let inputData: any = {};
        let outputData: any = { $error: false, $return: '' };
        method.params
            .filter(p => p.direction == 'input' || p.direction == 'input-output')
            .filter(p => p.dataType != 'temp-table' && p.dataType != 'buffer')
            .forEach(p => { inputData[p.name] = null });
        method.params
            .filter(p => p.direction == 'output' || p.direction == 'input-output')
            .filter(p => p.dataType != 'temp-table' && p.dataType != 'buffer')
            .forEach(p => { outputData[p.name] = null });

        let templateIncludes = this.buildUnitCenarioSourceIncludes(method, mapFile);
        let templateVarDefinition = this.buildCenarioSourceVariableDefinition(method);
        let templateVarAssign = this.buildCenarioSourceVariableAssign(method, inputData);
        let templateCallParams = this.buildCenarioSourceCallParams(method);
        let templateCompareResults = this.buildCenarioSourceCompareResults(method, outputData);
        let templateAssertSpool = this.buildCenarioSetAssertSpool(testCaseId);

        source = source
            .replace(/\[@programName\]/g, programName)
            .replace(/\[@programPath\]/g, programPath)
            .replace(/\[@procedureName\]/g, procedureName)
            .replace(/\[@testId\]/g, testCaseId)
            .replace(/\[@testFile\]/g, this.assemblyTestCaseFileName(testCaseId)+'.p')
            .replace(/\[@date\]/g, (new Date()).toLocaleDateString())
            .replace(/\[@includes\]/g, templateIncludes)
            .replace(/\[@variableDefinition\]/g, templateVarDefinition)
            .replace(/\[@variableAssign\]/g, templateVarAssign)
            .replace(/\[@addCallParams\]/g, templateCallParams)
            .replace(/\[@addCompareResults\]/g, templateCompareResults)
            .replace(/\[@setAssertSpool\]/g, templateAssertSpool);
        this.saveUnitCenarioTemplate(source, testCaseId);
    }

    private saveUnitCenarioTemplate(source: string, testCaseId: string) {
        let config = getConfig();

        if (config?.tast?.cenario?.output) {
            let newFile = [config.tast.cenario.output,this.assemblyTestCaseFileName(testCaseId)+'.p'].join('\\');
            fs.writeFileSync(newFile, source);
            vscode.workspace.openTextDocument(newFile).then(doc => vscode.window.showTextDocument(doc, { preview: false }));
        }
        else {
            vscode.workspace.openTextDocument({ content: source, language: 'abl' }).then(doc => vscode.window.showTextDocument(doc));
        }
    }

    private getNextFileName(filename: string, path: string, ext: string, variation?: number): string {
        if (!path) {
            return filename;
        }
        let newFilename = filename;
        if (variation) {
            newFilename += `_${variation}`;
        }
        const newFile = [path,newFilename].join('\\') + ext;
        if (!fs.existsSync(newFile)) {
            return newFilename;
        }
        else {
            return this.getNextFileName(filename, path, ext, (variation ? ++variation : 1));
        }
    }

    private assemblyTestCaseFileName(testId: string): string {
        return testId;
    }

    private assemblyTestDataFileName(name: string, testId: string, dataType: 'input' | 'output'): string {
        return this.assemblyTestCaseFileName(testId) + '.' + name + '.' + dataType + '.json';
    }

    private buildCenarioSourceIncludes(dataInput: any, dataOutput: any, mapFile: MapFile): string {
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

    private buildUnitCenarioSourceIncludes(method: MapMethod, mapFile: MapFile): string {
        let includes: string[] = [];
        let tempTables = method.params.filter(p => p.dataType == 'temp-table');

        tempTables.forEach(tempTable => {
            let ttName = tempTable.name.toLowerCase();
            let tt = mapFile.tempTables.find(item => item.label.toLowerCase() == ttName);
            if (!tt) {
                let include = mapFile.includes.find(incFile => {
                    let incTt;
                    if (incFile.map)
                        incTt = incFile.map.tempTables.find(item => item.label.toLowerCase() == ttName);
                    return (incTt != null);
                });
                if (include) {
                    includes.push(include.name);
                }
            }
        });

        let result = '';
        includes = includes.filter(function (value, index, self) {
            return self.indexOf(value) === index;
        });
        includes.forEach(item => { result += '{' + item + '}\n'; });
        return result;
    }

    private buildCenarioSourceTempDefinition(dataOutput: any): string {
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

    private buildCenarioSourceVariableDefinition(method: MapMethod, tempTableComparison?: boolean): string {
        let result = '';
        // variaveis
        let variables = method.params.filter(item => item.dataType != 'temp-table' && item.dataType != 'buffer');
        variables.forEach(v => { result += `\tdef var ${v.name} ${v.asLike} ${v.dataType} ${v.additional || 'no-undo'}.\n`; })
        // controle de campos das temp-tables de saida
        if (tempTableComparison) {
            variables = method.params.filter(item => item.dataType == 'temp-table' && item.direction != 'input');
            variables.forEach(v => {
                result += '\tdef var ' + this.PREFIX_FIELDCOLLECTION + v.name + ' as AssertFieldCollection no-undo.\n';
            });
        }

        return result;
    }

    private buildCenarioSourceVariableAssign(method: MapMethod, dataInput: any): string {
        let result = '';

        // variaveis
        let variables = method.params.filter(item => item.dataType != 'temp-table' && item.dataType != 'buffer' && item.direction != 'output');
        variables.forEach(v => {
            let value = dataInput[v.name];
            if (value === null || value === undefined) {
                value = '?';
            }
            else if (typeof value === 'string') {
                value = '"' + value + '"';
            }
            result += '\t\t' + v.name + ' = ' + value + '\n';
        })

        return result;
    }

    private buildCenarioSourceVariableInstance(method: MapMethod): string {
        let result = '';

        // controle de campos das temp-tables de saida
        let variables = method.params.filter(item => item.dataType == 'temp-table' && item.direction != 'input');
        variables.forEach(v => {
            result += '\t// lista de campos a adicionar/ignorar para na comparacao da ' + v.name + '\n\trun cria-configuracao-campos(\n\t\tinput true,\n\t\tinput "",\n\t\toutput ' + this.PREFIX_FIELDCOLLECTION + v.name + ').\n';
        })

        return result;
    }

    private buildCenarioSourceLoadInputData(dataInput: any, testCaseId: string): string {
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

    private buildCenarioSourceLoadOutputData(dataOutput: any, testCaseId: string): string {
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

    private buildCenarioSourceCallParams(method: MapMethod): string {
        let result = '';
        method.params.forEach(param => {
            let line = '\t\t\t';
            if (result != '')
                result += ',\n';
            if (param.dataType == 'temp-table') {
                line += `${param.direction} table ${param.name}`;
            }
            else if (param.dataType == 'buffer') {
                line += `buffer ${param.additional}`;
            }
            else {
                line += `${param.direction} ${param.name}`;
            }
            result += line;
        });
        return result;
    }

    private buildCenarioSourceCompareResults(method: MapMethod, dataOutput: any, tempTableComparison?: boolean): string {
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
                if (tempTableComparison) {
                    result += '\toAssert:matchTable(temp-table GPS_' + param.name + ':default-buffer-handle, temp-table ' + param.name + ':default-buffer-handle, ' + this.PREFIX_FIELDCOLLECTION + param.name + ').\n';
                }
            }
            else if (param.dataType != 'buffer') {
                let value = dataOutput[param.name];
                if (value === null || value === undefined) {
                    value = '?';
                }
                else if (typeof value === 'string') {
                    value = '"' + value + '"';
                }
                result += '\toAssert:equal("' + param.name + '", ' + value + ', ' + param.name + ').\n';
            }
        });

        return result;
    }

    private buildCenarioSourceDeleteInstance(method: MapMethod): string {
        let result = '';

        // controle de campos das temp-tables de saida
        let variables = method.params.filter(item => item.dataType == 'temp-table' && item.direction != 'input');
        variables.forEach(v => {
            result += '\t\tdelete object ' + this.PREFIX_FIELDCOLLECTION + v.name + '.\n';
        })

        return result;
    }

    private buildCenarioSetFilePath(): string {
        let result = '';
        let config = getConfig();

        if (config.tast.cenario.dataFiles)
            result = `\tfile-info:file-name = "${config.tast.cenario.dataFiles.relativePath}".\n`
                   + `\tassign cFilePath = replace(file-info:full-pathname, "~\\", "/")\n`
                   + `\t       cFilePath = cFilePath + "/".\n`;
        else
            result = `\tfile-info:file-name = program-name(1).\n`
                   + `\tassign cFilePath = replace(file-info:full-pathname, "~\\", "/")\n`
                   + `\t       cFilePath = substring(cFilePath, 1, r-index(cFilePath, "/")).\n`;

        return result;
    }

    private buildCenarioSetAssertSpool(testCaseId: string): string {
        let result = '';
        let config = getConfig();
        let programName = this.assemblyTestCaseFileName(testCaseId);

        if (config.tast.cenario.spool)
            result = `\tassign oAssert:spoolDirectory = "${config.tast.cenario.spool}"\n`
                   + `\t       oAssert:spoolFileName  = "${programName}".\n`;
        else
            result = ``;

        return result;
    }

}
