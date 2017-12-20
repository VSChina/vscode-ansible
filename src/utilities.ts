'use strict'

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fsExtra from 'fs-extra';
import * as yamljs from 'yamljs';
import * as os from 'os';
import { Constants } from './constants';
import * as opn from 'opn';

export function localExecCmd(cmd: string, args: string[], outputChannel: vscode.OutputChannel, cb: Function): void {
    try {
        var cp = require('child_process').spawn(cmd, args);

        cp.stdout.on('data', function (data) {
            if (outputChannel) {
                outputChannel.append('\n' + String(data));
                outputChannel.show();
            }
        });

        cp.stderr.on('data', function (data) {
            if (outputChannel) outputChannel.append('\n' + String(data));
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

        cp.on('error', function (code) {
            if (cb) {
                cb(code);
            }
        });
    } catch (e) {
        e.stack = "ERROR: " + e;
        if (cb) cb(e);
    }
}


export function isDockerInstalled(outputChannel: vscode.OutputChannel, cb: Function): void {
    var cmd = 'cmd.exe';
    var args = ['/c', 'docker', '-v'];

    if (process.platform === 'linux' || process.platform === 'darwin') {
        cmd = 'docker';
        args = ['--version'];
    }

    localExecCmd(cmd, args, outputChannel, function (err) {
        if (err) {
            vscode.window.showErrorMessage('Docker isn\'t installed, please install Docker firstly!');
            cb(err);
        } else {            
            cb();
        }
    });
}

export function isAnsibleInstalled(outputChannel: vscode.OutputChannel, cb: Function): void {
    child_process.exec("type ansible").on('exit', function (code) {
        if (!code) {
            cb();
        } else {
            outputChannel.append('\nPlease go to below link and install Ansible first.');
            outputChannel.append('\nhttp://docs.ansible.com/ansible/latest/intro_installation.html#latest-releases-on-mac-osx');
            outputChannel.show();

            const open: vscode.MessageItem = { title: "View." };
            vscode.window.showErrorMessage('Please go to below link and install Ansible first.', open)
                .then(response => {
                    if (response === open) {
                        opn('http://docs.ansible.com/ansible/latest/intro_installation.html#latest-releases-on-mac-osx');
                    }
                });
        }
    })
}


export function validatePlaybook(playbook: string, outputChannel: vscode.OutputChannel): boolean {
    var message = '\nValidate playbook: passed.';
    var isValid = true;

    if (path.parse(playbook).ext != '.yml') {
        message = '\nValidate playbook: failed! file extension is not yml.';
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
export function parseCredentialsFile(outputChannel): string[] {
    var configValue = vscode.workspace.getConfiguration('ansible').get('credentialsFile');
    if (configValue === undefined || configValue === '') {

        outputChannel.show();
        configValue = path.join(os.homedir(), '.vscode', 'ansible-credentials.yml');
    }

    outputChannel.append('\ncredential file: ' + configValue);
    outputChannel.show();
    var credentials = [];

    if (fsExtra.pathExistsSync(configValue)) {
        var creds = yamljs.load(configValue);

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

    if (!fsExtra.existsSync(credentialFilePath)) {
        fsExtra.copySync(path.join(__dirname, '..', 'config', 'credentials.yml'), credentialFilePath);
    }
}

export function getUserAgent(): string {
    return Constants.ExtensionId + '-' + vscode.extensions.getExtension(Constants.ExtensionId).packageJSON.version;
}

export function isTelemetryEnabled(): boolean {
    return vscode.workspace.getConfiguration('telemetry').get<boolean>('enableTelemetry', true);
}