'use strict'

import * as vscode from 'vscode';
import * as path from 'path';

var terminals = [];

vscode.window.onDidCloseTerminal(function (terminal) {
    if (terminals === undefined)
        return;
    if (terminals[terminal.name])
    {
        delete terminals[terminal.name];
    }
})

export function startTerminal(terminalName, cb) {
    if (terminals === undefined || terminals[terminalName] === undefined) {
            // check if terminal is configured -- if not, set default configuration
        let cmd: string = vscode.workspace.getConfiguration('ansible').get('terminalInitCommand')
        
        if (cmd === "default") {
            if (process.platform === 'win32') {
                let pthSplit =  vscode.workspace.rootPath.split(path.sep);
                pthSplit.shift();
                let pth = path.posix.sep + pthSplit.join(path.posix.sep);

                cmd = "docker run --rm -it -v $workspace:$path --workdir $path dockiot/ansible bash";
                cmd = cmd.replace('$workspace', vscode.workspace.rootPath);
                cmd = cmd.replace('$path', pth);
                cmd = cmd.replace('$path', pth);
            } else {
                // for anything else than windows, just use default terminal by default
                cmd = "";
            }
        }

        var terminal = vscode.window.createTerminal(terminalName);
        
        terminals[terminalName] = terminal;

        // Note on launching command in the terminal:
        // In theory we could use second and third parameter of createTerminal() function to pass command and parameters.
        // That can work well on macOS and Linux, but on windows there are several problems:
        // (1) Third parameter doesn't work
        // (2) we could create xxx.bat file instead and just launch cmd via this file, but depending on version of
        //     Visual Studio Code (32bit / 64bit) bat file will be executed either in 32 or 64 bit PowerShell.
        //     In 32bit PowerShell locations of binaries may be different, for example:
        //       C:\WINDOWS\Sysnative\bash.exe in 32bit PS
        //       C:\WINDOWS\System32\bash.exe in 64bit PS
        //    (docker.exe is available from both x86 and x64)
        if (cmd != "") {
            terminal.show();
            terminal.sendText(cmd);

            setTimeout(function() {
                cb();
            }, 3000)

            return;
        }
    }
    terminals[terminalName].show();
    cb();
}

export function runInTerminal(commands, terminal) {
    
    startTerminal(terminal, function() {
        commands.forEach(element => {
            terminals[terminal].sendText(element);
        });    
    });
}
