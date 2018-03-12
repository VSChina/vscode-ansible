import * as vscode from 'vscode';
import { CompletionEngine } from './completionEngine';
import { Range } from 'vscode-languageclient/lib/main';
import * as utilities from './utilities';

const pattern_variable = new RegExp('\\S+: \".*{{\\s*(}}.)*\"*\\s*#*.*$');
const pattern_firstLine = new RegExp('^#\\s*ansible-configured$', 'gm');

export class AnsibleCompletionItemProvider implements vscode.CompletionItemProvider {
    private completionEngine: CompletionEngine;

    constructor() {
        this.completionEngine = new CompletionEngine();
    }
    public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionItem[]> {

        if (!this.enableAutoCompletion(document)) {
            return;
        }

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
        if (!utilities.getCodeConfiguration('ansible', 'autocompletion')) {
            if (document.getText().indexOf('# ansible-configured') === 0) {
                return true;
            }
        }

        return false;
    }
}
