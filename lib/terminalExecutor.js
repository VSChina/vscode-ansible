'use strict'

const vscode = require('vscode');

var terminals = [];

function runInTerminal(commands, terminal) {
    if (terminals === undefined || terminals[terminal] === undefined) {
        terminals[terminal] = vscode.window.createTerminal(terminal);
    }
    terminals[terminal].show();
    commands.forEach(element => {
        terminals[terminal].sendText(element);
    });

}

exports.runInTerminal = runInTerminal