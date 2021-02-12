import * as vscode from 'vscode';
import { OpenEdgeConfig } from './configFile';

export class HealthcareOpenEdgeUtils {

    private readonly EXT_OPENEDGE_1 = 'ezequielgandolfi.openedge-zext';
    private readonly EXT_OPENEDGE_2 = 'rafaelcanal.gps-abl';

    compile(sourceFile: string, config?: OpenEdgeConfig): Promise<any> {
        return new Promise(resolve => {
            if (this.hasOpenEdgeExtension()) {
                vscode.commands.executeCommand('abl.compile', sourceFile, config).then(() => { resolve(null) });
            }
            else {
                resolve(null);
            }
        });
    }

    hasOpenEdgeExtension(showAlert?:boolean): boolean {
        let result = !!(vscode.extensions.all.find(item => item.id == this.EXT_OPENEDGE_1) || vscode.extensions.all.find(item => item.id == this.EXT_OPENEDGE_2));
        if (!result && showAlert) {
            vscode.window.showErrorMessage(
                'Necessário instalar a extensão ' 
                + '"' + this.EXT_OPENEDGE_1 + '"' + ' ou '
                + '"' + this.EXT_OPENEDGE_2 + '"'
                + ' !!!');
        }
        return result;
    }

    hasMinimalOpenEdgeExtension(extensionVersion: string, showAlert?:boolean): boolean {
        let result = false;
        let ext = vscode.extensions.all.find(item => item.id == this.EXT_OPENEDGE_1);
        if (ext) {
            const extVer: string = ext.packageJSON.version;
            if (extVer) {
                const version = extVer.split('.').map(v => parseInt(v));
                const minVersion = extensionVersion.split('.').map(v => parseInt(v));
                if (version.length >= minVersion.length) {
                    result = true;
                    for (let i = 0; i < minVersion.length; i++) {
                        if (version[i] > minVersion[i]) {
                            break;
                        }
                        if (version[i] < minVersion[i]) {
                            result = false;
                            break;
                        }
                    }
                }
            }
            
        }
        if (!result && showAlert) {
            vscode.window.showErrorMessage(`Necessário instalar a extensão "${this.EXT_OPENEDGE_1}" na versão ${extensionVersion} ou superior`);
        }
        return result;
    }
}
