'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import { Constants } from './constants';
import { TelemetryClient } from './telemetryClient';

var request = require('request');

export class DeploymentTemplate {
    constructor() {}

    public displayDeploymentTemplateMenu() {

        TelemetryClient.sendEvent('deployment');
        // currently only one option is available, so first menu won't be displayed yet
        this.selectQuickstartTemplate();
    }

    public selectQuickstartTemplate() {

        // get list of directories from here:
        // https://api.github.com/[repo_user/repo_name]/contents/
        let repo: string = utilities.getCodeConfiguration<string>(null, Constants.Config_deploymentTemplatesGitHubRepo);

        var http = require('https');
        let __this = this;

            http.get({
                host: 'api.github.com',
                path: '/repos/' + repo + '/contents/',
                headers: { 'User-Agent': 'VSC Ansible Extension'}
            }, function(response) {
                // Continuously update stream with data
                var body = '';
                response.on('data', function(d) {
                    body += d;
                });
                response.on('end', function() {
        
                    // Data reception is done, do whatever with it!
                    var parsed = JSON.parse(body);
                    let items: vscode.QuickPickItem[] = [];
            
                    for (var i in parsed)
                    {
                        // list only directories and skip known directories that don't contain templates
                        if (parsed[i].type == "dir" && parsed[i].name != "1-CONTRIBUTION-GUIDE" && parsed[i].name != ".github") {
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
            });
        
    }

    public retrieveTemplate(templateName: string) {
        var http = require('https');
        let __this = this;
        let repo: string = utilities.getCodeConfiguration<string>(null, Constants.Config_deploymentTemplatesGitHubRepo);

            http.get({
                host: 'raw.githubusercontent.com',
                path: '/' + repo + '/master/' + templateName + '/azuredeploy.json',
                headers: { 'User-Agent': 'VSC Ansible Extension'}
            }, function(response) {
                // Continuously update stream with data
                var body = '';
                response.on('data', function(d) {
                    body += d;
                });
                response.on('end', function() {
        
                    // Data reception is done, do whatever with it!
                    var parsed = JSON.parse(body);

                    __this.createPlaybookFromTemplate("https://raw.githubusercontent.com/' + repo + '/master/" + templateName + '/azuredeploy.json',
                                                      parsed);
                });
            });
    }

    public createPlaybookFromTemplate(location: string, template: object) {
        let __this = this;

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
            var playbook: string = "- name: Create resource using deployment template\r" +
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

            playbook +=            "        template: \"{{ lookup('url', '" + location + "', split_lines=False) }}\"\r";
            playbook += "$end";

            let insertionPoint = new vscode.Position(vscode.window.activeTextEditor.document.lineCount, 4);
            vscode.window.activeTextEditor.insertSnippet(new vscode.SnippetString(playbook), insertionPoint);
        }
    }
}
