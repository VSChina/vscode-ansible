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

        cmdsToTerminal.push('ansible-playbook ' + this.getTargetFolder() + path.basename(playbook));
        return cmdsToTerminal;
    }

    protected runAnsibleInTerminal(playbook, cmds, terminalId: string) {

        TelemetryClient.sendEvent('ssh');

        // get ssh config
        getSSHServer().then((server) => {
            // update ssh config
            utilities.updateSSHConfig(server);

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
    }

    private getTargetFolder(): string {
        return '\./';
    }
}


export type Hosts = { [key: string]: SSHServer };

export async function getSSHServer(): Promise<SSHServer> {
    let servers = utilities.getSSHConfig();
    let server = <SSHServer>{};

    if (servers) {
        let hosts = <Hosts>{};
        for (let host of servers) {
            hosts[host.host] = host;
        }
        let host = await vscode.window.showQuickPick(Object.keys(hosts));
        return server = hosts[host];
    } else {
        var host = await vscode.window.showInputBox({ value: 'host', prompt: 'ssh host', placeHolder: 'host', password: false });
        if (host) {
            var port = await vscode.window.showInputBox({ value: '22', prompt: 'ssh port', placeHolder: 'port', password: false });
            if (port) {
                var user = await vscode.window.showInputBox({ value: 'username', prompt: 'ssh username', placeHolder: 'username', password: false });
                if (user) {
                    var password = await vscode.window.showInputBox({ value: '', prompt: 'ssh password', placeHolder: 'password', password: true });
                    server.host = host;
                    server.port = +port;
                    server.user = user;

                    if (password && password != '') {
                        server.password = password;
                    } else {
                        var key = await vscode.window.showInputBox({ value: '', prompt: 'ssh key file', placeHolder: 'ssh private key file', password: false });
                        if (key && key != '') {
                            server.key = key;
                        }
                    }
                    return server;
                }
            }
        }
    }
}


