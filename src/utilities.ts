'use strict'

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fsExtra from 'fs-extra';
import * as yamljs from 'yamljs';
import * as os from 'os';
import { Constants } from './constants';
import * as opn from 'opn';
import { platform } from 'os';
import { SSHServer } from './interfaces';
import * as scp from 'scp2';
import { clearInterval } from 'timers';

const sshConfigFile = path.join(os.homedir(), '.ssh', 'servers.json');

export function localExecCmd(cmd: string, args: string[], outputChannel: vscode.OutputChannel, cb: Function): void {
    try {
        var cp = require('child_process').spawn(cmd, args);

        cp.stdout.on('data', function (data) {
            if (outputChannel) {
                outputChannel.appendLine('\n' + String(data));
                outputChannel.show();
            }
        });

        cp.stderr.on('data', function (data) {
            if (outputChannel) outputChannel.appendLine('\n' + String(data));
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
            vscode.window.showErrorMessage('Docker isn\'t installed, please install Docker first!');
        }
        cb(err);
    });
}

export function isAnsibleInstalled(outputChannel: vscode.OutputChannel, cb: Function): void {
    var cmd = process.platform === 'win32' ? 'ansible --version' : 'type ansible';

    child_process.exec(cmd).on('exit', function (code) {
        if (!code) {
            cb();
        } else {
            outputChannel.appendLine('\nPlease go to below link and install Ansible first.');
            outputChannel.appendLine('http://docs.ansible.com/ansible/latest/intro_installation.html');
            outputChannel.show();

            const open: vscode.MessageItem = { title: "View" };
            vscode.window.showErrorMessage('Please go to below link and install Ansible first.', open)
                .then(response => {
                    if (response === open) {
                        opn('http://docs.ansible.com/ansible/latest/intro_installation.html');
                    }
                });
        }
    })
}

export function IsNodeInstalled(outputChannel: vscode.OutputChannel, cb: Function): void {
    var cmd = 'node --version';

    child_process.exec(cmd).on('exit', function (code) {
        if (!code) {
            cb();
        } else {
            outputChannel.appendLine('Please install Node.js 6 or later version\n.');
            outputChannel.show();

            const open: vscode.MessageItem = { title: "View" };
            vscode.window.showErrorMessage('Please install Node.js 6 or later version.', open)
                .then(response => {
                    if (response === open) {
                        opn('https://nodejs.org');
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
        outputChannel.appendLine(message);
        outputChannel.show();
    }
    return isValid;
}


// return array of credential items
// eg. azure_subs_id xxxxx
export function parseCredentialsFile(outputChannel): string[] {
    var configValue = getCredentialsFile();

    if (outputChannel != null) {
        outputChannel.appendLine('\nCredential file: ' + configValue);
        outputChannel.show();
    }
    var credentials = [];

    if (fsExtra.pathExistsSync(configValue)) {
        var creds = yamljs.load(configValue);

        for (var cloudprovider in creds) {
            for (var configItem in creds[cloudprovider]) {
                if (!creds[cloudprovider][configItem].startsWith('your_')) {
                    credentials[configItem] = creds[cloudprovider][configItem];
                }
            }
        }
    }
    return credentials;
}

export function getCredentialsFile(): string {
    var configValue = getCodeConfiguration<string>(null, Constants.Config_credentialsFile);

    if (configValue === undefined || configValue === '') {
        configValue = path.join(os.homedir(), '.vscode', 'ansible-credentials.yml');
    }
    return configValue;
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

export function isCredentialConfigured(): boolean {
    return getCodeConfiguration<boolean>(null, Constants.Config_credentialConfigured);
}

export function isTelemetryEnabled(): boolean {
    return getCodeConfiguration<boolean>('telemetry', 'enableTelemetry');
}

export function getCodeConfiguration<T>(section, configName): T {
    if (section === undefined || section === null) {
        section = 'ansible';
    }
    if (vscode.workspace.getConfiguration(section).has(configName)) {
        return vscode.workspace.getConfiguration(section).get<T>(configName);
    } else {
        return null;
    }
}

export function updateCodeConfiguration(section, configName, configValue) {
    if (section === undefined || section === null) {
        section = 'ansible';
    }

    if (vscode.workspace.getConfiguration(section).has(configName)) {
        return vscode.workspace.getConfiguration(section).update(configName, configValue);
    }
}

export function copyFileRemote(source: string, dest: string, sshServer: SSHServer, cb: Function): boolean {
    if (!sshServer) {
        console.log('invalid ssh server!');
        return false;
    }

    if (!source || !fsExtra.existsSync(source)) {
        console.log('invalid source file: ' + source);
        return false;
    }

    var client: {};

    if (sshServer.password) {
        client = {
            host: sshServer.host,
            port: sshServer.port,
            username: sshServer.user,
            password: sshServer.password,
            path: dest
        };
    } else if (sshServer.key) {
        if (!fsExtra.existsSync(sshServer.key)) {
            vscode.window.showErrorMessage('File not exists: ' + sshServer.key);
        }
        client = {
            host: sshServer.host,
            port: sshServer.port,
            username: sshServer.user,
            privateKey: String(fsExtra.readFileSync(sshServer.key)),
            path: dest
        };
    }

    scp.scp(source, client, (err) => {
        if (err) {
            vscode.window.showErrorMessage('Failed to copy file ' + source + ' to ' + sshServer.host + ': ' + err);
        }
        return cb(err);
    });
}

export function getSSHConfig(): SSHServer[] {

    if (fsExtra.existsSync(sshConfigFile)) {
        try {
            return <SSHServer[]>JSON.parse(fsExtra.readFileSync(sshConfigFile));
        } catch (err) {
            return null;
        }
    }

    return null;
}

export function updateSSHConfig(server: SSHServer): void {
    var servers: SSHServer[] = [];

    if (server === undefined || server === null) {
        return;
    }
    if (fsExtra.existsSync(sshConfigFile)) {
        try {
            servers = <SSHServer[]>JSON.parse(fsExtra.readFileSync(sshConfigFile));
        } catch (err) {
        }
    } else {
        fsExtra.ensureDirSync(path.dirname(sshConfigFile));
    }

    for (let exist of servers) {
        if (exist.host === server.host) {
            return;
        }
    }
    servers.push(server);

    fsExtra.writeJsonSync(sshConfigFile, servers, { spaces: '  ' });
}


export function stop(interval: NodeJS.Timer): void {
    clearInterval(interval);
}

export function getWorkspaceRoot(playbook: string): string {
    if (vscode.workspace.getWorkspaceFolder) {
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    } else {
        return path.dirname(playbook);
    }
}

export function delayedInterval(func: () => void, interval: number) {
    const handle = setInterval(func, interval);
    return {
        cancel: () => clearInterval(handle)
    }
}