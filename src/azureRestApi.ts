'use strict';

import * as vscode from 'vscode';
import * as utilities from './utilities';
import { Constants } from './constants';
import { TelemetryClient } from './telemetryClient';
import * as yamljs from 'yamljs';

var request = require('request');

export class AzureRestApi {
    constructor() {}

    public list() : string[] {
        return null;
    }

    public getResourceManagerApi(api: string): any {
        return null;
    }
}
