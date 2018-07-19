"use strict";

import * as vscode from "vscode";
import { Constants } from "./constants";
import * as utilities from "./utilities";
import * as path from "path";
import { OutputChannel } from "vscode";

export enum Option {
    docker = "Docker",
    local = "Local"
}


export abstract class BaseRunner {
    protected _outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this._outputChannel = outputChannel;
    }

    protected output(label: string, message: string): void {
        this._outputChannel.append(`[${label}] ${message}`);
    }

    protected outputLine(label: string, message: string): void {
        this._outputChannel.appendLine(`[${label}] ${message}`);
    }

    protected isWindows(): boolean {
        return process.platform === 'win32';
    }

    public runPlaybook(playbook: string): void {

        if (!playbook) {
            playbook = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
            vscode.window.showInputBox({ value: playbook, prompt: 'Please input playbook name', placeHolder: 'playbook', password: false })
                .then((input) => {
                    if (input != undefined && input != '') {
                        playbook = input;
                    } else {
                        return;
                    }

                    if (this.validatePlaybook(playbook)) {
                        return this.runPlaybookInternal(playbook);
                    }
                })
        } else {
            if (this.validatePlaybook(playbook)) {
                return this.runPlaybookInternal(playbook);
            }
        }
    }

    protected validatePlaybook(playbook: string): boolean {
        if (!utilities.validatePlaybook(playbook)) {
            return false;
        }

        return true;
    }

    protected abstract runPlaybookInternal(playbook: string);

    protected getRunPlaybookCmd(playbook: string): string {
        let cmd = ['ansible-playbook'];
        let customOption = utilities.getCodeConfiguration<string>('ansible', 'customOptions');

        if (customOption)  {
            cmd.push(customOption);
        }

        cmd.push(playbook);

        return cmd.join(" ");
    }
}

