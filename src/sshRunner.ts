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

        cmdsToTerminal.push('ansible-playbook ~/' + path.basename(playbook));
        return cmdsToTerminal;
    }

    protected runAnsibleInTerminal(playbook, cmds, terminalId: string) {

        utilities.IsNodeInstalled(this._outputChannel, () => {
            TelemetryClient.sendEvent('ssh');

            // get ssh config
            getSSHServer().then((server) => {
                if (server === undefined || server === null) {
                    return;
                }

                // copy playbook
                let destPlaybookFolder = this.getTargetFolder();

                utilities.copyFileRemote(playbook, destPlaybookFolder, server, (err) => {
                    if (err) {
                        return;
                    } else {
                        // run playbook
                        openSSHConsole(this._outputChannel, server).then((terminal) => {
                            if (terminal) {
                                setTimeout(() => {

                                    for (let cmd of cmds) {
                                        terminal.sendText(cmd + '\n');
                                    }
                                    terminal.show();
                                }, 3000);
                            } else {
                                this._outputChannel.appendLine('\nSSH connection failed.');
                                this._outputChannel.show();
                            }
                        })
                    }
                });
            });
        });
    }

    private getTargetFolder(): string {
        return '\./';
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

                    if (pick && pick === browseThePC) {
                        var result = await vscode.window.showOpenDialog({
                            canSelectFiles: true,
                            canSelectFolders: false, canSelectMany: false
                        });
                        if (result && result.length === 1) {
                            server.key = result[0].fsPath;
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

