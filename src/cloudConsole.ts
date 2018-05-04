/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { window, commands, MessageItem, OutputChannel, Terminal, env } from 'vscode';
import { AzureAccount, AzureSession } from './azure-account.api';
import { getUserSettings, provisionConsole, Errors, resetConsole, delay, runInTerminal, getStorageAccountKey } from './cloudConsoleLauncher';
import * as nls from 'vscode-nls';
import * as path from 'path';
import * as opn from 'opn';
import * as cp from 'child_process';
import * as semver from 'semver';
import { TIMEOUT } from 'dns';
import * as ws from 'ws';
import * as fsExtra from 'fs-extra';
import { Constants, CloudShellErrors, CloudShellStatus } from './constants';
import { setInterval, clearInterval } from 'timers';
import { TelemetryClient } from './telemetryClient';

const localize = nls.loadMessageBundle();

export interface OS {
	id: string;
	shellName: string;
	otherOS: OS;
}

export const OSes: Record<string, OS> = {
	Linux: {
		id: 'linux',
		shellName: localize('azure-account.bash', "Bash"),
		get otherOS() { return OSes.Windows; },
	},
	Windows: {
		id: 'windows',
		shellName: localize('azure-account.powershell', "PowerShell"),
		get otherOS() { return OSes.Linux; },
	}
};

export async function openCloudConsole(api: AzureAccount, os: OS, files, outputChannel: OutputChannel, tempFile: string) {
	const progress = delayedInterval(() => { outputChannel.append('.') }, 500);
	return (async function retry(): Promise<any> {
		outputChannel.append('\nConnecting to Cloud Shell.');
		outputChannel.show();

		const isWindows = process.platform === 'win32';
		if (isWindows) {
			// See below
			try {
				const { stdout } = await exec('node.exe --version');
				const version = stdout[0] === 'v' && stdout.substr(1).trim();
				if (version && semver.valid(version) && !semver.gte(version, '6.0.0')) {
					progress.cancel();
					TelemetryClient.sendEvent('cloudshell', { 'status': CloudShellStatus.Failed, 'error': CloudShellErrors.NodeJSNotInstalled });
					return requiresNode();
				}
			} catch (err) {
				progress.cancel();
				TelemetryClient.sendEvent('cloudshell', { 'status': CloudShellStatus.Failed, 'error': CloudShellErrors.NodeJSNotInstalled });
				return requiresNode();
			}
		}

		if (!(await api.waitForLogin())) {
			progress.cancel();

			await commands.executeCommand('azure-account.askForLogin');
			if (!(await api.waitForLogin())) {
				TelemetryClient.sendEvent('cloudshell', { 'status': CloudShellStatus.Failed, 'error': CloudShellErrors.AzureNotSignedIn });
				return;
			}
		}

		const tokens = await Promise.all(api.sessions.map(session => acquireToken(session)));
		const result = await findUserSettings(tokens);
		if (!result) {
			TelemetryClient.sendEvent('cloudshell', { 'status': CloudShellStatus.Failed, 'error': CloudShellErrors.NotSetupFirstLaunch });
			progress.cancel();
			return requiresSetUp();
		}

		// get storage account from user settings
		const storageProfile = result.userSettings.storageProfile;
		const storageAccountSettings =
			storageProfile.storageAccountResourceId.substr(1,
				storageProfile.storageAccountResourceId.length).split("/");
		const storageAccount = {
			subscriptionId: storageAccountSettings[1],
			resourceGroup: storageAccountSettings[3],
			provider: storageAccountSettings[5],
			storageAccountName: storageAccountSettings[7],
		};

		const fileShareName = result.userSettings.storageProfile.fileShareName;

		// Getting the storage account key
		let storageAccountKey: string;
		await getStorageAccountKey(
			storageAccount.resourceGroup,
			storageAccount.subscriptionId,
			result.token.accessToken,
			storageAccount.storageAccountName).then((keys) => {
				storageAccountKey = keys.body.keys[0].value;
			});

		let consoleUri: string;
		const armEndpoint = result.token.session.environment.resourceManagerEndpointUrl;
		const inProgress = delayed(() => window.showInformationMessage(localize('azure-account.provisioningInProgress', "Provisioning {0} in Cloud Shell may take a few seconds.", os.shellName)), 2000);
		try {
			consoleUri = await provisionConsole(result.token.accessToken, armEndpoint, result.userSettings, os.id);
			inProgress.cancel();
			progress.cancel();
		} catch (err) {
			inProgress.cancel();
			progress.cancel();
			if (err && err.message === Errors.DeploymentOsTypeConflict) {
				return deploymentConflict(retry, os, result.token.accessToken, armEndpoint);
			}
			throw err;
		}

		// TODO: How to update the access token when it expires?
		let shellPath = path.join(__dirname, `../bin/node.${isWindows ? 'bat' : 'sh'}`);
		let modulePath = path.join(__dirname, 'cloudConsoleLauncher');
		if (isWindows) {
			modulePath = modulePath.replace(/\\/g, '\\\\');
		}
		const shellArgs = [
			process.argv0,
			'-e',
			`require('${modulePath}').main()`,
		];

		if (isWindows) {
			// Work around https://github.com/electron/electron/issues/4218 https://github.com/nodejs/node/issues/11656
			shellPath = 'node.exe';
			shellArgs.shift();
		}

		let response = await runInTerminal(result.token.accessToken, consoleUri, '');

		const terminal = window.createTerminal({
			name: localize('azure-account.cloudConsole', "{0} in Cloud Shell", os.shellName),
			shellPath,
			shellArgs,
			env: {
				CLOUD_CONSOLE_ACCESS_TOKEN: result.token.accessToken,
				CLOUD_CONSOLE_URI: consoleUri,
				CLOUDSHELL_TEMP_FILE: tempFile,
				// to workaround tls error: https://github.com/VSChina/vscode-ansible/pull/44
				NODE_TLS_REJECT_UNAUTHORIZED: "0"
			}
		});

		progress.cancel();
		terminal.show();
		return [terminal, storageAccount.storageAccountName, storageAccountKey, fileShareName, storageAccount.resourceGroup];
	})().catch(err => {
		progress.cancel();
		TelemetryClient.sendEvent('cloudshell', { 'status': CloudShellStatus.Failed, 'error': CloudShellErrors.ProvisionFailed, 'detailerror': err });

		outputChannel.appendLine('\nConnecting to Cloud Shell failed with error: \n' + err);
		outputChannel.show();
		throw err;
	});
}

async function findUserSettings(tokens: Token[]) {
	for (const token of tokens) {
		const userSettings = await getUserSettings(token.accessToken, token.session.environment.resourceManagerEndpointUrl);
		if (userSettings && userSettings.storageProfile) {
			return { userSettings, token };
		}
	}
}

async function requiresSetUp() {
	const open: MessageItem = { title: "Open instruction" };
	const close: MessageItem = { title: "Close", isCloseAffordance: true };
	const message = "First launch of Cloud Shell requires setup in the Azure portal (https://portal.azure.com).";
	const response = await window.showInformationMessage(message, open, close);
	if (response === open) {
		opn('https://docs.microsoft.com/en-us/azure/cloud-shell/overview');
	}
}

async function requiresNode() {

	const open: MessageItem = { title: "Open" };
	const close: MessageItem = { title: "Close", isCloseAffordance: true };
	const message = "Opening a Cloud Shell currently requires Node.js 6 or later being installed (https://nodejs.org).";
	const response = await window.showInformationMessage(message, open, close);
	if (response === open) {
		opn('https://nodejs.org');
	}
}

async function deploymentConflict(retry: () => Promise<void>, os: OS, accessToken: string, armEndpoint: string) {
	const ok: MessageItem = { title: "OK" };
	const cancel: MessageItem = { title: "Cancel", isCloseAffordance: true };
	const message = "Starting a " + os.shellName + " session will terminate all active " + os.otherOS.shellName + " sessions. Any running processes in active " + os.otherOS.shellName + " sessions will be terminated.";
	const response = await window.showWarningMessage(message, ok, cancel);
	if (response === ok) {
		await resetConsole(accessToken, armEndpoint);
		return retry();
	}
}

interface Token {
	session: AzureSession;
	accessToken: string;
	refreshToken: string;
}

async function acquireToken(session: AzureSession) {
	return new Promise<Token>((resolve, reject) => {
		const credentials: any = session.credentials;
		const environment: any = session.environment;
		credentials.context.acquireToken(environment.activeDirectoryResourceId, credentials.username, credentials.clientId, function (err: any, result: any) {
			if (err) {
				reject(err);
			} else {
				resolve({
					session,
					accessToken: result.accessToken,
					refreshToken: result.refreshToken
				});
			}
		});
	});
}

function delayed(fun: () => void, delay: number) {
	const handle = setTimeout(fun, delay);
	return {
		cancel: () => clearTimeout(handle)
	}
}

function delayedInterval(func: () => void, interval: number) {
	const handle = setInterval(func, interval);
	return {
		cancel: () => clearInterval(handle)
	}
}

export interface ExecResult {
	error: Error | null;
	stdout: string;
	stderr: string;
}


async function exec(command: string) {
	return new Promise<ExecResult>((resolve, reject) => {
		cp.exec(command, (error, stdout, stderr) => {
			(error || stderr ? reject : resolve)({ error, stdout, stderr });
		});
	});
}

function escapeFile(data: string): string {
	return data.replace(/"/g, '\\"');
}