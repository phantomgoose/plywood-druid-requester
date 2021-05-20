import { PlywoodRequester, PlywoodLocator, Location, AuthToken } from 'plywood-base-api';
import { CancelToken } from 'axios';
export declare type Protocol = 'plain' | 'tls-loose' | 'tls';
export interface DruidUrlBuilder {
    (location: Location, secure: boolean): string;
}
export interface DruidRequestDecorator {
    (decoratorRequest: DecoratorRequest, decoratorContext: {
        [k: string]: any;
    }): Decoration | Promise<Decoration>;
}
export interface DruidRequesterParameters {
    locator?: PlywoodLocator;
    host?: string;
    timeout?: number;
    protocol?: Protocol;
    ca?: string;
    cert?: any;
    key?: any;
    passphrase?: string;
    urlBuilder?: DruidUrlBuilder;
    requestDecorator?: DruidRequestDecorator;
    authToken?: AuthToken;
    socksHost?: string;
    socksUsername?: string;
    socksPassword?: string;
    cancelToken?: CancelToken;
    getQueryId?: () => string;
}
export interface DecoratorRequest {
    method: string;
    url: string;
    query: any;
}
export interface Decoration {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    query?: string | object;
    resultType?: string;
    timestampOverride?: string;
}
export declare function applyAuthTokenToHeaders(headers: Record<string, string>, authToken: AuthToken | undefined): void;
export declare function druidRequesterFactory(parameters: DruidRequesterParameters): PlywoodRequester<any>;
