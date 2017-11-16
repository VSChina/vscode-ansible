'use strict'

const vscode = require('vscode');
const path = require('path');
const terminalExecutor = require('./terminalExecutor.js');
const utilities = require('./utilities.js');
const dockerImageName = 'dockiot/ansible';
const terminalName = 'ansible';

function runAnsibleDokcerInTerminal(outputChannel) {

    var sourceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    var targetFolder = '/' + vscode.workspace.name;

    var sourcePlaybook = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : '';
    var targetPlaybook = path.join(targetFolder, path.relative(sourceFolder, sourcePlaybook));

    var containerId = 'ansible' + Date.now();

    var cmd = 'docker run -it -v ' + sourceFolder + ':' + targetFolder + ' --name ' + containerId + ' ' + dockerImageName + ' /bin/bash';

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

exports.runAnsibleDokcerInTerminal = runAnsibleDokcerInTerminal