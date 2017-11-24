import * as vscode from 'vscode';
import { AzureAccount } from "./azure-account.api";
import { Constants } from "./constants";
import * as utilities from "./utilities";
import { openCloudConsole, OSes } from './cloudConsole';
import * as path from 'path';
import * as opn from 'opn';

export function runPlaybook(outputChannel) {
    const installedExtension: any[] = vscode.extensions.all;

    let azureAccount: AzureAccount;
    for (var i = 0; i < installedExtension.length; i++) {
        const ext = installedExtension[i];
        if (ext.id === Constants.AzureAccountExtensionId) {
            azureAccount = ext.activate().then(() => {
                if (azureAccount) {
                    startCloudShell(outputChannel);
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

export function startCloudShell(outputChannel) {
    const msgOption: vscode.MessageOptions = { modal: false };
    const msgItem: vscode.MessageItem = { title: 'Confirm' };

    const promptMsg = 'Warning: Run ansible playbook in Cloudshell will generate Azure storage usage fee since need uploading playbook to CloudShell!\n' +
        'Please view detail at https://docs.microsoft.com/en-us/azure/cloud-shell/pricing';
        vscode.window.showWarningMessage(promptMsg, msgOption, msgItem).then(
        response => {
            if (response === msgItem) {
                var playbook = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;

                vscode.window.showInputBox({ value: playbook, prompt: 'Please input playbook name', placeHolder: 'playbook', password: false })
                    .then(async (input) => {
                        if (input != undefined && input != '') {
                            playbook = input;
                        }

                        if (!utilities.validatePlaybook(playbook, outputChannel)) {
                            return;
                        }

                        outputChannel.append(Constants.LineSeperator + '\nRun playbook in CloudShell: ' + playbook + '\n');
                        outputChannel.show();

                        const accountApi: AzureAccount = vscode.extensions.getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;

                        openCloudConsole(accountApi, OSes.Linux, [playbook], outputChannel).then(terminal => {
                            //terminal.sendText('ansible-plabybook ' + path.basename(playbook));
                        });
                    });
            }
        }
    )

}
