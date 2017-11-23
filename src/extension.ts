'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as opn from 'opn';
import * as utilities from './utilities';
import * as ansibleRunner from './ansibleRunner';
import * as terminalExecutor from './terminalExecutor';
import * as cloudshellRunner from './cloudShellRunner';
import { AzureAccount } from './azure-account.api';
import { Constants } from './constants';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-ansible" is now active!');
    var outputChannel = vscode.window.createOutputChannel("VSCode extension for Ansible");

    let runpb = vscode.commands.registerCommand('vscode-ansible.ansible-playbook', () => {
        utilities.runPlayBook(outputChannel);
    });

    let runcmd = vscode.commands.registerCommand('vscode-ansible.ansible-commands', () => {
        utilities.runAnsibleCommands(outputChannel);
    });

    let runterminal = vscode.commands.registerCommand('vscode-ansible.ansible-terminal', () => {
        terminalExecutor.startTerminal('ansible', function() {});
    })

    let playbookinterminal = vscode.commands.registerCommand('vscode-ansible.ansible-playbook-in-terminal', () => {
        utilities.runPlaybookInTerminal();
    })       

    let runcloudshell = vscode.commands.registerCommand('vscode-ansible.ansible-cloudshell', () => {
        const installedExtension: any[] = vscode.extensions.all;

        let azureAccount: AzureAccount;
        for (var i = 0; i < installedExtension.length; i++) {
            const ext = installedExtension[i];
            if (ext.id === Constants.AzureAccountExtensionId) {
                azureAccount = ext.activate().then(() => {
                    if (azureAccount) {
                        cloudshellRunner.runPlaybook(outputChannel);
                    }
                });
                return;
            }
        }
        const open: vscode.MessageItem = { title: "View in MarketPlace" };
        vscode.window.showErrorMessage('Please install the Azure Account extension before run CloudShell!', open)
            .then(response => {
                if (response === open) {
                    opn('https://marketplace.visualstudio.com/items?itemName=ms-vscode.azure-account');
                }
            });
    });

    context.subscriptions.push(runpb);
    context.subscriptions.push(runcmd);
    context.subscriptions.push(runterminal);
    context.subscriptions.push(playbookinterminal);    
    context.subscriptions.push(runcloudshell);
}

// this method is called when your extension is deactivated
export function deactivate() {
}