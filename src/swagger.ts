'use strict';

import * as vscode from 'vscode';

export class Swagger {
    constructor(definition: any, location: string) {
        this.swagger = definition;
        this.location = location;
    }

    private swagger: any = null;
    private location: string = "";

    public getExampleNames(path: string, method: string): string[] {
        let examples: string[] = [];

        try {
            for (var name in this.swagger.paths[path][method]['x-ms-examples']) {
                examples.push(this.swagger.paths[path][method]['x-ms-examples'][name]['$ref']);
            }
        } catch (e) {}

        return examples;
    }

    public generateRestApiTasks(path: string, method: string, example: any): string {
                        
        let playbook: string = ""

        let url: string = /*this.swagger['schemes'][0] + '://' + this.swagger['host'] + '/' +*/ path;
        url = url.replace("{subscriptionId}", "{{ lookup('env','AZURE_SUBSCRIPTION_ID') }}");

        method = method.toLowerCase();
        playbook += //"# https://docs.microsoft.com/en-us/rest/api/" + area + "/" + resource + "/" + internalMethod + '\r';
                    "- name: Call REST API - " + this.swagger.paths[path][method]['operationId'] + "\r" +
                    "\t" + ((method == 'get') ? "azure_rm_resource_facts" : "azure_rm_resource") + ":\r" +
                    "\t\t# url: " + url + "\r" + 
                    "\t\tapi_version: '" + this.swagger['info']['version'] + "'\r";

        if (method != 'get' && method != 'put' && method != 'delete') {
            playbook += "\t\tmethod: " + method.toUpperCase() + "\r";
        }

        let splittedPath: string[] = url.split('/');
        let pathIdx = 1; // 1 as url starts with /
        let subresourceCount: number = 0;

        while (pathIdx < splittedPath.length) {
            switch (splittedPath[pathIdx].toLowerCase()) {
                case 'subscriptions':
                    pathIdx += 2;
                    break;
                case 'resourcegroups':
                    playbook += "\t\tresource_group: \"{{ resource_group }}\"\r";
                    pathIdx += 2;
                    break;
                case 'providers':
                    playbook += "\t\tprovider: " + splittedPath[pathIdx + 1].split('.')[1].toLowerCase() + "\r";
                    pathIdx += 2;
                    break;
                default:
                    if (pathIdx < splittedPath.length) {
                        let resourceType = splittedPath[pathIdx++].toLowerCase();
                        let resourceName = null;
                        if (pathIdx < splittedPath.length) {
                            resourceName =  splittedPath[pathIdx++].toLowerCase();                            
                            if (resourceName.startsWith('{')) resourceName = resourceName.substr(1);
                            if (resourceName.endsWith('}')) resourceName = resourceName.substr(0, resourceName.length - 1);
                        }

                        if (subresourceCount == 0) {
                            playbook += "\t\tresource_type: " + resourceType + "\r";
                            if (resourceName != null) {
                                playbook += "\t\tresource_name: \"{{ " + resourceName  + " }}\"\r";
                            }
                        } else {
                            if (subresourceCount == 1) {
                                playbook += "\t\tsubresource:\r";
                            }
                            playbook += "\t\t\t- type: " + resourceType + "\r";
                            if (resourceName != null) {
                                playbook += "\t\t\t  name: \"{{ " + resourceName  + " }}\"\r";
                            }
                        }
                        subresourceCount++;                
                    }
            }
        }

        // load sample
        let body: string = "";

        // if example requested, just use example body, otherwise use swagger definition to create template
        if (example != null) {
            for (var name in example['parameters']) {
                // just find dictionary, as it's going to be our body
                let p = example['parameters'][name];
                if (typeof p === 'object') {
                    this.playbookFromExample(p, 0).forEach(element => {
                        body += ("\t\t\t" + element + '\r');
                    });

                }
            }
        }

        if (body != "") {
            playbook += "\t\tbody:\r" + 
                        body;
        }

        // in case of DELETE method we will use 'absent' state to indicate this
        if (method == 'delete') {
            playbook += "\t\tstate: absent\r";
        }

        return playbook;
    }

    private playbookFromExample(example: any, level: number): string[] {
        let playbook = [];

        for (var name in example) {
            let p = example[name];

            if (typeof p === 'object') {
                playbook.push(name + ": ");
                if (require('util').isArray(p)) {
                    for (var idx in p) {
                        let e = p[idx];
                        if (typeof e === 'object') {
                            let sub = this.playbookFromExample(e, level + 1);
                            let first = true;
                            sub.forEach(element => {
                                if (first) {
                                    first = false;
                                    playbook.push("  - " + element);
                                    
                                } else {
                                    playbook.push("    " + element);
                                }
                            })
                        } else {
                            playbook.push("  - " + e);
                        }

                    }
                } else {
                    let sub: string[] = this.playbookFromExample(p, level + 1);
                    sub.forEach(element => {
                        playbook.push("\t" + element);
                    })
                }
            } else {
                playbook.push(name + ": " + p);
            }            
        }
        return playbook;
    }
}
