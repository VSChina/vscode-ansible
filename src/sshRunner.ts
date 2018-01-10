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

export class SSHRunner extends TerminalBaseRunner {
    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
    }

    protected getCmds(playbook: string, envs: string[], terminalId: string): string[] {
        var cmdsToTerminal = [];

        var envCmd = this.isWindows() ? 'set ' : 'export ';

        if (envs) {
            for (var item in envs) {
                cmdsToTerminal.push(envCmd + item + '=' + envs[item]);
            }
        }

        // add azure user agent
        if (utilities.isTelemetryEnabled()) {
            cmdsToTerminal.push(envCmd + Constants.UserAgentName + '=' + utilities.getUserAgent());
        }
        cmdsToTerminal.push('ansible-playbook ' + playbook);
        return cmdsToTerminal;
    }

    protected runAnsibleInTerminal(playbook, cmds, terminalId: string) {
        let initCmd = cmds[0];
        let subCmds = cmds.splice(1);

        TelemetryClient.sendEvent('ssh');

        // get ssh config
        getSSHServer().then((server) => {
            // update ssh config
            utilities.updateSSHConfig(server);

            // copy playbook
            let destPlaybookFolder = '\./';

            utilities.copyFileRemote(playbook, destPlaybookFolder, server, (err) => {
                if (err) {
                    return;
                } else {
                    // run playbook
                    var conn = new ssh.Client();
                    conn.on('ready', () => {
                        conn.exec('ansible-playbook ' + path.basename(playbook), (err, stream) => {
                            this._outputChannel.append('\n');
                            if (err) {
                                this._outputChannel.append(err.toString());
                                throw err;
                            } else {
                                stream.on('close', (code, signal) => {
                                    conn.end();
                                }).on('data', (data) => {
                                    this._outputChannel.append(data.toString());
                                }).stderr.on('data', (err) => {
                                    this._outputChannel.append(err.toString());
                                })
                            }
                        })
                    }).connect({
                        host: server.host,
                        port: server.port,
                        username: server.user,
                        key: server.key ? server.key : '',
                        password: server.password
                    })
                }
            });

        });
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
                    var password = await vscode.window.showInputBox({ value: 'password', prompt: 'ssh password', placeHolder: 'password', password: true });
                    server.host = host;
                    server.port = +port;
                    server.user = user;

                    if (password) {
                        server.password = password;
                    } else {
                        var key = await vscode.window.showInputBox({ value: 'key file', prompt: 'ssh key file', placeHolder: 'ssh private key file', password: false });
                        if (key) {
                            server.key = key;
                        }
                    }
                    return server;
                }
            }
        }
    }
}


