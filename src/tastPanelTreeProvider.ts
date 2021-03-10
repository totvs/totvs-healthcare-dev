import * as vscode from 'vscode';
import * as path from 'path';
import { TastHandler, TestCase, TestSuite } from './tastHandler';

export class HealthcareTastPanelTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem> = new vscode.EventEmitter<vscode.TreeItem>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem> = this._onDidChangeTreeData.event;

    private _suites: TestSuite[];
    private _testCases: TestCase[];

    constructor(
        private handler: TastHandler
    ) { }

    get suites() {
        return this._suites;
    }

    get testCases() {
        return this._testCases;
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            return this.refreshSuites()
                .then(() => this.refreshTestCases()
                    .then(() => this._suites.map(item => TestSuiteItem.create(item)))
                );
        }
        else {
            return Promise.resolve(this._testCases.filter(item => item.suite == parseInt(element.id)).map(item => TestCaseItem.create(item)));
        }
    }
  
    refresh() {
        this._onDidChangeTreeData.fire();
    }

    refreshSuites() {
        return this.handler.getSuites()
            .then(result => this._suites = result?.items || [])
            .catch(() => this._suites = []);
    }

    refreshTestCases() {
        return this.handler.getTestCases()
            .then(result => this._testCases = result?.items || [])
            .catch(() => this._testCases = []);
    }

}

export class TestSuiteItem extends vscode.TreeItem {
    testSuite: TestSuite;

    static create(testSuite: TestSuite) {
        const instance = new TestSuiteItem(testSuite.suiteName);
        instance.id = testSuite.suiteCode.toString();
        instance.testSuite = testSuite;
        return instance;
    }

    constructor(label: string) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
    }
    
    iconPath = {
        light: path.join(__filename,'..','..','resources', 'tastPanel', 'suite-light.svg'),
        dark: path.join(__filename,'..','..','resources', 'tastPanel', 'suite-dark.svg')
    };

    contextValue = 'suite';
}

export class TestCaseItem extends vscode.TreeItem {
    testCase: TestCase;

    static create(testCase: TestCase) {
        const instance = new TestCaseItem(testCase.nomCasoTeste);
        instance.id = testCase.cddCasoTeste.toString();
        instance.testCase = testCase;
        instance.tooltip = `${testCase.dsPropath}${testCase.nomCasoTeste}`;
        return instance;
    }

    constructor(label: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
    }
    
    iconPath = {
        light: path.join(__filename,'..','..','resources', 'tastPanel', 'cenario-light.svg'),
        dark: path.join(__filename,'..','..','resources', 'tastPanel', 'cenario-dark.svg')
    };

    contextValue = 'case';
}