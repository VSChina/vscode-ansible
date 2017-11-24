'use strict'

import * as vscode from 'vscode';
import * as utilities from './utilities';
import * as child_process from 'child_process';
import * as path from 'path';
import * as terminalExecutor from './terminalExecutor';

const dockerImageName = 'dockiot/ansible';
const terminalName = 'ansible';

export function runAnsibleDockerInTerminal(outputChannel) {

    var sourceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    var targetFolder = '/' + (vscode.workspace as any).name;

    var sourcePlaybook = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : '';
    var targetPlaybook = path.join(targetFolder, path.relative(sourceFolder, sourcePlaybook));

    var containerId = 'ansible' + Date.now();

    // get environment variables
    var envOptions = '';
    var credentials = utilities.parseCredentialsFile(outputChannel);
    if (credentials) {
        for(var item in credentials) {
            envOptions += ' -e ' + item + '=' + credentials[item];
        }                
    }

    var cmd = 'docker run -it -v ' + sourceFolder + ':' + targetFolder + ' --name ' + containerId + envOptions + ' ' + dockerImageName + ' /bin/bash';

    if (!utilities.validatePlaybook(sourcePlaybook, outputChannel)) {
        return;
    }
    if (process.platform === 'win32') {
        var cmds = [cmd];
        //cmds.push('ansible-playbook ' + targetPlaybook);
        utilities.isDockerInstalled(outputChannel, function (err) {
            if (!err) {
                terminalExecutor.runInTerminal(cmds, terminalName);
            }
        });
    } else {
    }

}
