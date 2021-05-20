"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Assembler = (function () {
    function Assembler(options) {
        if (options === void 0) { options = {}; }
        this.stack = [];
        this.keyStack = [];
        this.current = null;
        this.key = null;
        this.onArrayPush = options.onArrayPush;
        this.onKeyValueAdd = options.onKeyValueAdd;
    }
    Assembler.prototype._pushStacks = function (newCurrent) {
        if (this.current)
            this.keyStack.push(this.key);
        this.stack.push(this.current = newCurrent);
    };
    Assembler.prototype._popStacks = function () {
        var stack = this.stack;
        stack.pop();
        this.current = stack[stack.length - 1] || null;
        this.key = this.keyStack.pop();
    };
    Assembler.prototype._saveValue = function (value) {
        var _a = this, current = _a.current, key = _a.key;
        if (current) {
            if (Array.isArray(current)) {
                var onArrayPush = this.onArrayPush;
                if (!onArrayPush || onArrayPush.call(this, value, this.stack, this.keyStack) !== false) {
                    current.push(value);
                    this.key = key + 1;
                }
            }
            else {
                var onKeyValueAdd = this.onKeyValueAdd;
                if (!onKeyValueAdd || onKeyValueAdd.call(this, key, value, this.stack, this.keyStack) !== false) {
                    current[key] = value;
                }
                this.key = null;
            }
        }
        else {
            this.current = value;
        }
    };
    Assembler.prototype.process = function (token) {
        switch (token.name) {
            case 'startObject':
                this._pushStacks({});
                break;
            case 'startArray':
                this._pushStacks([]);
                this.key = 0;
                break;
            case 'endObject':
            case 'endArray':
                var finishedCurrent = this.current;
                this._popStacks();
                this._saveValue(finishedCurrent);
                break;
            case 'keyValue':
                this.key = token.value;
                break;
            case 'stringValue':
            case 'nullValue':
            case 'trueValue':
            case 'falseValue':
                this._saveValue(token.value);
                break;
            case 'numberValue':
                this._saveValue(parseFloat(token.value));
                break;
            default:
                break;
        }
    };
    return Assembler;
}());
exports.Assembler = Assembler;
