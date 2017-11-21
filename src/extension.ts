'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as utilities from './utilities'; 
import * as ansibleRunner from './ansibleRunner';
import * as terminalExecutor from './terminalExecutor';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vsc-extension-ansible" is now active!');    
    var outputChannel = vscode.window.createOutputChannel("VSCode extension for Ansible");

    let runpb = vscode.commands.registerCommand('vsc-extension-ansible.ansible-playbook', () => {
        utilities.runPlayBook(outputChannel);
    });

    let runcmd = vscode.commands.registerCommand('vsc-extension-ansible.ansible-commands', () => {
        utilities.runAnsibleCommands(outputChannel);
    });

    let runterminal = vscode.commands.registerCommand('vsc-extension-ansible.ansible-terminal', () => {
        terminalExecutor.startTerminal('ansible', function() {});
    })

    let playbookinterminal = vscode.commands.registerCommand('vsc-extension-ansible.ansible-playbook-in-terminal', () => {
        utilities.runPlaybookInTerminal();
    })

    context.subscriptions.push(runpb);
    context.subscriptions.push(runcmd);
    context.subscriptions.push(runterminal);
    context.subscriptions.push(playbookinterminal);
    
}

// this method is called when your extension is deactivated
export function deactivate() {
}