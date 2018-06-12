"use strict";

import * as request from "request-promise";
import { AzureSession, CloudShell } from "./azure-account.api";


const consoleApiVersion = '2017-08-01-preview';


export interface UserSettings {
	preferredLocation: string;
	preferredOsType: string; // The last OS chosen in the portal.
	storageProfile: any;
}

export async function getUserSettings(accessToken: string, armEndpoint: string): Promise<UserSettings | undefined> {
	const targetUri = `${armEndpoint}/providers/Microsoft.Portal/userSettings/cloudconsole?api-version=${consoleApiVersion}`;
	const response = await request({
		uri: targetUri,
		method: 'GET',
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${accessToken}`
		},
		simple: false,
		resolveWithFullResponse: true,
		json: true,
	});

	if (response.statusCode < 200 || response.statusCode > 299) {
		return;
	}

	return response.body && response.body.properties;
}

async function getStorageAccountKey(accessToken: string, subscriptionId: string, resourceGroup: string, storageAccountName: string): Promise<string | undefined> {
    const response = await request({
        uri: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Storage/storageAccounts/${storageAccountName}/listKeys?api-version=2017-06-01`,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
        },
        simple: false,
        resolveWithFullResponse: true,
        json: true,
    });

    if (response.statusCode < 200 || response.statusCode > 299) {
        return;
    }

    return response.body && response.body.keys && response.body.keys[0] && response.body.keys[0].value;
}


export interface IStorageAccount {
	resourceGroup: string;
	storageAccountName: string;
	fileShareName: string;
	storageAccountKey: string;
}

export async function getStorageAccountforCloudShell(cloudShell: CloudShell): Promise<IStorageAccount | undefined> {
	const session: AzureSession = await cloudShell.session;
	const token: IToken = await acquireToken(session);
	const userSettings: IUserSettings | undefined = await getUserSettings(token.accessToken, session.environment.resourceManagerEndpointUrl);
	if (!userSettings) {
		return;
	}
	const storageProfile: any = userSettings.storageProfile;
	const storageAccountSettings: any = storageProfile.storageAccountResourceId.substr(1, storageProfile.storageAccountResourceId.length).split("/");
	const storageAccountKey: string | undefined = await getStorageAccountKey(token.accessToken, storageAccountSettings[1], storageAccountSettings[3], storageAccountSettings[7]);

	if (!storageAccountKey) {
		return;
	}

	return {
		resourceGroup: storageAccountSettings[3],
		storageAccountName: storageAccountSettings[7],
		fileShareName: storageProfile.fileShareName,
		storageAccountKey
	};
}

interface IUserSettings {
	preferredLocation: string;
	preferredOsType: string; // The last OS chosen in the portal.
	storageProfile: any;
}

interface IToken {
	session: AzureSession;
	accessToken: string;
	refreshToken: string;
}

async function acquireToken(session: AzureSession): Promise<IToken> {
	return new Promise<IToken>((resolve, reject) => {
		const credentials: any = session.credentials;
		const environment: any = session.environment;
		credentials.context.acquireToken(environment.activeDirectoryResourceId, credentials.username, credentials.clientId, (err: any, result: any) => {
			if (err) {
				reject(err);
			} else {
				resolve({
					session,
					accessToken: result.accessToken,
					refreshToken: result.refreshToken,
				});
			}
		});
	});
}