export interface Logger {
    debugEnabled: Boolean

    log(...messages: string[] | number[] | Object[]): void
    warn(...messages: string[] | number[] | Object[]): void
    error(...messages: string[] | number[] | Object[]): void
    debug(...messages: string[] | number[] | Object[]): void
}

export class ConsoleLogger implements Logger {
    public debugEnabled: Boolean = false;

    log(...messages: string[] | number[] | Object[]) {
        for (let message of messages) {
            console.log(new Date().toLocaleString(), '-', 'INFO' + ":", message)
        }
    }

    warn(...messages: string[] | number[] | Object[]) {
        for (let message of messages) {
            console.log(new Date().toLocaleString(), '-', 'WARN' + ":", message)
        }
    }

    error(...messages: string[] | number[] | Object[]) {
        for (let message of messages) {
            console.log(new Date().toLocaleString(), '-', 'ERR' + ":", message)
        }
    }

    debug(...messages: string[] | number[] | Object[]) {
        if (this.debugEnabled) {
            for (let message of messages) {
                console.log(new Date().toLocaleString(), '-', 'DEBUG' + ":", message)
            }
        }
    }
}
