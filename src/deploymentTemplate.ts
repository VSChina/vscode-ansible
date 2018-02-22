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
            
                        
                    });
                });
            });
        
        }

}
