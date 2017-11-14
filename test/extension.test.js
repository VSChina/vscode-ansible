/* global suite, test */

const assert = require('assert');
const vscode = require('vscode');
const extensionId = 'yungez.vsc-extension-ansible';

suite("Extension Tests", function () {

    test("should be present", function () {
        assert.ok(vscode.extensions.getExtension(extensionId));
    });

    test("should be able to activate", function () {
        this.timeout(5 * 1000);
        const extension = vscode.extensions.getExtension(extensionId);
        if (!extension.isActive) {
            extension.activate().then(function () {
                assert.ok('extension activated');
            }, function () {
                assert.fail('extension failed to activate!');
            })
        }
    })

    test("should be able to register ansible commands", function () {
        const extension = vscode.extensions.getExtension(extensionId);
        extension.activate().then(function () {
            return vscode.commands.getCommands(true).then(function (commands) {
                const COMMANDS = [
                    'vsc-extension-ansible.ansible-playbook',
                    'vsc-extension-ansible.ansible-commands'
                ].sort();

                var foundCmds = commands.filter(function (e) {
                    return e.startsWith('vsc-extension-ansible');
                }).sort();

                assert.equal(foundCmds.length, COMMANDS.length, 'some commands are not registered properly');
            }, function () {
                assert.fail('failed to getCommands!');
            })
        });
    })

    test("should be able to run ansible command", function () {
        const extension = vscode.extensions.getExtension(extensionId);
        extension.activate().then(function () {
            vscode.commands.executeCommand('vsc-extension-ansible.ansible-commands', 'ansible --version').then(
                function (result) {
                    assert.ok('cmd run done.' + result);
                },
                function () {
                    assert.fail('failed to run ansible cmd!');
                }
            )
        })
    })
});