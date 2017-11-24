'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import * as utilities from './utilities';
import * as dockerRunner from './dockerRunner';
import * as terminalExecutor from './terminalExecutor';
import * as cloudshellRunner from './cloudShellRunner';
import { AzureAccount } from './azure-account.api';
import { Constants } from './constants';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-ansible" is now active!');
    var outputChannel = vscode.window.createOutputChannel("VSCode extension for Ansible");

    let playbookinterminal = vscode.commands.registerCommand('vscode-ansible.ansible-playbook-in-terminal', () => {
        utilities.runPlaybookInTerminal();
    })

    let runcloudshell = vscode.commands.registerCommand('vscode-ansible.ansible-cloudshell', () => {
        cloudshellRunner.runPlaybook(outputChannel);
    });

    context.subscriptions.push(playbookinterminal);
    context.subscriptions.push(runcloudshell);
}

// this method is called when your extension is deactivated
export function deactivate() {
}