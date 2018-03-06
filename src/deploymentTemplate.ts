'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import { Constants } from './constants';
import { TelemetryClient } from './telemetryClient';
import { AzureHelpers } from './azureHelpers';
import * as yamljs from 'yamljs';

var Azure = new AzureHelpers();

export class DeploymentTemplate {
    constructor() {}

    public displayDeploymentTemplateMenu() {

        TelemetryClient.sendEvent('deploymenttemplate', { 'action': 'menu' });
        // currently only one option is available, so first menu won't be displayed yet

                                
        let items : vscode.QuickPickItem[] = [];

        items.push({label: "Quickstart Template", description: "Select Azure quickstart template"});
        items.push({label: "Resource Group", description: "Create template from existing resource group"});

        vscode.window.showQuickPick(items).then(selection => {
            // the user canceled the selection
            if (!selection) return;

            if (selection.label == "Quickstart Template") {
                this.selectQuickstartTemplate();
            } else {
                this.createFromResourceGroup();
            }
        });
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

    public createFromResourceGroup() {
        Azure.queryResourceGroups(function(groups) {
            if (groups != null) {
                vscode.window.showQuickPick(groups).then(selection => {
                    // the user canceled the selection
                    if (!selection) return;
        
                });
            }
        })
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
                                
                                let items : vscode.QuickPickItem[] = [];

                                items.push({label: "Link", description: "Create link to template using lookup"});
                                items.push({label: "Expand", description: "Expand template inline"});

                                vscode.window.showQuickPick(items).then(selection => {
                                    // the user canceled the selection
                                    if (!selection) return;
                                        
                                    __this.createPlaybookFromTemplate(null, "https://" + Constants.GitHubRawContentHost + "/" + repo + "/master/" + templateName + "/azuredeploy.json", parsed, (selection.label == 'Expand'));                                    
                                });
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

    public createPlaybookFromTemplate(prefixPlaybook: string[], location: string, template: object, expand: boolean) {
        let __this = this;
        
        // create new yaml document if not current document
        if (vscode.window.activeTextEditor == undefined || vscode.window.activeTextEditor.document.languageId != "yaml") {
            vscode.workspace.openTextDocument({language: "yaml", content: ""} ).then((a: vscode.TextDocument) => {
                vscode.window.showTextDocument(a, 1, false).then(e => {
                    let prefix: string[] = ["- hosts: localhost",
                                            "  tasks:"];
                    __this.createPlaybookFromTemplate(prefix, location, template, expand);
                });
            });
        } else {
            TelemetryClient.sendEvent('deploymenttemplate', { 'action': 'inserted', 'template': location });

            let playbook = "";

            if (prefixPlaybook != null) {
                for (var l in prefixPlaybook) playbook += prefixPlaybook[l] + "\r";
            }

            let prefix = "    ";
            playbook += prefix + "- name: Create resource using Azure deployment template\r" +
                        prefix + "  azure_rm_deployment:\r" +
                        prefix + "    resource_group_name: ${1:your-resource-group}\r" +
                        prefix + "    location: ${2:eastus}\r" +
                        prefix + "    state: present\r" +
                        prefix + "    parameters:\r";
            let tabstop: number = 3;
            for (var p in template['parameters']) {
                if (template['parameters'][p]['defaultValue']) {
                    playbook += prefix + "      #" + p + ":\r";
                    playbook += prefix + "      #  value: " + template['parameters'][p]['defaultValue'] + "\r"; 
                } else {
                    playbook += prefix + "      " + p + ":\r";
                    playbook += prefix + "        value: ${" +  tabstop++ + "}\r"; 
                }
            }

            playbook += prefix + "    template:\r"

            if (expand) {
                let templateYaml: string[] = yamljs.stringify(template, 10, 2).replace(/[$]/g, "\\$").split(/\r?\n/);

                for (var i = 0; i < templateYaml.length; i++) {
                    playbook += prefix + "      " + templateYaml[i] + "\r";
            }
            } else {
                playbook +=  prefix + "    template: \"{{ lookup('url', '" + location + "', split_lines=False) }}\"\r";            
            }
            

            playbook += "$end";

            let insertionPoint = new vscode.Position(vscode.window.activeTextEditor.document.lineCount, 0);
            vscode.window.activeTextEditor.insertSnippet(new vscode.SnippetString(playbook), insertionPoint);
        }
    }
}
