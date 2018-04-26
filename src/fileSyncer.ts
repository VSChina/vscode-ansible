'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import * as azHelper from './azureStorageHelper';
import * as fs from 'fs-extra';
import * as path from 'path';
import { SSHServer } from './interfaces';
import * as sshHelper from './sshRunner';

export enum TargetType {
    cloudshell = 'cloudshell',
    remotehost = 'remotehost'
}

export class FileSyncer {

    protected _outputChannel: vscode.OutputChannel;


    constructor(outputChannel: vscode.OutputChannel) {
        this._outputChannel = outputChannel;

    }

    public syncFolderToRemoteSSHHost(): void {
        let rootWorkspace = '';
        if (vscode.workspace.workspaceFolders) {
            rootWorkspace = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        vscode.window.showInputBox({ value: rootWorkspace, prompt: 'Please input folder path', placeHolder: 'folder', password: false })
            .then((folder) => {
                if (!folder) {
                    return
                }

                if (!fs.existsSync(folder)) {
                    this._outputChannel.appendLine('Folder not exists: ' + folder);
                    return;
                }
                sshHelper.getSSHServer()
                    .then((server) => {

                        if (!server) {
                            return;
                        }

                        this._outputChannel.append('Copying folder ' + folder + ' to ' + server.host);
                        this._outputChannel.show();

                        const progress = utilities.delayedInterval(() => { this._outputChannel.append('.') }, 500);
                        utilities.copyFileRemote(folder, this.getTargetFolder(folder), server, (err) => {
                            progress.cancel();
                            if (err) {
                                this._outputChannel.appendLine('\nFailed to copy folder to remote: ' + err);
                                this._outputChannel.show();
                                return;
                            }
                            this._outputChannel.appendLine('Done!');
                            this._outputChannel.show();
                            return;
                        })
                        return;
                    })
            })

    }

    private getTargetFolder(srcFolder: string): string {
        return '\./' + path.basename(srcFolder);
    }
}