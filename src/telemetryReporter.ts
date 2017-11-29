"use strict";

import TelemetryReporter from 'vscode-extension-telemetry';
import { Constants } from './constants';
import { ExtensionContext } from 'vscode';

export function createReporter(context: ExtensionContext) {
    const extensionPackage = require(context.asAbsolutePath('./package.json'));
    const reporter = new TelemetryReporter(extensionPackage.name, extensionPackage.version, extensionPackage.apiKey);
    context.subscriptions.push(reporter);
    return reporter;
}