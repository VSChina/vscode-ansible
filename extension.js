'use strict'

const vscode = require('vscode');
const utilities = require('./lib/utilities.js');


function activate(context) {
    console.log('Congratulations, your extension "vsc-extension-ansible" is now active!');
    var outputChannel = vscode.window.createOutputChannel("VSCode extension for Ansible");

    let runpb = vscode.commands.registerCommand('vsc-extension-ansible.ansible-playbook', function () {
        utilities.runPlayBook(outputChannel);
    });

    let runcmd = vscode.commands.registerCommand('vsc-extension-ansible.ansible-commands', function () {
        utilities.runAnsibleCommands(outputChannel);
    });

    context.subscriptions.push(runpb);
    context.subscriptions.push(runcmd);
}

// this method is called when your extension is deactivated
function deactivate() {
}

exports.activate = activate;
exports.deactivate = deactivate;