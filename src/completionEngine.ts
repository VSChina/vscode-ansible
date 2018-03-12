import { AnsibleCompletionData, parseAnsibleCompletionFile, getFuzzySuggestions } from "./completionData";
import { CompletionItem, TextDocument, CompletionItemKind } from "vscode";


const pattern_vars = new RegExp('(?:  vars:\\s+    )((\\S+)(: \\S+\\s+))+(?:  \\S+)');
const pattern_vars_list = new RegExp('[^]    (\\S+): \\S+\\s*?', 'gm');

export class CompletionEngine {
    private data: AnsibleCompletionData;

    constructor() {

        parseAnsibleCompletionFile('').then((data) => {
            this.data = data;
        }).catch((err) => {
            console.log('failed to parse ansible data');
        })
    }

    public getCompletionItems(prefix: string, line: string): Promise<CompletionItem[]> {
        let result: CompletionItem[] = [];

        if (/^with_/.test(prefix)) {
            Array.prototype.push.apply(result, getFuzzySuggestions(this.data.loopDirectives, prefix));
        }
        Array.prototype.push.apply(result, getFuzzySuggestions(this.data.directives, prefix));
        Array.prototype.push.apply(result, getFuzzySuggestions(this.data.modules, prefix));
        Array.prototype.push.apply(result, getFuzzySuggestions(this.data.codeSnippetsItem, prefix));
        return Promise.resolve(result);
    }

    public getVariablesCompletionItem(document: TextDocument, prefix: string, line: string): Promise<CompletionItem[]> {
        var items: CompletionItem[] = [];
        var variables = CompletionEngine.getVaraibleList(document);

        if (variables && variables.length > 0) {
            for (let value of variables) {
                var item: CompletionItem = {
                    label: value,
                    kind: CompletionItemKind.Variable,

                }
                items.push(item);
            }
        }
        return Promise.resolve(items);
    }

    private static getVaraibleList(document: TextDocument): string[] {
        var result = [];
        if (!document) {
            return result;
        }

        var matches = pattern_vars.exec(document.getText());
        if (matches) {
            var vars = matches[0];

            var fieldMatch = pattern_vars_list.exec(vars);
            while (fieldMatch) {
                result.push(fieldMatch[1]);
                fieldMatch = pattern_vars_list.exec(vars);
            }
        }

        return result;
    }
}