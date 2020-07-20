import * as vscode from "vscode";

/**
 * Classes de mapeamento do fonte (espelhamento do plugin openedge-zext)
 */

export interface MapParams {
    name: string;
    asLike: 'as' | 'like';
    dataType: string;
    line: number;
    direction: 'input' | 'output' | 'input-output';
    additional?:string;
}

export interface MapMethod {
    name: string;
    lineAt: number;
    lineEnd: number;
    params: MapParams[];
}

export interface MapVariable {
    name: string;
    asLike: 'as' | 'like';
    dataType: string;
    line: number;
}

export interface MapTempTable {
    label: string;
    fields: MapVariable[];
    referenceTable: string;
    referenceFields: MapVariable[];
}

export interface MapInclude {
    fsPath: string;
    name: string;
    map: MapFile;
}

export interface MapFile {
    methods: MapMethod[];
    variables: MapVariable[];
    tempTables: MapTempTable[];
    includes: MapInclude[];
    //external: MapExternal[];
}

export interface MapField {
    label: string;
    detail: string;
    dataType: string;
    format: string;
    mandatory: boolean;
}

export interface MapIndex {
    label: string;
    primary: boolean;
    fields: MapField[];
}

export interface MapTable {
    label: string;
    detail: string;
    fields: MapField[];
    indexes: MapIndex[];
}

/**
 * Classes para tratamento de código fonte
 */
export interface SourceCode {
    document: vscode.TextDocument;
    fullSource?: string;
    sourceWithoutComments?: string;
    sourceWithoutStrings?: string;
}
