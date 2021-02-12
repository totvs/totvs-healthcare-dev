import * as vscode from 'vscode';
import { HealthcareTastExtension } from './tast';
import { HealthcareTastRunnerExtension } from './tastRunner';
import { loadExtensionConfig } from './configFile';
import { HealthcareCodeExtension } from './code';
import { HealthcareFormattingExtension } from './formatting';
import { HealthcareCleanCodeMetricsExtension } from './cleanCodeMetrics';

export function activate(context: vscode.ExtensionContext): void {

	// Leitura de configurações
	loadExtensionConfig().then(() => {
		// Extensão do Gerador de TAST
		new HealthcareTastExtension(context);
		// Extensão do Executor de Casos de Teste
		new HealthcareTastRunnerExtension(context);
		// Extensão de Analise de Codigo
		new HealthcareCodeExtension(context);
		// Extensão de Metricas de Codigo
		new HealthcareCleanCodeMetricsExtension(context);
		// Extensão de Formatação de Código
		new HealthcareFormattingExtension(context);
	});
}

export function deactivate() {
}
