"use strict";

import { BaseRunner, Option } from './baseRunner';
import * as vscode from 'vscode';
import * as path from 'path';
import { Constants } from './constants';
import * as utilities from './utilities';
import { TerminalExecutor } from './terminalExecutor';


export class TerminalRunner extends BaseRunner {
    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
    }

    protected runPlaybookInternal(playbook: string): void {
        // - parse credential files if exists
        const credentials = utilities.parseCredentialsFile();
        let cmds = [];
        let waitAfterInitCmd = false;

        var defaultOption = Option.docker;

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
                })
        }
    }

    protected ansibleInTerminal(option, playbook, credentials) {
        let cmds = this.getCmdsToTerminal(option, playbook, credentials);
        let initCmd = cmds[0];

        if (option === Option.docker) {
            utilities.isDockerInstalled(this._outputChannel, () => {
                TerminalExecutor.runInTerminal(initCmd, Constants.AnsibleTerminalName, true, cmds.splice(1));
            });
        } else if (option === Option.local) {
            utilities.isAnsibleInstalled(this._outputChannel, () => {
                TerminalExecutor.runInTerminal(initCmd, Constants.AnsibleTerminalName, false, cmds.splice(1));
            });
        }
    }

    protected getCmdsToTerminal(option: string, playbook: string, envs: string[]): string[] {
        var cmdsToTerminal = [];
        if (option === Option.docker) {
            // check if terminal init cmd is configured -- if not, set default docker command
            var cmd: string = vscode.workspace.getConfiguration('ansible').get('terminalInitCommand')

            var sourceFolder = vscode.workspace.rootPath;            
            var targetFolder = '/' + vscode.workspace.workspaceFolders[0].name;

            var targetPlaybook = path.relative(sourceFolder, playbook);
            var containerId = 'ansible' + Date.now();

            if (cmd === "default" || cmd === '') {
                cmd = "docker run --rm -it -v $workspace:$targetFolder --workdir $targetFolder --name $containerId";
                cmd = cmd.replace('$workspace', sourceFolder);
                cmd = cmd.replace(new RegExp('\\$targetFolder', 'g'), targetFolder);                
                cmd = cmd.replace('$containerId', containerId);

                // add credential envs if any
                if (envs) {
                    for (var item in envs) {
                        cmd += ' -e ';
                        cmd += item + '=' + envs[item] + ' ';
                    }
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
            cmdsToTerminal.push('ansible-playbook ' + playbook);
        }
        return cmdsToTerminal;
    }
}