'use strict';

import * as vscode from 'vscode';
var request = require('request');


export class DeploymentTemplate {
    constructor() {}

    public displayDeploymentTemplateMenu() {

        let items: vscode.QuickPickItem[] = [];

        items.push({ 
            label: "Use Azure Quickstart Template", 
            description: "Select template from Azure Quickstart Templates gallery"});
        
        items.push({ 
            label: "Use custom template (URL)", 
            description: "Select template using custom URL"});

        items.push({ 
            label: "Use custom template (local)", 
            description: "Using template from current editor"});

        vscode.window.showQuickPick(items).then(selection => {
            // the user canceled the selection
            if (!selection) {
              return;
            }

            if (selection == items[0]) {
                this.selectQuickstartTemplate();
            } else if (selection == items[1]) {
                // XXX - to be implemented
            } else if (selection == items[2]) {
                // XXX - to be implemented
            }
            
        });
    }

    public selectQuickstartTemplate() {

        // get list of directories from here:
        // https://api.github.com/repos/Azure/azure-quickstart-templates/contents/

        var http = require('https');
        let __this = this;

            http.get({
                host: 'api.github.com',
                path: '/repos/Azure/azure-quickstart-templates/contents/',
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
                        if (parsed[i].type == "dir") {
                            items.push({ 
                                label: parsed[i].name, 
                                description: parsed[i].name });
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

            http.get({
                host: 'raw.githubusercontent.com',
                path: '/Azure/azure-quickstart-templates/master/' + templateName + '/azuredeploy.json',
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

                    // XXX - get parameters
                    // XXX - create url

                    // XXX - create playbook
                    __this.createPlaybookFromTemplate("https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/" + templateName + '/azuredeploy.json',
                                                      parsed);
                });
            });
    }

    public createPlaybookFromTemplate(location: string, template: object) {

        var playbook: string = "- hosts: localhost\r" +
                               "  tasks:\r" +
                               "    - name: Try to create ACI\r" +
                               "      azure_rm_deployment:\r" +
                               "        resource_group_name: myresourcegroup\r" +
                               "        state: present\r" +
                               "        parameters:\r";
        for (var p in template['parameters']) {
            playbook +=        "          #" + p + ":\r";
            playbook +=        "          #  value: " + template['parameters'][p]['defaultValue'] + "\r"; 
        }

        playbook +=            "        template: \"{{ lookup('url', '" + location + "', split_lines=False) }}\"";

        vscode.workspace.openTextDocument({language: "yaml", content: playbook} ).then((a: vscode.TextDocument) => {
            vscode.window.showTextDocument(a, 1, false);//.then(e => {
             // e.edit(edit => {
             //   edit.insert(new vscode.Position(0, 0), "Your advertisement here");    }
        });
    }
}
