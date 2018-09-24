"use strict";

import { Option } from './baseRunner';
import * as vscode from 'vscode';
import * as path from 'path';
import { Constants } from './constants';
import * as utilities from './utilities';
import { TerminalExecutor } from './terminalExecutor';
import { TelemetryClient } from './telemetryClient';
import { clearInterval } from 'timers';
import { TerminalBaseRunner } from './terminalBaseRunner';


export class DockerRunner extends TerminalBaseRunner {
    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
    }

    protected getCmds(playbook: string, envs: string[], terminalId: string): string[] {
        var cmdsToTerminal = [];
        let cmd: string = utilities.getCodeConfiguration<string>(null, Constants.Config_terminalInitCommand);

        var targetPath = '/playbook';
        var targetPlaybook = targetPath + '/' + path.basename(playbook);
        if (vscode.workspace.workspaceFolders) {
            targetPath = '/' + vscode.workspace.name;
            targetPlaybook = path.relative(vscode.workspace.rootPath, playbook);
            targetPlaybook = targetPlaybook.replace(/\\/g, '/');
        }

        cmd = cmd.replace(/\${workspaceFolder}/g, `${vscode.workspace.rootPath}`);
        cmd = cmd.replace(/\${workspaceFolderBasename}/g, `${path.basename(vscode.workspace.rootPath)}`);
        cmd = cmd.replace(/\${ansible.dockerImage}/g, this.getDockerImageName());
        cmd = cmd.replace(/\${ansible.targetPlaybook}/g, targetPlaybook);

        cmd = cmd.replace('${ansible.containerId}', terminalId);

        // add credential envs if any
        var cmdEnv = ""
        if (envs) {
            for (var item in envs) {
                cmdEnv += ' -e ';
                cmdEnv += item + '=' + envs[item] + ' ';
            }
        }
        // add azure user agent
        if (utilities.isTelemetryEnabled()) {
            cmdEnv += ' -e ' + Constants.UserAgentName + '=' + utilities.getUserAgent() + ' ';
        }
        cmd = cmd.replace('${ansible.environments}', cmdEnv);

        cmdsToTerminal.push(cmd);

        return cmdsToTerminal;
    }

    protected runAnsibleInTerminal(playbook, cmds, terminalId: string) {
        let initCmd = cmds[0];
        let subCmds = cmds.splice(1);

        TelemetryClient.sendEvent('docker');

        utilities.isDockerInstalled(this._outputChannel, (err) => {
            if (err) {
                return;
            }

            const msgOption: vscode.MessageOptions = { modal: false };
            const msgItem: vscode.MessageItem = { title: 'Ok' };

            if (!utilities.isCredentialConfigured()) {
                const cancelItem: vscode.MessageItem = { title: "Not Now" };
                const promptMsg = 'Please configure cloud credentials at ' + utilities.getCredentialsFile() + ' for first time';

                vscode.window.showWarningMessage(promptMsg, msgOption, msgItem, cancelItem).then(response => {
                    utilities.updateCodeConfiguration(null, Constants.Config_credentialConfigured, true);
                    if (response === msgItem) {
                        vscode.workspace.openTextDocument(utilities.getCredentialsFile()).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                    } else if (response === cancelItem) {
                        this.startTerminal(terminalId, initCmd, Constants.AnsibleTerminalName + ' ' + Option.docker, true, subCmds, 180, false);
                    }
                });
            } else {
                const openItem: vscode.MessageItem = { title: "Open File" };
                vscode.window.showInformationMessage('Use cloud credential file ' + utilities.getCredentialsFile(), msgOption, msgItem, openItem).then(response => {
                    if (response === openItem) {
                        vscode.workspace.openTextDocument(utilities.getCredentialsFile()).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                    }
                });
                this.startTerminal(terminalId, initCmd, Constants.AnsibleTerminalName + ' ' + Option.docker, true, subCmds, 180, false);
            }
        });
    }

    private startTerminal(terminalId: string, initCmd: string, terminalName: string, waitAfterInit: boolean, subCmds: string[], interval: number, reuse: boolean): void {
        TerminalExecutor.runInTerminal(initCmd, terminalName, waitAfterInit, subCmds, interval, reuse, function (terminal, interval) {
            if (terminal) {
                require('child_process').exec('docker ps --filter name=' + terminalId, (err, stdout, stderr) => {
                    if (err || stderr) {
                        console.log('err: ' + err + ' ' + stderr);
                        return;
                    }
                    if (stdout) {
                        // check if docker container is up
                        if (stdout && stdout.indexOf('Up ') > -1) {

                            // then send other commands to terminal
                            for (let text of subCmds) {
                                terminal.sendText(text);
                            }
                            terminal.show();
                            if (interval) {
                                clearInterval(interval);
                            }
                        }
                    }
                })
            }
        });
    }

    private getDockerImageName(): string {
        let customDocker = utilities.getCodeConfiguration<string>('ansible', Constants.Config_dockerImage);
        if (!customDocker) {
            customDocker = Constants.DockerImageName;
        }
        return customDocker;
    }
}