'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import { Constants } from './constants';
import { TelemetryClient } from './telemetryClient';
import * as yamljs from 'yamljs';
var fs = require('fs');

var request = require('request');

export class AzureRestApi {
    constructor() {}

    public queryApiGroups(specLocation: string, cb) {
        this.queryDirectory(specLocation + '/specification', false, cb);
    }

    public queryApiGroup(path, cb) {
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

        this.queryDirectory(nextDir, false, function(dir) {
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

    public queryApiType(specLocation: string, group: string, cb) {
        this.queryDirectory(specLocation + '/specification/' + group, false, cb);
    }

    public queryApiObject(specLocation: string, group: string, type: string, cb) {
        this.queryDirectory(specLocation + '/specification/' + group + '/' + type, false, cb);
    }

    public queryApiVersion(specLocation: string, group: string, type: string, object: string, stable_preview: string, cb) {
        this.queryDirectory(specLocation + '/specification/' + group + '/' + type + '/' + object + '/' + stable_preview, false, cb);
    }

    public queryDirectory(path: string, files: boolean,  cb) {
        if (path.startsWith('https://api.github.com/')) {
            // get list of directories from here:
            // https://api.github.com/Azure/azure-rest-api-specs/contents/
            // we will use fixed repo in our first release
            let repo: string = "Azure/azure-rest-api-specs";

            var http = require('https');
            let __this = this;

                http.get({
                    host: "api.github.com",
                    path: path.substr('https://api.github.com'.length),
                    headers: { 'User-Agent': 'VSC Ansible Extension'}
                }, function(response) {
                    // Continuously update stream with data
                    var body = '';
                    response.on('data', function(d) {
                        body += d;
                    });
                    if (response.statusMessage == "OK") {
                        response.on('end', function() {
                            var parsed = JSON.parse(body);
                            let items: vscode.QuickPickItem[] = [];
                    
                            let groups: string[] = [];

                            for (var i in parsed)
                            {
                                // list only directories and skip known directories that don't contain templates
                                if (parsed[i].type == "dir" && !parsed[i].name.startsWith('.')) {
                                    groups.push(parsed[i].name);
                                }
                            }
                            cb(groups);
                        });
                    } else {
                        vscode.window.showErrorMessage("Failed to fetch Azure REST API groups: " + response.statusCode + " " + response.statusMessage);
                        cb(null);
                    }

                }).on('error', function(e) {
                    vscode.window.showErrorMessage("Failed to fetch Azure REST API groups: " + e);
                    cb(null);
                });
        } else {
            // just use filesystem
            try {
                let dirEntries = fs.readdirSync(path);
                let directories = [];

                for (var d in dirEntries) {
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

    public queryApiDescription(path: string, cb): any {
        var http = require('https');
        let __this = this;

        this.queryDirectory(path, true, function(files) {
            if (path.startsWith('https://raw.githubusercontent.com')) {
            
                let repo: string = "Azure/azure-rest-api-specs";
    
                    http.get({
                        // XXX fix it for github
                        host: Constants.GitHubRawContentHost,
                        path: 'xxx',//'/' + repo + '/master/specification/' + group + '/' + type + '/' + object + '/' + version + '/' + object.split('.').slice(-1)[0].toLowerCase() + '.json',
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
                                        cb(parsed);
                                    } catch (e) {
                                        vscode.window.showErrorMessage("Failed to parse 'azuredeploy.json'");
                                        cb(null);
                                    }
                                });
                            } else if (response.statusCode == 404) {
                                vscode.window.showErrorMessage("Template file 'azuredeploy.json' not found.");
                                cb(null);
                            } else {
                                vscode.window.showErrorMessage("Failed to fetch 'azuredeploy.json': " + response.statusCode + " " + response.statusMessage);
                                cb(null);
                            }
                        }).on('error', function(e) {
                            vscode.window.showErrorMessage("Failed to fetch 'azuredeploy.json': " + e);
                            cb(null);
                        });
            } else {
                try {
                    let content = require(path + '/' + files[0]);
                    cb(content);
                } catch (e) {
                    cb(null);
                }
            }
        })
    }
}
