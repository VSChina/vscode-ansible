/* global suite, test */

import * as assert from 'assert';
import * as vscode from 'vscode';
const extensionId = 'vscoss.vscode-ansible';

suite("Extension Tests", () => {

    test("should be present", function () {
        assert.ok(vscode.extensions.getExtension(extensionId));
    });

    test("should be able to activate", function () {
        this.timeout(10 * 1000);
        const extension = vscode.extensions.getExtension(extensionId);
        if (!extension.isActive) {
            extension.activate().then(function () {
                assert.ok('extension activated');
            }, function () {
                assert.fail(false, true, 'extension failed to activate!');
            })
        }
    })

    test("should be able to register ansible commands", function () {
        const extension = vscode.extensions.getExtension(extensionId);
        extension.activate().then(function () {
            return vscode.commands.getCommands(true).then(function (commands) {
                const COMMANDS = [
                    'vscode-ansible.playbook-in-terminal',
                    'vscode-ansible.cloudshell',
                    'vscode-ansible.playbook-in-docker',
                    'vscode-ansible.playbook-in-localansible',
                    'vscode-ansible.deployment-templates'
                ].sort();

                var foundCmds = commands.filter(function (e) {
                    return e.startsWith('vscode-ansible');
                }).sort();

                assert.equal(foundCmds.length, COMMANDS.length, 'some commands are not registered properly');
            }, function () {
                assert.fail(false, true, 'failed to getCommands!');
            })

        });
    })
});