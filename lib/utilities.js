'use strict'

const vscode = require('vscode');
const path = require('path');
const dockerImageName = 'williamyeh/ansible:ubuntu16.04';
const child_process = require('child_process');

const seperator = Array(50).join('=');

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
                cb(err);
            } else {
                cb()
            }
        });
    }
}

function isAnsibleInstalled(outputChannel, cb) {
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

function runPlayBook(outputChannel) {
    outputChannel.append(seperator + '\nRun playbook: ' + playbook + '\n');
    outputChannel.show();

    var playbook = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
    vscode.window.showInputBox({ value: playbook, prompt: 'Please input playbook name', placeHolder: 'playbook', password: false })
        .then((input) => {
            if (input != undefined && input != '') {
                playbook = input;
            }
            var fileName = path.parse(playbook).base;
            var targetFile = '/' + fileName;

            if (!validatePlaybook(playbook, outputChannel)) {
                return;
            }
            if (process.platform === 'win32') {
                isDockerInstalled(outputChannel, function (err) {
                    if (!err) {
                        localExecCmd('cmd.exe', ['/c', 'docker', 'run',
                            '--rm', '-v', playbook + ':' + targetFile, dockerImageName, 'ansible-playbook', targetFile], outputChannel);
                    }
                });
            } else {
                isAnsibleInstalled(outputChannel, function () {
                    localExecCmd('ansible-playbook', [playbook], outputChannel);
                });
            }
        })
}

function validatePlaybook(playbook, outputChannel) {
    var message = seperator + '\nValidate playbook: passed.\n';
    var isValid = true;

    if (path.parse(playbook).ext != '.yml') {
        message = seperator + '\nValidate playbook: failed! file extension is not yml.\n';
        isValid = false;
    }

    // todo: more validation
    outputChannel.append(message);
    outputChannel.show();

    return isValid;
}

function runAnsibleCommands(outputChannel) {
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
                        localExecCmd('cmd.exe', ['/c', 'docker', 'run', '--rm', dockerImageName].concat(cmds.split(' ')), outputChannel);
                    }
                });
            } else {
                isAnsibleInstalled(outputChannel, function () {
                    localExecCmd(cmds.split(' ')[0], cmds.split(' ').slice(0), outputChannel);
                });
            }
        })
}

exports.localExecCmd = localExecCmd;
exports.runPlayBook = runPlayBook;
exports.runAnsibleCommands = runAnsibleCommands;
exports.validatePlaybook = validatePlaybook;
exports.isDockerInstalled = isDockerInstalled;
exports.isAnsibleInstalled = isAnsibleInstalled;