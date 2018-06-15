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

    protected async runAnsibleInTerminal(playbook, cmds, terminalId: string): Promise<void> {
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
        let src = playbook;
        let target = path.join('\./', path.basename(playbook));
        let targetPlaybook = target;


        // check configuration weather to sync workspace
        let copyWorkspace = utilities.getCodeConfiguration<boolean>('ansible', 'copyWorkspace');

        if (copyWorkspace) {
            src = utilities.getWorkspaceRoot(playbook) + '/';
            target = path.join('\./', path.basename(src)) + '/';
            targetPlaybook = ['\./' + path.basename(src), path.relative(src, playbook)].join(path.posix.sep).replace(/\\/g, '/');

            try {
                await this.folderSyncer.syncFolder(src, target, targetServer, false);
            } catch (err) {
                return;
            }
        } else {
            this._outputChannel.append('\nCopying ' + src + ' to ' + targetServer.host + '..');
            this._outputChannel.show();

            const progress = this.delayedInterval(() => { this._outputChannel.append('.') }, 800);

            try {
                await utilities.copyFilesRemote(src, target, targetServer);
                progress.cancel();
            } catch (err) {
                progress.cancel();
                if (err) {
                    this._outputChannel.appendLine('\nFailed to copy ' + src + ' to ' + targetServer.host + ': ' + err);
                    this._outputChannel.show();
                }
                return;
            }
        }

        let terminal = undefined;

        let reuse = utilities.getCodeConfiguration<boolean>('ansible', 'reuseSSHTerminal');

        if (reuse) {
            let terminalNames = Object.keys(this.terminalList);
            for (let t of terminalNames) {
                if (t === this.getTerminalName(targetServer.host)) {
                    terminal = this.terminalList[t];
                    break;
                }
            }
        }

        if (terminal) {
            terminal.show();

            cmds.push('ansible-playbook ' + targetPlaybook);
            this.sendCommandsToTerminal(terminal, cmds);

        } else {
            openSSHConsole(this._outputChannel, targetServer)
                .then((term) => {
                    if (!term) {
                        this._outputChannel.appendLine('\nSSH connection failed.');
                        this._outputChannel.show();
                        return;
                    }
                    this.terminalList[this.getTerminalName(targetServer.host)] = term;

                    var count: number = 60;
                    var _localthis = this;
                    var connected = false;

                    const tempFile = path.join(os.tmpdir(), 'vscodeansible-ssh-' + targetServer.host + '.log');

                    var interval = setInterval(function () {
                        count--;
                        if (count > 0) {
                            if (fs.existsSync(tempFile)) {
                                count = 0;
                                fs.removeSync(tempFile);
                                connected = true;

                                cmds.push('ansible-playbook ' + targetPlaybook);
                                _localthis.sendCommandsToTerminal(term, cmds);
                                term.show();
                            }
                        } else {
                            clearInterval(interval);

                            if (!connected) {
                                _localthis._outputChannel.appendLine('\nFailed to connect to ' + targetServer.host + ' after 30 seconds');
                            }

                            terminal.sendText(_localthis.getRunPlaybookCmd(targetPlaybook));
                            terminal.show();
                        }
                    }, 500);
                });
        }
    }

    private getTerminalName(host: string): string {
        return 'SSH ' + host;
    }

    private sendCommandsToTerminal(terminal: vscode.Terminal, cmds: string[]): void {
        if (utilities.isTelemetryEnabled()) {
            terminal.sendText('export ' + Constants.UserAgentName + '=' + utilities.getUserAgent());
        }

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

