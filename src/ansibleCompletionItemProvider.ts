import * as vscode from 'vscode';
import { CompletionEngine } from './completionEngine';

const pattern_variable = new RegExp('\\s+\\S+: \"{{\\s*\"*$');

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
}
