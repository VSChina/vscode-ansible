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
        var cmd: string = vscode.workspace.getConfiguration('ansible').get('terminalInitCommand')

        var sourcePath = path.dirname(playbook);
        var targetPath = '/playbook';
        var targetPlaybook = targetPath + '/' + path.basename(playbook);
        if (vscode.workspace.workspaceFolders) {
            sourcePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            targetPath = '/' + vscode.workspace.name;
            targetPlaybook = path.relative(sourcePath, playbook);
        }

        if (cmd === "default" || cmd === '') {
            cmd = "docker run --rm -it -v $workspace:$targetFolder  --workdir $targetFolder --name $containerId";
            cmd = cmd.replace('$workspace', sourcePath);
            cmd = cmd.replace(new RegExp('\\$targetFolder', 'g'), targetPath);
            cmd = cmd.replace('$containerId', terminalId);

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

            cmd += ' ' + Constants.DockerImageName + ' bash';
            cmdsToTerminal.push(cmd);
            cmdsToTerminal.push('ansible-playbook ' + targetPlaybook);
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
            TerminalExecutor.runInTerminal(initCmd, Constants.AnsibleTerminalName + ' ' + Option.docker, true, subCmds, 180, false, function (terminal, interval) {
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
        });
    }
}