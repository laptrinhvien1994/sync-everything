angular.module('SunoPosCafe.posController', ['toaster', 'ion-datetime-picker', 'btford.socket-io', "cfp.hotkeys"])
    .controller('PosCtrl', ["$location", "$ionicPosition", "$ionicSideMenuDelegate", "$ionicHistory", "$timeout", "$interval", "$q", "$scope", "$http", "$rootScope", "$state", "$ionicPopover", "$ionicPopup", "$ionicModal", "$ionicScrollDelegate", "toaster", "printer", "$filter", "hotkeys", "Auth", "utils", "SunoPouchDB", "$ionicPlatform", PosCtrl])
    .run(function ($ionicPickerI18n) {
        $ionicPickerI18n.weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
        $ionicPickerI18n.months = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
        $ionicPickerI18n.ok = "Chọn";
        $ionicPickerI18n.cancel = "Hủy";
    });

function PosCtrl($location, $ionicPosition, $ionicSideMenuDelegate, $ionicHistory, $timeout, $interval, $q, $scope, $http, $rootScope, $state, $ionicPopover, $ionicPopup, $ionicModal, $ionicScrollDelegate, toaster, printer, $filter, hotkeys, Auth, utils, SunoPouchDB, $ionicPlatform) {

    $state.transitionTo($state.current, $state.$current.params, { reload: true, inherit: true, notify: true });
    if (window.isMobileDevice) {
        StatusBar.isVisible = true;
        StatusBar.show();
    }

    //Always disable debug mode for mobile device.
    if (window.isMobileDevice) {
        SUNOCONFIG.DEBUG = false;
    }

    //#region Variables
    $scope.isShowErrorRibbon = false;
    $scope.errorArr = [];
    $scope.apiLoaded = false; //Cờ kiểm tra xem API đã gọi thành công hay chưa -> Check kết nối internet.
    $scope.isInitialized = false; //Cờ kiểm tra xem toàn bộ app đã được load thành công hay chưa, có xảy ra lỗi ở bất kì chỗ nào ko.
    $scope.offline = null;
    $scope.isUseKeyboard = false;
    $scope.isIPad = ionic.Platform.isIPad();
    $scope.isIOS = ionic.Platform.isIOS();
    $scope.isAndroid = ionic.Platform.isAndroid();
    $scope.isWindowsPhone = ionic.Platform.isWindowsPhone();
    var platform = $scope.isIPad ? 'iPad' : $scope.isIOS ? 'iOS' : $scope.isAndroid ? 'Android' : $scope.isWindowsPhone ? 'WindowsPhone' : 'other';
    //$scope.isUsingOfflineMode = false; //Cờ kiểm tra xem có sử dụng chế độ Offline hay không?
    $scope.isLoggedIn = false; //Cờ kiểm tra đã đăng nhập hay chưa?
    $scope.selectedCategory = ''; //Tên để hiển thị nhóm hàng khi chọn vào category chưa có item.
    $scope.isInTable = true; //Cờ kiểm tra view (Bàn-phòng/Menu), mặc định mới vào sơ đồ bàn.
    $scope.onSearchField = false; //Mới vô thì ko focus vào ô tìm kiếm hàng hóa.
    $scope.appendedCSSClass = ''; //Tên của responsive class CSS bàn/phòng.
    $scope.isUngroupItem = false; //Cờ kiểm tra hàng hóa tách món.
    $scope.isSync = false; //Cờ kiểm tra bật đồng bộ hay không?
    $scope.tablesSetting = null; //Cấu hình bàn phòng
    $scope.removeSetting = null; //Cấu hình hủy món
    $scope.hourService = null; //Cấu hình dịch vụ tính giờ
    $scope.BarItemSetting = null; //Cấu hình cho bar
    $scope.printSetting = null; //Cấu hình in
    $scope.pinItem = null //Cấu hình ghim tách món
    $scope.activatedPromotions = null;
    $scope.leftOrder = null;
    $scope.rightOrder = null;
    $scope.newTable = null;
    $scope.printDevice = null;
    $scope.earningPoint = {
        exchangePoint: 0,
        earningMoney: 0,
        subTotal: 0,
        total: 0
    };
    $scope.promotion = {
        discountMoney: 0,
        total: 0,
        subTotal: 0,
        promotionCode: '',
        itemList: [],
        promotionType: 0,
        promotionOnBill: [],
        promotionOnBillSelected: null
    };
    $scope.showOrderDetails = false;
    $scope.newPrice = 0;
    $scope.showOption = false;
    $scope.promotionTab = 1;
    var printDimetion = true; // chiều in
    var isValidOrderAndTableStructure = true; //Cấu trúc sơ đồ bàn phòng là hợp lệ, migrate giữa phiên bản cũ sang mới.
    var isSyncBlocked = false; //Kiểm tra xem luồng đồng bộ có bị block hay không?
    var shiftID = null; //caching shiftID.

    //DB Local
    var DBSettings = SunoPouchDB.getPouchDBInstance('setting', null); //DB cho các cấu hình thiết lập
    var DBTables = null; //DB cho sơ đồ phòng bàn

    //Socket
    var socket = null; //socket instance
    var manager = null; //manager instance
    var isSocketConnected = false; //Cờ kiểm tra client có đang được kết nối socket với server Node hay không?
    var isSocketInitialized = true; //Cờ kiểm tra xem client có phải vừa được khởi động app hay không?
    var isSocketReady = false; //Cờ kiểm tra xem socket đã sẵn sàng để đồng bộ hay chưa?
    var receivedAnyInitDataFromServer = false; //Cờ kiểm tra xem đã nhận được InitShift Data từ Server gửi về lần nào chưa?
    $scope.syncStatus = 'warn'; //error, warn, success;
    
    //Queue
    var queue = require('queue');
    var kue = queue({ concurrency: 1, autostart: true });
    
    //Suno Prototype
    SunoGlobal.printer.ordering = 'asc';
    var $unoSaleOrderCafe = null; //SunoSaleOrder instance.
    var $unoRequest = new SunoRequest(); //SunoRequest instance.
    var $unoProduct = new SunoProduct(); //SunoProduct instance.
    var $unoCustomer = new SunoCustomer(); //SunoCustomer instance.

    document.addEventListener("offline", function () {
        $scope.errorArr.push({ priority: 1, content: 'Không có kết nối Internet.' });
        $scope.setError();
        $scope.$apply();
    }, false);
    document.addEventListener("online", function () {
        var index = $scope.errorArr.findIndex(function (item) { return item.content == 'Không có kết nối Internet.'; });
        if (index > -1) {
            $scope.errorArr.splice(index, 1);
        }
        $scope.setError();
        $scope.$apply();
    }, false);
    if ($scope.isAndroid) {
        $ionicPlatform.onHardwareBackButton(function () {
            ionic.Platform.exitApp();
        });
    }

    //#endregion variables


    //#region Utils

    //deviceID - Dùng trong đồng bộ để định danh thiết bị.
    var deviceID = localStorage.getItem('deviceID');
    if (deviceID == null) {
        deviceID = uuid.v1();
        localStorage.setItem('deviceID', deviceID);
    }

    //Suno Pos Cafe version.
    var version = localStorage.getItem('version');
    if (version == null || version != '2.0.19') {
        version = '2.0.19';
        localStorage.setItem('version', version);
    }
    $scope.version = version;

    //Tạo timestamp - Dùng trong đồng bộ
    var genTimestamp = function () {
        return new Date().getTime();
    }

    //Kiểm tra platform.
    if ($scope.isAndroid || $scope.isIOS || $scope.isWindowsPhone) {
        $scope.isWebView = false;
    } else
        $scope.isWebView = true;

    try {
        $scope.isMinHeight550px = matchMedia('all and (min-height: 550px)').matches;
    }
    catch (e) { $scope.isMinHeight550px = true; }

    $ionicSideMenuDelegate.canDragContent(false);

    //Kiểm tra kết nối Internet
    var checkingInternetConnection = function () {
        var url = Api.ping;
        var method = 'GET';
        var data = null;
        return $unoRequest.makeRestful(url, method, data)
            .then(function (data) {
                $scope.isOnline = true;
                $scope.$apply();
                return true;
            })
            .catch(function (e) {
                $scope.isOnline = false;
                $scope.$apply();
                return false;
            });
    }

    //Audit trail.
    var audit = function (actionId, shortContent, embededContent) {
        var data = {
            "auditTrailModel":
                {
                    "userId": SunoGlobal.userProfile.userId,
                    "featureId": 23,
                    "actionId": actionId,
                    "shortContent": shortContent,
                    "embededContent": embededContent,
                    "storeId": $scope.currentStore.storeID,
                    "companyId": SunoGlobal.companyInfo.companyId,
                }
        }
        var url = Api.auditTrailRecord;
        var method = 'POST';
        $unoRequest.makeRestful(url, method, data);
    }

    //Open link
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

    $scope.setError = function () {
        if ($scope.errorArr.length == 0) {
            $scope.isShowErrorRibbon = false;
        }
        else {
            $scope.errorArr = $scope.errorArr.sort(function (x, y) { return x.priority - y.priority; });
            $scope.isShowErrorRibbon = true;
        }
    }

    //Hiển thị thông báo
    var notiPopupInstance = null;
    //Dạng single instance, chỉ một thông báo 1 lúc
    var showNotification = function (title, content, callback) {
        if (notiPopupInstance == null) {
            notiPopupInstance = $ionicPopup.alert({
                title: title,
                template: content
            });
            notiPopupInstance.then(function (response) {
                if (callback !== null && typeof callback === 'function') {
                    callback();
                }
                notiPopupInstance = null;
            });
        }
        return notiPopupInstance;
    }

    //Dạng multi instances, có thể nhiều thông báo 1 lúc, các thông báo sẽ chồng lên nhau.
    var showStackNotification = function (title, content, callback) {
        var stackNoti = $ionicPopup.alert({
            title: title,
            template: content
        });
        stackNoti.then(function (response) {
            if (callback !== null && typeof callback === 'function') {
                callback();
            }
        });
    }

    //Kiểm tra và thông báo kết nối Internet.
    $scope.isOnline = true;

    $scope.$watch('isOnline', function (n, o) {
        if (n != null && o != null && n != o) {
            if (n) {
                toaster.pop({
                    type: 'success',
                    title: 'Thông báo',
                    body: 'Kết nối internet ổn định',
                    timeout: 5000
                });
            }
            else {
                if (SunoGlobal.saleSetting.allowOfflineCache) {
                    toaster.pop({
                        type: 'warning',
                        title: 'Thông báo',
                        body: 'Đã mất kết nối internet. Bạn đang ở chế độ Offline.',
                        timeout: 5000
                    });
                }
                else {
                    toaster.pop({
                        type: 'warning',
                        title: 'Thông báo',
                        body: 'Đã mất kết nối internet.',
                        timeout: 5000
                    });
                }
            }
        }
    });

    var template = '<ion-popover-view><ion-header-bar> <h1 class="title">My Popover Title</h1> </ion-header-bar> <ion-content> <p ng-repeat="i in tables">{{tableName}}</p> </ion-content></ion-popover-view>';

    $scope.popover = $ionicPopover.fromTemplate(template, {
        scope: $scope
    });

    $scope.openPopover = function ($event) {
        $scope.popover.show($event);
    };

    $scope.canRename = function (order) {
        if (order) {
            if (order.hasOwnProperty('note')) return true;
            else return false;
        }
    }

    $scope.hasNote = function (order) {
        if (order) {
            if (order.comment) return true;
            else return false;
        }
    }

    var validateUsagePackage = function (SunoGlobal) {
        var dateTxt = SunoGlobal.usageInfo.overallExpiryDateText;
        var dateArr = dateTxt.split('/');
        var expiredDateNum = new Date(dateArr[2], dateArr[1] - 1, dateArr[0]).getTime();
        var nowDateNum = new Date().getTime();
        if (expiredDateNum > nowDateNum) return true;
        return false;
    }

    var findFisrtElement = function (array, startIndex) {
        var prefix = startIndex == 0 ? 'p2-' : 'p1-';
        for (var x = startIndex; x < array.length; x++) {
            var id = startIndex == 0 ? $scope.productItemList[x].itemId : $scope.tables[x].tableUuid;
            var eID = prefix + id;
            var e = document.getElementById(eID);
            if (e) {
                return e.offsetWidth;
            }
        }
        return -1;
    }

    $scope.quantityTablePerRow = null;
    $scope.quantityItemPerRow = null;
    var buildHotKeyIndex = function () {
        //Build Index để dùng phím tắt cho sơ đồ bàn và thực đơn.
        $timeout(function () {
            if (window.location.hash == '#/') {
                //Kiểm tra sơ đồ bàn để tránh trường hợp đăng nhập 2 tabs và logout 1 bên. bên kia refresh lại thì báo lỗi.
                if ($scope.tables && $scope.tables[1]) {
                    //var id = 'p1-' + $scope.tables[1].tableUuid;
                    //var widthOfOneTable = document.getElementById(id).offsetWidth;
                    var widthOfOneTable = findFisrtElement($scope.tables, 1);
                    var widthOfOneRow = document.getElementById('buildHotKeyIndex').offsetWidth;
                    //SUNOCONFIG.LOG(widthOfOneTable);
                    //SUNOCONFIG.LOG(widthOfOneRow);
                    $scope.quantityTablePerRow = Math.floor(widthOfOneRow / widthOfOneTable);
                }
                if ($scope.productItemList && $scope.productItemList[0]) {
                    //var id = 'p2-' + $scope.productItemList[0].itemId;
                    //var widthOfOneItem = document.getElementById(id).offsetWidth;
                    var widthOfOneItem = findFisrtElement($scope.productItemList, 0);
                    var widthOfOneRowItem = document.getElementById('buildHotKeyIndexInItemList').offsetWidth;
                    $scope.quantityItemPerRow = Math.floor(widthOfOneRowItem / widthOfOneItem);
                }
            }
        }, 200);
    };

    var interceptUrl = function (url) {
        if (url.indexOf('/promotion/getApplying') < 0
            && url.indexOf('/promotion/getactive') < 0
            && url.indexOf('/promotion/getBillApplying') < 0) {
            $rootScope.$broadcast('loading:show');
        }
    }

    window.addEventListener('resize', function (e) {
        buildHotKeyIndex();
        //$scope.$apply();
    });

    //Modeling table để lưu xuống DB.
    var prepareTables = function () {
        var tables = angular.copy($scope.tables);
        var array = [];
        tables.forEach(function (t) {
            var table = angular.copy(t);
            table._id = t.tableId.toString() + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID;
            //table._id = t.tableName;
            table.store = $scope.currentStore.storeID;
            array.push(table);
        });
        return array;
    }

    //Tính toán màu
    $scope.calcolor = function (i) {
        return i % 5;
    }

    //Hàm cập nhật bàn vào DB với bàn đang được chọn.
    var updateSelectedTableToDB = function () {
        var tb = $scope.tableIsSelected;
        return updateTableToDB(tb);
    }

    //Hàm cập nhật bàn vào DB với 1 bàn tùy ý lúc truyền vào.
    var updateTableToDB = function (tb) {
        //SUNOCONFIG.LOG(tb);
        return DBTables.$queryDoc({
            selector: {
                'store': { $eq: $scope.currentStore.storeID },
                'tableUuid': { $eq: tb.tableUuid }
            },
            fields: ['_id', '_rev']
        })
            .then(function (data) {
                var table = angular.copy(tb);
                table._id = data.docs[0]._id;
                table._rev = data.docs[0]._rev;
                table.store = $scope.currentStore.storeID;
                return DBTables.$addDoc(table);
            })
            .then(function (data) {
                //log for debug
                //SUNOCONFIG.LOG(data);
                return null;
            })
            .catch(function (error) {
                //Nếu bị conflict thì retry lại
                return DBTables.$queryDoc({
                    selector: {
                        'store': { $eq: $scope.currentStore.storeID },
                        'tableUuid': { $eq: tb.tableUuid }
                    },
                    fields: ['_id', '_rev']
                })
                    .then(function (data) {
                        var table = angular.copy(tb);
                        table._id = data.docs[0]._id;
                        table._rev = data.docs[0]._rev;
                        table.store = $scope.currentStore.storeID;
                        return DBTables.$addDoc(table);
                    })
                    .catch(function (e) {
                        SUNOCONFIG.LOG(e);
                    });
            });
    }

    //Kiểm tra xem tables dưới DB Local có trùng với tables ở API trả về hay không.
    //Tránh lỗi 1 thiết bị offline xong được cập nhật phòng bàn ở 1 thiết bị khác.
    var checkingMatchTable = function (tableLocal, tableAPI) {
        var localLength = tableLocal.length;
        var apiLength = tableAPI.length;
        if (localLength != apiLength) return false;
        for (var x = 0; x < localLength; x++) {
            if (tableLocal[x].tableUuid != tableAPI[x].tableUuid) return false;
        }
        return true;
    }

    $scope.reloadApp = function () {
        window.location.reload(true);
    }

    $scope.hideNotification = function () {
        if ($scope.isShowErrorRibbon) {
            $scope.isShowErrorRibbon = false;
        }
    }

    var clearShiftTableZoneInLocal = function (callback) {
        Promise.all([
            DBSettings.$removeDoc({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID }),
            DBTables.$queryDoc({
                selector: {
                    'store': { $eq: $scope.currentStore.storeID }
                },
            }),
            DBSettings.$removeDoc({ _id: 'zones_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
        ])
            .then(function (data) {
                data[1].docs.forEach(function (d) { d._deleted = true; });
                return DBTables.$manipulateBatchDoc(data[1].docs);
            })
            .then(function (data) {
                callback();
            })
            .catch(function (error) {
                SUNOCONFIG.LOG(error);
            })
    }

    var clearTableZoneInLocal = function (callback) {
        Promise.all([
            DBTables.$queryDoc({
                selector: {
                    'store': { $eq: $scope.currentStore.storeID }
                },
            }),
            DBSettings.$removeDoc({ _id: 'zones_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
        ])
            .then(function (data) {
                data[0].docs.forEach(function (d) { d._deleted = true; });
                return DBTables.$manipulateBatchDoc(data[0].docs);
            })
            .then(function (data) {
                callback();
            });
    }

    var reloadAllClients = function () {
        var dataReload = {
            "companyId": SunoGlobal.companyInfo.companyId,
            "storeId": $scope.currentStore.storeID,
            "clientId": SunoGlobal.userProfile.sessionId,
            "info": {
                action: 'reload',
                deviceID: deviceID,
                timestamp: genTimestamp(),
                author: SunoGlobal.userProfile.userId
            }
        };
        socket.emit('reload', dataReload);
    }

    var handleCreatedTableSucessfully = function () {
        if ($scope.isSync) {
            reloadAllClients();
        }
        else {
            clearShiftTableZoneInLocal(function () { window.location.reload(true); });
        }
    }

    var clearShift = function () {
        if (!$scope.isManager) {
            return toaster.pop('error', '', 'Bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ quản lý');
        }
        var clearShiftData = {
            "companyId": SunoGlobal.companyInfo.companyId,
            "storeId": $scope.currentStore.storeID,
            "clientId": SunoGlobal.userProfile.sessionId,
            "info": {
                action: 'clearShift',
                deviceID: deviceID,
                timestamp: genTimestamp(),
                author: SunoGlobal.userProfile.userId
            }
        }
        socket.emit('clearShift', clearShiftData);
    }

    var handleDisconnectedSocket = function () {
        toaster.pop('warning', 'Kết nối Internet không ổn định, dữ liệu có thể chưa được đồng bộ. Vui lòng kiểm tra lại kết nối Internet.');
    }

    var handleUnreadySocket = function () {
        toaster.pop('warning', 'Ứng dụng đang khởi tạo kết nối đến hệ thống, vui lòng chờ trong giây lát và thực hiện lại thao tác');
    }


    //#endregion utils

    //#region Product services
    //Tìm kiếm hàng hóa
    $scope.suggestproducts = [];
    $scope.key = null;
    $scope.getSearchResult = function (key) {
        if (!key) {
            return;
        }
        var storeID = $scope.currentStore.storeID;
        var limit = 1000;
        var pageNo = 1;
        $unoProduct.searchProductItems(storeID, key, limit, pageNo)
            .then(function (data) {
                $scope.suggestproducts = angular.copy(data.items);
                $scope.$apply();
                $scope.ItemSearchIsSelected = null;
                $scope.$apply();
            })
            .catch(function (e) {
                SUNOCONFIG.LOG(e);
            });
    }

    //Lấy hàng hóa mới
    $scope.getNewProductItems = function () {
        $scope.buttonProductListStatus = 1;
        $ionicScrollDelegate.$getByHandle('productItemList').scrollTop();
        var url = Api.getNewProduct + $scope.currentStore.storeID;
        var method = 'GET';
        var data = null;
        $unoRequest.makeRestful(url, method, data)
            .then(function (data) {
                $scope.productItemList = data.items;
                $scope.$apply();
            })
            .catch(function (e) {
                SUNOCONFIG.LOG(e);
            });
    }

    //Lấy hàng hóa bán chạy
    $scope.getBestSellingProductItems = function () {
        $scope.buttonProductListStatus = 2;
        $ionicScrollDelegate.$getByHandle('productItemList').scrollTop();
        var url = Api.getBestSelling + $scope.currentStore.storeID;
        var method = 'GET';
        var data = null;
        $unoRequest.makeRestful(url, method, data)
            .then(function (data) {
                $scope.productItemList = data.items;
                $scope.$apply();
            })
            .catch(function (e) {
                SUNOCONFIG.LOG(e);
            });
    }


    // Lấy danh sách categories
    var getAllCategories = function () {
        return $unoProduct.getCategories()
            .then(function (categories) {
                $scope.categories = categories;
                $scope.categories = buildTree($scope.categories);
                $scope.$apply();
                return null;
            })
            .catch(function (e) {
                SUNOCONFIG.LOG(e);
                return e;
            })
    }

    //Lấy hàng hóa theo category
    $scope.getProductItems = function (cid, categoryName) {
        if (categoryName && categoryName != '') {
            $scope.selectedCategory = ' thuộc nhóm ' + categoryName.toUpperCase();
        }
        else {
            $scope.selectedCategory = '';
        }
        $scope.buttonProductListStatus = 0;
        $scope.currentCategory = cid;
        $ionicScrollDelegate.$getByHandle('productItemList').scrollTop();
        var limit = 1000;
        var pageIndex = 1;
        var storeID = $scope.currentStore.storeID;
        if (cid != '') {
            return $unoProduct.getProductItemsByCategory(storeID, cid, limit, pageIndex)
                .then(function (data) {
                    $scope.productItemList = data.items;
                    $scope.$apply();
                    return null;
                })
                .catch(function (e) {
                    SUNOCONFIG.LOG(e);
                    return e;
                });
        }
        else {
            return $unoProduct.getProductItems(storeID, limit, pageIndex)
                .then(function (data) {
                    $scope.productItemList = data.items;
                    $scope.$apply();
                    return null;
                })
                .catch(function (e) {
                    SUNOCONFIG.LOG(e);
                    return e;
                });
        }
    }

    //#endregion product service


    //#region Bootloader

    //Lấy thông tin công ty
    var getCompanyInfo = function () {
        var url = Api.getCompanyInfo;
        var method = 'GET';
        var data = null;
        return $unoRequest.makeRestful(url, method, data)
            .then(function (data) {
                $scope.companyInfo = data;
                $scope.$apply();
                return null;
            })
            .catch(function (e) {
                SUNOCONFIG.LOG(e);
                return e;
            });
    }

    //Lấy API bootloader
    var getBootLoader = function () {
        var url = Api.bootloader;
        var method = 'POST';
        var data = null;
        return $unoRequest.makeRestful(url, method, data);
    }

    //Lấy Auth bootloader
    var getAuthBootLoader = function () {
        var url = Api.authBootloader;
        var method = 'POST';
        var data = null;
        return $unoRequest.makeRestful(url, method, data);
    }

    // Lấy mẫu in đã lưu
    var getPrintTemplate = function () {
        var url = Api.printTemplate;
        var method = 'GET';
        var data = null;
        return $unoRequest.makeRestful(url, method, data)
            .then(function (data) {
                //remapping noticekitchen template.
                data.templates.forEach(function (template) {
                    if (template.code === 'Sale_Order_Coffee' && template.type === 257) {
                        template.code = 'kitchen_order_small';
                        template.type = 128;
                    }
                });
                printer.initializeTemplates(data);
                return null;
            })
            .catch(function (e) {
                SUNOCONFIG.LOG(e);
                printer.initializeTemplates();
                return e;
            });
    }

    $scope.selectUpdated = function (index) {
        if (index == "1") {
            $scope.hourService.optionSelected = "1";
            $scope.hourService.blockCounter = 15;
        }
        else if (index == "2") {
            $scope.hourService.optionSelected = "2";
            $scope.hourService.blockCounter = 30;
        }
        else if (index == "3") {
            $scope.hourService.optionSelected = "3";
            $scope.hourService.blockCounter = 60;
        }
        else {
            $scope.hourService.optionSelected = "0";
            $scope.hourService.blockCounter = 1;
        }
    }

    var getSettings = function () {
        var isSyncSetting = SunoGlobal.featureActivations.find(function (s) { return s.name == 'isSync' });
        if (!isSyncSetting) isSyncSetting = { value: "" };
        if (isSyncSetting) {
            if (isSyncSetting.value != "") {
                $scope.isSync = JSON.parse(isSyncSetting.value);
            }
        }

        var tableSetting = SunoGlobal.featureActivations.find(function (s) { return s.name == 'tableSetting' });
        if (tableSetting) {
            if (tableSetting.value != "") {
                $scope.tablesSetting = JSON.parse(tableSetting.value);
                //Check cấu trúc sơ đồ phòng bàn và order cũ
                var storeIndex = findIndex($scope.tablesSetting, 'storeId', $scope.currentStore.storeID);
                if (storeIndex != null) {
                    $scope.tables = $scope.tablesSetting[storeIndex].tables;
                    if ($scope.tables.length > 0 && $scope.tables[0].tableOrder.length > 0 && !$scope.tables[0].tableOrder[0].receiptVouchers) {
                        isValidOrderAndTableStructure = false;
                        $scope.tables.forEach(function (t) {
                            t.tableOrder = [];
                        });
                    }
                }
            }
            else {
                //$scope.tablesSetting = null;
            }
        }
        else {
            //$scope.tablesSetting = null;
        }

        var removeItemSetting = SunoGlobal.featureActivations.find(function (s) { return s.name == 'removeItemSetting' });

        if (removeItemSetting) {
            $scope.removeSetting = removeItemSetting.value ? JSON.parse(removeItemSetting.value) : 2;
            $scope.removeSettingTemp = $scope.removeSetting;
        }
        else {
            $scope.removeSetting = 2;
            $scope.removeSettingTemp = $scope.removeSetting;
        }

        var hourServiceSetting = SunoGlobal.featureActivations.find(function (s) { return s.name == 'hourServiceSetting' });
        if (!hourServiceSetting) {
            $scope.hourService = {
                isUse: false,
                optionSelected: "3",
                blockCounter: 60,
                allProduct: false,
                itemArr: []
            }
        }
        else {
            if (hourServiceSetting.value != "") {
                $scope.hourService = JSON.parse(hourServiceSetting.value);
                //Thêm props cho các tài khoản đã dùng cafe v1.
                if (!$scope.hourService.itemArr) {
                    $scope.hourService.itemArr = [];
                }
                if (!$scope.hourService.blockCounter) {
                    if ($scope.hourService.optionSelected == "1") {
                        $scope.hourService.blockCounter = 15;
                    }
                    else if ($scope.hourService.optionSelected == "2") {
                        $scope.hourService.blockCounter = 30;
                    }
                    else if ($scope.hourService.optionSelected == "3") {
                        $scope.hourService.blockCounter = 30;
                    }
                    else {
                        $scope.hourService.blockCounter = $scope.hourService.customOption;
                        delete $scope.hourService.customOption;
                    }
                }

            } else {
                $scope.hourService = {
                    isUse: false,
                    optionSelected: "3",
                    blockCounter: 60,
                    allProduct: false,
                    itemArr: []
                }
            }

            $scope.hourServiceTemp = angular.copy($scope.hourService);
        }

        var BarItemSetting = SunoGlobal.featureActivations.find(function (s) { return s.name == 'BarItemSetting' });
        if (!BarItemSetting) {
            BarItemSetting = { value: "" };
            $scope.BarItemSetting = [];
            $scope.BarItemSettingTemp = [];
        }
        else {
            if (BarItemSetting.value) {
                $scope.BarItemSetting = JSON.parse(BarItemSetting.value);
                $scope.BarItemSettingTemp = angular.copy($scope.BarItemSetting);
            } else {
                $scope.BarItemSetting = [];
                $scope.BarItemSettingTemp = [];
            }
        }

        var printSetting = SunoGlobal.featureActivations.find(function (s) { return s.name == 'printSetting' });
        if (printSetting && printSetting.value != "") {
            var ps = JSON.parse(printSetting.value);
            $scope.printSetting = ps;
            $scope.printSettingTemp = angular.copy($scope.printSetting);
            $scope.isUngroupItem = $scope.printSetting.unGroupItem;
        }
        else {
            $scope.printSetting = {
                'printSubmitOrder': false, //cờ này bị ngược -> not Print SubmitOrder
                'printNoticeKitchen': false,
                'prePrint': false,
                'unGroupItem': false,
                'noticeByStamps': false,
                'acceptSysMessage': true
            };
            $scope.printSettingTemp = angular.copy($scope.printSetting);
        }
    }

    //#endregion Bootloader


    //#region Initialize and update table structure
    $scope.openCreateTablesModal = function () {
        if ($scope.popoverSettings) $scope.popoverSettings.hide();
        $ionicModal.fromTemplateUrl('create-tables.html', {
            scope: $scope,
            animation: 'slide-in-up',
            backdropClickToClose: false
        }).then(function (modal) {
            $scope.modalCreateTables = modal;
            $scope.modalCreateTables.show();
        });
    }

    $scope.createInitTableZone = function (z, q, u) {
        if (!q) {
            return toaster.pop('warning', "", 'Vui lòng nhập đủ thông tin cần thiết để tạo sơ đồ bàn.');
        }
        var t = {
            id: $scope.tableMap.length,
            zone: z ? z : '',
            quantity: q,
            unit: u ? 'Phòng' : 'Bàn',
            unit2: u,
            isUpdating: false
        }
        $scope.modalCreateTables.zone = null;
        $scope.modalCreateTables.quantity = null;
        $scope.tableMap.push(t);
        // $scope.createTable();
    }

    $scope.showEditTable = false;
    $scope.editTableZone = function (index) {
        $scope.newTableMapTemp[index].isUpdating = true;
        $scope.newTableMapTemp[index].unit2 = $scope.newTableMapTemp[index].unit == 'Phòng' ? true : false;
    }

    $scope.removeTableZone = function (index) {
        $scope.tableMap.splice(index, 1);
    }

    $scope.saveChangeZone = function () {
        $scope.selectedZone.toogle ? $scope.selectedZone.unit = 'Phòng' : $scope.selectedZone.unit = 'Bàn';
        $scope.showEditTable = false;
    }

    $scope.checkInitTable = function () {
        var isManager = SunoGlobal.permissions.indexOf("POSIM_Setting_ViewCompanyInfo") > -1;

        //Nếu là cấp quản lý trở lên mới cho tạo phòng bàn.
        if (isManager) {
            $scope.openCreateTablesModal();
        } else {
            throw new SunoError("notsetting", 'Tài khoản nv, chưa có phòng bàn');
        }
    }

    $scope.createTable = function () {
        $ionicPopup.show({
            title: 'Thông báo',
            template: '<p style="text-align: center;">Để hoàn tất việc lưu sơ đồ phòng bàn, bạn phải thực hiện <b>RESET</b> dữ liệu, bấm xác nhận để thực hiện.</p><p style="text-align: center;">Nếu đang trong ca làm việc, bạn có thể thiết lập cấu hình vào cuối ca hoặc ca ngày hôm sau.</p>',
            buttons: [
                {
                    text: 'Hủy',
                    onTap: function (e) { }
                },
                {
                    text: '<b>Xác nhận</b>',
                    type: 'button-positive',
                    onTap: function (e) {

                        if (!$scope.tablesSetting) $scope.tablesSetting = [];
                        $scope.count = 1;
                        $scope.tables = [];
                        var tableTAW = {
                            tableUuid: uuid.v1(),
                            tableId: 0,
                            tableIdInZone: 0,
                            tableName: 'Mang về',
                            tableZone: {},
                            tableStatus: 0,
                            tableOrder: []
                        }
                        $scope.tables.push(tableTAW);
                        if ($scope.tableMap && $scope.tableMap.length > 0) {
                            for (var i = 0; i < $scope.tableMap.length; i++) {
                                if ($scope.tableMap[i].hasOwnProperty('unit2')) {
                                    delete $scope.tableMap[i].unit2;
                                }
                                if ($scope.tableMap[i].hasOwnProperty('isUpdating')) {
                                    delete $scope.tableMap[i].isUpdating;
                                }
                                for (var j = 0; j < $scope.tableMap[i].quantity; j++) {
                                    var count = j + 1;
                                    var t = {
                                        tableUuid: uuid.v1(),
                                        tableId: $scope.count++,
                                        tableIdInZone: count,
                                        tableName: $scope.tableMap[i].unit + ' ' + count + ' - ' + $scope.tableMap[i].zone,
                                        tableZone: $scope.tableMap[i],
                                        tableStatus: 0,
                                        tableOrder: []
                                    }
                                    $scope.tables.push(t);
                                }
                            }
                        }

                        var newTableZone = {
                            storeId: $scope.currentStore.storeID,
                            tables: $scope.tables,
                            zone: $scope.tableMap
                        };

                        var storeIndex = findIndex($scope.tablesSetting, 'storeId', $scope.currentStore.storeID);
                        if (storeIndex != null) {
                            $scope.tablesSetting[storeIndex] = newTableZone;
                        }
                        else {
                            $scope.tablesSetting.push(newTableZone);
                        }

                        var url = Api.postKeyValue;
                        var method = 'POST';
                        var data = {
                            "key": "tableSetting",
                            "value": JSON.stringify($scope.tablesSetting)
                        };

                        $unoRequest.makeRestful(url, method, data)
                            .then(function (data) {
                                $scope.tableIsSelected = $scope.tables[0];
                                $scope.orderIndexIsSelected = 0;
                                $scope.modalCreateTables.hide();
                                if (shiftID != null) {
                                    showStackNotification('Thông báo', '<p style="text-align:center;">Cập nhật sơ đồ bàn thành công.</p> <p style="text-align:center;">Ứng dụng sẽ tự động khởi động lại để áp dụng sơ đồ bàn mới.</p>', function () { endSessionWithoutConfirm('Tạo sơ đồ bàn.') });
                                }
                                else {
                                    showStackNotification('Thông báo', '<p style="text-align:center;">Cập nhật sơ đồ bàn thành công.</p> <p style="text-align:center;">Ứng dụng sẽ tự động khởi động lại để áp dụng sơ đồ bàn mới.</p>', handleCreatedTableSucessfully);
                                }
                            })
                            .catch(function (e) {
                                SUNOCONFIG.LOG(e);
                                toaster.pop('success', "", 'Có lỗi xảy ra, lưu sơ đồ bàn không thành công!');
                            });

                    }
                }
            ]
        });
    };

    $scope.updateTable = function () {
        $ionicPopup.show({
            title: 'Thông báo',
            template: '<p style="text-align: center;">Để hoàn tất việc lưu sơ đồ phòng bàn, bạn phải thực hiện <b>RESET</b> dữ liệu, bấm xác nhận để thực hiện.</p><p style="text-align: center;">Nếu đang trong ca làm việc, bạn có thể thiết lập cấu hình vào cuối ca hoặc ca ngày hôm sau.</p>',
            buttons: [
                {
                    text: 'Hủy',
                    onTap: function (e) { }
                },
                {
                    text: '<b>Xác nhận</b>',
                    type: 'button-positive',
                    onTap: function (e) {

                        if ($scope.newTableMap.length > 0) {
                            if ($scope.newTableMap.length == $scope.tableMap.length) {
                                var same = true;
                                for (var x = 0; x < $scope.newTableMap.length; x++) {
                                    if ($scope.newTableMap[x].quantity != $scope.tableMap[x].quantity
                                        || $scope.newTableMap[x].unit != $scope.tableMap[x].unit
                                        || $scope.newTableMap[x].zone != $scope.tableMap[x].zone) {
                                        same = false;
                                    }
                                }
                                if (same) {
                                    $scope.modalEditTables.hide();
                                    return;
                                }
                            }
                            $scope.newTables = [];
                            $scope.count = 1;
                            var tableTAW = {
                                tableUuid: uuid.v1(),
                                tableId: 0,
                                tableIdInZone: 0,
                                tableName: 'Mang về',
                                tableZone: {},
                                tableStatus: 0,
                                tableOrder: []
                            }
                            $scope.newTables.push(tableTAW);

                            for (var x = 0; x < $scope.newTableMap.length; x++) {
                                if ($scope.newTableMap[x].hasOwnProperty('unit2')) {
                                    delete $scope.newTableMap[x].unit2;
                                }
                                if ($scope.newTableMap[x].hasOwnProperty('isUpdating')) {
                                    delete $scope.newTableMap[x].isUpdating;
                                }
                            }

                            for (var i = 0; i < $scope.newTableMap.length; i++) {
                                for (var j = 0; j < $scope.newTableMap[i].quantity; j++) {
                                    var count = j + 1;
                                    var t = {
                                        tableUuid: uuid.v1(),
                                        tableId: $scope.count++,
                                        tableIdInZone: count,
                                        tableName: $scope.newTableMap[i].unit + ' ' + count + ' - ' + $scope.newTableMap[i].zone,
                                        tableZone: $scope.newTableMap[i],
                                        tableStatus: 0,
                                        tableOrder: []
                                    }
                                    $scope.newTables.push(t);
                                }
                            }

                            var newTablesSetting = angular.copy($scope.tablesSetting);
                            var storeIndex = findIndex(newTablesSetting, 'storeId', $scope.currentStore.storeID);

                            if (storeIndex != null) {
                                newTablesSetting[storeIndex] = {
                                    storeId: $scope.currentStore.storeID,
                                    tables: $scope.newTables,
                                    zone: $scope.newTableMap
                                }
                            } else {
                                newTablesSetting.push({
                                    storeId: $scope.currentStore.storeID,
                                    tables: $scope.newTables,
                                    zone: $scope.newTableMap
                                });
                            }

                            var url = Api.postKeyValue;
                            var method = 'POST';
                            var data = {
                                "key": "tableSetting",
                                "value": JSON.stringify(newTablesSetting)
                            };
                            $unoRequest.makeRestful(url, method, data)
                                .then(function (data) {
                                    endSessionWithoutConfirm('Cập nhật sơ đồ bàn.', function () {
                                        toaster.pop('success', '', 'Lưu sơ đồ bàn thành công!');
                                        if ($scope.modalEditTables) $scope.modalEditTables.hide();
                                    });
                                })
                                .catch(function (e) {
                                    toaster.pop('error', '', 'Lưu sơ đồ bàn không thành công!');
                                    SUNOCONFIG.LOG(e);
                                });
                        } else {
                            if ($scope.tableMap.length == 0) {
                                $scope.modalEditTables.hide();
                            }
                            else {
                                $scope.deleteTable();
                            }
                        }
                    }
                }
            ]
        });
    };

    var isValidTableQuantity = function (value) {
        if (Number.isInteger(parseInt(value)) && parseInt(value) > 0) {
            return true;
        }
        return false;
    }

    $scope.confirmTableZoneEditing = function (index) {
        //Nếu xác nhận thì chép từ bản tạm qua bản chính.
        if ($scope.newTableMapTemp[index].zone == null
            || $scope.newTableMapTemp[index].zone.trim() == ''
            || $scope.newTableMapTemp[index].quantity == null
            || !isValidTableQuantity($scope.newTableMapTemp[index].quantity)) {
            toaster.pop('warning', "", 'Vui lòng điền đầy đủ thông tin!');
            return;
        }
        $scope.newTableMapTemp[index].isUpdating = false;
        $scope.newTableMapTemp[index].unit = $scope.newTableMapTemp[index].unit2 ? 'Phòng' : 'Bàn';
        $scope.newTableMap[index] = angular.copy($scope.newTableMapTemp[index]);
    };

    $scope.cancelTableZoneEditing = function (index) {
        //Nếu hủy thao tác thì chép từ bản chính qua bản tạm lại.
        $scope.newTableMapTemp[index] = angular.copy($scope.newTableMap[index]);
        $scope.newTableMapTemp[index].isUpdating = false;
    };

    $scope.removeAllTableZone = function () {
        $scope.newTableMap = [];
        $scope.newTableMapTemp = [];
    };

    $scope.removeAllInitTableZone = function () {
        $scope.tableMap = [];
        $scope.tableMapTemp = [];
    };

    $scope.confirmTableZoneInitializing = function (index) {
        if ($scope.tableMapTemp[index].zone == null
            || $scope.tableMapTemp[index].zone.trim() == ''
            || $scope.tableMapTemp[index].quantity == null
            || !isValidTableQuantity($scope.tableMapTemp[index].quantity)) {
            toaster.pop('warning', "", 'Vui lòng điền đầy đủ thông tin!');
            return;
        }
        $scope.tableMapTemp[index].isUpdating = false;
        $scope.tableMap[index] = angular.copy($scope.tableMapTemp[index]);
    };

    $scope.editTableZoneInitializing = function (index) {
        $scope.tableMapTemp[index].isUpdating = true;
    };

    $scope.cancelTableZoneInitializing = function (index) {
        $scope.tableMapTemp[index] = angular.copy($scope.tableMap[index]);
        $scope.tableMapTemp[index].isUpdating = false;
    };

    $scope.removeTableZoneInitializingTablesModal = function (index) {
        $scope.tableMapTemp.splice(index, 1);
        $scope.tableMap.splice(index, 1);
    };

    $scope.addTableZone = function (zone, quantity, unit) {
        if (zone == null
            || zone.trim() == ''
            || quantity == null
            || !isValidTableQuantity(quantity)) {
            toaster.pop('warning', "", 'Vui lòng điền đầy đủ thông tin!');
            return;
        }
        if (!quantity) {
            return toaster.pop('warning', "", 'Vui lòng nhập đủ thông tin cần thiết để tạo sơ đồ bàn.');
        }
        var t = {
            id: $scope.tableMapTemp.length,
            zone: zone ? zone : '',
            quantity: quantity,
            unit: unit ? 'Phòng' : 'Bàn',
            isUpdating: false,
            unit2: unit
        };
        $scope.modalCreateTables.zone = null;
        $scope.modalCreateTables.quantity = null;
        $scope.tableMap.push(t);
        $scope.tableMapTemp.push(angular.copy(t));
    };

    $scope.closeCreateTableZone = function () {
        $scope.tableMapTemp = [];
        $scope.tableMap = [];
        $scope.modalCreateTables.hide();
        //Tắt khởi tạo bàn phòng
        if ($scope.tables.length == 0) {
            if (!$scope.tablesSetting) $scope.tablesSetting = [];
            var tableTAW = {
                tableUuid: uuid.v1(),
                tableId: 0,
                tableIdInZone: 0,
                tableName: 'Mang về',
                tableZone: {},
                tableStatus: 0,
                tableOrder: []
            }
            var newTableZone = {
                storeId: $scope.currentStore.storeID,
                tables: [tableTAW],
                zone: $scope.tableMap
            };

            var storeIndex = findIndex($scope.tablesSetting, 'storeId', $scope.currentStore.storeID);
            if (storeIndex != null) {
                $scope.tablesSetting[storeIndex] = newTableZone;
            }
            else {
                $scope.tablesSetting.push(newTableZone);
            }

            var url = Api.postKeyValue;
            var method = 'POST';
            var data = {
                "key": "tableSetting",
                "value": JSON.stringify($scope.tablesSetting)
            };

            $unoRequest.makeRestful(url, method, data)
                .then(function (data) {
                    showStackNotification('Thông báo', '<p style="text-align:center;">Hệ thống đang thực hiện cập nhật thông tin cho cửa hàng.</p> <p style="text-align:center;">Ứng dụng sẽ tự động khởi động lại.</p>', handleCreatedTableSucessfully);
                })
                .catch(function (e) {
                    SUNOCONFIG.LOG(e);
                });
        }
    };

    $scope.closeEditTableZone = function () {
        $scope.modalEditTables.hide();
    };

    $scope.removeAll = function (item, $event) {
        //if ($scope.isSync && !receivedAnyInitDataFromServer) {
        //    handleUnreadySocket();
        //    return;
        //}
        $scope.pinItem = null;
        $scope.selectedItem = item;
        $scope.checkRemoveItem(-$scope.selectedItem.quantity, $scope.selectedItem);
        $scope.selectedItem.changeQuantity = null;
        if ($event) {
            $event.stopPropagation();
            $event.preventDefault();
        }
    };

    $scope.openEditTablesModal = function () {
        if ($scope.tableMap.length > 0) {
            if ($scope.popoverSettings) $scope.popoverSettings.hide();
            $scope.newTableMap = [];
            $scope.newTables = [];
            $scope.newTableMapTemp = [];
            $scope.newTableTemp = [];
            angular.copy($scope.tableMap, $scope.newTableMap);
            angular.copy($scope.tables, $scope.newTables);
            angular.copy($scope.tableMap, $scope.newTableMapTemp);
            angular.copy($scope.tables, $scope.newTableTemp);
            for (var x = 0; x < $scope.newTableMapTemp.length; x++) {
                $scope.newTableMap[x].unit2 = $scope.newTableMap[x].unit == 'Phòng' ? true : false;
                $scope.newTableMap[x].isUpdating = false;
                $scope.newTableMapTemp[x].unit2 = $scope.newTableMapTemp[x].unit == 'Phòng' ? true : false;
                $scope.newTableMapTemp[x].isUpdating = false;
            }

            $ionicModal.fromTemplateUrl('edit-tables.html', {
                scope: $scope,
                animation: 'slide-in-up',
                backdropClickToClose: false
            }).then(function (modal) {
                $scope.modalEditTables = modal;
                $scope.modalEditTables.show();
            });
        }
        else {
            //$scope.modalCreateTables.show();
            $scope.openCreateTablesModal();
            if ($scope.popoverSettings) $scope.popoverSettings.hide();
        }
    }

    $scope.closeModalEditTables = function () {
        //$scope.modalEditTables.hide();
        $scope.updateTable();
    }

    //Kiểm tra đã lưu chưa và xác nhận ở màn hình Edit
    $scope.checkConfirmCloseEditModal = function () {
        if ($scope.newTableMap.length == $scope.tableMap.length) {
            var same = true;
            for (var x = 0; x < $scope.newTableMap.length; x++) {
                if ($scope.newTableMap[x].quantity != $scope.tableMap[x].quantity
                    || $scope.newTableMap[x].unit != $scope.tableMap[x].unit
                    || $scope.newTableMap[x].zone != $scope.tableMap[x].zone) {
                    same = false;
                }
            }
            if (same) {
                $scope.modalEditTables.hide();
                return;
            }
        }
    }

    $scope.editTableZoneEditTablesModal = function (index) {
        $scope.showEditTable = true;
        $scope.selectedZone = $scope.newTableMap[index];
        ($scope.selectedZone.unit == 'Bàn') ? $scope.selectedZone.toogle = false : $scope.selectedZone.toogle = true;
    }

    $scope.removeTableZoneEditTablesModal = function (index) {
        $scope.newTableMap.splice(index, 1);
        $scope.newTableMapTemp.splice(index, 1);
    }

    $scope.createTableZoneEditModal = function (z, q, u) {
        if (z == null
            || z.trim() == ''
            || q == null
            || !isValidTableQuantity(q)) {
            toaster.pop('warning', "", 'Vui lòng điền đầy đủ thông tin!');
            return;
        }
        if (!q) {
            return toaster.pop('warning', "", 'Vui lòng nhập đủ thông tin cần thiết để tạo sơ đồ bàn.');
        }
        var t = {
            id: $scope.newTableMap.length,
            zone: z ? z : '',
            quantity: q,
            unit: u ? 'Phòng' : 'Bàn',
            isUpdating: false,
            unit2: u
        }
        $scope.modalEditTables.zone = null;
        $scope.modalEditTables.quantity = null;
        $scope.newTableMap.push(t);
        $scope.newTableMapTemp.push(angular.copy(t));
    }

    $scope.deleteTable = function () {
        var url = Api.postKeyValue;
        var method = 'POST';
        var storeIndex = findIndex($scope.tablesSetting, 'storeId', $scope.currentStore.storeID);
        if (storeIndex != null) {
            $scope.tablesSetting.splice(storeIndex, 1);
        }
        var data = {
            "key": "tableSetting",
            "value": JSON.stringify($scope.tablesSetting)
        };
        $unoRequest.makeRestful(url, method, data)
            .then(function (data) {
                if ($scope.modalEditTables) $scope.modalEditTables.hide();
                endSessionWithoutConfirm('Cập nhật sơ đồ bàn.');
            })
            .catch(function (e) {
                SUNOCONFIG.LOG(e);
            });
    }

    //#endregion Initialize table structure


    //#region Initialize modals and action on modals.
    $ionicPopover.fromTemplateUrl('settings.html', {
        scope: $scope
    }).then(function (popover) {
        $scope.popoverSettings = popover;
    });

    $scope.openPopoverSettings = function (e) {
        $scope.popoverSettings.show(e);
    }

    $ionicPopover.fromTemplateUrl('store-list.html', {
        scope: $scope
    }).then(function (popover) {
        $scope.popoverStoreList = popover;
    });

    $ionicPopover.fromTemplateUrl('table-action.html', {
        scope: $scope
    }).then(function (popover) {
        $scope.popoverTableAction = popover;
    });

    $ionicPopover.fromTemplateUrl('paymentmethod.html', {
        scope: $scope
    }).then(function (popover) {
        $scope.popoverPaymentMethod = popover;
    });

    $scope.$on('modal.shown', function () {
        $scope.isUseKeyboard = false;
    });

    $ionicPopover.fromTemplateUrl('SupportPopOver', {
        scope: $scope
    }).then(function (popOver) {
        $scope.popOver = popOver;
    });

    $scope.earningPointPopOver = null;

    $ionicPopover.fromTemplateUrl('earningpoint.html', {
        scope: $scope
    }).then(function (popover) {
        $scope.earningPointPopOver = popover;
    });

    $scope.openPopOverStoreList = function (e) {
        $scope.popoverStoreList.show(e);
    }

    $scope.openSupportPopOver = function ($event) {
        $scope.popOver.show($event);
    }

    $scope.closeSupportPopOver = function ($event) {
        $scope.popOver.hide();
    }

    $scope.viewCommentPopOver = null;
    $ionicPopover.fromTemplateUrl('viewcomment.html', { scope: $scope })
        .then(function (modal) {
            $scope.viewCommentPopOver = modal;
        });

    $scope.openViewComment = function () {
        $scope.popoverTableAction.hide();
        $scope.viewCommentPopOver.show();
    }

    $scope.closeViewComment = function ($event) {
        $scope.viewCommentPopOver.hide();
    }

    //#endregion Initialize modals


    //#region Earning point

    $scope.openEarningPointPopOver = function ($event) {
        $scope.earningPointPopOver.show($event);
        $scope.earningPoint.subTotal = $unoSaleOrderCafe.saleOrder.total + $unoSaleOrderCafe.saleOrder.exchangedMoney;
        //$scope.earningPoint.total = $unoSaleOrderCafe.saleOrder.total;
        $scope.earningPoint.exchangePoint = $unoSaleOrderCafe.saleOrder.exchangedPoint;
        $scope.earningPoint.earningMoney = $unoSaleOrderCafe.saleOrder.exchangedMoney;
        $scope.earningPoint.total = $scope.earningPoint.subTotal - $scope.earningPoint.earningMoney;
    }

    $scope.closeEarningPointPopOver = function ($event) {
        $scope.earningPointPopOver.hide($event);
    }

    $scope.getMaxEarningPoint = function () {
        $scope.earningPoint.exchangePoint = $unoSaleOrderCafe.getMaxEarningPoint($unoSaleOrderCafe.saleOrder.customer.remainPoint);
        $scope.earningPoint.earningMoney = $unoSaleOrderCafe.calculateEarningMoney(parseFloat($scope.earningPoint.exchangePoint));
        $scope.earningPoint.total = $scope.earningPoint.subTotal - $scope.earningPoint.earningMoney;
    }

    $scope.calculateEarningMoney = function () {
        var maxPointCanExchange = $unoSaleOrderCafe.getMaxEarningPoint($unoSaleOrderCafe.saleOrder.customer.remainPoint);
        if ($scope.earningPoint.exchangePoint > maxPointCanExchange) {
            $scope.earningPoint.exchangePoint = maxPointCanExchange;
        }
        else if ($scope.earningPoint.exchangePoint < 0) {
            $scope.earningPoint.exchangePoint = 0;
        }
        var exchangePoint = $scope.earningPoint.exchangePoint;
        if (isNaN(parseFloat($scope.earningPoint.exchangePoint))) {
            exchangePoint = 0;
        }
        $scope.earningPoint.earningMoney = $unoSaleOrderCafe.calculateEarningMoney(exchangePoint);
        $scope.earningPoint.total = $scope.earningPoint.subTotal - $scope.earningPoint.earningMoney;
    }

    $scope.exchangeEarningPoint = function ($event) {
        var exchangePoint = $scope.earningPoint.exchangePoint;
        if (isNaN(parseFloat($scope.earningPoint.exchangePoint))) {
            exchangePoint = 0;
        }
        var result = $unoSaleOrderCafe.exchangeEarningPoint(exchangePoint);
        if (result.isSuccess) {
            $scope.earningPointPopOver.hide($event);
            resetAmountPaid();
            toaster.pop('success', '', 'Đổi điểm thành công');
        }
        else {
            $scope.earningPointPopOver.hide($event);
            toaster.pop('warning', '', result.description);
        }

        updateSelectedTableToDB();
    }

    var resetEarningPoint = function (retainEarningPointIfStillValid) {
        if (retainEarningPointIfStillValid) {
            if ($unoSaleOrderCafe.saleOrder.earningPointStatus == 1 && $unoSaleOrderCafe.saleOrder.total < 0) {
                toaster.pop('warning', 'Điểm tích lũy vừa reset về 0. Vui lòng kiểm tra lại.');
                $unoSaleOrderCafe.saleOrder.earningPointStatus = 0;
                $unoSaleOrderCafe.saleOrder.exchangedMoney = 0;
                $unoSaleOrderCafe.saleOrder.exchangedPoint = 0;
                $unoSaleOrderCafe.calculateTotal();
            }
        }
        else {
            $unoSaleOrderCafe.saleOrder.earningPointStatus = 0;
            $unoSaleOrderCafe.saleOrder.exchangedMoney = 0;
            $unoSaleOrderCafe.saleOrder.exchangedPoint = 0;
            $unoSaleOrderCafe.calculateTotal();
        }
    }

    //order này là saleOrder. Ko phải table order.
    var resetEarningPointForOrder = function (order, retainEarningPointIfStillValid) {
        if (retainEarningPointIfStillValid) {
            if (order.earningPointStatus == 1 && order.total < 0) {
                toaster.pop('warning', 'Điểm tích lũy vừa reset về 0. Vui lòng kiểm tra lại.');
                order.earningPointStatus = 0;
                order.exchangedMoney = 0;
                order.exchangedPoint = 0;
                $unoSaleOrderCafe.calculateTotal();
            }
        }
        else {
            order.earningPointStatus = 0;
            order.exchangedMoney = 0;
            order.exchangedPoint = 0;
            $unoSaleOrderCafe.calculateTotal();
        }
    }

    //#endregion earningPoint


    //#region Customer

    $scope.sugUserList = false;
    $scope.searchUserList = [];
    $scope.customerS = {
        key: null
    };
    $scope.searchCustomer = function () {
        if (!$scope.customerS.key) {
            $scope.sugUserList = false;
            return;
        }
        var limit = 20;
        var pageNo = 1;
        $unoCustomer.search($scope.customerS.key, limit, pageNo)
            .then(function (data) {
                $scope.searchUserList = data.items;
                $scope.$apply();
            })
            .catch(function (e) {
                SUNOCONFIG.LOG(e);
                toaster.pop('error', "", error.responseStatus.message);
            })
        $scope.sugUserList = true;
    }

    $scope.addCustomer = function (customer) {
        customer.name = customer.customerName;
        $unoSaleOrderCafe.addCustomer(customer, function () { resetAmountPaid(); $scope.$apply(); updateSelectedTableToDB(); });

        $scope.sugUserList = false;
        $scope.customerS = { key: null };

        resetAmountPaid();
        updateSelectedTableToDB();
    }

    $scope.removeCustomer = function () {
        $unoSaleOrderCafe.removeCustomer(function () { resetAmountPaid(); $scope.$apply(); updateSelectedTableToDB(); });
        //reset AmountPaid
        resetAmountPaid();
        updateSelectedTableToDB();
    }

    $scope.openModalCreateCustomer = function () {
        $ionicModal.fromTemplateUrl('create-new-customer.html', {
            scope: $scope,
            animation: 'slide-in-up'
        }).then(function (modal) {
            $scope.modalCreateCustomer = modal;
            $scope.customer = new Object();
            $scope.sugUserList = false;
            $scope.customerS = { key: null };
            $scope.modalCreateCustomer.show();
        });
    }

    $scope.closeModalCreateCustomer = function () {
        $scope.modalCreateCustomer.hide();
    }

    $scope.closeModalCustomer = function () {
        $scope.modalCreateCustomer.hide();
    }

    $scope.saveCustomer = function (customer) {
        //validate thông tin khách hàng
        if (customer.birthday) {
            var birthday = customer.birthday.getTime();
            var now = new Date().getTime();
            if (birthday > now) {
                return toaster.pop('warning', 'Ngày sinh không hợp lệ, vui lòng kiểm tra lại.');
            }
        }
        var url = Api.addCustomer;
        var method = 'POST';
        var d = {
            customer: customer
        }
        $unoRequest.makeRestful(url, method, d)
            .then(function (data) {
                customer.customerId = data.customerId;
                customer.code = data.code;
                customer.remainPoint = 0;
                customer.customerName = customer.name;
                //$scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.customer = c;
                $unoSaleOrderCafe.addCustomer(customer, function () { resetAmountPaid(); $scope.$apply(); updateSelectedTableToDB(); });
                resetAmountPaid();
                updateSelectedTableToDB();
                toaster.pop('success', "", 'Đã thêm khách hàng mới thành công.');
                $scope.modalCreateCustomer.hide();
            })
            .catch(function (e) {
                toaster.pop('error', "", error.responseStatus.message);
            });
    }

    //#endregion customer


    //#region Payment, discount and amountpaid

    //Hàm cập nhật lại amountPaid tự động nếu người dùng chưa thao tác.
    $scope.showOrderDiscount = false;

    $scope.openOrderDiscount = function () {
        $scope.showOrderDiscount = !$scope.showOrderDiscount;
    }

    var resetAmountPaid = function () {
        resetAmountPaidForOrder($unoSaleOrderCafe.saleOrder);
    }

    var resetAmountPaidForOrder = function (order) {
        if (!order.wasAmountPaidChangedByUser) {
            order.amountPaid = order.total;
            //order.receiptVouchers[0].amount = order.amountPaid;
            //order.receiptVouchers[1].amount = 0;
        }
        order.paymentBalance = Math.max(order.total - order.amountPaid, 0);
        var max = null;
        //Nếu tổng tiền cần thanh toán > tiền đã trả thì max là tiền đã trả
        if (order.total > order.amountPaid) {
            max = order.amountPaid;
        }
        //Nếu tổng tiền cần thanh toán <= tiền đã trả thì max là tiền cần thanh toán
        else {
            max = order.total;
        }
        //Phân phối lại cho cân bằng giữa tiền mặt và thẻ.
        distributeAmount(order, max);
    }

    //Hàm thực hiện thay đổi giá trị receipt Voucher. (callback ng-change)
    $scope.changeAmountReceiptVoucher = function (voucherIndex) {
        //$unoSaleOrderCafe.saleOrder.wasAmountPaidChangedByUser = true;
        var max = null;
        if ($unoSaleOrderCafe.saleOrder.total > $unoSaleOrderCafe.saleOrder.amountPaid) {
            max = $unoSaleOrderCafe.saleOrder.amountPaid;
        }
        else {
            max = $unoSaleOrderCafe.saleOrder.total;
        }
        if (voucherIndex == 0) {
            calculateAmountReceiptVoucher(0, 1, max);
        }
        else if (voucherIndex == 1) {
            calculateAmountReceiptVoucher(1, 0, max);
        }
        updateSelectedTableToDB();
    }

    //Hàm tính toán lại giá trị các receipt Voucher theo max
    var calculateAmountReceiptVoucher = function (x, y, max) {
        if ($unoSaleOrderCafe.saleOrder.receiptVouchers[x].amount > max) {
            $unoSaleOrderCafe.saleOrder.receiptVouchers[x].amount = max;
        }
        else if ($unoSaleOrderCafe.saleOrder.receiptVouchers[x].amount < 0) {
            $unoSaleOrderCafe.saleOrder.receiptVouchers[x].amount = 0;
        }
        $unoSaleOrderCafe.saleOrder.receiptVouchers[y].amount = max - $unoSaleOrderCafe.saleOrder.receiptVouchers[x].amount
    }

    //Hàm cập nhật amountPaid (callback ng-change)
    $scope.changeAmountPaid = function () {
        $unoSaleOrderCafe.saleOrder.wasAmountPaidChangedByUser = true;
        var max = null;
        //Nếu tổng tiền cần thanh toán > tiền đã trả thì max là tiền đã trả
        if ($unoSaleOrderCafe.saleOrder.total > $unoSaleOrderCafe.saleOrder.amountPaid) {
            max = $unoSaleOrderCafe.saleOrder.amountPaid;
        }
        //Nếu tổng tiền cần thanh toán <= tiền đã trả thì max là tiền cần thanh toán
        else {
            max = $unoSaleOrderCafe.saleOrder.total;
        }
        $unoSaleOrderCafe.saleOrder.paymentBalance = Math.max($unoSaleOrderCafe.saleOrder.total - $unoSaleOrderCafe.saleOrder.amountPaid, 0);
        //Phân phối lại cho cân bằng giữa tiền mặt và thẻ.
        distributeAmount($unoSaleOrderCafe.saleOrder, max);
        updateSelectedTableToDB();
    }

    //Hàm phân bổ amount cho các hình thức thanh toán.
    var distributeAmount = function (order, max) {
        //Nếu có trả bằng thẻ
        if (order.receiptVouchers[1].amount > 0) {
            var sum = order.receiptVouchers[0].amount + order.receiptVouchers[1].amount;
            //Nếu tổng 2 hình thức < max thì bổ sung thêm vào tiền mặt cho bằng max.
            if (sum < max) {
                order.receiptVouchers[0].amount += max - sum;
            }
            //Nếu tổng 2 hình thức >= max
            else {
                //Nếu tiền mặt đủ trừ thì trừ của tiền mặt
                if ((sum - max) <= order.receiptVouchers[0].amount) {
                    order.receiptVouchers[0].amount -= sum - max;
                }
                //Nếu tiền mặt ko đủ trừ thì trừ tiền mặt và trừ thêm vào của thẻ, và cho tiền mặt về 0.
                else {
                    order.receiptVouchers[1].amount -= sum - max - order.receiptVouchers[0].amount;
                    order.receiptVouchers[0].amount = 0;
                }
            }
        }
        //Nếu ko trả bằng thẻ thì gán max cho tiền mặt
        else {
            order.receiptVouchers[0].amount = max;
        }
    }

    var addReceiptVoucher = function () {
        var cashVoucher = $unoSaleOrderCafe.generateReceiptVoucher();
        var cardVoucher = $unoSaleOrderCafe.generateReceiptVoucher();
        cardVoucher.paymentMethodId = $unoSaleOrderCafe.paymentMethod.card;
        $unoSaleOrderCafe.addReceiptVoucher(cashVoucher);
        $unoSaleOrderCafe.addReceiptVoucher(cardVoucher);
    }

    //Hàm tính tiền dựa trên giảm giá.
    $scope.discountItem = function () {
        if ($scope.selectedItem.isDiscountPercent) {
            if ($scope.selectedItem.discountPercent > 100) {
                $scope.selectedItem.discountPercent = 100;
            } else if ($scope.selectedItem.discountPercent < 0) {
                $scope.selectedItem.discountPercent = 0;
            } else if (isNaN(parseFloat($scope.selectedItem.discountPercent))) {
                $scope.selectedItem.discountPercent = 0;
            }
            $unoSaleOrderCafe.calculatePriceOnItem($scope.selectedItem, true, $scope.selectedItem.discountPercent);
        } else {
            if ($scope.selectedItem.discount < 0) {
                $scope.selectedItem.discount = 0;
            }
            else if (isNaN(parseFloat($scope.selectedItem.discount))) {
                $scope.selectedItem.discount = 0;
            }
            $unoSaleOrderCafe.calculatePriceOnItem($scope.selectedItem, false, $scope.selectedItem.discount);
        }
        //reset lại EarningPoint
        resetEarningPoint(false);
        //Tính lại tiền
        //$unoSaleOrderCafe.calculateTotal();
        //reset lại amountpaid
        resetAmountPaid();
        //Cập nhật DB Local
        updateSelectedTableToDB();
    }

    $scope.discountOrder = function () {
        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.isDiscountPercent) {
            if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.discountPercent > 100) {
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.discountPercent = 100;
            } else if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.discountPercent < 0) {
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.discountPercent = 0;
            }
            $unoSaleOrderCafe.changeDiscount(true, $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.discountPercent);
        }
        else {
            if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.discount < 0) {
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.discount = 0;
            }
            $unoSaleOrderCafe.changeDiscount(false, $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.discount);
        }
        resetAmountPaid();
        //Cập nhật DB Local
        updateSelectedTableToDB();

    }

    $scope.changeSubFee = function () {
        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.isSubFeePercent) {
            if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFeePercent > 100) {
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFeePercent = 100;
            } else if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFeePercent < 0) {
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFeePercent = 0;
            }
            var subFee = ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subTotal * $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFeePercent) / 100;
            $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFee = subFee;
        }
        else {
            if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFee < 0) {
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFee = 0;
            }
            var subFeePercent = ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFee / $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subTotal) * 100;
            $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFeePercent = subFeePercent;
        }
        //Tính lại tiền
        $unoSaleOrderCafe.calculateTotal();
        resetAmountPaid();
        //Cập nhật DB Local
        updateSelectedTableToDB();
    }

    $scope.changeItemPrice = function (price) {
        if (!price || price == 0) {
            return toaster.pop('warning', "", 'Vui lòng kiểm tra lại giá bán mới.');
        } else {
            //$scope.selectedItem.unitPrice = parseFloat(price);
            $unoSaleOrderCafe.changeNewPriceOnItem($scope.selectedItem.itemId, price);
            //reset EarningPoint
            resetEarningPoint(false);
            //reset AmountPaid
            resetAmountPaid();
            updateSelectedTableToDB();
        }
    }
    //#endregion payment


    //#region Promotion

    $scope.promotionPopOver = null;
    $scope.openPromotionPopOver = function () {
        $ionicModal.fromTemplateUrl('promotion.html', {
            scope: $scope,
            animation: 'slide-in-up',
            backdropClickToClose: true
        }).then(function (modal) {
            $scope.promotionPopOver = modal;
            $scope.promotionPopOver.show();
            if (SunoGlobal.saleSetting.isApplyPromotion) {
                //Clone data cho promotion Object.
                $scope.promotion.itemList = [];
                $scope.promotion.promotionType = $unoSaleOrderCafe.saleOrder.promotionType;
                $scope.promotion.promotionOnBill = angular.copy($unoSaleOrderCafe.saleOrder.promotionOnBill);
                $scope.promotion.discountMoney = 0;
                $scope.promotion.promotionCode = '';
                //Khởi tạo data source cho từng detail
                $unoSaleOrderCafe.saleOrder.orderDetails.forEach(function (detail) {
                    var promotionOnItem = $unoSaleOrderCafe.getPromotionByItem(detail.itemId);
                    if (promotionOnItem.length > 0) {
                        //clone detail ra để ko tác động tới detail của saleOrder hiện tại.
                        var d = angular.copy(detail);
                        d.promotionOnItem = angular.copy(promotionOnItem);
                        //Nếu là promotion trên đơn hàng thì thêm Không áp dụng cho item
                        if ($scope.promotion.promotionType > 1) {
                            d.promotionOnItem.unshift({ promotionId: 0, promotionLabel: 'Không áp dụng' });
                            d.promotionOnItemSelected = d.promotionOnItem[0];
                        }
                        //Nếu là promotion trên item thì trỏ selected lại promotion đang chọn.
                        else {
                            d.promotionOnItemSelected = d.promotionOnItem.find(function (p) { return p.promotionId == detail.promotionOnItemSelected.promotionId });
                        };
                        d.discount = d.discount * d.quantity;
                        //Thêm label cho promotion
                        d.promotionOnItem.forEach(function (p) {
                            if (!p.promotionLabel) {
                                p.promotionLabel = p.promotionName + ' - Giảm ' + (p.isPercent ? p.discountPercent + '%' : p.discountPrice + 'đ');
                            }
                        });
                        //$scope.changePromotionOnItem(d);
                        $scope.promotion.itemList.push(d);
                    }
                });

                //Nếu là promotion trên hàng hóa thì thêm Không áp dụng hóa đơn
                if ($scope.promotion.promotionType == 1) {
                    $scope.promotion.promotionOnBill.unshift({ promotionId: 0, promotionLabel: 'Không áp dụng' });
                    $scope.promotion.promotionOnBillSelected = $scope.promotion.promotionOnBill[0];
                    //Tính tiền giảm giá
                    $scope.promotion.itemList.forEach(function (d) {
                        $scope.promotion.discountMoney += d.discount;
                    });
                    $scope.promotion.subTotal = $unoSaleOrderCafe.saleOrder.total + $scope.promotion.discountMoney;
                    $scope.promotion.total = $unoSaleOrderCafe.saleOrder.total;
                }
                //Nếu là promotion trên đơn hàng
                else if ($scope.promotion.promotionType > 1) {
                    //Gán promotionOnBillSelected cho đúng reference. 
                    var promotion = $scope.promotion.promotionOnBill.find(function (p) {
                        return $unoSaleOrderCafe.saleOrder.promotionOnBillSelected.promotionId == p.promotionId;
                    });
                    $scope.promotion.promotionOnBillSelected = promotion;

                    //Tính tiền giảm giá
                    $scope.promotion.discountMoney = $unoSaleOrderCafe.saleOrder.discount;
                    $scope.promotion.subTotal = $unoSaleOrderCafe.saleOrder.total + $scope.promotion.discountMoney;
                    $scope.promotion.total = $unoSaleOrderCafe.saleOrder.total;
                }

                //Thêm label cho promotion
                $scope.promotion.promotionOnBill.forEach(function (p) {
                    if (!p.promotionLabel) {
                        p.promotionLabel = p.promotionName + ' - Giảm ' + (p.isPercent ? p.discountPercent + '%' : p.discountPrice + 'đ');
                    }
                });
            }
        });
    }

    $scope.closePromotionPopOver = function ($event) {
        $scope.promotionPopOver.hide()
            .then(function () {
            })
    }

    //Áp dụng promotion tối ưu
    $scope.getOptimalPromotion = function () {
        resetEarningPoint(false);
        $unoSaleOrderCafe.calculatePromotion();
        $unoSaleOrderCafe.applyPromotion();
        resetAmountPaid();
        $scope.promotionPopOver.hide();
    }

    //Áp dụng cấu hình promotion hiện tại ở promotion modal cho order
    $scope.applyOptionPromotion = function () {
        //Promotion trên hàng hóa
        if ($scope.promotion.promotionType == 1) {
            var selectedOnItemPromotions = [];
            for (var x = 0; x < $scope.promotion.itemList.length; x++) {
                selectedOnItemPromotions.push($scope.promotion.itemList[x].promotionOnItemSelected);
            }
            $unoSaleOrderCafe.applyPromotionOnItem(selectedOnItemPromotions);
            //reset earning Point
            resetEarningPoint(false);
            //reset AmountPaid
            resetAmountPaid();
            toaster.pop('success', '', 'Áp dụng CTKM thành công');
            $scope.promotionPopOver.hide();
        }
        //Promotion trên hóa đơn
        else if ($scope.promotion.promotionType == 2) {
            var selectedOnBillPromotion = $scope.promotion.promotionOnBillSelected;
            //Nếu không phải promotion nhập code
            if (!selectedOnBillPromotion.isCodeRequired) {
                $unoSaleOrderCafe.applyPromotionOnBill(selectedOnBillPromotion);
                //reset earning Point
                resetEarningPoint(false);
                //reset AmountPaid
                resetAmountPaid();
                toaster.pop('success', '', 'Áp dụng CTKM thành công');
                $scope.promotionPopOver.hide();
            }
            //Nếu là promotion nhập code.
            else {
                $unoSaleOrderCafe.applyPromotionCode($scope.promotion.promotionCode, selectedOnBillPromotion)
                    .then(function () {
                        //reset earning Point
                        resetEarningPoint(false);
                        //reset AmountPaid
                        resetAmountPaid();
                        toaster.pop('success', '', 'Áp dụng CTKM thành công');
                        $scope.promotionPopOver.hide();
                    })
                    .catch(function (e) {
                        toaster.pop('warning', '', 'Mã khuyến mãi không hợp lệ. Vui lòng kiểm tra lại');
                    })
            }
        }
    }

    //Thay đổi lựa chọn promotion trên item
    $scope.changePromotionOnItem = function (item) {
        //Nếu mới chuyển từ option 'Không áp dụng' sang các options khác.
        if (item.promotionOnItem[0].promotionId == 0) {
            for (var x = 0; x < $scope.promotion.itemList.length; x++) {
                if ($scope.promotion.itemList[x] !== item) {
                    //Lấy phần thử đầu tiên cho các dropdown khác trừ option người dùng chọn (chỗ này có thể lấy optimal promotion cho các dropdown khác)
                    $scope.promotion.itemList[x].promotionOnItemSelected = $scope.promotion.itemList[x].promotionOnItem[1];
                }
                $scope.promotion.itemList[x].promotionOnItem.splice(0, 1);

                //Tính lại tiền giảm cho mỗi item
                if ($scope.promotion.itemList[x].promotionOnItemSelected.isPercent) {
                    $scope.promotion.itemList[x].discount = Math.round(($scope.promotion.itemList[x].unitPrice * $scope.promotion.itemList[x].promotionOnItemSelected.discountPercent) / 100) * $scope.promotion.itemList[x].quantity;
                } else {
                    $scope.promotion.itemList[x].discount = Math.round($scope.promotion.itemList[x].promotionOnItemSelected.discountPrice * $scope.promotion.itemList[x].quantity);
                }
            }
            //Thêm option 'Không áp dụng' cho danh sách dropdown promotion đơn hàng.
            var option = { promotionId: 0, promotionLabel: 'Không áp dụng' };
            $scope.promotion.promotionOnBill.unshift(option);
            $scope.promotion.promotionOnBillSelected = $scope.promotion.promotionOnBill[0];
        }
        //Nếu không phải chuyển từ option 'Không áp dụng' sang các options khác.
        else {
            //Tính lại tiền giảm cho item đó.
            if (item.promotionOnItemSelected.isPercent) {
                item.discount = Math.round((item.unitPrice * item.promotionOnItemSelected.discountPercent) / 100) * item.quantity;
            } else {
                item.discount = item.promotionOnItemSelected.discountPrice * item.quantity;
            }
        }

        //Tính lại tiền giảm giá
        $scope.promotion.discountMoney = 0;
        $scope.promotion.itemList.forEach(function (i) {
            $scope.promotion.discountMoney += i.discount;
        });

        $scope.promotion.total = $scope.promotion.subTotal - $scope.promotion.discountMoney;
        $scope.promotion.promotionType = 1;
    }

    //Thay đổi lựa chọn promotion trên hóa đơn
    $scope.changePromotionOnBill = function () {
        //Nếu mới chuyển từ option 'Không áp dụng' sang các options khác.
        if ($scope.promotion.promotionOnBill[0].promotionId == 0) {
            $scope.promotion.promotionOnBill.splice(0, 1);
            //Thêm option không áp dụng cho các dropdown của item
            $scope.promotion.itemList.forEach(function (order) {
                var option = { promotionId: 0, promotionLabel: 'Không áp dụng' };
                order.promotionOnItem.unshift(option);
                order.promotionOnItemSelected = order.promotionOnItem[0];
            });
            //Đặt lại discount bằng 0 cho item.
            $scope.promotion.itemList.forEach(function (item) {
                item.discount = 0;
            });
        }

        //Tính lại tiền giảm giá
        if ($scope.promotion.promotionOnBillSelected.isPercent) {
            $scope.promotion.discountMoney = Math.round($scope.promotion.subTotal * $scope.promotion.promotionOnBillSelected.discountPercent / 100);
            $scope.promotion.total = $scope.promotion.subTotal - $scope.promotion.discountMoney;
        }
        else {
            $scope.promotion.discountMoney = $scope.promotion.promotionOnBillSelected.discountPrice//Math.round($scope.promotion.subTotal - $scope.promotion.promotionOnBillSelected.discountPrice);
            $scope.promotion.total = $scope.promotion.subTotal - $scope.promotion.discountMoney;
        }
        $scope.promotion.promotionType = 2;
    }

    //#endregion promotion


    //#region Action

    //Hàm đổi cửa hàng
    $scope.changeCurrentStore = function (s) {
        DBSettings.$getDocByID({ _id: 'currentStore' })
            .then(function (data) {
                if (data.docs.length > 0) {
                    return DBSettings.$addDoc({ _id: data.docs[0]._id, _rev: data.docs[0]._rev, currentStore: s });
                }
                else {
                    return DBSettings.$addDoc({ _id: 'currentStore', currentStore: s });
                }
            })
            .then(function (data) {
                //SUNOCONFIG.LOG(data);
                //log for debugging;
                window.location.reload(true);
            })
            .catch(function (error) {
                SUNOCONFIG.LOG(error);
            })
    }

    //Hàm chuyển giao diện và các xử lý liên quan khi chuyển giao diện.
    $scope.switchLayout = function () {
        //Khi đang ở bàn thì chuyển món, đồng thời tạo order nếu chưa có order
        if ($scope.isInTable) {
            //Chuyển giao diện
            $scope.isInTable = false;
            //Xử lý thêm order mới nếu trống.
            if ($scope.tableIsSelected.tableOrder.length == 0) {
                createFirstOrder();
            }
            else {
                //Trỏ lại mặc định là order thứ 1.
                $scope.orderIndexIsSelected = 0;
                $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[0].saleOrder.saleOrderUuid);
            }
            if (SunoGlobal.printer.ordering != 'desc') {
                $ionicScrollDelegate.$getByHandle('orders-details').scrollBottom();
            }
        }
        //Khi đang ở món thì chuyển sang bàn
        else {
            $scope.isInTable = true;
        }
        $scope.pinItem = null;
        //Build lại index cho đúng với từng context
        buildHotKeyIndex();
        //Cấu hình lại
        $scope.showOption = false;
        checkingCombination();
    }

    //Ẩn hiện khu vực/category.
    $scope.collapseSidebar = function () {
        $scope.showCategories = !$scope.showCategories;
        buildHotKeyIndex();
    }

    $scope.buttonStatus = null;
    $scope.currentZone = {};
    $scope.filterTables = function (k, z) {
        buildHotKeyIndex();
        $ionicScrollDelegate.$getByHandle('tables').scrollTop();
        switch (k) {
            case 'status':
                $scope.buttonStatus = z;
                $scope.currentZone = {
                    tableStatus: z
                };
                $scope.isInTable = true;
                break;
            case 'zone':
                // SUNOCONFIG.LOG(z);
                var filterObject = {
                    id: z.id,
                    quantity: z.quantity,
                    unit: z.unit,
                    zone: z.zone
                }
                $scope.buttonStatus = z;
                $scope.currentZone = {
                    tableZone: filterObject
                };
                break;

            default:
                $scope.buttonStatus = null;
                $scope.currentZone = {};
        }
    }

    $scope.openTable = function (t) {
        //Trỏ lại table đó.
        $scope.tableIsSelected = t;
        $scope.pinItem = null;
        $scope.switchLayout();
        checkingCombination();
    }

    $scope.openTableTakeAway = function () {
        $scope.tableIsSelected = $scope.tables[0];
        $scope.pinItem = null;
        $scope.switchLayout();
        checkingCombination();
    }

    $scope.tableAction = function (e) {
        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length > 0) {
            $scope.popoverTableAction.show(e);
        }
    }

    // Doi ban  
    $scope.openModalSwitchTable = function () {
        if ($scope.isSync) {
            if (!isSocketConnected) {
                toaster.pop('error', '', 'Đã mất kết nối internet. Các thao tác liên quan đến đổi bàn, ghép hóa đơn có thể khiến dữ liệu đồng bộ bị sai lệch. Vui lòng kết nối internet hoặc sử dụng thiết bị khác có kết nối internet ổn định để thực hiện thao tác này.');
            }
        }

        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId && !$scope.isManager) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }
        var isExistingUnnoticedItem = false;
        for (var x = 0; x < $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length; x++) {
            var item = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails[x];
            if (item.newOrderCount > 0) {
                isExistingUnnoticedItem = true;
                break;
            }
        }
        if (isExistingUnnoticedItem) {
            return toaster.pop({
                type: 'warning',
                title: '',
                body: 'Có món chưa báo bếp, vui lòng báo bếp hoặc xóa món ra khỏi đơn hàng trước khi chuyển bàn',
                timeout: 5000
            });
        }

        $scope.popoverTableAction.hide();
        $ionicModal.fromTemplateUrl('switch-tables.html', {
            scope: $scope,
            animation: 'slide-in-up'
        }).then(function (modal) {
            $scope.modalSwitchTable = modal;
            $scope.modalSwitchTable.show();
        });
    }

    $scope.closeModalSwitchTable = function () {
        $scope.modalSwitchTable.hide();
    }

    $scope.changeTable = function (tableWillChange) {
        // lưu data bàn trước khi đổi
        var newTable = angular.copy(tableWillChange);
        var oldTable = angular.copy($scope.tableIsSelected);
        var oldOrderID = oldTable.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid;

        // Kiểm tra nếu bàn mới chưa có order nào thì khởi tạo order
        if (tableWillChange.tableOrder.length == 0) {
            tableWillChange.tableOrder.push({ saleOrder: null });
        }
        else {
            $unoSaleOrderCafe.deleteOrder(tableWillChange.tableOrder[0].saleOrder.saleOrderUuid);
            tableWillChange.tableOrder[0].saleOrder = null;
        }

        // chuyển dữ liệu từ bàn cũ sang bàn mới
        //Ko cần cập nhật sharedwith vì chuyển bàn thì dữ liệu đã có sẵn trc đó.
        //angular.copy(oldTable.tableOrder[$scope.orderIndexIsSelected], t.tableOrder[0]);
        tableWillChange.tableOrder[0].saleOrder = $unoSaleOrderCafe.saleOrder;

        // Chuyển status cho bàn mới thành active
        tableWillChange.tableStatus = 1;

        // xóa order cũ tại bàn cũ
        //angular.copy(saleOrder, $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
        $scope.tableIsSelected.tableOrder.splice($scope.orderIndexIsSelected, 1);

        // Chuyển deactive bàn cũ nếu bàn cũ không còn hóa đơn
        var isActive = tableIsActive($scope.tableIsSelected);
        $scope.tableIsSelected.tableStatus = isActive ? 1 : 0;

        //đổi bàn được chọn sang bàn mới và trỏ lại trong saleOrder prototype.
        $unoSaleOrderCafe.selectOrder(tableWillChange.tableOrder[0].saleOrder.saleOrderUuid);
        $scope.tableIsSelected = tableWillChange;
        $scope.orderIndexIsSelected = 0;
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.tableName = $scope.tableIsSelected.tableName;
        $scope.modalSwitchTable.hide();
        toaster.pop('success', "", 'Đã chuyển đơn hàng từ [' + oldTable.tableName + '] sang [' + newTable.tableName + ']');
        var timestamp = genTimestamp();
        if ($scope.isSync) {
            if (isSocketConnected) {
                var currentTable = angular.copy($scope.tableIsSelected);
                var tables = [];
                tables.push(currentTable);
                tables[0].tableOrder = [];
                tables[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
                var updateData = {
                    "companyId": SunoGlobal.companyInfo.companyId,
                    "storeId": $scope.currentStore.storeID,
                    "clientId": SunoGlobal.userProfile.sessionId,
                    "shiftId": shiftID,
                    //"startDate": "",
                    //"finishDate": "",
                    "fromTableUuid": oldTable.tableUuid,
                    "fromSaleOrderUuid": oldOrderID,
                    "tables": angular.copy(tables),
                    "zone": $scope.tableMap,
                    "info": {
                        author: SunoGlobal.userProfile.userId,
                        timestamp: timestamp,
                        deviceID: deviceID,
                        action: "CB",
                        isUngroupItem: $scope.isUngroupItem
                    }
                };
                SUNOCONFIG.LOG('moveData-changeTable', updateData);
                socket.emit('moveOrder', updateData);
            }
            else {
                handleDisconnectedSocket();
            }
        } else {
            //Lưu DB Local
            Promise.all([
                DBTables.$queryDoc({
                    selector: {
                        'store': { $eq: $scope.currentStore.storeID },
                        'tableUuid': { $eq: oldTable.tableUuid }
                    },
                    fields: ['_id', '_rev']
                }),
                DBTables.$queryDoc({
                    selector: {
                        'store': { $eq: $scope.currentStore.storeID },
                        'tableUuid': { $eq: $scope.tableIsSelected.tableUuid }
                    },
                    fields: ['_id', '_rev']
                })
            ])
                .then(function (data) {
                    var fromTable = angular.copy($scope.tables.find(function (t) { return t.tableUuid == oldTable.tableUuid }));
                    fromTable._id = data[0].docs[0]._id;
                    fromTable._rev = data[0].docs[0]._rev;
                    fromTable.store = $scope.currentStore.storeID;

                    var toTable = angular.copy($scope.tables.find(function (t) { return t.tableUuid == $scope.tableIsSelected.tableUuid }));
                    toTable._id = data[1].docs[0]._id;
                    toTable._rev = data[1].docs[0]._rev;
                    toTable.store = $scope.currentStore.storeID;

                    return DBTables.$manipulateBatchDoc([fromTable, toTable]);
                })
                .then(function (data) {
                    //log for debugging
                    //SUNOCONFIG.LOG(data);
                    return DBTables.$queryDoc({
                        selector: {
                            'store': { $eq: $scope.currentStore.storeID }
                        }
                    });
                })
                .then(function (data) {
                    //Log check data.
                    //SUNOCONFIG.LOG(data);
                })
                .catch(function (error) {
                    SUNOCONFIG.LOG(error);
                });
        }
        //SUNOCONFIG.LOG($unoSaleOrderCafe.saleOrder);
        checkingCombination();
    }

    $scope.endSession = function (callback) {
        if (!$scope.isManager) {
            return toaster.pop('error', '', 'Bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ quản lý để thực hiện');
        }
        if ($scope.isSync && !isSocketConnected) {
            return handleDisconnectedSocket();
        }
        $ionicPopup.show({
            title: 'Kết ca cuối ngày',
            subTitle: 'Tất cả thông tin hóa đơn sẽ được xóa hết và tồn quỹ đầu ca sẽ được thiết lập về 0.',
            scope: $scope,
            buttons: [{
                text: 'Trở lại'
            }, {
                text: '<b>Xác nhận</b>',
                type: 'button-positive',
                onTap: function (e) {
                    clearShiftTableZoneInLocal(function () {
                        $scope.updateBalance(0);
                        audit(5, 'Kết ca cuối ngày', '');
                        if ($scope.modalStoreReport) $scope.modalStoreReport.hide();

                        if (callback !== null && callback !== undefined && typeof callback === 'function') {
                            callback();
                        }

                        toaster.pop('success', "", 'Đã hoàn thành kết ca cuối ngày!');
                        if (!$scope.isSync) {
                            window.location.reload(true);
                        }
                        else {
                            var completeShift = {
                                "companyId": SunoGlobal.companyInfo.companyId,
                                "storeId": $scope.currentStore.storeID,
                                "clientId": SunoGlobal.userProfile.sessionId,
                                "shiftId": shiftID,
                                "info": {
                                    action: "completeShift",
                                    deviceID: deviceID,
                                    timestamp: genTimestamp(),
                                    author: SunoGlobal.userProfile.userId,
                                    isUngroupItem: $scope.isUngroupItem
                                }
                            }

                            SUNOCONFIG.LOG('dataCompleteShift', completeShift);
                            socket.emit('completeShift', completeShift);
                        }
                    });
                }
            }]
        });
    }

    //alert('loop');

    $scope.logout = function () {
        Promise.all([
            DBSettings.$removeDoc({ _id: 'SunoGlobal' })
            //DBSettings.$removeDoc({ _id: 'printDevice' }),
            //DBSettings.$removeDoc({ _id: 'printHelper' })
        ]).then(function (data) {
            $scope.isLoggedIn = false;
            $scope.popoverSettings.hide();
            $rootScope.isNeedToReload = true;
            if (socket) socket.disconnect();
            $state.go('login');
            $timeout(function () {
                window.location.reload(true);
            }, 50);
            //$state.go('login');
            //$timeout(function () {
            //    $ionicHistory.clearCache();
            //}, 200);
        })
    }

    var endSessionWithoutConfirm = function (auditContent, callback) {
        if (!$scope.isManager) {
            return toaster.pop('error', '', 'Tài khoản này không có quyền thực hiện KẾT CA hay RESET dữ liệu, vui lòng liên hệ quản lý để thực hiện thao tác này.');
        }
        if ($scope.isSync && !isSocketConnected) {
            return handleDisconnectedSocket();
        }
        auditContent = auditContent || 'Kết ca cuối ngày';
        clearShiftTableZoneInLocal(function () {
            $scope.updateBalance(0);
            audit(5, auditContent, '');

            if (callback !== null && callback !== undefined && typeof callback === 'function') {
                callback();
            }

            if (!$scope.isSync) {
                window.location.reload(true);
            }
            else {
                var completeShift = {
                    "companyId": SunoGlobal.companyInfo.companyId,
                    "storeId": $scope.currentStore.storeID,
                    "clientId": SunoGlobal.userProfile.sessionId,
                    "shiftId": shiftID,
                    "info": {
                        action: 'completeShift',
                        deviceID: deviceID,
                        timestamp: genTimestamp(),
                        author: SunoGlobal.userProfile.userId,
                        isUngroupItem: $scope.isUngroupItem
                    }
                };

                SUNOCONFIG.LOG('dataCompleteShift', completeShift);
                socket.emit('completeShift', completeShift);
            }
        });
    }

    var angularApply = function () {
        resetAmountPaid();
        $scope.$apply();
    }

    var convertTableV1ToV2 = function () {
        $scope.tablesSetting.forEach(function (setting) {
            setting.tables.forEach(function (tb) {
                tb.tableOrder = [];
            });
        });
    }
    //#endregion action


    //#region Order action

    //Hàm tạo 1 order mới đầu tiên cho bàn
    var createFirstOrder = function () {
        //Tạo order mới.
        createNewOrder();
        $scope.tableIsSelected.tableOrder.push({ saleOrder: $unoSaleOrderCafe.saleOrder });
        $scope.tableIsSelected.tableOrder[0].saleOrder.sharedWith.push({ deviceID: deviceID, userID: SunoGlobal.userProfile.userId });
        $scope.tableIsSelected.tableOrder[0].saleOrder.tableName = $scope.tableIsSelected.tableName;
        //Trỏ lại cho đúng với Prototype.
        $scope.orderIndexIsSelected = 0;
        //$unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
    }

    //Hàm tạo 1 order
    var createNewOrder = function () {
        $unoSaleOrderCafe.createNewOrder();
        $unoSaleOrderCafe.saleOrder.wasAmountPaidChangedByUser = false;
        addReceiptVoucher();
    }

    $scope.changeOrder = function (index, orderID) {
        $scope.showOrderDetails = false;
        $scope.showOption = false;
        if ($scope.orderIndexIsSelected == index) {
            if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.printed && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.printed.length > 0) {
                $scope.openModalPrintedList();
            }
        } else {
            $unoSaleOrderCafe.selectOrder(orderID);
            $scope.orderIndexIsSelected = index;
            $scope.pinItem = null;
            if (SunoGlobal.printer.ordering != 'desc') {
                $ionicScrollDelegate.$getByHandle('orders-details').scrollBottom();
            }
        }
    }

    // Ghep hoa don
    $scope.checkPairOrder = function (t) {
        if (t.tableId == $scope.tableIsSelected.tableId && t.tableOrder.length > 1 || t.tableId != $scope.tableIsSelected.tableId) {
            //if (t.tableOrder.length > 1) {
            return true;
        }
        return false;
    }

    $scope.checkCurrentOrder = function (index) {
        //Lọc ko ghép với hóa đơn hiện tại, ko ghép với hóa đơn rỗng, ko ghép với hóa đơn chưa báo bếp.
        if (($scope.currentTablePair.tableId == $scope.tableIsSelected.tableId && index == $scope.orderIndexIsSelected)
            || ($scope.currentTablePair.tableOrder[index] && $scope.currentTablePair.tableOrder[index].saleOrder.orderDetails.length == 0)
            //|| ($scope.currentTablePair.tableOrder[index] && $scope.currentTablePair.tableOrder[index].saleOrder.hasNotice)
        ) {
            return false;
        }
        return true;
    }

    $scope.openModalPairOrder = function () {
        if ($scope.isSync) {
            if (!isSocketConnected) {
                toaster.pop('error', '', 'Đã mất kết nối internet. Các thao tác liên quan đến đổi bàn, ghép hóa đơn có thể khiến dữ liệu đồng bộ bị sai lệch. Vui lòng kết nối internet hoặc sử dụng thiết bị khác có kết nối internet ổn định để thực hiện thao tác này.');
            }
        }
        var cantPrint = checkOrderPrintStatus($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
        if (cantPrint) {
            return toaster.pop('warning', "", 'Vui lòng hoàn tất gọi món (Thông báo cho bếp) trước khi thực hiện ghép hoá đơn!');
        }
        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId && !$scope.isManager) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }

        if (!cantPrint && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length > 0) {
            $ionicModal.fromTemplateUrl('pairing-order.html', {
                scope: $scope,
                animation: 'slide-in-up'
            }).then(function (modal) {
                $scope.modalPairOrder = modal;
                $scope.popoverTableAction.hide();
                $scope.modalPairOrder.show();
                $scope.selecteOrder = true;
            });
        }
    }

    $scope.closeModalPairOrder = function () {
        $scope.newTable = null;
        $scope.modalPairOrder.hide();
    }

    $scope.pairingOrder = function (t) {
        $scope.newTable = t;
        $scope.oldTable = $scope.tableIsSelected;

        $scope.currentTablePair = t;
        if (t.tableOrder.length > 1) {
            $scope.selecteOrder = false;
        } else {
            $scope.Pair(t.tableOrder[0], 0);
        }
    }

    $scope.Pair = function (o) {
        //validate
        if (o.saleOrder.hasNotice) {
            toaster.pop("warning", "", "Bạn chưa hoàn tất gọi món (thông báo cho bếp) ở hóa đơn sẽ ghép, vui lòng hoàn tất gọi món trước khi thực hiện ghép hóa đơn.");
            return;
        }

        if (hasTimer($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) || hasTimer(o)) {
            return toaster.pop('warning', "", 'Vui lòng ngừng tính giờ hàng hóa trước khi thực hiện ghép hoá đơn!');
        }

        var oldTable = angular.copy($scope.tableIsSelected);
        var oldOrderID = oldTable.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid;

        //Chuyển món từ order cũ sang order mới và thêm logs cho order mới được ghép.
        var logs = [];
        var timestamp = genTimestamp();
        for (var i = 0; i < $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length; i++) {
            var item = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails[i];
            if (!$scope.isUngroupItem) {
                logs.push(new Log(item.itemId, item.itemName, "BB", item.quantity, timestamp, deviceID, true));
                var itemIndex = findIndex(o.saleOrder.orderDetails, 'itemId', item.itemId);
                if (itemIndex != null) {
                    o.saleOrder.orderDetails[itemIndex].quantity += parseFloat(item.quantity);
                } else {
                    //item.quantity = 1;
                    o.saleOrder.orderDetails.push(item);
                }
            }
            else {
                logs.push(new UngroupLog(item.itemId, item.itemName, "BB", item.quantity, timestamp, deviceID, item.detailID, true));
                o.saleOrder.orderDetails.push(item);
            }
        }

        //Thêm printed của order cũ sang order mới.
        o.saleOrder.printed = o.saleOrder.printed.concat(oldTable.tableOrder[$scope.orderIndexIsSelected].saleOrder.printed);

        //Thêm logs cho order mới.
        o.saleOrder.logs = o.saleOrder.logs.concat(logs);

        //Xóa order cũ đi 
        $unoSaleOrderCafe.deleteOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
        $scope.tableIsSelected.tableOrder.splice($scope.orderIndexIsSelected, 1);

        //Kiểm tra table active.
        var isActive = tableIsActive($scope.tableIsSelected);
        $scope.tableIsSelected.tableStatus = isActive ? 1 : 0;

        //Gán bàn mới qua bàn được ghép
        $scope.tableIsSelected = $scope.newTable;

        //Kiếm index của order được ghép
        var index = $scope.tableIsSelected.tableOrder.indexOf(o);
        $scope.orderIndexIsSelected = index;

        //Trỏ lại saleOrder trong Prototype cho đúng với tableIsSelected và orderIndexIsSelected.
        $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
        toaster.pop('success', "", 'Đã chuyển đơn hàng từ [' + $scope.oldTable.tableName + '] sang [' + $scope.newTable.tableName + ']');
        $scope.newTable = null;

        if ($scope.isSync) {
            var currentTable = angular.copy($scope.tableIsSelected);
            var tables = [];
            tables.push(currentTable);
            tables[0].tableOrder = [];
            tables[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
            var updateData = {
                "companyId": SunoGlobal.companyInfo.companyId,
                "storeId": $scope.currentStore.storeID,
                "clientId": SunoGlobal.userProfile.sessionId,
                "shiftId": shiftID,
                //"startDate": "",
                //"finishDate": "",
                "fromTableUuid": oldTable.tableUuid,
                "fromSaleOrderUuid": oldOrderID,
                "tables": angular.copy(tables),
                "zone": $scope.tableMap,
                "info": {
                    author: SunoGlobal.userProfile.userId,
                    timestamp: timestamp,
                    deviceID: deviceID,
                    action: "G",
                    isUngroupItem: $scope.isUngroupItem
                }
            }
            SUNOCONFIG.LOG('moveData-pairOrder', updateData);
            socket.emit('moveOrder', updateData);

        } else {
            $unoSaleOrderCafe.deleteOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
            $unoSaleOrderCafe.calculateOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder, function () { resetAmountPaid(); $scope.$apply(); });
            resetAmountPaid();
            //Lưu DB Local
            Promise.all([
                DBTables.$queryDoc({
                    selector: {
                        'store': { $eq: $scope.currentStore.storeID },
                        'tableUuid': { $eq: oldTable.tableUuid }
                    },
                    fields: ['_id', '_rev']
                }),
                DBTables.$queryDoc({
                    selector: {
                        'store': { $eq: $scope.currentStore.storeID },
                        'tableUuid': { $eq: $scope.tableIsSelected.tableUuid }
                    },
                    fields: ['_id', '_rev']
                })
            ])
                .then(function (data) {
                    var fromTable = angular.copy($scope.tables.find(function (t) { return t.tableUuid == oldTable.tableUuid }));
                    fromTable._id = data[0].docs[0]._id;
                    fromTable._rev = data[0].docs[0]._rev;
                    fromTable.store = $scope.currentStore.storeID;

                    var toTable = angular.copy($scope.tables.find(function (t) { return t.tableUuid == $scope.tableIsSelected.tableUuid }));
                    toTable._id = data[1].docs[0]._id;
                    toTable._rev = data[1].docs[0]._rev;
                    toTable.store = $scope.currentStore.storeID;

                    return DBTables.$manipulateBatchDoc([fromTable, toTable]);
                })
                .then(function (data) {
                    //log for debugging
                    //SUNOCONFIG.LOG(data);
                    return DBTables.$queryDoc({
                        selector: {
                            'store': { $eq: $scope.currentStore.storeID }
                        }
                    });
                })
                .then(function (data) {
                    //Log check data.
                    //SUNOCONFIG.LOG(data);
                })
                .catch(function (error) {
                    SUNOCONFIG.LOG(error);
                });
        }

        $scope.modalPairOrder.hide();
        checkingCombination();
    }

    // Tach hoa don
    $scope.openModalSplitOrder = function () {
        var cantPrint = checkOrderPrintStatus($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
        if (cantPrint) {
            return toaster.pop('warning', "", 'Vui lòng hoàn tất gọi món (Thông báo cho bếp) trước khi thực hiện tách hoá đơn!');
        }

        if (hasTimer($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected])) {
            return toaster.pop('warning', "", 'Vui lòng ngừng tính giờ hàng hóa trước khi thực hiện tách hoá đơn!');
        }

        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId && !$scope.isManager) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }
        if (hasDecimalQuantity($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected])) {
            return toaster.pop('error', '', 'Phần mềm chưa hỗ trợ tách hóa đơn trên đơn hàng có số lượng thập phân');
        }
        if (!cantPrint && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length > 0) {
            $scope.popoverTableAction.hide();

            $ionicModal.fromTemplateUrl('split-order.html', {
                scope: $scope,
                animation: 'slide-in-up',
                backdropClickToClose: false
            }).then(function (modal) {
                $scope.modalSplitOrder = modal;
                $scope.leftOrder = angular.copy($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
                $scope.rightOrder = angular.copy($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
                $scope.rightOrder.orderDetails.forEach(function (d) {
                    d.quantity = 0;
                });
                $scope.modalSplitOrder.show();
            });
        }
    }

    $scope.closeModalSplitOrder = function () {
        $scope.cancelSplit();
    }

    $scope.pickToSplitOrder = function (item) {
        if (!$scope.isUngroupItem) {
            if (!item.isServiceItem) {
                //Trừ ở leftOrder
                item.quantity -= 1;
                //Cộng ở rightOrder
                var itemInRight = $scope.rightOrder.orderDetails.find(function (d) { return d.itemId == item.itemId });
                itemInRight.quantity += 1;
            }
            else {
                //Cộng ở rightOrder, gán thẳng luôn ko cần tìm index vì hàng tính giờ chỉ thêm đc 1 và ds.
                var itemInRight = $scope.rightOrder.orderDetails.find(function (d) { return d.itemId == item.itemId });
                itemInRight.quantity = item.quantity;
                //Trừ ở leftOrder
                //Cho số lượng bằng 0 luôn vì ở hàng tính giờ thì chỉ thêm đc 1 vào ds details.
                item.quantity = 0;
            }
        }
        else {
            //Trừ ở leftOrder
            if (!item.isChild) {
                var parent = $scope.rightOrder.orderDetails.find(function (d) { return d.detailID == item.detailID });
                parent.quantity = item.quantity;
                item.quantity = 0;
                var childItems = $scope.rightOrder.orderDetails.filter(function (d) { return d.isChild && d.parentID == item.detailID; });
                childItems.forEach(function (i) {
                    var itemInLeft = $scope.leftOrder.orderDetails.find(function (d) { return d.isChild && d.detailID == i.detailID });
                    i.quantity = itemInLeft.quantity;
                    itemInLeft.quantity = 0;
                });
            }
            else {
                var parent = $scope.rightOrder.orderDetails.find(function (d) { return d.detailID == item.parentID; });
                var parentInLeft = $scope.leftOrder.orderDetails.find(function (d) { return d.detailID == item.parentID });
                parent.quantity = parentInLeft.quantity;
                parentInLeft.quantity = 0;

                childItems = $scope.rightOrder.orderDetails.filter(function (d) { return d.isChild && d.parentID == parent.detailID; });
                childItems.forEach(function (i) {
                    var itemInLeft = $scope.leftOrder.orderDetails.find(function (d) { return d.isChild && d.detailID == i.detailID });
                    i.quantity = itemInLeft.quantity;
                    itemInLeft.quantity = 0;
                });
            }
        }
    }

    $scope.backToOrder = function (item) {
        if (!$scope.isUngroupItem) {
            if (!item.isServiceItem) {
                item.quantity -= 1;
                var thisItem = $scope.leftOrder.orderDetails.find(function (d) { return d.itemId == item.itemId; });
                thisItem.quantity += 1;
            }
            else {
                var thisItem = $scope.leftOrder.orderDetails.find(function (d) { return d.itemId == item.itemId; });
                thisItem.quantity = item.quantity;
                item.quantity = 0;
            }
        }
        else {
            if (!item.isChild) {
                var parent = $scope.leftOrder.orderDetails.find(function (d) { return d.detailID == item.detailID });
                parent.quantity = item.quantity;
                item.quantity = 0;
                var childItems = $scope.leftOrder.orderDetails.filter(function (d) { return d.isChild && d.parentID == item.detailID; });
                childItems.forEach(function (i) {
                    var itemInRight = $scope.rightOrder.orderDetails.find(function (d) { return d.isChild && d.detailID == i.detailID });
                    i.quantity = itemInRight.quantity;
                    itemInRight.quantity = 0;
                });
            }
            else {
                var parentInLeft = $scope.leftOrder.orderDetails.find(function (d) { return d.detailID == item.parentID; });
                var parentInRight = $scope.rightOrder.orderDetails.find(function (d) { return d.detailID == item.parentID });
                parentInLeft.quantity = parentInRight.quantity;
                parentInRight.quantity = 0;

                childItems = $scope.leftOrder.orderDetails.filter(function (d) { return d.isChild && d.parentID == parentInLeft.detailID; });
                childItems.forEach(function (i) {
                    var itemInRight = $scope.rightOrder.orderDetails.find(function (d) { return d.isChild && d.detailID == i.detailID });
                    i.quantity = itemInRight.quantity;
                    itemInRight.quantity = 0;
                });
            }
        }
    }

    $scope.cancelSplit = function () {
        $scope.leftOrder = null;
        $scope.rightOrder = null;

        $scope.modalSplitOrder.hide();
    }

    $scope.Split = function () {
        //$scope.leftOrder là order hiện tại.
        //$scope.rightOrder là order sẽ tách.

        //Validate lúc bấm nút tách hóa đơn.
        var index = $scope.rightOrder.orderDetails.findIndex(function (d) { return d.quantity > 0 });
        if (index < 0) return;
        index = $scope.leftOrder.orderDetails.findIndex(function (d) { return d.quantity > 0 });
        if (index < 0) return toaster.pop('error', '', 'Hóa đơn hiện đang thao tác và hóa đơn sẽ tách giống nhau. Tách hóa đơn không thành công. Vui lòng kiểm tra và thử lại.');

        //Cập nhật order cũ
        removeEmptyItem($scope.leftOrder);
        //- Cập nhật lại trong prototype
        //resetEarningPoint
        resetEarningPointForOrder($scope.leftOrder, false);
        $unoSaleOrderCafe.calculateOrder($scope.leftOrder, function () { resetAmountPaidForOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder); $scope.$apply(); });
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder = $scope.leftOrder;
        //reset lại tiền khách đưa nếu ko xài chương trình KM.
        resetAmountPaidForOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
        $scope.leftOrder = null;

        //Khởi tạo các thuộc tính cần thiết cho order mới
        var uuid = SunoGlobal.generateGUID();
        $scope.rightOrder.saleOrderUid = uuid;
        $scope.rightOrder.uid = uuid;
        $scope.rightOrder.saleOrderUuid = uuid;
        $scope.rightOrder.saleDate = new Date();
        $scope.rightOrder.startTime = new Date();

        //Cập nhật order mới.
        removeEmptyItem($scope.rightOrder);
        //- Thêm reference cho order trên table.
        $scope.tableIsSelected.tableOrder.push({ saleOrder: $scope.rightOrder });
        //reset EarningPoint
        resetEarningPointForOrder($scope.rightOrder, false);
        //- Thêm vào trong Prototype, ko cần gọi reset lần nữa vì add mới có gọi callback.
        $unoSaleOrderCafe.calculateOrder($scope.rightOrder, function () { resetAmountPaidForOrder($scope.tableIsSelected.tableOrder[$scope.tableIsSelected.tableOrder.length - 1].saleOrder); });
        $scope.rightOrder = null;

        //Chọn lại order ban đầu.
        $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);

        //Thêm logs cho order cũ và tính toán logs cho order mới.
        var logs = [];
        var timestamp = genTimestamp();
        $scope.tableIsSelected.tableOrder[$scope.tableIsSelected.tableOrder.length - 1].saleOrder.orderDetails.forEach(function (item) {
            if (!$scope.isUngroupItem) {
                logs.push(new Log(item.itemId, item.itemName, "BB", item.quantity, timestamp, deviceID, true));
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.logs.push(
                    new Log(item.itemId, item.itemName, "H", item.quantity, timestamp, deviceID, true));
            }
            else {
                logs.push(new UngroupLog(item.itemId, item.itemName, "BB", item.quantity, timestamp, deviceID, item.detailID, true));
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.logs.push(
                    new UngroupLog(item.itemId, item.itemName, "H", item.quantity, timestamp, deviceID, item.detailID, true));
            }
        });

        //Thêm logs và printed order mới tách.
        $scope.tableIsSelected.tableOrder[$scope.tableIsSelected.tableOrder.length - 1].saleOrder.logs = logs;
        $scope.tableIsSelected.tableOrder[$scope.tableIsSelected.tableOrder.length - 1].saleOrder.printed = [];
        toaster.pop('success', "", 'Đã tách hoá đơn [' + $scope.tableIsSelected.tableName + ']');

        if ($scope.isSync && isSocketConnected) {
            var tables = [];
            tables.push($scope.tableIsSelected);

            var updateData = {
                "companyId": SunoGlobal.companyInfo.companyId,
                "storeId": $scope.currentStore.storeID,
                "clientId": SunoGlobal.userProfile.sessionId,
                "shiftId": shiftID,
                //"startDate": "",
                //"finishDate": "",
                "tables": angular.copy(tables),
                "zone": $scope.tableMap,
                "info": {
                    author: SunoGlobal.userProfile.userId,
                    deviceID: deviceID,
                    action: "splitOrder",
                    timestamp: timestamp,
                    isUngroupItem: $scope.isUngroupItem
                }
            }
            SUNOCONFIG.LOG('updateData-splitOrder', updateData);
            socket.emit('updateOrder', updateData);
        }

        //Cập nhật xuống DB Local.
        updateSelectedTableToDB();

        $scope.modalSplitOrder.hide();
    }

    $scope.createNewOrder = function () {
        $scope.pinItem = null;
        $scope.showOption = false;
        $scope.showOrderDetails = false;

        createNewOrder();
        var saleOrder = { saleOrder: $unoSaleOrderCafe.saleOrder };
        $scope.tableIsSelected.tableOrder.push(saleOrder);
        $unoSaleOrderCafe.saleOrder.tableName = $scope.tableIsSelected.tableName;
        $unoSaleOrderCafe.saleOrder.sharedWith.push({ deviceID: deviceID, userID: SunoGlobal.userProfile.userId });
        $scope.orderIndexIsSelected = $scope.tableIsSelected.tableOrder.indexOf(saleOrder);

        checkingCombination();
    }

    $scope.cancelOrder = function () {
        $scope.pinItem = null;
        $scope.showOption = false;
        $scope.showOrderDetails = false;
        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length == 0) {
            if ($scope.tableIsSelected.tableOrder.length > 1) {
                $unoSaleOrderCafe.deleteOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                $scope.tableIsSelected.tableOrder.splice($scope.orderIndexIsSelected, 1);
                $scope.orderIndexIsSelected = $scope.tableIsSelected.tableOrder.length - 1;
                $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                var isActive = tableIsActive($scope.tableIsSelected);
                $scope.tableIsSelected.tableStatus = isActive ? 1 : 0;
            } else {
                var isActive = tableIsActive($scope.tableIsSelected);
                $scope.tableIsSelected.tableStatus = isActive ? 1 : 0;
                $scope.orderIndexIsSelected = 0;
            }
        } else {
            toaster.pop('warning', "", 'Không thể xoá đơn hàng đang có hàng hoá');
        }
        checkingCombination();
    }

    $scope.pickProduct = function (item) {
        if (!item || !item.itemId) return;

        //Validate thông tin
        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]
            && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != null
            && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId
            && !$scope.isManager
        ) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }

        if (item.isSerial) {
            return toaster.pop('warning', "", 'Xin vui lòng sử dụng Suno POS để bán hàng theo IMEI/SERIAL. Liên hệ 08.71.088.188 để được hỗ trợ.');
        }

        if (item.qtyAvailable <= 0 && item.isUntrackedItemSale === false && item.isInventoryTracked === true) {
            return toaster.pop('warning', "", 'Vui lòng nhập kho hàng [' + item.itemName + '], hoặc cấu hình cho phép bán âm hàng hóa này.');
        }

        if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {

            //var itemIndex = findIndex($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails, 'itemId', item.itemId);

            //if (itemIndex != null && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails[itemIndex].startTime) {
            //    return toaster.pop('warning', "", 'Hàng hóa này được tính giá theo giờ sử dụng và đã có trong đơn hàng!');
            //}

            if ($scope.hourService.isUse) {
                if ($scope.hourService.allProduct) {
                    var indexOfItemInList = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.findIndex(function (d) { return d.itemId == item.itemId; });
                    if (indexOfItemInList > -1) {
                        return toaster.pop('warning', "", 'Hàng hóa này được tính giá theo giờ sử dụng và đã có trong đơn hàng!');
                    }
                }
                else {
                    var indexOfItemInServiceList = $scope.hourService.itemArr.findIndex(function (d) { return d.itemId == item.itemId; });
                    if (indexOfItemInServiceList > -1) {
                        var indexOfItemInList = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.findIndex(function (d) { return d.itemId == item.itemId; });
                        if (indexOfItemInList > -1) {
                            return toaster.pop('warning', "", 'Hàng hóa này được tính giá theo giờ sử dụng và đã có trong đơn hàng!');
                        }
                    }
                }
            }
        }

        var thisItem = angular.copy(item);

        //Tạo đơn hàng nếu trống.
        //Trường hợp bàn mang về khi search và chọn thì tự động thêm món vào Order của bàn mang về hoặc trường hợp xóa trắng đơn hàng sau đó thêm hàng hóa vào lại.
        if ($scope.tableIsSelected.tableOrder.length == 0) {
            createFirstOrder();
        }

        //Kiểm tra hàng hóa tính giờ
        //Nếu có sử dụng dịch vụ tính giờ và áp dụng cho tất cả hàng hóa
        if ($scope.hourService.isUse && $scope.hourService.allProduct) {
            thisItem.isServiceItem = true;
        }
        //Nếu có sử dụng dịch vụ tính giờ và chỉ áp dụng trên 1 số hàng hóa.
        else if ($scope.hourService.isUse && !$scope.hourService.allProduct && $scope.hourService.itemArr.length > 0) {
            var indexOfItem = $scope.hourService.itemArr.findIndex(function (i) { return i.itemId == item.itemId; });
            if (indexOfItem > -1) {
                thisItem.isServiceItem = true;
                $scope.startCounter(thisItem);
            }
        }

        //Thêm item vào danh sách details, thêm newOrderCount và lastInputedIndex.
        if ($scope.isUngroupItem) {
            //Xử lý cho hàng hóa tách món.
            //var thisItem = item //angular.copy(item);
            thisItem.quantity = 1;
            thisItem.newOrderCount = 1;
            thisItem.detailID = uuid.v1();

            //Nếu có chọn ghim.
            if ($scope.pinItem) {
                thisItem.isChild = '—';
                //Set parent cho item nếu đang được pin.
                thisItem.parentID = $scope.pinItem.detailID;

                //Kiếm trong ds child của parent xem có hay chưa
                var itemDetail = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.find(function (d) {
                    return d.isChild && d.parentID == $scope.pinItem.detailID && d.itemId == thisItem.itemId;
                })

                //Nếu không có trong ds child của item được pin thì thêm vào. 
                if (!itemDetail) {
                    $unoSaleOrderCafe.addItemGroup(thisItem, angularApply);
                    var insertedDetail = $unoSaleOrderCafe.saleOrder.orderDetails.find(function (d) { return d.itemId == thisItem.itemId && d.detailID == thisItem.detailID });
                    insertedDetail.newOrderCount = 1;
                }
                else { //Nếu có rồi thì tăng thêm số lượng.
                    thisItem.detailID = itemDetail.detailID;
                    $unoSaleOrderCafe.addItemGroup(thisItem, angularApply);
                    var insertedDetail = $unoSaleOrderCafe.saleOrder.orderDetails.find(function (d) { return d.itemId == thisItem.itemId && d.detailID == thisItem.detailID });
                    insertedDetail.newOrderCount++;
                }
                var index = $unoSaleOrderCafe.saleOrder.orderDetails.findIndex(function (d) { return d.detailID == thisItem.detailID });
                $unoSaleOrderCafe.saleOrder.lastInputedIndex = index;
            } else {
                $unoSaleOrderCafe.addItemGroup(thisItem, angularApply);
                var insertedDetail = $unoSaleOrderCafe.saleOrder.orderDetails.find(function (d) { return d.itemId == thisItem.itemId && d.detailID == thisItem.detailID });
                insertedDetail.newOrderCount = 1;
                $unoSaleOrderCafe.saleOrder.lastInputedIndex = $unoSaleOrderCafe.saleOrder.orderDetails.indexOf(insertedDetail);
            }
        } else {
            //Xử lý cho hàng hóa bình thường
            //var thisItem = item //angular.copy(item);
            var itemIndex = $unoSaleOrderCafe.saleOrder.orderDetails.findIndex(function (d) { return d.itemId == thisItem.itemId; });
            $unoSaleOrderCafe.addItem(thisItem, angularApply);
            if (itemIndex > -1) {
                $unoSaleOrderCafe.saleOrder.orderDetails[itemIndex].newOrderCount++;
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = itemIndex;
            }
            else {
                var insertedItem = $unoSaleOrderCafe.saleOrder.orderDetails.find(function (d) { return d.itemId == thisItem.itemId; });
                insertedItem.newOrderCount = 1;
                //Nếu khi thêm món mới mà món mới đưa vào cuối danh sách thì cuộn thanh cuộn xuống
                if (SunoGlobal.printer.ordering != 'desc') {
                    $ionicScrollDelegate.$getByHandle('orders-details').scrollBottom();
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = $unoSaleOrderCafe.saleOrder.orderDetails.length - 1;
                } else {
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = 0;
                }
            }
        }

        //Thêm shared with và bật đèn vàng cho bàn.
        $scope.tableIsSelected.tableStatus = 1;
        var sWIndex = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.sharedWith.findIndex(function (sw) { return sw.deviceID == deviceID && sw.userID == SunoGlobal.userProfile.userId });
        if (sWIndex < 0) {
            $scope.tableIsSelected.tableOrder[0].saleOrder.sharedWith.push({ deviceID: deviceID, userID: SunoGlobal.userProfile.userId });
        }

        //resetEarningPoint();
        //Cập nhật lại amountPaid
        //Chỉ gọi cập nhật AmountPaid khi mà ko tính lại subFee vì trong changeSubFee đã có resetAmountPaid() rồi.
        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFee > 0) {
            $scope.changeSubFee();
        }
        else {
            resetAmountPaid();
        }

        $scope.showOrderDetails = false;
        $scope.showOption = false;
        $scope.key = null;
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.hasNotice = true;
        if ($scope.isInTable) {
            $scope.openTable($scope.tableIsSelected);
        }

        updateSelectedTableToDB();

        checkingCombination();
    }

    $scope.noticeToTheKitchen = function () {
        //Nếu có món trong order mới cho báo bếp
        if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length > 0) {

            ////Kiểm tra kết nối socket.
            //if ($scope.isSync && !receivedAnyInitDataFromServer) {
            //    handleUnreadySocket();
            //    return;
            //}

            //Validate quyền thực hiện
            if ($scope.tableIsSelected
                && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId
                && !$scope.isManager
            ) {
                return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
            }

            //Reset giá trị
            $scope.pinItem = null;
            $scope.showOption = false;
            // Kiem tra co mon trong hoa don can bao bep hay ko, neu hoa don ko co cap nhat mon moi thi ko bao bep nua
            var canPrint = checkOrderPrintStatus($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);
            if (canPrint) {

                // Co mon can bao bep 
                $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.hasNotice = false;
                if (!$scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.printed) {
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.printed = [];
                }

                //Xử lý thông tin cho order để chuẩn bị in.
                // Chi in nhung mon moi order
                var currentOrder = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected];
                var printOrder = angular.copy(currentOrder);
                for (var i = 0; i < printOrder.saleOrder.orderDetails.length; i++) {
                    printOrder.saleOrder.orderDetails[i].quantity = printOrder.saleOrder.orderDetails[i].newOrderCount;
                }
                printOrder = removeItemZeroForPrint(printOrder);
                //Mảng chứa các món mới báo bếp cho đồng bộ.
                var untrackedItem = [];
                for (var i = 0; i < printOrder.saleOrder.orderDetails.length; i++) {
                    var obj = {
                        itemID: printOrder.saleOrder.orderDetails[i].itemId,
                        itemName: printOrder.saleOrder.orderDetails[i].itemName,
                        quantity: printOrder.saleOrder.orderDetails[i].quantity,
                    }
                    if ($scope.isUngroupItem) {
                        obj.detailID = printOrder.saleOrder.orderDetails[i].detailID;
                    }
                    untrackedItem.push(obj);
                }
                printOrder.saleOrder.printedCount = currentOrder.saleOrder.printed.length + 1;
                if (printOrder.saleOrder.printed) delete printOrder.saleOrder.printed;
                if (printOrder.saleOrder.logs) delete printOrder.saleOrder.logs;
                if (printOrder.saleOrder.sharedWith) delete printOrder.saleOrder.sharedWith;
                currentOrder.saleOrder.printed.push(printOrder);
                var printTemp = angular.copy(printOrder);
                printTemp.saleOrder.timestamp = genTimestamp();

                var setting = {
                    companyInfo: $scope.companyInfo.companyInfo,
                    allUsers: $scope.authBootloader.users,
                    store: $scope.currentStore
                }
                if ($scope.printSetting.printNoticeKitchen == false) {
                    // Neu cho phep in bao bep o thiet lap in 
                    if ($scope.isWebView) {
                        if ($scope.isUngroupItem && $scope.printSetting.noticeByStamps) {
                            printOrder.saleOrder = prepProcessStamps(printOrder.saleOrder);
                            printOrderInBrowser(printer, printOrder.saleOrder, 256, setting);
                        }
                        else {
                            if ($scope.printSetting.unGroupBarKitchen)
                                printOrderBarKitchen(printer, printOrder.saleOrder, $scope.BarItemSetting, setting);
                            else
                                printOrderInBrowser(printer, printOrder.saleOrder, 128, setting);
                        }
                    } else {
                        if ($scope.isIOS && $scope.printDevice && $scope.printDevice.kitchenPrinter && $scope.printDevice.kitchenPrinter.status) {
                            if ($scope.printSetting.unGroupBarKitchen)
                                $scope.printOrderBarKitchenInMobile($scope.printDevice, printOrder.saleOrder, $scope.BarItemSetting, setting);
                            else
                                printOrderInMobile($scope.printDevice.kitchenPrinter, printOrder.saleOrder, "BB", setting);
                        } else if ($scope.isAndroid && $scope.printDevice && $scope.printDevice.kitchenPrinter && $scope.printDevice.kitchenPrinter.status) {
                            if ($scope.printSetting.unGroupBarKitchen)
                                $scope.printOrderBarKitchenInMobile($scope.printDevice, printOrder.saleOrder, $scope.BarItemSetting, setting);
                            else
                                printOrderInMobile($scope.printDevice.kitchenPrinter, printOrder.saleOrder, "BB", setting);
                        }
                    }
                }

                var pOrderIndex = currentOrder.saleOrder.printed.indexOf(printOrder);
                currentOrder.saleOrder.printed[pOrderIndex] = printTemp;
                //printOrder.saleOrder.printed = printTemp;
                for (var i = 0; i < currentOrder.saleOrder.orderDetails.length; i++) {
                    currentOrder.saleOrder.orderDetails[i].newOrderCount = 0;
                    currentOrder.saleOrder.orderDetails[i].comment = '';
                }

                toaster.pop('success', "", 'Đã gửi đơn hàng xuống bếp!');

                if ($scope.isSync) {
                    var currentTable = angular.copy($scope.tableIsSelected);
                    var tables = [];
                    tables.push(currentTable);
                    tables[0].tableOrder = [];
                    tables[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
                    var timestamp = genTimestamp();
                    //SUNOCONFIG.LOG($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
                    for (var x = 0; x < untrackedItem.length; x++) {
                        if (!$scope.isUngroupItem) {
                            $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.logs.push(
                                new Log(untrackedItem[x].itemID, untrackedItem[x].itemName, "BB", untrackedItem[x].quantity, timestamp, deviceID, false));
                        }
                        else {
                            $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.logs.push(
                                new UngroupLog(untrackedItem[x].itemID, untrackedItem[x].itemName, "BB", untrackedItem[x].quantity, timestamp, deviceID, untrackedItem[x].detailID, false));
                        }
                    }

                    if (isSocketConnected) {
                        var updateData = {
                            "companyId": SunoGlobal.companyInfo.companyId,
                            "storeId": $scope.currentStore.storeID,
                            "clientId": SunoGlobal.userProfile.sessionId,
                            "shiftId": shiftID,
                            //"startDate": "",
                            //"finishDate": "",
                            "tables": angular.copy(tables),
                            "zone": $scope.tableMap,
                            "info": {
                                author: SunoGlobal.userProfile.userId,
                                deviceID: deviceID,
                                timestamp: timestamp,
                                action: 'BB',
                                isUngroupItem: $scope.isUngroupItem
                            }
                        }
                        SUNOCONFIG.LOG('updateData', updateData);
                        socket.emit('updateOrder', updateData);

                        if ($scope.printSetting.printNoticeKitchen == false && !$scope.isWebView && (!$scope.printDevice || !$scope.printDevice.kitchenPrinter.status)) {
                            // nếu không phải trên trình duyệt + cho phép in bếp + cho phép in hộ thì mới gửi lệnh in hộ lên socket
                            var printHelperData = {
                                "companyId": SunoGlobal.companyInfo.companyId,
                                "storeId": $scope.currentStore.storeID,
                                "clientId": SunoGlobal.userProfile.sessionId,
                                "shiftId": shiftID,
                                "printOrder": printOrder.saleOrder,
                                "printSetting": setting,
                                "orderType": "kitchen"
                            }
                            socket.emit('printHelper', printHelperData);
                        }
                    }
                    else {
                        handleDisconnectedSocket();
                    }
                }
                //Cập nhật xuống DB Local.
                updateSelectedTableToDB();
            }
        }
    }

    $scope.submitOrder = function (isPrint) {
        // SUNOCONFIG.LOG($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);exit;
        if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId && !$scope.isManager) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }

        if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length > 0) {
            if ($scope.hourService.isUse) {
                var indexService = findIndex($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails, 'timer', true);
                if (indexService != null) {
                    return toaster.pop('warning', "", 'Bạn chưa hoàn tất tính giờ cho đơn hàng hiện tại');
                }
            }

            if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.hasNotice) $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.hasNotice = false;
            //prepareOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder);

            if (!SunoGlobal.saleSetting.isAllowDebtPayment) {
                if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.amountPaid < $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.total)
                    return toaster.pop('warning', "", 'Hệ thống được thiết lập không cho phép bán nợ! Vui lòng thiết lập cho phép bán nợ để có thể xử lý đơn hàng này!');
            }

            //if (!isSocketReady) {
            //    handleUnreadySocket();
            //    return;
            //}

            $scope.pinItem = null;
            $scope.showOption = false;
            if ($scope.selectedItem) {
                $scope.selectedItem = null;
                $scope.hideItemOption();
            }

            var completedOrder = angular.copy($unoSaleOrderCafe.saleOrder);

            //Loại các receipt Voucher ko có tiền
            var removedCount = 0;
            var length = completedOrder.receiptVouchers.length;
            for (var x = 0; x < length; x++) {
                var amount = completedOrder.receiptVouchers[x - removedCount].amount;
                if (isNaN(parseFloat(amount)) || amount == 0) {
                    completedOrder.receiptVouchers.splice(x - removedCount, 1);
                    removedCount++;
                }
            }

            //Modeling customer
            if (completedOrder.customer) {
                completedOrder.customer.name = completedOrder.customer.customerName;
            }

            var submitOrder = $unoSaleOrderCafe.prepareOrder(completedOrder).saleOrder;
            submitOrder.saleOrderDate = new Date();
            if (submitOrder.hasOwnProperty('note')) {
                submitOrder.createdByName = submitOrder.note;
            }

            //Thêm thông tin ghi chú về bàn, giờ vào giờ ra cho đơn hàng.
            if (submitOrder.comment != '') {
                submitOrder.comment = '';
            }
            var comment = completedOrder.tableName + '. Giờ vào ' + $filter('date')(completedOrder.startTime, 'HH:mm') + '. Giờ ra ' + $filter('date')(new Date().getTime(), 'HH:mm');
            submitOrder.comment = comment;

            var url = Api.submitOrder;
            var method = 'POST';
            var d = {
                saleOrder: submitOrder,
                currentStore: $scope.currentStore,
                user: $scope.userSession
            };
            //var cafeSubmitOrder = $unoRequest.makeRestful(url, method, d, 'cafeSubmitOrder');
            var cafeSubmitOrder = $unoRequest.makeRestful(url, method, { saleOrder: submitOrder }, 'cafeSubmitOrder');
            if (cafeSubmitOrder !== undefined) {


                cafeSubmitOrder.then(function (data) {
                    $scope.showOrderDetails = false;
                    var setting = {
                        companyInfo: $scope.companyInfo.companyInfo,
                        allUsers: $scope.authBootloader.users,
                        store: $scope.currentStore
                    };
                    var printOrder = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder;

                    if ($scope.isSync) {
                        if (isSocketConnected) {
                            //debugger;
                            var currentTable = angular.copy($scope.tableIsSelected);
                            var tables = [];
                            tables.push(currentTable);
                            tables[0].tableOrder = [];
                            tables[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
                            var completeOrder = {
                                "companyId": SunoGlobal.companyInfo.companyId,
                                "storeId": $scope.currentStore.storeID,
                                "clientId": SunoGlobal.userProfile.sessionId,
                                "shiftId": shiftID,
                                //"startDate": "",
                                //"finishDate": "",
                                "tables": angular.copy(tables),
                                "zone": $scope.tableMap,
                                "info": {
                                    action: "done",
                                    deviceID: deviceID,
                                    timestamp: genTimestamp(),
                                    author: SunoGlobal.userProfile.userId,
                                    isUngroupItem: $scope.isUngroupItem
                                }
                            }

                            SUNOCONFIG.LOG('completeOrderData', completeOrder);
                            socket.emit('completeOrder', completeOrder);

                            if ($scope.printSetting.printSubmitOrder == false && !$scope.isWebView && (!$scope.printDevice || !$scope.printDevice.cashierPrinter.status)) {
                                // nếu không phải trên trình duyệt + cho phép in thanh toán + cho phép in hộ thì mới gửi lệnh in hộ lên socket
                                var printHelperData = {
                                    "companyId": SunoGlobal.companyInfo.companyId,
                                    "storeId": $scope.currentStore.storeID,
                                    "clientId": SunoGlobal.userProfile.sessionId,
                                    "shiftId": shiftID,
                                    "printOrder": printOrder,
                                    "printSetting": setting,
                                    "orderType": "cashier",
                                    "info": {
                                        action: "print",
                                        deviceID: deviceID,
                                        timestamp: genTimestamp(),
                                        author: SunoGlobal.userProfile.userId
                                    }
                                }
                                socket.emit('printHelper', printHelperData);
                            }
                        }
                        else {
                            handleDisconnectedSocket();
                        }
                    }

                    $unoSaleOrderCafe.deleteOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);

                    createNewOrder();
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder = $unoSaleOrderCafe.saleOrder;
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.tableName = $scope.tableIsSelected.tableName;
                    var isActive = tableIsActive($scope.tableIsSelected);
                    $scope.tableIsSelected.tableStatus = isActive ? 1 : 0;
                    $scope.$apply();

                    //Cập nhật vào DB
                    updateSelectedTableToDB();

                    //Nếu có print preview.
                    if (isPrint) {

                        printOrder.saleOrderCode = data.saleOrderCode;

                        if ($scope.isWebView) {
                            var rs = printOrderInBrowser(printer, printOrder, 1, setting);
                            if (rs) {
                                toaster.pop('success', "", 'Đã lưu & in hoá đơn thành công.');
                            } else {
                                toaster.pop('error', "", 'Đã lưu hóa đơn nhưng không in được, vui lòng kiểm tra lại mẫu in.');
                            }
                        } else if ($scope.isIOS && $scope.printDevice && $scope.printDevice.cashierPrinter && $scope.printDevice.cashierPrinter.status) {
                            // SUNOCONFIG.LOG('in bep truc tiep tren IOS');
                            // printOrderInMobile($scope.printDevice.cashierPrinter.ip,printOrder,"TT",setting);

                            printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
                            toaster.pop('success', "", 'Đã lưu & in hoá đơn thành công.');
                        } else if ($scope.isAndroid && $scope.printDevice && $scope.printDevice.cashierPrinter && $scope.printDevice.cashierPrinter.status) {
                            // SUNOCONFIG.LOG('in bep Android');
                            printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
                            toaster.pop('success', "", 'Đã lưu hoá đơn thành công.');
                        }
                        else {
                            toaster.pop('success', "", 'Đã lưu hoá đơn thành công.');
                        }

                    }
                    else {
                        toaster.pop('success', "", 'Đã lưu hoá đơn thành công.');
                    }
                })
                    .catch(function (e) {
                        try {
                            e = JSON.parse(e);
                            toaster.pop('error', "", e.responseStatus.message);
                        }
                        catch (exception) {
                            toaster.pop('error', "", 'Đã có lỗi xảy ra, lưu & in hoá đơn không thành công.');
                            $scope.$apply();
                        }
                    });
            }

        }
    }

    $scope.stopCounter = function (item, $event) {
        if ($scope.tableIsSelected
            && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId
            && !$scope.isManager
        ) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }
        var quantityBeforeStopTimer = item.quantity;
        var itemIndex = findIndex($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails, 'itemId', item.itemId);
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = itemIndex;

        item.endTime = new Date().getTime();
        item.timeCounter = Math.abs(item.endTime - item.startTime);

        var roundBlock = Math.ceil(item.timeCounter / (60000 * $scope.hourService.blockCounter));
        var roundCount = roundBlock * $scope.hourService.blockCounter * 60000;

        var hourCount = Math.floor(roundCount / 3600000);
        var minusCount = roundCount % 3600000;
        minusCount = Math.floor(minusCount / 60000);

        var hour = Math.floor(item.timeCounter / 3600000);
        var minus = item.timeCounter % 3600000;
        minus = Math.floor(minus / 60000);

        item.duration = hour + ' giờ ' + minus + ' phút';
        item.blockCount = hourCount + ' giờ ' + minusCount + ' phút';
        item.quantity = Math.ceil(item.timeCounter / (60000 * $scope.hourService.blockCounter)) * ($scope.hourService.blockCounter / 60);
        item.timer = false;
        item.subTotal = item.quantity * item.sellPrice;
        //$unoSaleOrderCafe.calculateTotal();
        if (!$scope.isUngroupItem) {
            $unoSaleOrderCafe.changeQuantityOnItem(item);
        }
        else {
            $unoSaleOrderCafe.changeQuantityOnItemGroup(item);
        }

        //Cập nhật lại newOrderCount
        if (item.newOrderCount != 0) {
            item.newOrderCount = item.quantity;
        }

        //reset earning Point
        resetEarningPoint(false);
        //reset Amountpaid
        resetAmountPaid();

        if ($scope.isSync && item.newOrderCount == 0) {
            var currentTable = angular.copy($scope.tableIsSelected);
            var tables = [];
            tables.push(currentTable);
            tables[0].tableOrder = [];
            tables[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);

            //Thêm logs
            var timestamp = genTimestamp();
            var updatedQuantity = Math.abs(quantityBeforeStopTimer - item.quantity);
            if (!$scope.isUngroupItem) {
                tables[0].tableOrder[0].saleOrder.logs.push(
                    new Log(item.itemId, item.itemName, null, updatedQuantity, timestamp, deviceID, false));
            } else {
                tables[0].tableOrder[0].saleOrder.logs.push(
                    new UngroupLog(item.itemId, item.itemName, null, updatedQuantity, timestamp, deviceID, item.detailID, false));
            }

            //Nếu số lượng cũ lớn hơn số lượng mới thì thêm log Hủy
            if (quantityBeforeStopTimer > item.quantity) {
                tables[0].tableOrder[0].saleOrder.logs[tables[0].tableOrder[0].saleOrder.logs.length - 1].action = 'H';
            }
            //Nếu số lượng cũ nhỏ hơn số lượng mới thì thêm log Báo bếp.
            else {
                tables[0].tableOrder[0].saleOrder.logs[tables[0].tableOrder[0].saleOrder.logs.length - 1].action = 'BB';
            }

            tables = clearNewOrderCount(tables);
            if (isSocketConnected) {
                var updateData = {
                    "companyId": SunoGlobal.companyInfo.companyId,
                    "storeId": $scope.currentStore.storeID,
                    "clientId": SunoGlobal.userProfile.sessionId,
                    "shiftId": shiftID,
                    //"startDate": "",
                    //"finishDate": "",
                    "tables": angular.copy(tables),
                    "zone": $scope.tableMap,
                    "info": {
                        action: "stopTimer",
                        deviceID: deviceID,
                        timestamp: genTimestamp(),
                        author: SunoGlobal.userProfile.userId,
                        itemID: item.itemId
                    }
                }
                SUNOCONFIG.LOG('updateData-stopTimer', updateData);
                socket.emit('updateOrder', updateData);
            }
            else {
                handleDisconnectedSocket();
            }
        }
        //Cập nhật vào DB Local.
        updateSelectedTableToDB();

        if ($event) {
            $event.stopPropagation();
            $event.preventDefault();
        }
    };

    $scope.startCounter = function (item, $event) {
        if ($scope.tableIsSelected
            && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId
            && !$scope.isManager
        ) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }
        if (!item.timer) {
            item.timer = true;
            if (!item.timeCounter) item.timeCounter = 0;
            if (!item.startTime) item.startTime = new Date().getTime();
        }
        if ($event) {
            $event.stopPropagation();
            $event.preventDefault();
        }
        //Nếu là dịch vụ tính giờ đc sử dụng, và hàng áp dụng với tất cả hàng hóa hoặc là áp dụng với 1 số hàng hóa và hàng hóa đó phải đc báo bếp rồi.
        //$scope.hourService.isUse && && ($scope.hourService.allProduct|| item.newOrderCount == 0)
        if (item.newOrderCount == 0) {
            if ($scope.isSync) {
                if (isSocketConnected) {
                    var currentTable = angular.copy($scope.tableIsSelected);
                    var tables = [];
                    tables.push(currentTable);
                    tables[0].tableOrder = [];
                    tables[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
                    var startTimerData = {
                        "companyId": SunoGlobal.companyInfo.companyId,
                        "storeId": $scope.currentStore.storeID,
                        "clientId": SunoGlobal.userProfile.sessionId,
                        "shiftId": shiftID,
                        //"startDate": "",
                        //"finishDate": "",
                        "tables": angular.copy(tables),
                        "zone": $scope.tableMap,
                        "info": {
                            action: "startTimer",
                            deviceID: deviceID,
                            timestamp: genTimestamp(),
                            author: SunoGlobal.userProfile.userId,
                            itemID: item.itemId
                        }
                    }
                    SUNOCONFIG.LOG('updateData-startTimer', startTimerData);
                    socket.emit('updateOrder', startTimerData);
                }
                else {
                    handleDisconnectedSocket();
                }
            }
        }

        updateSelectedTableToDB();
    };

    $scope.pin = function (i, index, $event) {
        $scope.selectedItem = i;

        if ($scope.pinItem && $scope.pinItem.itemId == i.itemId && index == $scope.selectedItemIndex) {
            $scope.pinItem = null;
        } else {
            $scope.pinItem = i;
        }
        $scope.selectedItemIndex = index;
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = index;

        if ($event) {
            $event.stopPropagation();
            $event.preventDefault();
        }
    }

    $scope.changeTempOrderName = function () {
        if ($scope.tableIsSelected
            && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId
            && !$scope.isManager
        ) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }
        if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.hasOwnProperty('note')) {
            $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdByName = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.note;
            delete $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.note;
            $scope.popoverTableAction.hide();
            if ($scope.isSync) {
                if (isSocketConnected) {
                    var currentTable = angular.copy($scope.tableIsSelected);
                    var tables = [];
                    tables.push(currentTable);
                    tables[0].tableOrder = [];
                    tables[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
                    tables = clearNewOrderCount(tables);
                    var updateData = {
                        "companyId": SunoGlobal.companyInfo.companyId,
                        "storeId": $scope.currentStore.storeID,
                        "clientId": SunoGlobal.userProfile.sessionId,
                        "shiftId": shiftID,
                        //"startDate": "",
                        //"finishDate": "",
                        "tables": angular.copy(tables),
                        "zone": $scope.tableMap,
                        "info": {
                            action: "renameOrder",
                            deviceID: deviceID,
                            timestamp: genTimestamp(),
                            author: SunoGlobal.userProfile.userId
                        }
                    }
                    SUNOCONFIG.LOG('updateData-renameOrder', updateData);
                    socket.emit('updateOrder', updateData);
                }
                else {
                    handleDisconnectedSocket();
                }
            }

            //Cập nhật vào DB Local
            updateSelectedTableToDB();
            return toaster.pop('success', '', 'Đã đổi tên cho đơn hàng LƯU TẠM thành công!');
        }
        else {
            return toaster.pop('warning', '', 'Thao tác không được thực hiện, đổi tên chỉ áp dụng các đơn hàng LƯU TẠM.');
        }
    }

    $scope.showChangeQuantity = false;

    $scope.openChangeQuantity = function (op) {
        $scope.selectedItem.changeQuantity = 1
        $scope.showChangeQuantity = true;
        $scope.showChangeQuantityOption = op;
    }

    $scope.closeChangeQuantity = function () {
        $scope.showChangeQuantity = false;
    }

    $scope.removeItem = function (q) {
        if ($scope.modalItemOption) $scope.modalItemOption.hide();
        if ($scope.showOption) $scope.showOption = false;
        $scope.showChangeQuantityOption = 1;
        $scope.submitChangeQuantity(q);
    }

    $scope.isFloatNumber = function (number) {
        if (isNaN(number)) return null;
        if (number % 1 === 0) return false;
        return true;
    }

    var isNumber = function (number) {
        if (isNaN(number)) return false;
        return true;
    }

    $scope.submitChangeQuantity = function (quantity) {
        //if ($scope.isSync && !receivedAnyInitDataFromServer) {
        //    handleUnreadySocket();
        //    return;
        //}
        if (!quantity || !isNumber(quantity)) {
            return toaster.pop('warning', "", 'Vui lòng nhập số lượng hợp lệ.');
        }
        if (!SunoGlobal.saleSetting.isAllowQuantityAsDecimal && $scope.isFloatNumber(quantity)) {
            return toaster.pop('warning', "", 'Hệ thống được cấu hình không cho phép số lượng là số thập phân.');
        }

        if ($scope.showChangeQuantityOption == 2) {
            // SUNOCONFIG.LOG('tăng ' + quantity);
            toaster.pop('success', "", 'Tăng ' + quantity + ' [' + $scope.selectedItem.itemName + '] trong hoá đơn.');
            $scope.changeQuantity(quantity, $scope.selectedItem);
            $scope.selectedItem.changeQuantity = null;
            $scope.hideItemOption();
        } else if ($scope.showChangeQuantityOption == 1) {
            // SUNOCONFIG.LOG('giảm ' + quantity);
            $scope.checkRemoveItem(-quantity, $scope.selectedItem);
            $scope.selectedItem.changeQuantity = null;
            $scope.hideItemOption();
        } else if ($scope.showChangeQuantityOption == 3) {
            toaster.pop('success', "", 'Cập nhật lại số lượng của [' + $scope.selectedItem.itemName + '] thành ' + quantity + ' trong hoá đơn');
            var index = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex;
            var item = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails[index];
            if (item.quantity > quantity) {
                //Nếu sl cũ > mới -> giảm
                $scope.checkRemoveItem(quantity - item.quantity, $scope.selectedItem);
            }
            else {
                //Nếu sl cũ < mới -> tăng
                $scope.changeQuantity(quantity - item.quantity, $scope.selectedItem);
            }
            $scope.selectedItem.changeQuantity = null;
            $scope.hideItemOption();
        }
        $scope.showChangeQuantity = false;
    }

    $scope.fastRemoveItem = function (quantity, item, $event) {
        // SUNOCONFIG.LOG($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
        //if ($scope.isSync && !receivedAnyInitDataFromServer) {
        //    handleUnreadySocket();
        //    return;
        //}
        $scope.pinItem = null;
        $scope.selectedItem = item;
        if ($scope.selectedItem.quantity > 1) {
            $scope.checkRemoveItem(-quantity, $scope.selectedItem);
            $scope.selectedItem.changeQuantity = null;
        }
        if ($event) {
            $event.stopPropagation();
            $event.preventDefault();
        }
    }

    var roundNumber = function (number, radix) {
        if (isNaN(number)) return null;
        var number = Number(number);
        //Nếu là int
        if (number % 1 === 0) {
            return number;
        }
        //Nếu là float thì làm tròn theo radix.
        else {
            return Number(number.toFixed(radix));
        }
    }

    $scope.changeQuantity = function (num, item, $event) {
        $scope.showOrderDetails = false;
        $scope.showOption = false;
        var qtyBeforeChange = item.quantity;
        var checkItem = angular.copy(item);

        // Kiểm tra quyền thao tác trên hóa đơn
        var saleOrder = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder;
        if (saleOrder.createdBy != SunoGlobal.userProfile.userId && !$scope.isManager) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }

        if (num) {
            //Thêm sharedWith
            var sWIndex = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.sharedWith.findIndex(function (log) { return log.deviceID == deviceID && log.userID == SunoGlobal.userProfile.userId });
            if (sWIndex < 0) {
                $scope.tableIsSelected.tableOrder[0].saleOrder.sharedWith.push({ deviceID: deviceID, userID: SunoGlobal.userProfile.userId });
            }

            $scope.pinItem = null;
            ////Tính toán lại số lượng
            //if (num > 0) {
            //    item.newOrderCount = parseFloat(num) + parseFloat(item.newOrderCount);
            //    item.newOrderCount = (item.newOrderCount === parseInt(item.newOrderCount, 10)) ? item.newOrderCount : parseFloat(item.newOrderCount).toFixed(2);
            //    item.quantity = parseFloat(num) + parseFloat(item.quantity);
            //    item.quantity = (item.quantity === parseInt(item.quantity, 10)) ? item.quantity : parseFloat(item.quantity).toFixed(2);
            //} else if (num < 0) {
            //    if (item.quantity < -num) num = -item.quantity;
            //    item.quantity = parseFloat(num) + parseFloat(item.quantity);
            //    item.quantity = (item.quantity === parseInt(item.quantity, 10)) ? item.quantity : parseFloat(item.quantity).toFixed(2);
            //    if (item.newOrderCount > 0 && item.newOrderCount >= -num) {
            //        item.newOrderCount = parseFloat(num) + parseFloat(item.newOrderCount);
            //        item.newOrderCount = (item.newOrderCount === parseInt(item.newOrderCount, 10)) ? item.newOrderCount : parseFloat(item.newOrderCount).toFixed(2);
            //    } else {
            //        if (item.newOrderCount > 0 && item.newOrderCount < -num) item.newOrderCount = 0;
            //    }
            //}

            //Tính toán lại số lượng
            if (num > 0) {
                item.newOrderCount = roundNumber(num, 2) + roundNumber(item.newOrderCount, 2);
                item.quantity = roundNumber(num, 2) + roundNumber(item.quantity, 2);
            } else if (num < 0) {
                if (item.quantity < -num) {
                    num = -item.quantity;
                }
                item.quantity = roundNumber(num, 2) + roundNumber(item.quantity, 2);
                if (item.newOrderCount > 0) {
                    if (item.newOrderCount >= -num) {
                        item.newOrderCount = roundNumber(item.newOrderCount, 2) + roundNumber(num, 2);
                    }
                    else {
                        item.newOrderCount = 0;
                    }
                }
            }


            var childItems = [];
            if (!$scope.isUngroupItem) {
                //Cập nhật lại số lượng cho hàng hóa bình thường.
                $unoSaleOrderCafe.changeQuantityOnItem(item);
                removeItemZero($unoSaleOrderCafe);

                //Cập nhật lại lastInputedIndex
                var itemIndex = $unoSaleOrderCafe.saleOrder.orderDetails.findIndex(function (d) { return d.itemId == item.itemId; });
                if (itemIndex > -1) {
                    $unoSaleOrderCafe.saleOrder.lastInputedIndex = itemIndex;
                } else {
                    $unoSaleOrderCafe.saleOrder.lastInputedIndex = -1;
                }

            } else {
                //Cập nhật lại số lượng cho hàng hóa tách món.
                $unoSaleOrderCafe.changeQuantityOnItemGroup(item);

                //Tính toán số lượng cho các món con nếu có.
                if (num < 0 && qtyBeforeChange == -num) {
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.forEach(function (d) {
                        if (d.isChild && d.parentID == item.detailID) {
                            childItems.push({
                                itemID: d.itemId,
                                itemName: d.itemName,
                                detailID: d.detailID,
                                quantity: d.quantity
                            });
                            d.quantity = 0;
                            $unoSaleOrderCafe.changeQuantityOnItemGroup(d);
                        }
                    });
                }
                removeItemZeroGroup($unoSaleOrderCafe);

                //Cập nhật lastInputedIndex
                var itemIndex = $unoSaleOrderCafe.saleOrder.orderDetails.findIndex(function (d) { return d.detailID == item.detailID; });
                if (itemIndex > -1) {
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = itemIndex;
                } else {
                    $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = -1;
                }
            }

            //reset earning Point
            resetEarningPoint(false);

            //Cập nhật amountPaid
            if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.subFee > 0) {
                $scope.changeSubFee();
            }
            else {
                resetAmountPaid();
            }

            //Cập nhật lại trạng thái và xóa các item số lượng = 0;
            setHasNotice($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);

            $scope.showOption = false;
            var isActive = tableIsActive($scope.tableIsSelected);
            $scope.tableIsSelected.tableStatus = isActive ? 1 : 0;
            //Nếu không bật đồng bộ thì thực hiện xóa order đó và trỏ về lại cho đúng với Prototype.
            if (!$scope.isSync) {
                if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length == 0) {
                    $unoSaleOrderCafe.deleteOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                    $scope.tableIsSelected.tableOrder.splice($scope.orderIndexIsSelected, 1);
                    if ($scope.tableIsSelected.tableOrder.length == 0) {
                        createFirstOrder();
                    } else {
                        $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.tableIsSelected.tableOrder.length - 1].saleOrder.saleOrderUuid);
                        $scope.orderIndexIsSelected = $scope.tableIsSelected.tableOrder.length - 1;
                    }
                }
                ////Cập nhật xuống DB Local.
                //updateSelectedTableToDB();
            }
            //Đồng bộ đơn hàng.
            else if (num < 0 && $scope.isSync) {
                if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length == 0 && $scope.isSync) {
                    var currentTable = angular.copy($scope.tableIsSelected);

                    var timestamp = genTimestamp();
                    var tables = [];
                    tables.push(currentTable);
                    tables[0].tableOrder = [];
                    tables[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
                    if (Math.abs(num) - checkItem.newOrderCount > 0) {
                        if (!$scope.isUngroupItem) {
                            tables[0].tableOrder[0].saleOrder.logs.push(
                                new Log(item.itemId, item.itemName, "H", Math.abs(num) - checkItem.newOrderCount, timestamp, deviceID, false));
                        } else {
                            tables[0].tableOrder[0].saleOrder.logs.push(
                                new UngroupLog(item.itemId, item.itemName, "H", Math.abs(num) - checkItem.newOrderCount, timestamp, deviceID, item.detailID, false));
                            //Thêm logs của các child items bị xóa do xóa item chính.
                            childItems.forEach(function (i) {
                                tables[0].tableOrder[0].saleOrder.logs.push(
                                    new UngroupLog(i.itemID, i.itemName, "H", i.quantity, timestamp, deviceID, i.detailID, false));
                            });
                        }
                    }

                    if (isSocketConnected) {
                        var completeOrder = {
                            "companyId": SunoGlobal.companyInfo.companyId,
                            "storeId": $scope.currentStore.storeID,
                            "clientId": SunoGlobal.userProfile.sessionId,
                            "shiftId": shiftID,
                            //"startDate": "",
                            //"finishDate": "",
                            "tables": angular.copy(tables),
                            "zone": $scope.tableMap,
                            "info": {
                                action: "clearItem",
                                deviceID: deviceID,
                                timestamp: timestamp,
                                author: SunoGlobal.userProfile.userId,
                                isUngroupItem: $scope.isUngroupItem
                            }
                        };

                        SUNOCONFIG.LOG('completeData', completeOrder);
                        socket.emit('completeOrder', completeOrder);
                    }
                    else {
                        handleDisconnectedSocket();
                    }

                    //Cập nhật xuống DB Local.
                    //updateSelectedTableToDB();

                } else if (checkItem.newOrderCount < -num) {
                    var currentTable = angular.copy($scope.tableIsSelected);

                    var timestamp = genTimestamp();
                    var tables = [];
                    tables.push(currentTable);
                    tables[0].tableOrder = [];
                    tables[0].tableOrder.push($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]);
                    if (!$scope.isUngroupItem) {
                        tables[0].tableOrder[0].saleOrder.logs.push(
                            new Log(item.itemId, item.itemName, "H", Math.abs(num) - checkItem.newOrderCount, timestamp, deviceID, false));
                    } else {
                        tables[0].tableOrder[0].saleOrder.logs.push(
                            new UngroupLog(item.itemId, item.itemName, "H", Math.abs(num) - checkItem.newOrderCount, timestamp, deviceID, item.detailID, false));
                        //Thêm logs của các child items bị xóa do xóa item chính.
                        childItems.forEach(function (i) {
                            tables[0].tableOrder[0].saleOrder.logs.push(
                                new UngroupLog(i.itemID, i.itemName, "H", i.quantity, timestamp, deviceID, i.detailID, false));
                        });
                    }
                    if (isSocketConnected) {
                        tables = clearNewOrderCount(tables);
                        var updateData = {
                            "companyId": SunoGlobal.companyInfo.companyId,
                            "storeId": $scope.currentStore.storeID,
                            "clientId": SunoGlobal.userProfile.sessionId,
                            "shiftId": shiftID,
                            //"startDate": "",
                            //"finishDate": "",
                            "tables": angular.copy(tables),
                            "zone": $scope.tableMap,
                            "info": {
                                author: SunoGlobal.userProfile.userId,
                                deviceID: deviceID,
                                timestamp: timestamp,
                                action: "H",
                                isUngroupItem: $scope.isUngroupItem
                            }
                        }

                        SUNOCONFIG.LOG('updateData', updateData);
                        socket.emit('updateOrder', updateData);

                        //Cập nhật xuống DB Local.
                        //updateSelectedTableToDB();
                    }
                    else {
                        handleDisconnectedSocket();
                    }
                }
                else {
                    //updateSelectedTableToDB();
                }
            }

        } else {
            return toaster.pop('warning', "", 'Vui lòng nhập số lượng thay đổi');
        }
        if ($event) {
            $event.stopPropagation();
            $event.preventDefault();
        }
        //Cập nhật xuống DB Local.
        updateSelectedTableToDB();
        checkingCombination();
    }

    $scope.checkRemoveItem = function (num, item) {
        var saleOrder = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder;
        if (saleOrder.createdBy != SunoGlobal.userProfile.userId && !$scope.isManager) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        } else {
            switch ($scope.removeSetting) {
                case 1:
                    // Nếu cho phép huỷ món ko cần xác nhận
                    $scope.changeQuantity(num, item);
                    if (!item.isServiceItem) {
                        toaster.pop('success', "", 'Giảm ' + -num + ' [' + item.itemName + '] trong hoá đơn');
                    }
                    else {
                        toaster.pop('success', "", 'Giảm [' + item.itemName + '] trong hoá đơn');
                    }
                    break;
                case 2:
                    // Được hủy món chưa in bếp, khi đã in bếp thì cần xác nhận quản lý/chủ cửa hàng
                    if (item.newOrderCount > 0 && item.newOrderCount >= -num) {
                        $scope.changeQuantity(num, item);
                        if (!item.isServiceItem) {
                            toaster.pop('success', "", 'Giảm ' + -num + ' [' + item.itemName + '] trong hoá đơn');
                        }
                        else {
                            toaster.pop('success', "", 'Giảm [' + item.itemName + '] trong hoá đơn');
                        }
                    } else {
                        $scope.staff = {};
                        var findRoleIndex = findIndex($scope.authBootloader.rolesGranted, 'roleName', 'Quản lý');
                        if (findRoleIndex != null) {
                            $ionicPopup.show({
                                title: 'Xác nhận huỷ món',
                                subTitle: 'Bạn muốn huỷ món [' + item.itemName + '] ra khỏi đơn hàng ?',
                                scope: $scope,
                                buttons: [{
                                    text: 'Trở lại'
                                }, {
                                    text: '<b>Xác nhận</b>',
                                    type: 'button-positive',
                                    onTap: function (e) {
                                        $scope.changeQuantity(num, item);
                                        if (!item.isServiceItem) {
                                            toaster.pop('success', "", 'Giảm ' + -num + ' [' + item.itemName + '] trong hoá đơn');
                                        }
                                        else {
                                            toaster.pop('success', "", 'Giảm [' + item.itemName + '] trong hoá đơn');
                                        }
                                    }
                                }]
                            });
                        } else {
                            $ionicPopup.show({
                                template: '<input type="text" ng-model="staff.username" placeholder="Tên đăng nhập"><input type="password" ng-model="staff.password" placeholder="Mật khẩu">',
                                title: 'Xác nhận huỷ món',
                                subTitle: 'Nhập thông tin tài khoản Quản lý để xác nhận huỷ món đã báo bếp',
                                scope: $scope,
                                buttons: [{
                                    text: 'Trở lại'
                                }, {
                                    text: '<b>Xác nhận</b>',
                                    type: 'button-positive',
                                    onTap: function (e) {
                                        if (!$scope.staff || !$scope.staff.username || !$scope.staff.password) {
                                            toaster.pop('error', "", 'Vui lòng kiểm tra thông tin tài khoản!');
                                            return false;
                                        } else {
                                            var url = Api.getMemberPermission;
                                            var method = 'POST';
                                            var d = {
                                                "username": $scope.staff.username,
                                                "password": $scope.staff.password
                                            };
                                            $unoRequest.makeRestful(url, method, d)
                                                .then(function (data) {
                                                    var permissionList = data.permissions;
                                                    var permission = permissionList.indexOf("POSIM_Setting_ViewCompanyInfo");
                                                    if (permission != -1) {
                                                        $scope.changeQuantity(num, item);
                                                        toaster.pop('success', "", 'Giảm ' + num + ' [' + item.itemName + '] trong hoá đơn');
                                                    } else {
                                                        toaster.pop('error', "", 'Tài khoản này không có quyền huỷ món!');
                                                    }
                                                })
                                                .catch(function (e) {
                                                    toaster.pop('error', "", 'Vui lòng kiểm tra thông tin tài khoản!');
                                                });
                                        }
                                    }
                                }]
                            });
                        }
                    }
                    break;
                case 3:
                    // xác nhận khi huỷ món
                    $scope.staff = {};
                    var findRoleIndex = findIndex($scope.authBootloader.rolesGranted, 'roleName', 'Quản lý');
                    if (findRoleIndex != null) {
                        $ionicPopup.show({
                            // template: '<input type="text" ng-model="staff.username" placeholder="Tên đăng nhập"><input type="password" ng-model="staff.password" placeholder="Mật khẩu">',
                            title: 'Xác nhận huỷ món',
                            subTitle: 'Bạn muốn huỷ món [' + item.itemName + '] ra khỏi đơn hàng ?',
                            scope: $scope,
                            buttons: [{
                                text: 'Trở lại'
                            }, {
                                text: '<b>Xác nhận</b>',
                                type: 'button-positive',
                                onTap: function (e) {
                                    $scope.changeQuantity(num, item);
                                    toaster.pop('success', "", 'Giảm ' + num + ' [' + item.itemName + '] trong hoá đơn');
                                }
                            }]
                        });
                    } else {
                        $ionicPopup.show({
                            template: '<input type="text" ng-model="staff.username" placeholder="Tên đăng nhập"><input type="password" ng-model="staff.password" placeholder="Mật khẩu">',
                            title: 'Xác nhận huỷ món',
                            subTitle: 'Nhập thông tin tài khoản Quản lý để xác nhận huỷ món đã báo bếp',
                            scope: $scope,
                            buttons: [{
                                text: 'Trở lại'
                            }, {
                                text: '<b>Xác nhận</b>',
                                type: 'button-positive',
                                onTap: function (e) {
                                    if (!$scope.staff || !$scope.staff.username || !$scope.staff.password) {
                                        toaster.pop('error', "", 'Vui lòng kiểm tra thông tin tài khoản!');
                                        return false;
                                    } else {
                                        var url = Api.getMemberPermission;
                                        var method = 'POST';
                                        var d = {
                                            "username": $scope.staff.username,
                                            "password": $scope.staff.password
                                        };
                                        $unoRequest.makeRestful(url, method, d)
                                            .then(function (data) {
                                                var permissionList = data.permissions;
                                                var permission = permissionList.indexOf("POSIM_Setting_ViewCompanyInfo");
                                                if (permission != -1) {
                                                    $scope.changeQuantity(num, item);
                                                    toaster.pop('success', "", 'Giảm ' + num + ' [' + item.itemName + '] trong hoá đơn');
                                                } else {
                                                    toaster.pop('error', "", 'Tài khoản này không có quyền huỷ món!');
                                                }
                                            })
                                            .catch(function (e) {
                                                toaster.pop('error', "", 'Tài khoản này không có quyền huỷ món!');
                                            });
                                    }
                                }
                            }]
                        });
                    }
                    break;
                case 4:
                    $scope.staff = {};
                    var findRoleIndex = findIndex($scope.authBootloader.rolesGranted, 'roleName', 'Chủ cửa hàng');
                    if (findRoleIndex != null) {
                        $ionicPopup.show({
                            // template: '<input type="text" ng-model="staff.username" placeholder="Tên đăng nhập"><input type="password" ng-model="staff.password" placeholder="Mật khẩu">',
                            title: 'Xác nhận huỷ món',
                            subTitle: 'Bạn muốn huỷ món [' + item.itemName + '] ra khỏi đơn hàng ?',
                            scope: $scope,
                            buttons: [{
                                text: 'Trở lại'
                            }, {
                                text: '<b>Xác nhận</b>',
                                type: 'button-positive',
                                onTap: function (e) {
                                    $scope.changeQuantity(num, item);
                                    toaster.pop('success', "", 'Giảm ' + num + ' [' + item.itemName + '] trong hoá đơn');
                                }
                            }]
                        });
                    } else {
                        $ionicPopup.show({
                            template: '<input type="text" ng-model="staff.username" placeholder="Tên đăng nhập"><input type="password" ng-model="staff.password" placeholder="Mật khẩu">',
                            title: 'Xác nhận huỷ món',
                            subTitle: 'Nhập thông tin tài khoản Quản lý để xác nhận huỷ món đã báo bếp',
                            scope: $scope,
                            buttons: [{
                                text: 'Trở lại'
                            }, {
                                text: '<b>Xác nhận</b>',
                                type: 'button-positive',
                                onTap: function (e) {
                                    if (!$scope.staff || !$scope.staff.username || !$scope.staff.password) {
                                        toaster.pop('error', "", 'Vui lòng kiểm tra thông tin tài khoản!');
                                        return false;
                                    } else {
                                        var url = Api.getMemberPermission;
                                        var method = 'POST';
                                        var d = {
                                            "username": $scope.staff.username,
                                            "password": $scope.staff.password
                                        };
                                        $unoRequest.makeRestful(url, method, d)
                                            .then(function (data) {
                                                var permissionList = data.permissions;
                                                var permission = permissionList.indexOf("POSIM_Price_ReadBuyPrice");
                                                if (permission != -1) {
                                                    $scope.changeQuantity(num, item);
                                                    toaster.pop('success', "", 'Giảm ' + num + ' [' + item.itemName + '] trong hoá đơn');
                                                } else {
                                                    toaster.pop('error', "", 'Tài khoản này không có quyền huỷ món!');
                                                }
                                            })
                                            .catch(function (e) {
                                                toaster.pop('error', "", 'Vui lòng kiểm tra thông tin tài khoản!');
                                            });
                                    }
                                }
                            }]
                        });
                    }
                    break;
            };
        }
    }

    $scope.modalItemOption = null;
    $scope.openItemOption = function (i, itemIndex) {
        $scope.pinItem = null;
        //Validate quyền thực hiện
        if ($scope.tableIsSelected
            && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.createdBy != SunoGlobal.userProfile.userId
            && !$scope.isManager
        ) {
            return toaster.pop('error', "", 'Bạn không được phép thao tác trên đơn hàng của nhân viên khác');
        }

        if (!$scope.isWebView) {
            $ionicModal.fromTemplateUrl('item-detail.html', {
                scope: $scope,
                animation: 'slide-in-up'
            }).then(function (modal) {
                $scope.modalItemOption = modal;
                $scope.showDiscount = true;
                $scope.showChangePrice = false;
                $scope.showChangeQuantity = false;
                $scope.modalItemOption.show();
            });
        }
        else {
            $scope.showOption = true;
            $ionicScrollDelegate.$getByHandle('orders-details').scrollTop();
        }
        $scope.selectedItem = i;
        $scope.showOrderDetails = false;
        $scope.selectedItemIndex = itemIndex;
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.lastInputedIndex = itemIndex;
    }

    $scope.closeModalItemOption = function () {
        if ($scope.modalItemOption) $scope.modalItemOption.hide();
        $scope.modalItemOption = null;
    }

    $scope.hideItemOption = function () {
        $scope.showOption = false;
    }

    $scope.openOrderDetails = function () {
        $scope.pinItem = null;
        $scope.showOption = false;
        if ($scope.tableIsSelected && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected] && $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.orderDetails.length > 0) {
            $scope.showOrderDetails = !$scope.showOrderDetails;
        }

        if (SunoGlobal.saleSetting.isApplyPromotion) {
            $scope.activatedPromotions = $unoSaleOrderCafe.getPromotions();
        }
    }

    $scope.closeOrderDetails = function () {
        $scope.customerS.key = null;
        $scope.showOrderDetails = false;
        $ionicScrollDelegate.resize();
    }

    //#endregion order action


    //#region Print
    $scope.printOrderBarKitchenInMobile = function (printDevice, saleOrder, BarItemSetting, setting) {

        var barOrder = angular.copy(saleOrder);
        barOrder.orderDetails = [];
        var kitchenOder = angular.copy(saleOrder);
        kitchenOder.orderDetails = [];
        for (var i = 0; i < saleOrder.orderDetails.length; i++) {
            var itemIndex = findIndex(BarItemSetting, 'itemId', saleOrder.orderDetails[i].itemId);
            if (itemIndex != null) {
                barOrder.orderDetails.push(saleOrder.orderDetails[i]);
            } else {
                kitchenOder.orderDetails.push(saleOrder.orderDetails[i]);
            }
        }

        if (kitchenOder.orderDetails.length > 0 && barOrder.orderDetails.length > 0) {
            kitchenOder = prepairOrderMobile(kitchenOder, setting);
            barOrder = prepairOrderMobile(barOrder, setting);

            $scope.printInMobile(kitchenOder, "BB", printDevice.kitchenPrinter).then(
                function (success) {
                    setTimeout(function () {
                        $scope.printInMobile(barOrder, "BB", printDevice.barPrinter).then(function (success) {

                        });
                    }, 3000);
                }
            );
        } else if (barOrder.orderDetails.length > 0) {
            printOrderInMobile(printDevice.barPrinter, barOrder, "BB", setting);
        } else if (kitchenOder.orderDetails.length > 0) {
            printOrderInMobile(printDevice.kitchenPrinter, kitchenOder, "BB", setting);
        }

    }

    $scope.printInMobile = function (saleOrder, type, printer) {
        //Print
        var deferred = $q.defer();
        var template = initPrintTemplate(saleOrder, type);

        data = {
            printer_type: parseInt(printer.printer), // 0: Error; 1:Bixolon; 2: Fujitsu
            ip: printer.ip,
            texts: template,
            feed: 30
        };

        window.Suno.printer_print(
            data, function (message) {
                SUNOCONFIG.LOG("IN THÀNH CÔNG");
                deferred.resolve();
            }, function (message) {
                SUNOCONFIG.LOG("CÓ LỖI XẢY RA");
                message.where = "printInMobile";
                deferred.reject(message);
            });
        return deferred.promise;
    }

    $scope.rePrint = function (o) {
        var setting = {
            companyInfo: $scope.companyInfo.companyInfo,
            allUsers: $scope.authBootloader.users,
            store: $scope.currentStore
        }
        var printOrder = angular.copy(o);

        if ($scope.printSetting.printNoticeKitchen == false) {
            // Neu cho phep in bao bep o thiet lap in 
            if ($scope.isWebView) {
                if ($scope.isUngroupItem && $scope.printSetting.noticeByStamps) {
                    printOrder.saleOrder = prepProcessStamps(printOrder.saleOrder);
                    printOrderInBrowser(printer, printOrder.saleOrder, 256, setting);
                }
                else {
                    if ($scope.printSetting.unGroupBarKitchen)
                        printOrderBarKitchen(printer, printOrder.saleOrder, $scope.BarItemSetting, setting);
                    else
                        printOrderInBrowser(printer, printOrder.saleOrder, 128, setting);
                }
            } else {
                if ($scope.isIOS && $scope.printDevice && $scope.printDevice.kitchenPrinter && $scope.printDevice.kitchenPrinter.status) {
                    if ($scope.printSetting.unGroupBarKitchen)
                        $scope.printOrderBarKitchenInMobile($scope.printDevice, printOrder.saleOrder, $scope.BarItemSetting, setting);
                    else
                        printOrderInMobile($scope.printDevice.kitchenPrinter, printOrder.saleOrder, "BB", setting);
                } else if ($scope.isAndroid && $scope.printDevice && $scope.printDevice.kitchenPrinter && $scope.printDevice.kitchenPrinter.status) {
                    if ($scope.printSetting.unGroupBarKitchen)
                        $scope.printOrderBarKitchenInMobile($scope.printDevice, printOrder.saleOrder, $scope.BarItemSetting, setting);
                    else
                        printOrderInMobile($scope.printDevice.kitchenPrinter, printOrder.saleOrder, "BB", setting);
                }
            }
        }

        toaster.pop('primary', "", 'Đã gửi đơn hàng xuống bếp!');
        $scope.modalPrintedList.hide();
    }

    $scope.closeRePrintList = function () {
        $scope.modalPrintedList.hide();
    }

    $scope.openModalPrintedList = function () {
        $ionicModal.fromTemplateUrl('printed-list.html', {
            scope: $scope,
            animation: 'slide-in-up'
        }).then(function (modal) {
            $scope.modalPrintedList = modal;
            $scope.modalPrintedList.show();
        });
    }

    $scope.closeModalPrintedList = function () {
        $scope.modalPrintedList.hide();
    }

    $scope.prePrint = function () {
        var printOrder = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder;
        printOrder.saleOrderCode = '';
        var setting = {
            companyInfo: $scope.userSession,
            allUsers: $scope.authBootloader.users,
            store: $scope.currentStore
        }
        if ($scope.isWebView) {
            var rs = printOrderInBrowser(printer, printOrder, 1, setting);
            if (rs) {
                audit(5, 'In hóa đơn tạm tính cho ' + printOrder.tableName + ', giá trị đơn hàng tạm tính là : ' + $filter('number')(printOrder.total, 0), '');
                toaster.pop('success', "", 'Đã in hoá đơn tạm tính.');
            } else {
                toaster.pop('error', "", 'Vui lòng kiểm tra lại mẫu in.');
            }
        } else if ($scope.isIOS && $scope.printDevice && $scope.printDevice.cashierPrinter.status && angular.isDefined(window.Suno)) {
            // SUNOCONFIG.LOG('in bep truc tiep tren IOS');
            printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
            // printOrderInMobile($scope.printDevice.cashierPrinter.ip,printOrder,"TT",setting);
            audit(5, 'In hóa đơn tạm tính cho ' + printOrder.tableName + ', giá trị đơn hàng tạm tính là : ' + $filter('number')(printOrder.total, 0), '');
            toaster.pop('success', "", 'Đã in hoá đơn tạm tính.');
        } else if ($scope.isAndroid) {
            if ($scope.printDevice) {
                // SUNOCONFIG.LOG('in bep Android');
                printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
                // printOrderInMobile($scope.printDevice.cashierPrinter.ip,printOrder,"TT",setting);
                audit(5, 'In hóa đơn tạm tính cho ' + printOrder.tableName + ', giá trị đơn hàng tạm tính là : ' + $filter('number')(printOrder.total, 0), '');
                toaster.pop('success', "", 'Đã in hoá đơn tạm tính.');
            }
        }
    }

    $scope.savePrintHelper = function (printHelper) {
        if (printHelper) {
            DBSettings.$getDocByID({ _id: 'printHelper' })
                .then(function (data) {
                    if (data.docs.length > 0) {
                        DBSettings.$addDoc({ _id: 'printHelper', printHelper: printHelper, _rev: data.docs[0]._rev })
                            .then(function (data) {
                                $scope.printHelperTemp = angular.copy(printHelper);
                                toaster.pop('success', "", 'Đã lưu thiết lập in nhờ thành công!');
                                SUNOCONFIG.LOG('Print', data);
                                return $scope.modalPrintSetting.hide();
                            })
                            .catch(function (error) {
                                SUNOCONFIG.LOG('printHelper', error);
                                toaster.pop('error', "", 'Đã có lỗi xảy ra, lưu thiết lập in nhờ không thành công!');
                            });
                    }
                    else {
                        DBSettings.$addDoc({ _id: 'printHelper', printHelper: printHelper })
                            .then(function (data) {
                                $scope.printHelperTemp = angular.copy(printHelper);
                                toaster.pop('success', "", 'Đã lưu thiết lập in nhờ thành công!');
                                SUNOCONFIG.LOG('printHelper', data);
                                return $scope.modalPrintSetting.hide();
                            })
                            .catch(function (error) {
                                SUNOCONFIG.LOG('printHelper', error);
                                toaster.pop('error', "", 'Đã có lỗi xảy ra, lưu thiết lập in nhờ không thành công!');
                            });
                    }
                })
            $scope.printHelper = printHelper;
        }
    }

    $scope.savePrintSetting = function (setting) {
        if (!$scope.isManager) {
            return toaster.pop('error', '', 'Bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ quản lý');
        }
        $ionicPopup.show({
            title: 'Thông báo',
            template: '<p style="text-align: center;">Để hoàn tất việc lưu thiết lập in, bạn phải thực hiện <b>KẾT CA</b> cuối ngày, bấm xác nhận để thực hiện.</p><p style="text-align: center;">Nếu đang trong ca làm việc, bạn có thể thiết lập cấu hình vào cuối ca hoặc ca ngày hôm sau.</p>',
            buttons: [
                {
                    text: 'Hủy',
                    onTap: function (e) {
                        $scope.printSetting = angular.copy($scope.printSettingTemp);
                        $scope.modalPrintSetting.hide();
                    }
                },
                {
                    text: '<b>Xác nhận</b>',
                    type: 'button-positive',
                    onTap: function (e) {
                        var s = {
                            'printSubmitOrder': setting && setting.printSubmitOrder ? setting.printSubmitOrder : false,
                            'printNoticeKitchen': setting && setting.printNoticeKitchen ? setting.printNoticeKitchen : false,
                            'prePrint': setting && setting.prePrint ? setting.prePrint : false,
                            'unGroupItem': setting && setting.unGroupItem ? setting.unGroupItem : false,
                            'unGroupBarKitchen': setting && setting.unGroupBarKitchen ? setting.unGroupBarKitchen : false,
                            'noticeByStamps': setting && setting.noticeByStamps ? setting.noticeByStamps : false,
                            'acceptSysMessage': setting && setting.acceptSysMessage ? setting.acceptSysMessage : false
                        };

                        var url = Api.postKeyValue;
                        var method = 'POST';
                        var d = {
                            "key": "printSetting",
                            "value": JSON.stringify(s)
                        }
                        $unoRequest.makeRestful(url, method, d)
                            .then(function () {
                                endSessionWithoutConfirm('Lưu thiết lập in.', function () {
                                    toaster.pop('success', "", 'Lưu thiết lập thành công!');
                                    $scope.modalPrintSetting.hide();
                                })
                            })
                            .catch(function (e) {
                                $scope.printSetting = angular.copy($scope.printSettingTemp);
                                toaster.pop('error', "", 'Lưu thiết lập chưa thành công!');
                            });
                    }
                }
            ]
        });
    }

    $scope.savePrinterInfo = function (printDevice) {
        if (printDevice) {
            if ((printDevice.kitchenPrinter && printDevice.kitchenPrinter.status && printDevice.kitchenPrinter.ip == null) || (printDevice.cashierPrinter && printDevice.cashierPrinter.status && printDevice.cashierPrinter.ip == null)) {
                return toaster.pop('warning', "", 'Bạn chưa thiết lập địa chỉ máy in');
            }
            DBSettings.$getDocByID({ _id: 'printDevice' })
                .then(function (data) {
                    if (data.docs.length > 0) {
                        DBSettings.$addDoc({ _id: 'printDevice', printDevice: printDevice, _rev: data.docs[0]._rev })
                            .then(function (data) {
                                $scope.printDevice = printDevice;
                                $scope.printDeviceTemp = angular.copy(printDevice);
                                toaster.pop('success', "", 'Đã lưu thông tin máy in thành công!');
                                $scope.closeSetting();
                            })
                            .catch(function (error) {
                                SUNOCONFIG.LOG(error);
                            });
                    }
                    else {
                        DBSettings.$addDoc({ _id: 'printDevice', printDevice: printDevice })
                            .then(function (data) {
                                $scope.printDevice = printDevice;
                                $scope.printDeviceTemp = angular.copy(printDevice);
                                toaster.pop('success', "", 'Đã lưu thông tin máy in thành công!');
                                $scope.closeSetting();
                            })
                            .catch(function (error) {
                                SUNOCONFIG.LOG(error);
                            });
                    }
                });
        }
    }

    $scope.rePrintOrder = function (o) {
        var url = Api.getOrderInfo + o.id;
        var method = 'GET';
        var d = null;
        $unoRequest.makeRestful(url, method, d)
            .then(function (data) {
                var printOrder = data.saleOrder;
                var setting = {
                    companyInfo: $scope.companyInfo.companyInfo,
                    allUsers: $scope.authBootloader.users,
                    store: $scope.currentStore
                }
                if ($scope.isWebView) {
                    var rs = printOrderInBrowser(printer, printOrder, 1, setting);
                    if (rs) {
                        toaster.pop('success', "", 'Đã in hoá đơn thành công.');
                    } else {
                        toaster.pop('error', "", 'Vui lòng kiểm tra lại mẫu in.');
                    }
                } else if ($scope.isIOS && $scope.printDevice && $scope.printDevice.cashierPrinter && $scope.printDevice.cashierPrinter.status && angular.isDefined(window.Suno)) {
                    printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
                    // printOrderInMobile($scope.printDevice.cashierPrinter.ip,printOrder,"TT",setting);
                    toaster.pop('success', "", 'Đã in hoá đơn thành công.');
                } else if ($scope.isAndroid && $scope.printDevice && $scope.printDevice.cashierPrinter && $scope.printDevice.cashierPrinter.status && angular.isDefined(window.Suno)) {
                    printOrderInMobile($scope.printDevice.cashierPrinter, printOrder, "TT", setting);
                    // printOrderInMobile($scope.printDevice.cashierPrinter.ip,printOrder,"TT",setting);
                    toaster.pop('success', "", 'Đã in hoá đơn thành công.');
                }
                audit(5, 'In lại hóa đơn ' + printOrder.saleOrderCode + ', giá trị đơn hàng: ' + $filter('number')(printOrder.total, 0), '');
                $scope.$apply();
            })
            .catch(function (e) {
                SUNOCONFIG.LOG(e);
            });
    }

    $scope.printReport = function () {
        var setting = {
            companyInfo: $scope.companyInfo.companyInfo,
            allUsers: $scope.authBootloader.users,
            store: $scope.currentStore
        }
        //$scope.reports.balance = $scope.balance;
        //$scope.reports.fromDate = $scope.modalStoreReport.fromDate;
        //$scope.reports.toDate = $scope.modalStoreReport.toDate;
        var printObj = angular.copy($scope.reportModel);
        printObj.balance = $scope.balance;
        printObj.fromDate = $scope.modalStoreReport.fromDate;
        printObj.toDate = $scope.modalStoreReport.toDate;
        printObj.total = printObj.saleMoney;
        printObj.totalCash = printObj.remainMoney;
        printObj.totalExpense = printObj.expenseMoney;
        printObj.totalPaidDebt = printObj.paidDebtMoney;
        printObj.paymentMethod = $scope.currentPaymentMethodReport.label;
        printReport(printer, printObj, setting);
    }

    //#endregion print


    //#region Hotkey

    if ($scope.isWebView && !window.isMobileDevice) {
        hotkeys.add({
            combo: 'f10',
            description: 'Lưu và in',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                if (!$scope.isInTable) {
                    $scope.submitOrder(true);
                }
                else {
                    toaster.pop('warning', '', 'Bạn đang ở sơ đồ bàn, vui lòng chọn đơn hàng cần thanh toán.');
                }
            }
        });

        hotkeys.add({
            combo: 'f9',
            description: 'Báo bếp',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                $scope.noticeToTheKitchen();
            }
        });

        hotkeys.add({
            combo: 'f8',
            description: 'Mở thực đơn / sơ đồ bàn',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                $scope.pinItem = null;
                $scope.showOption = true;
                $scope.showOrderDetails = false;
                $scope.sugUserList = false;
                $scope.searchUserList = [];
                $scope.customerS = { key: null };
                $scope.switchLayout();
            }
        });

        hotkeys.add({
            combo: 'f7',
            description: 'Thêm hàng hóa F2',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                if ($scope.onSearchField) {
                    $scope.onSearchField = false;
                    $("#productSearchInput").blur();
                }
                else {
                    $scope.onSearchField = true;
                    $scope.ItemIsSelected = null;
                    $("#productSearchInput").focus();
                }
            }
        });

        hotkeys.add({
            combo: 'right',
            description: 'Chuyển bàn / Chuyển món',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                $scope.isUseKeyboard = true;
                if (!$scope.onSearchField) {
                    $scope.changeTableOrItemByHotKey(1);
                }
            }
        });

        hotkeys.add({
            combo: 'left',
            description: 'Chuyển bàn',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                $scope.isUseKeyboard = true;
                //var focus = $('#productSearchInput').is(':focus');
                if (!$scope.onSearchField) {
                    $scope.changeTableOrItemByHotKey(-1);
                }
            }
        });

        hotkeys.add({
            combo: 'enter',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            description: 'Chọn hàng hóa hoặc chọn bàn',
            callback: function () {
                //var focus = $('#productSearchInput').is(':focus');
                if (!$scope.onSearchField) {
                    enterHandler();
                }
            }
        });

        hotkeys.add({
            combo: 'down',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            description: 'Chọn hàng hóa hoặc chọn bàn',
            callback: function () {
                $scope.isUseKeyboard = true;
                if (!$scope.isInTable && !$scope.onSearchField) {
                    $scope.changeTableOrItemByHotKey($scope.quantityItemPerRow);
                }
                else if ($scope.isInTable && !$scope.onSearchField) {
                    $scope.changeTableOrItemByHotKey($scope.quantityTablePerRow);
                }
            }
        });

        hotkeys.add({
            combo: 'up',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            description: 'Chọn hàng hóa',
            callback: function () {
                //SUNOCONFIG.LOG('up');
                $scope.isUseKeyboard = true;
                if (!$scope.isInTable && !$scope.onSearchField) {
                    $scope.changeTableOrItemByHotKey(-$scope.quantityItemPerRow);
                }
                else if ($scope.isInTable && !$scope.onSearchField) {
                    $scope.changeTableOrItemByHotKey(-$scope.quantityTablePerRow);
                }
            }
        });

        hotkeys.add({
            combo: 'f4',
            allowIn: ['INPUT', 'BUTTON'],
            description: 'Chi tiết hóa đơn',
            callback: function () {
                if (!$scope.isInTable) {
                    $scope.openOrderDetails();
                }
            }
        });

        hotkeys.add({
            combo: 'tab',
            callback: function () {

            }
        });
    }

    var enterHandler = function () {
        if ($scope.isUseKeyboard) {
            //Nếu đang ở màn hình sơ đồ bàn và không có chọn hàng hóa ở ô search.
            if ($scope.isInTable && !$scope.onSearchField) {
                //Xác định context đang chọn.
                var filteredTable = $filter('filter')($scope.tables, $scope.currentZone);
                var tableIndex = findIndex(filteredTable, 'tableUuid', $scope.tableIsSelected.tableUuid);
                if (tableIndex != null) {
                    //Nếu index null thì item đang chọn ko thuộc context này không cho chọn.
                    //Chuyển sang view chọn món.
                    $scope.switchLayout();
                    buildHotKeyIndex();
                }
            }
            //Nếu đang ở màn hình chọn món và không có chọn hàng hóa ở ô search.
            else if (!$scope.isInTable && !$scope.onSearchField) {
                $scope.pickProduct($scope.ItemIsSelected);
            }
            ////Nếu đang ở ô search
            //else if ($scope.onSearchField) {
            //    //SUNOCONFIG.LOG($scope.ItemSearchIsSelected);
            //    $scope.pickProduct($scope.ItemSearchIsSelected);
            //    $scope.ItemSearchIsSelected = null;
            //    //$scope.onSearchField = false;
            //    $("#productSearchInput").focus();
            //}
        }
    }

    $scope.tapInputSearch = function () {
        $scope.onSearchField = true;
    }

    $scope.isOnCustomerSearch = false;
    $scope.tapCustomerSearch = function () {
        $scope.onSearchField = false;
    }

    var scrollAcction = 0;

    $scope.scrollAcction = 0;
    var screenHeight = $(window).height();

    var changeTableIndex = function (table) {
        $scope.tableIsSelected = table;
        $scope.pinItem = null;
    }

    //Hàm dùng thay đổi index của bàn hoặc item bằng phím tắt.
    $scope.changeTableOrItemByHotKey = function (offset) {

        if ($scope.isInTable) {
            // Di chuyển chọn bàn

            var filteredTable = $filter('filter')($scope.tables, $scope.currentZone);
            //Luôn phải có bàn mang về ở đầu
            if (filteredTable.length > 0 && filteredTable[0].tableName !== 'Mang về') {
                //Thêm bàn mang về vào đầu nếu chưa có.
                filteredTable.unshift($scope.tables[0]);
            }
            else if (filteredTable.length == 0) {
                filteredTable.push($scope.tables[0]);
            }

            var tableIndex = findIndex(filteredTable, 'tableUuid', $scope.tableIsSelected.tableUuid);
            if (tableIndex == null && filteredTable.length > 0) {
                //Nếu index null thì set mặc định là ở bàn mang về.
                tableIndex = 0;
            }
            if ((offset < 0 && tableIndex > -offset) || (offset > 0 && tableIndex < filteredTable.length - offset && tableIndex > 0))
                //$scope.openTable(filteredTable[tableIndex + offset], false);
                changeTableIndex(filteredTable[tableIndex + offset]);
            else if ((tableIndex == 1 && offset < -1) || (tableIndex == 1 && offset == -1)) {
                //$scope.openTable(filteredTable[tableIndex - 1], false);
                changeTableIndex(filteredTable[tableIndex - 1]);
            }
            else if (tableIndex == 0 && offset >= 1 && tableIndex < filteredTable.length - offset) {
                //$scope.openTable(filteredTable[tableIndex + 1], false);
                changeTableIndex(filteredTable[tableIndex + 1]);
            }

            try {
                var p1 = document.getElementById('p1-' + $scope.tableIsSelected.tableUuid);
                var quotePosition = $ionicPosition.position(angular.element(p1));

                if (offset > 0) {
                    if (quotePosition.top > screenHeight - 151) {
                        // SUNOCONFIG.LOG(quotePosition.top,$scope.scrollAcction,quotePosition.top * $scope.scrollAcction);
                        $scope.scrollAcction++;
                        var delegate = $ionicScrollDelegate.$getByHandle('tables');
                        delegate.scrollTo(0, (screenHeight - 151) * $scope.scrollAcction, true);
                    }
                } else if (offset < 0) {
                    if (quotePosition.top < 0) {
                        // SUNOCONFIG.LOG(quotePosition.top,$scope.scrollAcction,quotePosition.top * $scope.scrollAcction);
                        $scope.scrollAcction--;
                        var delegate = $ionicScrollDelegate.$getByHandle('tables');
                        delegate.scrollTo(0, (screenHeight - 151) * $scope.scrollAcction, true);
                    }
                }
            }
            catch (e) {
                //SUNOCONFIG.LOG(e);
            }
        } else {
            // Di chuyển chọn món
            if (!$scope.ItemIsSelected) {
                $scope.ItemIsSelected = $scope.productItemList[0];
            } else {
                var itemIndex = findIndex($scope.productItemList, 'itemId', $scope.ItemIsSelected.itemId);
                if ((offset < 0 && itemIndex >= -offset) || (offset > 0 && itemIndex < $scope.productItemList.length - offset))
                    $scope.ItemIsSelected = $scope.productItemList[itemIndex + offset];

                // Cuộn màn hình theo item selected  
                var p2 = document.getElementById('p2-' + $scope.ItemIsSelected.itemId);
                var quotePosition = $ionicPosition.position(angular.element(p2));
                // SUNOCONFIG.LOG(angular.element(p2));
                if (offset > 0) {
                    if (quotePosition.top > screenHeight - 151) {
                        // SUNOCONFIG.LOG(quotePosition.top,$scope.scrollAcction,quotePosition.top * $scope.scrollAcction);
                        $scope.scrollAcction++;
                        var delegate = $ionicScrollDelegate.$getByHandle('productItemList');
                        delegate.scrollTo(0, (screenHeight - 151) * $scope.scrollAcction, true);

                    }
                } else if (offset < 0) {
                    if (quotePosition.top < 0) {
                        // SUNOCONFIG.LOG(quotePosition.top,$scope.scrollAcction,quotePosition.top * $scope.scrollAcction);
                        $scope.scrollAcction--;
                        var delegate = $ionicScrollDelegate.$getByHandle('productItemList');
                        delegate.scrollTo(0, (screenHeight - 151) * $scope.scrollAcction, true);
                    }
                }
            }
        }
    }

    //#endregion hotkey


    //#region Report

    $scope.reportModel = {
        total: 0,
        totalPaidDebt: 0,
        totalExpense: 0,
        totalCash: 0,
        totalPaidDebtCash: 0,
        totalExpenseCash: 0,
        saleCount: 0,
        saleTotal: 0,
        cashTotal: 0,
        cardTotal: 0,
        debtTotal: 0,
        discountTotal: 0,
        subFeeTotal: 0,
        saleMoney: 0,
        expenseMoney: 0,
        paidDebtMoney: 0,
        remainMoney: 0
    }

    $scope.getStoreReport = function (from, to) {
        if ($scope.popoverStaffList) $scope.popoverStaffList.hide();
        if (typeof from == 'undefined') from = null;
        if (typeof to == 'undefined') to = null;

        var curr = new Date();
        var fromDate = from ? from.toJSON() : new Date(curr.getFullYear(), curr.getMonth(), curr.getDate(), 0, 0, 0, 0).toJSON();
        var toDate = to ? to.toJSON() : new Date(curr.getFullYear(), curr.getMonth(), curr.getDate(), 23, 59, 59, 0).toJSON();
        //var url = Api.storeReport + 'limit=10000&fromDate=' + fromDate + '&toDate=' + toDate;
        //var method = 'GET';
        //var d = null;
        var url = Api.storeReport;
        var method = 'POST';
        var d = {
            filter: {
                limit: 10000,
                pageIndex: 1
            },
            fromDate: fromDate,
            toDate: toDate,
            storeId: $scope.currentStore.storeId,
            saleUserId: null,
        }

        return $unoRequest.makeRestful(url, method, d)
            .then(function (data) {
                //console.log(angular.copy(data));
                $scope.reports = data;
                //Thêm cho details
                for (var x = 0; x < data.storeSales.length; x++) {
                    var item = $scope.reports.storeSales[x];
                    item.isCollapse = true;
                    item.details = [];
                };
                //Lọc theo cửa hàng.
                $scope.reports.storeSales = $filter('filter')($scope.reports.storeSales, { 'storeId': $scope.currentStore.storeID });
                $scope.reports.storeExpenses = $filter('filter')($scope.reports.storeExpenses, { 'storeId': $scope.currentStore.storeID });
                $scope.reports.storePaidDebts = $filter('filter')($scope.reports.storePaidDebts, { 'storeId': $scope.currentStore.storeID });

                //Tính lại các giá trị dựa trên cửa hàng.
                filterReportByStore($scope.reports);
                $scope.reportModel = angular.copy($scope.reports);
                //console.log($scope.reportModel);
                //Lọc theo user
                if (!$scope.isManager) {
                    $scope.filterBySale($scope.userSession);
                    $scope.reports = angular.copy($scope.reportModel);
                }

                //Mặc định là phương thức thanh toán tất cả
                $scope.reportModel.saleMoney = $scope.reportModel.saleTotal;
                $scope.reportModel.expenseMoney = $scope.reportModel.totalExpense;
                $scope.reportModel.paidDebtMoney = $scope.reportModel.paidDebtMoney;
                $scope.balance = $scope.balance || 0;
                $scope.reportModel.remainMoney = $scope.balance + $scope.reportModel.saleMoney - $scope.reportModel.expenseMoney + $scope.reportModel.paidDebtMoney;

                $scope.$apply();
                return null;
            })
            .catch(function (e) {
                return e;
            });
    }

    $scope.getBalance = function () {
        var url = Api.getKeyValue + 'getBalance=' + $scope.currentStore.storeID;
        var method = 'GET';
        var d = null;
        return $unoRequest.makeRestful(url, method, d)
            .then(function (data) {
                if (data.value != "") {
                    var rs = JSON.parse(data.value);
                    $scope.balance = rs;
                    $scope.$apply();
                    // SUNOCONFIG.LOG(rs);
                } else {
                    $scope.balance = 0;
                }
                return null;
            })
            .catch(function (e) {
                return e;
            });
    }

    $scope.paymentMethodsReport = [
        { id: 0, label: 'Tất cả' },
        { id: 1, label: 'Tiền mặt' },
        { id: 2, label: 'Thẻ' }
    ];
    $scope.currentPaymentMethodReport = $scope.paymentMethodsReport[0];

    $scope.saleList = [{ userId: 0, displayName: 'Tất cả' }];
    $scope.currentUserReport = $scope.saleList[0];

    $scope.changePaymentMethodReport = function (method) {
        $scope.currentPaymentMethodReport = method;
        //Tính lại
        if (method.label == 'Tất cả') {
            $scope.reportModel.saleMoney = $scope.reportModel.saleTotal - $scope.reportModel.debtTotal;
            $scope.reportModel.expenseMoney = $scope.reportModel.totalExpense;
            $scope.reportModel.paidDebtMoney = $scope.reportModel.totalPaidDebt;
            $scope.balance = $scope.balance || 0;
            $scope.reportModel.remainMoney = $scope.balance + $scope.reportModel.saleMoney - $scope.reportModel.expenseMoney + $scope.reportModel.paidDebtMoney;
        }
        else if (method.label == 'Tiền mặt') {
            $scope.reportModel.saleMoney = $scope.reportModel.cashTotal;
            $scope.reportModel.expenseMoney = $scope.reportModel.totalExpenseCash;
            $scope.reportModel.paidDebtMoney = $scope.reportModel.totalPaidDebtCash;
            $scope.balance = $scope.balance || 0;
            $scope.reportModel.remainMoney = $scope.balance + $scope.reportModel.saleMoney - $scope.reportModel.expenseMoney + $scope.reportModel.paidDebtMoney;
        }
        else { //method == 'Thẻ', tính expenseMoney, paidDebtMoney theo thẻ dựa vào storeExpenses và storePaidDebts.
            var expenseMoney = 0;
            var paidDebtMoney = 0;
            if ($scope.currentUserReport.userId == 0) {
                for (var x = 0; x < $scope.reportModel.storeExpenses.length; x++) {
                    if ($scope.reportModel.storeExpenses[x].paymentMethodId == 2) {
                        expenseMoney += $scope.reportModel.storeExpenses[x].payment;
                    }
                }

                for (var x = 0; x < $scope.reportModel.storePaidDebts.length; x++) {
                    if ($scope.reportModel.storePaidDebts[x].paymentMethodId == 2) {
                        paidDebtMoney += $scope.reportModel.storePaidDebts[x].amount;
                    }
                }
            }
            else {
                for (var x = 0; x < $scope.reportModel.storeExpenses.length; x++) {
                    if ($scope.reportModel.storeExpenses[x].paymentMethodId == 2 && $scope.reportModel.storeExpenses.findIndex(function (expense) { return expense.userId == $scope.currentUserReport.userId; }) > -1) {
                        expenseMoney += $scope.reportModel.storeExpenses[x].payment;
                    }
                }

                for (var x = 0; x < $scope.reportModel.storePaidDebts.length; x++) {
                    if ($scope.reportModel.storePaidDebts[x].paymentMethodId == 2 && $scope.reportModel.storePaidDebts.findIndex(function (paidDebt) { return paidDebt.userId == $scope.currentUserReport.userId; }) > -1) {
                        paidDebtMoney += $scope.reportModel.storePaidDebts[x].amount;
                    }
                }
            }

            $scope.reportModel.saleMoney = $scope.reportModel.cardTotal;
            $scope.reportModel.expenseMoney = expenseMoney;
            $scope.reportModel.paidDebtMoney = paidDebtMoney;
            $scope.reportModel.remainMoney = $scope.reportModel.saleMoney - $scope.reportModel.expenseMoney + $scope.reportModel.paidDebtMoney;
        }
    };

    $scope.filterBySale = function (sale) {
        $scope.currentUserReport = sale;
        if (sale.userId != 0) {
            var saleCount = 0;
            var saleTotal = 0;
            var cashTotal = 0;
            var cardTotal = 0;
            var debtTotal = 0;
            var discountTotal = 0;
            var subFeeTotal = 0;
            var totalExpense = 0;
            var totalPaidDebt = 0;
            var totalExpenseCash = 0;
            var totalPaidDebtCash = 0;

            for (var i = 0; i < $scope.reports.storeSales.length; i++) {
                var item = $scope.reports.storeSales[i];
                if (item.userId == sale.userId) {
                    saleCount++;
                    saleTotal += item.total;
                    cashTotal += item.cashTotal;
                    cardTotal += item.cardTotal;
                    debtTotal += item.debtTotal;
                    discountTotal += item.discount;
                    subFeeTotal += item.subFee;
                }
            }

            for (var i = 0; i < $scope.reports.storeExpenses.length; i++) {
                var item = $scope.reports.storeExpenses[i];
                if (item.userId == sale.userId) {
                    totalExpense += item.payment;
                    if (item.paymentMethodId == 1) totalExpenseCash += item.payment;
                }
            }

            for (var i = 0; i < $scope.reports.storePaidDebts.length; i++) {
                var item = $scope.reports.storePaidDebts[i];
                if (item.userId == sale.userId) {
                    totalPaidDebt += item.amount;
                    if (item.paymentMethodId == 1) totalPaidDebtCash += item.amount;
                }
            }

            $scope.reportModel.totalPaidDebtCash = totalPaidDebtCash;
            $scope.reportModel.totalPaidDebt = totalPaidDebt;
            $scope.reportModel.totalExpense = totalExpense;
            $scope.reportModel.totalExpenseCash = totalExpenseCash;
            $scope.reportModel.saleCount = saleCount;
            $scope.reportModel.saleTotal = saleTotal;
            $scope.reportModel.cashTotal = cashTotal;
            $scope.reportModel.cardTotal = cardTotal;
            $scope.reportModel.debtTotal = debtTotal;
            $scope.reportModel.discountTotal = discountTotal;
            $scope.reportModel.subFeeTotal = subFeeTotal;
        }
        else {
            $scope.reportModel = angular.copy($scope.reports);
        }
        $scope.changePaymentMethodReport($scope.currentPaymentMethodReport);
        if ($scope.popoverStaffList) $scope.popoverStaffList.hide();
    }

    $scope.openStoreReport = function () {
        $scope.popoverSettings.hide();

        $ionicModal.fromTemplateUrl('store-report.html', {
            scope: $scope,
            animation: 'slide-in-up',
            // backdropClickToClose: false
        }).then(function (modal) {
            var curr = new Date();
            $scope.modalStoreReport = modal;
            $scope.modalStoreReport.fromDate = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate(), 0, 0, 0, 0);
            $scope.modalStoreReport.toDate = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate(), 23, 59, 59, 0);
            return $scope.getStoreReport();
        })
            .then(function () {
                return $scope.getBalance();
            })
            .then(function () {
                $scope.modalStoreReport.show();
                $scope.changePaymentMethodReport($scope.currentPaymentMethodReport);
                //$scope.paymentMethod = { val: "1" };
                //$scope.selectPaymentMethod($scope.paymentMethod);
                //$scope.totalCash($scope.paymentMethod);
            })
            .catch(function (error) {
                SUNOCONFIG.LOG(error);
            });
    }

    $scope.renewStoreReport = function (from, to) {
        $scope.getStoreReport(from, to)
            .then(function () {
                return $scope.getBalance();
            })
            .then(function () {
                $scope.modalStoreReport.show();
                $scope.changePaymentMethodReport($scope.currentPaymentMethodReport);
                //$scope.paymentMethod = { val: "1" };
                //$scope.selectPaymentMethod($scope.paymentMethod);
                //$scope.totalCash($scope.paymentMethod);
            })
            .catch(function (error) { SUNOCONFIG.LOG(error); });
    }

    $scope.closeStoreReport = function () {
        $scope.modalStoreReport.hide();
    }

    $scope.viewChangeBalance = false;

    $scope.changeBalance = function () {
        $scope.viewChangeBalance = true;
    }

    $scope.updateBalance = function (balance) {
        $scope.viewChangeBalance = false;

        var url = Api.postKeyValue;
        var method = 'POST';
        var d = {
            "key": "getBalance=" + $scope.currentStore.storeID,
            "value": JSON.stringify(balance)
        }
        $unoRequest.makeRestful(url, method, d)
            .then(function (data) {
                if ($scope.modalStoreReport) {
                    $scope.modalStoreReport.hide();
                }
                toaster.pop('success', "", 'Đã cập nhật tồn quỹ đầu ca!');
            })
            .catch(function (e) {
                SUNOCONFIG.LOG(e);
            });
    }

    $scope.showReportDetails = function (order) {
        if (order.isCollapse) {
            //Open
            order.isCollapse = false;
            if (order.details.length == 0) {
                var url = ApiUrl + 'sale/order?saleOrderId=' + order.id;
                var method = 'GET';
                var d = null;
                $unoRequest.makeRestful(url, method, d)
                    .then(function (data) {
                        order.details = data.saleOrder.orderDetails;
                        $scope.$apply();
                    })
                    .catch(function (e) {
                        toaster.pop('error', "", 'Lấy thông tin về chi tiết đơn hàng không thành công! Vui lòng thử lại');
                    });
            }
        }
        else {
            //Collapse
            order.isCollapse = true;
        }
    };

    $scope.changeSale = function (s) {
        $scope.currentSale = s;
        $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.seller = s;
        $scope.popoverSaleList.hide();
    }

    //$scope.totalCash = function (method) {
    //    if (method == "0") {
    //        total = $scope.reportModel.saleTotal - $scope.reportModel.debtTotal;
    //        totalPaidDebt = $scope.reportModel.totalPaidDebt;
    //        totalExpense = $scope.reportModel.totalExpense;
    //    } else if (method == "1") {
    //        total = $scope.reportModel.cashTotal;
    //        totalPaidDebt = $scope.reportModel.totalPaidDebtCash;
    //        totalExpense = $scope.reportModel.totalExpenseCash;
    //    } else {
    //        total = $scope.reportModel.cardTotal;
    //        totalPaidDebt = $scope.reports.totalPaidDebt - $scope.reports.totalPaidDebtCash;
    //        totalExpense = $scope.reports.totalExpense - $scope.reports.totalExpenseCash;
    //    }
    //    return parseFloat(total) + parseFloat($scope.balance) + parseFloat(totalPaidDebt) - parseFloat(totalExpense);
    //}

    //$scope.selectPaymentMethod = function (method) {
    //    var total = 0;
    //    var totalPaidDebt = 0;
    //    var totalExpense = 0;
    //    //var totalExpense = 0;
    //    //var totalPaidDebt = 0;
    //    $scope.balance = $scope.balance ? $scope.balance : 0;

    //    if (method.val == "0") {
    //        //$scope.reports.paymentMethod = 'Tất cả';
    //        $scope.reportModel.total = $scope.reportModel.saleTotal - $scope.reportModel.debtTotal;
    //    } else if (method.val == "1") {
    //        //$scope.reports.paymentMethod = 'Tiền mặt';
    //        $scope.reportModel.total = $scope.reportModel.cashTotal;
    //    } else {
    //        //$scope.reports.paymentMethod = 'Thẻ';
    //        $scope.reportModel.total = $scope.reportModel.cardTotal;
    //    }
    //    for (var i = 0; i < $scope.reports.storeExpenses.length; i++) {
    //        if ($scope.currentUserReport == null || $scope.reports.storeExpenses.findIndex(function (expense) { return expense.userId == $scope.currentUserReport.userId; }) > -1) {
    //            var item = $scope.reports.storeExpenses[i];
    //            if (parseInt(method.val) == item.paymentMethodId || parseInt(method.val) == 0) {
    //                totalExpense += item.payment
    //            }
    //        }
    //    }

    //    for (var i = 0; i < $scope.reports.storePaidDebts.length; i++) {
    //        if ($scope.currentUserReport == null || $scope.reports.storePaidDebts.findIndex(function (expense) { return expense.userId == $scope.currentUserReport.userId; }) > -1) {
    //            var item = $scope.reports.storePaidDebts[i];
    //            if (parseInt(method.val) == item.paymentMethodId || parseInt(method.val) == 0) {
    //                totalPaidDebt += item.amount
    //            }
    //        }
    //    }

    //    $scope.reportModel.totalPaidDebt = totalPaidDebt;
    //    $scope.reportModel.totalExpense = totalExpense;
    //    $scope.reportModel.totalCash = $scope.totalCash(method.val);

    //}

    $scope.openPopOverPaymentMethod = function (e) {
        $scope.popoverPaymentMethod.show(e);
    }

    $scope.openPopOverSaleList = function (e) {
        $ionicPopover.fromTemplateUrl('user-in-store-list.html', {
            scope: $scope
        }).then(function (popover) {
            $scope.popoverSaleList = popover;
            $scope.popoverSaleList.show(e);
        });
    }

    //#endregion report


    //#region Unclassify or common

    $scope.saveServiceSetting = function () {

        if ($scope.hourService.optionSelected == 0 && isNaN(parseFloat($scope.hourService.blockCounter))) {
            return toaster.pop('error', '', 'Vui lòng nhập giá trị cho block muốn làm tròn');
        }
        $ionicPopup.show({
            title: 'Thông báo',
            template: '<p style="text-align: center;">Để hoàn tất việc cấu hình sử dụng dịch vụ theo giờ, bạn phải thực hiện <b>RESET</b> dữ liệu, bấm xác nhận để thực hiện.</p><p style="text-align: center;">Nếu đang trong ca làm việc, bạn có thể thiết lập cấu hình vào cuối ca hoặc ca ngày hôm sau.</p>',
            buttons: [
                {
                    text: 'Hủy',
                    onTap: function (e) {
                        if ($scope.modalSyncSetting) $scope.modalSyncSetting.hide();
                        $scope.hourService = angular.copy($scope.hourServiceTemp);
                        $scope.$apply();
                    }
                },
                {
                    text: '<b>Xác nhận</b>',
                    type: 'button-positive',
                    onTap: function (e) {
                        var url = Api.postKeyValue;
                        var method = 'POST';
                        var d = {
                            "key": "hourServiceSetting",
                            "value": JSON.stringify($scope.hourService)
                        }
                        $unoRequest.makeRestful(url, method, d)
                            .then(function (data) {
                                endSessionWithoutConfirm('Lưu thiết lập dịch vụ tính giờ.', function () {
                                    toaster.pop('success', "", 'Đã lưu thiết lập dịch vụ tính giờ!');
                                });
                            })
                            .catch(function (e) {
                                toaster.pop('error', "", 'Lưu thiết lập dịch vụ tính giờ chưa thành công!');
                                SUNOCONFIG.LOG(e);
                            });
                    }
                }
            ]
        })
    }

    $scope.showSyncSetting = function () {
        $scope.popoverSettings.hide();
        $ionicModal.fromTemplateUrl('sync-setting.html', {
            scope: $scope,
            animation: 'slide-in-up',
            // backdropClickToClose: false
        }).then(function (modal) {
            $scope.modalSyncSetting = modal;
            $scope.modalSyncSetting.show();
        });
    }

    $scope.closeServiceSetting = function () {
        //rollback các settings nếu ko apply.
        $scope.hourService = angular.copy($scope.hourServiceTemp);
        $scope.modalSyncSetting.hide();
    }

    $scope.showSetting = function () {
        $scope.popoverSettings.hide();
        $scope.choice = $scope.removeSetting;
        $ionicModal.fromTemplateUrl('print-setting.html', {
            scope: $scope,
            animation: 'slide-in-up',
            // backdropClickToClose: false
        }).then(function (modal) {
            $scope.modalPrintSetting = modal;
            if (!$scope.isManager) {
                // nếu là nhân viên và đang dùng mobile
                if (!$scope.isWebView) {
                    $scope.tabPrintSetting = 0;
                }
                // nếu là nhân viên và đang dùng web
                else {
                    $scope.tabPrintSetting = 6;
                }
            } else {
                $scope.tabPrintSetting = 1;
            }

            $scope.modalPrintSetting.show();
        });
    }

    $scope.modalProfile
    $scope.viewProfile = function () {
        $ionicModal.fromTemplateUrl('profile.html', {
            scope: $scope,
            animation: 'slide-in-up',
        }).then(function (modal) {
            if ($scope.popoverSettings) $scope.popoverSettings.hide();
            $scope.modalProfile = modal;
            $scope.modalProfile.show();
        });
    }

    $scope.closeModalProfile = function () {
        $scope.modalProfile.hide();
    }

    $scope.closeSetting = function () {
        //rollback các settings nếu ko apply.
        $scope.removeSetting = angular.copy($scope.removeSettingTemp);
        $scope.printDevice = angular.copy($scope.printDeviceTemp);
        $scope.printHelper = angular.copy($scope.printHelperTemp);
        $scope.BarItemSetting = angular.copy($scope.BarItemSettingTemp);
        $scope.printSetting = angular.copy($scope.printSettingTemp);
        $scope.modalPrintSetting.hide();
    }

    $scope.saveBarItem = function () {
        var url = Api.postKeyValue;
        var method = 'POST';
        var data = {
            "key": "BarItemSetting",
            "value": JSON.stringify($scope.BarItemSetting)
        };
        $unoRequest.makeRestful(url, method, data)
            .then(function (data) {
                $scope.BarItemSettingTemp = angular.copy($scope.BarItemSetting);
                toaster.pop('success', "", 'Đã lưu thiết lập in bar!');
                $scope.closeSetting();
            })
            .catch(function (e) {
                SUNOCONFIG.LOG(e);
            });
    }

    $scope.closeRemoveItemSettingModal = function () {
        $scope.modalRemoveItemSetting.hide();
    }

    $scope.saveRemoveItemSetting = function (removeSetting) {
        var url = Api.postKeyValue;
        var method = 'POST';
        var d = {
            "key": "removeItemSetting",
            "value": JSON.stringify(removeSetting)
        };
        $unoRequest.makeRestful(url, method, d)
            .then(function (data) {
                toaster.pop('success', "", 'Đã lưu thiết lập điều kiện huỷ món thành công!');
                $scope.removeSetting = removeSetting;
                $scope.removeSettingTemp = angular.copy(removeSetting);
            })
            .catch(function (e) {
                SUNOCONFIG.LOG(e);
            });

        $scope.closeSetting();
    }

    $scope.openPopOverStaffList = function (e) {
        $ionicPopover.fromTemplateUrl('staff-list.html', {
            scope: $scope
        }).then(function (popover) {
            $scope.popoverStaffList = popover;
            $scope.popoverStaffList.show(e);
        });
    }

    $scope.checkUserInStore = function (sale) {
        if (sale.userId == 0) return true;
        var storeIndex = findIndex(sale.userInStores, 'value', $scope.currentStore.storeID);
        if (storeIndex != null) {
            return true;
        }
        return false;
    }

    $scope.closeRemoveItemSetting = function () {
        $scope.modalRemoveItemSetting.hide();
    }

    $scope.updateSyncSetting = function (isSync) {
        $ionicPopup.show({
            title: 'Thông báo',
            template: '<p style="text-align: center;">Để hoàn tất việc cấu hình sử dụng dịch vụ theo giờ, bạn phải thực hiện <b>RESET</b> dữ liệu, bấm xác nhận để thực hiện.</p><p style="text-align: center;">Nếu đang trong ca làm việc, bạn có thể thiết lập cấu hình vào cuối ca hoặc ca ngày hôm sau.</p>',
            buttons: [
                {
                    text: 'Hủy',
                    onTap: function (e) {
                        if ($scope.modalPrintSetting) $scope.modalPrintSetting.hide();
                    }
                },
                {
                    text: '<b>Xác nhận</b>',
                    type: 'button-positive',
                    onTap: function (e) {
                        var url = Api.postKeyValue;
                        var method = 'POST';
                        var d = {
                            "key": "isSync",
                            "value": JSON.stringify(isSync)
                        }

                        $unoRequest.makeRestful(url, method, d)
                            .then(function (data) {
                                endSessionWithoutConfirm('Lưu thiết lập đồng bộ.', function () {
                                    toaster.pop('success', '', 'Lưu thiết lập đồng bộ thành công');
                                });
                            })
                            .catch(function (e) {
                                toaster.pop('error', '', 'Lưu thiết lập đồng bộ chưa thành công');
                                SUNOCONFIG.LOG(e);
                            });
                    }
                }
            ]
        });
    }

    $scope.search_product = function (key) {
        var url = Api.search + key + '&storeId=' + $scope.currentStore.storeID;
        var method = 'GET';
        var d = null;
        $unoRequest.makeRestful(url, method, d)
            .then(function (data) {
                $scope.searchProductList = data.items;
            })
            .catch(function (e) {
                SUNOCONFIG.LOG(e);
            });
    }

    $scope.change_search = function (key) {
        if (!key) $scope.searchProductList = null;
    }

    $scope.addServiceProduct = function (i) {

        if (!$scope.hourService.itemArr) $scope.hourService.itemArr = [];
        var indexItem = findIndex($scope.hourService.itemArr, 'itemId', i.itemId);
        if (indexItem != null) {
            return toaster.pop('warning', "", 'Đã có hàng hóa này trong danh sách hàng hóa tính tiền theo giờ!');
        } else {
            $scope.hourService.itemArr.push(i);
            $scope.searchProductList = null;

        }

    }

    $scope.addBarItem = function (i) {
        if (!$scope.BarItemSetting) {
            $scope.BarItemSetting = [];
            $scope.BarItemSettingTemp = [];
        }
        var indexItem = findIndex($scope.BarItemSetting, 'itemId', i.itemId);
        if (indexItem != null) {
            return toaster.pop('warning', "", 'Đã có hàng hóa này trong danh sách in bar!');
        } else {
            $scope.BarItemSetting.push(i);
            $scope.searchProductList = null;
        }
    }

    $scope.clearBarItem = function () {
        if (!$scope.BarItemSetting) {
            $scope.BarItemSetting = [];
            $scope.BarItemSettingTemp = [];
        }
        else {
            $scope.BarItemSetting = [];
        }
    }

    $scope.removeBarItem = function (index) {
        $scope.BarItemSetting.splice(index, 1);
    }

    $scope.removeServiceProduct = function (index) {
        $scope.hourService.itemArr.splice(index, 1);
    }

    $scope.openCategories = function () {
        $scope.showCategoriesItem = true;
    }

    $scope.closeCategories = function () {
        $scope.showCategoriesItem = false;
    }

    $scope.selectCategory = function (i) {
        var url = Api.productitems + 'categoryId=' + i.categoryId + '&limit=' + 1000 + '&pageIndex=' + 1 + '&storeId=' + $scope.currentStore.storeID;
        var method = 'GET';
        var d = null;
        $unoRequest.makeRestful(url, method, d)
            .then(function (data) {
                if (!$scope.BarItemSetting) {
                    $scope.BarItemSetting = [];
                    $scope.BarItemSettingTemp = [];
                }
                for (var j = 0; j < data.items.length; j++) {
                    var indexItem = findIndex($scope.BarItemSetting, 'itemId', data.items[j].itemId);
                    if (indexItem == null) {
                        $scope.BarItemSetting.push(data.items[j]);
                    }
                }
                $scope.showCategoriesItem = false;
                $scope.$apply();
            })
            .catch(function (e) {
                SUNOCONFIG.LOG(e);
            });
    }

    //#endregion Unclassify
    $q.when(Auth.getSunoGlobal())
        .then(function (data) {
            //Nếu check dưới DB Local chưa có SunoGlobal mà đã vào route pos thì đẩy ra màn hình đăng nhập.
            if (data.docs.length > 0) {
                //Gán lại accessToken cho SunoGlobal trường hợp vào luôn route pos thì SunoGlobal ko có accessToken để lấy BootLoader và AuthBootloader.
                //Nếu mà vào từ route Login thì SunoGlobal đã được gán lại ở route Login.
                if (SunoGlobal.token.accessToken == '' && SunoGlobal.token.refreshToken == '') {
                    for (var prop in data.docs[0].SunoGlobal) {
                        SunoGlobal[prop] = data.docs[0].SunoGlobal[prop];
                    }
                }
                SunoGlobal.sunoCallback.preRequest = function (options) { if ($scope.apiLoaded) interceptUrl(options.url); };
                SunoGlobal.sunoCallback.completeRequest = function (options) { if ($scope.apiLoaded) $rootScope.$broadcast('loading:hide'); };
                SunoGlobal.sunoCallback.redirectLogin = function (options) {
                    var pop = $ionicPopup.alert({
                        title: 'Thông báo',
                        content: '<p style="text-align:center;">Phiên làm việc đã hết hạn</p><p style="text-align:center;">Vui lòng đăng nhập lại.</p>'
                    });
                    pop.then(function (d) {
                        $scope.logout();
                    });
                };
                SunoGlobal.sunoCallback.refreshToken = function () {
                    //Lưu xuống DB Local tokens mới
                    var SunoGlobalWithoutFn = JSON.parse(JSON.stringify(SunoGlobal));
                    Auth.setSunoGlobal(SunoGlobalWithoutFn);
                };

                $scope.isLoggedIn = true;
                return Promise.all([getBootLoader(), getAuthBootLoader(), DBSettings.$getDocByID({ _id: 'currentStore' })]);
            }
            else {
                throw new SunoError("unauthorize", 'Chưa đăng nhập');
            }
        })
        .then(function (data) {
            //Chỗ này để validate response khi get BootLoader và AuthBootLoader.
            //Nếu có lỗi xảy ra thì thông báo lên cho người dùng biết để refresh lại.
            if (data[0] && data[1]) {
                //Validate thời hạn sử dụng
                if (!validateUsagePackage(data[1])) {
                    //throw { errorCode: 2, errorMsg: "Hết hạn sử dụng" };
                    throw new SunoError("expired", 'Hết hạn sử dụng');
                }
                //Gán lại giá trị từ API response cho SunoGlobal
                $scope.apiLoaded = true;
                SunoGlobal.stores = data[0].allStores;
                SunoGlobal.featureActivations = data[0].featureActivations;
                SunoGlobal.companyInfo.companyCode = data[1].companyCode;
                SunoGlobal.companyInfo.companyPhone = data[1].companyPhone;
                SunoGlobal.companyInfo.companyAddress = data[1].companyAddress;
                SunoGlobal.companyInfo.companyTaxCode = data[1].companyTaxCode;
                SunoGlobal.companyInfo.industry = data[1].industry;
                SunoGlobal.storeIdsGranted = data[1].storeIdsGranted;
                SunoGlobal.usageInfo = data[1].usageInfo;
                SunoGlobal.rolesGranted = data[1].rolesGranted;
                SunoGlobal.users = data[1].users.userProfiles;

                SunoGlobal.saleSetting.cogsCalculationMethod = data[0].saleSetting.cogsCalculationMethod;
                SunoGlobal.saleSetting.isAllowDebtPayment = data[0].saleSetting.allowDebtPayment;
                SunoGlobal.saleSetting.isAllowPriceModified = data[0].saleSetting.allowPriceModified;
                SunoGlobal.saleSetting.isAllowQuantityAsDecimal = data[0].saleSetting.allowQuantityAsDecimal;
                SunoGlobal.saleSetting.isApplyCustomerPricingPolicy = data[0].saleSetting.applyCustomerPricingPolicy;
                SunoGlobal.saleSetting.isApplyEarningPoint = data[0].saleSetting.applyEarningPoint;
                SunoGlobal.saleSetting.isApplyPromotion = data[0].saleSetting.applyPromotion;
                SunoGlobal.saleSetting.isPrintMaterials = data[0].saleSetting.isPrintMaterials;
                SunoGlobal.saleSetting.isProductReturnDay = data[0].saleSetting.allowProductReturnDay;
                SunoGlobal.saleSetting.productReturnDay = data[0].saleSetting.productReturnDay;
                SunoGlobal.saleSetting.saleReportSetting = data[0].saleSetting.saleReportSetting;
                SunoGlobal.saleSetting.allowOfflineCache = data[0].saleSetting.allowOfflineCache;
                SunoGlobal.saleSetting.allowTaxModified = data[0].saleSetting.allowTaxModified;
                SunoGlobal.saleSetting.applyCustomerCare = data[0].saleSetting.applyCustomerCare;
                SunoGlobal.saleSetting.bankTransferPaymentMethod = data[0].saleSetting.bankTransferPaymentMethod;
                SunoGlobal.saleSetting.cardPaymentMethod = data[0].saleSetting.cardPaymentMethod;
                SunoGlobal.saleSetting.cashPaymentMethod = data[0].saleSetting.cashPaymentMethod;
                SunoGlobal.saleSetting.currencyNote = data[0].saleSetting.currencyNote;
                SunoGlobal.saleSetting.customerEmailConfiguration = data[0].saleSetting.customerEmailConfiguration;
                SunoGlobal.saleSetting.isHasSampleData = data[0].saleSetting.isHasSampleData;
                SunoGlobal.saleSetting.longtimeInventories = data[0].saleSetting.longtimeInventories;
                SunoGlobal.saleSetting.receiptVoucherMethod = data[0].saleSetting.receiptVoucherMethod;
                SunoGlobal.saleSetting.showInventoryTotal = data[0].saleSetting.showInventoryTotal;
                SunoGlobal.saleSetting.storeChangeAutoApproval = data[0].saleSetting.storeChangeAutoApproval;
                SunoGlobal.saleSetting.weeklyReportEmail = data[0].saleSetting.weeklyReportEmail;

                //Gán lại giá trị cho các biến.
                $scope.storesList = data[0].allStores.filter(function (s) {
                    return SunoGlobal.storeIdsGranted.findIndex(function (id) { return id == s.storeID; }) > -1;
                });
                if ($scope.storesList.length == 0) {
                    throw new SunoError("nonpermission", 'Chưa được phân quyền trên cửa hàng nào');
                }

                //Gán lại 1 số biến để tương thích với code cũ của Cafe v1.
                $scope.userSession = {
                    companyId: SunoGlobal.companyInfo.companyId,
                    companyName: SunoGlobal.companyInfo.companyName,
                    email: SunoGlobal.userProfile.email,
                    userId: SunoGlobal.userProfile.userId,
                    displayName: SunoGlobal.userProfile.fullName,
                    permissions: SunoGlobal.permissions,
                    isAdmin: SunoGlobal.userProfile.isAdmin || SunoGlobal.rolesGranted.findIndex(function (r) { return r.roleName == 'Chủ cửa hàng'; }) > -1,
                    sesssionId: SunoGlobal.userProfile.sessionId,
                    authSessionId: SunoGlobal.userProfile.authSessionId
                };
                $scope.settings = {
                    saleSetting: data[0].saleSetting
                };
                $scope.saleList = $scope.saleList.concat(SunoGlobal.users);

                $scope.authBootloader = {
                    rolesGranted: data[1].rolesGranted,
                    users: data[1].users
                };
                if (data[2].docs.length > 0) {
                    //Nếu Store dưới DB Local vẫn còn ds stores của cửa hàng thì gán lại cho currentStore, nếu ko còn thì gán lại store đầu tiên
                    var storeIndex = $scope.storesList.findIndex(function (s) { return s.storeID == data[2].docs[0].currentStore.storeID });
                    if (storeIndex != -1) {
                        $scope.currentStore = $scope.storesList[storeIndex]; //data[2].docs[0].currentStore;
                    }
                    else {
                        //Gán lại phần tử cuối cùng do mảng storesList bị ngược.
                        $scope.currentStore = $scope.storesList[$scope.storesList.length - 1];
                        DBSettings.$addDoc({ _id: 'currentStore', currentStore: angular.copy($scope.currentStore), _rev: data[2].docs[0]._rev });
                    }
                }
                else {
                    $scope.currentStore = $scope.storesList[$scope.storesList.length - 1];
                    DBSettings.$addDoc({ _id: 'currentStore', currentStore: angular.copy($scope.currentStore) });
                }
                $scope.isMultiplePrice = SunoGlobal.saleSetting.isApplyCustomerPricingPolicy;

                $scope.showCategories = true;
                $scope.isManager = SunoGlobal.permissions.indexOf("POSIM_Setting_ViewCompanyInfo") > -1;
            } else {
                throw new SunoError("bootloaderfailed", 'Get Bootloader và AuthBootLoader không thành công.');
            }

            //Suno Prototype
            $unoSaleOrderCafe = new SunoSaleOrderCafe($scope.currentStore.storeID);
            $unoSaleOrderCafe.earningPointConfig.isApplyEarningPoint = SunoGlobal.saleSetting.isApplyEarningPoint;
            $unoSaleOrderCafe.initOrder();

            // Load dữ liệu về categories, product items, print template, thông tin công ty, các cấu hình đồng bộ, hàng hóa theo giờ,...
            return Promise.all([getAllCategories(), $scope.getProductItems(''), getPrintTemplate(), getCompanyInfo(), getSettings()])
        })
        .then(function (loadedData) {

            //var isAllowPostKeyValue = SunoGlobal.permissions.indexOf("POSIM_Manage") > -1;
            //if (!isAllowPostKeyValue && !isValidOrderAndTableStructure) {
            //    throw new SunoError("notallowpostkeyvalue", 'Không có quyền thực hiện post Key-Value');
            //}

            //Tạo DB Local cho Table.
            //Đặt tên cho DB bằng companyId và storeId để có unique name.
            var DBTableName = SunoGlobal.companyInfo.companyId + "_" + $scope.currentStore.storeID;
            return Promise.all([SunoPouchDB.getPouchDBInstance('table', DBTableName), DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })]);
        })
        .then(function (data) {
            //Gán lại DB Tables khi khởi tạo xong.
            DBTables = data[0];
            $scope.tables = [];
            $scope.tableMap = [];

            //Thêm mảng tạm để phục hồi khi cần.
            $scope.tableMapTemp = [];
            $scope.tablesTemp = [];

            //Gán lại shiftID dưới Local.
            if (data[1].docs.length > 0) {
                shiftID = data[1].docs[0].shiftId;
            }

            return Promise.all([
                DBTables.$queryDoc({
                    selector: {
                        'store': { $eq: $scope.currentStore.storeID },
                        'tableId': { $gte: null }
                    },
                    sort: [{ tableId: 'asc' }]
                    //fields: ['_id', 'table']
                }),
                DBSettings.$getDocByID({ _id: 'zones_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
            ]);
        })
        .then(function (data) {
            //Kiểm tra trong DB Local đã có có sơ đồ phòng bàn chưa.
            //- Nếu có thì đọc lên vì trong sơ đồ phòng bàn ở DB Local có thông tin bàn đang dùng và trống.
            //- Nếu chưa có => POS Cafe mới chạy lần đầu cần thực hiện lưu thông tin sơ đồ phòng bàn vào DB Local hoặc mở Modal khởi tạo phòng bàn.
            if (data[0].docs.length > 0 && data[1].docs[0]) {//&& data[1].docs[0].zones.length > 0
                //Nếu table ko khớp nhau thì báo lỗi và xóa
                var local = angular.copy(data[0].docs);
                var storeIndex = findIndex($scope.tablesSetting, 'storeId', $scope.currentStore.storeID);
                var api = storeIndex != null ? $scope.tablesSetting[storeIndex].tables : [];
                //Nếu là lần chạy đầu thì sẽ ko match được vì khác DB, chỉ có sai cấu trúc
                //Nếu lần chạy sau thì ko sai cấu trúc nữa mà sẽ ko match nếu sơ đồ bàn cũ thật.
                if (checkingMatchTable(local, api)) { // || !isValidOrderAndTableStructure
                    var tablesInDBLocal = data[0].docs;
                    var zonesInDBLocal = data[1].docs[0].zones;
                    clearBlankOrder(tablesInDBLocal);
                    $scope.tables = tablesInDBLocal;
                    $scope.tableMap = zonesInDBLocal;
                    $scope.tablesTemp = angular.copy(tablesInDBLocal);
                    $scope.tableMapTemp = angular.copy(zonesInDBLocal);
                    //if (!$scope.tablesSetting) $scope.tablesSetting = [];

                    //Gán lại giá trị từ Orders cho SunoSaleOrderCafe (Nạp lại $unoSaleOrderCafe.saleOrders)
                    //Lúc tắt app mở lại
                    $unoSaleOrderCafe.saleOrders = [];
                    $unoSaleOrderCafe.promotions = [];
                    $scope.tables.forEach(function (t) {
                        t.tableOrder.forEach(function (order) {
                            $unoSaleOrderCafe.calculateOrder(order.saleOrder, function () { resetAmountPaidForOrder(order.saleOrder); });
                            resetAmountPaidForOrder(order.saleOrder);
                        });
                    });
                }
                else {
                    throw new SunoError("unmatch", 'Sơ đồ bàn Local và API ko khớp');
                }

            } else {
                //Nếu chưa có thiết lập phòng bàn từ API trả về thì khởi tạo.
                if ($scope.tablesSetting && isValidOrderAndTableStructure) {
                    var storeIndex = findIndex($scope.tablesSetting, 'storeId', $scope.currentStore.storeID);
                    //Nếu store được chọn chưa có thiết lập phòng bàn.
                    if (storeIndex != null) {
                        $scope.tables = $scope.tablesSetting[storeIndex].tables;
                        $scope.tableMap = $scope.tablesSetting[storeIndex].zone;
                        $scope.tablesTemp = angular.copy($scope.tablesSetting[storeIndex].tables);
                        $scope.tableMapTemp = angular.copy($scope.tablesSetting[storeIndex].zone);
                        //Lưu xuống DB Local
                        var array = prepareTables();
                        Promise.all([
                            DBTables.$manipulateBatchDoc(array),
                            //Trường hợp này sửa lỗi lúc kết ca thì chưa xóa zones ở các máy đc server broadcast về.
                            DBSettings.$getDocByID({ _id: 'zones_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                        ])
                            .then(function (data) {
                                //SUNOCONFIG.LOG(data[0]);
                                var zones = { _id: 'zones_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID, zones: angular.copy($scope.tableMap) };
                                if (data[1].docs.length > 0) {
                                    zones._rev = data[1].docs[0]._rev;
                                }
                                return DBSettings.$addDoc(zones);
                                //return Promise.all([
                                //    DBTables.$getAllDocs(),
                                //    DBSettings.$addDoc(zones)
                                //]);
                                //SUNOCONFIG.LOG('Lưu DB', data);
                            })
                            .then(function (data) {
                                //log for debug.
                                //SUNOCONFIG.LOG(data);
                            })
                            .catch(function (error) {
                                SUNOCONFIG.LOG(error);
                            })
                    } else {
                        $scope.checkInitTable();
                    }
                } else if (!$scope.tablesSetting && isValidOrderAndTableStructure) {
                    $scope.checkInitTable();
                } else if (!isValidOrderAndTableStructure) {
                    //Do nothing.
                }
            }

            //Kiểm tra số lượng bàn để xác định CSS class.
            if ($scope.tables.length < 11) {
                $scope.appendedCSSClass = 'responsive-0x';
            }
            else if ($scope.tables.length < 21) {
                $scope.appendedCSSClass = 'responsive-1x';
            }
            else if ($scope.tables.length < 31) {
                $scope.appendedCSSClass = 'responsive-2x';
            }
            else if ($scope.tables.length < 41) {
                $scope.appendedCSSClass = 'responsive-3x';
            }
            else if ($scope.tables.length < 51) {
                $scope.appendedCSSClass = 'responsive-4x';
            }
            else if ($scope.tables.length < 61) {
                $scope.appendedCSSClass = 'responsive-5x';
            }
            else if ($scope.tables.length >= 61) {
                $scope.appendedCSSClass = '';
            }

            //Mặc định chọn bàn Mang về là bàn được chọn đầu tiên.
            $scope.tableIsSelected = $scope.tables[0];
            $scope.orderIndexIsSelected = 0;

            //Nếu chỉ dùng bàn mang về thì vào Menu luôn.
            if ($scope.tables.length == 1) {
                $scope.switchLayout();
            }

            //$scope.getSyncSetting().then(function () {
            buildHotKeyIndex();
            //Khởi tạo app thành công.
            $scope.isInitialized = true;


            if (!$scope.isSync) {
                if (!isValidOrderAndTableStructure) {
                    var url = Api.postKeyValue;
                    var method = 'POST';
                    convertTableV1ToV2();
                    var data = {
                        "key": "tableSetting",
                        "value": JSON.stringify($scope.tablesSetting)
                    };
                    $unoRequest.makeRestful(url, method, data)
                        .then(function () {
                            window.location.reload(true);
                        });
                }
            }
            //Thiết lập kết nối Socket nếu có bật đồng bộ.
            else {
                manager = new io.Manager(socketUrl, {
                    reconnection: true,
                    timeout: 20000,
                    reconnectionattempts: Infinity, //'infinity'
                    reconnectiondelay: 1000,
                    autoconnect: false,
                    query: {
                        room: SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID,
                        transport: ['websocket']
                    }
                });
                socket = manager.socket('/');
                socket.connect();

                socket.on('initShift', function (msg) {
                        SUNOCONFIG.LOG('initShift', angular.copy(msg));
                        if (msg.storeId == $scope.currentStore.storeID && !isSyncBlocked) {
                            receivedAnyInitDataFromServer = true;
                            //Kiểm tra xem DBLocal đã lưu shiftId hay chưa?
                            DBSettings.$getDocByID({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                                .then(function (data) {
                                    var shiftLocal = null;
                                    if (data.docs.length > 0) {
                                        shiftLocal = data.docs[0].shiftId;
                                    }
                                    //Nếu shiftId của Client hiện tại ko trùng với shiftId Server gửi về thì cập nhật lại,
                                    if (shiftLocal != msg.shiftId) {
                                        shiftID = msg.shiftId;
                                        //Cập nhật lại.
                                        if (data.docs.length > 0) {
                                            data.docs[0].shiftId = msg.shiftId;

                                            return DBSettings.$addDoc(data.docs[0]);
                                        }
                                        //Thêm mới.
                                        else {
                                            return DBSettings.$addDoc({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID, shiftId: msg.shiftId });
                                        }
                                    }
                                    //Nếu khớp thì thôi ko làm gì thêm.
                                    else {
                                        return null;
                                    }
                                    //Đoạn này phải chạy tuần tự vì có trường hợp lỗi giữa add shiftId và remove shiftId gây reload nhiều lần.
                                })
                                .then(function (data) {
                                    var tempTables = angular.copy($scope.tables);
                                    //$scope.unNoticeTable = filterHasNoticeOrder($scope.tables);

                                    //Cập nhật lại sơ đồ bàn mới từ Server.
                                    $scope.currentOrderID = $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected] ? $scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid : null;
                                    var localTables = angular.copy($scope.tables);
                                    $scope.tables = msg.tables;

                                    //Cập nhật lại order chưa báo bếp, các món chưa báo bếp cho các order.
                                    if (msg.tables && $scope.tables.length > 0)
                                        //socketAction.process($scope.tables, $scope.unNoticeTable);
                                        replaceOrder($scope.tables, localTables, $scope.isUngroupItem);

                                    if ($scope.tables) {
                                        if ($scope.printSetting.acceptSysMessage) {
                                            try {
                                                //Thiết lập và hiển thị thông báo từ Hệ thống cho Client.
                                                var alteredOrder = [];
                                                var lostOrder = [];
                                                //Lặp để thiết lập nội dung thông báo
                                                if (msg.msg) {
                                                    //Thông báo order đã thay đổi phải lặp trên ds phòng bàn mới để lấy sharedWith.
                                                    if (msg.msg.alteredOrder.length > 0) {
                                                        $scope.tables.forEach(function (t) {
                                                            t.tableOrder.forEach(function (order) {
                                                                var orderLog = msg.msg.alteredOrder.find(function (log) { return log.orderID == order.saleOrder.saleOrderUuid });
                                                                if (orderLog) {
                                                                    switch (orderLog.type) {
                                                                        //Client liên quan là client cùng tài khoản với client thực hiện action
                                                                        //hoặc client đã tham gia vào hoạt động chỉnh sửa, thay đổi trên đơn hàng đó (Trường hợp này chỉ xảy ra đối với các tài khoản có quyền quản lý và chủ cửa hàng)
                                                                        case 1: {//Gửi cho tất cả client liên quan
                                                                            if (order.saleOrder.sharedWith.findIndex(function (p) { return p.userID == SunoGlobal.userProfile.userId; }) >= 0) {
                                                                                alteredOrder.push(orderLog.tableName);
                                                                            }
                                                                            break;
                                                                        }
                                                                        case 2: {//Chỉ gửi cho client đã thực hiện action
                                                                            if (order.saleOrder.sharedWith.findIndex(function (p) { return p.userID == SunoGlobal.userProfile.userId; }) >= 0 && msg.msg.deviceID == deviceID) {
                                                                                alteredOrder.push(orderLog.tableName);
                                                                            }
                                                                            break;
                                                                        }
                                                                        case 3: {//Chỉ gửi các client liên quan khác ngoại trừ client thực hiện action.
                                                                            if (order.saleOrder.sharedWith.findIndex(function (p) { return p.userID == SunoGlobal.userProfile.userId; }) >= 0 && msg.msg.deviceID != deviceID) {
                                                                                alteredOrder.push(orderLog.tableName);
                                                                            }
                                                                            break;
                                                                        }
                                                                        default:
                                                                            break;
                                                                    }
                                                                }
                                                            });
                                                        });
                                                    }

                                                    //Thông báo order đã lạc lặp trên ds phòng bàn cũ.
                                                    if (msg.msg.lostOrder.length > 0) {
                                                        tempTables.forEach(function (t) {
                                                            t.tableOrder.forEach(function (order) {
                                                                var orderLog = msg.msg.lostOrder.find(function (log) { return log.orderID == order.saleOrder.saleOrderUuid });
                                                                //Thông báo về cho chỉ client đã thực hiện Init.
                                                                if (orderLog && msg.msg.deviceID == deviceID && order.saleOrder.sharedWith.findIndex(function (p) { return p.userID == SunoGlobal.userProfile.userId; }) >= 0) {
                                                                    lostOrder.push({ fromTable: orderLog.tableName, toTable: orderLog.orderPlaceNow ? orderLog.orderPlaceNow.tableName : null, action: orderLog.action });
                                                                }
                                                            });
                                                        });
                                                    }
                                                }

                                                var msgForAlteredOrder = '';
                                                var msgForLostOrder = '';
                                                if (alteredOrder.length > 0 || lostOrder.length > 0) {
                                                    if (alteredOrder.length > 0) {
                                                        msgForAlteredOrder = '<p style="text-align: center;">Đơn hàng của bạn tại các bàn <b>';
                                                        msgForAlteredOrder += alteredOrder.join('</b>, <b>');
                                                        msgForAlteredOrder += '</b> đã được thay đổi ở 1 thiết bị khác.</p>';
                                                    }
                                                    if (lostOrder.length > 0) {
                                                        msgForLostOrder = '<p style="text-align: center;">Đơn hàng của bạn tại ';
                                                        var orderNotiArr = [];
                                                        lostOrder.forEach(function (order) {
                                                            var txt = 'bàn <b>' + order.fromTable + '</b> đã ' + (order.action == 'G' ? 'được ghép vào' : order.action == 'CB' ? 'được chuyển sang' : 'được thao tác sang') + (order.toTable != null ? ' bàn <b>' + order.toTable + '</b>' : ' một bàn khác.');
                                                            orderNotiArr.push(txt);
                                                        });
                                                        msgForLostOrder += orderNotiArr.join(',');
                                                        msgForLostOrder += '.</p>';
                                                        //msgForLostOrder += '</b> đã được đổi bàn hoặc ghép hóa đơn ở 1 thiết bị khác.</p>';
                                                        msgForLostOrder += '<p style="text-align: center;">Hệ thống sẽ tạo đơn hàng <b style="color: red;">LƯU TẠM</b> để đối soát. Bạn có thể dùng như đơn hàng bình thường hoặc xóa nếu không cần thiết.</p>';
                                                    }
                                                    var msgContent = msgForAlteredOrder + msgForLostOrder + '<p style="text-align: center;">Vui lòng kiểm tra và cập nhật lại số lượng, nếu có sai lệch.<p/>';
                                                    if (notiPopupInstance) {
                                                        showNotification.close();
                                                    }
                                                    $timeout(function () {
                                                        showNotification('Thông báo', msgContent);
                                                    }, 100);
                                                }
                                            }
                                            catch (exception) {
                                                throw new SunoError('sysmsgerror', 'Thiết lập thông báo hệ thống không thành công');
                                            }
                                        }

                                        //Cập nhật lại tableStatus
                                        for (var i = 0; i < $scope.tables.length; i++) {
                                            var isActive = tableIsActive($scope.tables[i]);
                                            $scope.tables[i].tableStatus = isActive ? 1 : 0;
                                        }

                                        //Nạp lại sơ đồ bàn cho Prototype.
                                        $unoSaleOrderCafe.saleOrders = [];
                                        $unoSaleOrderCafe.promotions = [];
                                        $scope.tables.forEach(function (t) {
                                            t.tableOrder.forEach(function (order) {
                                                $unoSaleOrderCafe.calculateOrder(order.saleOrder, function () { resetAmountPaidForOrder(order.saleOrder); $scope.$apply(); });
                                                resetAmountPaidForOrder(order.saleOrder);
                                            });
                                        });

                                        //Set trạng thái socket.
                                        isSocketReady = true;
                                        var index = $scope.errorArr.findIndex(function (item) { return item.content == 'Ứng dụng đang kết nối đến hệ thống. Vui lòng chờ trong giây lát.'; });
                                        if (index > -1) {
                                            $scope.errorArr.splice(index, 1);
                                        }
                                        $scope.setError();
                                        $scope.syncStatus = 'success';

                                        //Set lại tableIsSelected và orderIndexIsSelected
                                        if ($scope.tableIsSelected) {
                                            var tableIndex = $scope.tables.findIndex(function (t) { return t.tableUuid == $scope.tableIsSelected.tableUuid; });

                                            //Tìm thấy bàn đang được chọn thì gán lại còn ko tìm thấy thì gán lại bàn đầu tiên và order đầu tiên.
                                            if (tableIndex > -1) {
                                                $scope.tableIsSelected = $scope.tables[tableIndex];
                                                //Nếu mà đang chọn món, nghĩa là đã chọn 1 bàn nào đó rồi.
                                                if (!$scope.isInTable) {
                                                    if ($scope.tableIsSelected.tableOrder.length > 0) {
                                                        var orderIndex = $scope.tableIsSelected.tableOrder.findIndex(function (o) { return o.saleOrder.saleOrderUuid == $scope.currentOrderID });
                                                        //Nếu tìm thấy order đang thao tác thì gán lại index mới còn ko tìm thấy gán lại order đầu tiên.
                                                        if (orderIndex > -1) {
                                                            $scope.orderIndexIsSelected = orderIndex;
                                                            $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                                        }
                                                        else {
                                                            $scope.orderIndexIsSelected = 0;
                                                        }
                                                    }
                                                    else {
                                                        createFirstOrder();
                                                    }
                                                }
                                                else {
                                                    $scope.orderIndexIsSelected = 0;
                                                }
                                            } else {
                                                $scope.tableIsSelected = $scope.tables[0];
                                                $scope.orderIndexIsSelected = 0;
                                            }
                                        }

                                        $scope.$apply();

                                        DBTables.$queryDoc({
                                            selector: {
                                                'store': { $eq: $scope.currentStore.storeID }
                                            }
                                        })
                                            .then(function (data) {
                                                if (data.docs.length > 0) {
                                                    try {

                                                        for (var x = 0; x < data.docs.length; x++) {
                                                            _id = data.docs[x]._id;
                                                            _rev = data.docs[x]._rev;
                                                            data.docs[x] = angular.copy($scope.tables[x]);
                                                            data.docs[x]._id = _id;
                                                            data.docs[x]._rev = _rev;
                                                            data.docs[x].store = $scope.currentStore.storeID;
                                                        }
                                                    }
                                                    catch (exception) {
                                                        //Nếu lỗi match shift nhưng số lượng bàn khác nhau
                                                        throw new SunoError('unmatchquantity', 'Không khớp số lượng bàn');
                                                    }
                                                    return DBTables.$manipulateBatchDoc(data.docs);
                                                }
                                                return null;
                                            })
                                            .then(function (data) {
                                                //log for debug
                                                //SUNOCONFIG.LOG(data);
                                            })
                                            .catch(function (error) {
                                                SUNOCONFIG.LOG(error);
                                                clearShiftTableZoneInLocal(function () {
                                                    $ionicPopup.show({
                                                        title: 'Thông báo',
                                                        template: '<p style="text-align: center;">Đã có lỗi xảy ra, vui lòng chọn <b>Tải Lại</b> để cập nhật lại dữ liệu hệ thống.</p><p style="text-align: center;">Nếu tình trạng này vẫn còn xảy ra, vui lòng chọn <b>Sửa</b> hoặc liên hệ tổng đài để được hỗ trợ.</p>',
                                                        buttons: [
                                                            {
                                                                text: 'Reset',
                                                                type: 'button-assertive',
                                                                onTap: function (e) {
                                                                    if (isSocketConnected) {
                                                                        clearShift();
                                                                    }
                                                                    else {
                                                                        handleDisconnectedSocket()
                                                                    }
                                                                }
                                                            },
                                                            {
                                                                text: 'Sửa',
                                                                type: 'button-positive',
                                                                onTap: function (e) {
                                                                    clearShiftTableZoneInLocal(function () { window.location.reload(true); });
                                                                }
                                                            },
                                                            {
                                                                text: '<b>Tải lại</b>',
                                                                type: 'button-balanced',
                                                                onTap: function (e) {
                                                                    window.location.reload(true);
                                                                }
                                                            }
                                                        ]
                                                    });
                                                });
                                            });
                                    }
                                    else if (!$scope.tables) {
                                        clearShiftTableZoneInLocal(function () { window.location.reload(true); });
                                    }
                                })
                                .catch(function (error) {
                                    SUNOCONFIG.LOG(error);
                                    if (error.msg == 'Không tìm thấy bàn') {
                                        $ionicPopup.show({
                                            title: 'Thông báo',
                                            template: '<p style="text-align: center;">Đã có lỗi xảy ra, vui lòng liên hệ quản lý để thực hiện <b>Reset</b> dữ liệu.</p>',
                                            buttons: [
                                                {
                                                    text: '<b>Tải lại</b>',
                                                    type: 'button-stable',
                                                    onTap: function (e) {
                                                        window.location.reload(true);
                                                    }
                                                },
                                                {
                                                    text: 'Reset',
                                                    type: 'button-positive',
                                                    onTap: function (e) {
                                                        if (isSocketConnected) {
                                                            clearShift();
                                                        }
                                                        else {
                                                            handleDisconnectedSocket();
                                                            isSyncBlocked = true;
                                                        }
                                                    }
                                                }
                                            ]
                                        });
                                    }
                                    else if (error.msg != 'Thiết lập thông báo hệ thống không thành công' && !error.message) {
                                        $ionicPopup.show({
                                            title: 'Thông báo',
                                            template: '<p style="text-align: center;">Đã có lỗi xảy ra, vui lòng bấm <b>Tải lại</b> để cập nhật lại dữ liệu hệ thống.</p><p style="text-align: center;">Nếu tình trạng này vẫn còn xảy ra, vui lòng chọn <b>Sửa</b> hoặc liên hệ tổng đài để được hỗ trợ.</p>',
                                            buttons: [
                                                {
                                                    text: 'Reset',
                                                    type: 'button-assertive',
                                                    onTap: function (e) {
                                                        endSessionWithoutConfirm('Reset dữ liệu');
                                                    }
                                                },
                                                {
                                                    text: 'Sửa',
                                                    type: 'button-positive',
                                                    onTap: function (e) {
                                                        clearShiftTableZoneInLocal(function () { window.location.reload(true); });
                                                    }
                                                },
                                                {
                                                    text: '<b>Tải lại</b>',
                                                    type: 'button-balanced',
                                                    onTap: function (e) {
                                                        window.location.reload(true);
                                                    }
                                                }
                                            ]
                                        });
                                    }
                                    //error instanceof CustomPouchError
                                    else {
                                        $ionicPopup.show({
                                            title: 'Thông báo',
                                            template: '<p style="text-align: center;">Đã có lỗi xảy ra. Vui lòng tải lại.</p>',
                                            buttons: [
                                                {
                                                    text: '<b>Tải lại</b>',
                                                    type: 'button-positive',
                                                    onTap: function (e) {
                                                        window.location.reload(true);
                                                    }
                                                }
                                            ]
                                        });
                                    }
                                });
                        }
                });

                socket.on('connect', function () {
                    isSocketConnected = true;
                    SUNOCONFIG.LOG('Socket is connected');
                    if (!isSocketInitialized) { //Nếu không phải khởi động app thì trường hợp này là vừa bị mất kết nối socket và kết nối lại.
                        $timeout(function () {
                            //Nếu đã có kết nối socket và có bật đồng bộ.
                            if (isSocketConnected && !isSyncBlocked) {
                                socket.connect();
                                //$scope.errorArr.push({ priority: 4, content: 'Ứng dụng đang kết nối đến hệ thống. Vui lòng chờ trong giây lát.' });
                                //$scope.setError();
                                $scope.syncStatus = 'error';
                                //Gửi hết thông tin đơn hàng với logs chưa đồng bộ lên cho server.
                                var unsyncOrder = filterOrderWithUnsyncLogs($scope.tables);
                                unsyncOrder = clearNewOrderCount(unsyncOrder);
                                var initData = {
                                    "companyId": SunoGlobal.companyInfo.companyId,
                                    "storeId": $scope.currentStore.storeID,
                                    "clientId": SunoGlobal.userProfile.sessionId,
                                    "shiftId": shiftID,
                                    //"startDate": "",
                                    //"finishDate": "",
                                    "tables": angular.copy(unsyncOrder),
                                    "zone": $scope.tableMap,
                                    "info": {
                                        action: "reconnect",
                                        deviceID: deviceID,
                                        timestamp: genTimestamp(),
                                        author: SunoGlobal.userProfile.userId,
                                        isUngroupItem: $scope.isUngroupItem
                                    }
                                };

                                SUNOCONFIG.LOG('reconnectData', initData);
                                socket.emit('reconnectServer', initData);
                            }
                        }, 1000); //Delay 1000 chờ mạng ổn định lại. Tránh trường hợp mạng chập chờn.
                    }
                    else {
                        isSocketInitialized = false;
                        if ($scope.tables.length > 0) {
                            if (isValidOrderAndTableStructure) {
                                if (isSocketConnected) {
                                    //$scope.errorArr.push({ priority: 4, content: 'Ứng dụng đang kết nối đến hệ thống. Vui lòng chờ trong giây lát.' });
                                    //$scope.setError();
                                    $scope.syncStatus = 'error';
                                    var unsyncOrder = filterOrderWithUnsyncLogs($scope.tables);
                                    unsyncOrder = clearNewOrderCount(unsyncOrder);
                                    var initData = {
                                        "companyId": SunoGlobal.companyInfo.companyId,
                                        "storeId": $scope.currentStore.storeID,
                                        "clientId": SunoGlobal.userProfile.sessionId,
                                        "shiftId": shiftID,
                                        //"startDate": "",
                                        //"finishDate": "",
                                        "tables": angular.copy(unsyncOrder),
                                        "zone": $scope.tableMap,
                                        "info": {
                                            action: "init",
                                            author: SunoGlobal.userProfile.userId,
                                            deviceID: deviceID,
                                            timestamp: genTimestamp(),
                                            isUngroupItem: $scope.isUngroupItem
                                        }
                                    };
                                    SUNOCONFIG.LOG('initData', initData);
                                    socket.emit('initShift', initData);
                                }
                                else {
                                    handleDisconnectedSocket();
                                }
                            }
                            else {
                                SUNOCONFIG.LOG('Đang sử dụng dữ liệu phòng bàn của phiên bản cũ');
                            }
                        }
                    }
                });

                socket.on('disconnect', function (rs) {
                    SUNOCONFIG.LOG('Socket is disconnected', rs);
                    isSocketConnected = false;
                    isSocketReady = false;
                    $scope.syncStatus = 'warn';
                    $scope.$apply();
                });

                socket.on('reconnecting', function (num) {
                    SUNOCONFIG.LOG('Socket is reconnecting', num + ' time(s)');
                });

                socket.on('error', function (e) {
                    SUNOCONFIG.LOG('Error occured', e);
                })

                socket.on('reconnect', function (num) {
                    //SUNOCONFIG.LOG('Socket is reconnected', num);
                });

                socket.on('ping', function () {
                    //SUNOCONFIG.LOG('Socket is pinging');
                });

                socket.on('connect_timeout', function (timeout) {
                    SUNOCONFIG.LOG('Socket connection is timeout', timeout);
                });

                socket.on('connect_error', function (e) {
                    SUNOCONFIG.LOG('Socket connection is error', e);
                });

                socket.on('reconnect_error', function (e) {
                    //SUNOCONFIG.LOG('Socket reconnecting error', e);
                });

                //Cập nhật lại các món chưa báo bếp cho order.
                //dest là order sẽ được cập nhật
                //src là order dùng để so sánh và cập nhật cho order dest.
                var updateUnnoticeItemOrder = function (dest, src) {
                    //Lặp qua các items.
                    for (var x = 0; x < src.saleOrder.orderDetails.length; x++) {
                        //Nếu item đó có món chưa báo bếp
                        if (src.saleOrder.orderDetails[x].newOrderCount > 0) {
                            //Cập nhật cho hàng bình thường
                            if (!src.saleOrder.orderDetails[x].detailID) {
                                var item = dest.saleOrder.orderDetails.find(function (d) { return d.itemId == src.saleOrder.orderDetails[x].itemId; });
                                if (item) {
                                    item.quantity += src.saleOrder.orderDetails[x].newOrderCount;
                                    item.newOrderCount = src.saleOrder.orderDetails[x].newOrderCount;
                                }
                                else {
                                    var item = angular.copy(src.saleOrder.orderDetails[x]);
                                    item.quantity = src.saleOrder.orderDetails[x].newOrderCount;
                                    dest.saleOrder.orderDetails.push(item);
                                }
                            }
                            //Cập nhật cho hàng tách món
                            else {
                                var item = dest.saleOrder.orderDetails.find(function (d) { return d.itemId == src.saleOrder.orderDetails[x].itemId && d.detailID == src.saleOrder.orderDetails[x].detailID; });
                                if (item) {
                                    item.quantity += src.saleOrder.orderDetails[x].newOrderCount;
                                    item.newOrderCount = src.saleOrder.orderDetails[x].newOrderCount;
                                }
                                else {
                                    dest.saleOrder.orderDetails.push(angular.copy(src.saleOrder.orderDetails[x]));
                                }
                            }
                        }
                    }
                }

                socket.on('updateOrder', function (msg) {
                    SUNOCONFIG.LOG('updateOrder', msg);
                    if (msg.storeId == $scope.currentStore.storeID && !isSyncBlocked) {
                        if (msg.info.action != 'splitOrder' && msg.info.action != 'startTimer' && msg.info.action != 'renameOrder') {
                            //Cập nhật lại bàn vừa nhận từ Server gửi về
                            for (var x = 0; x < $scope.tables.length; x++) {
                                if ($scope.tables[x].tableUuid == msg.tables[0].tableUuid) {
                                    if ($scope.tables[x].tableOrder.length > 0) {

                                        var orderIndex = $scope.tables[x].tableOrder.findIndex(function (o) { return o.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[0].saleOrder.saleOrderUuid; });
                                        //Nếu chưa có order này trong ds orders, trường hợp báo bếp mới.
                                        if (orderIndex == -1) {
                                            //Nếu đang xem bàn đó thì push thẳng vào luôn
                                            if (!$scope.isInTable && $scope.tableIsSelected.tableUuid == msg.tables[0].tableUuid) {

                                                $scope.tables[x].tableOrder.push(msg.tables[0].tableOrder[0]);

                                                $unoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, function () { resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder); $scope.$apply(); checkingCombination(); });

                                                var length = $scope.tables[x].tableOrder.length - 1;
                                                $scope.tables[x].tableOrder[length].saleOrder = msg.tables[0].tableOrder[0].saleOrder;
                                                resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder);

                                                if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                                    $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                                }
                                            }
                                            //Nếu ko đang xem hoặc đang xem mà xem order khác thì kiểm tra để push
                                            else {
                                                //Nếu bàn đó đang active tức là có order có món trong đó thì push thêm vô.
                                                if (tableIsActive($scope.tables[x])) {
                                                    $scope.tables[x].tableOrder.push(msg.tables[0].tableOrder[0]);

                                                    $unoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, function () { resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder); $scope.$apply(); checkingCombination(); });

                                                    var length = $scope.tables[x].tableOrder.length - 1;
                                                    $scope.tables[x].tableOrder[length].saleOrder = msg.tables[0].tableOrder[0].saleOrder;
                                                    resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder);

                                                    if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                                        $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                                    }
                                                }
                                                //Nếu bàn đó mà ko active thì xóa hết order bàn đó đi và push vào vị trí thứ 1. 
                                                else {
                                                    $scope.tables[x].tableOrder.forEach(function (o) {
                                                        $unoSaleOrderCafe.deleteOrder(o.saleOrder.saleOrderUuid);
                                                    });
                                                    $scope.tables[x].tableOrder = [];

                                                    $scope.tables[x].tableOrder.push(msg.tables[0].tableOrder[0]);

                                                    $unoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, function () { resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder); $scope.$apply(); checkingCombination(); });

                                                    var length = $scope.tables[x].tableOrder.length - 1;
                                                    $scope.tables[x].tableOrder[length].saleOrder = msg.tables[0].tableOrder[0].saleOrder;
                                                    resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder);

                                                    if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                                        $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                                    }
                                                }
                                            }
                                        }
                                        else {
                                            var z = angular.copy($scope.tables[x].tableOrder[orderIndex].saleOrder);
                                            //Merge sharedWith
                                            z.sharedWith = msg.tables[0].tableOrder[0].saleOrder.sharedWith;

                                            //Merge printed
                                            z.printed = msg.tables[0].tableOrder[0].saleOrder.printed;

                                            if (!msg.info.isUngroupItem) { //Cập nhật cho hàng hóa kiểu bình thường
                                                //Điều chỉnh data cho phù hợp
                                                //B1: Merge log giữa client và server có distinct

                                                var orderClient = z.logs.filter(function (item) {
                                                    return msg.tables[0].tableOrder[0].saleOrder.logs.findIndex(function (i) {
                                                        return i.itemID == item.itemID && i.timestamp == item.timestamp && i.deviceID == item.deviceID;
                                                    }) < 0;
                                                });

                                                //z.logs = z.logs.concat(orderServer);
                                                orderServer = msg.tables[0].tableOrder[0].saleOrder.logs;
                                                z.logs = orderClient.concat(orderServer);

                                                //B2: Tính toán lại số lượng dựa trên logs
                                                var groupLog = groupBy(z.logs);

                                                //B3: Cập nhật lại số lượng item
                                                groupLog.forEach(function (log) {
                                                    var index = z.orderDetails.findIndex(function (d) {
                                                        return d.itemId == log.itemID;
                                                    });
                                                    if (log.totalQuantity > 0 && index < 0) {
                                                        //Nếu số lượng trong log > 0 và item chưa có trong ds order của client thì thêm vào danh sách details
                                                        var itemDetail = msg.tables[0].tableOrder[0].saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID });
                                                        z.orderDetails.push(itemDetail);
                                                    }
                                                    else if (log.totalQuantity > 0 && index >= 0) {
                                                        //Nếu số lượng trong log > 0 và item đã có trong ds order của client thì cập nhật lại số lượng
                                                        var itemDetail = z.orderDetails.find(function (d) { return d.itemId == log.itemID });
                                                        itemDetail.quantity = log.totalQuantity;
                                                        //Cập nhật lại item chưa báo bếp.
                                                        itemDetail.quantity += itemDetail.newOrderCount;
                                                        //itemDetail.subTotal = itemDetail.quantity * itemDetail.sellPrice;

                                                        //Cập nhật lại giảm giá, giá mới,..v.v.
                                                        var props = ['discount', 'discountPercent', 'isDiscountPercent', 'unitPrice', 'sellPrice', 'subTotal'];
                                                        var detailServer = msg.tables[0].tableOrder[0].saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID });
                                                        //Cập nhật thêm props cho hàng tính giờ
                                                        if (itemDetail.isServiceItem) {
                                                            props.push('endTime', 'timeCounter', 'duration', 'blockCount', 'timer', 'startTime');
                                                        }
                                                        updateProperties(detailServer, itemDetail, props);
                                                    }
                                                    else if (log.totalQuantity <= 0 && index >= 0) {
                                                        //Nếu số lượng trong log <= 0 và item đã có trong ds order của client thì xóa item đó đi khỏi danh sách details
                                                        var itemDetailIndex = z.orderDetails.findIndex(function (d) { return d.itemId == log.itemID });
                                                        z.orderDetails.splice(itemDetailIndex, 1);
                                                    }
                                                    else if (log.totalQuantity <= 0 && index < 0) {
                                                        //Nếu số lượng trong log <= 0 và item chưa có trong ds order của server thì ko thực hiện gì cả.
                                                    }
                                                });

                                                //Cập nhật lại revision.
                                                z.revision = msg.tables[0].tableOrder[0].saleOrder.revision;

                                                //Cập nhật lại properties cho đơn hàng.
                                                var tempOrder = angular.copy(z);
                                                var order = msg.tables[0].tableOrder[0].saleOrder;
                                                order.orderDetails = tempOrder.orderDetails;
                                                order.logs = tempOrder.logs;
                                                order.revision = tempOrder.revision;
                                                order.sharedWith = tempOrder.sharedWith;
                                                order.printed = tempOrder.printed;

                                                $unoSaleOrderCafe.calculateOrder(order, function () { resetAmountPaidForOrder(order); $scope.$apply(); checkingCombination(); });
                                                //Trỏ lại cho đúng reference.
                                                $scope.tables[x].tableOrder[orderIndex].saleOrder = order;
                                                resetAmountPaidForOrder(order);
                                                //Reset EarningPoint
                                                //resetEarningPointForOrder(order, false);

                                                if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                                    $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                                }
                                            }
                                            else { //Cập nhật cho hàng hóa tách món kiểu trà sữa,...

                                                if ($unoSaleOrderCafe.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[0].saleOrder.saleOrderUuid) {
                                                    $scope.pinItem = null;
                                                }

                                                //Điều chỉnh data cho phù hợp
                                                //B1: Merge log giữa client và server có distinct

                                                var orderClient = z.logs.filter(function (item) {
                                                    return msg.tables[0].tableOrder[0].saleOrder.logs.findIndex(function (i) {
                                                        return i.itemID == item.itemID && i.timestamp == item.timestamp && i.deviceID == item.deviceID && i.detailID == item.detailID;
                                                    }) < 0;
                                                });

                                                //z.logs = z.logs.concat(orderServer);
                                                orderServer = msg.tables[0].tableOrder[0].saleOrder.logs;
                                                z.logs = orderClient.concat(orderServer);

                                                //B2: Tính toán lại số lượng dựa trên logs
                                                var groupLog = groupByUngroupItem(z.logs);

                                                //B3: Cập nhật lại số lượng item
                                                groupLog.forEach(function (log) {
                                                    var index = z.orderDetails.findIndex(function (d) {
                                                        return d.itemId == log.itemID && d.detailID == log.detailID;
                                                    });
                                                    if (log.totalQuantity > 0 && index < 0) {
                                                        //Nếu số lượng trong log > 0 và item chưa có trong ds order của client thì thêm vào danh sách details
                                                        var itemDetail = msg.tables[0].tableOrder[0].saleOrder.orderDetails.find(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                        //Nếu item chưa có là parent thì push vào như bình thường.
                                                        if (!itemDetail.isChild) {
                                                            z.orderDetails.push(itemDetail);
                                                        }
                                                        else { //Nếu item chưa có là child
                                                            //Kiếm parent của item đó.
                                                            var parentDetailIndex = z.orderDetails.findIndex(function (d) { return d.detailID == itemDetail.parentID });
                                                            //Push ngay bên dưới parent.
                                                            z.orderDetails.splice(parentDetailIndex + 1, 0, itemDetail);
                                                        }
                                                    }
                                                    else if (log.totalQuantity > 0 && index >= 0) {
                                                        //Nếu số lượng trong log > 0 và item đã có trong ds order của client thì cập nhật lại số lượng
                                                        var itemDetail = z.orderDetails.find(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                        itemDetail.quantity = log.totalQuantity;
                                                        //Cập nhật lại số lượng item chưa báo bếp.
                                                        itemDetail.quantity += itemDetail.newOrderCount;
                                                        //itemDetail.subTotal = itemDetail.quantity * itemDetail.sellPrice;

                                                        //Cập nhật lại giảm giá, giá mới,..v.v.
                                                        var props = ['discount', 'discountPercent', 'isDiscountPercent', 'unitPrice', 'sellPrice', 'subTotal'];
                                                        var detailServer = msg.tables[0].tableOrder[0].saleOrder.orderDetails.find(function (d) { return d.detailID == log.detailID });
                                                        //Cập nhật thêm props cho hàng tính giờ
                                                        if (itemDetail.isServiceItem) {
                                                            props.push('endTime', 'timeCounter', 'duration', 'blockCount', 'timer', 'startTime');
                                                        }
                                                        updateProperties(detailServer, itemDetail, props);
                                                    }
                                                    else if (log.totalQuantity <= 0 && index >= 0) {
                                                        //Nếu số lượng trong log <= 0 và item đã có trong ds order của client thì xóa item đó đi khỏi danh sách details
                                                        var itemDetailIndex = z.orderDetails.findIndex(function (d) { return d.itemId == log.itemID && d.detailID == log.detailID; });
                                                        z.orderDetails.splice(itemDetailIndex, 1);
                                                    }
                                                    else if (log.totalQuantity <= 0 && index < 0) {
                                                        //Nếu số lượng trong log <= 0 và item chưa có trong ds order của server thì ko thực hiện gì cả.
                                                    }
                                                });

                                                //B4: Sắp xếp lại parent và child Item.
                                                var parentItemList = z.orderDetails.filter(function (d) { return !d.isChild });
                                                var addCount = 0;
                                                var length = parentItemList.length; //Gán lại để tránh thay đổi length gây ra sai khi push vào mảng.
                                                for (var i = 0; i < length; i++) {
                                                    var pIndex = i + addCount;
                                                    var childItemList = z.orderDetails.filter(function (d) { return d.parentID && d.parentID == parentItemList[pIndex].detailID });
                                                    //Lặp ngược để push cho đúng vị trí khi thêm child cho parent.
                                                    for (var y = childItemList.length - 1; y >= 0; y--) {
                                                        parentItemList.splice(pIndex + 1, 0, childItemList[y]);
                                                        addCount++;
                                                    }
                                                }

                                                z.orderDetails = parentItemList;

                                                //Cập nhật lại revision.
                                                z.revision = msg.tables[0].tableOrder[0].saleOrder.revision;

                                                //Cập nhật lại properties cho đơn hàng.
                                                var tempOrder = angular.copy(z);
                                                var order = msg.tables[0].tableOrder[0].saleOrder;
                                                order.orderDetails = tempOrder.orderDetails;
                                                order.logs = tempOrder.logs;
                                                order.revision = tempOrder.revision;
                                                order.sharedWith = tempOrder.sharedWith;
                                                order.printed = tempOrder.printed;

                                                $unoSaleOrderCafe.calculateOrder(order, function () { resetAmountPaidForOrder(order); $scope.$apply(); checkingCombination(); });
                                                resetAmountPaidForOrder(order);
                                                //Reset EarningPoint
                                                //resetEarningPointForOrder(order, false);

                                                //Trỏ lại cho đúng reference
                                                $scope.tables[x].tableOrder[orderIndex].saleOrder = order;

                                                if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                                    $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                                }
                                            }

                                        }
                                    }
                                    else {
                                        $scope.tables[x].tableOrder.push(msg.tables[0].tableOrder[0]);

                                        $unoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, function () { resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder); $scope.$apply(); checkingCombination(); });
                                        resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder);

                                        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                            $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                        }
                                    }

                                    //Cập nhật lại trạng thái của bàn
                                    var isActive = tableIsActive($scope.tables[x]);
                                    $scope.tables[x].tableStatus = isActive ? 1 : 0;
                                    $scope.$apply();

                                    //Lưu vào DB Local
                                    updateTableToDB($scope.tables[x]);

                                    break;
                                }
                            }
                        }
                        //Xử lý cho tách hóa đơn.
                        else if (msg.info.action == 'splitOrder') {
                            //Cập nhật lại bàn từ Server gửi về.
                            for (var x = 0; x < $scope.tables.length; x++) {
                                if ($scope.tables[x].tableUuid == msg.tables[0].tableUuid) {
                                    //Lặp qua 2 order mới tách.
                                    for (var y = 0; y < msg.tables[0].tableOrder.length; y++) {
                                        if ($unoSaleOrderCafe.saleOrder && $unoSaleOrderCafe.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[y].saleOrder.saleOrderUuid) {
                                            $scope.pinItem = null;
                                        }
                                        var orderIndex = -1;
                                        orderIndex = $scope.tables[x].tableOrder.findIndex(function (order) { return order.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[y].saleOrder.saleOrderUuid });

                                        //Trường hợp chưa có trong ds Orders của bàn, đây là Order mới tách
                                        if (orderIndex == -1) {
                                            $scope.tables[x].tableOrder.push(msg.tables[0].tableOrder[y]);
                                        }
                                        else {
                                            $scope.tables[x].tableOrder[orderIndex] = msg.tables[0].tableOrder[y];
                                        }
                                        var index = y; //giữ lại giá trị y để vào callback chạy đúng.
                                        $unoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[y].saleOrder, function () { resetAmountPaidForOrder(msg.tables[0].tableOrder[index].saleOrder); $scope.$apply(); checkingCombination(); });
                                        resetAmountPaidForOrder(msg.tables[0].tableOrder[y].saleOrder);

                                        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                            $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                        }
                                    }

                                    //Cập nhật lại trạng thái của bàn
                                    var isActive = tableIsActive($scope.tables[x]);
                                    $scope.tables[x].tableStatus = isActive ? 1 : 0;
                                    $scope.$apply();

                                    //Lưu vào DB Local bàn đó sau khi đã xử lý xong.
                                    updateTableToDB($scope.tables[x]);
                                    break;
                                }
                            }
                        }
                        //Xử lý cho ngừng tính giờ Item hoặc đổi tên
                        else if (msg.info.action == 'startTimer' || msg.info.action == 'renameOrder') {
                            //Cập nhật lại bàn từ Server gửi về, vì chỉ gửi 1 bàn và 1 order nên ko cần lặp 2 vòng.
                            for (var x = 0; x < $scope.tables.length; x++) {
                                if ($scope.tables[x].tableUuid == msg.tables[0].tableUuid) {
                                    if ($unoSaleOrderCafe.saleOrder && $unoSaleOrderCafe.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[0].saleOrder.saleOrderUuid) {
                                        $scope.pinItem = null;
                                    }
                                    var order = $scope.tables[x].tableOrder.find(function (order) { return order.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[0].saleOrder.saleOrderUuid });
                                    //Check order cho trường hợp ngừng tính giờ hàng chưa báo bếp.
                                    if (order) {
                                        updateUnnoticeItemOrder(msg.tables[0].tableOrder[0], order);
                                        order.saleOrder = msg.tables[0].tableOrder[0].saleOrder;

                                        $unoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, function () { resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder); $scope.$apply(); checkingCombination(); });
                                        resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder);

                                        if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                            $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                        }

                                        //Cập nhật lại trạng thái của bàn
                                        var isActive = tableIsActive($scope.tables[x]);
                                        $scope.tables[x].tableStatus = isActive ? 1 : 0;
                                        $scope.$apply();

                                        //Lưu vào DB
                                        updateTableToDB($scope.tables[x]);

                                        break;
                                    }
                                }
                            }
                        }
                    }
                });

                socket.on('moveOrder', function (msg) {
                    SUNOCONFIG.LOG('moveOrder', msg);
                    if (msg.storeId == $scope.currentStore.storeID && !isSyncBlocked) {
                        //Cập nhật lại ở bàn cũ
                        var table = $scope.tables.find(function (t) { return t.tableUuid == msg.fromTableUuid });
                        if (table) {
                            //Cập nhật lại order cũ
                            var order = table.tableOrder.find(function (order) { return order.saleOrder.saleOrderUuid == msg.fromSaleOrderUuid });
                            if (order) {
                                //Nếu mà có món chưa báo bếp thì để món đó ở lại order. 
                                if (order.saleOrder.hasNotice || hasNotice(order)) {
                                    var uid = SunoGlobal.generateGUID();
                                    order.saleOrder.saleOrderUuid = uid;
                                    order.saleOrder.saleOrderUid = uid;
                                    order.saleOrder.uid = uid;
                                    clearSynchronizedItem(order);
                                    $unoSaleOrderCafe.selectOrder(order.saleOrder.uid);
                                    $unoSaleOrderCafe.calculateTotal();
                                    resetAmountPaidForOrder($unoSaleOrderCafe.saleOrder);
                                }
                                //Nếu mà order đã báo bếp hết rồi thì xóa order đó đi.
                                else {
                                    var index = table.tableOrder.indexOf(order);
                                    table.tableOrder.splice(index, 1);
                                    $unoSaleOrderCafe.deleteOrder(msg.fromSaleOrderUuid);
                                }

                                if (!$scope.isInTable && $scope.tableIsSelected.tableUuid == table.tableUuid && index == $scope.orderIndexIsSelected) {
                                    //Nếu bàn vẫn còn order sau khi xóa order ở trên thì trỏ về order sau cùng trong ds order.
                                    if ($scope.tableIsSelected.tableOrder.length > 0) {
                                        $scope.orderIndexIsSelected = $scope.tableIsSelected.tableOrder.length - 1;
                                        $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                    }
                                    else {
                                        createFirstOrder();
                                    }
                                    if ($scope.printSetting.acceptSysMessage) {
                                        //Kiểm tra xem phải order của người dùng này và người dùng này có đang xem order này hay không?
                                        var isViewing = order.saleOrder.createdBy == SunoGlobal.userProfile.userId && table.tableUuid == $scope.tableIsSelected.tableUuid;
                                        if (isViewing) {
                                            //Thông báo
                                            var action = msg.info.action == 'G' ? 'ghép' : 'chuyển';
                                            var msgContent = '<p style="text-align:center;">Đơn hàng của bạn tại bàn <b>' + table.tableName + '</b> mà bạn vừa xem đã được ' + action + ' sang bàn <b>' + msg.tables[0].tableName + '</b> ở một thiết bị khác.</p>';
                                            showStackNotification('Thông báo', msgContent, null);
                                        }
                                    }
                                }

                                //Cập nhật lại trạng thái của bàn.
                                var isActive = tableIsActive(table);
                                table.tableStatus = isActive ? 1 : 0;
                            }
                        }

                        //Cập nhật lại ở bàn mới
                        table = $scope.tables.find(function (t) { return t.tableUuid == msg.tables[0].tableUuid });
                        if (table) {
                            var order = table.tableOrder.find(function (order) { return order.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[0].saleOrder.saleOrderUuid; });
                            if (order) {
                                if ($unoSaleOrderCafe.saleOrder.saleOrderUuid == order.saleOrder.saleOrderUuid) {
                                    $scope.pinItem = null;
                                }
                                //Nếu order có sẵn là trường hợp ghép hóa đơn
                                order.saleOrder = msg.tables[0].tableOrder[0].saleOrder;
                                $unoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, function () { resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder); $scope.$apply(); checkingCombination(); });
                                resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder);

                                if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                    $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                }

                                table.tableStatus = 1;
                            }
                            else {
                                ////Nếu order không có là trường hợp đổi bàn
                                //table.tableOrder.push(msg.tables[0].tableOrder[0]);
                                //$unoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, function () { resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder); $scope.$apply(); checkingCombination(); });
                                //resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder);

                                //Nếu đang xem bàn đó thì push thẳng vào luôn
                                if (!$scope.isInTable && $scope.tableIsSelected.tableUuid == msg.tables[0].tableUuid) {

                                    table.tableOrder.push(msg.tables[0].tableOrder[0]);

                                    $unoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, function () { resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder); $scope.$apply(); checkingCombination(); });

                                    var length = table.tableOrder.length - 1;
                                    table.tableOrder[length].saleOrder = msg.tables[0].tableOrder[0].saleOrder;
                                    resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder);
                                }
                                //Nếu ko đang xem hoặc đang xem mà xem order khác thì kiểm tra để push
                                else {
                                    //Nếu bàn đó đang active tức là có order có món trong đó thì push thêm vô.
                                    if (tableIsActive(table)) {
                                        table.tableOrder.push(msg.tables[0].tableOrder[0]);

                                        $unoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, function () { resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder); $scope.$apply(); checkingCombination(); });

                                        var length = table.tableOrder.length - 1;
                                        table.tableOrder[length].saleOrder = msg.tables[0].tableOrder[0].saleOrder;
                                        resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder);
                                    }
                                    //Nếu bàn đó mà ko active thì xóa hết order bàn đó đi và push vào vị trí thứ 1. 
                                    else {
                                        table.tableOrder.forEach(function (o) {
                                            $unoSaleOrderCafe.deleteOrder(o.saleOrder.saleOrderUuid);
                                        });
                                        table.tableOrder = [];

                                        table.tableOrder.push(msg.tables[0].tableOrder[0]);

                                        $unoSaleOrderCafe.calculateOrder(msg.tables[0].tableOrder[0].saleOrder, function () { resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder); $scope.$apply(); checkingCombination(); });

                                        var length = table.tableOrder.length - 1;
                                        table.tableOrder[length].saleOrder = msg.tables[0].tableOrder[0].saleOrder;
                                        resetAmountPaidForOrder(msg.tables[0].tableOrder[0].saleOrder);
                                    }
                                }

                                //Trỏ lại SaleOrder trong Prototype.
                                if ($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected]) {
                                    $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                }

                                //Cập nhật lại table Status
                                table.tableStatus = 1;
                            }
                        }

                        $scope.$apply();

                        //Lưu DB Local
                        Promise.all([
                            DBTables.$queryDoc({
                                selector: {
                                    'store': { $eq: $scope.currentStore.storeID },
                                    'tableUuid': { $eq: msg.fromTableUuid }
                                },
                                fields: ['_id', '_rev']
                            }),
                            DBTables.$queryDoc({
                                selector: {
                                    'store': { $eq: $scope.currentStore.storeID },
                                    'tableUuid': { $eq: msg.tables[0].tableUuid }
                                },
                                fields: ['_id', '_rev']
                            })
                        ])
                            .then(function (data) {
                                var fromTable = $scope.tables.find(function (t) { return t.tableUuid == msg.fromTableUuid });
                                fromTable._id = data[0].docs[0]._id;
                                fromTable._rev = data[0].docs[0]._rev;
                                fromTable.store = $scope.currentStore.storeID;

                                var toTable = $scope.tables.find(function (t) { return t.tableUuid == msg.tables[0].tableUuid });
                                toTable._id = data[1].docs[0]._id;
                                toTable._rev = data[1].docs[0]._rev;
                                toTable.store = $scope.currentStore.storeID;

                                return DBTables.$manipulateBatchDoc([fromTable, toTable]);
                            })
                            .then(function (data) {
                                return DBTables.$queryDoc({
                                    selector: {
                                        'store': { $eq: $scope.currentStore.storeID }
                                    }
                                });
                            })
                            .then(function (data) {
                            })
                            .catch(function (error) {
                                SUNOCONFIG.LOG(error);
                            });
                    }
                    checkingCombination();
                });

                socket.on('completeOrder', function (msg) {
                    SUNOCONFIG.LOG('completeOrder', msg);
                    if (msg.storeId == $scope.currentStore.storeID && !isSyncBlocked) {
                        for (var x = 0; x < $scope.tables.length; x++) {

                            //Tìm bàn server gửi về
                            if ($scope.tables[x].tableUuid == msg.tables[0].tableUuid) {

                                //Tìm order trong bàn đó
                                var orderIndex = $scope.tables[x].tableOrder.findIndex(function (t) { return t.saleOrder.saleOrderUuid == msg.tables[0].tableOrder[0].saleOrder.saleOrderUuid });

                                //Nếu có order là trường hợp Thanh toán hoặc là xóa trắng đơn hàng đã báo bếp.
                                if (orderIndex != -1) {

                                    //Xóa ra khỏi ds orders của bàn đó và trong Prototype.
                                    $scope.tables[x].tableOrder.splice(orderIndex, 1);
                                    $unoSaleOrderCafe.deleteOrder(msg.tables[0].tableOrder[0].saleOrder.saleOrderUuid);

                                    //Nếu đang chọn xem order đó thì refresh lại.
                                    if (!$scope.isInTable && $scope.tableIsSelected.tableUuid == msg.tables[0].tableUuid && $scope.orderIndexIsSelected == orderIndex) {

                                        //Nếu bàn vẫn còn order sau khi đã xóa order bên trên thì trỏ về order sau cùng trong ds order.
                                        if ($scope.tableIsSelected.tableOrder.length > 0) {
                                            $scope.orderIndexIsSelected = $scope.tableIsSelected.tableOrder.length - 1;
                                            $unoSaleOrderCafe.selectOrder($scope.tableIsSelected.tableOrder[$scope.orderIndexIsSelected].saleOrder.saleOrderUuid);
                                        }
                                        else {
                                            createFirstOrder();
                                        }

                                        if ($scope.showOrderDetails) $scope.showOrderDetails = false;
                                    }

                                    //Cập nhật lại trạng thái của bàn
                                    var isActive = tableIsActive($scope.tables[x]);
                                    $scope.tables[x].tableStatus = isActive ? 1 : 0;

                                    //Lưu vào DB Local
                                    updateTableToDB($scope.tables[x]);

                                    //Thông báo cho client về hóa đơn được thanh toán ở thiết bị khác.
                                    if (msg.msg) {
                                        if ((SunoGlobal.userProfile.userId == msg.msg.author) //|| $scope.tables[x].tableOrder[orderIndex].saleOrder.sharedWith.find(function (p) { return p.userID == SunoGlobal.userProfile.userId; }) > 0)
                                            && deviceID != msg.msg.deviceID) {
                                            var msgContent = '<p style="text-align: center;">Đơn hàng của bạn tại bàn <b>' + $scope.tables[x].tableName + '</b> đã được thanh toán ở một thiết bị khác.</p>';
                                            showStackNotification('Thông báo', msgContent, null);
                                        }
                                    }
                                    $scope.$apply();
                                    break;
                                }
                                //Trường hợp xóa trắng đơn hàng chưa báo bếp nên ko tìm thấy Order.
                                else {
                                    //Không thực hiện gì cả.
                                }
                            }
                        }
                    }
                    checkingCombination();
                });

                socket.on('completeShift', function (msg) {
                    SUNOCONFIG.LOG('completeShiftON', msg);
                    if (msg.storeId == $scope.currentStore.storeID && !isSyncBlocked) {
                        //Xóa shift, xóa tables, xóa zones. Sau đó reload lại để cập nhật thông tin shift và data mới nhất từ Server.
                        if (deviceID == msg.info.deviceID) {
                            clearShiftTableZoneInLocal(function () {
                                window.location.reload(true);
                            });
                        }
                        else {
                            isSyncBlocked = true;
                            showStackNotification('Thông báo', '<p style="text-align: center;">Ca làm việc hiện tại đã kết thúc.</p><p style="text-align:center;">Ứng dụng sẽ được khởi động lại.</p>',
                                function () {
                                    clearShiftTableZoneInLocal(function () {
                                        //Delay 2s rồi mới reload.
                                        setTimeout(function () {
                                            window.location.reload(true);
                                        }, 1000);
                                    });
                                });
                        }
                    }
                });

                socket.on('reload', function (msg) {
                    if (msg.storeId == $scope.currentStore.storeID && !isSyncBlocked) {
                        if (deviceID == msg.info.deviceID) {
                            window.location.reload(true);
                        }
                        else {
                            isSyncBlocked = true;
                            showStackNotification('Thông báo', '<p style="text-align: center;">Dữ liệu hệ thống về cửa hàng đã được thay đổi ở 1 thiết bị khác.</p><p style="text-align:center;">Ứng dụng sẽ được khởi động lại.</p>', function () { window.location.reload(true); });
                        }
                    }
                });

                socket.on('clearShift', function (msg) {
                    SUNOCONFIG.LOG('clearShift', msg);
                    if (msg.storeId == $scope.currentStore.storeID && !isSyncBlocked) {
                        clearShiftTableZoneInLocal(function () { window.location.reload(true); });
                    }
                })

                socket.on('shouldntSync', function (msg){
                    SUNOCONFIG.LOG('shouldntSync', msg);
                    if (msg.storeId == $scope.currentStore.storeID) {
                        $scope.syncStatus = 'error';
                        $scope.$apply();
                    }
                });

                socket.on('completeShiftForNewVersion', function (msg) {
                    SUNOCONFIG.LOG('completeShiftForNewVersion', msg);
                    if (msg.storeId == $scope.currentStore.storeID && !isSyncBlocked) {
                        window.location.reload(true);
                    }
                })

                socket.on('printHelper', function (msg) {
                    if (msg.storeId == $scope.currentStore.storeID && !isSyncBlocked) {
                        if ($scope.isWebView && ($scope.printHelper && $scope.printHelper.cashier && msg.orderType == 'cashier') || ($scope.printHelper && $scope.printHelper.kitchen && msg.orderType == 'kitchen')) {
                            if (!msg.printSetting) {
                                msg.printSetting = {
                                    companyInfo: $scope.companyInfo.companyInfo,
                                    allUsers: $scope.authBootloader.users,
                                    store: $scope.currentStore
                                };
                            }
                            if (msg.orderType == 'kitchen') {
                                if ($scope.printSetting.unGroupBarKitchen) {
                                    printOrderBarKitchen(printer, msg.printOrder, $scope.BarItemSetting, msg.printSetting);
                                }
                                else {
                                    printOrderInBrowser(printer, msg.printOrder, 128, msg.printSetting);
                                }
                            } else if (msg.orderType == 'cashier') {
                                printOrderInBrowser(printer, msg.printOrder, 1, msg.printSetting);
                            }
                        }
                    }
                });

                socket.on('exception', function (msg) {
                    SUNOCONFIG.LOG('exceptionFromServer', msg);
                    if (msg.data.storeId == $scope.currentStore.storeID && !isSyncBlocked) {

                        //Lỗi gửi lên server data và shift cũ
                        if (msg.errorCode && msg.errorCode == 'invalidShift') {
                            DBSettings.$removeDoc({ _id: 'shiftId' + '_' + SunoGlobal.companyInfo.companyId + '_' + $scope.currentStore.storeID })
                                .then(function (data) {
                                    if (notiPopupInstance) {
                                        showNotification(null, null, null).close();
                                    }
                                    $timeout(function () {
                                        showNotification('Thông báo', '<p style="text-align: center;">Quá trình nạp và cập nhật dữ liệu không thành công.</p><p style="text-align:center; font-weight: bold;">Ứng dụng sẽ được khởi động lại.</p>', function () { window.location.reload(true); });
                                    }, 100);
                                    //window.location.reload(true);
                                })
                                .catch(function (error) {
                                    SUNOCONFIG.LOG(error);
                                });
                        }

                        //Lỗi gửi lên server initial data không hợp lệ
                        if (msg.errorCode && msg.errorCode == 'invalidShiftData') {
                            clearShiftTableZoneInLocal(function () { window.location.reload(true); });
                        }

                        //Lỗi unauthorized, ko qua đc doAuth
                        if (msg.errorCode && (msg.errorCode == 'invalidStore' || msg.errorCode == 'unauthorizedClientId')) {
                            if (notiPopupInstance) {
                                showNotification(null, null, null).close();
                            }
                            $timeout(function () {
                                showNotification('Thông báo', '<p style="text-align: center;">Phiên làm việc không hợp lệ.</p><p style="text-align:center; font-weight: bold;">Vui lòng đăng nhập lại.</p>', function () { $scope.logout(); });
                            }, 100);
                        }

                        //Lỗi bad request
                        if (msg.errorCode && msg.errorCode == 'badRequest') {
                            clearShiftTableZoneInLocal(function () { $scope.logout(); });
                        }
                    }
                });

                socket.on('getVersion', function (msg) {
                    var data = {
                        info: {
                            action: "getVersion",
                            author: SunoGlobal.userProfile.userId,
                            deviceID: deviceID,
                            timestamp: genTimestamp(),
                        },
                        version: version,
                        platform: platform
                    }
                    if (isSocketConnected) {
                        socket.emit('version', data);
                    }
                });

                socket.on('notification', function (msg) {
                    var title = msg.title;
                    var content = msg.content;
                    var type = msg.type; //alert 1 or mininoti 2
                    var action = msg.action //reload or logout.
                    var isForce = msg.isForce;
                    if (type == 1) {
                        var pop = $ionicPopup.alert({
                            title: title,
                            content: content
                        });
                        pop.then(function (d) {
                            if (action == 'reload') {
                                window.location.reload(msg.isForce);
                            }
                            else if (action == 'logout') {
                                $scope.logout();
                            }
                        })
                    }
                    else if (type == 2) {
                        toaster.pop('info', title, content);
                    }
                });

                if (!isValidOrderAndTableStructure) {
                    $ionicPopup.show({
                        title: '<b>SUNO</b> thông báo',
                        template: '<p style="text-align:center;"><span style="font-weight: bold;">SUNO vừa cập nhật phiên bản mới cho POS Cafe</b>.</span><p style="text-align: center;">Vì vậy dữ liệu của bạn đã cũ và không còn phù hợp với ứng dụng. <b>Hệ thống sẽ tự động cập nhật chuyển đổi dữ liệu từ cũ sang mới</b>. Bạn vui lòng kiểm tra và cập nhật sau khi ứng dụng khởi động lại.</p>',
                        buttons: [
                            {
                                text: '<b>HOÀN TẤT</b>',
                                type: 'button-positive',
                                onTap: function (e) {
                                    var url = Api.postKeyValue;
                                    var method = 'POST';
                                    convertTableV1ToV2();
                                    var data = {
                                        "key": "tableSetting",
                                        "value": JSON.stringify($scope.tablesSetting)
                                    };
                                    $unoRequest.makeRestful(url, method, data)
                                        .then(function (data) {
                                            $scope.updateBalance(0);
                                            audit(5, 'Chuyển phiên bản Cafe', '');
                                            if (isSocketConnected) {
                                                var completeShift = {
                                                    "companyId": SunoGlobal.companyInfo.companyId,
                                                    "storeId": $scope.currentStore.storeID,
                                                    "clientId": SunoGlobal.userProfile.sessionId,
                                                    "info": {
                                                        action: 'completeShiftForNewVersion',
                                                        deviceID: deviceID,
                                                        timestamp: genTimestamp(),
                                                        author: SunoGlobal.userProfile.userId
                                                    }
                                                }

                                                SUNOCONFIG.LOG('dataCompleteShiftForNewVersion', completeShift);
                                                socket.emit('completeShiftForNewVersion', completeShift);
                                            }
                                            else {
                                                handleDisconnectedSocket();
                                            }
                                        })
                                        .catch(function () {
                                            showStackNotification('Thông báo', '<p style="text-align:center;">Cập nhật dữ liệu mới cho hệ thống không thành công. Ứng dụng sẽ được khởi động lại.</p>', function () {
                                                window.location.reload(true);
                                            });
                                        })
                                }
                            }
                        ]
                    });
                }
            }

            return Promise.all([DBSettings.$getDocByID({ _id: 'printHelper' }), DBSettings.$getDocByID({ _id: 'printDevice' })]);
        })
        .then(function (data) {
            if (data) {
                if ($scope.isWebView && data[0].docs.length > 0) {
                    $scope.printHelper = data[0].docs[0].printHelper;
                    $scope.printHelperTemp = angular.copy($scope.printHelper);
                }
                if (($scope.isIPad || $scope.isIOS || $scope.isAndroid) && data[1].docs.length > 0) {
                    if (data[1].docs.length > 0) {
                        $scope.printDevice = data[1].docs[0].printDevice;
                        $scope.printDeviceTemp = angular.copy($scope.printDevice);
                    }
                    else {
                        $scope.printDeviceTemp = null;
                    }
                }
            }
        })
        .catch(function (e) {
            SUNOCONFIG.LOG(e);
            //e.constructor.name == 'ProgressEvent'
            //e instanceof ProgressEvent
            //ProgressEvent.prototype.isPrototypeOf(e)
            if (e instanceof ProgressEvent || e instanceof XMLHttpRequest) {
                var popUp = $ionicPopup.alert({
                    title: 'Thông báo',
                    template: '<p style="text-align:center;">Quá trình tải thông tin hệ thống không thành công.</p><p style="text-align:center;">Vui lòng kiểm tra kết nối Internet và thử lại</p>'
                });

                popUp.then(function (data) {
                    //window.location.reload(true);
                    $scope.isShowErrorRibbon = true;
                    $scope.errorArr.push({ priority: 2, content: 'Không có kết nối Internet.' }); //Không có kết nối này là khi gọi API. Có thể là do server.
                    $scope.setError();
                });
            }
            //Lỗi này của request Prototype trả về.
            else if (e == 'Vui lòng đăng nhập.') {
                var popUp = $ionicPopup.alert({
                    title: 'Thông báo',
                    template: '<p style="text-align:center;">Quá trình tải thông tin hệ thống không thành công.</p><p style="text-align:center;">Vui lòng đăng nhập lại.</p>'
                });

                popUp.then(function (data) {
                    $scope.logout();
                });
            }
            //e.constructor.name == 'SunoError'
            else if (e instanceof SunoError) {
                if (e.msg == 'Chưa đăng nhập') {
                    $scope.logout();
                }
                else if (e.msg == 'Hết hạn sử dụng') {
                    var popUp = $ionicPopup.alert({
                        title: 'Thông báo',
                        template: '<p style="text-align:center;">Tài khoản đã hết hạn sử dụng.</p>'
                    });
                    popUp.then(function () {
                        $scope.logout();
                    });
                }
                else if (e.msg == 'Get Bootloader và AuthBootLoader không thành công.') {
                    var popUp = $ionicPopup.alert({
                        title: 'Thông báo',
                        template: '<p style="text-align:center;">Quá trình tải thông tin hệ thống không thành công.</p><p style="text-align:center;">Hệ thống sẽ tự động tải lại.</p>'
                    });
                    popUp.then(function () {
                        window.location.reload(true);
                    });
                }
                else if (e.msg == 'Sơ đồ bàn Local và API ko khớp') {
                    var popUp = $ionicPopup.alert({
                        title: 'Thông báo',
                        template: '<p style="text-align:center;">Sơ đồ phòng bàn ở thiết bị hiện tại đã quá hạn.</p><p style="text-align:center;">Hệ thống sẽ tự động tải lại.</p>'
                    });
                    popUp.then(function () {
                        clearShiftTableZoneInLocal(function () { window.location.reload(true); });
                    });
                }
                else if (e.msg == 'Chưa được phân quyền trên cửa hàng nào') {
                    $scope.errorArr.push({ priority: 3, content: 'Tài khoản này chưa được phân quyền trên cửa hàng nào.' });
                    $scope.setError();
                }
                else if (e.msg == 'Không có quyền thực hiện post Key-Value') {
                    $scope.errorArr.push({ priority: 3, content: 'Dữ liệu của bạn hiện tại đã cũ, vui lòng đăng nhập bằng tài khoản quản lý để khởi tạo.' });
                    $scope.setError();
                }
                else if (e.msg == 'Tài khoản nv, chưa có phòng bàn') {
                    $scope.errorArr.push({ priority: 3, content: 'Cửa hàng chưa có dữ liệu, vui lòng đăng nhập bằng tài khoản quản lý để khởi tạo.' });
                    $scope.setError();
                }
            }
            else {
                var popUp = $ionicPopup.alert({
                    title: 'Thông báo',
                    template: '<p style="text-align:center;">Đã có lỗi xảy ra. Để tránh sai sót về mặt dữ liệu, ứng dụng sẽ tự đăng xuất.</p><p style="text-align:center;">Vui lòng đăng nhập lại.</p>'
                });

                popUp.then(function (data) {
                    $scope.logout();
                });
            }
        });

    var getOrderSum = function () {
        var count = 0;
        $scope.tables.forEach(function (t) {
            SUNOCONFIG.LOG(t.tableOrder.length);
            count += t.tableOrder.length;
        });
        return count;
    }

    //Hàm để check số lượng order của UI và Prototype khớp nhau.
    var checkSum = function () {
        var count = 0;
        $scope.tables.forEach(function (t) {
            count += t.tableOrder.length;
        });
        return $unoSaleOrderCafe.saleOrders.length == count;
    }

    //Hàm để check orderUuid của UI và Prototype khớp nhau.
    var checkUuid = function () {
        for (var x = 0; x < $scope.tables.length; x++) {
            var tb = $scope.tables[x];
            for (var y = 0; y < tb.tableOrder.length; y++) {
                var order = $unoSaleOrderCafe.saleOrders.find(function (sOrder) { return sOrder.saleOrderUuid == tb.tableOrder[y].saleOrder.saleOrderUuid; });
                if (!order) return false;
            }
        }
        return true;
    }

    var checkReference = function () {
        for (var x = 0; x < $scope.tables.length; x++) {
            var tb = $scope.tables[x];
            for (var y = 0; y < tb.tableOrder.length; y++) {
                var order = $unoSaleOrderCafe.saleOrders.find(function (sOrder) { return sOrder.saleOrderUuid == tb.tableOrder[y].saleOrder.saleOrderUuid; });
                if (order !== tb.tableOrder[y].saleOrder)
                    return false;
            }
        }
        return true;
    }

    var checkAmountPaid = function () {
        for (var x = 0; x < $scope.tables.length; x++) {
            var tb = $scope.tables[x];
            for (var y = 0; y < tb.tableOrder.length; y++) {
                order = tb.tableOrder[y].saleOrder
                if (!order.wasAmountPaidChangedByUser && order.amountPaid != order.total) {
                    return false;
                }
            }
        }
        return true;
    }

    var checkingCombination = function () {
        if (false) { //SUNOCONFIG.DEBUG
            var checkSumResult = checkSum();
            //SUNOCONFIG.LOG('Is the same total ', checkSumResult);
            var check2 = checkReference();
            //SUNOCONFIG.LOG('Is the same Uuid', checkUuidResult);
            if (!check2 && !checkSumResult) {
                toaster.pop('error', '', 'ErrorCode: 1 - checkSum and Reference error');
                //throw 'Chưa khớp cả 2';
            }
            else if (!check2) {
                toaster.pop('error', '', 'ErrorCode: 2 - Reference');
                //throw 'Chưa thõa check 2';
            }
            else if (!checkSumResult) {
                toaster.pop('error', '', 'ErrorCode: 3 - checksSum');
                //throw 'Chưa khớp số lượng';
            }
            if (!checkAmountPaid()) {
                toaster.pop('error', '', 'ErrorCode: 4 - AmountPaid');
            }
        }
    }
}
