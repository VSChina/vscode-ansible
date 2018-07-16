'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import * as fs from 'fs-extra';
import * as path from 'path';
import { SSHServer } from './interfaces';
import * as sshHelper from './sshRunner';
import * as async from 'async';

const browseThePC = 'Browse the PC..';

export enum TargetType {
    cloudshell = 'cloudshell',
    remotehost = 'remotehost'
}

export interface FileSyncConfiguration {
    server: string,
    sourcePath: string,
    targetPath: string
}

export type Configurations = FileSyncConfiguration[];

export class FileSyncer {

    protected _outputChannel: vscode.OutputChannel;
    protected _configuration: Configurations;
    protected _hosts: { key: string, string };

    constructor(outputChannel: vscode.OutputChannel) {
        this._outputChannel = outputChannel;
        this._configuration = utilities.getCodeConfiguration('ansible', 'fileSyncOnSave');
    }

    public updateConfiguration(config: any): void {
        // check if changed
        let updatedConfig = this.hasConfigurationChanged(this._configuration, config);

        // copy
        let servers = utilities.getSSHConfig();

        async.each(updatedConfig, (item, cb) => {
            let remoteHost = null;
            servers.forEach((m) => {
                if (m.host === item.server) {
                    return remoteHost = m;
                }
            });

            if (remoteHost === null) {
                this._outputChannel.appendLine("Invalid remote host in configuration " + item.server);
                this._outputChannel.show();
                return;
            }
            utilities.copyFilesRemote(item.sourcePath, item.targetPath, remoteHost)
                .catch((err) => {
                    this._outputChannel.appendLine('\nFailed to copy ' + item.sourcePath + ' to ' + item.server + ': ' + err);
                    this._outputChannel.show();
                    throw err;
                });
        });
    }

    protected hasConfigurationChanged(oldConfig: Configurations, newConfig: Configurations) {
        let result = [];

        if (!oldConfig || oldConfig.length === 0) {
            return newConfig;
        }

        for (let newc of newConfig) {
            let exists = false;
            for (let old of oldConfig) {
                if (newc.server === old.server && newc.sourcePath === old.sourcePath && newc.targetPath === old.targetPath) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                result.push(newc);
            }
        }

        return result;
    }

    public async syncFile(fileName: string) {
        for (var item of this._configuration) {
            if (item.sourcePath.toLowerCase() === fileName.toLowerCase() ||
                fileName.toLowerCase().startsWith(item.sourcePath.toLowerCase() + path.sep)) {
                // get server

                if (item["serverinfo"] === undefined) {
                    let server = utilities.getSSHServer(item.server);

                    if (server === null) {
                        this._outputChannel.appendLine("Invalid remote server " + item.server);
                        return;
                    }

                    item["serverinfo"] = server;
                }

                // if directory exists on remote
                let targetFileName = path.join(item.targetPath, path.relative(fileName, item.sourcePath));

                return utilities.copyFilesRemote(fileName, targetFileName, item["serverinfo"])
                    .then(() => {
                    })
                    .catch((err) => {
                        this._outputChannel.appendLine('\nFailed to copy ' + fileName + ' to ' + item.server + ': ' + err);
                        this._outputChannel.show();
                        throw err;
                    });
            }
        }
    }
}