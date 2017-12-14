'use strict'

var fs = require("fs-extra");
var readline = require("readline");
var yaml = require('js-yaml');
import { Readable } from "stream";
import { StringDecoder } from 'string_decoder';

import * as cp from 'child_process';

function parseAllModules() {
    let collected = "";
    function outputHandler(data) {
        collected += data;
    }

    var r = new CliRunner(outputHandler);
    
    r.execute("ansible-doc", [ "-l" ], false, false, function (result) {

        let rows: string[] = result.split("\n");
        let modules: string[] = [];

        for (var l of rows) {
            let a: string[] = l.split(/\s+/);

            // just Azure for now
            //if (a[0].startsWith("azure_rm_")) {
                modules.push(a[0]);
            //}    
        }

        parseNextModule(modules);
    });    
}

var jsonOutput: any = {};

function parseNextModule(modules: string[]) {
    if (modules.length == 0 || modules[0].trim() == "") {
        fs.writeFileSync('data.json', JSON.stringify(jsonOutput, undefined, 2) , 'utf-8');
        return;
    }

    let collected = "";
    function outputHandler(data) {
        collected += data;
    }

    var r = new CliRunner(outputHandler);

    process.stdout.write("------- getting module " + modules[0] + "\n");

    r.execute("ansible-doc", [ modules[0] ], false, false, function (result) {
        //process.stdout.write("------- got module\n" + result);
        let rows: string[] = result.split("\n");
        var parsingExamples = false;
        var parsingExample = false;
        var example = [];
        var header = "";
        let idx = 0;
        
        for (var l of rows) {
            //process.stdout.write("line: " + l + "\n");
            if (!parsingExamples) {
                if (l.startsWith("EXAMPLES:")) {
                    process.stdout.write("------ found example section\n");
                    parsingExamples = true;
                    idx = 0;
                }
            } else if (!parsingExample) {
                if (l.startsWith("#")) {
                    header += l;
                } else if (l.startsWith("-")) {
                    parsingExample = true;
                    idx++;
                    example.push(l);
                } else {
                    parsingExamples = false;
                }
            } else {
                if (l.startsWith(" ")) {
                    example.push(l);
                } else {
                    let snippet: any = {};
                    
                    try
                    {
                        var obj = yaml.safeLoad(example.join("\n"));
                        var tmp = yaml.safeDump(obj);
                        tmp = tmp.split("  ").join("\t");
                        example = tmp.split("\n");

                        try {
                            header = obj[0].name;
                        } catch (e) {}

                        process.stdout.write(">>> " + JSON.stringify(obj) + "\n");
                        
                    }
                    catch (e) {
                        process.stdout.write("------parsing failed\n");
                        process.stdout.write(e + "\n");
                    }

                    snippet["prefix"] = modules[0] + "-" + idx;
                    snippet["description"] = header;
                    snippet["body"] = example;

                    jsonOutput[modules[0]] = snippet;

                    process.stdout.write("------example " + header + "\n");
                    process.stdout.write(JSON.stringify(snippet, undefined, 2));
                    process.stdout.write("\n-------\n");
                    example = [];
                    header = "";
                    parsingExample = false;
                }
            }
        }

        modules.shift();
        parseNextModule(modules);
    });            
}

export class CliRunner {

    /**
     * Constructor
     * 
     * @param outputHandler 
     */
    constructor(outputHandler) {
        this.m_OutputHandler = outputHandler;
    }

    /**
     * Execute command
     * 
     * @param params 
     * @param parse 
     * @param suppressOutput
     * @param cb 
     */
    public execute(cmd: string, params: string[], parse: boolean, suppressOutput: boolean, cb) {

        if (!suppressOutput) {
            this.m_OutputHandler(cmd + ' ' + params.join(' ') + '\n\n');
        }

        const child = cp.spawn(cmd, params);
        const stdout = this.collectData(child.stdout, 'utf8', 'Docker', suppressOutput);
        const stderr = this.collectData(child.stderr, 'utf8', 'Docker', suppressOutput);
        child.on('error', err => {
            cb(false);
        });

        child.on('close', code => {
            if (code) {
                cb(false);
            } else {
                // XXX - this parsing is only for 
                if (parse) {
                    var lines: string[] = stdout.join('').split(/\r?\n/);
                    var parsed: object[] = [];

                    // first line is a header, parse write
                    var header: string = lines.shift();
                    var startIdx: number = 0;
                    var headerIdx: number[] = [];
                    var headers: string[] = [];


                    while (startIdx < header.length) {
                        var endIdx: number = header.indexOf('  ', startIdx);
                        if (endIdx < 0) endIdx = header.length;
                        
                        // store data about header
                        headers.push(header.substring(startIdx, endIdx).trim().toLowerCase());
                        headerIdx.push(startIdx);

                        while (endIdx < header.length && header[endIdx] == ' ') endIdx++;
                        startIdx = endIdx;
                    }

                    // what's the longest?
                    headerIdx.push(256);

                    for (var i: number = 0; i < lines.length; i++) {
                        if (lines[i].trim() != '') {
                            var o: object = {};

                            for (var hidx: number = 0; hidx < headers.length; hidx++) {
                                o[headers[hidx]] = lines[i].substring(headerIdx[hidx], headerIdx[hidx + 1]).trim();
                            }

                            parsed.push(o);
                        }
                    }

                    cb({ headers: headers, rows: parsed});
                } else {
                    try {
                        var out = JSON.parse(stdout.join(''));
                        cb(out);
                    } catch (e) {
                        var r: string = stdout.join('');                        
                        cb(r ? r : true);
                    }
                }
            }
        });
    }

    /**
     * Collect data
     * 
     * @param stream 
     * @param encoding 
     * @param id 
     * @param cmds 
     */

    public  collectData(stream: Readable, encoding: string, id: string, suppressOutput: boolean = false): string[] {
        const data: string[] = [];
        const decoder = new StringDecoder(encoding);

        stream.on('data', (buffer: Buffer) => {
            var decoded: string = decoder.write(buffer);
            data.push(decoded);

            // just make a single string...
            data[0] = data.join('');
            data.splice(1);

            if (!suppressOutput) {
                this.m_OutputHandler(id, decoded);
            }
        });
        return data;
    }

    private m_OutputHandler = null;
}

parseAllModules();
