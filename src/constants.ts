export class Constants {
    public static ExtensionId = 'vscoss.vscode-ansible';
    public static LineSeperator = Array(50).join('=');
    public static AzureAccountExtensionId = 'ms-vscode.azure-account';
    public static DockerImageName = 'microsoft/ansible:ubuntu1604';
    public static AnsibleTerminalName = 'Ansible';
    public static UserAgentName = 'VSCODEEXT_USER_AGENT';
    public static Config_cloudShellConfirmed = 'cloudShellConfirmed';
    public static Config_credentialConfigured = 'credentialsConfigured';
    public static Config_credentialsFile = 'credentialsFile';
    public static Config_terminalInitCommand = 'terminalInitCommand';
}

export enum CloudShellErrors {
    AzureAccountNotInstalled = 'azure account not installed',
    NodeJSNotInstalled = 'nodeJS not installed',
    AzureNotSignedIn = 'azure not signed in',
    NotSetupFirstLaunch = 'cloud shell not setup for first launch',
    ProvisionFailed = 'cloud shell provision failed'
}

export enum CloudShellStatus {
    Init = 'init',
    Succeeded = 'succeeded',
    Failed = 'failed'
}