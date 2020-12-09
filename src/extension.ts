'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

let messageShown = false;

async function showDeprecationMessage() {
    if (messageShown) {
        return;
    }
    messageShown = true;

    const openExtensionView = 'Open Extensions View'
    const result = await vscode.window.showInformationMessage('The Ansible extension has been retired. It is no longer maintained. Please uninstall the extension.', openExtensionView);
    if (result === openExtensionView) {
        vscode.commands.executeCommand('workbench.extensions.action.showExtensionsWithIds', ['vscoss.vscode-ansible']);
    }
}

export function activate(context: vscode.ExtensionContext) {

    showDeprecationMessage();

    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.playbook-in-docker', showDeprecationMessage));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.playbook-in-localansible', showDeprecationMessage));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.cloudshell', showDeprecationMessage));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.ssh', showDeprecationMessage));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.sync-folder-ssh', showDeprecationMessage));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.resource-module-samples', showDeprecationMessage));
}

// this method is called when your extension is deactivated
export function deactivate() {
}
