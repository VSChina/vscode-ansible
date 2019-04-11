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
import * as fsExtra from 'fs-extra';
import * as child_process from 'child_process';


export class DockerRunner extends TerminalBaseRunner {
    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
    }

    protected getCmds(playbook: string, envs: string[], terminalId: string): string[] {
        var cmdsToTerminal = [];
        let cmd: string = utilities.getCodeConfiguration<string>(null, Constants.Config_terminalInitCommand);

        var sourcePath = path.dirname(playbook);
        var targetPath = '/playbook';
        var targetPlaybook = targetPath + '/' + path.basename(playbook);
        if (vscode.workspace.workspaceFolders) {
            sourcePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            targetPath = '/' + vscode.workspace.name;
            targetPlaybook = path.relative(sourcePath, playbook);
            targetPlaybook = targetPlaybook.replace(/\\/g, '/');
        }

        if (cmd === "default" || cmd === '') {
            cmd = "docker run --rm -it -v \"" + sourcePath + ":" + targetPath + "\"" +
                " --workdir \"" + targetPath + "\"" + " --name " + terminalId;

            // add credential envs if any
            if (envs) {
                for (var item in envs) {
                    cmd += ' -e ';
                    cmd += item + '=' + envs[item] + ' ';
                }
            }

            // add azure user agent
            if (utilities.isTelemetryEnabled()) {
                cmd += ' -e ' + Constants.UserAgentName + '=' + utilities.getUserAgent() + ' ';
            }

            cmd += ' ' + this.getDockerImageName() + ' bash';
            cmdsToTerminal.push(cmd);
            cmdsToTerminal.push(this.getRunPlaybookCmd(targetPlaybook));
        } else {
            cmdsToTerminal.push(cmd);
        }

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
                const promptMsg = 'Please configure cloud credentials at ' + utilities.getCredentialsFile() + ' for first time.';

                utilities.updateCodeConfiguration(null, Constants.Config_credentialConfigured, true);

                let credentialFile = utilities.getCredentialsFile();
                vscode.window.showWarningMessage(promptMsg, msgOption, msgItem, cancelItem).then(response => {
                    if (response === msgItem) {
                        if (fsExtra.existsSync(credentialFile)) {
                            vscode.workspace.openTextDocument().then(doc => {
                                vscode.window.showTextDocument(doc);
                            });
                        } else {
                            this._outputChannel.appendLine("Please configure cloud credentials by following https://marketplace.visualstudio.com/items?itemName=vscoss.vscode-ansible");
                            this._outputChannel.show();
                        }
                    } else {
                        this.startTerminal(terminalId, initCmd, Constants.AnsibleTerminalName + ' ' + Option.docker, true, subCmds, 180, false);
                    }
                });

            } else {
                this.startTerminal(terminalId, initCmd, Constants.AnsibleTerminalName + ' ' + Option.docker, true, subCmds, 180, false);
            }
        });
    }

    private startTerminal(terminalId: string, initCmd: string, terminalName: string, waitAfterInit: boolean, subCmds: string[], interval: number, reuse: boolean): void {
        TerminalExecutor.runInTerminal(initCmd, terminalName, waitAfterInit, subCmds, interval, reuse, function (terminal, interval) {
            if (terminal) {
                child_process.exec('docker ps --filter name=' + terminalId, (err, stdout, stderr) => {
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