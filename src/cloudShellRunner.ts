"use strict";

import { BaseRunner } from './baseRunner';
import * as vscode from 'vscode';
import { AzureAccount, CloudShell, AzureSession, CloudShellStatus } from './azure-account.api';
import { Constants, CloudShellConnectionStatus, CloudShellErrors } from './constants';
import * as utilities from './utilities';
import * as path from 'path';
import * as opn from 'opn';
import * as fsExtra from 'fs-extra';
import * as ost from 'os';
import { setInterval, clearInterval } from 'timers';
import { TelemetryClient } from './telemetryClient';
import { IStorageAccount, getStorageAccountforCloudShell } from './cloudConsoleLauncher';
import { Terminal } from 'vscode';
import { uploadFilesToAzureStorage, getCloudShellPlaybookPath } from './azureStorageHelper';
import * as semver from 'semver';

const tempFile = path.join(ost.tmpdir(), 'cloudshell' + vscode.env.sessionId + '.log');

export class CloudShellRunner extends BaseRunner {

    private terminal: vscode.Terminal;
    private cloudShellFileShare: IStorageAccount;
    private cloudShellSession: CloudShell;

    constructor(outputChannel: vscode.OutputChannel) {

        super(outputChannel);

        vscode.window.onDidCloseTerminal((terminal) => {
            if (terminal === this.terminal) {
                this.cleanUpTerminal();
            }
        })
    }

    protected runPlaybookInternal(playbook: string): void {
        // to workaround tls error: https://github.com/VSChina/vscode-ansible/pull/44
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = "0";

        const installedExtension: any[] = vscode.extensions.all;

        TelemetryClient.sendEvent('cloudshell', { 'status': CloudShellConnectionStatus.Init });

        let azureAccount: AzureAccount;
        for (var i = 0; i < installedExtension.length; i++) {
            const ext = installedExtension[i];
            if (ext.id === Constants.AzureAccountExtensionId && this.isAzureAccountVersionValid(ext)) {
                azureAccount = ext.activate().then((azureAccount) => {
                    if (azureAccount) {
                        this.connectToCloudShell(playbook).then((response) => {

                            if (!response)
                                return;

                            var terminal = response[0];
                            var remotePlaybookPath = response[1];

                            if (!terminal) {
                                return;
                            }

                            terminal.show();
                            terminal.sendText(this.getRunPlaybookCmd(remotePlaybookPath));

                        });
                    };
                    return;
                });
                return;
            }
        }
        TelemetryClient.sendEvent('cloudshell', { 'error': CloudShellErrors.AzureAccountNotInstalled });

        const open: vscode.MessageItem = { title: "View in Marketplace" };
        vscode.window.showErrorMessage('Please install the Azure Account extension before running Cloud Shell', open)
            .then(response => {
                if (response === open) {
                    opn('https://marketplace.visualstudio.com/items?itemName=ms-vscode.azure-account');
                }
            });
    }


    protected async connectToCloudShell(playbook: string): Promise<any> {
        const accountApi: AzureAccount = vscode.extensions.getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;

        if (!(await accountApi.waitForLogin())) {
            await vscode.commands.executeCommand('azure-account.askForLogin');

            if (!(await accountApi.waitForLogin())) {
                TelemetryClient.sendEvent('cloudshell', { 'error': CloudShellErrors.AzureNotSignedIn });
                return;
            }
        }

        try {
            await this.showPrompt();
        } catch (err) {
            return;
        }

        if (!this.terminal) {

            this._outputChannel.append('\nConnecting to Cloud Shell.');
            this._outputChannel.show();
            const progress = utilities.delayedInterval(() => { this._outputChannel.append('.') }, 500);

            try {
                this.cloudShellSession = accountApi.createCloudShell("Linux");

                if (!this.cloudShellSession) {
                    progress.cancel();
                    this._outputChannel.appendLine("Failed to connect to Cloud Shell, please retry later.");
                    this._outputChannel.show();
                    return;
                }

                this.terminal = await this.cloudShellSession.terminal;

                this.terminal.show();

                let count: number = 60;
                while (count > 0) {
                    if (this.cloudShellSession.status === "Connected") {
                        break;
                    }
                    count--;
                    await utilities.delay(500);
                }

                progress.cancel();

                if (count === 0) {
                    this.cleanUpTerminal();

                    this._outputChannel.appendLine("Failed to connect to Cloud Shell after 30 seconds,  please retry later.");
                    this._outputChannel.show();

                    TelemetryClient.sendEvent('cloudshell', { 'error': CloudShellErrors.ProvisionFailed });
                    return;
                }

                TelemetryClient.sendEvent('cloudshell', { 'status': CloudShellConnectionStatus.Succeeded });

                this.cloudShellFileShare = await getStorageAccountforCloudShell(this.cloudShellSession);

                if (!this.cloudShellFileShare) {
                    this._outputChannel.appendLine("Failed to get Storage Account for Cloud Shell, please retry later.");
                    this._outputChannel.show();

                    TelemetryClient.sendEvent('cloudshell', { 'error': CloudShellErrors.ProvisionFailed });
                    return;
                }
            } catch (err) {
                progress.cancel();
                this.cleanUpTerminal();

                this._outputChannel.appendLine('Connecting to Cloud Shell failed with error: \n' + err);
                this._outputChannel.show();
                return;
            }
        }

        try {
            await uploadFilesToAzureStorage(playbook,
                this.cloudShellFileShare.storageAccountName,
                this.cloudShellFileShare.storageAccountKey,
                this.cloudShellFileShare.fileShareName);

            return [this.terminal, getCloudShellPlaybookPath(this.cloudShellFileShare.fileShareName, playbook)];

        } catch (err) {
            if (err) {
                TelemetryClient.sendEvent('cloudshell', { 'error': CloudShellErrors.ProvisionFailed });

                this._outputChannel.appendLine('\nFailed to upload playbook to Cloud Shell: ' + err);
                this._outputChannel.show();
                return;
            }
        }
    }

    protected async showPrompt(): Promise<void> {

        let config = utilities.getCodeConfiguration<boolean>(null, Constants.Config_cloudShellConfirmed);

        if (!config) {
            const msgOption: vscode.MessageOptions = { modal: false };
            const msgItem: vscode.MessageItem = { title: 'Confirm & Don\'t show this again' };

            const cancelItem: vscode.MessageItem = { title: "View detail" };
            const promptMsg = 'Running your Ansible playbook in Cloud Shell will generate a small charge for Azure usage as the playbook needs to be uploaded to Cloud Shell';

            let response = await vscode.window.showWarningMessage(promptMsg, msgOption, msgItem, cancelItem);

            if (response === msgItem) {
                utilities.updateCodeConfiguration(null, Constants.Config_cloudShellConfirmed, true);
                return;
            } else if (response === cancelItem) {
                opn('https://docs.microsoft.com/en-us/azure/cloud-shell/pricing');

            }
            return Promise.reject('');
        }
        return;
    }

    protected cleanUpTerminal() {
        this.terminal = null;
        this.cloudShellFileShare = null;
        this.cloudShellSession = null;
    }

    protected isAzureAccountVersionValid(extension: any): boolean {
        if (!extension || !extension.packageJSON) {
            return false;
        }

        let version = extension.packageJSON.version;
        if (version && semver.valid(version) && semver.gte(version, '0.3.2')) {
            return true;
        }
        return false;
    }
}
