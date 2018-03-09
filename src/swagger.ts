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
        let prefix = "\t\t";

        if (addAuthorisation) {
            playbook += prefix + "- name: Authorization\r" +
                        prefix + "\turi:\r" +
                        prefix + "\t\turl: https://login.windows.net/{{ lookup('env','AZURE_TENANT') }}/oauth2/token\r" +
                        prefix + "\t\tmethod: POST\r" +
                        prefix + "\t\tbody: resource=https%3A%2F%2Fmanagement.core.windows.net%2F&client_id={{ lookup('env','AZURE_CLIENT_ID') }}&grant_type=client_credentials&client_secret={{ lookup('env','AZURE_SECRET') }}\r" +
                        prefix + "\t\treturn_content: yes\r" +
                        prefix + "\t\theaders:\r" +
                        prefix + "\t\t\tContent-Type: application/x-www-form-urlencoded\r" +
                        prefix + "\tregister: authresp\r" +
                        prefix + "\r";
        }

        playbook += prefix + "- name: Call REST API\r" +
                    prefix + "\turi:\r" +
                    prefix + "\t\turl: " + this.swagger['schemes'][0] + '://' + this.swagger['host'] + '/' + path + "\r" +
                    prefix + "\t\tmethod: " + method + "\r" +
                    prefix + "\t\theaders:\r" +
                    prefix + "\t\t\tAuthorization: Bearer {{ authresp.json.access_token }}\r";
        let parameters = this.swagger.paths[path][method]['parameters'];
        if (this.swagger.paths[path][method]['parameters'] != undefined) {
            playbook += prefix + "\t\tbody_format: json\r" +
                        prefix + "\t\tbody:\r";
            for (var i in parameters) {
                let p = parameters[i];
                if (p['$ref'] != undefined) {
                    p = this.swagger.parameters[p['$ref'].split('#/parameters/')[1]];
                }
                if (p['in'] == "body") {
                    playbook += prefix + "\t\t\t" + p['name'] + ":\r";

                    let schema = p['schema'];
                    if (p['schema'] != undefined) {
                        playbook += this.playbookFromSwaggerSchema(schema, prefix + "\t\t\t\t");
                    }
                }
            }
        }

        return playbook;
    }

    private playbookFromSwaggerSchema(schema: any, prefix: string) {
        let playbook = "";
        if (schema['$ref'] != undefined) {
            schema = this.swagger.definitions[schema['$ref'].split('#/definitions/')[1]];
        }

        for (var propName in schema['properties']) {
            let property = schema['properties'][propName];
            playbook += prefix + propName + ":\r";

            if (property['$ref'] != undefined) {
                playbook += this.playbookFromSwaggerSchema(this.swagger.definitions[property['$ref'].split('#/definitions/')[1]], prefix + '  ' );
            }
        }

        return playbook;
    } 
}
