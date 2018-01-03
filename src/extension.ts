'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as utilities from './utilities';
import { AzureAccount } from './azure-account.api';
import { Constants } from './constants';
import { CloudShellRunner } from './cloudShellRunner';
import { TerminalExecutor } from './terminalExecutor';
import { AnsibleCompletionItemProvider } from './ansibleCompletionItemProvider';
import { TelemetryClient } from './telemetryClient';
import { DockerRunner } from './dockerRunner';
import { LocalAnsibleRunner } from './localAnsibleRunner';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-ansible" is now active!');
    var outputChannel = vscode.window.createOutputChannel("VSCode extension for Ansible");

    TelemetryClient.sendEvent('activate');

    const triggerCharacters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(['yaml'], new AnsibleCompletionItemProvider(), ...triggerCharacters));

    utilities.generateCredentialsFile();

    var dockerRunner = new DockerRunner(outputChannel);
    var localansibleRunner = new LocalAnsibleRunner(outputChannel);
    var cloudShellRunner = new CloudShellRunner(outputChannel);

    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.playbook-in-docker', (playbook) => {
        dockerRunner.runPlaybook(playbook ? playbook.fsPath : null);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.playbook-in-localansible', (playbook) => {
        localansibleRunner.runPlaybook(playbook ? playbook.fsPath : null);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.cloudshell', (playbook) => {
        cloudShellRunner.runPlaybook(playbook ? playbook.fsPath : null);
    }));

    context.subscriptions.push(vscode.window.onDidCloseTerminal((closedTerminal: vscode.Terminal) => {
        TerminalExecutor.onDidCloseTerminal(closedTerminal);
    }));
}

// this method is called when your extension is deactivated
export function deactivate() {
}