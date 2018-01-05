"use strict";

import { BaseRunner, Option } from './baseRunner';
import * as vscode from 'vscode';
import * as path from 'path';
import { Constants } from './constants';
import * as utilities from './utilities';
import { TerminalExecutor } from './terminalExecutor';
import { TelemetryClient } from './telemetryClient';
import { clearInterval } from 'timers';

export abstract class TerminalBaseRunner extends BaseRunner {
    constructor(outputChannel: vscode.OutputChannel) {
        super(outputChannel);
    }

    protected runPlaybookInternal(playbook: string): void {
        // - parse credential files if exists
        const credentials = utilities.parseCredentialsFile(this._outputChannel);
        var terminalId = 'ansible' + Date.now();

        var cmds = this.getCmds(playbook, credentials, terminalId);
        this.runAnsibleInTerminal(playbook, cmds, terminalId);
    }

    protected abstract getCmds(playbook: string, envs: string[], terminalId: string): string[];

    protected abstract runAnsibleInTerminal(playbook, cmds, terminalId: string);
}