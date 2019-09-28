interface SystemAccessPointFlags {
    version: string
}

export interface SystemAccessPointAuthMethod {
    iterations: number
    salt: string
}

export interface SystemAccessPointUser {
    name: string
    jid: string
    enabled: boolean
    authmethods: {
        'SCRAM-SHA-1': SystemAccessPointAuthMethod
        'SCRAM-SHA-256': SystemAccessPointAuthMethod
    }
}

export interface SystemAccessPointSettings {
    flags: SystemAccessPointFlags
    users: SystemAccessPointUser[]
}
