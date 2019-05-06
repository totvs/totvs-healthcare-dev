import * as vscode from 'vscode';
import * as jsonminify from 'jsonminify';
import { readFile } from 'fs';
import * as promisify from 'util.promisify';

let configFile: TotvsHealthcareConfig = null;
let watcher: vscode.FileSystemWatcher = null;
//export var genericWorkspaceFolder: vscode.WorkspaceFolder = null;

const readFileAsync = promisify(readFile);
const CONFIG_FILENAME = '.totvs-healthcare-dev.json';

export interface CrudConfig {
    projectPath?: string;
}

export interface TastBridgeConfig {
    path: string;
    output: string;
}

export interface TastCenarioConfig {
    input: string;
    output: string;
}

export interface TastConfig {
    bridge: TastBridgeConfig;
    cenario: TastCenarioConfig;
}

export interface TotvsHealthcareConfig {
    crud?: CrudConfig;
    tast?: TastConfig;
}

function findConfigFile() {
    return vscode.workspace.findFiles(CONFIG_FILENAME).then(uris => {
        if (uris.length > 0) {
            //genericWorkspaceFolder = vscode.workspace.getWorkspaceFolder(uris[0]);
            return uris[0].fsPath;
        }
        return null;
    });
}
function loadAndSetConfigFile(filename: string) {
    if (filename === null) {
        return Promise.resolve({});
    }
    return loadConfigFile(filename).then((config) => {
        configFile = config;
        return getConfig;
    });
}
function loadConfigFile(filename: string): Thenable<TotvsHealthcareConfig> {
    if (!filename)
        return Promise.resolve({});
    return readFileAsync(filename, { encoding: 'utf8' }).then(text => {
        // We don't catch the parsing error, to send the error in the UI (via promise rejection)
        return JSON.parse(jsonminify(text));
    });
}
export function loadExtensionConfig() {
    return new Promise<TotvsHealthcareConfig | null>((resolve, reject) => {
        if (configFile === null) {
            watcher = vscode.workspace.createFileSystemWatcher('**/' + CONFIG_FILENAME);
            watcher.onDidChange(uri => loadAndSetConfigFile(uri.fsPath));
            watcher.onDidDelete(uri => loadAndSetConfigFile(uri.fsPath));

            findConfigFile().then(filename => loadAndSetConfigFile(filename)).then(config => resolve(config));
        }
        else {
            resolve(configFile);
        }
    });
}
export function getConfig(): TotvsHealthcareConfig {
    return configFile;
}