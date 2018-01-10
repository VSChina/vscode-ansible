'use strict';

export interface SSHServer {
    host: string,
    port: number,
    user: string,
    password: string,
    key: string
};
