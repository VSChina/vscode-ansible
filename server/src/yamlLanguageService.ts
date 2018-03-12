'use strict'

import { YamlDocumentSymbols } from './services/yamlDocumentSymbol';

import { LanguageServiceParams, YAMLDocument, SchemaRequestService, SchemaConfiguration, LanguageSettings } from 'vscode-yaml-languageservice/lib/yamlLanguageService';
import { parse } from 'vscode-yaml-languageservice/lib/parser/yamlParser';
import { format } from 'vscode-yaml-languageservice/lib/services/yamlFormatter';

import { JSONSchemaService } from 'vscode-json-languageservice/lib/umd/services/jsonSchemaService';
import { schemaContributions } from 'vscode-json-languageservice/lib/umd/services/configuration';
import { JSONValidation } from 'vscode-json-languageservice/lib/umd/services/jsonValidation';
import { JSONSchema } from 'vscode-json-languageservice/lib/umd/jsonSchema';

import { TextDocument, Diagnostic, CompletionItem, SymbolInformation, Position, CompletionList, Hover, TextEdit, FormattingOptions } from 'vscode-languageserver';
import { YAMLHover } from './services/yamlHover';

export function getLanguageService(schemaRequestService: SchemaRequestService, workspaceContext, clientSettings: ClientSettings, promiseConstructor?): LanguageService {
    let promise = promiseConstructor || Promise;

    let jsonSchemaService = new JSONSchemaService(schemaRequestService, workspaceContext, promise);
    jsonSchemaService.setSchemaContributions(schemaContributions);

    let hover = new YAMLHover(promise);
    let documentSymbol = new YamlDocumentSymbols();
    let jsonValidation = new JSONValidation(jsonSchemaService, promise);

    function doValidation(textDocument: TextDocument, yamlDocument: YAMLDocument) {
        var validate: (JSONDocument) => Thenable<Diagnostic[]> =
            jsonValidation.doValidation.bind(jsonValidation, textDocument)
        const validationResults = yamlDocument.documents.map(d => validate(d))
        const resultsPromise = promise.all(validationResults);
        return resultsPromise.then(res => (<Diagnostic[]>[]).concat(...res))
    }

    return {
        configure: (settings: LanguageSettings, clientSettings: ClientSettings) => {
            jsonSchemaService.clearExternalSchemas();
            if (settings.schemas) {
                settings.schemas.forEach(settings => {
                    jsonSchemaService.registerExternalSchema(settings.uri, settings.fileMatch, settings.schema);
                });
            }
            hover.configure(clientSettings.hover);
        },
        doValidation: doValidation,
        doResolve: void 0,
        doComplete: void 0,
        findDocumentSymbols: documentSymbol.findDocumentSymbols.bind(documentSymbol),
        doHover: hover.doHover.bind(hover)
    };
}

export interface ClientSettings {
    hover: boolean
};

export interface LanguageService {
    configure(settings: LanguageSettings, clientSettings: ClientSettings): void;
    doValidation(document: TextDocument, yamlDocument: YAMLDocument): Thenable<Diagnostic[]>;
    doResolve(item: CompletionItem): Thenable<CompletionItem>;
    doComplete(document: TextDocument, position: Position, doc: YAMLDocument): Thenable<CompletionList>;
    findDocumentSymbols(document: TextDocument, doc: YAMLDocument): SymbolInformation[];
    doHover(document: TextDocument, position: Position, doc: YAMLDocument): Thenable<Hover>;
}