import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class TastTreeProvider implements vscode.TreeDataProvider<Dependency> {
  constructor(private workspaceRoot: string) {}

  getTreeItem(element: Dependency): vscode.TreeItem {
    return element;
  }

  getChildren(element?: Dependency): Thenable<Dependency[]> {
    if (!this.workspaceRoot) {
      vscode.window.showInformationMessage('No dependency in empty workspace');
      return Promise.resolve([]);
    }

    if (element) {
      let dataAux:Array<Dependency> = [];
      dataAux = this.getTastList(
        path.join(this.workspaceRoot, '.totvs.healthcare-dev.tast.list.json')
      )
      let contAux = 1;
      dataAux.map((element:Dependency) => {
        element.collapsibleState = vscode.TreeItemCollapsibleState.None;
        element.label = 'CT_caso_de_teste_' + contAux + '.r';
        element.description = element.label;
        element.name = element.label;
        element.iconPath = {
          light: path.join(vscode.workspace.rootPath + '', 'assets', 'flask-white.svg'),
          dark: path.join(vscode.workspace.rootPath + '', 'assets', 'flask-white.svg')
        };
        contAux++;
      });
      return Promise.resolve(dataAux);
    } else {
      const packageJsonPath = path.join(this.workspaceRoot, '.totvs.healthcare-dev.tast.list.json');
      if (this.pathExists(packageJsonPath)) {
        return Promise.resolve(this.getTastList(packageJsonPath));
      } else {
        vscode.window.showInformationMessage('Você não possui o arquivo .totvs.healthcare-dev.tast.list.json atualize sua lista de CT\'s');
        return Promise.resolve([]);
      }
    }
  }

  private pathExists(p: string): boolean {
    try {
      fs.accessSync(p);
    } catch (err) {
      return false;
    }
    return true;
  }

  private getTastList(jsonPath: string): Dependency[] {
    if (this.pathExists(jsonPath)) {
        const dataListJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        
        let tastData:Array<Dependency>  = [];
        if(dataListJson.length){
          
          dataListJson.forEach((element:any) => {
              tastData.push(new Dependency(element.id, element.caseName , element.propathCase + element.caseName,vscode.TreeItemCollapsibleState.None))
          });

        }
        
        return tastData;
    } else {
        return [];
    }
  }
  


  private _onDidChangeTreeData: vscode.EventEmitter<Dependency | undefined | null | void> = new vscode.EventEmitter<Dependency | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<Dependency | undefined | null | void> = this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}

export class Dependency extends vscode.TreeItem {
  constructor(
    public label: string,
    public name: string,
    private propath: string,
    public collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    this.tooltip = `${this.label}-${this.name}`;
    this.description = this.name;
    this.propath = propath;

  }

  iconPath = {
    light: path.join(vscode.workspace.rootPath + '', 'assets', 'engrenagem.svg'),
    dark: path.join(vscode.workspace.rootPath + '', 'assets', 'engrenagem.svg')
  };
}