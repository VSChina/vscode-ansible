'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import { Constants } from './constants';
import { TelemetryClient } from './telemetryClient';
import { AzureHelpers } from './azureHelpers';
import { AzureRestApi } from './azureRestApi';
import * as yamljs from 'yamljs';
import { SourceTreeHelpers } from './sourceTreeHelpers';

var Azure = new AzureHelpers();
var AzureRest = new AzureRestApi();

export class Swagger {
    constructor(definition: any) {
        this.swagger = definition;
    }

    private swagger: any = null;

    public generateRestApiTasks(path: string, method: string, addAuthorisation: boolean): string {
                        
        let playbook: string = ""

        if (addAuthorisation) {
            //playbook += "- name: Azure authorization\r" +
            //            "\turi:\r" +
            //            "\t\turl: https://login.windows.net/{{ lookup('env','AZURE_TENANT') }}/oauth2/token\r" +
            //            "\t\tmethod: POST\r" +
            //            "\t\tbody: resource=https%3A%2F%2Fmanagement.core.windows.net%2F&client_id={{ lookup('env','AZURE_CLIENT_ID') }}&grant_type=client_credentials&client_secret={{ lookup('env','AZURE_SECRET') }}\r" +
            //            "\t\treturn_content: yes\r" +
            //            "\t\theaders:\r" +
            //            "\t\t\tContent-Type: application/x-www-form-urlencoded\r" +
            //            "\tregister: authresp\r" +
            //            "\r";
        }

        let url: string = /*this.swagger['schemes'][0] + '://' + this.swagger['host'] + '/' +*/ path;
        url = url.replace("{subscriptionId}", "{{ lookup('env','AZURE_SUBSCRIPTION_ID') }}");

        //let responses = "";
        //for (var code in this.swagger.paths[path][method]['responses']) {
        //    responses += ((responses != "") ? "," : "") + code;
        //}

        playbook += "# " + url + "\r";
        playbook += "- name: Call REST API - " + this.swagger.paths[path][method]['operationId'] + "\r" +
                    "\tazure_rm_rest:\r" +
                    //"\t\turl: " + url + "\r" +
                    "\t\tapi_version: '" + this.swagger['info']['version'] + "'\r";
                    //"\t\theaders:\r" +
                    //"\t\t\tAuthorization: Bearer {{ authresp.json.access_token }}\r" +
                    //"\t\tstatus_code: " + responses + "\r";

        let splittedPath: string[] = url.split('/');
        let pathIdx = 1; // 1 as url starts with /
        let resourcePrefix: string = '';

        while (pathIdx < splittedPath.length) {
            switch (splittedPath[pathIdx].toLowerCase()) {
                case 'subscriptions':
                    pathIdx += 2;
                    break;
                case 'resourcegroups':
                    playbook += "\t\tresource_group: \r";
                    pathIdx += 2;
                    break;
                case 'providers':
                    playbook += "\t\tprovider: " + splittedPath[pathIdx + 1].split('.')[1].toLowerCase() + "\r";
                    pathIdx += 2;
                    break;
                default:
                    playbook += "\t\t" + resourcePrefix + "resource_type: " + splittedPath[pathIdx++].toLowerCase() + "\r";

                    if (pathIdx < splittedPath.length) {
                        playbook += "\t\t" + resourcePrefix + "resource_name: " + splittedPath[pathIdx++].toLowerCase() + "\r";
                    }

                    resourcePrefix = "sub";                
            }
        }

        // get method is default so don't add it
        if (method.toUpperCase() != 'GET') {
            "\t\tmethod: " + method.toUpperCase() + "\r";
        }

        let parameters = this.swagger.paths[path][method]['parameters'];
        if (this.swagger.paths[path][method]['parameters'] != undefined) {

            let body: string = "";
            for (var i in parameters) {
                let p = parameters[i];
                if (p['$ref'] != undefined) {
                    p = this.swagger.parameters[p['$ref'].split('#/parameters/')[1]];
                }
                if (p['in'] == "body") {

                    let schema = p['schema'];
                    if (p['schema'] != undefined) {
                        body += this.playbookFromSwaggerSchema(schema, "\t\t\t");
                    } else {
                        // does this ever happen?
                        body += "\t\t\t" + p['name'] + ":\r";
                    }
                }
            }

            if (body != "") {
                playbook += //"\t\tbody_format: json\r" +
                            "\t\tbody:\r" + 
                            body;
            }
        }

        return playbook;
    }

    private playbookFromSwaggerSchema(schema: any, prefix: string) {
        let playbook = "";
        if (schema['$ref'] != undefined) {
            schema = this.swagger.definitions[schema['$ref'].split('#/definitions/')[1]];
        }

        if (schema['allOf'] != undefined) {
            for (var i in schema['allOf']) {
                playbook += this.playbookFromSwaggerSchema(schema['allOf'][i], prefix);
            }
        } else {
            for (var propName in schema['properties']) {
                let property = schema['properties'][propName];

                if (!property['readOnly']) {
                    playbook += prefix + propName + ":\r";

                    if (property['$ref'] != undefined) {
                        playbook += this.playbookFromSwaggerSchema(this.swagger.definitions[property['$ref'].split('#/definitions/')[1]], prefix + '  ' );
                    }
                }
            }
        }

        return playbook;
    } 
}
