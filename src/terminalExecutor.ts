'use strict'

import * as vscode from 'vscode';
import * as path from 'path';
import { setTimeout } from 'timers';

var terminals = [];

export class TerminalExecutor {
    private static terminals: { [id: string]: vscode.Terminal } = {};

    public static onDidCloseTerminal(closedTerminal: vscode.Terminal): void {
        delete this.terminals[closedTerminal.name];
    }

    public static runInTerminal(initCommand: string, terminalName: string, waitAfterInitCmd: boolean, commands: string[]): void {
        if (this.terminals === undefined || this.terminals[terminalName] === undefined) {
            var newterminal = vscode.window.createTerminal(terminalName);
            newterminal.show();
            this.terminals[terminalName] = newterminal;
        }
        let terminal = this.terminals[terminalName];
        terminal.sendText(initCommand);

        if (waitAfterInitCmd) {
            setTimeout(function () {
                for (var cmd in commands) {
                    terminal.sendText(commands[cmd]);
                }
            }, 2000);
        } else {
            for (var cmd in commands) {
                terminal.sendText(commands[cmd]);
            }
        }

    }
}
