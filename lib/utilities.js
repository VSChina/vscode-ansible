'use strict'

const vscode = require('vscode');
const path = require('path');
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

    var fileName = path.parse(playbook).base;
    var targetFile = '/' + fileName;    

    if (!validatePlaybook(playbook, outputChannel)) {
        return;
    }

    if (process.platform === 'win32') {
        isDockerInstalled(outputChannel, function (err) {
            if (!err) {
                localExecCmd('cmd.exe', ['/c', 'docker', 'run',
                    '--rm', '-v', playbook + ':' + targetFile, dockerImageName, 'ansible-playbook', targetFile ], outputChannel);
            }
        });
    } else {
        vscode.window.showErrorMessage('platform not supported yet: ' + process.platform);
    }
}

function validatePlaybook(playbook, outputChannel) {
    var message = 'Validate playbook: passed.\n';
    var isValid = true;
    console.log('file extesion: ' + path.parse(playbook).ext);
    if (path.parse(playbook).ext != '.yml') {
        message = 'Validate playbook: failed! file extension is not yml.\n';
        isValid = false;
    }
    // todo: more validation
    
    outputChannel.append(message);
    outputChannel.show();

    return isValid;
}

exports.localExecCmd = localExecCmd;
exports.isDockerInstalled = isDockerInstalled;
exports.runPlayBook = runPlayBook;