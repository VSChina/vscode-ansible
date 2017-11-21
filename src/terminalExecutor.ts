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

export function startTerminal(terminalName, cb) {
    if (terminals === undefined || terminals[terminalName] === undefined) {
        let cmd: string = vscode.workspace.getConfiguration('ansible').get('terminalInitCommand');
        cmd = cmd.replace('$workspace', vscode.workspace.rootPath);

        var terminal = vscode.window.createTerminal(terminalName);
        
        terminals[terminalName] = terminal;

        if (cmd != "") {
            terminal.show();
            terminal.sendText(cmd);

            setTimeout(function() {
                cb();
            }, 1000)

            return;
        }
    }
    terminals[terminalName].show();
    cb();
}

export function runInTerminal(commands, terminal) {
    
    startTerminal(terminal, function() {
        commands.forEach(element => {
            terminals[terminal].sendText(element);
        });    
    });
}
