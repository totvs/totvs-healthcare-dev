/**
 * Classes de mapeamento do fonte (espelhamento do plugin openedge-zext)
 */

export class MapParams {
    name: string;
    asLike: 'as' | 'like';
    dataType: string;
    line: number;
    direction: 'input' | 'output' | 'input-output';
}

export class MapMethod {
    name: string;
    lineAt: number;
    lineEnd: number;
    params: MapParams[];
}

export class MapVariable {
    name: string;
    asLike: 'as' | 'like';
    dataType: string;
    line: number;
}

export class MapTempTable {
    label: string;
    fields: MapVariable[];
    referenceTable: string;
    referenceFields: MapVariable[];
}

export class MapInclude {
    fsPath: string;
    name: string;
    map: MapFile;
}

export class MapFile {
    methods: MapMethod[];
    variables: MapVariable[];
    tempTables: MapTempTable[];
    includes: MapInclude[];
    //external: MapExternal[];
}

export class MapField {
    label: string;
    detail: string;
    dataType: string;
    format: string;
    mandatory: boolean;
}

export class MapIndex {
    label: string;
    primary: boolean;
    fields: MapField[];
}

export class MapTable {
    label: string;
    detail: string;
    fields: MapField[];
    indexes: MapIndex[];
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
