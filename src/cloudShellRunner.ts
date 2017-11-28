"use strict";

import { BaseRunner } from "./baseRunner";
import * as vscode from 'vscode';
import { AzureAccount } from "./azure-account.api";
import { Constants } from "./constants";
import * as utilities from "./utilities";
import { openCloudConsole, OSes } from './cloudConsole';
import * as path from 'path';
import * as opn from 'opn';
import * as fsExtra from 'fs-extra';
import * as ost from 'os';
import { setInterval, clearInterval } from 'timers';

const tempFile = path.join(ost.tmpdir(), 'cloudshell' + vscode.env.sessionId + '.log');

export class CloudShellRunner extends BaseRunner {

    protected runPlaybookInternal(playbook: string): void {
        const installedExtension: any[] = vscode.extensions.all;

        let azureAccount: AzureAccount;
        for (var i = 0; i < installedExtension.length; i++) {
            const ext = installedExtension[i];
            if (ext.id === Constants.AzureAccountExtensionId) {
                azureAccount = ext.activate().then((azureAccount) => {
                    if (azureAccount) {
                        this.startCloudShell(playbook);
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
    }


    protected startCloudShell(playbook: string): void {
        const msgOption: vscode.MessageOptions = { modal: false };
        const msgItem: vscode.MessageItem = { title: 'Confirm' };

        const promptMsg = 'Run ansible playbook in Cloudshell will generate Azure usage fee since need uploading playbook to CloudShell !' +
            'Please view detail at https://docs.microsoft.com/en-us/azure/cloud-shell/pricing.';
        vscode.window.showWarningMessage(promptMsg, msgOption, msgItem).then(
            response => {
                if (response === msgItem) {
                    const accountApi: AzureAccount = vscode.extensions.getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;

                    openCloudConsole(accountApi, OSes.Linux, [playbook], this._outputChannel, tempFile).then(terminal => {
                        var count = 30;
                        const interval = setInterval(function () {
                            count--;
                            if (count > 0) {
                                if (fsExtra.existsSync(tempFile)) {
                                    fsExtra.removeSync(tempFile);
                                    for (let file of [playbook]) {
                                        this._outputChannel.append(Constants.LineSeperator + '\nRun playbook in CloudShell: ' + file + '\n');

                                        terminal.sendText('ansible-playbook ' + path.basename(file));
                                        terminal.show();
                                    }
                                    count = 0;
                                }
                            } else {
                                this.stop(interval);
                            }
                        }, 500);
                    });
                }
            }
        )

    }

    protected stop(interval: NodeJS.Timer): void {
        clearInterval(interval);
    }
}