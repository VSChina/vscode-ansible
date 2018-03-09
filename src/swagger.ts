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

    public generateRestApiCallPlaybook(path: string, method: string): string {
                        
        let playbook: string = ""
        let prefix = "    ";
        playbook += prefix + "- name: Call REST API\r" +
                    prefix + "  uri:\r" +
                    prefix + "    url: " + this.swagger['schemes'][0] + '://' + this.swagger['host'] + '/' + path + "\r" +
                    prefix + "    method: " + method + "\r" +
                    prefix + "    headers:\r" +
                    prefix + "      Authorization: Bearer {{ authresp.json.access_token }}\r";
        let parameters = this.swagger.paths[path][method]['parameters'];
        if (this.swagger.paths[path][method]['parameters'] != undefined) {
            playbook += prefix + "    body_format: json\r" +
                        prefix + "    body:\r";
            for (var i in parameters) {
                let p = parameters[i];
                if (p['$ref'] != undefined) {
                    p = this.swagger.parameters[p['$ref'].split('#/parameters/')[1]];
                }
                if (p['in'] == "body") {
                    playbook += prefix + "      " + p['name'] + ":\r";

                    let schema = p['schema'];
                    if (p['schema'] != undefined) {
                        playbook += this.playbookFromSwaggerSchema(schema, prefix + "        ");
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
