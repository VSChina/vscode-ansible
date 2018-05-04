'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import * as fs from 'fs-extra';
import * as path from 'path';
import { SSHServer } from './interfaces';
import * as sshHelper from './sshRunner';

const browseThePC = 'Browse the PC..';

export enum TargetType {
    cloudshell = 'cloudshell',
    remotehost = 'remotehost'
}

export class FolderSyncer {

    protected _outputChannel: vscode.OutputChannel;


    constructor(outputChannel: vscode.OutputChannel) {
        this._outputChannel = outputChannel;
    }

    public async syncFolder(defaultPath: string, targetPath: string, sshServer: SSHServer, allowFolderBrowse: boolean): Promise<void> {

        let sourceFolder = defaultPath;

        if (allowFolderBrowse) {
            let pickItems = [defaultPath, browseThePC];

            let pick = await vscode.window.showQuickPick(pickItems);

            if (!pick) {
                return;
            }

            // browse PC to get source folder
            if (pick === browseThePC) {
                var result = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    canSelectMany: false
                });
                if (result && result.length === 1) {
                    sourceFolder = result[0].fsPath;
                } else {
                    return;
                }
            }
        }

        if (!sourceFolder) {
            return;
        }

        if (!fs.existsSync(sourceFolder)) {
            this._outputChannel.appendLine('No such file or directory ' + sourceFolder);
            this._outputChannel.show();
            return;
        }

        // if server not specified, let user pick one
        let targetServer = sshServer;
        if (!targetServer) {
            targetServer = await sshHelper.getSSHServer();

            if (!targetServer) {
                return;
            }
        }

        // copy
        this._outputChannel.append('Copying folder ' + sourceFolder + ' to ' + targetServer.host);
        this._outputChannel.show();

        const progress = utilities.delayedInterval(() => { this._outputChannel.append('.') }, 800);

        return utilities.copyFilesRemote(sourceFolder, this.getTargetFolder(sourceFolder), targetServer)
            .then(() => {
                progress.cancel();

                this._outputChannel.appendLine('Done!');
                this._outputChannel.show();

            })
            .catch((err) => {
                progress.cancel();

                this._outputChannel.appendLine('\nFailed to copy ' + sourceFolder + ' to ' + targetServer.host + ': ' + err);
                this._outputChannel.show();
                throw err;
            });
    }


    private getTargetFolder(srcFolder: string): string {
        return '\./' + path.basename(srcFolder);
    }
}