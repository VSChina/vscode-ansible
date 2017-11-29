"use strict";

import TelemetryReporter from 'vscode-extension-telemetry';
import { Constants } from './constants';
import * as vscode from 'vscode';

const packageJson = vscode.extensions.getExtension(Constants.ExtensionId).packageJSON;

export class TelemetryClient {
    public static sendEvent(eventName: string, properties?: { [key: string]: string; }): void {        
        this._client.sendTelemetryEvent(eventName, properties);
    }

    private static _client = new TelemetryReporter(Constants.ExtensionId, packageJson.version, packageJson.apiKey);
}
