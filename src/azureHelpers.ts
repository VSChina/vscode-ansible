'use strict';

import * as vscode from 'vscode';
import { Constants } from './constants';
import * as utilities from './utilities';
var https = require('https');

export class AzureHelpers {
    constructor() {
    }

    private credentials = utilities.parseCredentialsFile(null);
    private token: string = null;

    public obtainAuthorizationToken(cb): void {

        let azure_tenant = this.credentials['AZURE_TENANT'];
        let azure_client_id = this.credentials['AZURE_CLIENT_ID'];
        let azure_secret = this.credentials['AZURE_SECRET'];

        if (this.token != null) {
            cb(true);
            return;
        }

        // XXX - check if credentials are valid
        let __this = this;

        let postData: string = "resource=https%3A%2F%2Fmanagement.core.windows.net%2F&client_id=" + azure_client_id + "&grant_type=client_credentials&client_secret=" + azure_secret;

        let request = https.request({
            host: 'login.windows.net',
            path: '/' + azure_tenant + '/oauth2/token',
            port: 443,
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
        }, function (response) {
            if (response.statusMessage == "OK") {
                var body = '';
                response.on('data', function (d) {
                    body += d;
                });
                response.on('end', function () {
                    var parsed = JSON.parse(body);
                    __this.token = parsed.access_token;
                    cb(true);
                });
            } else {
                vscode.window.showErrorMessage("Failed to get token: " + response.statusCode + " " + response.statusMessage);
                cb(false);
            }
        })

        request.end(postData);
        request.on('error', function (e) {
            vscode.window.showErrorMessage("Failed to get token: " + e);
            cb(false);
        });
    }

    public queryResourceGroups(cb) {
        var http = require('https');
        let __this = this;

        this.obtainAuthorizationToken(function (result) {


            if (result) {
                //uri:
                //  url: https://management.azure.com/subscriptions/{{ lookup('env','AZURE_SUBSCRIPTION_ID') }}/resourcegroups/{{ resource_group }}?api-version=2017-05-10
                //  headers:
                //    Authorization: "Bearer {{ authresp.json.access_token }}"

                http.get({
                    host: "management.azure.com",
                    path: '/subscriptions/' + __this.credentials['AZURE_SUBSCRIPTION_ID'] + '/resourcegroups?api-version=2017-05-10',
                    headers: { 'Authorization': 'Bearer ' + __this.token }
                }, function (response) {
                    if (response.statusMessage == "OK") {
                        var body = '';
                        response.on('data', function (d) {
                            body += d;
                        });
                        response.on('end', function () {
                            let parsed = JSON.parse(body);
                            let resourceGroups: string[] = [];
                            for (var i in parsed['value']) {
                                resourceGroups.push(parsed['value'][i]['name']);
                            }
                            cb(resourceGroups);
                        });
                    } else {
                        vscode.window.showErrorMessage("Failed to fetch available resource groups: " + response.statusCode + " " + response.statusMessage);
                    }

                }).on('error', function (e) {
                    vscode.window.showErrorMessage("Failed to fetch list of templates: " + e);
                    cb(null);
                });
            } else {
                cb(null);
            }
        })
    }

    public getArmTemplateFromResourceGroup(resourceGroup: string, cb): any {
        var http = require('https');
        let __this = this;

        this.obtainAuthorizationToken(function (result) {

            if (result) {
                // POST https://management.azure.com/subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/exportTemplate?api-version=2017-05-10

                let postData: string = JSON.stringify({ resources: ["*"] });
                let path = '/subscriptions/' + __this.credentials['AZURE_SUBSCRIPTION_ID'] + '/resourcegroups/' + resourceGroup + '/exportTemplate?api-version=2017-05-10';

                let request = http.request({
                    host: "management.azure.com",
                    path: path,
                    //host: "zims.requestcatcher.com",
                    //path: "/test",
                    headers: {
                        'Authorization': 'Bearer ' + __this.token,
                        'Content-Type': 'application/json',
                        "Accept": "*/*",
                        "User-Agent": "VSCode Ansible Extension"
                    },
                    method: 'POST'

                }, function (response) {
                    response.on('data', function (d) {
                        body += d;
                    });
                    if (response.statusMessage == "OK") {
                        var body = '';
                        response.on('end', function () {
                            let parsed = JSON.parse(body);
                            cb(parsed);
                        });
                    } else {
                        vscode.window.showErrorMessage("Failed to fetch list of templates: " + response.statusCode + " " + response.statusMessage);
                        cb(null);
                    }

                })

                //request.write(postData);
                request.end(postData);
                request.on('error', function (e) {
                    vscode.window.showErrorMessage("Failed to get token: " + e);
                    cb(null);
                });
            } else {
                cb(null);
            }
        })
    }
}
