'use strict';

import * as vscode from 'vscode';

export class PlaybookManager {
    constructor() {
    }

    public doesTaskExistByName(name: string, beforeCursor: boolean) {
        if (vscode.window.activeTextEditor != undefined && vscode.window.activeTextEditor.document.languageId == "yaml") {
            let text: string = null;
            if (beforeCursor) {
                text = vscode.window.activeTextEditor.document.getText(new vscode.Range(new vscode.Position(0, 0), vscode.window.activeTextEditor.selection.start));
            } else {
                text = vscode.window.activeTextEditor.document.getText();
            }

            let authorisationTaskPosition: number = text.indexOf("- name: " + name);
            return authorisationTaskPosition >= 0;
        }

        // just a simple approach for now
        return false;
    }

    public insertTask(task: string) {
        let __this = this;

        // create new yaml document if not current document
        if (vscode.window.activeTextEditor == undefined || vscode.window.activeTextEditor.document.languageId != "yaml") {
            vscode.workspace.openTextDocument({ language: "yaml", content: "" }).then((a: vscode.TextDocument) => {
                vscode.window.showTextDocument(a, 1, false).then(e => {
                    __this.insertTask(task);
                });
            });
        } else {
            // obtain current tabsize in the document
            let tabSize: number = 2;
            if (typeof vscode.window.activeTextEditor.options.tabSize == "number") {
                tabSize = vscode.window.activeTextEditor.options.tabSize;
            }

            let lineCount = 0;
            if (vscode.window.activeTextEditor.document.getText() == "") {

                vscode.window.activeTextEditor.edit(function (edit) {
                    let prefix: string = "- hosts: localhost\r" +
                        " ".repeat(tabSize) + "vars:\r" +
                        " ".repeat(tabSize * 2) + "resource_group:\r" +
                        " ".repeat(tabSize) + "tasks:\r";
                    edit.insert(new vscode.Position(0, 0), prefix);
                });

                lineCount = 7;
            } else {
                lineCount = vscode.window.activeTextEditor.document.lineCount;
            }

            // add spaces below
            let lines: string[] = task.split('\r');

            for (var i = 0; i < lines.length; i++) {
                let prefix = " ".repeat(tabSize * 2);
                lines[i] = prefix + lines[i];
            }

            task = '\r' + lines.join('\r');

            let insertionPoint = new vscode.Position(lineCount - 1, 0);
            vscode.window.activeTextEditor.insertSnippet(new vscode.SnippetString(task), insertionPoint);
        }
    }
}
