'use strict';

import * as vscode from 'vscode';
import { Constants } from './constants';
import * as utilities from './utilities';

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

        //url: https://login.windows.net/{{ lookup('env','AZURE_TENANT') }}/oauth2/token
        //method: POST
        //body: resource=https%3A%2F%2Fmanagement.core.windows.net%2F&client_id={{ lookup('env','AZURE_CLIENT_ID') }}&grant_type=client_credentials&client_secret={{ lookup('env','AZURE_SECRET') }}
        //return_content: yes
        //headers:
        //  Content-Type: application/x-www-form-urlencoded        
        var https = require('https');
        let __this = this;

        let postData: string =  "resource=https%3A%2F%2Fmanagement.core.windows.net%2F&client_id=" + azure_client_id + "&grant_type=client_credentials&client_secret=" + azure_secret;

        let request = https.request({
            host: 'login.windows.net',
            path: '/' + azure_tenant + '/oauth2/token',
            port: 443,
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
        }, function(response) {
            if (response.statusMessage == "OK") {
                var body = '';
                response.on('data', function(d) {
                    body += d;
                });
                response.on('end', function() {
                    var parsed = JSON.parse(body);
                    __this.token = parsed.access_token;
                    cb(true);
                });
            } else {
                vscode.window.showErrorMessage("Failed to get token: " + response.statusCode + " " + response.statusMessage);
                cb(false);
            }
        })
        
        request.write(postData);
        request.end();
        request.on('error', function(e) {
            vscode.window.showErrorMessage("Failed to get token: " + e);
            cb(false);
        });

    }

    public queryResourceGroups(cb) {
        var http = require('https');
        let __this = this;

        this.obtainAuthorizationToken(function(result) {


            if (result) {
                //uri:
                //  url: https://management.azure.com/subscriptions/{{ lookup('env','AZURE_SUBSCRIPTION_ID') }}/resourcegroups/{{ resource_group }}?api-version=2017-05-10
                //  headers:
                //    Authorization: "Bearer {{ authresp.json.access_token }}"

                http.get({
                    host: "management.azure.com",
                    path: '/subscriptions/' + __this.credentials['AZURE_SUBSCRIPTION_ID'] + '/resourcegroups?api-version=2017-05-10',
                    headers: { 'Authorization': 'Bearer ' + __this.token }
                }, function(response) {
                    if (response.statusMessage == "OK") {
                        var body = '';
                        response.on('data', function(d) {
                            body += d;
                        });
                        response.on('end', function() {
                            let parsed = JSON.parse(body);
                            let resourceGroups: string[] = []; 
                            for (var i in parsed['value']) {
                                resourceGroups.push(parsed['value'][i]['name']);
                            }
                            cb(resourceGroups);
                        });
                    } else {
                        vscode.window.showErrorMessage("Failed to fetch list of templates: " + response.statusCode + " " + response.statusMessage);
                    }

                }).on('error', function(e) {
                    vscode.window.showErrorMessage("Failed to fetch list of templates: " + e);
                    cb(null);
                });
            } else {
                cb(null);
            }
        })

    }

    public getArmTemplateFromResourceGroup(resourceGroup: string): any {
        return null;
    }
}
