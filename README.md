[![Travis CI](https://travis-ci.org/VSChina/vscode-ansible.svg?branch=master)](https://travis-ci.org/VSChina/vscode-ansible)
[![AppVeyor](https://ci.appveyor.com/api/projects/status/kq11m16pl22k29un?svg=true)](https://ci.appveyor.com/project/yungez/vscode-ansible)
[![Marketplace Version](https://vsmarketplacebadge.apphb.com/version/vscoss.vscode-ansible.svg "Current Release")](https://marketplace.visualstudio.com/items?itemName=vscoss.vscode-ansible)

# Visual Studio Code extension for [Ansible](https://www.ansible.com/)

## Table of Content
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Usage](#usage) 
   - [Auto completion](#auto-completion)
   - [Code Snippets](#code-snippets)
   - [Run Ansible playbook](#run-ansible-playbook) 
       - [Run Playbook in Docker](#run-playbook-in-docker)
       - [Run Playbook in Local Ansible](#run-playbook-in-local-ansible)
       - [Run Playbook in Cloud Shell](#run-playbook-in-cloud-shell)
       - [Run Playbook Remotely via ssh](#run-playbook-remotely-via-ssh)
- [Configuration](#configuration)
- [Feedback and Questions](#feedback-and-questions)
- [License](#license)
- [Telemetry](#telemetry)
- [Contributing](#contributing)


## Features

  - Auto completion. Auto completion Ansible directives, modules and plugins from Ansible doc, Auto completion for variables. Disable auto completion by setting `ansible.autocompletion` to `false`.
  - Code snippets.  Press `Ctrl + Space`, Ansible playbook code snippets will show up.
  - Syntax highlighting.
  - Code navigation by Symbols, press `Ctrl + Shift + O`.
  - Hover over module names, to show module documentation. Disable hovering over by setting `ansible.hover` to `false`.
  - Run playbook from Docker.
  - Run playbook from local Ansible installation.
  - Run playbook from [Cloud Shell](https://azure.microsoft.com/en-us/features/cloud-shell/). 
  - Run playbook remotely via ssh.


## Prerequisites

|platform|prerequisite|
|--------|-----------|
|Run Playbook in Cloud Shell/Remotely via ssh| nodejs >= 6.0 |
|Run Playbook in Docker|Docker|
|Run Playbook in Local Ansible| Ansible |

## Usage
### Auto completion
### Code snippets  
Press `Ctrl + Space` in playbook yml file, you'll see Ansible modules code snippets. Then press `tab` to move inside snippet parameters. 
![auto completion and code snippets](./images/authoring.gif)

### Run Ansible playbook   
  4 methods are supported to run Ansible playbook: 
  - [Docker](#run-playbook-in-docker).
  - [Local Ansible installation](#run-playbook-in-local-ansible).
  - [Cloud Shell](#run-playbook-in-cloud-shell).
  - [Remotely via ssh](#run-playbook-remotely-via-ssh).

    ![run playbook](./images/menu.png)
  
#### Run Playbook in Docker
1. Make sure Docker is installed and running. For non-Windows platform, please configure Docker run without sudo.
1. For Windows user, please share your Windows driver where vscode workspace sits on with docker. This is because the extension will map your workspace containing playbook with docker.   
![docker share driver](./images/dockerconfig.png)
1. This step is optional. If you want to run cloud provider specific Ansible modules, you need set cloud credentials in credential yaml file, default path is `$HOME/.vscode/ansible-credentials.yml`, or change credential file path by settings item  `ansible.credentialsFile`. Credential file template is at [here](https://github.com/VSChina/vscode-ansible/blob/master/config/credentials.yml).    
1. Press `F1`, type: `ansible`, choose `Run Ansible Playbook in Docker`. Or right click playbook yaml file, choose `Run Ansible Playbook in Docker`.
1. Input playbook file full path, or use default one.

           
    ***NOTE***  
    - Docker on Windows is not as stable as on other platforms, please try to restart Docker in case of any issue.
    - Downloading Docker image first time usage may be time consuming in case of slow network connection.

#### Run Playbook in Local Ansible
1. Make sure Ansible is installed.
1. This step is optional. If you want to run cloud provider specific Ansible modules, please setup cloud credentials by following [Ansible instruction](http://docs.ansible.com/ansible/latest/guides.html). Or you can set cloud credentials in credential yaml file, default path is `$HOME/.vscode/ansible-credentials.yml`, or change credential file path by settings item  `ansible.credentialsFile`. Credential file template is at [here](https://github.com/VSChina/vscode-ansible/blob/master/config/credentials.yml).  
1. Press `F1`, type: `ansible`, choose `Run Ansible Playbook in Local Ansible`. Or right click playbook yaml file, choose `Run Ansible Playbook in Local Ansible`.



#### Run Playbook in Cloud Shell
1. **Important** Please setup Cloud Shell for first time usage in Azure Portal by following [this instruction](https://docs.microsoft.com/en-us/azure/cloud-shell/overview). After setup, input cmd `az account show` to learn your current subscription setting.
1. Install [Azure Account](https://marketplace.visualstudio.com/items?itemName=ms-vscode.azure-account) VSCode extension, which is used for Azure login.
1. Press `F1`, type: `Azure: Sign In`, do Azure login.
1. Press `F1`, type: `ansible`, choose `Run Ansible Playbook in Cloud Shell`. Or right click playbook yaml file, choose `Run Ansible Playbook in Cloud Shell`.
1. Input playbook file full path, or use default one.
1. Confirm awareness on Azure usage fee. Please refer to [this document](https://docs.microsoft.com/en-us/azure/cloud-shell/pricing) to learn more about Azure Cloud Shell pricing.
    
#### Run Playbook Remotely via ssh
1. Configure your remote server in `$HOME/.ssh/servers.json` like below. Or follow wizard to fill in server information.
   ```
   [
        {
            "host": "your host",
            "port": 22,
            "user": "your user name",
            "password": "your ssh password",
            "key": "your private key"
        }
   ]
   ```

## Configuration  
This extension provides below configurations in settings.json.


|Cnfig Name| Default Value| Description|
|--|--|--|
|`ansible.hover`| `true`| Enable/Disable hover over module name functionality. |
|`ansible.autocompletion` | `true` | Enable/Disable ansible autocompletion(including code snippets) functionality. To enable ansible autocompletion only in specific yaml files, set `ansible.autocompletion = false`, then add `# ansible-configured` header in first line of yaml file.|
|`ansible.credentialsFile` |`$HOME/.vscode/ansible-credentials.yml` |Specify ansible credentials file path, used when run playbook in Docker/Local Ansible. |
|`ansible.termininalInitCommand`|Default is `docker run` command for Docker, and `ansible-playbook` for local ansible.| Specify customized terminal init command when run playbook in Docker/Local Ansible. |


## Feedback and Questions
You can submit bug or feature suggestion via [issues](https://github.com/VSChina/vscode-ansible/issues/new).

## License
[MIT license](./LICENSE.md).

## Telemetry
This extension collects telemetry data to help improve our products. Please read [Microsoft privacy statement](https://privacy.microsoft.com/en-us/privacystatement) to learn more. If you opt out to send telemetry data to Microsoft, please set below configuration in settings.json:
```
telemetry.enableTelemetry = false
```

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us the rights to use your contribution. For details, visit https://cla.microsoft.com.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

Please see below documents to learn how to contribute:
- [How to build, run and debug from source](https://github.com/VSChina/vscode-ansible/wiki/How-to-Contribute)
- [Coding Guidelines](https://github.com/VSChina/vscode-ansible/wiki/Coding-Guidelines)


## Release Notes and Thank you
Please see our [releases](https://github.com/VSChina/vscode-ansible/releases) to see detail in each release, and `Thank you`. Or check [CHANGELOG](./CHANGELOG.md).
