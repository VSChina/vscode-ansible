'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import * as fs from 'fs-extra';
import * as path from 'path';
import { SSHServer, FileCopyConfigs } from './interfaces';
import * as sshHelper from './sshRunner';
import { Constants } from './constants';

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

    public async syncFolder(defaultPath: string, sshServer: SSHServer, allowFolderBrowse: boolean): Promise<void> {

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

        let targetPath = await this.getTargetFolder(sourceFolder, targetServer.host);

        if (!targetPath) {
            return;
        }

        // copy
        this._outputChannel.append('Copying folder ' + sourceFolder + ' to ' + targetServer.host);
        this._outputChannel.show();

        const progress = utilities.delayedInterval(() => { this._outputChannel.append('.') }, 800);

        return utilities.copyFilesRemote(sourceFolder, targetPath, targetServer)
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


    private async getTargetFolder(srcFolder: string, targetHostName: string): Promise<string> {
        let existingConfig = utilities.getCodeConfiguration<FileCopyConfigs>('ansible', Constants.Config_fileCopyConfig);

        let configuredTargetPath = "";
        if (existingConfig) {
            for (let config of existingConfig) {
                if (!config.server || !config.sourcePath || !config.targetPath) {
                    break;
                }

                if (config.server.toLowerCase() == targetHostName.toLowerCase() && path.relative(config.sourcePath, srcFolder) == "") {
                    configuredTargetPath = config.targetPath;
                    continue;
                }
            }
        }

        let targetPath = await vscode.window.showInputBox({
            value: configuredTargetPath,
            prompt: 'target path on remote host',
            placeHolder: configuredTargetPath,
            password: false
        });
        return targetPath;
    }
}