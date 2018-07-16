'use strict';

import { IConnection, createConnection, TextDocuments, InitializeParams, InitializeResult, RequestType, TextDocument } from 'vscode-languageserver';
import { } from './yamlLanguageService';
import { LanguageService, LanguageSettings } from 'vscode-yaml-languageservice/lib/yamlLanguageService';
import { parse as parseYAML } from 'vscode-yaml-languageservice/lib/parser/yamlParser';
import { getLanguageService, ClientSettings } from './yamlLanguageService';
//import { Settings } from './interfaces';

import { xhr, XHRResponse, configure as configureHttpRequests, getErrorStatusDescription } from 'request-light';
import * as fs from 'fs-extra';
import * as path from 'path';


export interface Settings {
    ansible: {
        credentialsFile: string,
        terminalInitCommand: string,
        credentialsConfigured: boolean,
        cloudShellConfirmed: boolean,
        hover: boolean
    }
}

let connection: IConnection = createConnection();

let documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let enableHover = true;
connection.onInitialize((params: InitializeParams): InitializeResult => {
    let capabilities = params.capabilities;
    let workspaceFolders = params['workspaceFolders'];
    let workspaceRoot = params.rootPath;

    let symbolSupport = hasClientCapability(params, 'workspace', 'symbol', 'dynamicRegistration');

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
        return Promise.reject(error.responseText || getErrorStatusDescription(error.status) || error.toString());
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
        hover: enableHover
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
        hover: enableHover
    };

    let settings: LanguageSettings = {
        schemas: [],
    }
    languageService.configure(settings, clientSetting);

}