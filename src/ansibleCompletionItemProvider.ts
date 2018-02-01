import * as vscode from 'vscode';
import { CompletionEngine } from './completionEngine';
import { Range } from 'vscode-languageclient/lib/main';

const pattern_variable = new RegExp('\\S+: \".*{{\\s*(}}.)*\"*$');
const pattern_firstLine = new RegExp('^#\\s*ansible-configured$', 'gm');

export class AnsibleCompletionItemProvider implements vscode.CompletionItemProvider {
    private completionEngine: CompletionEngine;

    constructor() {
        this.completionEngine = new CompletionEngine();
    }
    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionItem[]> {

        let range = document.getWordRangeAtPosition(position);
        let prefix = range ? document.getText(range) : '';
        let lineText = document.lineAt(position.line).text;

        if (pattern_variable.exec(lineText)) {
            return this.completionEngine.getVariablesCompletionItem(document, prefix, lineText);
        } else {
            return this.completionEngine.getCompletionItems(prefix, lineText);
        }
    }

    private enableAutoCompletion(document: vscode.TextDocument): boolean {
        if (pattern_firstLine.exec(document.getText())) {
            return true;
        }
        return false;
    }
}
