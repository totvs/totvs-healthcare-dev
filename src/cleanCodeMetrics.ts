import * as vscode from 'vscode';
import { SourceCode, MapFile } from './models';
import { CodeMetricsConfig, getConfig } from './configFile';
import { HealthcareOpenEdgeUtils } from './openEdgeUtils';

enum DEFAULT_METRICS {
    METHOD_MAX = 30,
    METHOD_LLOC = 50
}

enum REJECTION_TYPE {
    METHOD_LLOC = 'LLOC',
    METHOD_MAX = 'MaxMethods'
}

interface CodeRejection {
    type: REJECTION_TYPE;
    name?: string;
    expected?: any;
    value?: any;
}

interface CodeMetric {
    methods: MethodMetric;
    rejections: CodeRejection[];
}

interface MethodMetricItem {
    name: string;
    LLOC?: number; // logical lines of code
}

interface MethodMetric {
    count?:number;
    items:MethodMetricItem[];
}

export class HealthcareCleanCodeMetricsExtension {

    private context: vscode.ExtensionContext;
    private readonly EXT_GETMAP = 'abl.currentFile.getMap';
    private readonly EXT_GETSOURCE = 'abl.currentFile.getSourceCode';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.registerCommands();
    }

    private registerCommands() {
        this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.cleanCode.metrics.show', () => { this.showCleanCodeMetrics() }));
    }

    private getMetrics(): CodeMetricsConfig {
        let config = getConfig();
        // default values
        let result: CodeMetricsConfig = { 
            methods: {
                max: DEFAULT_METRICS.METHOD_MAX,
                LLOC: DEFAULT_METRICS.METHOD_LLOC
            }
        };
        if (config?.metrics?.methods) {
            result.methods.max = (config.metrics.methods.max || result.methods.max);
            result.methods.LLOC = (config.metrics.methods.LLOC || result.methods.LLOC);
        }
        return result;
    }

    private showCleanCodeMetrics() {
        this.checkDocumentMetrics(vscode.window.activeTextEditor.document);
    }

    private checkDocumentMetrics(document: vscode.TextDocument) {
        if (document.languageId != 'abl')
            return;

        let oeUtils = new HealthcareOpenEdgeUtils();
        
        if (oeUtils.hasOpenEdgeExtension(true)) {
            // Busca todos os métodos do arquivo atual
            vscode.commands.executeCommand(this.EXT_GETMAP).then((mapFile: MapFile) => {
                vscode.commands.getCommands(true).then(list => {
                    // tratamento especial para codigos progress
                    if (list.filter(item => item == this.EXT_GETSOURCE)) {
                        vscode.commands.executeCommand(this.EXT_GETSOURCE).then((sourceCode: SourceCode) => {
                            let result = this.calculateMetrics(mapFile, document, (sourceCode.sourceWithoutComments || ''));
                            vscode.workspace.openTextDocument({content: JSON.stringify(result), language: 'json'}).then(doc => vscode.window.showTextDocument(doc));
                        });
                    }
                    else {
                        let result = this.calculateMetrics(mapFile, document);
                        vscode.workspace.openTextDocument({content: JSON.stringify(result), language: 'json'}).then(doc => vscode.window.showTextDocument(doc));
                    }
                });
            });
        }
    }

    private calculateMetrics(mapFile: MapFile, document: vscode.TextDocument, text?: string): CodeMetric {
        if (!text) {
            text = document.getText();
        }

        let result: CodeMetric = {
            methods: { items: [] },
            rejections: []
        };

        let config = this.getMetrics();

        // metodos
        mapFile.methods.forEach(method => {
            let metric: MethodMetricItem = { name: method.name, LLOC: 0 };
            let offsetAt = document.offsetAt(new vscode.Position(method.lineAt + 1, 0));
            let offsetEnd = document.offsetAt(new vscode.Position(method.lineEnd, 0));
            let subtext = text.substring(offsetAt, offsetEnd);
            // LLOC
            let llocRegex = new RegExp('(\\w+)([\\s\\n\\t]+)([\\w\\W]+?)([\\.\\:]{1}[\\s\\t\\n]{1})', 'gm');
            let llocMatches = subtext.match(llocRegex);
            metric.LLOC = (llocMatches || []).length;
            //
            result.methods.items.push(metric);
            // assert de LLOC do metodo
            if (metric.LLOC > config.methods.LLOC)
                result.rejections.push({type: REJECTION_TYPE.METHOD_LLOC, name: metric.name, expected: config.methods.LLOC, value: metric.LLOC});
        });
        // maiores LLOC em primeiro
        result.methods.items.sort((a,b) => b.LLOC - a.LLOC);
        result.methods.count = result.methods.items.length;

        // assert de MAX de metodos no programa
        if (result.methods.count > config.methods.max)
            result.rejections.push({type: REJECTION_TYPE.METHOD_MAX, expected: config.methods.max, value: result.methods.count});

        return result;
    }

}
