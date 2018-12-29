function SunoAuth() {
    this.request = new SunoRequest();

    /*
        Description: Đăng nhập tài khoản.
        Return: {sessionId: 'string', userName: 'string'}
    */
    SunoAuth.prototype.login = function (username, password) {
        var self = this;
        var data = { userName: username, password: password, format: 'json' };
        return self.request.makeJsonRequest(SunoGlobal.authService.domain + SunoGlobal.authService.loginUrl, 'GET', data);
    }

    /*
        Description: Kiểm tra trạng thái đăng nhập.
        Return: boolen
    */
    SunoAuth.prototype.isAuthenticated = function (sessionId) {
        var self = this;
        var data = { format: 'json', clientId: sessionId };
        return self.request.makeJsonRequest(SunoGlobal.authService.domain + SunoGlobal.authService.isAuthenticatedUrl, 'GET', data);
    }

    /*
        Description: Lấy thông tin tài khoản.
    */
    SunoAuth.prototype.getUserInfo = function (sessionId) {
        var self = this;
        var data = { format: 'json', clientId: sessionId };
        return self.request.makeJsonRequest(SunoGlobal.authService.domain + SunoGlobal.authService.getUserSessionUrl, 'GET', data);
    }
};
