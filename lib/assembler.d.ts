export interface Token {
    name: string;
    value?: any;
}
export declare type ObjectIndex = string | number;
export interface AssemblerOptions {
    onArrayPush?: (value: any, stack: any[], keyStack?: ObjectIndex[]) => boolean | void;
    onKeyValueAdd?: (key: ObjectIndex, value: any, stack?: any[], keyStack?: ObjectIndex[]) => boolean | void;
}
export declare class Assembler {
    stack: any[];
    keyStack: ObjectIndex[];
    current: any;
    key: ObjectIndex | null;
    private onArrayPush;
    private onKeyValueAdd;
    constructor(options?: AssemblerOptions);
    private _pushStacks;
    private _popStacks;
    private _saveValue;
    process(token: Token): void;
}
