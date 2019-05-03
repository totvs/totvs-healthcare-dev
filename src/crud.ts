import * as vscode from 'vscode';
import { MapTable, CrudField } from './models';
import { CrudFieldOptions } from './enum';
import { toPascalCase, toCamelCase, ablTypeToTypescriptType, ablFormatToTypescriptFormat, ablFormatToFieldSize } from './utils';

interface IHealthcareCrudData {
	readonly label: string;
    kind: number;
    visible: boolean;
}

class HealthcareCrudMockData implements IHealthcareCrudData {
    kind = -1;
    visible = true;
	get label(): string {
		return 'mock';
	}
}

class HealthcareCrudFieldData implements IHealthcareCrudData {
    kind = 0;
    visible = true;
	field: CrudField;
	
	get label(): string {
		return this.field.fieldName + (this.field.isKey ? ' (PK)' : '');
	}
}

class HealthcareCrudAppData implements IHealthcareCrudData {
	property: 'name' | 'component' | 'module' | 'controller' | 'description' | 'title' | 'appModule' | 'appVersion' | 'minVersion';
	value: string = '';
    kind = 0;
    visible = true;
    
    constructor(prop, visible?:boolean) {
        this.property = prop;
        if (visible != undefined)
            this.visible = visible;
    }
	
	get label(): string {
		switch(this.property) {
            case 'name': return 'Tabela: ' + this.value;
            case 'component': return 'Componente: ' + this.value;
			case 'description': return 'Descrição: ' + this.value;
			case 'title': return 'Título: ' + this.value;
			case 'appModule': return 'Módulo: ' + this.value;
			case 'appVersion': return 'Versão API: ' + this.value;
			case 'minVersion': return 'Versão Release: ' + this.value;
		}
		return this.value;
	}
}

class HealthcareCrudNode<T extends IHealthcareCrudData> {
	parent?: HealthcareCrudNode<T>;
	data: T;
	children: HealthcareCrudNode<T>[];

	constructor(data?: T) {
		this.children = [];
		this.data = data;
	}

	addChild(child: HealthcareCrudNode<T>) {
		child.parent = this;
		this.children.push(child);
    }
    
    get visible(): boolean {
        return this.data.visible;
    }

}

class HealthcareCrudDataProvider<T extends IHealthcareCrudData> implements vscode.TreeDataProvider<HealthcareCrudNode<T>> {
	private _onDidChangeTreeData: vscode.EventEmitter<HealthcareCrudNode<T> | null> = new vscode.EventEmitter<HealthcareCrudNode<T> | null>();
	readonly onDidChangeTreeData: vscode.Event<HealthcareCrudNode<T> | null> = this._onDidChangeTreeData.event;

	private context: vscode.ExtensionContext;
	private tree: HealthcareCrudNode<T>;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.tree = new HealthcareCrudNode<T>();
	}

	async getChildren(node?: HealthcareCrudNode<T>): Promise<HealthcareCrudNode<T>[]> {
		if (node) {
			return node.children.filter(item => item.visible);
		} else {
			return this.tree ? this.tree.children.filter(item => item.visible) : [];
		}
	}

	getParent(node: HealthcareCrudNode<T>): HealthcareCrudNode<T> {
		return node.parent;
	}

	getTreeItem(node: HealthcareCrudNode<T>): vscode.TreeItem {
		const { kind } = node.data;
		let treeItem = new vscode.TreeItem(node.data.label);

		if (node.children.length) {
			treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
		} else {
			treeItem.collapsibleState = vscode.TreeItemCollapsibleState.None;
		}

		/*treeItem.command = {
			command: 'healthcare.crud.app.edit',
			title: 'Editar',
			arguments: [node]
		};*/

		//treeItem.iconPath = getIcon(kind, this.context);

		return treeItem;
	}

	refresh() {
		this._onDidChangeTreeData.fire();
	}

	add(data: T) {
		this.tree.addChild(new HealthcareCrudNode(data));
    }
    
    getTree(): HealthcareCrudNode<T> {
        return this.tree;
    }

}

export class HealthcareCrudExtension {

	//view: vscode.TreeView<HealthcareCrudNode>;
	private context: vscode.ExtensionContext;
	private dataApp: HealthcareCrudDataProvider<HealthcareCrudAppData>;
	private dataFields: HealthcareCrudDataProvider<HealthcareCrudFieldData>;
	private dataEnums: HealthcareCrudDataProvider<HealthcareCrudMockData>;
	private dataZooms: HealthcareCrudDataProvider<HealthcareCrudMockData>;

    private selectedTable: MapTable;
    
    public onBuild: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();

	constructor(context: vscode.ExtensionContext) {
		this.context = context;

        this.clearProject();
		
		// views
		/*this.view =*/ vscode.window.createTreeView('healthcare.crud.app', { treeDataProvider: this.dataApp });
		/*this.view =*/ vscode.window.createTreeView('healthcare.crud.fields', { treeDataProvider: this.dataFields });
		/*this.view =*/ vscode.window.createTreeView('healthcare.crud.enums', { treeDataProvider: this.dataEnums });
		/*this.view =*/ vscode.window.createTreeView('healthcare.crud.zooms', { treeDataProvider: this.dataZooms });

		// comandos gerais
		this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.crud.generate', () => { this.onBuild.fire(this.buildProject()) }));
		this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.crud.new', () => {}));
		this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.crud.load', () => {}));
		// comandos view app
		this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.crud.app.edit', (node) => this.actionAppEdit(node)));
		// comandos view fields
		this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.crud.fields.add', () => this.actionFieldsAdd()));
		this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.crud.fields.edit', (node) => this.actionFieldsEdit(node)));
		this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.crud.fields.delete', (node) => this.actionFieldsDelete(node)));
		// comandos view enums
		this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.crud.enums.add', () => this.actionEnumsAdd()));
		this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.crud.enums.edit', (node) => this.actionEnumsEdit(node)));
		this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.crud.enums.delete', (node) => this.actionEnumsDelete(node)));
		// comandos view zooms
		this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.crud.zooms.add', () => this.actionZoomsAdd()));
		this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.crud.zooms.edit', (node) => this.actionZoomsEdit(node)));
		this.context.subscriptions.push(vscode.commands.registerCommand('healthcare.crud.zooms.delete', (node) => this.actionZoomsDelete(node)));
	}

	private clearProject() {
		this.dataApp = new HealthcareCrudDataProvider(this.context);
		this.dataFields = new HealthcareCrudDataProvider(this.context);
		this.dataEnums = new HealthcareCrudDataProvider(this.context);
		this.dataZooms = new HealthcareCrudDataProvider(this.context);
		this.selectedTable = null;

		this.appDefaultItems().forEach(item => this.dataApp.add(item));
    }
    
    private buildProject(): any {
        let result:any = {};
        result.id = 0;

        // app
        let dataApp = this.dataApp.getTree().children.map(item => item.data);
        dataApp.forEach(item => {
            result[item.property] = item.value;
        });
        // fields
        let dataFields = this.dataFields.getTree().children.map(item => item.data);
        result['fields'] = dataFields.map(item => item.field);
        // enums
        result['enumerators'] = [];
        // zooms
        result['zooms'] = [];

        return result;
    }

	private getRemainingFields(): string[] {
		if (this.selectedTable) 
			return this.selectedTable.fields.map(item => item.label).filter(item => !this.fieldInserted(item));
		return [];
    }
    
    private fieldInserted(fieldName: string): boolean {
        if (this.dataFields.getTree().children.find(item => item.data.field.fieldName == fieldName))
            return true;
        return false;
    }

	private actionAppEdit(node: HealthcareCrudNode<HealthcareCrudAppData>) {
		if (node.data.property == 'name') {
			vscode.commands.executeCommand('abl.tables').then((tables:string[]) => {
				vscode.window.showQuickPick(tables, {placeHolder: 'Tabela'}).then(table => {
					if (!table) return;
					node.data.value = table;
					// alterar Module e Controller
					vscode.commands.executeCommand('abl.table', table).then((data:MapTable) => {
						this.selectedTable = data;
						this.dataApp.getChildren().then(items => {
							items.find(n => n.data.property == 'description').data.value = data.detail;
                            items.find(n => n.data.property == 'title').data.value = 'Manutenção de ' + data.detail;
                            items.find(n => n.data.property == 'appVersion').data.value = 'v1';
                            items.find(n => n.data.property == 'appModule').data.value = 'hXX';
                            items.find(n => n.data.property == 'minVersion').data.value = '12.1.XX';
                            this.dataApp.refresh();
                            this.editApp(this.dataApp.getTree().children.map(item => item.data));
						})
					});
				});
			})
		}
		else {
			vscode.window.showInputBox({value: node.data.value, placeHolder: node.data.label}).then(value => { 
				if (!value) return;
				node.data.value = value;
				this.dataApp.refresh();	
			});
		}
	}

	private actionFieldsAdd() {
		let fields = this.getRemainingFields();
		if (fields.length > 0) {
			vscode.window.showQuickPick(fields, {placeHolder: 'Selecione o campo'}).then(value => {
				// perguntas para montar o campo...
				let field = this.selectedTable.fields.find(item => item.label == value);
				if (!field) return;
				// adiciona
				let crudField = new CrudField();
				crudField.id = 0;
				crudField.fieldName = field.label;
				crudField.description = field.detail;
                crudField.dataType = field.dataType;
                crudField.inputType = ablTypeToTypescriptType(crudField.dataType);
                crudField.inputFormat = ablFormatToTypescriptFormat(field.format, field.dataType);
                crudField.isVisible = true;
				crudField.isRequired = field.mandatory;
				crudField.isKey = this.selectedTable.indexes.filter(item => item.primary).find(item => { return item.fields.find(f => f.label == crudField.fieldName) ? true : false }) ? true : false;
                crudField.isFilter = crudField.isKey;
                crudField.isRangeFilter = crudField.isFilter && crudField.isKey;
                crudField.isEditable = !crudField.isKey;
                crudField.maxSize = ablFormatToFieldSize(field.format);
                this.editField(crudField);
			});
		}
		else {
			vscode.window.showInformationMessage('Nenhum campo restante para inclusão');
		}
	}
	private actionFieldsEdit(node: HealthcareCrudNode<HealthcareCrudFieldData>) {
        this.editField(node.data.field);
	}
	private actionFieldsDelete(node: HealthcareCrudNode<HealthcareCrudFieldData>) {
	}

	private actionEnumsAdd() {
	}
	private actionEnumsEdit(node: HealthcareCrudNode<HealthcareCrudMockData>) {
	}
	private actionEnumsDelete(node: HealthcareCrudNode<HealthcareCrudMockData>) {
	}

	private actionZoomsAdd() {
	}
	private actionZoomsEdit(node: HealthcareCrudNode<HealthcareCrudMockData>) {
	}
	private actionZoomsDelete(node: HealthcareCrudNode<HealthcareCrudMockData>) {
	}

	private appDefaultItems(): HealthcareCrudAppData[] {
        return [
            new HealthcareCrudAppData('name'),
            new HealthcareCrudAppData('component'),
            new HealthcareCrudAppData('module', false),
            new HealthcareCrudAppData('controller', false),
            new HealthcareCrudAppData('description'),
            new HealthcareCrudAppData('title'),
            new HealthcareCrudAppData('appModule'),
            new HealthcareCrudAppData('appVersion'),
            new HealthcareCrudAppData('minVersion'),
        ];
    }

    private editApp(props: HealthcareCrudAppData[]) {
        let fncComponent = (props: HealthcareCrudAppData[]): Promise<HealthcareCrudAppData[]> => {
            let prop = props.find(item => item.property == 'component');
            return new Promise(function(resolve,reject) {
                vscode.window.showInputBox({prompt:'Nome do componente',value:prop.value,placeHolder:'Nome em inglês, minúsculo, separado por hífens (ex: my-component)'})
                    .then(newValue => {
                        if (!newValue)
                            reject();
                        else {
                            prop.value = newValue;
                            resolve(props);
                        }                        
                    });
            })    
        }
        let fncSetModule = (props: HealthcareCrudAppData[]): Promise<HealthcareCrudAppData[]> => {
            let prop = props.find(item => item.property == 'module');
            let propComp = props.find(item => item.property == 'component');
            prop.value = toPascalCase(propComp.value);
            return Promise.resolve(props);
        }
        let fncSetController = (props: HealthcareCrudAppData[]): Promise<HealthcareCrudAppData[]> => {
            let prop = props.find(item => item.property == 'controller');
            let propComp = props.find(item => item.property == 'component');
            prop.value = toCamelCase(propComp.value);
            return Promise.resolve(props);
        }
        let fncDescription = (props: HealthcareCrudAppData[]): Promise<HealthcareCrudAppData[]> => {
            let prop = props.find(item => item.property == 'description');
            return new Promise(function(resolve,reject) {
                vscode.window.showInputBox({prompt:'Descrição',value:prop.value,placeHolder:'Nome descritivo'})
                    .then(newValue => {
                        if (!newValue)
                            reject();
                        else {
                            prop.value = newValue;
                            resolve(props);
                        }                        
                    });
            })    
        }
        let fncPageTitle = (props: HealthcareCrudAppData[]): Promise<HealthcareCrudAppData[]> => {
            let prop = props.find(item => item.property == 'title');
            return new Promise(function(resolve,reject) {
                vscode.window.showInputBox({prompt:'Título da Página',value:prop.value,placeHolder:'Título descritivo'})
                    .then(newValue => {
                        if (!newValue)
                            reject();
                        else {
                            prop.value = newValue;
                            resolve(props);
                        }                        
                    });
            })    
        }
        let fncAppModule = (props: HealthcareCrudAppData[]): Promise<HealthcareCrudAppData[]> => {
            let prop = props.find(item => item.property == 'appModule');
            return new Promise(function(resolve,reject) {
                vscode.window.showInputBox({prompt:'Módulo',value:prop.value,placeHolder:'Módulo do sistema (ex: hcg)'})
                    .then(newValue => {
                        if (!newValue)
                            reject();
                        else {
                            prop.value = newValue;
                            resolve(props);
                        }                        
                    });
            })    
        }
        let fncAppVersion = (props: HealthcareCrudAppData[]): Promise<HealthcareCrudAppData[]> => {
            let prop = props.find(item => item.property == 'appVersion');
            return new Promise(function(resolve,reject) {
                vscode.window.showInputBox({prompt:'Versão da API',value:prop.value,placeHolder:'Versão, iniciando sempre com v1'})
                    .then(newValue => {
                        if (!newValue)
                            reject();
                        else {
                            prop.value = newValue;
                            resolve(props);
                        }                        
                    });
            })    
        }
        let fncMinVersion = (props: HealthcareCrudAppData[]): Promise<HealthcareCrudAppData[]> => {
            let prop = props.find(item => item.property == 'minVersion');
            return new Promise(function(resolve,reject) {
                vscode.window.showInputBox({prompt:'Versão de release',value:prop.value,placeHolder:'Número da versão que estará disponível (ex: 12.1.21)'})
                    .then(newValue => {
                        if (!newValue)
                            reject();
                        else {
                            prop.value = newValue;
                            resolve(props);
                        }                        
                    });
            })    
        }
        let fncRefresh = (props: HealthcareCrudAppData[]): Promise<HealthcareCrudAppData[]> => {
            this.dataApp.refresh();
            return Promise.resolve(props);
        }

        let tasks = [fncComponent,fncSetModule,fncSetController,fncDescription,fncPageTitle,fncAppModule,fncAppVersion,fncMinVersion,fncRefresh];

        this.resolveSequence(tasks, props).catch(e => {});   
    }
    
    private editField(field: CrudField) {
        let fncName = (newField: CrudField): Promise<CrudField> => {
            return new Promise(function(resolve,reject) {
                vscode.window.showInputBox({prompt:'Nome do campo (API)',value:newField.name,placeHolder:'Nome em inglês, camelCase (ex: myProperty)'})
                    .then(valueName => {
                        if (!valueName)
                            reject();
                        else {
                            newField.name = valueName;
                            resolve(newField);
                        }                        
                    });
            })    
        }
        let fncDesc = (newField: CrudField): Promise<CrudField> => {
            return new Promise(function(resolve,reject) {
                vscode.window.showInputBox({prompt:'Descrição do campo',value:newField.description})
                    .then(valueDescription => {
                        if (!valueDescription)
                            reject();
                        else {
                            newField.description = valueDescription;
                            resolve(newField);
                        }                        
                    });
            })    
        }
        let fncDatabaseType = (newField: CrudField): Promise<CrudField> => {
            return new Promise(function(resolve,reject) {
                vscode.window.showInputBox({prompt:'Tipo de dado (banco de dados)',value:newField.dataType})
                    .then(valueDbType => {
                        if (valueDbType == undefined)
                            reject();
                        else {
                            newField.dataType = valueDbType;
                            resolve(newField);
                        }                        
                    });
            })    
        }
        

        //iputType
        //inputFormat
        //maxSize
        //default value
        //fixed value

        //comp entrada//zoom/enum



        let fncOptions = (newField: CrudField): Promise<CrudField> => {
            let qp1: vscode.QuickPickItem = {label:CrudFieldOptions.PK, picked: newField.isKey, description:'Campo é a chave primária da tabela'};
            let qp2: vscode.QuickPickItem = {label:CrudFieldOptions.REQUIRED, picked: newField.isRequired, description:'É obrigatório o preenchimento'};
            let qp3: vscode.QuickPickItem = {label:CrudFieldOptions.VISIBLE, picked: newField.isVisible, description:'É visível na edição ou detalhes'};
            let qp4: vscode.QuickPickItem = {label:CrudFieldOptions.EDITABLE, picked: newField.isEditable, description:'Pode ser alterado depois de já inserido'};
            let qp5: vscode.QuickPickItem = {label:CrudFieldOptions.LISTED, picked: newField.isListable, description:'Aparece na tela de listagem'};
            let qp6: vscode.QuickPickItem = {label:CrudFieldOptions.LINK, picked: newField.isLink, description:'Cria um link para os detalhes do registro'};
            let qp7: vscode.QuickPickItem = {label:CrudFieldOptions.FILTER, picked: newField.isFilter, description:'Pode ser filtrado'};
            let qp8: vscode.QuickPickItem = {label:CrudFieldOptions.RANGE_FILTER, picked: newField.isRangeFilter, description:'O filtro é por faixa (inicial/final)'};
            return new Promise(function(resolve,reject) {
                vscode.window.showQuickPick([qp1,qp2,qp3,qp4,qp5,qp6,qp7,qp8], {canPickMany: true, placeHolder: 'Opções'}).then(valueOptions => {
                    if (valueOptions == undefined) 
                        reject();
                    else {
                        newField.isKey = valueOptions.find(v => v.label == CrudFieldOptions.PK) ? true : false;
                        newField.isRequired = valueOptions.find(v => v.label == CrudFieldOptions.REQUIRED) ? true : false;
                        newField.isVisible = valueOptions.find(v => v.label == CrudFieldOptions.VISIBLE) ? true : false;
                        newField.isEditable = valueOptions.find(v => v.label == CrudFieldOptions.EDITABLE) ? true : false;
                        newField.isListable = valueOptions.find(v => v.label == CrudFieldOptions.LISTED) ? true : false;
                        newField.isLink = valueOptions.find(v => v.label == CrudFieldOptions.LINK) ? true : false;
                        newField.isFilter = valueOptions.find(v => v.label == CrudFieldOptions.FILTER) ? true : false;
                        newField.isRangeFilter = valueOptions.find(v => v.label == CrudFieldOptions.RANGE_FILTER) ? true : false;
                        resolve(newField);
                    }
                })
            })
            
        }
        let fncSave = (newField: CrudField): Promise<CrudField> => {
            Object.assign(field, newField);
            // inclui se necessario
            if (!this.fieldInserted(newField.fieldName)) {
                let data = new HealthcareCrudFieldData();
                data.field = field;
				this.dataFields.add(data);
            }
            this.dataFields.refresh();
            return Promise.resolve(newField);
        }

        

        let newField = new CrudField();
        Object.assign(newField, field);

        let tasks = [fncName,fncDesc,fncDatabaseType,fncOptions,fncSave];

        this.resolveSequence(tasks, newField).catch(e => {});   
    }

    private resolveSequence(sequence: ((...params:any) => Promise<any>)[], ...params:any): Promise<boolean> {
        if (sequence.length > 0) {
            let s = sequence.shift();
            return s(...params)
                .then(ok => { return this.resolveSequence(sequence, ...params) })
                .catch(e => { return Promise.reject() });
        }
        else {
            return Promise.resolve(true);
        }
    }
}
