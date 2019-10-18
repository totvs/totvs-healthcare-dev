import * as vscode from 'vscode';
import { HealthcareTastExtension } from './tast';
import { loadExtensionConfig } from './configFile';
import { HealthcareCodeExtension } from './code';
import { HealthcareFormattingExtension } from './formatting';
import { HealthcareCleanCodeMetricsExtension } from './cleanCodeMetrics';

export function activate(context: vscode.ExtensionContext): void {

	// Leitura de configurações
	loadExtensionConfig();

	// Extensão do Gerador de CRUD
	/*
	let healthcareCrudExtension = new HealthcareCrudExtension(context);
	// evento de build do gerador de crud
	healthcareCrudExtension.onBuild.event(function (result) {
		vscode.workspace.openTextDocument({language:'json', content: JSON.stringify(result)}).then(v => {
			vscode.window.showTextDocument(v);
		});
	});
	*/

	// Extensão do Gerador de TAST
	new HealthcareTastExtension(context);

	// Extensão de Analise de Codigo
    new HealthcareCodeExtension(context);
    
    // Extensão de Metricas de Codigo
	new HealthcareCleanCodeMetricsExtension(context);

	// Extensão de Formatação de Código
	new HealthcareFormattingExtension(context);

	// teste
	//vscode.commands.registerCommand('healthcare.log.analyse.appServer', () => { vscode.window.showInformationMessage('TESTE') });

}

export function deactivate() {
}
