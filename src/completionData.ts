import * as fsextra from 'fs-extra';
import { open } from 'fs';
import { CompletionItem, CompletionItemKind } from 'vscode';
import { filter } from 'fuzzaldrin-plus';
import * as path from 'path';

export function parseAnsibleCompletionFile(sourcefile: string): Promise<AnsibleCompletionData> {
    if (!sourcefile) {
        sourcefile = path.join(__dirname, '../snippets/ansible-data.json');
    }
    var data = <JSONData>JSON.parse(fsextra.readFileSync(sourcefile, 'utf8'));

    if (data) {
        let modules = data.modules.map((module) => {
            let item = new AnsibleCompletionItem(module.module, CompletionItemKind.Function);
            item.detail = 'module: \n' + `${module.short_description || ''}`;
            item.documentation = `http://docs.ansible.com/ansible/${module.module}_module.html`;

            if (module.deprecated) {
                item.detail = `(Deprecated) ${item.detail}`;
            }
            return item;
        });

        let directives: AnsibleCompletionItemList = [];
        Object.keys(data.directives).forEach((key) => {
            let item = new AnsibleCompletionItem(key, CompletionItemKind.Keyword);
            item.detail = 'directive';
            item.documentation = `directive for ${data.directives[key].join(', ')}.`;
            directives.push(item);
        })

        let loopDirectives = data.lookup_plugins.map((plugin) => {
            let item = new AnsibleCompletionItem(`with_${plugin}`, CompletionItemKind.Keyword);
            item.detail = 'loop directive';
            item.documentation = 'directive for loop';
            return item;
        });

        return Promise.resolve(new AnsibleCompletionData(modules, directives, loopDirectives));
    }
}


export class AnsibleCompletionItem extends CompletionItem {
    extraOptions: DirectiveOptions;
}

export type AnsibleCompletionItemList = AnsibleCompletionItem[];

export interface Directive {
    module: string;
    deprecated?: string;
    short_description: string;
    options: DirectiveOptions;
}

export interface DirectiveOption {
    default: string;
    required: boolean;
    description: string[];
    choices?: string[];
    suboptions: DirectiveOptions;
}

export type DirectiveOptions = { [key: string]: DirectiveOption };

export type Directives = { [key: string]: string[] };

export type Modules = Directive[];
export type LookupPlugins = string[];

export interface JSONData {
    modules: Modules;
    directives: Directives;
    lookup_plugins: LookupPlugins;
}

export class AnsibleCompletionData {
    public modules: AnsibleCompletionItemList;
    public directives: AnsibleCompletionItemList;
    public loopDirectives: AnsibleCompletionItemList;

    constructor(modules: AnsibleCompletionItemList, directives: AnsibleCompletionItemList, loopDirectives: AnsibleCompletionItemList) {
        this.modules = modules;
        this.directives = directives;
        this.loopDirectives = loopDirectives;
    }
}

export function getFuzzySuggestions(data: AnsibleCompletionItemList, prefix: string): CompletionItem[] {
    return filter(data, prefix, { key: 'label' });
}