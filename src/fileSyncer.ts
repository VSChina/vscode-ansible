'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import * as fs from 'fs-extra';
import * as path from 'path';
import { SSHServer } from './interfaces';
import * as sshHelper from './sshRunner';
import * as async from 'async';
import { StatusBarAlignment } from 'vscode';

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

export type FileSyncConfigurations = FileSyncConfiguration[];

export class FileSyncer {
    protected _statusBar: vscode.StatusBarItem;
    protected _outputChannel: vscode.OutputChannel;
    protected _configuration: FileSyncConfigurations;
    protected _hosts: { key: string, string };

    constructor(outputChannel: vscode.OutputChannel) {
        this._outputChannel = outputChannel;
        this._configuration = utilities.getCodeConfiguration('ansible', 'copyFileOnSave');
        this._statusBar = vscode.window.createStatusBarItem(StatusBarAlignment.Right, 100);
    }

    public updateConfiguration(config: any): void {
        // check if changed
        let updatedConfig = this.hasConfigurationChanged(this._configuration, config);

        this.copyFiles(updatedConfig);

        this._configuration = config;
    }

    protected hasConfigurationChanged(oldConfig: FileSyncConfigurations, newConfig: FileSyncConfigurations) {
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

    public async copyFiles(configuration: FileSyncConfigurations, fileName: string = null) {
        let servers = utilities.getSSHConfig();

        if (configuration === null) {
            configuration = this._configuration;
        }

        for (let item of configuration) {
            // get server
            let server = this.getServer(servers, item.server);

            if (server === null) {
                this._statusBar.text = "Invalid host " + item.server;
                this._statusBar.show();
            }

            let source = item.sourcePath;
            let target = item.targetPath;
            if (fileName != null) {
                // check if file under configured source path
                if (fileName.startsWith(item.sourcePath + path.sep)) {
                    source = fileName;
                    target = path.join(item.targetPath, path.relative(item.sourcePath, fileName));
                } else {
                    return;
                }
            }
            utilities.copyFilesRemote(source, target, server)
                .then(() => {
                    this._statusBar.text = "Copied " + source + " to " + item.server;
                    this._statusBar.show();
                })
                .catch((err) => {
                    this._statusBar.text = "Failed to copy " + source + " to " + item.server;
                    this._statusBar.show();
                    this._outputChannel.appendLine('\nFailed to copy ' + source + ' to ' + item.server + ': ' + err);
                    this._outputChannel.show();
                    throw err;
                });
        }
    }


    public getServer(servers: SSHServer[], serverName: string): SSHServer {
        for (let s of servers) {
            if (s.host === serverName) {
                return s;
            }
        }
        return null;
    }
}