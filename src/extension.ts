import * as vscode from 'vscode';
import { HealthcareTastExtension } from './tast';
import { HealthcareTastRunnerExtension } from './tastRunner';
import { loadExtensionConfig } from './configFile';
import { HealthcareCodeExtension } from './code';
import { HealthcareFormattingExtension } from './formatting';
import { HealthcareCleanCodeMetricsExtension } from './cleanCodeMetrics';
import { HealthcareTastTreeView } from './tast-treeview';

export function activate(context: vscode.ExtensionContext): void {

	// Leitura de configurações
	loadExtensionConfig();

	let tastRunner;

	// Extensão do Gerador de TAST
    new HealthcareTastExtension(context);
    
    // Extensão do Executor de Casos de Teste
	tastRunner = new HealthcareTastRunnerExtension(context);

	// Extensão de Analise de Codigo
    new HealthcareCodeExtension(context);
    
    // Extensão de Metricas de Codigo
	new HealthcareCleanCodeMetricsExtension(context);

	// Extensão de Formatação de Código
	new HealthcareFormattingExtension(context);

	//Extensão do TAST Tree View
	new HealthcareTastTreeView(context, tastRunner);

}

export function deactivate() {
}
