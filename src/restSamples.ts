'use strict';

import * as vscode from 'vscode';
import { Swagger } from './swagger';
import { PlaybookManager } from './playbookManager';
import * as utilities from './utilities';
var path = require("path");
var fs = require('fs');
var pm = new PlaybookManager();

export class RestSamples {
    protected _outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this._outputChannel = outputChannel;
    }

    public displayMenu() {
        let __this = this;

        this.getSpecificationLocation(function(specLocation) {
            __this.queryDirectory(specLocation + '/specification', false, "", function (groups) {
                if (groups != null) {
                    vscode.window.showQuickPick(groups).then(selection => {
                        if (!selection) return;
                        __this.selectOperation(specLocation + "/specification/" + selection);
                    });
                } 
            })
        })
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

    public getSpecificationLocation(cb) {
        let spec = utilities.getCodeConfiguration('ansible', 'azureRestSpec');
        if (spec != "") {
            cb(spec);
        } else {

            this._outputChannel.show();
            const progress = utilities.delayedInterval(() => { this._outputChannel.append('.') }, 500);

            this._outputChannel.append("Getting Azure REST API specifications.");
            let clone = require('git-clone');
            let home: string = path.join(process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'], 'azure-rest-api-specs');
            clone("https://github.com/Azure/azure-rest-api-specs.git", home, null, (result) => {
                progress.cancel();
                if (!result) {
                    utilities.updateCodeConfiguration('ansible', 'azureRestSpec', home, true);
                    this._outputChannel.appendLine("");
                    this._outputChannel.appendLine("REST API feature ready");
                } else {
                    this._outputChannel.appendLine("Failed to acquire REST API specifications");
                }
                cb(home)
            })
        }            
    }

    private queryAll(path: string) {
        let operations = {};
        let __this = this;

        __this.queryApiGroup(path, function (dirs: string[]) {
            dirs.forEach(dir => {
                __this.queryDirectory(dir, true, ".json", function(files) {
                    if (files != null) {
                        files.forEach(file => {
                            let swagger = require(dir + '/' + file);
                            for (var path in swagger.paths) {
                                for (var method in swagger.paths[path]) {
                                    // add only if there are examples
                                    if (swagger.paths[path][method]['x-ms-examples'] != undefined) {
                                        let operationId: string = swagger.paths[path][method].operationId;
                                        let description: string = swagger.paths[path][method].description;
    
                                        if (!description || description == '') description = "Description not available";

                                        if (!operations[operationId]) {
                                            operations[operationId] = { 'label': operationId, 'description': description, 'files': [], 'path': path, 'method': method }
                                        }

                                        operations[operationId]['files'].push(dir + '/' + file);
                                    }
                                }
                            }
                        });
                    };
                });
            });
        });

        return operations;
    }

    private queryApiGroup(path, cb) {
        this.queryApiGroupInternal([ path ], [], cb);
    }

    private queryApiGroupInternal(dirsToQuery: string[], finalDirs: string[], cb) {

        let __this = this;
        // if no more dirs to query, just respond via callback
        if (dirsToQuery.length == 0) {
            cb(finalDirs);
            return;
        }

        // get first dir to query
        let nextDir: string = dirsToQuery.pop();

        this.queryDirectory(nextDir, false, "", function(dir) {
            if (dir == null) {
                cb(null);
                vscode.window.showErrorMessage("Failed to query: " + nextDir);
                return;
            } else {
                let depth: number = nextDir.split('/specification/')[1].split('/').length;

                if (depth < 4) {
                    for (var i = 0; i < dir.length; i++) dirsToQuery.push(nextDir + '/' + dir[i])
                } else {
                    for (var i = 0; i < dir.length; i++) finalDirs.push(nextDir + '/' + dir[i])
                }

                __this.queryApiGroupInternal(dirsToQuery, finalDirs, cb);
            }
        })
    }

    private queryDirectory(path: string, files: boolean, ext: string,  cb) {
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
            cb(directories);
        } catch (e) {
            cb(null);
        }
    }
}
