"use strict";

import { BaseRunner, Option } from './baseRunner';
import * as vscode from 'vscode';
import * as path from 'path';
import { Constants } from './constants';
import * as utilities from './utilities';
import { TerminalExecutor } from './terminalExecutor';
import { TelemetryClient } from './telemetryClient';
import { clearInterval } from 'timers';

export class TerminalRunner extends BaseRunner {
    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
    }

    protected runPlaybookInternal(playbook: string): void {
        // - parse credential files if exists
        const credentials = utilities.parseCredentialsFile(this._outputChannel);
        let cmds = [];
        let waitAfterInitCmd = false;

        var defaultOption: string = Option.docker;

        // - run playbook
        if (this.isWindows()) {
            // - on windows, run in docker
            this.ansibleInTerminal(defaultOption, playbook, credentials);
        } else {
            // - on other platforms, give user options to run in docker or local installation
            vscode.window.showQuickPick([Option.docker, Option.local], { placeHolder: "Select the way you'd like to run ansible", ignoreFocusOut: true })
                .then((pick) => {
                    // check if local ansible is ready
                    this.ansibleInTerminal(pick, playbook, credentials);
                    defaultOption = pick;
                })
        }
        TelemetryClient.sendEvent('terminal', { option: defaultOption });
    }

    protected ansibleInTerminal(option, playbook, credentials) {
        let containerId = 'ansible' + Date.now();

        let cmds = this.getCmdsToTerminal(option, playbook, credentials, containerId);
        let initCmd = cmds[0];
        let subCmds = cmds.splice(1);

        if (option === Option.docker) {
            utilities.isDockerInstalled(this._outputChannel, (err) => {
                if (err) {
                    return;
                }
                TerminalExecutor.runInTerminal(initCmd, Constants.AnsibleTerminalName + ' ' + option, true, subCmds, 180, false, function (terminal, interval) {
                    require('child_process').exec('docker ps --filter name=' + containerId, (err, stdout, stderr) => {
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
                                clearInterval(interval);
                            }
                        }
                    })
                });
            });
        } else if (option === Option.local) {
            utilities.isAnsibleInstalled(this._outputChannel, () => {
                TerminalExecutor.runInTerminal(initCmd, Constants.AnsibleTerminalName + ' ' + option, false, subCmds, null, false, null);
            });
        }
    }

    protected getCmdsToTerminal(option: string, playbook: string, envs: string[], containerId: string): string[] {
        var cmdsToTerminal = [];

        if (option === Option.docker) {
            // check if terminal init cmd is configured -- if not, set default docker command
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
                cmd = cmd.replace('$containerId', containerId);


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

        } else if (option === Option.local) {
            if (envs) {
                for (var item in envs) {
                    cmdsToTerminal.push('export ' + item + '=' + envs[item]);
                }
            }

            // add azure user agent
            if (utilities.isTelemetryEnabled()) {
                cmdsToTerminal.push('export ' + Constants.UserAgentName + '=' + utilities.getUserAgent());
            }
            cmdsToTerminal.push('ansible-playbook ' + playbook);
        }
        return cmdsToTerminal;
    }
}