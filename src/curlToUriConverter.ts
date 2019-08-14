'use strict';

import * as vscode from 'vscode';
import * as curlconverter from 'curlconverter';
import * as clipboardy from 'clipboardy';
import { window } from 'vscode';

export class CurlToUriConverter {


    public convert() {
        let clipboard: string = clipboardy.readSync();

        if(clipboard.startsWith('curl')){
            let converted = curlconverter.toAnsible(clipboard)
            //replace the clipboard contents with the modified version...
            clipboardy.write(converted).then(() => {
                vscode.commands.executeCommand('editor.action.clipboardPasteAction')
            });
        } else {
            window.showErrorMessage(`Clipboard does not contain string starting with curl`);
        }
    }
}
