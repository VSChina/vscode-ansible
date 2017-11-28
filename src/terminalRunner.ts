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

        // - run playbook
        if (this.isWindows()) {
            // - on windows, run in docker
            cmds = this.getCmdsToTerminal(Option.docker, playbook, credentials);
            waitAfterInitCmd = true;
        } else {
            // - on other platforms, give user options to run in docker or local installation
            vscode.window.showQuickPick([Option.docker, Option.local], { placeHolder: "Select the way you'd like to run ansible", ignoreFocusOut: true })
                .then((pick) => {
                    cmds = this.getCmdsToTerminal(pick, playbook, credentials);
                })
        }
        let initCmd = cmds[0];
        TerminalExecutor.runInTerminal(initCmd, Constants.AnsibleTerminalName, waitAfterInitCmd, cmds.splice(1));
    }

    protected getCmdsToTerminal(option: string, playbook: string, envs: string[]): string[] {
        var cmdsToTerminal = [];
        if (option === Option.docker) {
            // check if terminal init cmd is configured -- if not, set default docker command
            let cmd: string = vscode.workspace.getConfiguration('ansible').get('terminalInitCommand')

            var sourceFolder = vscode.workspace.rootPath;
            var targetFolder = '/' + (vscode.workspace as any).name;

            var targetPlaybook = path.relative(sourceFolder, playbook);
            var containerId = 'ansible' + Date.now();

            if (cmd === "default" || cmd === '') {
                cmd = "docker run --rm -it -v $workspace:$targetFolder --workdir $targetFolder --name $containerId";
                cmd = cmd.replace('$workspace', sourceFolder);
                cmd = cmd.replace('$targetFolder', targetFolder);
                cmd = cmd.replace('$targetFolder', targetFolder);
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