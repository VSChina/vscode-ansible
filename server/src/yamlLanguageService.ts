'use strict'

import { YamlDocumentSymbols } from './services/yamlDocumentSymbol';

import { LanguageServiceParams, LanguageService, YAMLDocument, LanguageSettings } from 'vscode-yaml-languageservice/lib/yamlLanguageService';
import { parse } from 'vscode-yaml-languageservice/lib/parser/yamlParser';
import { format } from 'vscode-yaml-languageservice/lib/services/yamlFormatter';

import { JSONSchemaService } from 'vscode-json-languageservice/lib/services/jsonSchemaService';
import { schemaContributions } from 'vscode-json-languageservice/lib/services/configuration';
import { JSONValidation } from 'vscode-json-languageservice/lib/services/jsonValidation';
import { JSONSchema } from 'vscode-json-languageservice/lib/jsonSchema';

import { TextDocument, Diagnostic } from 'vscode-languageserver';
import { YAMLHover } from './services/yamlHover';

export function getLanguageService(params: LanguageServiceParams): LanguageService {
    let promise = params.promiseConstructor || Promise;

    let jsonSchemaService = new JSONSchemaService(params.schemaRequestService, params.workspaceContext, promise);
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
        configure: (settings: LanguageSettings) => {
            jsonSchemaService.clearExternalSchemas();
            if (settings.schemas) {
                settings.schemas.forEach(settings => {
                    jsonSchemaService.registerExternalSchema(settings.uri, settings.fileMatch, settings.schema);
                });
            };
            jsonValidation.configure(settings);
        },
        resetSchema: (uri: string) => jsonSchemaService.onResourceChange(uri),
        doValidation: doValidation,
        parseYAMLDocument: (document: TextDocument) => parse(document.getText()),
        doResolve: void 0,
        doComplete: void 0,
        findDocumentSymbols: documentSymbol.findDocumentSymbols.bind(documentSymbol),
        doHover: hover.doHover.bind(hover),
        format: format
    };
}