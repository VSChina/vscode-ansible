'use strict';

import * as vscode from 'vscode';
import { Swagger } from './swagger';
import { PlaybookManager } from './playbookManager';
import * as utilities from './utilities';
var path = require("path");
var fs = require('fs');
var clone = require('git-clone');
var pm = new PlaybookManager();

export class RestSamples {
    protected _outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this._outputChannel = outputChannel;
    }

    public async displayMenu() {
        let specLocation = await this.getSpecificationLocation();
        let groups = this.queryDirectory(specLocation + '/specification', false, "");

        if (groups != null) {
            let selection = await vscode.window.showQuickPick(groups);
            if (!selection) return;
            this.selectOperation(specLocation + "/specification/" + selection);
        } 
    }

    public selectOperation(path: string) {
        let operations = this.queryAll(path);
        let items = [];

        if (operations) {
            for (var key in operations) {
                items.push(operations[key]);
            }
        }

        if (items.length == 0) {
            vscode.window.showInformationMessage("No samples available");
            return;
        }

        vscode.window.showQuickPick(items).then(selection => {
            // the user canceled the selection
            if (!selection) return;

            items = [];

            for (var f in selection['files']) {
                let swagger = require(selection['files'][f]);
                if (swagger != null) {
                    let xpath =  selection['files'][f].split('/').slice(0, -1).join('/');
                    let swaggerHandler = new Swagger(swagger);
                    let examples: string[] = swaggerHandler.getExampleNames(selection['path'], selection['method']);
                    let apiVersion = xpath.split('/').slice(-1)[0];

                    examples.forEach(function(s, i, a) {
                        items.push({
                            'label': 'API Version: ' + apiVersion + ' - ' + s.split('/').pop().split('.json')[0],
                            'file': selection['files'][f],
                            'example': require(xpath + '/' + s),
                            'path': selection['path'],
                            'method': selection['method']
                        });
                    })
                }
            }

            vscode.window.showQuickPick(items).then(selection => {
                // the user canceled the selection
                if (!selection) return;

                let swagger = require(selection['file']);
                let swaggerHandler = new Swagger(swagger);
                let playbook = swaggerHandler.generateRestApiTasks(selection['path'], selection['method'],  selection['example']);
                pm.insertTask(playbook);
            });
        });
    }

    public async getSpecificationLocation(): Promise<string> {

        return new Promise<string>((resolve, reject) => {
            let spec = utilities.getCodeConfiguration('ansible', 'azureRestSpec');
            if (spec != "") {
                resolve(spec as string);
            } else {

                this._outputChannel.show();
                const progress = utilities.delayedInterval(() => { this._outputChannel.append('.') }, 500);

                this._outputChannel.append("Getting Azure REST API specifications.");
                //let home: string = path.join(vscode.extensions.getExtension("vscoss.vscode-ansible").extensionPath, 'azure-rest-api-specs');
                let home = path.join(process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'], '.vscode', 'rest');
                clone("https://github.com/Azure/azure-rest-api-specs.git", home, null, (result) => {
                    progress.cancel();
                    if (!result) {
                        utilities.updateCodeConfiguration('ansible', 'azureRestSpec', home, true);
                        this._outputChannel.appendLine("");
                        this._outputChannel.appendLine("REST API feature ready");
                        resolve(home)
                    } else {
                        this._outputChannel.appendLine("Failed to acquire REST API specifications");
                        resolve("");
                    }
                })
            }
        });
    }

    private queryAll(path: string) {
        let operations = {};

        let dirs = this.queryApiGroup(path);

        for (var idx = 0; idx < dirs.length; idx++) {
            let dir = dirs[idx];
            let files = this.queryDirectory(dir, true, ".json");
        
            if (files != null) {
                files.forEach(file => {
                    let swagger = require(dir + '/' + file);
                    for (var path in swagger.paths) {
                        for (var method in swagger.paths[path]) {
                            // add only if there are examples
                            if (swagger.paths[path][method]['x-ms-examples']) {
                                let operationId: string = swagger.paths[path][method].operationId;
                                let description: string = swagger.paths[path][method].description;

                                if (!operations[operationId]) {
                                    operations[operationId] = { 'label': operationId, 'description': description, 'files': [], 'path': path, 'method': method }
                                }

                                operations[operationId]['files'].push(dir + '/' + file);
                            }
                        }
                    }
                });
            };
        }

        return operations;
    }

    private queryApiGroup(path) {
        return this.queryApiGroupInternal([ path ], []);
    }

    private queryApiGroupInternal(dirsToQuery: string[], finalDirs: string[]) {
        // if no more dirs to query, just respond via callback
        if (dirsToQuery.length == 0) {
            return finalDirs;
        }

        // get first dir to query
        let nextDir: string = dirsToQuery.pop();
        let dir = this.queryDirectory(nextDir, false, "");

        if (dir == null) {
            vscode.window.showErrorMessage("Failed to query: " + nextDir);
            return null;
        } else {
            let depth: number = nextDir.split('/specification/')[1].split('/').length;

            if (depth < 4) {
                for (var i = 0; i < dir.length; i++) dirsToQuery.push(nextDir + '/' + dir[i])
            } else {
                for (var i = 0; i < dir.length; i++) finalDirs.push(nextDir + '/' + dir[i])
            }

            return this.queryApiGroupInternal(dirsToQuery, finalDirs);
        } 
    }

    private queryDirectory(path: string, files: boolean, ext: string) {
        // just use filesystem
        try {
            let dirEntries = fs.readdirSync(path);
            let directories = [];

            for (var d in dirEntries) {
                if (ext != null && ext != "" && dirEntries[d].indexOf(ext) != (dirEntries[d].length - ext.length))
                    continue;

                if (!files) {
                    if (fs.lstatSync(path + '/' + dirEntries[d]).isDirectory()) {
                        directories.push(dirEntries[d]);
                    }
                } else {
                    if (!fs.lstatSync(path + '/' + dirEntries[d]).isDirectory()) {
                        directories.push(dirEntries[d]);
                    }
                }
            }
            return directories;
        } catch (e) {
            return [];
        }
    }
}
