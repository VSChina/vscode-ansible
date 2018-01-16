import * as fsextra from 'fs-extra';
import * as path from 'path';

const sourcefile = path.join(__dirname, '../snippets/ansible-data.json');
const targetfile = path.join(__dirname, '../snippets/codesnippets.json');

var data = <JSONData>JSON.parse(fsextra.readFileSync(sourcefile));

let codesnippets: Snippets = {};
if (data) {
    data.modules.map((module) => {
        let snippetBody = <SnippetBody>{
            prefix: module.module + '_snippet',
            description: module.short_description,
            body: [
                module.module + ':'
            ]
        };

        let options;
        if (module.options) {
            var sortedOptions = sortOptions(module.options);
            options = Object.keys(sortedOptions);

            for (let i = 0; i < options.length; i++) {
                let optionName = options[i];
                let option = sortedOptions[optionName];
                let required = option.required ? 'required' : 'not required';

                if (optionName && optionName !== '') {
                    var text = '  ' + optionName + ': ';


                    if (option.choices) {
                        text += '${' + (i + 1) + '|' + option.choices.join(',') + '|}';
                    } else {
                        text += '${' + (i + 1) + ':' + option.default + '}';
                    }

                    text += ' # ' + required + '.';

                    if (option.choices) {
                        text += ' choices: ' + option.choices.join(';') + '.';
                    }

                    text += ' ' + option.description;

                    snippetBody.body.push(text);
                }
            }

        }
        codesnippets[module.module] = snippetBody;
    });
}

fsextra.writeFileSync(targetfile, JSON.stringify(codesnippets, null, 2));

function sortOptions(optionsDic: DirectiveOptions): DirectiveOptions {
    var result: DirectiveOptions = {};

    for (let optionName of Object.keys(optionsDic)) {
        let option = optionsDic[optionName];

        if (option.required) {
            result[optionName] = option;
        }
    }

    for (let optionName of Object.keys(optionsDic)) {
        let option = optionsDic[optionName];

        if (!option.required) {
            result[optionName] = option;
        }
    }
    return result;

}

export interface SnippetBody {
    prefix: string,
    body: string[],
    description: string;
}

export type Snippets = { [key: string]: SnippetBody };

export interface Directive {
    module: string;
    deprecated?: string;
    short_description: string;
    options: DirectiveOptions;
}

export interface DirectiveOption {
    default: string;
    required: boolean;
    description: string[];
    choices?: string[];
    suboptions: DirectiveOptions;
}

export type DirectiveOptions = { [key: string]: DirectiveOption };

export type Directives = { [key: string]: string[] };

export type Modules = Directive[];
export type LookupPlugins = string[];

export interface JSONData {
    modules: Modules;
    directives: Directives;
    lookup_plugins: LookupPlugins;
}
