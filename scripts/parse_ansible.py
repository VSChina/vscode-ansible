#!/usr/bin/env python
# -*- coding: utf-8 -*-
import codecs
import json
import os

from ansible.cli.doc import DocCLI
from ansible.playbook import Play
from ansible.playbook.block import Block
from ansible.playbook.role import Role
from ansible.playbook.task import Task
from ansible.utils.display import Display
from ansible.plugins.loader import fragment_loader

try:
    from ansible.plugins.loader import lookup_loader, module_loader
    from ansible.utils import plugin_docs
    use_old_loader = False
    BLACKLIST_MODULES = plugin_docs.BLACKLIST['MODULE']
except ImportError:
    from ansible.plugins import lookup_loader, module_loader
    from ansible.utils import module_docs as plugin_docs
    use_old_loader = True
    BLACKLIST_MODULES = plugin_docs.BLACKLIST_MODULES

__path__ = os.path.dirname(__file__)
display = Display()
doc_cli = DocCLI([])

def get_module_list():
    module_list = set()
    module_paths = module_loader._get_paths()
    for path in module_paths:
        if use_old_loader:
            doc_cli.find_plugins(path, "module")
            module_list = doc_cli.plugin_list
        else:
            module_list.update(doc_cli.find_plugins(path, 'module'))
    return sorted(set(module_list))


def main():
    module_keys = ('module', 'short_description', 'options', 'deprecated', 'suboptions')
    result = {'modules': [], 'directives': {}, 'lookup_plugins': []}

    for module in get_module_list():
        print('module is: ' + module)
        if module in BLACKLIST_MODULES:
            continue
        filename = module_loader.find_plugin(module, mod_type='.py')
        if filename is None:
            continue
        if filename.endswith(".ps1"):
            continue
        if os.path.isdir(filename):
            continue
        try:
            doc = plugin_docs.get_docstring(filename, fragment_loader)[0]
            filtered_doc = {key: doc.get(key, None) for key in module_keys}
            result['modules'].append(filtered_doc)            
        except:
            pass

    for aclass in (Play, Role, Block, Task):
        aobj = aclass()
        name = type(aobj).__name__

        for attr in aobj.__dict__['_attributes']:
            if 'private' in attr and attr.private:
                continue
            direct_target = result['directives'].setdefault(attr, [])
            direct_target.append(name)
            if attr == 'action':
                local_action = result['directives'].setdefault(
                    'local_action', [])
                local_action.append(name)
    result['directives']['with_'] = ['Task']

    for lookup in lookup_loader.all():
        name = os.path.splitext(os.path.basename(lookup._original_path))[0]
        result['lookup_plugins'].append(name)

    fn = os.path.join(__path__, '../snippets/ansible-data.json')
    with codecs.open(fn, 'wb', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
