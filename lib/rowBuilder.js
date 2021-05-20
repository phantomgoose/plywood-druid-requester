"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var stream_1 = require("stream");
var assembler_1 = require("./assembler");
var RowBuilder = (function (_super) {
    tslib_1.__extends(RowBuilder, _super);
    function RowBuilder(options) {
        var _this = this;
        options.readableObjectMode = true;
        options.writableObjectMode = true;
        _this = _super.call(this, options) || this;
        var resultType = options.resultType, resultFormat = options.resultFormat, _a = options.timestamp, timestamp = _a === void 0 ? 'timestamp' : _a, _b = options.ignorePrefix, ignorePrefix = _b === void 0 ? null : _b, _c = options.dummyPrefix, dummyPrefix = _c === void 0 ? null : _c;
        _this.maybeNoDataSource = resultType !== 'sql';
        var cleanupIgnore = RowBuilder.cleanupIgnoreFactory(ignorePrefix);
        var cleanupDummy = RowBuilder.cleanupDummyFactory(dummyPrefix);
        var onArrayPush = null;
        var onKeyValueAdd = function (key, value) {
            _this.maybeNoDataSource = false;
            return true;
        };
        switch (resultType) {
            case 'timeseries':
            case 'timeBoundary':
                onArrayPush = function (value, stack, keyStack) {
                    if (keyStack.length === 0) {
                        var d = value.result;
                        if (timestamp)
                            d[timestamp] = new Date(value.timestamp);
                        if (cleanupIgnore)
                            cleanupIgnore(d);
                        if (cleanupDummy)
                            cleanupDummy(d);
                        _this.push(d);
                        return false;
                    }
                    return true;
                };
                break;
            case 'topN':
                onArrayPush = function (value, stack, keyStack) {
                    if (keyStack.length === 2 && keyStack[1] === 'result') {
                        var d = value;
                        if (timestamp)
                            d.timestamp = new Date(stack[1].timestamp);
                        if (cleanupIgnore)
                            cleanupIgnore(d);
                        if (cleanupDummy)
                            cleanupDummy(d);
                        _this.push(d);
                        return false;
                    }
                    return true;
                };
                break;
            case 'groupBy':
                onArrayPush = function (value, stack, keyStack) {
                    if (keyStack.length === 0) {
                        var d = value.event;
                        if (timestamp)
                            d[timestamp] = new Date(value.timestamp);
                        if (cleanupIgnore)
                            cleanupIgnore(d);
                        if (cleanupDummy)
                            cleanupDummy(d);
                        _this.push(d);
                        return false;
                    }
                    return true;
                };
                break;
            case 'select':
                onArrayPush = function (value, stack, keyStack) {
                    if (keyStack.length === 3 && keyStack[2] === 'events') {
                        var d = value.event;
                        if (timestamp)
                            d[timestamp] = new Date(d.timestamp);
                        if (timestamp !== 'timestamp')
                            delete d['timestamp'];
                        if (cleanupIgnore)
                            cleanupIgnore(d);
                        if (cleanupDummy)
                            cleanupDummy(d);
                        _this.push(d);
                        return false;
                    }
                    return true;
                };
                onKeyValueAdd = function (key, value) {
                    _this.maybeNoDataSource = false;
                    if (key !== 'pagingIdentifiers')
                        return true;
                    if (_this.metaEmitted)
                        return false;
                    _this.emit('meta', { pagingIdentifiers: value });
                    _this.metaEmitted = true;
                    return false;
                };
                break;
            case 'scan':
                if (resultFormat === 'compactedList') {
                    var columns_1 = null;
                    onArrayPush = function (value, stack, keyStack) {
                        if (keyStack.length === 2 && keyStack[1] === 'events') {
                            var d = {};
                            var n = columns_1.length;
                            for (var i = 0; i < n; i++) {
                                d[columns_1[i]] = value[i];
                            }
                            if (cleanupIgnore)
                                cleanupIgnore(d);
                            if (cleanupDummy)
                                cleanupDummy(d);
                            _this.push(d);
                            return false;
                        }
                        return true;
                    };
                    onKeyValueAdd = function (key, value, stack, keyStack) {
                        if (key !== 'columns' || keyStack.length !== 1)
                            return true;
                        columns_1 = value;
                        return false;
                    };
                }
                else {
                    onArrayPush = function (value, stack, keyStack) {
                        if (keyStack.length === 2 && keyStack[1] === 'events') {
                            var d = value;
                            if (cleanupIgnore)
                                cleanupIgnore(d);
                            if (cleanupDummy)
                                cleanupDummy(d);
                            _this.push(d);
                            return false;
                        }
                        return true;
                    };
                }
                break;
            case 'segmentMetadata':
                onArrayPush = function (value, stack, keyStack) {
                    if (keyStack.length === 0) {
                        var d = value;
                        if (cleanupIgnore)
                            cleanupIgnore(d);
                        if (cleanupDummy)
                            cleanupDummy(d);
                        _this.push(d);
                        return false;
                    }
                    return true;
                };
                break;
            case 'sql':
                _this.columns = [];
                onArrayPush = function (value, stack, keyStack) {
                    if (keyStack.length === 0) {
                        if (_this.columns) {
                            _this.emit('meta', {
                                columns: _this.columns
                            });
                            _this.columns = null;
                        }
                        var d = value;
                        if (cleanupIgnore)
                            cleanupIgnore(d);
                        if (cleanupDummy)
                            cleanupDummy(d);
                        _this.push(d);
                        return false;
                    }
                    return true;
                };
                onKeyValueAdd = function (key, value, stack, keyStack) {
                    if (!_this.columns)
                        return true;
                    _this.maybeNoDataSource = false;
                    if (keyStack.length === 1 && keyStack[0] === 0) {
                        _this.columns.push(String(key));
                    }
                    return true;
                };
                break;
            default:
                _this.flushRoot = true;
        }
        _this.assembler = new assembler_1.Assembler({
            onArrayPush: onArrayPush,
            onKeyValueAdd: onKeyValueAdd
        });
        return _this;
    }
    RowBuilder.cleanupIgnoreFactory = function (ignorePrefix) {
        if (ignorePrefix == null)
            return null;
        var ignorePrefixLength = ignorePrefix.length;
        return function (obj) {
            for (var k in obj) {
                if (k.substr(0, ignorePrefixLength) === ignorePrefix)
                    delete obj[k];
            }
        };
    };
    RowBuilder.cleanupDummyFactory = function (dummyPrefix) {
        if (dummyPrefix == null)
            return null;
        var dummyPrefixLength = dummyPrefix.length;
        return function (obj) {
            for (var k in obj) {
                if (k.substr(0, dummyPrefixLength) === dummyPrefix) {
                    obj[k.substr(dummyPrefixLength)] = obj[k];
                    delete obj[k];
                }
            }
        };
    };
    RowBuilder.prototype._transform = function (chunk, encoding, callback) {
        this.assembler.process(chunk);
        callback();
    };
    RowBuilder.prototype._flush = function (callback) {
        if (this.flushRoot) {
            this.push(this.assembler.current);
        }
        callback();
    };
    return RowBuilder;
}(stream_1.Transform));
exports.RowBuilder = RowBuilder;
