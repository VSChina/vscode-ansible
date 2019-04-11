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


export class LocalAnsibleRunner extends TerminalBaseRunner {
    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
    }

    protected getCmds(playbook: string, envs: string[], terminalId: string): string[] {
        var cmdsToTerminal = [];

        var envCmd = this.isWindows() && !utilities.isWslEnabled() ? 'set ' : 'export ';

        if (envs.length > 0) {
            for (var item in envs) {
                cmdsToTerminal.push(envCmd + item + '=' + envs[item]);
            }
        }

        // add azure user agent
        if (utilities.isTelemetryEnabled()) {
            cmdsToTerminal.push(envCmd + Constants.UserAgentName + '=' + utilities.getUserAgent());
        }

        if (utilities.isWslEnabled()) {
            var sourcePath = path.dirname(playbook);
            var targetPath = '/mnt/' + playbook.replace(/:/, '');
            var targetPlaybook = targetPath + '/' + path.basename(playbook);
            if (vscode.workspace.workspaceFolders) {
                sourcePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
                targetPath = '/' + vscode.workspace.name;
                targetPlaybook = path.relative(sourcePath, playbook);
            }
            targetPlaybook = targetPlaybook.replace(/\\/g, '/');
            cmdsToTerminal.push(this.getRunPlaybookCmd("\"" + targetPlaybook + "\""));
        } else {
            cmdsToTerminal.push(this.getRunPlaybookCmd("\"" + playbook + "\""));
        }
        return cmdsToTerminal;
    }

    protected runAnsibleInTerminal(playbook, cmds, terminalId: string) {
        let initCmd = cmds[0];
        let subCmds = cmds.splice(1);

        TelemetryClient.sendEvent('localansible');

        utilities.isAnsibleInstalled(this._outputChannel, () => {
            TerminalExecutor.runInTerminal(initCmd, Constants.AnsibleTerminalName + ' ' + Option.local, false, subCmds, null, true, null);
        });
    }
}