'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as utilities from './utilities'; 
import * as ansibleRunner from './ansibleRunner';
import { loadConfig } from './utilities';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "vsc-extension-ansible" is now active!');

    var outputChannel = vscode.window.createOutputChannel("VSCode extension for Ansible");
    
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('extension.sayHello', () => {
        // The code you place here will be executed every time your command is executed

        // Display a message box to the user
        vscode.window.showInformationMessage('Hello World!');
    });

    context.subscriptions.push(disposable);



    let runpb = vscode.commands.registerCommand('vsc-extension-ansible.ansible-playbook', () => {
        utilities.runPlayBook(outputChannel);
    });

    let runcmd = vscode.commands.registerCommand('vsc-extension-ansible.ansible-commands', () => {
        utilities.runAnsibleCommands(outputChannel);
    });

    let runterminal = vscode.commands.registerCommand('vsc-extension-ansible.ansible-terminal', () => {
        ansibleRunner.runAnsibleDockerInTerminal(outputChannel);
    })

    let editConfig = vscode.commands.registerCommand('vsc-extension-ansible.ansible-config', () => {
        vscode.workspace.openTextDocument(utilities.getConfigPath()).then( (document) => {
            vscode.window.showTextDocument(document);
        });
    })


    context.subscriptions.push(runpb);
    context.subscriptions.push(runcmd);
    context.subscriptions.push(runterminal);
    context.subscriptions.push(editConfig);
    
    utilities.setExtensionPath(context.extensionPath);
}

// this method is called when your extension is deactivated
export function deactivate() {
}