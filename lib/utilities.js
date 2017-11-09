'use strict'

const vscode = require('vscode');
const dockerImageName = 'williamyeh/ansible:ubuntu16.04';

function localExecCmd(cmd, args, outputChannel, cb) {
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


function isDockerInstalled(outputChannel, cb) {
    if (process.platform === 'win32') {
        localExecCmd('cmd.exe', ['/c', 'docker', '-v'], outputChannel, function (err) {
            if (err) {
                vscode.window.showErrorMessage('Docker isn\'t installed, please install Docker firstly!');
                cb();
            } else {
                cb(err);
            }
        });
    }
}

function runPlayBook(playbook, outputChannel) {
    outputChannel.append('Start to run playbook: ' + playbook + '\n');
    outputChannel.show();

    if (process.platform === 'win32') {
        isDockerInstalled(outputChannel, function (err) {
            if (!err) {
                localExecCmd('cmd.exe', ['/c', 'docker', 'run',
                    '--rm', '-v', playbook + ':/ansible-playbook.yml', dockerImageName, 'ansible-playbook', '/ansible-playbook.yml'], outputChannel);
            }
        });
    } else {
        vscode.window.showErrorMessage('platform not supported yet: ' + process.platform);
    }
}


exports.localExecCmd = localExecCmd;
exports.isDockerInstalled = isDockerInstalled;
exports.runPlayBook = runPlayBook;