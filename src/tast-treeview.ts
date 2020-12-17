import * as vscode from 'vscode';
import * as http from 'http';
import { TastTreeProvider } from './providers/tast-tree-provider';
import { isNullOrUndefined } from 'util';
import { TastRunnerConfig, getConfig, TastConfig } from './configFile';
import { outputChannel } from './notification';
import { HealthcareTastRunnerExtension } from './tastRunner';

export class HealthcareTastTreeView{
    
    private context: vscode.ExtensionContext;
    private inExecution: { RUN: boolean };
    private abortExecution: { RUN: boolean };
    private sessionCookies: string[] = [];
    private runnerConfig: TastRunnerConfig;

    private tastTreeProvider = new TastTreeProvider(vscode.workspace.rootPath + "");

    private readonly TOTVS_LOGIN_PATH = '/dts/datasul-rest/resources/login?username=super&password=hFG6ihTXl1PTTLM7UbpGtLAl64E%3D';
    private readonly TOTVS_JOSSO_PATH = '/josso/signon/login.do';
    private readonly TOTVS_API_PATH = '/dts/datasul-rest/resources/prg/htast/v1/api-tast/';
    private readonly TOTVS_API_QUERYPARAM = 'search={CASENAME}.r';

    constructor(
        context: vscode.ExtensionContext,
        private healthcareTastRunnerExtension:HealthcareTastRunnerExtension
        ) {
        this.context = context;
        this.inExecution = { RUN: false };
        this.abortExecution = { RUN: false };
        this.registerCommands();
    }

    private getRunnerConfig(): TastRunnerConfig {
        let _cfg = getConfig();
        let _tast: TastConfig;
        let _run: TastRunnerConfig;
        if (_cfg.tast)
            _tast = _cfg.tast;
        else
            _tast = {};
        if (_tast.run)
            _run = _tast.run;
        else
            _run = {};
        return _run;
    }

    private registerCommands() {        
        let commands = [];        
        vscode.window.registerTreeDataProvider('tast', this.tastTreeProvider);
        
        commands.push(vscode.commands.registerCommand('healthcare.tast.refreshEntry', () => { this.refreshEntry() }));
    
        commands.push(vscode.commands.registerCommand('healthcare.tast.runTast', (obj:any) => { this.runTastProxy(obj) }));
    
        commands.push(vscode.commands.registerCommand('healthcare.tast.runTastNotRegistered',() => { this.runTastNotRegisteredProxy() }));


        this.context.subscriptions.push(...commands);
    }

    private refreshEntry() {        
        vscode.window.showInputBox({
            prompt: 'Informe um criterio para pesquisa'
        }).then((ret) => {
            outputChannel.clear();
            outputChannel.show();
            outputChannel.appendLine("Iniciando atualizacao dos CT's");            
            this.getInfosCall(ret).then(data => {            
                if(data === true){
                    this.tastTreeProvider.refresh();
                    outputChannel.appendLine("CT's atualizados!");
                } else {
                    console.log(data);
                }
            }).catch((err) => {
                console.error(err);            
            });
        });        
    }

    private getInfosCall(search:string):Promise<boolean>{
        let data:any = '';
        this.runnerConfig = this.getRunnerConfig();
    
        const http = require('http');
        const fs = require('fs');
        this.inExecution.RUN = true;

        return new Promise((resolve) => {
            this.requestLogin().then((result) => {                
                if (result !== true) {
                    vscode.window.showInformationMessage('Erro ao conectar no ambiente do TAST')
                    outputChannel.appendLine('Erro ao conectar no ambiente do TAST');
                    this.inExecution.RUN = false;                        
                }                                              

                if(result){

                    const options = { 
                        hostname: this.runnerConfig.totvs.host,
                        port: this.runnerConfig.totvs.port,
                        path: this.TOTVS_API_PATH + '?search=' + search + '&page=1&pageSize=9999',                    
                        methotd: 'GET',
                        timeout: 3500,
                        headers: {
                            'Cookie': this.sessionCookies.join('; ')
                        }
                    };
                                      
                    outputChannel.appendLine("Consultando informações");
                    const getRequest = http.request(options, (resp:any) => {
                        let timeoutControl = setTimeout(() => {
                            if (resp.socket) {
                                resp.socket.destroy();
                                resolve(false);
                            }
                            resp.emit("Error");
                            resolve(false);
                        }, options.timeout);
                    
                        resp.on('data',(chunk:any) => {
                            clearTimeout(timeoutControl);
                            if (resp.statusCode == 200) {
                                data += chunk;
                            } else {
                                outputChannel.appendLine("Erro ao consultar os dados");
                            }
                        }).on('end', () => {                                
                            clearTimeout(timeoutControl);
                            if(data){
                                fs.writeFileSync(vscode.workspace.rootPath + '\\.totvs.healthcare-dev.tast.list.json', JSON.stringify(JSON.parse(data).items));
                                resolve(true);
                            } else{
                                resolve(false)
                            }

                            outputChannel.appendLine("Finalizando consultas");
                        }).on('error', (err:any) => {
                            clearTimeout(timeoutControl);
                            console.error('Error ' + err);                            
                            resolve(false);
                        });
                    })

                    getRequest.end();
                                                     
                }
            })   
        })
             
    }

    private requestLogin(): Promise<boolean> {
        this.sessionCookies = [];

        let result = false;
        let promises = [];

        let pTotvs = this.requestTotvsLogin().then(totvsCookies => {
            if (totvsCookies != undefined)
                this.sessionCookies = [...this.sessionCookies, ...totvsCookies];
        });
        promises.push(pTotvs);

        let pJosso = pTotvs.then(() => this.requestJossoLogin().then(jossoCookies => {
            if (jossoCookies != undefined) {
                this.sessionCookies = [...this.sessionCookies, ...jossoCookies];
                result = true;
            }
        }));
        promises.push(pJosso);

        return Promise.all(promises).then(() => result);
    }

    private runTast(testCase:any={}):Promise<Object> {
	
        const http = require('https');
    
        let data:any = '';
    
        return new Promise((resolve) => {
    
            http.get('https://gorest.co.in/public-api/users', (resp:any) => {
                resp.on('data', (chunk:any) => {
                    data += chunk;
                })
    
                resp.on('end',() => {
                    resolve({
                        data: JSON.parse(data).data,
                        type: 'success'
                    });
                });
            }).on('error', (err:any) => {
                console.error(err);
                resolve({
                    type: 'error',
                    message: err
                });
            })
    
    
        })
    
    }

    private showReturnExecuteTast(data: any) {
        if (data.type) {
    
            if (data.type == "error") {
                vscode.window.showErrorMessage(data.message);
            } else if (data.type == "success") {
                vscode.window.showInformationMessage("Sucesso!");
            } else {
                vscode.window.showWarningMessage("Dados não retornados");
            }
    
        }
    }
    

    private runTastProxy(obj:any){        
        outputChannel.clear();
        outputChannel.show();
        vscode.window.showInformationMessage("Executando: " + obj.name);
        this.healthcareTastRunnerExtension.runTestCases([String(obj.name).replace('.r','')]);        
    }

    private runTastNotRegisteredProxy(){
        this.runTastNotRegistered().then((ret:any) => {
            outputChannel.clear();
            outputChannel.show();

            if(this.sessionCookies.length == 0){
                this.runnerConfig = this.getRunnerConfig();
                this.requestLogin().then((result) => {

                    if(result){
                        outputChannel.appendLine('Executando: ' + ret);            
                        this.healthcareTastRunnerExtension.sessionCookies = this.sessionCookies;
                        this.healthcareTastRunnerExtension.runTestCase({  
                            CASENAME: '',
                            done: false,                                
                            data: {
                                id: 0,
                                propathCase: ret
                            }                
                        });
                    } else {
                        outputChannel.appendLine("Falha ao conectar no ambiente do TAST");
                    }

                });
            }            
        });
    }
    
    private runTastNotRegistered():Promise<Object>{        

        return new Promise((resolve) => {
            vscode.window.showInputBox({
                prompt: 'Informe o propath'
            }).then((ret) => {
                resolve(ret);
            });
        })
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
                    if (!res.socket) {
                        outputChannel.appendLine(`Timeout ao tentar login no TOTVS`);
                        res.socket.destroy();
                    }
                    res.emit('error');
                }, getOptions.timeout);

                let resultData: string[];

                res.on('data', () => {
                    clearTimeout(timeoutControl);
                    if (res.headers['set-cookie'])
                        resultData = res.headers['set-cookie'];
                })
                    .on('error', () => {
                        clearTimeout(timeoutControl);
                        resolve();
                    })
                    .on('end', () => {
                        clearTimeout(timeoutControl);
                        if (resultData == null || resultData == undefined)
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
                    if (!res.socket) {
                        outputChannel.appendLine(`Timeout ao tentar login no JOSSO`);
                        res.socket.destroy();
                    }
                    res.emit('error');
                }, getOptions.timeout);

                let resultData: string[];

                res.on('data', () => {
                    clearTimeout(timeoutControl);
                    if (res.headers['set-cookie'])
                        resultData = res.headers['set-cookie'];
                }).on('error', () => {
                        clearTimeout(timeoutControl);
                        resolve();
                    }).on('end', () => {
                        clearTimeout(timeoutControl);
                        if (resultData)
                            resolve(resultData);
                        else
                            resolve()
                    });
            });

            getRequest.end();
        });
    }
}