'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import { Constants } from './constants';
import { TelemetryClient } from './telemetryClient';
import { AzureHelpers } from './azureHelpers';
import * as yamljs from 'yamljs';
import { SourceTreeHelpers } from './sourceTreeHelpers';
import { PlaybookManager } from './playbookManager';

var Azure = new AzureHelpers();
var pm = new PlaybookManager();

const indent2space: string = "  ";

export class DeploymentTemplate extends SourceTreeHelpers {
    constructor() {
        super();
    }

    public displayDeploymentTemplateMenu() {

        TelemetryClient.sendEvent('deploymenttemplate', { 'action': 'menu' });
        // currently only one option is available, so first menu won't be displayed yet


        let items: vscode.QuickPickItem[] = [];

        items.push({ label: "Quickstart Template", description: "Select Azure quickstart template" });
        items.push({ label: "Resource Group", description: "Create template from existing resource group" });

        vscode.window.showQuickPick(items).then(selection => {
            // the user canceled the selection
            if (!selection) return;

            if (selection.label == "Quickstart Template") {
                this.selectQuickstartTemplate();
            } else if (selection.label == "Resource Group") {
                this.createFromResourceGroup();
            }
        });
    }

    public selectQuickstartTemplate() {
        let __this = this;
        let repo: string = Constants.AzureQuickStartTemplates;
        this.queryDirectory('https://' + Constants.GitHubApiHost + '/repos/' + repo + '/contents/', false, function (dirs) {
            let items: vscode.QuickPickItem[] = [];

            for (var i in dirs) {
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

        Azure.queryResourceGroups(function (groups) {
            if (groups != null) {
                vscode.window.showQuickPick(groups).then(selection => {
                    // the user canceled the selection
                    if (!selection) return;

                    Azure.getArmTemplateFromResourceGroup(selection, function (template) {
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

        this.getJson('https://' + Constants.GitHubRawContentHost + '/' + repo + '/master/' + templateName + '/azuredeploy.json', function (template) {

            if (template != null) {
                let items: vscode.QuickPickItem[] = [];

                items.push({ label: "Link", description: "Create link to template using lookup" });
                items.push({ label: "Expand", description: "Expand template inline" });

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

        TelemetryClient.sendEvent('deploymenttemplate', { 'action': 'inserted', 'template': location });

        let playbook = "";

        if (prefixPlaybook != null) {
            for (var l in prefixPlaybook) playbook += prefixPlaybook[l] + "\r";
        }

        const indent4space = indent2space.repeat(2);
        const indent6space = indent2space.repeat(3);
        playbook +=
            "- name: Create resource using Azure deployment template\r" +
            indent2space + "azure_rm_deployment:\r" +
            indent4space + "resource_group_name: ${1:your-resource-group}\r" +
            indent4space + "location: ${2:eastus}\r" +
            indent4space + "state: present\r" +
            indent4space + "parameters:\r";

        let tabstop: number = 3;
        for (var p in template['parameters']) {
            if (template['parameters'][p]['defaultValue']) {
                playbook += indent6space + "#" + p + ":\r";
                playbook += indent6space + "#  value: " + template['parameters'][p]['defaultValue'] + "\r";
            } else {
                playbook += indent6space + p + ":\r";
                playbook += indent6space + "value: ${" + tabstop++ + "}\r";
            }
        }

        playbook += indent4space + "template:\r"

        if (expand) {
            let templateYaml: string[] = yamljs.stringify(template, 10, 2).replace(/[$]/g, "\\$").split(/\r?\n/);

            for (var i = 0; i < templateYaml.length; i++) {
                playbook += indent6space + templateYaml[i] + "\r";
            }
        } else {
            playbook += indent4space + "template: \"{{ lookup('url', '" + location + "', split_lines=False) }}\"\r";
        }


        playbook += "$end";
        pm.insertTask(playbook);
    }
}
