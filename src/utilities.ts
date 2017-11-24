'use strict'

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fsExtra from 'fs-extra';
import * as yamljs from 'yamljs';
import * as utilities from './utilities'; 
import * as dockerRunner from './dockerRunner';
import * as terminalExecutor from './terminalExecutor';

import { workspace } from 'vscode';

const dockerImageName = 'dockiot/ansible';
const seperator = Array(50).join('=');

export function localExecCmd(cmd, args, outputChannel, cb) {
    try {
        var cp = require('child_process').spawn(cmd, args);

        cp.stdout.on('data', function (data) {
            if (outputChannel) {
                outputChannel.append(String(data));
                outputChannel.show();
            }
        });

        cp.stderr.on('data', function (data) {
            if (outputChannel) outputChannel.append(String(data));
        });

        cp.on('close', function (code) {
            if (cb) {
                if (0 == code) {
                    cb();
                } else {
                    var e = new Error("External command failed");
                    e.stack = "exit code: " + code;
                    cb(e);
                }
            }
        });
    } catch (e) {
        e.stack = "ERROR: " + e;
        if (cb) cb(e);
    }
}


export function isDockerInstalled(outputChannel, cb) {
    if (process.platform === 'win32') {
        localExecCmd('cmd.exe', ['/c', 'docker', '-v'], outputChannel, function (err) {
            if (err) {
                vscode.window.showErrorMessage('Docker isn\'t installed, please install Docker firstly!');
                cb(err);
            } else {
                cb()
            }
        });
    }
}

export function isAnsibleInstalled(outputChannel, cb) {
    child_process.exec("type ansible").on('exit', function (code) {
        if (!code) {
            cb();
        } else {
            outputChannel.append('Please go to below link and install Ansible first. \n');
            outputChannel.append('http://docs.ansible.com/ansible/latest/intro_installation.html#latest-releases-on-mac-osx');
            outputChannel.show();
        }

    })
}

export function runPlayBook(outputChannel) {
    var playbook = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
    vscode.window.showInputBox({ value: playbook, prompt: 'Please input playbook name', placeHolder: 'playbook', password: false })
        .then((input) => {
            if (input != undefined && input != '') {
                playbook = input;
            }

            outputChannel.append(seperator + '\nRun playbook: ' + playbook + '\n');
            outputChannel.show();
        
            var fileName = path.parse(playbook).base;
            var targetFile = '/' + fileName;

            if (!validatePlaybook(playbook, outputChannel)) {
                return;
            }

            // get environment variables
            var envOptions = [];
            var credentials = parseCredentialsFile(outputChannel);
            if (credentials) {
                for(var item in credentials) {
                    envOptions.push('-e');
                    envOptions.push(item + '=' + credentials[item]);
                }                
            }

            if (process.platform === 'win32') {
                isDockerInstalled(outputChannel, function (err) {
                    if (!err) {
                        var dockerRunOptions = ['/c', 'docker', 'run', '--rm', '-v', playbook + ':' + targetFile],
                        dockerRunOptions = dockerRunOptions.concat(envOptions).concat([dockerImageName, 'ansible-playbook', targetFile]);
                        localExecCmd('cmd.exe', dockerRunOptions, outputChannel, null);
                    }
                });
            } else {
                isAnsibleInstalled(outputChannel, function () {
                    localExecCmd('ansible-playbook', [playbook], outputChannel, null);
                });
            }
        })
}

export function runPlaybookInTerminal() {
    var playbook = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
    vscode.window.showInputBox({ value: playbook, prompt: 'Please input playbook name', placeHolder: 'playbook', password: false })
        .then((input) => {
            if (input != undefined && input != '') {
                playbook = input;
            }
        
            var fileName = path.parse(playbook).base;
            var targetFile = '/' + fileName;

            if (!validatePlaybook(playbook, null)) {
                // [ZKK] display message that playbook is invalid here
                return;
            }

            // normalize path to current workspace directory
            playbook = path.normalize(path.relative(vscode.workspace.rootPath, playbook));
            
            terminalExecutor.runInTerminal([ "ansible-playbook " + playbook ], "ansible");
        })
}
export function validatePlaybook(playbook, outputChannel) {
    var message = seperator + '\nValidate playbook: passed.\n';
    var isValid = true;

    if (path.parse(playbook).ext != '.yml') {
        message = seperator + '\nValidate playbook: failed! file extension is not yml.\n';
        isValid = false;
    }

    if (outputChannel) {
        // todo: more validation
        outputChannel.append(message);
        outputChannel.show();
    }
    return isValid;
}

export function runAnsibleCommands(outputChannel) {
    var cmds = 'ansible --version';
    vscode.window.showInputBox({ value: cmds, prompt: 'Please input ansible commands', placeHolder: 'commands', password: false })
        .then((input) => {
            if (input != undefined && input != '') {
                cmds = input;
            }

            outputChannel.append(seperator + '\nRun ansible commands: ' + cmds + '\n');
            outputChannel.show();


            if (process.platform === 'win32') {
                isDockerInstalled(outputChannel, function (err) {
                    if (!err) {
                        localExecCmd('cmd.exe', ['/c', 'docker', 'run', '--rm', dockerImageName].concat(cmds.split(' ')), outputChannel, null);
                    }
                });
            } else {
                isAnsibleInstalled(outputChannel, function () {
                    localExecCmd(cmds.split(' ')[0], cmds.split(' ').slice(0), outputChannel, null);
                });
            }
        })
}

// return array of credential items
// eg. azure_subs_id xxxxx
export function parseCredentialsFile(outputChannel) {
    var configValue = vscode.workspace.getConfiguration('ansible').get('credentialsFile');
    var credentials = [];
            
    if (configValue === undefined || configValue === '') {
        outputChannel.append('Not specify ansible credentials file.');
        outputChannel.show();
        return;
    }
    var credFilePath = path.resolve(vscode.workspace.workspaceFolders[0].uri.fsPath, configValue);
    
    if (fsExtra.pathExistsSync(credFilePath)) {
        var creds = yamljs.load(credFilePath);        
        
        for (var cloudprovider in creds) {
            for (var configItem in creds[cloudprovider]) {
                credentials[configItem] = creds[cloudprovider][configItem];
            }
        }
    }
    return credentials;
}