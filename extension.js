'use strict'

const vscode = require('vscode');
const utilities = require('./lib/utilities.js');


function activate(context) {
    console.log('Congratulations, your extension "vsc-extension-ansible" is now active!');
    var outputChannel = vscode.window.createOutputChannel("VSCode extension for Ansible");    
    
    let runpb = vscode.commands.registerCommand('extension.ansible-playbook', function () {
        var playbook = vscode.window.activeTextEditor.document.fileName;                
        vscode.window.showInputBox({ value: playbook, prompt: 'Please input playbook name', placeHolder: 'playbook', password: false })
            .then((input) => {
                if (input != undefined && input != '') {
                    playbook = input;
                }
                utilities.runPlayBook(playbook, outputChannel);
            })
    });

    context.subscriptions.push(runpb);
}

// this method is called when your extension is deactivated
function deactivate() {
}

exports.activate = activate;
exports.deactivate = deactivate;