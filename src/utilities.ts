'use strict'

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fsExtra from 'fs-extra';
import * as yamljs from 'yamljs';
import * as os from 'os';
import { Constants } from './constants';

export function localExecCmd(cmd: string, args: string[], outputChannel: vscode.OutputChannel, cb: Function): void {
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


export function isDockerInstalled(outputChannel: vscode.OutputChannel, cb: Function): void {
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

export function isAnsibleInstalled(outputChannel: vscode.OutputChannel, cb: Function): void {
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


export function validatePlaybook(playbook: string, outputChannel: vscode.OutputChannel): boolean {
    var message = Constants.LineSeperator + '\nValidate playbook: passed.\n';
    var isValid = true;

    if (path.parse(playbook).ext != '.yml') {
        message = Constants.LineSeperator + '\nValidate playbook: failed! file extension is not yml.\n';
        isValid = false;
    }

    if (outputChannel) {
        // todo: more validation
        outputChannel.append(message);
        outputChannel.show();
    }
    return isValid;
}


// return array of credential items
// eg. azure_subs_id xxxxx
export function parseCredentialsFile(): string[] {
    var configValue = vscode.workspace.getConfiguration('ansible').get('credentialsFile');    
    if (configValue === undefined || configValue === '') {        
        return;
    }
    
    var credFilePath = path.resolve(vscode.workspace.rootPath, configValue);
    var credentials = [];

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

export function generateCredentialsFile(): void {
    const credentialFilePath = path.join(os.homedir(), '.vscode', 'ansible-credentials.yml');

    fsExtra.copySync(path.join(__dirname, '..', 'config', 'credentials.yml'), credentialFilePath);

    vscode.workspace.getConfiguration('ansible').update('credentialsFile', credentialFilePath);
}