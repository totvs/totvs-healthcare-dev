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


/**
 * Classes para o gerador de CRUD
 */

//export interface ICrudNode {
//}

export class CrudEnumItem {
    id: string;
    value: string;
    label: string;
}

export class CrudEnum {
    id: number;
    component: string;
    module: string;
    controller: string;
    description: string;
    valueDataType: string;
    items: CrudEnumItem[];
}


export class CrudField {
    id: number;
    name: string;
    fieldName: string;
    description: string;
    dataType: string;
    inputType: string;
    inputFormat: string;
    defaultValue: string;
    fixedValue: string;
    pipeClass: string;
    maxSize: number;
    isKey: boolean;
    isRequired: boolean;
    isVisible: boolean;
    isListable: boolean;
    isEditable: boolean;
    isLink: boolean;
    isFilter: boolean;
    isRangeFilter: boolean;
    inputComponent: string;
    zoomComponent: string;
    enumComponent: CrudEnum;

    get $label(): string {
        return this.name;
    }
}

export class CrudFile {
    name: string;
    component: string;
    module: string;
    controller: string;
    description: string;
    pageTitle: string;
    appModule: string;
    appVersion: string;
    minimumVersion: string;

    fields: CrudField[];
}
