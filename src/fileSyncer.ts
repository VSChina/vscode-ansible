'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import * as fs from 'fs-extra';
import * as path from 'path';
import { SSHServer, FileCopyConfigs, FileCopyConfig } from './interfaces';
import { StatusBarAlignment } from 'vscode';
import { Constants } from './constants';

const browseThePC = 'Browse the PC..';

export enum TargetType {
    cloudshell = 'cloudshell',
    remotehost = 'remotehost'
}


export class FileSyncer {
    protected _statusBar: vscode.StatusBarItem;
    protected _outputChannel: vscode.OutputChannel;
    protected _configuration: FileCopyConfigs;
    protected _hosts: { key: string, string };

    constructor(outputChannel: vscode.OutputChannel) {
        this._outputChannel = outputChannel;
        this._configuration = utilities.getCodeConfiguration('ansible', Constants.Config_fileCopyConfig);
        this._statusBar = vscode.window.createStatusBarItem(StatusBarAlignment.Right, 100);
    }

    public onConfigurationChange(config: any): void {
        // check if changed
        let updatedConfig = this.getChangedConfiguration(this._configuration, config);

        this.copyFiles(updatedConfig);

        this._configuration = config;
    }

    protected getChangedConfiguration(oldConfig: FileCopyConfigs, newConfig: FileCopyConfigs) {
        let result = [];

        if (!oldConfig || oldConfig.length === 0) {
            return newConfig;
        }

        if (!newConfig) {
            return result;
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

    public copyFiles(configuration: FileCopyConfigs, fileName: string = null) {
        let servers = utilities.getSSHConfig();

        if (!configuration) {
            if (!this._configuration) {
                return;
            }
            configuration = this._configuration;
        }

        for (let item of configuration) {
            // get server
            let server = this.getServer(servers, item.server);

            if (!server) {
                this._statusBar.text = "Invalid host " + item.server;
                this._statusBar.show();
            }

            let source = item.sourcePath;
            let target = item.targetPath;
            if (target === Constants.NotShowThisAgain) {
                continue;
            }
            if (fileName != null) {
                // check if file under configured source path
                if ((!this.isExcluded(fileName)) && utilities.isSubPath(fileName, item.sourcePath)) {
                    source = fileName;
                    target = path.join(item.targetPath, path.relative(item.sourcePath, fileName));
                } else {
                    continue;
                }
            }

            this._statusBar.text = "Copying " + source + " to " + item.server;
            this._statusBar.show();

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

    private isExcluded(fileName): boolean {
        if (fileName.endsWith(path.join('.vscode', path.win32.sep, 'settings.json')) ||
            fileName.endsWith(path.join('.vscode', path.posix.sep, 'settings.json'))) {
            return true;
        }
        return false;
    }
}