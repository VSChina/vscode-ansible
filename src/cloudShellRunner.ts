import { window, extensions, MessageOptions, MessageItem } from 'vscode';
import { AzureAccount } from "./azure-account.api";
import { Constants } from "./constants";
import * as utilities from "./utilities";
import { openCloudConsole, OSes } from './cloudConsole';
import * as path from 'path';

export function runPlaybook(outputChannel) {
    const msgOption: MessageOptions = { modal: false };
    const msgItem: MessageItem = { title: 'Confirm' };

    const promptMsg = 'Warning: Run ansible playbook in Cloudshell will generate Azure storage usage fee since need uploading playbook to CloudShell!\n' +
        'Please view detail at https://docs.microsoft.com/en-us/azure/cloud-shell/pricing';
    window.showWarningMessage(promptMsg, msgOption, msgItem).then(
        response => {
            if (response === msgItem) {
                var playbook = window.activeTextEditor ? window.activeTextEditor.document.fileName : null;

                window.showInputBox({ value: playbook, prompt: 'Please input playbook name', placeHolder: 'playbook', password: false })
                    .then(async (input) => {
                        if (input != undefined && input != '') {
                            playbook = input;
                        }

                        if (!utilities.validatePlaybook(playbook, outputChannel)) {
                            return;
                        }

                        outputChannel.append(Constants.LineSeperator + '\nRun playbook in CloudShell: ' + playbook + '\n');
                        outputChannel.show();

                        const accountApi: AzureAccount = extensions.getExtension<AzureAccount>("ms-vscode.azure-account")!.exports;

                        openCloudConsole(accountApi, OSes.Linux, [playbook], outputChannel).then(terminal => {
                            //terminal.sendText('ansible-plabybook ' + path.basename(playbook));
                        });
                    });
            }
        }
    )

}
