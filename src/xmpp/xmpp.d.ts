declare module '@xmpp/client' {
    export class client {
        public constructor(options?: any);
        public start(options?: any): Promise<any>;
        public stop(): Promise<any>;
        public handle(handle: string, fn: (a: any) => any): void;
        public on(event: string, fn: (a: any) => any): void;
        public send(stanza: any): Promise<any>;
    }

    export function xml(...args: any[]): any;
}
