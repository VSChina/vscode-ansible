/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { window, commands, MessageItem, OutputChannel, Terminal, env } from 'vscode';
import { AzureAccount, AzureSession } from './azure-account.api';
import { getUserSettings, provisionConsole, Errors, resetConsole, delay, runInTerminal } from './cloudConsoleLauncher';
import * as nls from 'vscode-nls';
import * as path from 'path';
import * as opn from 'opn';
import * as cp from 'child_process';
import * as semver from 'semver';
import { TIMEOUT } from 'dns';
import * as ws from 'ws';
import * as fsExtra from 'fs-extra';
import { Constants } from './constants';

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

export function openCloudConsole(api: AzureAccount, os: OS, files, outputChannel: OutputChannel, tempFile: string) {
	return (async function retry(): Promise<any> {

		const isWindows = process.platform === 'win32';
		if (isWindows) {
			// See below
			try {
				const { stdout } = await exec('node.exe --version');
				const version = stdout[0] === 'v' && stdout.substr(1).trim();
				if (version && semver.valid(version) && !semver.gte(version, '6.0.0')) {
					return requiresNode();
				}
			} catch (err) {
				return requiresNode();
			}
		}

		if (!(await api.waitForLogin())) {
			return commands.executeCommand('azure-account.askForLogin');
		}

		const tokens = await Promise.all(api.sessions.map(session => acquireToken(session)));
		const result = await findUserSettings(tokens);
		if (!result) {
			return requiresSetUp();
		}

		let consoleUri: string;
		const armEndpoint = result.token.session.environment.resourceManagerEndpointUrl;
		const inProgress = delayed(() => window.showInformationMessage(localize('azure-account.provisioningInProgress', "Provisioning {0} in Cloud Shell may take a few seconds.", os.shellName)), 2000);
		try {
			consoleUri = await provisionConsole(result.token.accessToken, armEndpoint, result.userSettings, os.id);
			inProgress.cancel();
		} catch (err) {
			inProgress.cancel();
			if (err && err.message === Errors.DeploymentOsTypeConflict) {
				return deploymentConflict(retry, os, result.token.accessToken, armEndpoint);
			}
			throw err;
		}

		// TODO: How to update the access token when it expires?
		let shellPath = path.join(__dirname, `../../bin/node.${isWindows ? 'bat' : 'sh'}`);
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

		// upload files to cloudshell
		const retry_interval = 500;
		const retry_times = 30;
		for (var i = 0; i < retry_times; i++) {
			if (response.readyState != ws.OPEN) {
				await delay(retry_interval);
			} else {
				for (let file of files) {
					const data = fsExtra.readFileSync(file, { encoding: 'utf8' });
					outputChannel.append(Constants.LineSeperator + '\nUpload playbook to CloudShell: ' + file + ' as ' + path.basename(file) + '\n');
					response.send('echo -e "' + data + '" > ' + path.basename(file) + ' \n');
				}
				break;
			}
		}

		const terminal = window.createTerminal({
			name: localize('azure-account.cloudConsole', "{0} in Cloud Shell", os.shellName),
			shellPath,
			shellArgs,
			env: {
				CLOUD_CONSOLE_ACCESS_TOKEN: result.token.accessToken,
				CLOUD_CONSOLE_URI: consoleUri,
				CLOUDSHELL_TEMP_FILE: tempFile
			}
		});

		terminal.show();
		return terminal;
	})().catch(err => {
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
	const open: MessageItem = { title: localize('azure-account.open', "Open") };
	const close: MessageItem = { title: localize('azure-account.close', "Close"), isCloseAffordance: true };
	const message = localize('azure-account.setUpInPortal', "First launch of Cloud Shell requires setup in the Azure portal (https://portal.azure.com).");
	const response = await window.showInformationMessage(message, open, close);
	if (response === open) {
		opn('https://portal.azure.com');
	}
}

async function requiresNode() {

	const open: MessageItem = { title: localize('azure-account.open', "Open") };
	const close: MessageItem = { title: localize('azure-account.close', "Close"), isCloseAffordance: true };
	const message = localize('azure-account.requiresNode', "Opening a Cloud Shell currently requires Node.js 6 or later being installed (https://nodejs.org).");
	const response = await window.showInformationMessage(message, open, close);
	if (response === open) {
		opn('https://nodejs.org');
	}
}

async function deploymentConflict(retry: () => Promise<void>, os: OS, accessToken: string, armEndpoint: string) {
	const ok: MessageItem = { title: localize('azure-account.ok', "OK") };
	const cancel: MessageItem = { title: localize('azure-account.cancel', "Cancel"), isCloseAffordance: true };
	const message = localize('azure-account.deploymentConflict', "Starting a {0} session will terminate all active {1} sessions. Any running processes in active {1} sessions will be terminated.", os.shellName, os.otherOS.shellName);
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
