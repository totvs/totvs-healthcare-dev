import * as vscode from 'vscode';
import * as path from 'path';
import { TastHandler, TestCase, TestSuite } from './tastHandler';
import { HealthcareTastPanelTreeProvider, TestCaseItem, TestSuiteItem } from './tastPanelTreeProvider';
import { getConfig } from './configFile';

const REPOSITORY_BASE_FSPATH = 'scriptsautomacao';
const ACTIVATION_CONTEXT = 'hasTastConfig';

export class HealthcareTastPanelExtension {

    private context: vscode.ExtensionContext;
    private provider: HealthcareTastPanelTreeProvider;
    private tastHandler: TastHandler;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        // ativa somente qdo houver configuracao do tast
        if (this.hasConfiguration()) {
            this.registerTreeViewProvider();
            this.registerCommands();
        }
    }

    private registerCommands() {
        this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.tast.panel.update', () => { this.refreshProviderData() }));
        this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.tast.panel.runFromPath', () => { this.commandTestCaseFromPath() }));
        this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.tast.panel.run', (item: TestCaseItem) => { this.commandRunTestCase(item.testCase) }));
        this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.tast.panel.add', (item: TestSuiteItem) => { this.commandAddTestCase(item.testSuite) }));
    }

    private registerTreeViewProvider() {
        this.tastHandler = new TastHandler();
        this.provider = new HealthcareTastPanelTreeProvider(this.tastHandler);
        vscode.window.registerTreeDataProvider('tastPanel', this.provider);
        vscode.commands.executeCommand('setContext', ACTIVATION_CONTEXT, true);
    }

    private hasConfiguration() {
        const config = getConfig();
        return !!(config?.tast);
    }

    private refreshProviderData() {
        this.provider?.refresh();
    }

    private async commandTestCaseFromPath() {
        try {
            let fullPath = await this.requestUserInput('Caminho do caso de teste', '');
            fullPath = fullPath.replace('\\', '/');
            const pathSplit = fullPath.split('/');
            const testCase: TestCase = {
                nomCasoTeste: pathSplit.pop(),
                dsPropath: [...pathSplit,''].join('/')
            }
            this.runTestCase(testCase);
        }
        catch { }
    }

    private commandRunTestCase(testCase: TestCase) {
        if (testCase?.cddCasoTeste > 0) {
            vscode.window.showInformationMessage(`Executando ${testCase.nomCasoTeste}...`);
            this.runTestCase(testCase);
        }
        else {
            vscode.window.showErrorMessage('Erro nos dados do caso de teste');
        }
    }

    private runTestCase(testCase: TestCase) {
        this.tastHandler.runTestCase(testCase)
            .then(resultItems => {
                const result = (resultItems?.items?.length == 1) ? resultItems.items[0] : null;
                if (result) {
                    if (result.status == 'passed') {
                        vscode.window.showInformationMessage(`${result.testCase} executado com sucesso`);
                    }
                    else {
                        vscode.window.showErrorMessage(`FALHA na execução de ${result.testCase}!\n ${result.message}`);
                    }
                }
                else {
                    throw new Error('Sem retorno');
                }
            })
            .catch(() => vscode.window.showErrorMessage('Erro ao tentar executar caso de teste'));
    }

    private async commandAddTestCase(testSuite: TestSuite) {
        const testCase: TestCase = { suite: testSuite.suiteCode };
        let suggestedName = '';
        let suggestedPath = '';
        // preenche informações baseado no arquivo atual
        if ((vscode.window.activeTextEditor) && (vscode.window.activeTextEditor.document.uri.fsPath.toLowerCase().endsWith('.p'))) {
            let strSplit = path.basename(vscode.window.activeTextEditor.document.uri.fsPath).split('.');
            strSplit.pop();
            suggestedName = [...strSplit,'r'].join('.');

            strSplit = path.dirname(vscode.window.activeTextEditor.document.uri.fsPath).replace('/', '\\').split('\\');
            let baseDirIndex = strSplit.findIndex(item => item.toLowerCase() == REPOSITORY_BASE_FSPATH);
            if (baseDirIndex >= 0) {
                strSplit.splice(0, ++baseDirIndex);
                suggestedPath = [...strSplit,''].join('\\');
            }
        }
        // solicita dados para o usuario
        try {
            testCase.nomCasoTeste = await this.requestUserInput('Caso de teste', suggestedName);
            testCase.dsPropath = await this.requestUserInput('Propath', suggestedPath);
            testCase.codMeta = parseInt(await this.requestUserInput('Ano de desenvolvimento', new Date().getFullYear().toString()));
            testCase.codPeriodo = parseInt(await this.requestUserInput('Semestre de desenvolvimento', (Math.floor(new Date().getMonth() / 6)+1).toString()));
            testCase.logOfensor = await this.requestUserBooleanInput('Considera para meta?');
            testCase.dsObjetivo = await this.requestUserInput('Objetivo', 'Objetivo');

            vscode.window.showInformationMessage(`Cadastrando ${testCase.nomCasoTeste}...`);
            this.tastHandler.addTestCase(testCase)
                .then(() => { vscode.window.showInformationMessage(`${testCase.nomCasoTeste} cadastrado!`) })
                .catch(() => { vscode.window.showErrorMessage(`Falhou ao tentar cadastrar ${testCase.nomCasoTeste}. Verifique se os dados foram preenchidos corretamente`) });
        }
        // processo cancelado pelo usuario, com ESC
        catch { }
    }

    private async requestUserInput(text: string, value: string) {
        let result = await vscode.window.showInputBox({ prompt: text, value: value });
        if (result) {
            return result;
        }
        throw new Error('Cancelado pelo usuario');
    }

    private async requestUserBooleanInput(text: string) {
        let result = await vscode.window.showQuickPick(['Sim','Não'], { placeHolder: text, canPickMany: false });
        if (result === 'Sim') {
            return true;
        }
        if (result === 'Não') {
            return false;
        }
        throw new Error('Cancelado pelo usuario');
    }

}
