import * as vscode from 'vscode';
import * as jsonminify from 'jsonminify';
import { readFile } from 'fs';
import * as promisify from 'util.promisify';

let configFile: TotvsHealthcareConfig = null;
let watcher: vscode.FileSystemWatcher = null;

const readFileAsync = promisify(readFile);
const CONFIG_FILENAME = '.totvs-healthcare-dev.json';

export interface OpenEdgeConfig {
    proPath?: string[];
    proPathMode?: 'append' | 'overwrite' | 'prepend';
    parameterFiles?: string[];
    configFile?: string;
}

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

export interface HostConfig {
    host: string;
    port: number;
}

export interface TastRunnerElasticSearchConfig extends HostConfig {
    searchPath?: string;
    maxResults?: number;
}

export interface TastRunnerTotvsConfig extends HostConfig {
    loginPath?: string;
    jossoPath?: string;
    apiPath?: string;
}

export interface TastRunnerConfig {
    elasticsearch?: TastRunnerElasticSearchConfig;
    totvs?: TastRunnerTotvsConfig;
    showResults?: boolean;
}

export interface TastConfig {
    bridge?: TastBridgeConfig;
    cenario?: TastCenarioConfig;
    run?: TastRunnerConfig;
    config?: OpenEdgeConfig;
}

export interface CodeAlertConfig {
    keywords?: string[];
    notify?: boolean;
}

export interface CodeFileAlertConfig extends CodeAlertConfig {
    fileName?: string;
}

export interface CodeConfig {
    alerts?: CodeAlertConfig;
    fileAlerts?: CodeFileAlertConfig[];
}

export interface MethodMetricsConfig {
    max?:number;
    LLOC?:number;
}

export interface CodeMetricsConfig {
    methods?: MethodMetricsConfig;
}

export interface TotvsHealthcareConfig {
    crud?: CrudConfig;
    tast?: TastConfig;
    code?: CodeConfig;
    metrics?: CodeMetricsConfig;
}

function findConfigFile() {
    return vscode.workspace.findFiles(CONFIG_FILENAME).then(uris => {
        if (uris.length > 0) {
            return uris[0].fsPath;
        }
        return null;
    });
}
function loadAndSetConfigFile(filename: string): Thenable<any> {
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