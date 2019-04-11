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
import * as ssh from 'ssh2';
import * as childprocess from 'child_process';

const sshConfigFile = path.join(os.homedir(), '.ssh', 'servers.json');

export function localExecCmd(cmd: string, args: string[], outputChannel: vscode.OutputChannel, cb: Function): void {
    try {
        var cp = childprocess.spawn(cmd, args);

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
    var cmd = process.platform === 'win32' ? 'wsl -- ansible --version' : 'type ansible';

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

export function IsNodeInstalled(): Promise<boolean> {
    var cmd = 'node --version';
    return new Promise<boolean>((resolve, reject) => {
        child_process.exec(cmd).on('exit', function (code) {
            if (!code) {
                return resolve(true);
            } else {
                const open: vscode.MessageItem = { title: "View" };
                vscode.window.showErrorMessage('Please install Node.js 6 or later version.', open)
                    .then(response => {
                        if (response === open) {
                            opn('https://nodejs.org');
                        }
                        return resolve(false);
                    });
            }
        });
    })
}

export function IsWslInstalled(): Promise<boolean> {
    var cmd = 'wsl.exe -- ls';
    return new Promise<boolean>((resolve, reject) => {
        child_process.exec(cmd).on('exit', function (code) {
            if (!code) {
                return resolve(true);
            } else {
                const open: vscode.MessageItem = { title: "View" };
                vscode.window.showErrorMessage('Please install Windows Subsystem for Linux.', open)
                    .then(response => {
                        if (response === open) {
                            opn('https://docs.microsoft.com/en-us/windows/wsl/install-win10');
                        }
                        return resolve(false);
                    });
            }
        });
    })
}

export function isWslEnabled(): boolean {
    return IsWslInstalled() && getCodeConfiguration('ansible', 'useWSL');
}

export function validatePlaybook(playbook: string): boolean {
    if (!fsExtra.existsSync(playbook)) {
        vscode.window.showErrorMessage('No such file or directory: ' + playbook);
        return false;
    }

    if (path.parse(playbook).ext != '.yml' && path.parse(playbook).ext != '.yaml') {
        vscode.window.showErrorMessage('Playbook is not yaml file: ' + playbook);
        return false;
    }

    return true;

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
    var configValue = getCodeConfiguration<string>('ansible', Constants.Config_credentialsFile);

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
    if (!section) {
        section = 'ansible';
    }
    if (vscode.workspace.getConfiguration(section).has(configName)) {
        return vscode.workspace.getConfiguration(section).get<T>(configName);
    } else {
        return null;
    }
}

export function updateCodeConfiguration(section, configName, configValue, global: boolean = false) {
    if (!section) {
        section = 'ansible';
    }

    return vscode.workspace.getConfiguration(section).update(configName, configValue, global);
}

export function copyFilesRemote(source: string, dest: string, sshServer: SSHServer): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (!sshServer) {
            reject('Invalid ssh server!');
        }

        if (!source || !fsExtra.existsSync(source)) {
            reject('No such file or directory: ' + source);
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
                vscode.window.showErrorMessage('File does not exist: ' + sshServer.key);
                reject('File does not exist: ' + sshServer.key);
            }

            client = {
                host: sshServer.host,
                port: sshServer.port,
                username: sshServer.user,
                privateKey: String(fsExtra.readFileSync(sshServer.key)),
                passphrase: sshServer.passphrase,
                path: dest
            };
        }

        try {

            var conn = new ssh.Client();

            conn.connect({
                host: sshServer.host,
                port: sshServer.port,
                username: sshServer.user,
                password: sshServer.password,
                passphrase: sshServer.passphrase,
                privateKey: sshServer.key ? fsExtra.readFileSync(sshServer.key) : sshServer.key
            });

            conn.on('error', (err) => {
                reject(err);
            });

            conn.end();
            scp.scp(source, client, (err) => {
                if (err) {
                    vscode.window.showErrorMessage('Failed to copy ' + source + ' to ' + sshServer.host + ': ' + err);
                    return reject(err);
                } else {

                    return resolve();
                }
            });
        } catch (err) {
            reject('scp error: ' + err);
        }
    });
}

function scpCopy(source, client, host, reject, resolve) {
    scp.scp(source, client, (err) => {
        if (err) {
            vscode.window.showErrorMessage('Failed to copy ' + source + ' to ' + host + ': ' + err);
            reject(err);
        }
        resolve();
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

export function getSSHServer(hostname: string): SSHServer {
    let servers = getSSHConfig();

    for (let server of servers) {
        if (server.host === hostname) {
            return server;
        }
    }
    return null;
}

export function updateSSHConfig(server: SSHServer): void {
    var servers: SSHServer[] = [];

    if (!server) {
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

    for (let i = 0; i < servers.length; i++) {
        if (servers[i].host.trim() === server.host.trim()) {
            servers.splice(i, 1);
            break;
        }
    }
    servers.push(server);

    fsExtra.writeJsonSync(sshConfigFile, servers, { spaces: '  ' });
}


export function stop(interval: NodeJS.Timer): void {
    clearInterval(interval);
}

export function getWorkspaceRoot(playbook: string): string {
    let rootWorkspace = vscode.workspace.workspaceFolders;
    if (rootWorkspace && rootWorkspace.length > 0) {
        return rootWorkspace[0].uri.fsPath;
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

export async function delay(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

export function isSubPath(child: string, parent: string): boolean {
    if (child === parent) return false;
    let parentTokens = [];
    parent.split(/\\/).forEach((s) => parentTokens = parentTokens.concat(s.split(/\//).filter(i => i.length)));

    let childTokens = [];
    child.split(/\\/).forEach((s) => childTokens = childTokens.concat(s.split(/\//).filter(i => i.length)));
    return parentTokens.every((t, i) => childTokens[i] === t);
}

export function posixPath(path: string): string {
    if (path) {
        return path.replace(/\\/g, '/');
    }
    return path;
}