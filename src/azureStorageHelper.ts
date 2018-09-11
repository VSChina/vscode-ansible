'use strict';

import * as storage from 'azure-storage';
import { FileService } from 'azure-storage';
import * as path from 'path';

const DIRECTORY_NAME = 'ansible-playbooks';
const startDate = new Date((new Date()).toUTCString());

export function uploadFilesToAzureStorage(localFileName: string, storageAccountName: string, storageAccountKey: string, fileShareName: string): Promise<void> {
    const client = createFileServiceWithSAS(storageAccountName, storageAccountKey, getStorageHostUri(storageAccountName));
    client.logger.level = storage.Logger.LogLevels.DEBUG;

    return createFileShare(client, fileShareName)
        .then(() => {
            return createDirectory(client, fileShareName, DIRECTORY_NAME);
        })
        .then(() => {
            return createFile(client, fileShareName, DIRECTORY_NAME, path.basename(localFileName), localFileName);
        })
        .catch((err) => { throw err; });
}

function createFileShare(client: FileService, fileShareName: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        client.createShareIfNotExists(fileShareName, (err, result, response) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    })
}

function createDirectory(client: FileService, fileShareName: string, dirname: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        client.createDirectoryIfNotExists(fileShareName, dirname, (err, result, response) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        })
    })
}

function createFile(client: FileService, fileShare: string, dirName: string, src: string, dest: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        client.createFileFromLocalFile(fileShare, dirName, src, dest, (err, result, response) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        })
    })
}

export function getCloudShellPlaybookPath(fileShareName: string, playbook: string): string {
    return './clouddrive/' + DIRECTORY_NAME + '/' + path.basename(playbook);
}

function createFileServiceWithSAS(storageAccountName: string, storageAccountKey: string, hostUri: string): storage.FileService {
    let sas = storage.generateAccountSharedAccessSignature(storageAccountName, storageAccountKey, sharePolicy);
    var fileServiceWithShareSas = storage.createFileServiceWithSas(hostUri, sas);
    return fileServiceWithShareSas;
}

function getStorageHostUri(accountName: string): string {
    return "https://" + accountName + ".file.core.windows.net";
}
const sharePolicy = {
    AccessPolicy: {
        Services: 'f',
        ResourceTypes: 'sco',
        Permissions: 'racupwdl',
        Start: startDate,
        Expiry: new Date('9999-10-01')
    }
};
