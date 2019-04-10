import * as fsextra from 'fs-extra';
import { CompletionItem, CompletionItemKind, SnippetString } from 'vscode';
import { filter } from 'fuzzaldrin-plus';
import * as path from 'path';

export function parseAnsibleCompletionFile(sourcefile: string): Promise<AnsibleCompletionData> {
    if (!sourcefile) {
        sourcefile = path.join(__dirname, '../snippets/ansible-data.json');
    }
    var data = <JSONData>JSON.parse(fsextra.readFileSync(sourcefile, 'utf8'));

    const snippetFile = path.join(__dirname, '../snippets/codesnippets.json');
    const codeSnippets = <CodeSnippets>JSON.parse(fsextra.readFileSync(snippetFile, 'utf8'));

    let modules: AnsibleCompletionItemList = [];
    let directives: AnsibleCompletionItemList = [];
    let loopDirectives: AnsibleCompletionItemList = [];
    let codeSnippetItems: AnsibleCompletionItemList = [];

    if (data) {
        modules = data.modules.map((module) => {
            let item = new AnsibleCompletionItem(module.module, CompletionItemKind.Function);
            item.detail = 'module: \n' + `${module.short_description || ''}`;
            item.documentation = `http://docs.ansible.com/ansible/${module.module}_module.html`;

            if (module.deprecated) {
                item.detail = `(Deprecated) ${item.detail}`;
            }
            return item;
        });

        Object.keys(data.directives).forEach((key) => {
            let item = new AnsibleCompletionItem(key, CompletionItemKind.Keyword);
            item.detail = 'directive';
            item.documentation = `directive for ${data.directives[key].join(', ')}.`;
            directives.push(item);
        })

        loopDirectives = data.lookup_plugins.map((plugin) => {
            let item = new AnsibleCompletionItem(`with_${plugin}`, CompletionItemKind.Keyword);
            item.detail = 'loop directive';
            item.documentation = 'directive for loop';
            return item;
        });
    }

    const indent = '  ';
    if (codeSnippets) {
        Object.keys(codeSnippets).forEach((key) => {
            let snippet = codeSnippets[key];

            let item = new AnsibleCompletionItem(key + '_snippet', CompletionItemKind.Snippet);
            item.insertText = new SnippetString(snippet.body.join('\n' + indent));
            item.detail = snippet.description + ' (Ansible)';
            item.documentation = snippet.body.join('\n' + indent);
            item.filterText = snippet.prefix;
            codeSnippetItems.push(item);
        })
    }

    return Promise.resolve(new AnsibleCompletionData(modules, directives, loopDirectives, codeSnippetItems));
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
    public codeSnippetsItem: AnsibleCompletionItemList;

    constructor(modules: AnsibleCompletionItemList,
        directives: AnsibleCompletionItemList,
        loopDirectives: AnsibleCompletionItemList,
        codeSnippets: AnsibleCompletionItemList) {
        this.modules = modules;
        this.directives = directives;
        this.loopDirectives = loopDirectives;
        this.codeSnippetsItem = codeSnippets;
    }
}

export function getFuzzySuggestions(data: AnsibleCompletionItemList, prefix: string): CompletionItem[] {
    return filter(data, prefix, { key: 'label' });
}

export interface CodeSnippet {
    prefix: string;
    description: string;
    body: string[]
}

export type CodeSnippets = { [key: string]: CodeSnippet };


