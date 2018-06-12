'use strict';

import * as vscode from 'vscode';
import { SSHServer } from './interfaces';
import { OutputChannel } from 'vscode';
import * as path from 'path';
import { Constants } from './constants';

export function openSSHConsole(outputChannel: OutputChannel, server: SSHServer) {
	const progress = delayedInterval(() => { outputChannel.append('.') }, 500);

	return (async function retry(): Promise<any> {
		outputChannel.appendLine('\nConnecting to host ' + server.host + '..');
		outputChannel.show();

		const isWindows = process.platform === 'win32';

		let shellPath = path.join(__dirname, `../bin/node.${isWindows ? 'bat' : 'sh'}`);
		let modulePath = path.join(__dirname, 'SSHLauncher');
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

		var envs = {
			SSH_HOST: server.host,
			SSH_PORT: String(server.port),
			SSH_USER: server.user,
			NODE_TLS_REJECT_UNAUTHORIZED: "0",
			SSH_PASSWORD: server.password,
			SSH_KEY: server.key,
			SSH_PASSPHRASE: server.passphrase
		};

		const terminal = vscode.window.createTerminal({
			name: 'SSH ' + server.host,
			shellPath,
			shellArgs,
			env: envs
		});
		progress.cancel();

		terminal.show();
		return terminal;
	})().catch(err => {
		progress.cancel();
		outputChannel.appendLine('\nConnecting to SSH failed with error: \n' + err);
		outputChannel.show();
		throw err;
	});


	function delayedInterval(func: () => void, interval: number) {
		const handle = setInterval(func, interval);
		return {
			cancel: () => clearInterval(handle)
		}
	}
}