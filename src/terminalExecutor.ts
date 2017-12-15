'use strict'

import * as vscode from 'vscode';
import * as path from 'path';
import { setTimeout, clearInterval } from 'timers';

var terminals = [];

export class TerminalExecutor {
    private static terminals: { [id: string]: vscode.Terminal } = {};

    public static onDidCloseTerminal(closedTerminal: vscode.Terminal): void {
        delete this.terminals[closedTerminal.name];
    }

    public static runInTerminal(initCommand: string, terminalName: string, waitAfterInitCmd: boolean, commands: string[], retryTime: number, cb: Function): void {
        if (this.terminals === undefined || this.terminals[terminalName] === undefined) {
            var newterminal = vscode.window.createTerminal(terminalName);            
            this.terminals[terminalName] = newterminal;
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
