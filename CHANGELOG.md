# Change Log
All notable changes to the "vscode-ansible" extension will be documented in this file.

## 0.5.2
#### Bug fixing/Improvements
- Update docker image and code snippets for Ansible 2.7.0.
- Improve docker flow message.

## 0.5.1
#### Bug fixing
- Fixing wrong configuration name. [PR 188](https://github.com/VSChina/vscode-ansible/pull/188)

## 0.5.0
#### New features
- New command `Samples for azure_rm_resource (PREVIEW)` to generate samples for azure_rm_resource module. [PR 178](https://github.com/VSChina/vscode-ansible/pull/178)

#### Bug fixing
- Syntax highlighting error for parameters after attribute. [Issue 181](https://github.com/VSChina/vscode-ansible/issues/181)
- Errors in output windows when editing yaml files. [Issue 179](https://github.com/VSChina/vscode-ansible/issues/179)

#### Thank you
@asinn826 for refining notification messages. [PR 180](https://github.com/VSChina/vscode-ansible/pull/180)

## 0.4.0
#### New features
- Customize docker image name. [PR 166](https://github.com/VSChina/vscode-ansible/pull/166), [Issue 163](https://github.com/VSChina/vscode-ansible/issues/163)
- Yaml Validation, by leveraging [Yaml language server](https://github.com/redhat-developer/yaml-language-server).

#### Bug fixing
- Storage 403 error when using Cloud Shell. [Issue 133](https://github.com/VSChina/vscode-ansible/issues/133)
- Comments not work with ansible language. [Issue 154](https://github.com/VSChina/vscode-ansible/issues/154), [Issue 165](https://github.com/VSChina/vscode-ansible/issues/165)
- Nested list of dictionaries not highlighted. [Issue 168](https://github.com/VSChina/vscode-ansible/issues/168)

#### Thank you
@muellerbe for fixing doc typo. [PR 164](https://github.com/VSChina/vscode-ansible/pull/164)

## 0.3.1
#### Bug fixing
- Fixed bug in ssh flow when no workspace.

## 0.3.0
#### New features
- Copy saved files automatically to remote host per configuration. [PR 138](https://github.com/VSChina/vscode-ansible/pull/138), [Issue 100](https://github.com/VSChina/vscode-ansible/issues/100), [Issue 120](https://github.com/VSChina/vscode-ansible/issues/120)
- Reuse SSH per configuration. [PR 130](https://github.com/VSChina/vscode-ansible/pull/130)
- Language Syntax per file association. [Issue 93](https://github.com/VSChina/vscode-ansible/issues/93)
- Custom ansible-playbook options.  [Issue 107](https://github.com/VSChina/vscode-ansible/issues/107)

#### Bug fixing/Improvement
- Fix ssh passphrase not working. [Issue 126](https://github.com/VSChina/vscode-ansible/issues/126)
- Update docker image tag to reflect ansible version. [Issue 113](https://github.com/VSChina/vscode-ansible/issues/93)
- Update cloud shell runner to use cloudshell API for provisioning and file uploading. [PR 124](https://github.com/VSChina/vscode-ansible/pull/124)
- Update code snippets/auto completion to latest Ansible 2.6.1 version. [PR 141](https://github.com/VSChina/vscode-ansible/pull/141)

## 0.1.5
Make below improvement:
- Cloud Shell terminal reusable. Issue #42.
- Show hover up document linking in role structure. Issue #88.
- Improve code snippets triggering, no need of `ctril + space`. Issue #90.
- Add new host option in run playbook via ssh command. Issue #96.
- Add configuration to enable/disable auto completion. Issue #93.


Thank you for reporting issue and provide valuable feedback!
- @azwanson for Issue #88, Issue #89.
- @moltar for Issue #90.
- @tristan947 for Issue #93.
- @zikalino for Issue #96.

## 0.1.4
Fix below issues/bugs:
- Issue #75 , #63 , #71 . Hover and symbol failed when yaml file format invalid.
- Issue #67 . Execute playbook in subfolder inside docker failed.
- Issue #77 . Execute playbook failed when workspace path contains white space.
- Issue #80 . When remote ssh server default directory is not home dir, executing playbook failed.

## 0.1.3
- Support running playbook remotely via SSH.
- Add yaml language server support to provide below playbook authoring experience: 
  - Code navigation by Symbols.
  - Hover over module names to show documentation link.
- Auto completion on variables
- Fixing bug in highlight comments.


## 0.1.2
- Support running playbook in menu context of playbook.
- Update Code snippets to show tab-stop.

## 0.1.0
- Initial release