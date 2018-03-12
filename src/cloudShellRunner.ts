"use strict";

import { BaseRunner } from './baseRunner';
import * as vscode from 'vscode';
import { AzureAccount } from './azure-account.api';
import { Constants, CloudShellStatus, CloudShellErrors } from './constants';
import * as utilities from './utilities';
import { openCloudConsole, OSes } from './cloudConsole';
import * as path from 'path';
import * as opn from 'opn';
import * as fsExtra from 'fs-extra';
import * as ost from 'os';
import { setInterval, clearInterval } from 'timers';
import { TelemetryClient } from './telemetryClient';
import { delay } from './cloudConsoleLauncher';
import { Terminal } from 'vscode';

const tempFile = path.join(ost.tmpdir(), 'cloudshell' + vscode.env.sessionId + '.log');

export class CloudShellRunner extends BaseRunner {

    private terminal: vscode.Terminal;

    constructor(outputChannel: vscode.OutputChannel) {

        super(outputChannel);
    }

    protected runPlaybookInternal(playbook: string): void {
        // to workaround tls error: https://github.com/VSChina/vscode-ansible/pull/44
        process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = "0";

        const installedExtension: any[] = vscode.extensions.all;

        TelemetryClient.sendEvent('cloudshell', { 'status': CloudShellStatus.Init });

        let azureAccount: AzureAccount;
        for (var i = 0; i < installedExtension.length; i++) {
            const ext = installedExtension[i];
            if (ext.id === Constants.AzureAccountExtensionId) {
                azureAccount = ext.activate().then((azureAccount) => {
                    if (azureAccount) {
                        this.startCloudShell(playbook).then((terminal) => {

                            if (!terminal) {
                                return;
                            }

                            terminal.sendText('ansible-playbook ' + path.basename(playbook));
                            terminal.show();
                            TelemetryClient.sendEvent('cloudshell', { 'status': CloudShellStatus.Succeeded });
                        });
                    };
                    return;
                });
                return;
            }
        }
        TelemetryClient.sendEvent('cloudshell', { 'error': CloudShellErrors.AzureAccountNotInstalled });

        const open: vscode.MessageItem = { title: "View in MarketPlace" };
        vscode.window.showErrorMessage('Please install the Azure Account extension before run CloudShell!', open)
            .then(response => {
                if (response === open) {
                    opn('https://marketplace.visualstudio.com/items?itemName=ms-vscode.azure-account');
                }
            });
    }


    protected async startCloudShell(playbook: string): Promise<Terminal> {
        const accountApi: AzureAccount = vscode.extensions.getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;

        if (this.terminal === null || this.terminal === undefined) {
            var terminal = await openCloudConsole(accountApi, OSes.Linux, [playbook], this._outputChannel, tempFile);

            if (terminal) {

                let count: number = 30;
                while (count--) {
                    if (await fsExtra.exists(tempFile)) {
                        count = 0;
                        this.terminal = terminal;

                        if (utilities.isTelemetryEnabled()) {
                            terminal.sendText('export ' + Constants.UserAgentName + '=' + utilities.getUserAgent());
                        }

                        fsExtra.remove(tempFile);

                    }
                    await delay(500);
                }
            }
        } else {
            this._outputChannel.appendLine('\nConnecting to Cloud Shell failed, please retry.');
        }
        return this.terminal;
    }

    private sendCommandsToTerminal(playbook: string) {

    }

    protected stop(interval: NodeJS.Timer): void {
        clearInterval(interval);
    }

    protected async showPrompt() {

        let config = utilities.getCodeConfiguration<boolean>(null, Constants.Config_cloudShellConfirmed);

        if (!config) {
            const msgOption: vscode.MessageOptions = { modal: false };
            const msgItem: vscode.MessageItem = { title: 'Confirm & Don\'t show this again' };

            const cancelItem: vscode.MessageItem = { title: "View detail" };
            const promptMsg = 'Run ansible playbook in Cloudshell will generate Azure usage fee since need uploading playbook to CloudShell !';

            let response = await vscode.window.showWarningMessage(promptMsg, msgOption, msgItem, cancelItem);

            if (response === msgItem) {
                utilities.updateCodeConfiguration(null, Constants.Config_cloudShellConfirmed, true);
            } else if (response === cancelItem) {
                opn('https://docs.microsoft.com/en-us/azure/cloud-shell/pricing');
            }
        }

        return Promise.resolve(null);
    }

}