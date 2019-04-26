'use strict';

import * as ssh from 'ssh2';
import { TerminalBaseRunner } from './terminalBaseRunner';
import * as vscode from 'vscode';
import { SSHServer, FileCopyConfigs, FileCopyConfig } from './interfaces';
import * as utilities from './utilities';
import { Constants } from './constants';
import { TelemetryClient } from './telemetryClient';
import * as path from 'path';
import * as fs from 'fs-extra';
import { openSSHConsole } from './SSHConsole';
import * as os from 'os';
import { setInterval, clearInterval } from 'timers';
import { FolderSyncer } from './folderSyncer';

const addNewHost = 'Add New Host';
const browseThePC = 'Browse the PC..';

export class SSHRunner extends TerminalBaseRunner {
    private folderSyncer: FolderSyncer;
    private terminalList: { [key: string]: vscode.Terminal } = {};

    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);

        this.folderSyncer = new FolderSyncer(outputChannel);

        vscode.window.onDidCloseTerminal((terminal) => {

            var terminalNames = Object.keys(this.terminalList);
            for (let name of terminalNames) {
                if (name === terminal.name) {
                    this.terminalList[name].dispose();
                    delete this.terminalList[name];
                    break;
                }
            }
        });
    }

    protected getCmds(playbook: string, envs: string[], terminalId: string): string[] {
        var cmdsToTerminal = [];

        if (envs) {
            for (var item in envs) {
                cmdsToTerminal.push('export ' + item + '=' + envs[item]);
            }
        }

        // add azure user agent
        if (utilities.isTelemetryEnabled()) {
            cmdsToTerminal.push('export ' + Constants.UserAgentName + '=' + utilities.getUserAgent());
        }
        return cmdsToTerminal;
    }

    protected async runAnsibleInTerminal(playbook: string, cmds, terminalId: string): Promise<void> {
        TelemetryClient.sendEvent('ssh');

        // check node is installed
        if (!await utilities.IsNodeInstalled()) {
            return;
        }

        // get ssh server
        let targetServer = await getSSHServer();
        if (!targetServer) {
            return;
        }

        // set default source file/folder, destination file/folder, destination playbook name
        // default copy playbook to home directory
        let source = playbook;
        let target = path.join('\./', path.basename(playbook));
        let targetFolder = ".";
        let targetPlaybook = target;

        // check configuration
        let fileConfig = this.getWorkSpaceFileCopyConfig(playbook, targetServer.host);

        if (fileConfig) {
            if (fileConfig.targetPath != Constants.NotShowThisAgain) {
                targetPlaybook = utilities.posixPath(path.join(fileConfig.targetPath, path.relative(fileConfig.sourcePath, playbook)));

                // if not saved on copy, copy playbook to remote
                if (!fileConfig.copyOnSave) {
                    await utilities.copyFilesRemote(source, targetPlaybook, targetServer);
                }

                // set ssh session default folder to target folder
                targetFolder = fileConfig.targetPath;
                cmds.push("cd " + fileConfig.targetPath);
            }
        } else {
            // if no config in settings.json, ask for promote whether to copy workspace, then do copy, then run it.
            const okItem: vscode.MessageItem = { title: "always" };
            const cancelItem: vscode.MessageItem = { title: "no, not show this again" };
            let response = await vscode.window.showWarningMessage('Copy workspace to remote host?', okItem, cancelItem);
            let existingConfig = utilities.getCodeConfiguration<FileCopyConfigs>('ansible', 'fileCopyConfig');

            if (!existingConfig) {
                existingConfig = [];
            }

            let fileConfig: FileCopyConfig = {
                server: targetServer.host,
                sourcePath: utilities.getWorkspaceRoot(playbook) + '/',
                targetPath: path.join('\./', path.basename(utilities.getWorkspaceRoot(playbook))) + '/',
                copyOnSave: true
            };

            if (response && response === okItem) {
                targetPlaybook = utilities.posixPath(['\./' + path.basename(fileConfig.sourcePath), path.relative(fileConfig.sourcePath, playbook)]
                    .join(path.posix.sep));

                // do workspace copy
                this._outputChannel.append("\nCopy " + fileConfig.sourcePath + " to " + fileConfig.server);
                const progress = this.delayedInterval(() => { this._outputChannel.append('.') }, 800);
                try {
                    await utilities.copyFilesRemote(fileConfig.sourcePath, fileConfig.targetPath, targetServer);
                    progress.cancel();
                } catch (err) {
                    progress.cancel();
                    if (err) {
                        this._outputChannel.appendLine('\nFailed to copy ' + fileConfig.sourcePath + ' to ' + targetServer.host + ': ' + err);
                        this._outputChannel.show();
                    }
                    return;
                }

                targetFolder = fileConfig.targetPath;
                cmds.push("cd " + fileConfig.targetPath);
            } else {
                fileConfig.targetPath = Constants.NotShowThisAgain;
                // if cancel, copy playbook only
                await utilities.copyFilesRemote(source, target, targetServer);
            }

            // update config
            existingConfig.push(fileConfig);            
            utilities.updateCodeConfiguration('ansible', 'fileCopyConfig', existingConfig);
        }
        // run playbook
        cmds.push("cd " + targetFolder);
        cmds.push(this.getRunPlaybookCmd(path.relative(targetFolder, targetPlaybook)));
        this.OpenTerminal(targetServer, targetPlaybook, cmds);
    }

    private OpenTerminal(server: SSHServer, targetPlaybook: string, cmds): void {
        let terminal = undefined;

        let reuse = utilities.getCodeConfiguration<boolean>('ansible', 'reuseSSHTerminal');
        if (reuse) {
            // if reuse, directly return
            let terminalNames = Object.keys(this.terminalList);
            for (let t of terminalNames) {
                if (t === this.getTerminalName(server.host)) {
                    terminal = this.terminalList[t];
                    break;
                }
            }
        }

        if (terminal) {
            terminal.show();
            this.sendCommandsToTerminal(terminal, cmds);

        } else {
            openSSHConsole(this._outputChannel, server)
                .then((term) => {
                    if (!term) {
                        this._outputChannel.appendLine('\nSSH connection failed.');
                        this._outputChannel.show();
                        return;
                    }
                    this.terminalList[this.getTerminalName(server.host)] = term;

                    var count: number = 60;
                    var _localthis = this;
                    const tempFile = path.join(os.tmpdir(), 'vscodeansible-ssh-' + server.host + '.log');

                    var interval = setInterval(function () {
                        count--;
                        if (count > 0) {
                            if (fs.existsSync(tempFile)) {
                                count = 0;
                                fs.removeSync(tempFile);

                                _localthis.sendCommandsToTerminal(term, cmds);
                                term.show();

                                clearInterval(interval);
                            }
                        } else {
                            clearInterval(interval);
                            _localthis._outputChannel.appendLine('\nFailed to connect to ' + server.host + ' after 30 seconds');
                        }
                    }, 500);
                });
        }
    }

    private getTerminalName(host: string): string {
        return 'SSH ' + host;
    }

    private sendCommandsToTerminal(terminal: vscode.Terminal, cmds: string[]): void {
        for (let cmd of cmds) {
            terminal.sendText(cmd);
        }
    }

    private getTargetFolder(workspaceRoot: string, playbook: string): string {
        return '\./' + path.relative(workspaceRoot, path.dirname(playbook));
    }

    private delayedInterval(func: () => void, interval: number) {
        const handle = setInterval(func, interval);
        return {
            cancel: () => clearInterval(handle)
        }
    }

    private getWorkSpaceFileCopyConfig(playbook: string, host: string): FileCopyConfig {
        let fileSyncConfig = utilities.getCodeConfiguration<FileCopyConfigs>('ansible', 'fileCopyConfig');

        if (fileSyncConfig) {
            for (let config of fileSyncConfig) {
                if (config.server === host && utilities.isSubPath(playbook, config.sourcePath)) {
                    return config;
                }
            }
        }
        return null;
    }
}


export type Hosts = { [key: string]: SSHServer };

export async function addSSHServer(): Promise<SSHServer> {

    let server = <SSHServer>{};
    var host = await vscode.window.showInputBox({ value: 'host', prompt: 'SSH host', placeHolder: 'host', password: false });
    if (host) {
        var port = await vscode.window.showInputBox({ value: '22', prompt: 'SSH port', placeHolder: 'port', password: false });
        if (port) {
            var user = await vscode.window.showInputBox({ value: '', prompt: 'SSH username', placeHolder: 'username', password: false });
            if (user && user != '') {
                var password = await vscode.window.showInputBox({ value: '', prompt: 'SSH password', placeHolder: 'password', password: true });
                server.host = host;
                server.port = +port;
                server.user = user;

                if (password && password != '') {
                    server.password = password;
                    utilities.updateSSHConfig(server);
                    return server;
                } else {
                    var defaultPath = path.join(os.homedir(), '.ssh', 'id_rsa');
                    var items = [defaultPath, browseThePC];

                    var pick = await vscode.window.showQuickPick(items);

                    if (pick) {
                        var keyfile = pick;
                        if (pick === browseThePC) {
                            var result = await vscode.window.showOpenDialog({
                                canSelectFiles: true,
                                canSelectFolders: false, canSelectMany: false
                            });
                            if (result && result.length === 1) {
                                keyfile = result[0].fsPath;
                            }
                        }
                        if (!fs.existsSync(keyfile)) {
                            this._outputChannel.appendLine('Invalid key file: ' + keyfile);
                            return null;
                        }

                        server.key = keyfile;

                        if (keyfile) {
                            var passphrase = await vscode.window.showInputBox({ value: '', prompt: 'key passphrase', placeHolder: 'passphrase', password: true });

                            if (passphrase) {
                                server.passphrase = passphrase;
                            }

                            utilities.updateSSHConfig(server);
                            return server;
                        }
                    }
                }
            }
        }
    }
    return null;
}

export async function getSSHServer(): Promise<SSHServer> {
    let servers = utilities.getSSHConfig();
    let server = <SSHServer>{};

    if (servers) {
        let hosts = <Hosts>{};
        for (let host of servers) {
            hosts[host.host] = host;
        }

        var quickPickList = Object.keys(hosts);
        quickPickList.push(addNewHost);

        let choice = await vscode.window.showQuickPick(quickPickList);

        if (choice === addNewHost) {
            let server = await addSSHServer();
            return server;
        } else {
            return hosts[choice];
        }
    } else {
        return await addSSHServer();
    }
}

