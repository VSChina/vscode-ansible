import { AnsibleCompletionData, parseAnsibleCompletionFile, getFuzzySuggestions } from "./completionData";
import { CompletionItem } from "vscode";

export class CompletionEngine {
    private data: AnsibleCompletionData;

    constructor() {
        
        parseAnsibleCompletionFile('').then((data) => {
            this.data = data;
        }).catch((err) => {
            console.log('error msg');
        })
    }

    public getCompletionItems(prefix: string, line: string): Promise<CompletionItem[]> {
        //let moduleRegexp = new RegExp(`^\\s*-?\\s+(action\\s*:\\s+|local_action\\s*:\\s+|)${prefix}$`);

        let result: CompletionItem[] = [];
        // let match = line.match(moduleRegexp);
        // if (match) {
        //     if (!match[1]) {
        if (/^with_/.test(prefix)) {
            Array.prototype.push.apply(result, getFuzzySuggestions(this.data.loopDirectives, prefix));
        }
        Array.prototype.push.apply(result, getFuzzySuggestions(this.data.directives, prefix));
        //}
        Array.prototype.push.apply(result, getFuzzySuggestions(this.data.modules, prefix));
        //}
        return Promise.resolve(result);
    }

}