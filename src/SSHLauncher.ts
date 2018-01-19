'use strict';
import * as ssh from 'ssh2';
import * as fs from 'fs-extra';

async function connectTerminal(host: string, port: string, user: string, password: string, key: string) {
    console.log('Connecting host ' + host + '...');

    var conn = new ssh.Client();
    conn.on('ready', () => {

        conn.shell((err, stream) => {

            if (err) {
                process.stdout.write('ssh failed to start shell: ' + err);

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

    }).on('error', (err) => {
        process.stdout.write('ssh error: ' + err);

    }).on('end', () => {
        process.stdout.write('ssh connection end.');

    }).on('close', (hasError) => {
        process.stdout.write('ssh connection close.');

    }).connect({
        host: host,
        port: port,
        username: user,
        password: password,
        key: key,
        keepaliveInternal: 4000
    });

}

export async function runInTerminal(host: string, port: string, user: string, password: string, key: string) {
    process.stdin.setRawMode!(true);
    process.stdin.resume();

    return connectTerminal(host, port, user, password, key);
}

export function main() {
    const host = process.env.SSH_HOST!;
    const port = process.env.SSH_PORT!;
    const user = process.env.SSH_USER!;
    const password = process.env.SSH_PASSWORD!;
    const key = process.env.SSH_KEY!;
    return runInTerminal(host, port, user, password, key)
        .catch(console.error);
}
