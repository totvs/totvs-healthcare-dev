import * as vscode from 'vscode';
import { getConfig, CodeFileAlertConfig } from './configFile';
import { isNullOrUndefined } from 'util';
import { SourceCode } from './models';

export class HealthcareCodeExtension {

    private context: vscode.ExtensionContext;
    private codeDiagnostic: vscode.DiagnosticCollection;
    private readonly EXT_GETSOURCE = 'abl.currentFile.getSourceCode';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initCodeDiagnostic();
        this.registerCommands();
    }

    private registerCommands() {
        vscode.workspace.onDidOpenTextDocument(document => { this.checkCodeAlerts(document) });
        vscode.workspace.onDidSaveTextDocument(document => { this.checkCodeAlerts(document) });
        vscode.workspace.onDidCloseTextDocument(document => { this.emptyCodeAlerts(document) });
    }

    private initCodeDiagnostic() {
        this.codeDiagnostic = vscode.languages.createDiagnosticCollection('healthcare-code');
	    this.context.subscriptions.push(this.codeDiagnostic);
    }

    private emptyCodeAlerts(document: vscode.TextDocument) {
        this.codeDiagnostic.delete(document.uri);
    }

    private checkCodeAlerts(document: vscode.TextDocument) {
        this.emptyCodeAlerts(document);

        let words = this.getKeywords();
        let fileAlerts = this.getFileAlerts(document.uri.fsPath);
        if ((words.length > 0)||(fileAlerts.length > 0)) {
            vscode.commands.getCommands(true)
                .then(list => {
                    // tratamento especial para codigos progress
                    if ((document.languageId == 'abl')&&(!isNullOrUndefined(list.filter(item => item == this.EXT_GETSOURCE)))) {
                        vscode.commands.executeCommand(this.EXT_GETSOURCE)
                            .then((data: SourceCode) => { 
                                let diagMap = [
                                    ...this.searchCodeAlerts(document, (data.sourceWithoutComments || ''), words),
                                    ...this.searchFileCodeAlerts(document, (data.sourceWithoutComments || ''), fileAlerts)
                                ];
                                this.codeDiagnostic.set(document.uri, diagMap);
                            });
                    }
                    else {
                        let diagMap = [
                            ...this.searchCodeAlerts(document, document.getText(), words),
                            ...this.searchFileCodeAlerts(document, document.getText(), fileAlerts)
                        ];
                        this.codeDiagnostic.set(document.uri, diagMap);
                    }
                });
        }
    }

    private searchCodeAlerts(document: vscode.TextDocument, source: string, words: string[]) {
        let diagMap: vscode.Diagnostic[] = [];
        words.forEach(word => {
            let regExp = new RegExp(word, 'gi');
            let res = regExp.exec(source);
            while(res) {
                let range = new vscode.Range(document.positionAt(res.index), document.positionAt(regExp.lastIndex));
                diagMap.push(new vscode.Diagnostic(range, `Expressão "${res[0]}" marcada para alerta`, vscode.DiagnosticSeverity.Warning));
                res = regExp.exec(source);
            }
        });
        if ((diagMap.length > 0)&&(this.shouldNotify())) {
            vscode.window.showWarningMessage('Atenção com as expressões marcadas para alerta!');
        }
        return diagMap;
    }

    private getKeywords(): string[] {
        let cfg = getConfig();
        if ((!isNullOrUndefined(cfg))&&(!isNullOrUndefined(cfg.code))&&(!isNullOrUndefined(cfg.code.alerts))&&(!isNullOrUndefined(cfg.code.alerts.keywords)))
            return cfg.code.alerts.keywords.map(item => item.toLowerCase());
        return [];
    }

    private shouldNotify(): boolean {
        let cfg = getConfig();
        if ((!isNullOrUndefined(cfg))&&(!isNullOrUndefined(cfg.code))&&(!isNullOrUndefined(cfg.code.alerts))&&(!isNullOrUndefined(cfg.code.alerts.notify)))
            return cfg.code.alerts.notify;
        return false;
    }

    private searchFileCodeAlerts(document: vscode.TextDocument, source: string, alerts: CodeFileAlertConfig[]) {
        let diagMap: vscode.Diagnostic[] = [];
        alerts.forEach(alert => {
            let fileDiagMap: vscode.Diagnostic[] = [];
            alert.keywords.forEach(word => {
                let regExp = new RegExp(word, 'gi');
                let res = regExp.exec(source);
                while(res) {
                    let range = new vscode.Range(document.positionAt(res.index), document.positionAt(regExp.lastIndex));
                    fileDiagMap.push(new vscode.Diagnostic(range, `Expressão "${res[0]}" marcada para alerta`, vscode.DiagnosticSeverity.Warning));
                    res = regExp.exec(source);
                }
            });
            if ((fileDiagMap.length > 0)&&(alert.notify)) {
                vscode.window.showWarningMessage('Atenção com as expressões marcadas para alerta para o arquivo!');
                diagMap = [...diagMap,...fileDiagMap];
            }
        });
        return diagMap;
    }

    private getFileAlerts(fileName: string): CodeFileAlertConfig[] {
        let cfg = getConfig();
        if ((!isNullOrUndefined(cfg))&&(!isNullOrUndefined(cfg.code))&&(!isNullOrUndefined(cfg.code.fileAlerts))) {
            return cfg.code.fileAlerts.filter(item => new RegExp((item.fileName || ''), 'i').test(fileName));
        }
        return [];
    }

}
