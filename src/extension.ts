import * as vscode from 'vscode';
import { outputChannel } from './notification';
import { HealthcareCrudExtension } from './crud';
import { MapFile } from './models';
import { HealthcareTastExtension } from './tast';
import { loadExtensionConfig } from './configFile';

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

}

export function deactivate() {
}
