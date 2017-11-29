'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as utilities from './utilities';
import { AzureAccount } from './azure-account.api';
import { Constants } from './constants';
import { TerminalRunner } from './terminalRunner';
import { CloudShellRunner } from './cloudShellRunner';
import { TerminalExecutor } from './terminalExecutor';


export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-ansible" is now active!');
    var outputChannel = vscode.window.createOutputChannel("VSCode extension for Ansible");
    utilities.generateCredentialsFile();

    var terminalRunner = new TerminalRunner(outputChannel);
    var cloudShellRunner = new CloudShellRunner(outputChannel);

    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.playbook-in-terminal', () => {
        terminalRunner.runPlaybook();
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.cloudshell', () => {
        cloudShellRunner.runPlaybook();
    }));

    context.subscriptions.push(vscode.window.onDidCloseTerminal((closedTerminal: vscode.Terminal) => {
        TerminalExecutor.onDidCloseTerminal(closedTerminal);
    }));
}

// this method is called when your extension is deactivated
export function deactivate() {
}