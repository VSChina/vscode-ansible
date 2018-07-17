'use strict';

export interface SSHServer {
    host: string,
    port: number,
    user: string,
    password: string,
    key: string,
    passphrase: string
};


export interface FileCopyConfig {
    server: string,
    sourcePath: string,
    targetPath: string,
    copyOnSave: boolean
}

export type FileCopyConfigs = FileCopyConfig[];