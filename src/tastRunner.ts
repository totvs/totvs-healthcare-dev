import * as vscode from 'vscode';
import * as http from 'http';
import { outputChannel } from './notification';
import { isNullOrUndefined } from 'util';
import { TastRunnerConfig, getConfig, TastConfig } from './configFile';

interface TestCaseResult {
    testCase:string;
    status:string;
    message:string;
}

interface TestCaseQueue {
    CASENAME:string;
    done:boolean;
    data?:TestCaseData;
    result?:TestCaseResult;
    passed?:boolean;
}

interface TestCaseData {
    id:number;
    status?:string;
}

export class HealthcareTastRunnerExtension {

    private context: vscode.ExtensionContext;

    private inExecution: { RUN: boolean };
    private abortExecution: { RUN: boolean };
    private config: TastRunnerConfig;
    private sessionCookie = [];

    private readonly API_QUERY_SEARCH = 'search={CASENAME}.r';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.inExecution = { RUN: false };
        this.abortExecution = { RUN: false };
        this.registerCommands();
    }

    private registerCommands() {
        this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.tast.run', () => { this.runTests() }));
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

    private runTests() {
        // se o comando esta sendo executado novamente, ativa flag para abortar o processo
        if (this.inExecution.RUN) {
            this.abortExecution.RUN = true;
            outputChannel.appendLine('\nAbortando o processo...\n');
            return;
        }

        this.config = this.getRunnerConfig();
        if (isNullOrUndefined(this.config.elasticsearch) || isNullOrUndefined(this.config.totvs)) {
            vscode.window.showErrorMessage('É necessário configurar o ambiente para rodar os testes');
            return;
        }

        this.abortExecution.RUN = false;
        this.inExecution.RUN = true;

        outputChannel.clear();
        outputChannel.appendLine('Iniciando casos de teste\n');
        let document = (vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document : null);
        if (document) {
            let workspaceDir = vscode.workspace.getWorkspaceFolder(document.uri).uri.fsPath + '\\';
            let programName = document.uri.fsPath;
            if (!programName.startsWith(workspaceDir)) {
                vscode.window.showWarningMessage('Somente programas do workspace podem ser testados');
                outputChannel.appendLine('Somente programas do workspace podem ser testados');
                this.inExecution.RUN = false;
                return;
            }
            let relativeName = programName.replace(workspaceDir, '').replace(/\\/g, '/');

            vscode.window.showInformationMessage('Rodando casos de teste...');
            outputChannel.show(true);

            this.requestTastLogin().then(loginCookie => {
                if (isNullOrUndefined(loginCookie)) {
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
                        outputChannel.appendLine('Nenhum caso de teste associado');
                        this.inExecution.RUN = false;
                        return;
                    }

                    this.runTestCases(loginCookie, cases);
                });
            }).catch(() => this.inExecution.RUN = false);
        }
    }

    private requestTastLogin(): Promise<string> {
        const getOptions = {
            hostname: this.config.totvs.host,
            port: this.config.totvs.port,
            path: this.config.totvs.loginPath,
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

                let resultData;

                res.on('data', () => {
                    clearTimeout(timeoutControl);
                    if (!isNullOrUndefined(res.headers['set-cookie']))
                        resultData = res.headers['set-cookie'].join('; ');
                })
                .on('error', () => {
                    clearTimeout(timeoutControl);
                    resolve();
                })
                .on('end', () => { 
                    clearTimeout(timeoutControl);
                    resolve(resultData);
                });
            });
            
            getRequest.setTimeout(2500);
            getRequest.end();
        });
    }

    private searchTestCases(programName:string): Promise<string[]> {
        const postOptions = {
            hostname: this.config.elasticsearch.host,
            port: this.config.elasticsearch.port,
            path: this.config.elasticsearch.searchPath,
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
                        "size": (this.config.elasticsearch.maxResults || 100)
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

                let resultData;

                res.on('data', (dataBuffer: Buffer) => {
                    clearTimeout(timeoutControl);
                    if (res.statusCode == 200) {
                        let dataObj = JSON.parse(dataBuffer.toString());
                        resultData = dataObj.aggregations.CASENAME.buckets.map(item => item.key);
                    }
                    outputChannel.appendLine(`Encontrado(s) ${resultData.length} caso(s) de teste`);
                })
                .on('error', (error) => {
                    clearTimeout(timeoutControl);
                    //resolve();
                })
                .on('end', () => {
                    clearTimeout(timeoutControl);
                    resolve(resultData)
                });
            });
            
            postRequest.setTimeout(5000);
            postRequest.write(postData);
            postRequest.end();
        });
    }

    private runTestCases(loginCookie:string,cases:string[]) {
        let results:TestCaseQueue[] = [];

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
            else
                vscode.window.showInformationMessage('Todos casos de teste rodaram com sucesso!');

            this.inExecution.RUN = false;
        }

        this.runNext(loginCookie, results, fncFinish);
    }

    private runNext(loginCookie:string, results:TestCaseQueue[], onFinish?:Function) {
        if (this.abortExecution.RUN) {
            this.inExecution.RUN = false;
            outputChannel.appendLine('Execução abortada!');
            return;
        }

        let result = results.find(item => !item.done);

        if (!isNullOrUndefined(result)) {
            if (isNullOrUndefined(result.data)) {
                // ainda nao tem os dados do caso de teste
                this.getTestCase(loginCookie, result.CASENAME)
                    .then(getTestCaseResult => {
                        let tcData;
                        if (!isNullOrUndefined(getTestCaseResult) && !isNullOrUndefined(getTestCaseResult.items)) {
                            tcData = getTestCaseResult.items.find(item => item.caseName.toLowerCase() == (result.CASENAME.toLowerCase()+'.r'));
                        }
                        if (!isNullOrUndefined(tcData))
                            result.data = tcData;
                        else
                            result.done = true;
                        this.runNext(loginCookie, results, onFinish);
                    })
                    .catch(() => {
                        result.done = true;
                        this.runNext(loginCookie, results, onFinish);
                    });
            }
            else {
                // ja tem os dados, entao roda o caso de teste
                this.runTestCase(loginCookie, result)
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
                        this.runNext(loginCookie, results, onFinish);
                    })
                    .catch(() => {
                        result.done = true;
                        this.runNext(loginCookie, results, onFinish);
                    });
            }
        }
        else {
            // nenhum teste pendente
            if (!isNullOrUndefined(onFinish))
                onFinish(results);
        } 
    }

    private getTestCase(loginCookie:string,caseName:string): Promise<any> {
        const getOptions = {
            hostname: this.config.totvs.host,
            port: this.config.totvs.port,
            path: this.config.totvs.apiPath + '?' + this.API_QUERY_SEARCH.replace('{CASENAME}', encodeURIComponent(caseName)),
            method: 'GET',
            timeout: 3500,
            headers: {
                'Cookie': loginCookie
            },
            followAllRedirects: true
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

                res
                .on('data', (dataBuffer: Buffer) => {
                    clearTimeout(timeoutControl);
                    if (res.statusCode == 200) {
                        outputChannel.appendLine(`${caseName} pronto para ser executado`);
                        resolve(JSON.parse(dataBuffer.toString()));
                    }
                    else {
                        outputChannel.appendLine(`Erro ao consultar dados de ${caseName} (status ${res.statusCode})`);
                        resolve();
                    }
                })
                .on('error', () => {
                    clearTimeout(timeoutControl);
                    outputChannel.appendLine(`Erro ao consultar dados de ${caseName}`);
                    resolve();
                })
                .on('end', () => {
                    console.log(res.statusCode);
                });
            });
            
            getRequest.end();
        });
    }

    private runTestCase(loginCookie:string,testCase:TestCaseQueue): Promise<any> {
        return new Promise(resolve => {
            const jsonData = {
                tmpCaseTest: [testCase.data]
            };
            const postData = JSON.stringify(jsonData);
            const postOptions = {
                hostname: 'cxs-tast',
                port: 8380,
                path: `/dts/datasul-rest/resources/prg/htast/v1/api-tast/`,
                method: 'POST',
                timeout: 10000,
                headers: {
                    'Cookie': loginCookie,
                    'Content-Type': 'application/json',
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

                res.on('data', (dataBuffer: Buffer) => {
                    clearTimeout(timeoutControl);
                    if (res.statusCode == 200) {
                        outputChannel.appendLine(`Finalizado teste ${testCase.CASENAME}`);
                        resolve(JSON.parse(dataBuffer.toString()));
                    }
                    else {
                        outputChannel.appendLine(`Erro ao executar teste ${testCase.CASENAME} (status ${res.statusCode})`);
                        resolve();
                    }
                });
                res.on('error', (error) => {
                    clearTimeout(timeoutControl);
                    outputChannel.appendLine(`Erro ao executar teste ${testCase.CASENAME}`);
                    resolve();
                });
            });
            
            postRequest.setTimeout(10000);
            postRequest.write(postData);
            postRequest.end();
        });
    }

}