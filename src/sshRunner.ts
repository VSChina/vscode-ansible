'use strict';

import * as ssh from 'ssh2';
import { TerminalBaseRunner } from './terminalBaseRunner';
import * as vscode from 'vscode';
import { SSHServer } from './interfaces';
import * as utilities from './utilities';
import { Constants } from './constants';
import { TelemetryClient } from './telemetryClient';
import * as path from 'path';
import * as fs from 'fs-extra';
import { openSSHConsole } from './SSHConsole';
import * as os from 'os';
import { setInterval, clearInterval } from 'timers';

const addNewHost = 'Add New Host';
const browseThePC = 'Browse the PC..';

export class SSHRunner extends TerminalBaseRunner {
    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
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

    protected runAnsibleInTerminal(playbook, cmds, terminalId: string) {

        utilities.IsNodeInstalled(this._outputChannel, () => {
            TelemetryClient.sendEvent('ssh');

            // get ssh config
            getSSHServer()
                .then((server) => {
                    if (server === undefined || server === null) {
                        return;
                    }

                    let workspaceRoot = '';
                    if (vscode.workspace.workspaceFolders) {
                        workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
                    }
                    const tempFile = path.join(os.tmpdir(), 'vscodeansible-ssh-' + server.host + '.log');

                    // copy playbook
                    fs.removeSync(tempFile);

                    const cancelItem: vscode.MessageItem = { title: "Cancel" };
                    const okItem: vscode.MessageItem = { title: "Ok" };
                    vscode.window.showWarningMessage('Sync Workspace to Remote host?', okItem, cancelItem)
                        .then((response) => {
                            let src = playbook;
                            let target = path.join('\./', path.basename(playbook));
                            let targetPlaybook = target;

                            if (response === okItem) {
                                src = utilities.getWorkspaceRoot(playbook) + '/';
                                target = path.join('\./', path.basename(src)) + '/';
                                targetPlaybook = ['\./' + path.basename(src), path.relative(workspaceRoot, playbook)].join(path.posix.sep).replace(/\\/g, '/');
                            }

                            this._outputChannel.append('\nCopying ' + src + ' to ' + server.host + '..');
                            this._outputChannel.show();
                            const progress = this.delayedInterval(() => { this._outputChannel.append('.') }, 500);
                            utilities.copyFileRemote(src, target, server, (err) => {
                                progress.cancel();
                                this._outputChannel.append('Done!');
                                if (err) {
                                    return;
                                } else {
                                    // run playbook
                                    openSSHConsole(this._outputChannel, server).then((terminal) => {
                                        if (terminal) {
                                            var count: number = 60;
                                            var _localthis = this;
                                            var connected = false;

                                            var interval = setInterval(function () {
                                                count--;
                                                if (count > 0) {
                                                    if (fs.existsSync(tempFile)) {
                                                        count = 0;
                                                        fs.removeSync(tempFile);
                                                        connected = true;

                                                        if (utilities.isTelemetryEnabled()) {
                                                            terminal.sendText('export ' + Constants.UserAgentName + '=' + utilities.getUserAgent());
                                                        }

                                                        for (let cmd of cmds) {
                                                            terminal.sendText(cmd);
                                                        }
                                                        terminal.sendText('ansible-playbook ' + targetPlaybook);
                                                        terminal.show();
                                                    }
                                                } else {
                                                    clearInterval(interval);

                                                    if (!connected) {
                                                        _localthis._outputChannel.appendLine('\nFailed to connect to ' + server.host + ' after 30 seconds');
                                                    }
                                                }
                                            }, 500);

                                        } else {
                                            this._outputChannel.appendLine('\nSSH connection failed.');
                                            this._outputChannel.show();
                                        }
                                    })
                                }
                            });
                        })
                });
        });
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


}


export type Hosts = { [key: string]: SSHServer };

export async function addSSHServer(): Promise<SSHServer> {

    let server = <SSHServer>{};
    var host = await vscode.window.showInputBox({ value: 'host', prompt: 'SSH host', placeHolder: 'host', password: false });
    if (host) {
        var port = await vscode.window.showInputBox({ value: '22', prompt: 'SSH port', placeHolder: 'port', password: false });
        if (port) {
            var user = await vscode.window.showInputBox({ value: 'username', prompt: 'SSH username', placeHolder: 'username', password: false });
            if (user) {
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
                        utilities.updateSSHConfig(server);
                        return server;

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

