'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, TransportKind, ServerOptions } from 'vscode-languageclient';
import * as utilities from './utilities';
import { CloudShellRunner } from './cloudShellRunner';
import { TerminalExecutor } from './terminalExecutor';
import { AnsibleCompletionItemProvider } from './ansibleCompletionItemProvider';
import { TelemetryClient } from './telemetryClient';
import { DockerRunner } from './dockerRunner';
import { LocalAnsibleRunner } from './localAnsibleRunner';
import { SSHRunner } from './sshRunner';
import { FolderSyncer } from './folderSyncer';
import { FileSyncer } from './fileSyncer';
import { RestSamples } from './restSamples';
import { Constants } from './constants';

const documentSelector = [
    { language: 'yaml', scheme: 'file' },
    { language: 'yaml', scheme: 'untitled' },
    { language: 'ansible', scheme: 'file' },
    { language: 'ansible', scheme: 'untitled' }
];

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "vscode-ansible" is now active!');
    var outputChannel = vscode.window.createOutputChannel("VSCode extension for Ansible");

    TelemetryClient.sendEvent('activate');

    utilities.generateCredentialsFile();

    const triggerCharacters = ' abcdefghijklmnopqrstuvwxyz'.split('');
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(documentSelector, new AnsibleCompletionItemProvider(), ...triggerCharacters));


    var dockerRunner = new DockerRunner(outputChannel);
    var localansibleRunner = new LocalAnsibleRunner(outputChannel);
    var cloudShellRunner = new CloudShellRunner(outputChannel);
    var sshRunner = new SSHRunner(outputChannel);
    var folderSyncer = new FolderSyncer(outputChannel);
    var fileSyncer = new FileSyncer(outputChannel);
    var restSamples = new RestSamples(outputChannel);

    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.playbook-in-docker', (playbook) => {
        dockerRunner.runPlaybook(playbook ? playbook.fsPath : null);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.playbook-in-localansible', (playbook) => {
        localansibleRunner.runPlaybook(playbook ? playbook.fsPath : null);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.cloudshell', (playbook) => {
        cloudShellRunner.runPlaybook(playbook ? playbook.fsPath : null);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.ssh', (playbook) => {
        sshRunner.runPlaybook(playbook ? playbook.fsPath : null);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('vscode-ansible.sync-folder-ssh', () => {
        let srcFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        folderSyncer.syncFolder(srcFolder, null, true);
    }));

    let disposable = vscode.commands.registerCommand('vscode-ansible.resource-module-samples', () => {
        restSamples.displayMenu();
    });

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((configChange) => {
        if (configChange.affectsConfiguration("ansible." + Constants.Config_fileCopyConfig)) {
            let config = vscode.workspace.getConfiguration('ansible').get('fileCopyConfig');
            fileSyncer.onConfigurationChange(config);
        }
    }));

    context.subscriptions.push(vscode.window.onDidCloseTerminal((closedTerminal: vscode.Terminal) => {
        TerminalExecutor.onDidCloseTerminal(closedTerminal);
    }));

    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(listener => {
        fileSyncer.copyFiles(null, listener.fileName);
    }));

    // start language client
    var serverModule = path.join(context.extensionPath, 'out', 'server', 'server.js');

    var debugOptions = { execArgv: ['--nolazy', "--inspect=6003"] };

    var serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    }

    var clientOptions: LanguageClientOptions = {
        documentSelector,
        synchronize: {
            configurationSection: 'ansible',
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.?(e)y?(a)ml')
        }
    }

    var client = new LanguageClient('ansible', 'Ansible Playbook Language Server', serverOptions, clientOptions);
    context.subscriptions.push(client.start());

    vscode.languages.setLanguageConfiguration('yaml', {
        wordPattern: /("(?:[^\\\"]*(?:\\.)?)*"?)|[^\s{}\[\],:]+/
    });
}

// this method is called when your extension is deactivated
export function deactivate() {
}
