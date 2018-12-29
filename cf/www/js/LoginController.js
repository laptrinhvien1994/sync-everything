angular.module('SunoPosCafe.loginController', [])
    .controller('LoginCtrl', ["$q", "$scope", "$rootScope", "$http", "Auth", "$state", "$ionicSideMenuDelegate", "$ionicPopup", "toaster", "$timeout", "SunoPouchDB", "$ionicHistory", LoginCtrl]);
function LoginCtrl($q, $scope, $rootScope, $http, AuthFactory, $state, $ionicSideMenuDelegate, $ionicPopup, toaster, $timeout, SunoPouchDB, $ionicHistory) {
    $state.transitionTo($state.current, $state.$current.params, { reload: true, inherit: true, notify: true });
    $scope.$watch('$root.appVersion', function () {
        $scope.appVersion = $rootScope.appVersion;
    });

    window.addEventListener('hashchange', function () {
        if (!window.isMobileDevice) {
            if (window.location.hash === '#/login') {
                window.location.reload();
            }
        }
    });

    $rootScope.isInternetConnected = true;
    $scope.offline = null;
    $ionicSideMenuDelegate.canDragContent(false);

    document.addEventListener("offline", function () {
        $rootScope.isInternetConnected = false;
        $rootScope.$apply();
    }, false);
    document.addEventListener("online", function () {
        $rootScope.isInternetConnected = true;
        $rootScope.$apply();
    }, false);

    var sunoAuth = new SunoAuth();
    var DBSettings = SunoPouchDB.getPouchDBInstance('setting', null);

    //force reload tab nếu nhận được yêu cầu cần reload lại bên Pos Controller.
    if ($rootScope.isNeedToReload) {
        $rootScope.isNeedToReload = false;
        if (window.isMobileDevice)
            $state.reload();
        else
            window.location.reload(true);
    }

    $scope.loginData = {
        username: null,
        password: null
    };

    $scope.token = null;
    $scope.hasAccount = false;
    $scope.displayName = null;
    $scope.isCancel = false;
    ////Khi mới vào route login thực hiện kiểm tra dưới DB Local để xem đã đăng nhập hay chưa?
    AuthFactory.getSunoGlobal()
    .then(function (data) {
        //Đã đăng nhập
        if (data.docs.length > 0 && validateUsagePackage(data.docs[0].SunoGlobal))
        {
            $scope.hasAccount = true;
            $scope.displayName = data.docs[0].SunoGlobal.userProfile.fullName;
            //Gán lại cho SunoGlobal các giá trị dưới DB Local.
            for (var prop in data.docs[0].SunoGlobal) {
                if (prop != 'sunoCallback') {
                    SunoGlobal[prop] = data.docs[0].SunoGlobal[prop];
                }
            }
            $scope.$apply();
            //Chờ 5s rồi tự động đăng nhập nếu không nhấn "Đăng nhập"
            $timeout(function () {
                if (!$scope.isCancel && $rootScope.isInternetConnected) {
                    $state.go('pos', {}, { reload: true });
                }
            }, 5000);
        } else { //Chưa đăng nhập
            $scope.resetUser();
            $scope.hasAccount = false;
        }
    });

    $scope.reload = function () {
        window.location.reload(true);
    }

    $scope.$watch('$root.w_logout', function () {
        if ($rootScope.w_logout == false) {
            $scope.hasAccount = false;
        }
    });

    var validateUsagePackage = function (SunoGlobal) {
        var dateTxt = SunoGlobal.usageInfo.overallExpiryDateText;
        var dateArr = dateTxt.split('/');
        var expiredDateNum = new Date(dateArr[2], dateArr[1] - 1, dateArr[0]).getTime();
        var nowDateNum = new Date().getTime();
        if (expiredDateNum > nowDateNum) return true;
        return false;   
    }

    $scope.resetUser = function () {
        $scope.isCancel = true;
        Promise.all([
            DBSettings.$removeDoc({ _id: 'SunoGlobal' })
        ]).then(function (data) {
            //window.location.reload(true);
            $scope.hasAccount = false;
            $scope.$apply();
        }).catch(function (e) {
            console.log(e);
        });
    }

    $scope.openLink = function (url) {
        //if (window.isMobileDevice) {
        //    if (window.cordova) {
        //        cordova.InAppBrowser.open(url, '_self', 'location=yes');
        //    }
        //}
        //else {
        //    if (window.cordova) {
        //        cordova.InAppBrowser.open(url, '_system');
        //    }
        //}
        if (window.cordova) {
            cordova.InAppBrowser.open(url, '_system');
        }
    }

    var getAuthBootloader = function () {
        var deferred = $q.defer();
        var url = Api.authBootloader;
        asynRequest($state, $http, 'POST', url, $scope.token, 'json', null, function (data, status) {
            if (data) {
                deferred.resolve(data);
            }
        }, function (error, status) {
            deferred.reject("Có lỗi xảy ra!");
            return $ionicPopup.alert({
                title: 'Thông báo',
                template: '<p style="text-align:center;">Có sự cố khi đăng nhập</p> <p style="text-align:center;">Vui lòng thử lại!</p>'
            });
        }, true, 'getAuthBootloader');
        return deferred.promise;
    }

    $('#loginFrm').on('keyup keypress', function (e) {
        var keyCode = e.keyCode || e.which;
        if (keyCode === 13) {
            e.target.blur();
        }
    });

    var login = function () {
        var deferred = $q.defer();
        sunoAuth.login($scope.loginData.username, $scope.loginData.password)
            .then(function (body) {
                //Gán cho SunoGlobal
                SunoGlobal.userProfile.sessionId = body.sessionId;
                SunoGlobal.userProfile.userName = body.userName;
                sunoAuth.getUserInfo(SunoGlobal.userProfile.sessionId)
                    .then(function (data) {
                        //UserProfile
                        SunoGlobal.userProfile.authSessionId = data.userSession.authSessionId;
                        SunoGlobal.userProfile.userId = data.userSession.userId;
                        SunoGlobal.userProfile.fullName = data.userSession.displayName;
                        SunoGlobal.userProfile.email = data.userSession.email;
                        SunoGlobal.userProfile.isAdmin = data.userSession.isAdmin;
                        //Token info
                        SunoGlobal.token.accessToken = data.userSession.accessToken;
                        SunoGlobal.token.refreshToken = data.userSession.refreshToken;
                        //Company Info
                        SunoGlobal.companyInfo.companyId = data.userSession.companyId;
                        SunoGlobal.companyInfo.companyName = data.userSession.companyName;
                        //Permission
                        SunoGlobal.permissions = data.userSession.permissions;
                        $scope.token = data.userSession.accessToken;
                        deferred.resolve(data);
                    })
                    .catch(function (error) {
                        toaster.pop('error', "", 'Đăng nhập không thành công, xin thử lại!');
                        console.log('getUserInfo', error);
                        reject(error);
                    });
            })
            .catch(function (e) {
                deferred.reject(e);
                try{
                    e = JSON.parse(e);
                    $ionicPopup.alert({
                        title: 'Thông báo',
                        template: '<p style="text-align:center;">Thông tin đăng nhập không đúng.</p>'
                    });
                }
                catch (exception) {
                    $ionicPopup.alert({
                        title: 'Thông báo',
                        template: '<p style="text-align:center;">Đăng nhập ko thành công vui lòng kiểm tra lại tài khoản hoặc kết nối Internet của bạn.</p>'
                    });
                }

            });
        return deferred.promise;
    }

    $scope.doLogin = function () {
        if ($scope.hasAccount) {
            $scope.isCancel = true;
            $state.go('pos', {}, { reload: true });
            return;
        }
        else {
            //Dùng jQuery để tránh lỗi bị lưu id, password của browser.
            $scope.loginData.username = $('#username').val();
            $scope.loginData.password = $('#password').val();
            if (window.cordova) {
                var isAndroid = ionic.Platform.isAndroid();
                var isIPad = ionic.Platform.isIPad();
                var isIOS = ionic.Platform.isIOS();
            }

            if ($scope.loginData.username == '' || $scope.loginData.password == '') {
                return $ionicPopup.alert({
                    title: 'Thông báo',
                    template: '<p style="text-align:center;">Vui lòng nhập thông tin tài khoản!</p>'
                });
            }
            login()
                .then(function (data) {
                    return getAuthBootloader();
                }).then(function (data) {
                    //Thêm vào SunoGlobal sau đó lưu xuống DB.
                    var SunoGlobalWithoutFn = JSON.parse(JSON.stringify(SunoGlobal));
                    SunoGlobalWithoutFn.usageInfo = data.usageInfo;
                    if (validateUsagePackage(SunoGlobalWithoutFn)) {
                        return AuthFactory.setSunoGlobal(SunoGlobalWithoutFn);
                    }
                    else {
                        $ionicPopup.alert({
                            title: 'Thông báo',
                            template: '<p style="text-align:center;">Tài khoản của bạn đã hết hạn.</p>'
                        });
                        throw "Hết hạn sử dụng";
                    }
                })
                .then(function (d) {
                    $ionicHistory.clearCache()
                    .then(function () {
                        $state.go('pos');
                    })
                }).catch(function (error) {
                    console.log(error);
                    //toaster.pop('error', "", 'Đăng nhập không thành công, xin thử lại!');
                });
        }
    };
}
