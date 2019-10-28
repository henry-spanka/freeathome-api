import {client as Client} from "@xmpp/client";
import {ConsoleLogger, Logger} from "./Logger";
import {Subscriber} from "./Subscriber";


export class GuardedClient{
    private logger : Logger = new ConsoleLogger();
    private errorSubscriber: Subscriber;
    private client : Client;

    constructor(errorSubscriber: Subscriber, options?: any, logger?: Logger) {
        this.client = new Client(options)
        this.errorSubscriber = errorSubscriber
        if (logger !== undefined && logger !== null){
            this.logger = logger
        }
    }


    on(event: string, fn: (a: any) => any): void {
        this.client.on(event,fn)
    }

    /**
     * Extend on-event method to guard execution and expose errors through broadcast messages.
     * @param event
     * @param fn
     */
    guardedOn(event: string, fn: (a: any) => any): void {
        const guardedFn = async (a: any) => {
            try {
                await fn(a)
            } catch (err) {
                this.logger.error(`Unexpected error while processing ${event} event`, err)
                this.broadCastError(err);
            }
        }

        this.client.on(event, guardedFn)
    }

    send(stanza: any): Promise<any> {
        return this.client.send(stanza)
    }

    start(options?: any): Promise<any> {
        return this.client.start(options)
    }

    stop(): Promise<any> {
        return this.client.stop()
    }

    private broadCastError(err: Error) {
        this.errorSubscriber.broadcastMessage({
                type: "error",
                result: {
                    message: err.message,
                    error: err
                }
            }
        )
    }
}