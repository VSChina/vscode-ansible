'use strict';

import { IConnection, createConnection, TextDocuments, InitializeParams, InitializeResult, RequestType, TextDocument } from 'vscode-languageserver';
import { LanguageService, LanguageSettings } from 'yaml-language-server/out/server/src/languageservice/yamlLanguageService';
import { parse as parseYAML } from 'yaml-language-server/out/server/src/languageservice/parser/yamlParser';
import { removeDuplicatesObj } from 'yaml-language-server/out/server/src/languageservice/utils/arrUtils';
import { URI } from 'yaml-language-server/out/server/src/languageservice/utils/uri';
import { CustomSchemaContentRequest } from 'yaml-language-server/out/server/src/server';
import { getLanguageService, ClientSettings } from './yamlLanguageService';

import { xhr, XHRResponse, configure as configureHttpRequests, getErrorStatusDescription } from 'request-light';
import * as fs from 'fs-extra';
import * as path from 'path';


export interface Settings {
    ansible: {
        credentialsFile: string,
        terminalInitCommand: string,
        credentialsConfigured: boolean,
        cloudShellConfirmed: boolean,
        hover: boolean,
        validation: boolean
    }
}

let connection: IConnection = createConnection();

let documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let enableHover = true;
let enableValidation = true;
connection.onInitialize((params: InitializeParams): InitializeResult => {
    let capabilities = params.capabilities;
    let workspaceFolders = params['workspaceFolders'];
    let workspaceRoot = params.rootPath;

    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            hoverProvider: true,
            documentSymbolProvider: true
        }
    }

});

connection.onDocumentSymbol((documentSymbolParms) => {
    let document = documents.get(documentSymbolParms.textDocument.uri);

    try {
        let jsonDocument = parseYAML(document.getText());

        if (jsonDocument) {
            return languageService.findDocumentSymbols(document, jsonDocument);
        }
    } catch (err) {
        //connection.console.log('Unable to parse Symbols: invalid yaml file.');
    }
});

connection.onHover((textDocumentPositionParams) => {
    let document = documents.get(textDocumentPositionParams.textDocument.uri);
    try {
        let jsonDocument = parseYAML(document.getText());

        if (jsonDocument) {
            return languageService.doHover(document, textDocumentPositionParams.position, jsonDocument);
        }
    } catch (err) {
        // connection.console.log('Unable to hover over: invalid yaml file.');
    }
});

connection.onDidChangeConfiguration((didChangeConfigurationParams) => {
    var clientSettings = <Settings>didChangeConfigurationParams.settings;

    enableHover = clientSettings.ansible.hover;
    enableValidation = clientSettings.ansible.validation;
    updateConfiguration();
})

connection.listen();


let schemaRequestService = (uri: string): Thenable<string> => {
    if (uri.startsWith('file://')) {
        let fsPath = uri;
        return new Promise<string>((c, e) => {
            fs.readFile(fsPath, 'UTF-8', (err, result) => {
                err ? e('') : c(result.toString());
            });
        });
    } else if (uri.startsWith('vscode://')) {
        return connection.sendRequest(VSCodeContentRequest.type, uri).then(responseText => {
            return responseText;
        }, error => {
            return error.message;
        });
    } else {
        let scheme = URI.parse(uri).scheme.toLowerCase();
        if (scheme !== 'http' && scheme !== 'https') {
            // custom scheme
            return <Thenable<string>>connection.sendRequest(CustomSchemaContentRequest.type, uri);
        }
    }
    if (uri.indexOf('//schema.management.azure.com/') !== -1) {
        connection.telemetry.logEvent({
            key: 'json.schema',
            value: {
                schemaURL: uri
            }
        });
    }
    let headers = { 'Accept-Encoding': 'gzip, deflate' };
    return xhr({ url: uri, followRedirects: 5, headers }).then(response => {
        return response.responseText;
    }, (error: XHRResponse) => {
        return null;
    });
};

let workspaceContext = {
    resolveRelativePath: (relativePath: string, resource: string) => {
        return path.resolve(resource, relativePath);
    }
};

export let languageService = getLanguageService(
    schemaRequestService,
    workspaceContext,
    {
        hover: enableHover,
        validation: enableValidation
    }
);


function hasClientCapability(params: InitializeParams, ...keys: string[]) {
    let c = params.capabilities;
    for (let i = 0; c && i < keys.length; i++) {
        c = c[keys[i]];
    }
    return !!c;
}

namespace VSCodeContentRequest {
    export const type: RequestType<{}, {}, {}, {}> = new RequestType('vscode/content');
}

function updateConfiguration() {
    let clientSetting: ClientSettings = {
        hover: enableHover,
        validation: enableValidation
    };

    let settings: LanguageSettings = {
        schemas: [],
        validate: enableValidation
    }
    languageService.configure(settings, clientSetting);
    documents.all().forEach(triggerValidation);
}

documents.onDidChangeContent((textDocumentChangeEvent) => {
    try {
        triggerValidation(textDocumentChangeEvent.document);
    } catch {
    }
});

documents.onDidClose(textDocumentChangeEvent => {
    try {
        cleanPendingValidation(textDocumentChangeEvent.document);
        connection.sendDiagnostics({ uri: textDocumentChangeEvent.document.uri, diagnostics: [] });
    } catch {
    }
});

let pendingValidationRequests: { [uri: string]: NodeJS.Timer; } = {};
const validationDelayMs = 200;

function cleanPendingValidation(textDocument: TextDocument): void {
    try {
        let request = pendingValidationRequests[textDocument.uri];
        if (request) {
            clearTimeout(request);
            delete pendingValidationRequests[textDocument.uri];
        }
    } catch {

    }
}

function triggerValidation(textDocument: TextDocument): void {
    try {
        cleanPendingValidation(textDocument);
        pendingValidationRequests[textDocument.uri] = setTimeout(() => {
            delete pendingValidationRequests[textDocument.uri];
            validateTextDocument(textDocument);
        }, validationDelayMs);
    }
    catch {
    }
}

function validateTextDocument(textDocument: TextDocument): void {

    if (!textDocument) {
        return;
    }

    if (textDocument.getText().length === 0) {
        return;
    }

    let yamlDocument = parseYAML(textDocument.getText(), []);
    if (!yamlDocument) {
        return;
    }
    languageService.doValidation(textDocument, yamlDocument).then((diagnosticResults) => {

        if (!diagnosticResults) {
            return;
        }
        let diagnostics = [];
        for (let diagnosticItem in diagnosticResults) {
            diagnosticResults[diagnosticItem].severity = 1; //Convert all warnings to errors
            diagnostics.push(diagnosticResults[diagnosticItem]);
        }

        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: removeDuplicatesObj(diagnostics) });
    }, (error) => { });
}