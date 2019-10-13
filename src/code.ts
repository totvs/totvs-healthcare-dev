import * as vscode from 'vscode';
import { getConfig } from './configFile';
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
        vscode.workspace.onDidSaveTextDocument(document => { this.checkCodeAlerts(document) });
    }

    private initCodeDiagnostic() {
        this.codeDiagnostic = vscode.languages.createDiagnosticCollection('healthcare-code');
	    this.context.subscriptions.push(this.codeDiagnostic);
    }

    private checkCodeAlerts(document: vscode.TextDocument) {
        this.codeDiagnostic.delete(document.uri);

        let words = this.getKeywords();
        if (words.length == 0)
            return;

        vscode.commands.getCommands(true)
            .then(list => {
                // tratamento especial para codigos progress
                if ((document.languageId == 'abl')&&(!isNullOrUndefined(list.filter(item => item == this.EXT_GETSOURCE)))) {
                    vscode.commands.executeCommand(this.EXT_GETSOURCE)
                        .then((data: SourceCode) => { 
                            this.searchCodeAlerts(document, (data.sourceWithoutComments || ''), words)  
                        });
                }
                else {
                    this.searchCodeAlerts(document, document.getText(), words);
                }
            });
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
        this.codeDiagnostic.set(document.uri, diagMap);
        if ((diagMap.length > 0)&&(this.shouldNotify())) {
            vscode.window.showWarningMessage('Atenção com as expressões marcadas para alerta!');
        }
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

}
