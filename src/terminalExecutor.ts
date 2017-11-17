'use strict'

import * as vscode from 'vscode';

var terminals = [];

vscode.window.onDidCloseTerminal(function (terminal) {
    if (terminals === undefined)
        return;
    if (terminals[terminal.name])
    {
        delete terminals[terminal.name];
    }
})

export function runInTerminal(commands, terminal) {
    if (terminals === undefined || terminals[terminal] === undefined) {
        terminals[terminal] = vscode.window.createTerminal(terminal);
    }
    terminals[terminal].show();
    commands.forEach(element => {
        terminals[terminal].sendText(element);
    });

}
