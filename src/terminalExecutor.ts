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

export function startTerminal(terminal) {
    if (terminals === undefined || terminals[terminal] === undefined) {
        terminals[terminal] = vscode.window.createTerminal(terminal);

        let cmd: string = vscode.workspace.getConfiguration('ansible').get('terminalInitCommand');
        cmd = cmd.replace('$workspace', vscode.workspace.rootPath);
        
        if (cmd != ""){
            terminals[terminal].sendText(cmd);
        }
    }
    terminals[terminal].show();
}

export function runInTerminal(commands, terminal) {
    
    startTerminal(terminal);

    commands.forEach(element => {
        terminals[terminal].sendText(element);
    });

}
