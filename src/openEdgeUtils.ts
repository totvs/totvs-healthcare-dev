import * as vscode from 'vscode';
import { OpenEdgeConfig } from './configFile';
import { isNullOrUndefined } from 'util';

export class HealthcareOpenEdgeUtils {

    private readonly EXT_OPENEDGE_1 = 'ezequielgandolfi.openedge-zext';
    private readonly EXT_OPENEDGE_2 = 'rafaelcanal.gps-abl';

    compile(sourceFile: string, config?: OpenEdgeConfig): Promise<any> {
        return new Promise(resolve => {
            if (this.hasOpenEdgeExtension()) {
                vscode.commands.executeCommand('abl.compile', sourceFile, config).then(() => { resolve() });
            }
            else {
                resolve();
            }
        });
    }

    hasOpenEdgeExtension(showAlert?:boolean): boolean {
        let result = !isNullOrUndefined(vscode.extensions.all.find(item => item.id == this.EXT_OPENEDGE_1)) || !isNullOrUndefined(vscode.extensions.all.find(item => item.id == this.EXT_OPENEDGE_2));
        if (!result && showAlert) {
            vscode.window.showErrorMessage(
                'Necessário instalar a extensão ' 
                + '"' + this.EXT_OPENEDGE_1 + '"' + ' ou '
                + '"' + this.EXT_OPENEDGE_2 + '"'
                + ' !!!');
        }
        return result;
    }
}
