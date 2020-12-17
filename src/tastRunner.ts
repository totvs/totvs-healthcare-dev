import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { outputChannel } from './notification';
import { isNullOrUndefined } from 'util';
import { TastRunnerConfig, getConfig, TastConfig } from './configFile';
import { HealthcareOpenEdgeUtils } from './openEdgeUtils';
import { changePath, mkdir } from './utils';

interface TestCaseResult {
    testCase: string;
    status: string;
    message: string;
}

interface TestCaseQueue {
    CASENAME: string;
    done: boolean;
    data?: TestCaseData;
    result?: TestCaseResult;
    passed?: boolean;
}

interface TestCaseData {
    id: number;
    status?: string;
    propathCase?: string;
}

export class HealthcareTastRunnerExtension {

    private context: vscode.ExtensionContext;

    private inExecution: { RUN: boolean };
    private abortExecution: { RUN: boolean };
    private runnerConfig: TastRunnerConfig;
    public sessionCookies: string[] = [];

    private readonly ELASTIC_SEARCH_PATH = '/_search';
    private readonly TOTVS_LOGIN_PATH = '/dts/datasul-rest/resources/login?username=super&password=hFG6ihTXl1PTTLM7UbpGtLAl64E%3D';
    private readonly TOTVS_JOSSO_PATH = '/josso/signon/login.do';
    private readonly TOTVS_API_PATH = '/dts/datasul-rest/resources/prg/htast/v1/api-tast/';
    private readonly TOTVS_API_QUERYPARAM = 'search={CASENAME}.r';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.inExecution = { RUN: false };
        this.abortExecution = { RUN: false };
        this.registerCommands();
    }

    private registerCommands() {
        this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.tast.run', () => { this.executeRunner() }));
    }

    private getRunnerConfig(): TastRunnerConfig {
        let _cfg = getConfig();
        let _tast: TastConfig;
        let _run: TastRunnerConfig;
        if (!isNullOrUndefined(_cfg.tast))
            _tast = _cfg.tast;
        else
            _tast = {};
        if (!isNullOrUndefined(_tast.run))
            _run = _tast.run;
        else
            _run = {};
        return _run;
    }

    private executeRunner() {
        // se o comando esta sendo executado novamente, ativa flag para abortar o processo
        if (this.inExecution.RUN) {
            this.abortExecution.RUN = true;
            outputChannel.appendLine('\nAbortando o processo...\n');
            return;
        }

        this.runnerConfig = this.getRunnerConfig();
        if (isNullOrUndefined(this.runnerConfig.elasticsearch) || isNullOrUndefined(this.runnerConfig.totvs)) {
            vscode.window.showErrorMessage('É necessário configurar o ambiente para rodar os testes');
            return;
        }

        let document = (vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document : null);
        if (document) {
            this.abortExecution.RUN = false;
            this.inExecution.RUN = true;

            outputChannel.clear();
            outputChannel.appendLine('TAST - Execução');
            outputChannel.appendLine('---------------\n');

            let wf = vscode.workspace.getWorkspaceFolder(document.uri);
            let workspaceDir = wf.uri.fsPath + '\\';
            let programName = document.uri.fsPath;
            if (!programName.startsWith(workspaceDir)) {
                vscode.window.showWarningMessage('Somente programas do workspace podem ser testados');
                outputChannel.appendLine('Somente programas do workspace podem ser testados');
                this.inExecution.RUN = false;
                return;
            }

            vscode.window.showInformationMessage('Rodando casos de teste...');
            outputChannel.show(true);

            this.runTests(programName, wf);
        }
    }

    private runTests(programName: string, wf: vscode.WorkspaceFolder) {
        let workspaceDir = wf.uri.fsPath + '\\';
        let relativeName = programName.replace(workspaceDir, '').replace(/\\/g, '/');

        outputChannel.appendLine('Iniciando execução dos casos de teste\n');
        this.requestLogin().then(ok => {
            if (ok !== true) {
                vscode.window.showInformationMessage('Erro ao conectar no ambiente do TAST')
                outputChannel.appendLine('Erro ao conectar no ambiente do TAST');
                this.inExecution.RUN = false;
                return;
            }

            this.searchTestCases(relativeName).then(cases => {
                if (isNullOrUndefined(cases)) {
                    // gerou erro na consulta
                    vscode.window.showInformationMessage('Erro ao consultar casos de teste')
                    outputChannel.appendLine('Erro ao consultar casos de teste');
                    this.inExecution.RUN = false;
                    return;
                }
                if (cases.length == 0) {
                    vscode.window.showInformationMessage('Nenhum caso de teste associado')
                    outputChannel.hide();
                    this.inExecution.RUN = false;
                    return;
                }

                this.compileProgram(programName, wf,
                    () => { this.runTestCases(cases); },
                    () => { this.inExecution.RUN = false; });
            });
        }).catch(() => this.inExecution.RUN = false);

    }

    private compileProgram(programName: string, wf: vscode.WorkspaceFolder, onSuccess: Function, onError: Function) {
        let config = getConfig();
        if ((!isNullOrUndefined(config.tast.deploymentPath))&&(config.tast.run.compile !== false)) {
            let workspaceDir = wf.uri.fsPath + '\\';
            let relativeName = programName.replace(workspaceDir, '').replace(/\\/g, '/');

            outputChannel.appendLine(`\nCompilando programa ${relativeName}...`);

            let tempDest = [wf.uri.fsPath, '.' + path.basename(programName)].join('\\');
            let rcodeName = tempDest.substring(0, tempDest.lastIndexOf('.')) + '.r';
            try {
                if (fs.existsSync(tempDest))
                    fs.unlinkSync(tempDest);
                if (fs.existsSync(rcodeName))
                    fs.unlinkSync(rcodeName);
                fs.copyFileSync(programName, tempDest);
            }
            catch (e) {
                vscode.window.showErrorMessage('Erro ap copiar programa!');
                outputChannel.appendLine(`Erro ao copiar programa para área temporária!\nDestino: ${tempDest}`);
                onError();
            }

            let oeUtils = new HealthcareOpenEdgeUtils();
            oeUtils.compile(tempDest, config.tast.config).then(() => {
                if (fs.existsSync(rcodeName)) {
                    let dest = changePath(programName, config.tast.deploymentPath, wf);
                    dest = dest.substring(0, dest.lastIndexOf('.')) + '.r';
                    mkdir(path.dirname(dest));
                    fs.copyFileSync(rcodeName, dest);
                    outputChannel.appendLine(`Copiado para ${dest}\n`);
                    onSuccess();
                }
                else {
                    vscode.window.showWarningMessage('Erro na compilação do programa');
                    outputChannel.appendLine('Erro na compilação do programa');
                    onError();
                }
                if (fs.existsSync(tempDest))
                    fs.unlinkSync(tempDest);
                if (fs.existsSync(rcodeName))
                    fs.unlinkSync(rcodeName);
            });
        }
        else {
            outputChannel.appendLine('Testes serão executados sem compilar o programa atual\n');
            onSuccess();
        }
    }

    private requestLogin(): Promise<boolean> {
        this.runnerConfig = this.getRunnerConfig();

        this.sessionCookies = [];

        let result = false;
        let promises = [];

        let pTotvs = this.requestTotvsLogin().then(totvsCookies => {
            if (!isNullOrUndefined(totvsCookies))
                this.sessionCookies = [...this.sessionCookies, ...totvsCookies];
        });
        promises.push(pTotvs);

        let pJosso = pTotvs.then(() => this.requestJossoLogin().then(jossoCookies => {
            if (!isNullOrUndefined(jossoCookies)) {
                this.sessionCookies = [...this.sessionCookies, ...jossoCookies];
                result = true;
            }
        }));
        promises.push(pJosso);

        return Promise.all(promises).then(() => result);
    }

    private requestTotvsLogin(): Promise<string[]> {
        const getOptions = {
            hostname: this.runnerConfig.totvs.host,
            port: this.runnerConfig.totvs.port,
            path: this.TOTVS_LOGIN_PATH,
            method: 'GET',
            timeout: 2500
        };
        return new Promise(resolve => {
            const getRequest = http.request(getOptions, (res) => {
                let timeoutControl = setTimeout(() => {
                    if (!isNullOrUndefined(res.socket)) {
                        outputChannel.appendLine(`Timeout ao tentar login no TOTVS`);
                        res.socket.destroy();
                    }
                    res.emit('error');
                }, getOptions.timeout);

                let resultData: string[];

                res.on('data', () => {
                    clearTimeout(timeoutControl);
                    if (!isNullOrUndefined(res.headers['set-cookie']))
                        resultData = res.headers['set-cookie'];
                })
                    .on('error', () => {
                        clearTimeout(timeoutControl);
                        resolve();
                    })
                    .on('end', () => {
                        clearTimeout(timeoutControl);
                        if (isNullOrUndefined(resultData))
                            resolve();
                        else
                            resolve(resultData)
                    });
            });

            getRequest.end();
        });
    }

    private requestJossoLogin(): Promise<string[]> {
        const getOptions = {
            hostname: this.runnerConfig.totvs.host,
            port: this.runnerConfig.totvs.port,
            path: this.TOTVS_JOSSO_PATH,
            method: 'GET',
            timeout: 2500,
            headers: {
                'Cookie': this.sessionCookies.join('; ')
            }
        };
        return new Promise(resolve => {
            const getRequest = http.request(getOptions, (res) => {
                let timeoutControl = setTimeout(() => {
                    if (!isNullOrUndefined(res.socket)) {
                        outputChannel.appendLine(`Timeout ao tentar login no JOSSO`);
                        res.socket.destroy();
                    }
                    res.emit('error');
                }, getOptions.timeout);

                let resultData: string[];

                res.on('data', () => {
                    clearTimeout(timeoutControl);
                    if (!isNullOrUndefined(res.headers['set-cookie']))
                        resultData = res.headers['set-cookie'];
                })
                    .on('error', () => {
                        clearTimeout(timeoutControl);
                        resolve();
                    })
                    .on('end', () => {
                        clearTimeout(timeoutControl);
                        if (isNullOrUndefined(resultData))
                            resolve();
                        else
                            resolve(resultData)
                    });
            });

            getRequest.end();
        });
    }

    private searchTestCases(programName: string): Promise<string[]> {
        const postOptions = {
            hostname: this.runnerConfig.elasticsearch.host,
            port: this.runnerConfig.elasticsearch.port,
            path: this.ELASTIC_SEARCH_PATH,
            method: 'POST',
            timeout: 5000,
            headers: null
        };
        const jsonData = {
            "size": 0,
            "query": {
                "bool": {
                    "filter": [
                        {
                            "bool": {
                                "should": [
                                    {
                                        "match_phrase": {
                                            "CHAMADA.keyword": programName
                                        }
                                    }
                                ],
                                "minimum_should_match": 1
                            }
                        },
                        {
                            "bool": {
                                "should": [
                                    {
                                        "match_phrase": {
                                            "FUNC.keyword": "Run"
                                        }
                                    }
                                ],
                                "minimum_should_match": 1
                            }
                        }
                    ]
                }
            },
            "aggs": {
                "CASENAME": {
                    "terms": {
                        "field": "CASENAME.keyword",
                        "size": (this.runnerConfig.elasticsearch.maxResults || 100)
                    }
                }
            }
        };

        return new Promise(resolve => {
            const postData = JSON.stringify(jsonData);
            postOptions.headers = {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            };

            outputChannel.appendLine('Consultando casos de teste...');

            const postRequest = http.request(postOptions, (res) => {
                let timeoutControl = setTimeout(() => {
                    if (!isNullOrUndefined(res.socket)) {
                        outputChannel.appendLine(`Timeout ao buscar casos de teste associados`);
                        res.socket.destroy();
                    }
                    res.emit('error');
                }, postOptions.timeout);

                let resultData = '';

                res.on('data', (dataBuffer: Buffer) => {
                    clearTimeout(timeoutControl);
                    if (res.statusCode == 200) {
                        resultData += dataBuffer.toString();
                    }
                })
                .on('error', () => {
                    clearTimeout(timeoutControl);
                    resolve();
                })
                .on('end', () => {
                    clearTimeout(timeoutControl);
                    try {
                        let dataObj = JSON.parse(resultData.toString());
                        let items = dataObj.aggregations.CASENAME.buckets.map(item => item.key);
                        outputChannel.appendLine(`Encontrado(s) ${items.length} caso(s) de teste`);
                        resolve(items);
                    }
                    catch (e) {
                        outputChannel.appendLine(`Erro no retorno da consulta!\nRetorno:\n${resultData}`);
                        resolve()
                    }
                });
            });

            postRequest.write(postData);
            postRequest.end();
        });
    }

    public runTestCases(cases: string[]) {
        let results: TestCaseQueue[] = [];

        cases.forEach(async item => {
            let result: TestCaseQueue = { CASENAME: item, passed: false, done: false };
            results.push(result);
        });

        let fncFinish = () => {
            let success = results.filter(item => item.passed);
            let failed = results.filter(item => !item.passed);

            outputChannel.appendLine('\nSucesso:');
            success.forEach(item => outputChannel.appendLine(`${item.CASENAME}`));
            outputChannel.appendLine('\nErro:');
            failed.forEach(item => outputChannel.appendLine(`${item.CASENAME}\n\t** ${item.result ? item.result.message : 'Não executado'}`));
            outputChannel.appendLine('\nFim dos testes');

            if (failed.length > 0) {
                if (success.length > 0)
                    vscode.window.showWarningMessage('Alguns casos de teste resultaram em erro');
                else
                    vscode.window.showErrorMessage('Todos casos de teste resultaram em erro');
            }
            else {
                vscode.window.showInformationMessage('Todos casos de teste rodaram com sucesso!');
                outputChannel.hide();
            }

            this.inExecution.RUN = false;

            if (this.runnerConfig.showResults === true)
                this.openResultDocument(results);
        }

        if(this.sessionCookies.length == 0){
            this.requestLogin().then(() => {
                this.runNext(results, fncFinish);
            });
        } else {
            this.runNext(results, fncFinish);
        }

        
    }

    private runNext(results: TestCaseQueue[], onFinish?: Function) {
        if (this.abortExecution.RUN) {
            this.inExecution.RUN = false;
            outputChannel.appendLine('Execução abortada!');
            return;
        }

        let result = results.find(item => !item.done);

        if (!isNullOrUndefined(result)) {
            if (isNullOrUndefined(result.data)) {
                // ainda nao tem os dados do caso de teste
                this.getTestCase(result.CASENAME)
                    .then(getTestCaseResult => {
                        let tcData;
                        if (!isNullOrUndefined(getTestCaseResult) && !isNullOrUndefined(getTestCaseResult.items)) {
                            tcData = getTestCaseResult.items.find(item => item.caseName.toLowerCase() == (result.CASENAME.toLowerCase() + '.r'));
                        }
                        if (!isNullOrUndefined(tcData))
                            result.data = tcData;
                        else
                            result.done = true;
                        this.runNext(results, onFinish);
                    })
                    .catch(() => {
                        result.done = true;
                        this.runNext(results, onFinish);
                    });
            }
            else {
                // ja tem os dados, entao roda o caso de teste
                this.runTestCase(result)
                    .then(runTestCaseResult => {
                        if (!isNullOrUndefined(runTestCaseResult) && !isNullOrUndefined(runTestCaseResult.items) && (runTestCaseResult.items.length == 1)) {
                            let tcResult = runTestCaseResult.items[0];
                            result.result = tcResult;
                            result.passed = (tcResult.status == 'passed');
                            result.done = true;
                        }
                        else {
                            result.done = true;
                        }
                        this.runNext(results, onFinish);
                    })
                    .catch(() => {
                        result.done = true;
                        this.runNext(results, onFinish);
                    });
            }
        }
        else {
            // nenhum teste pendente
            if (!isNullOrUndefined(onFinish))
                onFinish(results);
        }
    }

    private getTestCase(caseName: string): Promise<any> {
        this.runnerConfig = this.getRunnerConfig();        

        const getOptions = {
            hostname: this.runnerConfig.totvs.host,
            port: this.runnerConfig.totvs.port,
            path: this.TOTVS_API_PATH + '?' + this.TOTVS_API_QUERYPARAM.replace('{CASENAME}', encodeURIComponent(caseName)),
            method: 'GET',
            timeout: 3500,
            headers: {
                'Cookie': this.sessionCookies.join('; ')
            }
        };

        return new Promise(resolve => {
            outputChannel.appendLine(`Consultando dados de ${caseName}...`);
            const getRequest = http.request(getOptions, (res) => {
                let timeoutControl = setTimeout(() => {
                    if (!isNullOrUndefined(res.socket)) {
                        res.socket.destroy();
                    }
                    res.emit('error');
                }, getOptions.timeout);

                let resultData;

                res.on('data', (dataBuffer: Buffer) => {
                    clearTimeout(timeoutControl);
                    if (res.statusCode == 200) {
                        outputChannel.appendLine(`${caseName} pronto para ser executado`);
                        resultData = JSON.parse(dataBuffer.toString());
                    }
                    else {
                        outputChannel.appendLine(`Erro ao consultar dados de ${caseName} (status ${res.statusCode})`);
                    }
                })
                    .on('error', () => {
                        clearTimeout(timeoutControl);
                        outputChannel.appendLine(`Erro ao consultar dados de ${caseName}`);
                        resolve();
                    })
                    .on('end', () => {
                        clearTimeout(timeoutControl);
                        resolve(resultData);
                    });
            });

            getRequest.end();
        });
    }

    public runTestCase(testCase: TestCaseQueue): Promise<any> {
        return new Promise(resolve => {            

            let jsonData = {};
            if(!testCase.CASENAME){
                jsonData = {
                    tmpCaseTest: [{                                                
                        'propathCase': 'financas\\test\\',
                        'caseName': ''                        
                    }]
                };
            } else {
                jsonData = {
                    tmpCaseTest: [{
                        'caseName': testCase.data['caseName'],
                        'log-executa-rpw': testCase.data['log-executa-rpw'],
                        'propathCase': testCase.data['propathCase'],
                        'id': testCase.data['id']
                    }]
                };
            }
            
            const postData = JSON.stringify(jsonData);
            const postOptions = {
                hostname: 'cxs-tast',
                port: 8380,
                path: `/dts/datasul-rest/resources/prg/htast/v1/api-tast/`,
                method: 'POST',
                timeout: 10000,
                headers: {
                    'Cookie': this.sessionCookies.join('; '),
                    'Content-Type': 'application/json',
                    'Server': 'Apache-Coyote/1.1',
                    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0',
                    'Content-Length': postData.length
                }
            }

            outputChannel.appendLine(`Executando ${testCase.CASENAME}...`);
            const postRequest = http.request(postOptions, (res) => {
                let timeoutControl = setTimeout(() => {
                    if (!isNullOrUndefined(res.socket)) {
                        res.socket.destroy();
                    }
                    res.emit('error');
                }, postOptions.timeout);

                let resultData;

                res.on('data', (dataBuffer: Buffer) => {
                    clearTimeout(timeoutControl);
                    if (res.statusCode == 200) {
                        outputChannel.appendLine(`> Finalizado teste ${testCase.CASENAME}`);
                        resultData = JSON.parse(dataBuffer.toString());
                    }
                    else {
                        resultData = JSON.parse(dataBuffer.toString());
                        outputChannel.appendLine(`> Erro ao executar teste ${testCase.CASENAME} (status ${res.statusCode})`);
                    }
                })
                    .on('error', () => {
                        clearTimeout(timeoutControl);
                        outputChannel.appendLine(`> Erro ao executar teste ${testCase.CASENAME}`);
                        resolve();
                    })
                    .on('end', () => {
                        clearTimeout(timeoutControl);
                        resolve(resultData);
                    });
            });

            postRequest.write(postData);
            postRequest.end();
        });
    }

    private openResultDocument(results: TestCaseQueue[]) {
        vscode.workspace.openTextDocument({ content: JSON.stringify(results), language: 'json' }).then(doc => {
            vscode.window.showTextDocument(doc);
            //vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', doc.uri);
        });
    }

}
