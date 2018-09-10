'use strict';

import * as storage from 'azure-storage';
import { FileService } from 'azure-storage';
import * as path from 'path';
import { Client } from '_debugger';

const DIRECTORY_NAME = 'ansible-playbooks';

export function uploadFilesToAzureStorage(localFileName: string, storageAccountName: string, storageAccountKey: string, fileShareName: string): Promise<void> {
    const fileClient = storage.createFileService(storageAccountName, storageAccountKey);
    const client = createFileServiceWithSAS(fileClient, getStorageHostUri(storageAccountName), fileShareName);
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

function createFileServiceWithSAS(fileService: storage.FileService, hostUri: string, shareName: string): storage.FileService {
    let sas = fileService.generateSharedAccessSignature(shareName, '', null, readWriteSharePolicy);
    var fileServiceWithShareSas = storage.createFileServiceWithSas(hostUri, sas);
    return fileServiceWithShareSas;
}

function getStorageHostUri(accountName: string): string {
    return "https://" + accountName + ".file.core.windows.net";
}
const readWriteSharePolicy = {
    AccessPolicy: {
      Permissions: 'rw',
      Expiry: new Date('9999-10-01')
    }
  };
  
  var readCreateSharePolicy = {
    AccessPolicy: {
      Permissions: 'rc',
      Expiry: new Date('9999-10-01')
    }
  };

  var filePolicy = {
    AccessPolicy: {
      Permissions: 'd',
      Expiry: new Date('9999-10-10')
    }
  };