'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import { Constants } from './constants';
import { TelemetryClient } from './telemetryClient';
import { AzureHelpers } from './azureHelpers';
import { AzureRestApi } from './azureRestApi';
import * as yamljs from 'yamljs';
import { SourceTreeHelpers } from './sourceTreeHelpers';
import { Swagger } from './swagger';
import { PlaybookManager } from './playbookManager';

var Azure = new AzureHelpers();
var AzureRest = new AzureRestApi();
var pm = new PlaybookManager();

export class DeploymentTemplate extends SourceTreeHelpers {
    constructor() {
        super();
    }

    public displayDeploymentTemplateMenu() {

        TelemetryClient.sendEvent('deploymenttemplate', { 'action': 'menu' });
        // currently only one option is available, so first menu won't be displayed yet

                                
        let items : vscode.QuickPickItem[] = [];

        items.push({label: "Quickstart Template", description: "Select Azure quickstart template"});
        items.push({label: "Resource Group", description: "Create template from existing resource group"});
        items.push({label: "REST API", description: "Create REST API Call"});

        vscode.window.showQuickPick(items).then(selection => {
            // the user canceled the selection
            if (!selection) return;

            if (selection.label == "Quickstart Template") {
                this.selectQuickstartTemplate();
            } else if (selection.label == "Resource Group") {
                this.createFromResourceGroup();
            } else {
                this.createRestApiCall();
            }
        });
    }

    public selectQuickstartTemplate() {
        let __this = this;
        let repo: string = Constants.AzureQuickStartTemplates;
        this.queryDirectory('https://' + Constants.GitHubApiHost + '/repos/' + repo + '/contents/', false, function(dirs) {
            let items: vscode.QuickPickItem[] = [];
                
            for (var i in dirs)
            {
                // list only directories and skip known directories that don't contain templates
                if (!dirs[i].startsWith('.')) {
                    items.push({ label: dirs[i], description: null });
                }
            }
            
            vscode.window.showQuickPick(items).then(selection => {
                // the user canceled the selection
                if (!selection) {
                    return;
                }        
                __this.retrieveTemplate(selection.label);
            });
        })        
    }

    public createFromResourceGroup() {
        let __this = this;

        Azure.queryResourceGroups(function(groups) {
            if (groups != null) {
                vscode.window.showQuickPick(groups).then(selection => {
                    // the user canceled the selection
                    if (!selection) return;
        
                    Azure.getArmTemplateFromResourceGroup(selection, function(template) {
                        if (template != null) {
                            __this.createPlaybookFromTemplate(null, "", template['template'], true);                                    
                        }
                    })
                });
            } else {
                vscode.window.showErrorMessage("Failed to retrieve list of templates");
            }
        })
    }
    
    public retrieveTemplate(templateName: string) {
        let __this = this;
        let repo: string = Constants.AzureQuickStartTemplates;

        this.getJson('https://' + Constants.GitHubRawContentHost + '/' + repo + '/master/' + templateName + '/azuredeploy.json', function(template) {
           
            if (template != null) {
                let items : vscode.QuickPickItem[] = [];

                items.push({label: "Link", description: "Create link to template using lookup"});
                items.push({label: "Expand", description: "Expand template inline"});

                vscode.window.showQuickPick(items).then(selection => {
                    // the user canceled the selection
                    if (!selection) return;
                        
                    __this.createPlaybookFromTemplate(null, "https://" + Constants.GitHubRawContentHost + "/" + repo + "/master/" + templateName + "/azuredeploy.json", template, (selection.label == 'Expand'));                                    
                });
            } else {
                vscode.window.showErrorMessage("Failed to retrieve template");
            }
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

            let prefix = "\t\t";
            playbook += prefix + "- name: Create resource using Azure deployment template\r" +
                        prefix + "\tazure_rm_deployment:\r" +
                        prefix + "\t\tresource_group_name: ${1:your-resource-group}\r" +
                        prefix + "\t\tlocation: ${2:eastus}\r" +
                        prefix + "\t\tstate: present\r" +
                        prefix + "\t\tparameters:\r";
            let tabstop: number = 3;
            for (var p in template['parameters']) {
                if (template['parameters'][p]['defaultValue']) {
                    playbook += prefix + "\t\t\t#" + p + ":\r";
                    playbook += prefix + "\t\t\t#  value: " + template['parameters'][p]['defaultValue'] + "\r"; 
                } else {
                    playbook += prefix + "\t\t\t" + p + ":\r";
                    playbook += prefix + "\t\t\t\tvalue: ${" +  tabstop++ + "}\r"; 
                }
            }

            playbook += prefix + "\t\ttemplate:\r"

            if (expand) {
                let templateYaml: string[] = yamljs.stringify(template, 10, 2).replace(/[$]/g, "\\$").split(/\r?\n/);

                for (var i = 0; i < templateYaml.length; i++) {
                    playbook += prefix + "\t\t\t" + templateYaml[i] + "\r";
            }
            } else {
                playbook +=  prefix + "\t\ttemplate: \"{{ lookup('url', '" + location + "', split_lines=False) }}\"\r";            
            }
            

            playbook += "$end";

            let insertionPoint = new vscode.Position(vscode.window.activeTextEditor.document.lineCount, 0);
            vscode.window.activeTextEditor.insertSnippet(new vscode.SnippetString(playbook), insertionPoint);
        }
    }

    public createRestApiCall() {
        let __this = this;

        let specLocation = 'c:/dev-ansible/azure-rest-api-specs';
        //let specLocation = 'https://api.github.com/Azure/azure-rest-api-specs/contents';

        AzureRest.queryApiGroups(specLocation, function (groups) {
            if (groups != null) {
                vscode.window.showQuickPick(groups).then(selection => {
                    // the user canceled the selection
                    if (!selection) return;

                    __this.selectRestApi(specLocation + "/specification/" + selection);
                });
            } 
        })
    }

    // that will be resource-manager / data-plane etc...
    public selectRestApi(path: string) {
        let __this = this;
        AzureRest.queryApiGroup(path, function (dirs) {
            if (dirs != null) {
                // cut these items a bit

                let items : vscode.QuickPickItem[] = [];

                for (var i = 0; i < dirs.length; i++)
                {
                    items.push({label: dirs[i].split(path)[1], description: path });
                }
        
                vscode.window.showQuickPick(items).then(selection => {
                    // the user canceled the selection
                    if (!selection) return;
        
                    __this.generateCodeFromRestApi(path + '/' + selection.label);
                });
            } 
        })
    }

    public generateCodeFromRestApi(path: string) {
        let __this = this;
        AzureRest.queryApiDescription(path, function (swagger) {
            if (swagger != null) {

                let swaggerHandler = new Swagger(swagger);

                let items : vscode.QuickPickItem[] = [];

                let operations: string[] = [];
                for (var path in swagger.paths) {
                    for (var method in swagger.paths[path]) {
                        operations.push(swagger.paths[path][method].operationId);
                        items.push({label: swagger.paths[path][method].operationId,
                                    description: method + " " + path});
                    }
                }
                        
                vscode.window.showQuickPick(items).then(selection => {
                    // the user canceled the selection
                    if (!selection) return;

                    let path = selection.description.split(" ")[1];
                    let method = selection.description.split(" ")[0];

                    let playbook = swaggerHandler.generateRestApiTasks(path, method, !pm.doesTaskExistByName('Azure authorization', true));
                    pm.insertTask(playbook);
                });
            } 
        })
    }
}
