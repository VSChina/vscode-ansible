'use strict';

import * as storage from 'azure-storage';
import { FileService } from 'azure-storage';
import * as path from 'path';

const DIRECTORY_NAME = 'ansible-playbooks';

export async function uploadFilesToAzureStorage(localFileName: string, storageAccountName: string, storageAccountKey: string, fileShareName: string): Promise<void> {
    const client = storage.createFileService(storageAccountName, storageAccountKey);

    try {
        await createFileShare(client, fileShareName);
    } catch (err) {
        console.log('Failed to create FileShare ' + fileShareName + ', detail ' + err);
    }

    try {
        await createDirectory(client, fileShareName, DIRECTORY_NAME);
    } catch (err) {
        console.log('Failed to create directory: ' + DIRECTORY_NAME + ', detail ' + err);
    }

    try {
        await createFile(client, fileShareName, DIRECTORY_NAME, path.basename(localFileName), localFileName);
    } catch (err) {
        console.log('Failed to create file: ' + path.basename(localFileName) + ', detail' + err);
    }
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