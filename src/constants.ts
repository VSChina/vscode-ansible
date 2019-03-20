export class Constants {
    public static ExtensionId = 'vscoss.vscode-ansible';
    public static LineSeperator = Array(50).join('=');
    public static AzureAccountExtensionId = 'ms-vscode.azure-account';
    public static DockerImageName = 'microsoft/ansible:latest';
    public static AnsibleTerminalName = 'Ansible';
    public static UserAgentName = 'VSCODEEXT_USER_AGENT';
    public static Config_cloudShellConfirmed = 'cloudShellConfirmed';
    public static Config_credentialConfigured = 'credentialsConfigured';
    public static Config_credentialsFile = 'credentialsFile';
    public static Config_dockerImage = 'dockerImage';
    public static Config_useWSL = 'useWSL';
    public static Config_terminalInitCommand = 'terminalInitCommand';
    public static Config_fileCopyConfig = 'fileCopyConfig';
    public static GitHubApiHost = 'api.github.com';
    public static GitHubRawContentHost = 'raw.githubusercontent.com';
    public static AzureQuickStartTemplates = 'Azure/azure-quickstart-templates';
    public static AzureManagementApiHost = 'management.azure.com';
    public static NotShowThisAgain = "NotShowThisAgain";
}

export enum CloudShellErrors {
    AzureAccountNotInstalled = 'azure account not installed',
    NodeJSNotInstalled = 'nodeJS not installed',
    AzureNotSignedIn = 'azure not signed in',
    NotSetupFirstLaunch = 'cloud shell not setup for first launch',
    ProvisionFailed = 'cloud shell provision failed'
}

export enum CloudShellConnectionStatus {
    Init = 'init',
    Succeeded = 'succeeded',
    Failed = 'failed'
}