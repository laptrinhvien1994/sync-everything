function SunoRequest () {
    this.options = {
        'url': '',
        'method': 'GET',
        'headers': {
            'content-type': 'application/json'
        },
        'json': true,
        'body': null,
        queueRequest: []
    };
};
SunoRequest.prototype.createCORSRequest = function() {
    var xhr = null;
    if(window.XMLHttpRequest) {
        xhr = new XMLHttpRequest();
    }
    else if (typeof XDomainRequest != 'undefined') {
        xhr = new XDomainRequest();
    }
    else if (window.ActiveXObject) {
        xhr = new ActiveXObject("Microsoft.XMLHTTP");
    }
    return xhr;
}; 
SunoRequest.prototype.makeJsonRequest = function (url, method, data, uniqueKey) {
    var self = this;
    var requestKey = uniqueKey === undefined || uniqueKey === null ? '' : uniqueKey;
    var existRequest = self.options.queueRequest.find(function(key) { return key == uniqueKey; });
    if (existRequest === undefined) {
        if (requestKey != '') { self.options.queueRequest.push(uniqueKey); }
        var _request = self.createCORSRequest();
        self.options.url = url;
        self.options.method = method;
        
        if (data != null) {
            if (method == 'GET' || method == 'get' || method == 'Get') {
                self.options.url += '?' + SunoGlobal.querystring(data);
                self.options.body = null;
            }
            else {
                self.options.body = JSON.stringify(data);
            }
        }
    
        return new Promise(function (resolve, reject) {
            _request.open(self.options.method, self.options.url, true);
            if (self.options.headers != null) {
                Object.getOwnPropertyNames(self.options.headers).forEach(function(key, idx, array){
                    _request.setRequestHeader(key, self.options.headers[key]);
                });
            }
            _request.onload = function () {
                //Delete uniqueKey
                if (requestKey != '') { 
                    var index = self.options.queueRequest.indexOf(uniqueKey);
                    if (index > -1) {
                        self.options.queueRequest.splice(index, 1);
                    }
                }
                SunoGlobal.sunoCallback.completeRequest(self.options);
                if (_request.status == 200) {
                    resolve(_request.response ? JSON.parse(_request.response) : '');
                }
                else if (_request.status == 401 && SunoGlobal.isContains(_request.responseText, 'expired')) {
                    self.refreshToken(function(){
                        self.options.headers['authorization'] = 'Bearer ' + SunoGlobal.token.accessToken;
                        resolve(self.makeJsonRequest(url, method, data, uniqueKey));

                    });
                }
                else if (_request.status == 401 && SunoGlobal.isContains(_request.responseText, 'Missing access token')) {
                    SunoGlobal.sunoCallback.redirectLogin(self.options);
                    //reject('Vui lòng đăng nhập.');
                }
                else if (_request.status == 403 && SunoGlobal.isContains(_request.responseText, 'insufficient_scope')) {
                    reject('Bạn chưa được phân quyền để sử dụng tính năng này.');
                }
                else {
                    reject(_request.responseText);
                }
            };
            _request.onerror = function (error) {
                //Delete uniqueKey
                if (requestKey != '') { 
                    var index = self.options.queueRequest.indexOf(uniqueKey);
                    if (index > -1) {
                        self.options.queueRequest.splice(index, 1);
                    }
                }

                SunoGlobal.sunoCallback.completeRequest(self.options);
                reject(error);
            };
            _request.onloadstart = function () {
                SunoGlobal.sunoCallback.preRequest(self.options);
            };
            _request.send(self.options.body);
        });
    }
    
};
SunoRequest.prototype.makeRestful = function(url, method, data, uniqueKey) {
    var self = this;
    self.options.headers['authorization'] = 'Bearer ' + SunoGlobal.token.accessToken;
    return self.makeJsonRequest(url, method, data, uniqueKey);
};
SunoRequest.prototype.refreshToken = function(callback){
    var self = this;
    var request = self.createCORSRequest();
    var refreshData = { format: 'json', clientId: SunoGlobal.userProfile.sessionId, token: SunoGlobal.token.refreshToken };
    var url = SunoGlobal.authService.domain + SunoGlobal.authService.refreshTokenUrl + '?' + SunoGlobal.querystring(refreshData);
    request.open('GET', url, true);
    request.onload = function() {
        try {
            if (request.response) {
                var result = JSON.parse(request.response);
                SunoGlobal.token.refreshToken = result.refreshToken;
                SunoGlobal.token.accessToken = result.accessToken;
                SunoGlobal.sunoCallback.refreshToken(); 
                if (callback && typeof callback === 'function'){
                    callback();
                }   
            }
            else {
                //console.log('Ex', 'request');
                SunoGlobal.sunoCallback.redirectLogin(self.options); 
            }
        }
        catch (ex) {
            //console.log('Ex', ex);
            SunoGlobal.sunoCallback.redirectLogin(self.options);    
        }
    };
    request.onerror = function(error) {
        //console.log('refreshToken', error);
        SunoGlobal.sunoCallback.redirectLogin(self.options);
    };

    request.send();
};

