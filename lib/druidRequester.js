"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var plywood_base_api_1 = require("plywood-base-api");
var readable_stream_1 = require("readable-stream");
var request = require("request");
var hasOwnProperty = require("has-own-prop");
var requestPromise = require("request-promise-native");
var concat = require("concat-stream");
var PlainAgent = require("socks5-http-client/lib/Agent");
var SecureAgent = require("socks5-https-client/lib/Agent");
var Combo = require("stream-json/Combo");
var rowBuilder_1 = require("./rowBuilder");
function getDataSourcesFromQuery(query) {
    var queryDataSource = query.dataSource;
    if (!queryDataSource)
        return [];
    if (typeof queryDataSource === 'string') {
        return [queryDataSource];
    }
    else if (queryDataSource.type === "table") {
        return [queryDataSource.name];
    }
    else if (queryDataSource.type === "union") {
        return queryDataSource.dataSources;
    }
    else if (queryDataSource.type === "query") {
        return getDataSourcesFromQuery(queryDataSource.query);
    }
    else {
        return [];
    }
}
function basicUrlBuilder(location, secure) {
    var s = '';
    var defaultPort = 8082;
    if (secure) {
        s = 's';
        defaultPort += 200;
    }
    return "http" + s + "://" + location.hostname + ":" + (location.port || defaultPort);
}
function applyAuthTokenToHeaders(headers, authToken) {
    if (!authToken)
        return;
    switch (authToken.type) {
        case 'basic-auth':
            if (typeof authToken.username !== 'string')
                throw new Error('basic-auth must set username');
            if (typeof authToken.password !== 'string')
                throw new Error('basic-auth must set password');
            headers["Authorization"] = "Basic " + Buffer.from(authToken.username + ':' + authToken.password).toString('base64');
            break;
        case 'imply-token-hmac':
            if (typeof authToken.implyToken !== 'string')
                throw new Error('imply-token-hmac must set implyToken');
            if (typeof authToken.implyHmac !== 'string')
                throw new Error('imply-token-hmac must set implyHmac');
            headers["X-Imply-Token"] = authToken.implyToken;
            headers["X-Imply-HMAC"] = authToken.implyHmac;
            headers["Imply-Token"] = authToken.implyToken;
            headers["Imply-HMAC"] = authToken.implyHmac;
            break;
        case 'bearer-auth':
            if (typeof authToken.bearerToken !== 'string')
                throw new Error('bearer-auth must set implyIdentityToken');
            headers["Authorization"] = authToken.bearerToken;
            break;
        default:
            throw new Error("unknown auth token type '" + authToken.type + "'");
    }
}
exports.applyAuthTokenToHeaders = applyAuthTokenToHeaders;
function druidRequesterFactory(parameters) {
    var locator = parameters.locator, host = parameters.host, timeout = parameters.timeout, protocol = parameters.protocol, urlBuilder = parameters.urlBuilder, requestDecorator = parameters.requestDecorator, authToken = parameters.authToken, socksHost = parameters.socksHost, cancelToken = parameters.cancelToken, getQueryId = parameters.getQueryId;
    if (!protocol)
        protocol = 'plain';
    var secure = protocol === 'tls' || protocol === 'tls-loose';
    if (!locator) {
        if (!host)
            throw new Error("must have a `host` or a `locator`");
        locator = plywood_base_api_1.basicLocator(host, secure ? 8282 : 8082);
    }
    if (!urlBuilder) {
        urlBuilder = basicUrlBuilder;
    }
    var agentClass = null;
    var agentOptions = null;
    if (socksHost) {
        var socksLocation = plywood_base_api_1.hostToLocation(socksHost, 1080);
        agentClass = secure ? SecureAgent : PlainAgent;
        agentOptions = {
            socksHost: socksLocation.hostname,
            socksPort: socksLocation.port
        };
        if (parameters.socksUsername)
            agentOptions.socksUsername = parameters.socksUsername;
        if (parameters.socksPassword)
            agentOptions.socksPassword = parameters.socksPassword;
    }
    function requestOptionsWithDecoration(opt) {
        return Promise.resolve()
            .then(function () {
            var query = opt.query, context = opt.context, options = opt.options;
            if (agentClass) {
                options.agentClass = agentClass;
                options.agentOptions = agentOptions;
            }
            if (secure) {
                options.strictSSL = (protocol === 'tls');
                if (parameters.ca)
                    options.ca = parameters.ca;
                if (parameters.cert)
                    options.cert = parameters.cert;
                if (parameters.key)
                    options.key = parameters.key;
                if (parameters.passphrase)
                    options.passphrase = parameters.passphrase;
            }
            options.headers = options.headers || {};
            applyAuthTokenToHeaders(options.headers, authToken);
            if (requestDecorator) {
                var decorationPromise = requestDecorator({
                    method: options.method,
                    url: options.url,
                    query: JSON.parse(JSON.stringify(query))
                }, context['decoratorContext']);
                if (decorationPromise) {
                    return Promise.resolve(decorationPromise)
                        .then(function (decoration) {
                        if (!decoration)
                            return options;
                        if (decoration.method) {
                            options.method = decoration.method;
                        }
                        if (decoration.url) {
                            options.url = decoration.url;
                        }
                        if (decoration.headers) {
                            Object.assign(options.headers, decoration.headers);
                        }
                        if (decoration.query) {
                            if (typeof decoration.query === 'string') {
                                options.body = decoration.query;
                            }
                            else {
                                options.body = JSON.stringify(decoration.query);
                            }
                        }
                        if (decoration.resultType) {
                            options.resultType = decoration.resultType;
                        }
                        if (decoration.timestampOverride) {
                            options.timestampOverride = decoration.timestampOverride;
                        }
                        return options;
                    });
                }
            }
            return options;
        });
    }
    function requestPromiseWithDecoration(opt) {
        return requestOptionsWithDecoration(opt).then(requestPromise);
    }
    function failIfNoDatasource(url, query, timeout) {
        return requestPromiseWithDecoration({
            query: { queryType: "sourceList" },
            context: {},
            options: {
                method: "GET",
                url: url + "/druid/v2/datasources",
                json: true,
                timeout: timeout
            }
        })
            .then(function (resp) {
            var dataSourcesInQuery = getDataSourcesFromQuery(query);
            if (dataSourcesInQuery.every(function (dataSource) { return resp.indexOf(dataSource) < 0; })) {
                throw new Error("No such datasource '" + dataSourcesInQuery[0] + "'");
            }
            return null;
        });
    }
    return function (req) {
        var context = req.context || {};
        var query = req.query;
        if (getQueryId) {
            query = Object.assign({}, query, {
                context: Object.assign({}, query.context || {}, { queryId: getQueryId() })
            });
        }
        var queryType = query.queryType, intervals = query.intervals;
        if (!queryType && typeof query.query === 'string') {
            queryType = 'sql';
        }
        var stream = new readable_stream_1.PassThrough({
            objectMode: true
        });
        if (intervals && (intervals === "1000-01-01/1000-01-02" || !intervals.length)) {
            process.nextTick(function () {
                stream.push(null);
            });
            return stream;
        }
        function streamError(e) {
            e.query = query;
            e.queryId = (query.context || {}).queryId;
            stream.emit('error', e);
            stream.end();
        }
        var url;
        locator()
            .then(function (location) {
            url = urlBuilder(location, secure);
            if (queryType === "status") {
                requestPromiseWithDecoration({
                    query: query,
                    context: context,
                    options: {
                        method: "GET",
                        url: url + '/status',
                        json: true,
                        timeout: timeout
                    }
                })
                    .then(function (resp) {
                    stream.push(resp);
                    stream.push(null);
                }, streamError);
                return;
            }
            if (queryType === "introspect" || queryType === "sourceList") {
                requestPromiseWithDecoration({
                    query: query,
                    context: context,
                    options: {
                        method: "GET",
                        url: url + "/druid/v2/datasources/" + (queryType === "introspect" ? getDataSourcesFromQuery(query)[0] : ''),
                        json: true,
                        timeout: timeout
                    }
                })
                    .then(function (resp) {
                    if (queryType === "introspect") {
                        if (Array.isArray(resp.dimensions) && !resp.dimensions.length &&
                            Array.isArray(resp.metrics) && !resp.metrics.length) {
                            return failIfNoDatasource(url, query, timeout).then(function () {
                                var err = new Error("Can not use GET route, data is probably in a real-time node or more than a two weeks old. Try segmentMetadata instead.");
                                err.query = query;
                                throw err;
                            });
                        }
                    }
                    return resp;
                })
                    .then(function (resp) {
                    stream.push(resp);
                    stream.push(null);
                }, streamError);
                return;
            }
            if (timeout != null) {
                query.context || (query.context = {});
                query.context.timeout = timeout;
            }
            var queryId = (query.context || {}).queryId;
            requestOptionsWithDecoration({
                query: query,
                context: context,
                options: {
                    method: "POST",
                    url: url + "/druid/v2/" + (queryType === 'sql' ? 'sql/' : '') + (context['pretty'] ? '?pretty' : ''),
                    body: JSON.stringify(query),
                    headers: {
                        "Content-type": "application/json"
                    },
                    timeout: timeout
                }
            })
                .then(function (options) {
                if (cancelToken) {
                    if (cancelToken.reason) {
                        streamError(cancelToken.reason);
                        return;
                    }
                    if (queryId) {
                        cancelToken.promise.then(function () {
                            return requestPromise({
                                method: "DELETE",
                                url: url + "/druid/v2/" + queryId,
                            });
                        }).catch(function () { });
                    }
                }
                request(options)
                    .on('error', function (err) {
                    if (err.message === 'ETIMEDOUT' || err.message === 'ESOCKETTIMEDOUT')
                        err = new Error("timeout");
                    streamError(err);
                })
                    .on('response', function (response) {
                    if (response.statusCode !== 200) {
                        response.on('error', streamError);
                        response.pipe(concat(function (resp) {
                            resp = String(resp);
                            var error;
                            try {
                                var body = JSON.parse(resp);
                                if (body && body.error === "Query timeout") {
                                    error = new Error("timeout");
                                }
                                else {
                                    var message = void 0;
                                    if (body && typeof body.error === 'string') {
                                        message = body.error;
                                        if (typeof body.errorMessage === 'string') {
                                            message = message + ": " + body.errorMessage;
                                        }
                                    }
                                    else {
                                        message = "Bad status code (" + response.statusCode + ")";
                                    }
                                    error = new Error(message);
                                    error.query = query;
                                    if (body && typeof body.host === 'string')
                                        error.host = body.host;
                                }
                            }
                            catch (e) {
                                error = new Error("bad response");
                            }
                            streamError(error);
                        }));
                        return;
                    }
                    var rowBuilder = new rowBuilder_1.RowBuilder({
                        resultType: options.resultType || queryType,
                        resultFormat: query.resultFormat,
                        timestamp: options.timestampOverride || (hasOwnProperty(context, 'timestamp') ? context['timestamp'] : 'timestamp'),
                        ignorePrefix: context['ignorePrefix'],
                        dummyPrefix: context['dummyPrefix']
                    });
                    rowBuilder.on('meta', function (meta) {
                        stream.emit('meta', meta);
                    });
                    rowBuilder.on('end', function () {
                        if (!rowBuilder.maybeNoDataSource) {
                            stream.end();
                            return;
                        }
                        failIfNoDatasource(url, query, timeout)
                            .then(function () {
                            stream.end();
                        }, streamError);
                    });
                    response
                        .pipe(new Combo({ packKeys: true, packStrings: true, packNumbers: true }))
                        .on('error', streamError)
                        .pipe(rowBuilder)
                        .on('error', streamError)
                        .pipe(stream, { end: false })
                        .on('error', streamError);
                });
            }, streamError);
        });
        return stream;
    };
}
exports.druidRequesterFactory = druidRequesterFactory;
