'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import { Constants } from './constants';
import { TelemetryClient } from './telemetryClient';

var request = require('request');

export class DeploymentTemplate {
    constructor() {}

    public displayDeploymentTemplateMenu() {

        TelemetryClient.sendEvent('deploymenttemplate', { 'action': 'menu' });
        // currently only one option is available, so first menu won't be displayed yet
        this.selectQuickstartTemplate();
    }

    public selectQuickstartTemplate() {

        // get list of directories from here:
        // https://api.github.com/[repo_user/repo_name]/contents/
        // we will use fixed repo in our first release
        let repo: string = Constants.AzureQuickStartTemplates;

        var http = require('https');
        let __this = this;

            http.get({
                host: Constants.GitHubApiHost,
                path: '/repos/' + repo + '/contents/',
                headers: { 'User-Agent': 'VSC Ansible Extension'}
            }, function(response) {
                // Continuously update stream with data

                if (response.statusMessage == "OK") {
                    var body = '';
                    response.on('data', function(d) {
                        body += d;
                    });
                    response.on('end', function() {
                        var parsed = JSON.parse(body);
                        let items: vscode.QuickPickItem[] = [];
                
                        for (var i in parsed)
                        {
                            // list only directories and skip known directories that don't contain templates
                            if (parsed[i].type == "dir" && !parsed[i].name.startsWith('.')) {
                                items.push({ label: parsed[i].name, description: null });
                            }
                        }
                        vscode.window.showQuickPick(items).then(selection => {
                            // the user canceled the selection
                            if (!selection) {
                                return;
                            }        
                            
                            __this.retrieveTemplate(selection.label);
                        });
                    });
                } else {
                    vscode.window.showErrorMessage("Failed to fetch list of templates: " + response.statusCode + " " + response.statusMessage);
                }

            }).on('error', function(e) {
                vscode.window.showErrorMessage("Failed to fetch list of templates: " + e);
            });
        
    }

    public retrieveTemplate(templateName: string) {
        var http = require('https');
        let __this = this;
        let repo: string = Constants.AzureQuickStartTemplates;

            http.get({
                host: Constants.GitHubRawContentHost,
                path: '/' + repo + '/master/' + templateName + '/azuredeploy.json',
                headers: { 'User-Agent': 'VSC Ansible Extension'}
                }, function(response) {
                    if (response.statusMessage == "OK") {
                        var body = '';
                        response.on('data', function(d) {
                            body += d;
                        });
                        response.on('end', function() {
                            try {
                                var parsed = JSON.parse(body);

                                __this.createPlaybookFromTemplate("https://" + Constants.GitHubRawContentHost + "/" + repo + "/master/" + templateName + "/azuredeploy.json",
                                                                parsed);
                            } catch (e) {
                                vscode.window.showErrorMessage("Failed to parse 'azuredeploy.json'");
                            }
                        });
                    } else if (response.statusCode == 404) {
                        vscode.window.showErrorMessage("Template file 'azuredeploy.json' not found.");
                    } else {
                        vscode.window.showErrorMessage("Failed to fetch 'azuredeploy.json': " + response.statusCode + " " + response.statusMessage);
                    }
                }).on('error', function(e) {
                    vscode.window.showErrorMessage("Failed to fetch 'azuredeploy.json': " + e);
                });
    }

    public createPlaybookFromTemplate(location: string, template: object) {
        let __this = this;

        TelemetryClient.sendEvent('deploymenttemplate', { 'action': 'inserted', 'template': location });
        
        // create yaml document if not current document
        if (vscode.window.activeTextEditor == undefined || vscode.window.activeTextEditor.document.languageId != "yaml") {
            vscode.workspace.openTextDocument({language: "yaml", content: playbook} ).then((a: vscode.TextDocument) => {
                vscode.window.showTextDocument(a, 1, false).then(e => {
                    e.edit(edit => {
                        let header: string = "- hosts: localhost\r" +
                                             "  tasks:\r";
                        edit.insert(new vscode.Position(0, 0), header);
                        __this.createPlaybookFromTemplate(location, template);
                    });
                });
            });
        } else {
            var playbook: string = "- name: Create resource using Azure deployment template\r" +
                                "  azure_rm_deployment:\r" +
                                "    resource_group_name: ${1}\r" +
                                "    location: ${2}\r" +
                                "    state: present\r" +
                                "    parameters:\r";
            let tabstop: number = 3;
            for (var p in template['parameters']) {
                if (template['parameters'][p]['defaultValue']) {
                    playbook += "      #" + p + ":\r";
                    playbook += "      #  value: " + template['parameters'][p]['defaultValue'] + "\r"; 
                } else {
                    playbook += "      " + p + ":\r";
                    playbook += "        value: ${" +  tabstop++ + "}\r"; 
                }
            }

            playbook +=            "    template: \"{{ lookup('url', '" + location + "', split_lines=False) }}\"\r";
            playbook += "$end";

            let insertionPoint = new vscode.Position(vscode.window.activeTextEditor.document.lineCount, 4);
            vscode.window.activeTextEditor.insertSnippet(new vscode.SnippetString(playbook), insertionPoint);
        }
    }
}
