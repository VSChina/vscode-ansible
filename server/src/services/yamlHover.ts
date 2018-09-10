'use strict';

import { TextDocument, Position, Hover, Range } from "vscode-languageserver/lib/main";
import * as Parser from 'vscode-json-languageservice/lib/umd/parser/jsonParser';
import { SingleYAMLDocument } from 'yaml-language-server/out/server/src/languageservice/parser/yamlParser';
import { PromiseConstructor } from 'vscode-json-languageservice';
import * as path from 'path';
import * as fsextra from 'fs-extra';

const ansibleDataFile = path.join(__dirname, '../../../snippets/ansible-data.json');

export class YAMLHover {
    private promise: PromiseConstructor;
    private enable: boolean;
    private moduleNames: string[];

    constructor(promiseConstructor: PromiseConstructor) {
        this.promise = promiseConstructor || Promise;
        this.enable = true;

        this.moduleNames = this.getModuleList();
    }

    public configure(enable: boolean) {
        this.enable = enable;
    }

    public doHover(document: TextDocument, position: Position, jsonDoc: Parser.JSONDocument): Thenable<Hover> {
        if (!this.enable) {
            return this.promise.resolve(void 0);
        }

        let offset = document.offsetAt(position);
        let currentDoc = matchOffsetToDocument(offset, jsonDoc);


        if (!currentDoc) {
            return this.promise.resolve(void 0);
        }

        let node = currentDoc.getNodeFromOffset(offset);
        if (!node || (node.type === 'object' || node.type === 'array') && offset > node.start + 1 && offset < node.end - 1) {
            return this.promise.resolve(void 0);
        }

        if (node.type === 'string' && node.isKey && node.value != 'name') {

            if (node.parent && node.parent.type === 'property') {
                let parent = <Parser.PropertyASTNode>node.parent;

                if (parent.parent && parent.parent.type === 'object') {
                    let grandparent = <Parser.ObjectASTNode>parent.parent;

                    if ((grandparent.parent && grandparent.parent.type === 'array') ||
                        (grandparent.type === 'object' && grandparent.parent.type === 'array' && grandparent.parent.parent === null)) {
                        let taskNode = <Parser.ArrayASTNode>grandparent.parent;

                        if (taskNode.location === 'tasks' || (taskNode.type === 'array' && this.moduleNames.indexOf(node.value) > -1)) {
                            let hoverRange = Range.create(document.positionAt(node.start), document.positionAt(node.end));

                            return Promise.resolve(this.createHover(node.getValue(), hoverRange)).then();
                        }
                    }
                }
            }
        }
        return this.promise.resolve(void 0);

    }

    private createHover(content: string, range: Range): Hover {
        let result: Hover = {
            contents: `module, documentation at http://docs.ansible.com/ansible/${content}_module.html`,
            range: range
        }
        return result;
    }

    private getModuleList(): string[] {

        const data = <JSONData>JSON.parse(fsextra.readFileSync(ansibleDataFile, 'utf8'));

        let moduleNames: string[] = [];

        data.modules.forEach((module) => {
            moduleNames.push(module.module);
        });

        return moduleNames;
    }
}


export function matchOffsetToDocument(offset: number, jsonDocuments: Parser.JSONDocument): SingleYAMLDocument {
    for (let index in jsonDocuments.documents) {
        let doc = jsonDocuments.documents[index];

        if (doc.root && doc.root.end >= offset && doc.root.start <= offset) {
            return doc;
        }
    }
}


interface Directive {
    module: string;
    deprecated?: string;
    short_description: string;
    options: DirectiveOptions;
}

interface DirectiveOption {
    default: string;
    required: boolean;
    description: string[];
    choices?: string[];
    suboptions: DirectiveOptions;
}

type DirectiveOptions = { [key: string]: DirectiveOption };

type Directives = { [key: string]: string[] };

type Modules = Directive[];
type LookupPlugins = string[];

interface JSONData {
    modules: Modules;
    directives: Directives;
    lookup_plugins: LookupPlugins;
}