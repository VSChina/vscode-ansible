'use strict'

import * as vscode from 'vscode';
import * as path from 'path';
import * as utilities from './utilities';
import { setInterval, clearInterval } from 'timers';

const MAX_TERMINAL_COUNT = 20;

var terminalCount: { [id: string]: number } = {};

export class TerminalExecutor {
    private static terminals: { [id: string]: vscode.Terminal } = {};

    public static onDidCloseTerminal(closedTerminal: vscode.Terminal): void {
        if (terminalCount[closedTerminal.name]) {
            terminalCount[closedTerminal.name] = terminalCount[closedTerminal.name]--;
        }

        if (this.terminals[closedTerminal.name]) {
            closedTerminal.processId.then((id) => {
                this.terminals[closedTerminal.name].processId.then((localid) => {
                    if (id === localid) {
                        delete this.terminals[closedTerminal.name];
                    }
                })
            })
        }
    }

    public static runInTerminal(initCommand: string,
        terminalName: string,
        waitAfterInitCmd: boolean,
        commands: string[],
        retryTime: number,
        reuseTerminal: boolean,
        cb: Function): void {
        if (!reuseTerminal || (this.terminals === undefined || this.terminals[terminalName] === undefined)) {
            if (!terminalCount[terminalName]) {
                terminalCount[terminalName] = 0;
            }

            if (terminalCount[terminalName] >= MAX_TERMINAL_COUNT) {
                vscode.window.showErrorMessage('Reached max limit of active terminals: ' + terminalName + ', please delete unused terminals.');
                return cb(null, null);
            }
            var newterminal = utilities.isWslEnabled() ? vscode.window.createTerminal(terminalName, "wsl.exe") : vscode.window.createTerminal(terminalName);
            this.terminals[terminalName] = newterminal;
            terminalCount[terminalName]++;
        }

        let terminal = this.terminals[terminalName];
        terminal.sendText(initCommand);
        terminal.show();

        if (waitAfterInitCmd) {
            var count = retryTime;
            var interval = setInterval(function () {
                count--;
                if (count > 0) {
                    cb(terminal, interval);
                } else {
                    clearInterval(interval);
                }
            }, 1000);
        } else {
            for (var cmd in commands) {
                terminal.sendText(commands[cmd]);
            }
        }
    }
}
