'use strict';

import { TextDocument, Position, Hover, Range } from "vscode-languageserver/lib/main";
import * as Parser from 'vscode-json-languageservice/lib/parser/jsonParser';
import { SingleYAMLDocument } from 'vscode-yaml-languageservice/lib/parser/yamlParser';
import { PromiseConstructor } from 'vscode-json-languageservice';


export class YAMLHover {
    private promise: PromiseConstructor;
    private enable: boolean;

    constructor(promiseConstructor: PromiseConstructor) {
        this.promise = promiseConstructor || Promise;
        this.enable = true;
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


        if (currentDoc === null || currentDoc === undefined) {
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

                    if (grandparent.parent && grandparent.parent.type === 'array') {
                        let taskNode = <Parser.ArrayASTNode>grandparent.parent;

                        if (taskNode.location === 'tasks') {
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
}


export function matchOffsetToDocument(offset: number, jsonDocuments: Parser.JSONDocument): SingleYAMLDocument {
    for (let index in jsonDocuments.documents) {
        let doc = jsonDocuments.documents[index];

        if (doc.root && doc.root.end >= offset && doc.root.start <= offset) {
            return doc;
        }
    }
}