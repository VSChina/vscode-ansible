'use strict';

import { TextDocument, SymbolInformation, SymbolKind, Location, Range, Position } from "vscode-languageserver/lib/main";
import * as jsonParser from 'vscode-json-languageservice/lib/umd/parser/jsonParser';
import { parse } from "path";


export class YamlDocumentSymbols {

    public findDocumentSymbols(document: TextDocument, doc: jsonParser.JSONDocument): SymbolInformation[] {
        if (!doc || doc['documents'].length === 0) {
            return null;
        }

        let results: SymbolInformation[] = [];
        for (let yamlDoc in doc['documents']) {
            let currentYamlDoc = doc['documents'][yamlDoc];
            if (currentYamlDoc.root) {
                results = results.concat(this.parseSymbols(document, currentYamlDoc.root, void 0));
            }
        }
        return results;
    }

    private parseSymbols(document: TextDocument, node: jsonParser.ASTNode, containerName: string): SymbolInformation[] {
        var results: SymbolInformation[] = [];
        if (node.type === 'array') {
            (<jsonParser.ArrayASTNode>node).items.forEach((node: jsonParser.ASTNode) => {
                results = results.concat(this.parseSymbols(document, node, containerName));
            });
        } else if (node.type === 'object') {
            let objectNode = <jsonParser.ObjectASTNode>node;

            objectNode.properties.forEach((property: jsonParser.PropertyASTNode) => {
                let location = Location.create(document.uri, Range.create(document.positionAt(property.start), document.positionAt(property.end)));
                let valueNode = property.value;
                if (valueNode) {
                    results.push({ name: property.key.getValue(), kind: SymbolKind.Variable, location: location, containerName: containerName });
                    let childContainerName = containerName ? containerName + '.' + property.key.value : property.key.value;
                    results = results.concat(this.parseSymbols(document, valueNode, childContainerName));
                }
            })
        }
        return results;
    }
}