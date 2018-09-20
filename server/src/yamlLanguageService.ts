'use strict'

import { YamlDocumentSymbols } from './services/yamlDocumentSymbol';
import { SchemaRequestService, YAMLDocument, LanguageSettings } from 'yaml-language-server/out/server/src/languageservice/yamlLanguageService';
import { YAMLValidation } from 'yaml-language-server/out/server/src/languageservice/services/yamlValidation';
import { JSONSchemaService } from 'yaml-language-server/out/server/src/languageservice/services/jsonSchemaService';
import { schemaContributions } from 'vscode-json-languageservice/lib/umd/services/configuration';

import { TextDocument, Diagnostic, SymbolInformation, Position, Hover } from 'vscode-languageserver';
import { YAMLHover } from './services/yamlHover';

export function getLanguageService(schemaRequestService: SchemaRequestService, workspaceContext, clientSettings: ClientSettings, promiseConstructor?): LanguageService {
    let promise = promiseConstructor || Promise;

    let jsonSchemaService = new JSONSchemaService(schemaRequestService, workspaceContext, null);
    jsonSchemaService.setSchemaContributions(schemaContributions);

    let hover = new YAMLHover(promise);
    let documentSymbol = new YamlDocumentSymbols();
    let yamlvalidation = new YAMLValidation(jsonSchemaService, promise);
    let languagesettings: LanguageSettings = {
        validate: clientSettings.validation
    };
    yamlvalidation.configure(languagesettings);

    return {
        configure: (settings: LanguageSettings, clientSettings: ClientSettings) => {
            jsonSchemaService.clearExternalSchemas();
            if (settings.schemas) {
                settings.schemas.forEach(settings => {
                    jsonSchemaService.registerExternalSchema(settings.uri, settings.fileMatch, settings.schema);
                });
            }
            hover.configure(clientSettings.hover);
            settings.validate = clientSettings.validation;
            yamlvalidation.configure(settings);
        },
        doValidation: yamlvalidation.doValidation.bind(yamlvalidation),
        findDocumentSymbols: documentSymbol.findDocumentSymbols.bind(documentSymbol),
        doHover: hover.doHover.bind(hover)
    };
}

export interface ClientSettings {
    hover: boolean,
    validation: boolean
};

export interface LanguageService {
    configure(settings: LanguageSettings, clientSettings: ClientSettings): void;
    doValidation(document: TextDocument, yamlDocument: YAMLDocument): Thenable<Diagnostic[]>;
    findDocumentSymbols(document: TextDocument, doc: YAMLDocument): SymbolInformation[];
    doHover(document: TextDocument, position: Position, doc: YAMLDocument): Thenable<Hover>;
}