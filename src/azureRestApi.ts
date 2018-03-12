'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import { Constants } from './constants';
import { TelemetryClient } from './telemetryClient';
import { SourceTreeHelpers } from './sourceTreeHelpers';
import * as yamljs from 'yamljs';
var fs = require('fs');

var request = require('request');

export class AzureRestApi extends SourceTreeHelpers {
    constructor() {
        super();
    }

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

    public queryApiDescription(path: string, cb): any {
        var http = require('https');
        let __this = this;

        this.queryDirectory(path, true, function(files) {
            if (files != null) {
                __this.getJson(path + '/' + files, cb);
            }
        })
    }
}
