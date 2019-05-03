import * as fs from 'fs';
import { WorkspaceFolder } from 'vscode';

/*export function isString(value): boolean {
	return typeof value === 'string' || value instanceof String;
}*/

export function changePath(fileName: string, destination: string, wsFolder: WorkspaceFolder): string {
	return fileName.replace(wsFolder.uri.fsPath, destination);
}

export function mkdir(path: string) {
	let dirs = path.split('\\');
	for (let i = 0; i < dirs.length; i++) {
		let dir = dirs.filter((v,idx) => { return (idx <= i) }).join('\\');
		if (dir.replace('\\','') == '') 
			continue;
		if (!fs.existsSync(dir))
			fs.mkdirSync(dir);
	}
}

export function toCamelCase(text: string): string {
	let s = toPascalCase(text);
	if (s != '')
		return s.substring(0,1).toLowerCase() + (s.length > 1 ? s.substring(1) : '');
	return '';
}

export function toPascalCase(text: string): string {
	return text
		.split('-')
		.map(s => {
			s = s.toLowerCase();
			s = s.substring(0,1).toUpperCase() + (s.length > 1 ? s.substring(1) : '');
			return s;
		})
		.join('');
}

export function ablTypeToTypescriptType(ablType: string): string {
	return '';
}

export function ablFormatToTypescriptFormat(ablFormat: string, ablType: string): string {
	return '';
}

export function ablFormatToFieldSize(ablFormat: string): number {
	return 0;
}
