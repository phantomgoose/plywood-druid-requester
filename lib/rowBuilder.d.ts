/// <reference types="node" />
import { Transform, TransformOptions } from "stream";
export interface RowBuilderOptions extends TransformOptions {
    resultType: string;
    resultFormat?: string;
    timestamp?: string | null;
    ignorePrefix?: string | null;
    dummyPrefix?: string | null;
}
export declare class RowBuilder extends Transform {
    static cleanupIgnoreFactory(ignorePrefix: string | null): (obj: any) => void;
    static cleanupDummyFactory(dummyPrefix: string | null): (obj: any) => void;
    private assembler;
    private flushRoot;
    private metaEmitted;
    private columns;
    maybeNoDataSource: boolean;
    constructor(options: RowBuilderOptions);
    _transform(chunk: any, encoding: any, callback: any): void;
    _flush(callback: any): void;
}
