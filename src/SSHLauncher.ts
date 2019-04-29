'use strict';
import * as ssh from 'ssh2';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as ost from 'os';

async function connectTerminal(host: string, port: string, user: string, password: string, keyfile: string, passphrase: string) {
    const tempFile = path.join(ost.tmpdir(), 'vscodeansible-ssh-' + host + '.log');
    var connected = false;

    if (fs.existsSync(tempFile)) {
        fs.removeSync(tempFile);
    }

    console.log('Connecting host ' + host + '...');
    process.stdin.setEncoding('utf-8');

    var conn = new ssh.Client();

    conn.connect({
        host: host,
        port: parseInt(port),
        username: user,
        password: password,
        privateKey: keyfile ? fs.readFileSync(keyfile) : keyfile,
        passphrase: passphrase,
        keepaliveInterval: 4000
    });

    conn.on('error', (err) => {
        process.stdout.write('ssh error: ' + err);
    });

    conn.on('end', () => {
        process.stdout.write('ssh connection end.');

    });

    conn.on('close', (hasError) => {
        process.stdout.write('ssh connection close.');
    });

    conn.on('ready', () => {

        var sshShellOption = {
            cols: 200, rows: 30
        };
        conn.shell(sshShellOption, (err, stream) => {

            if (err) {
                process.stdout.write('ssh failed to start shell: ' + err);
            }

            if (!connected) {
                fs.writeFileSync(tempFile, 'connected: ' + host);
                connected = true;
            }

            stream.on('data', (data) => {
                process.stdout.write(String(data));

            }).on('close', () => {
                process.stdout.write('ssh stream closed');

            }).stderr.on('data', (err) => {
                process.stdout.write('ssh stderr: ' + err);

            });
            process.stdin.pipe(stream);

        });

    });
}

export async function runInTerminal(host: string, port: string, user: string, password: string, key: string, passphrase: string) {
    process.stdin.setRawMode!(true);
    process.stdin.resume();

    return connectTerminal(host, port, user, password, key, passphrase);
}

export function main() {
    const host = process.env.SSH_HOST!;
    const port = process.env.SSH_PORT!;
    const user = process.env.SSH_USER!;
    const password = process.env.SSH_PASSWORD!;
    const key = process.env.SSH_KEY!;
    const passphrase = process.env.SSH_PASSPHRASE!;
    return runInTerminal(host, port, user, password, key, passphrase)
        .catch(console.error);
}
