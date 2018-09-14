'use strict';

import * as vscode from 'vscode';
import { Swagger } from './swagger';
import { PlaybookManager } from './playbookManager';
var fs = require('fs');

var pm = new PlaybookManager();

export class RestSamples {
    constructor() {
    }

    public displayMenu() {

        this.createRestApiCall();
    }

    // - query list of api groups (compute, etc...)
    // - user selects api group
    public createRestApiCall() {
        let __this = this;

        this.getSpecificationLocation(function(specLocation) {
            __this.queryApiGroups(specLocation, function (groups) {
                if (groups != null) {

                    // this call will dump all possible outputs, comment it out to do it
                    // it's just for testing purposes here
                    //__this.generateAll(specLocation, groups);

                    vscode.window.showQuickPick(groups).then(selection => {
                        __this.selectOperation(specLocation + "/specification/" + selection);
                    });
                } 
            })
        })
    }

    public selectOperation(path: string) {

        let operations = this.queryAll(path);
        let __this = this;


        let items = [];

        for (var key in operations) {
            items.push(operations[key]);
        }

        vscode.window.showQuickPick(items).then(selection => {
            // the user canceled the selection
            if (!selection) return;

            items = [];

            for (var f in selection['files']) {
                let swagger = require(selection['files'][f]);
                if (swagger != null) {
                    let xpath =  selection['files'][f].split('/').slice(0, -1).join('/');
                    let swaggerHandler = new Swagger(swagger, selection['files'][f].split('/').slice(0, -1).join('/'));
                    let examples: string[] = swaggerHandler.getExampleNames(selection['path'], selection['method']);
                    let apiVersion = xpath.split('/').slice(-1)[0];

                    examples.forEach(function(s, i, a) {
                        items.push({
                            'label': apiVersion + ' - Sample: ' + s.split('/').pop(),
                            'file': selection['files'][f],
                            'example': require(xpath + '/' + s),
                            'path': selection['path'],
                            'method': selection['method']
                        });
                    })
                }
            }

            // subfolder
            vscode.window.showQuickPick(items).then(selection => {
                // the user canceled the selection
                if (!selection) return;

                let swagger = require(selection['file']);
                let swaggerHandler = new Swagger(swagger, selection['file'].split('/').slice(0, -1).join('/'));
                if (selection['example'] == "From Definition") {
                    let playbook = swaggerHandler.generateRestApiTasks(selection['path'], selection['method'], null);
                    pm.insertTask(playbook);
                } else {
                    let playbook = swaggerHandler.generateRestApiTasks(selection['path'], selection['method'],  selection['example']);
                    pm.insertTask(playbook);
                }
            });
        });
    }

    public getSpecificationLocation(cb) {
        let config = vscode.workspace.getConfiguration('ansible');

        if (config.has('AzureRestAPISpecificationPath') && config.get('AzureRestAPISpecificationPath') != "") {
            cb(config.get('AzureRestAPISpecificationPath'));
        } else {
            const options: vscode.OpenDialogOptions = {
                canSelectMany: false,
                canSelectFiles: false,
                canSelectFolders: true,
                openLabel: 'Set Azure REST API spec location'
           };
       
            vscode.window.showOpenDialog(options).then(selection => {
                config.update('AzureRestAPISpecificationPath', selection[0].fsPath, vscode.ConfigurationTarget.Global);
                cb(selection[0].fsPath);
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
    
                                        if (description == undefined || description == '') description = "Description not available";

                                        if (operations[operationId] == undefined) {
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

    private queryApiGroups(specLocation: string, cb) {
        this.queryDirectory(specLocation + '/specification', false, "", cb);
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

    // this is just internal function that can dump all the possible 
    private generateAll(specLocation: string, groups: string[]) {
        let __this = this;
        for (var idx = 0; idx < groups.length; idx ++ ) {
            let element = groups[idx];
            let operations = __this.queryAll(specLocation + "/specification/" + element);

            if (element == 'apimanagement')
                continue;

            console.log("GENERATING: " + element);
            for (var key in operations) {
                let operation = operations[key];

                for (var f in operation['files']) {
                    let swagger = require(operation['files'][f]);
                    if (swagger != null) {
                        let xpath =  operation['files'][f].split('/').slice(0, -1).join('/');
                        let swaggerHandler = new Swagger(swagger, operation['files'][f].split('/').slice(0, -1).join('/'));
                        let examples: string[] = swaggerHandler.getExampleNames(operation['path'], operation['method']);
                        let apiVersion = xpath.split('/').slice(-1)[0];

                        var p = "c:/dev/tmp/" + xpath.split('resource-manager/')[1].split('/').join('_') + '_' + operation['label'];

                        var fs = require('fs');
    
                        examples.forEach(function(s, i, a) {
                            let playbook = swaggerHandler.generateRestApiTasks(operation['path'], operation['method'],  require(xpath + '/' + s));

                            let name = p + '_' + s.split('.json')[0].split('/').pop() + '.yml';
                            fs.writeFile(name, playbook, function (result) {});

                        })
                        let playbook = swaggerHandler.generateRestApiTasks(operation['path'], operation['method'], null);
                        fs.writeFile(p + '_full.yml' , playbook, function (result) {});
                    } else {
                        // XXX - generate stub?
                    }
                }
            }    
            console.log("DONE: " + element);
        }
    }
}
