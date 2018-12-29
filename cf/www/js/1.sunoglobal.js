var SunoGlobal = {
    isCompiler: false,
    token: {
        accessToken: '',
        refreshToken: ''
    },
    userProfile: {
        sessionId: '',
        authSessionId: '',
        userId: 0,
        userName: '',
        fullName: '',
        email: '',
        isAdmin: false
    },
    companyInfo:{
        companyId: 0,
        companyName: '',
    },
    permissions: [],
    stores: [],
    users: [],
    saleSetting: {
        isAllowDebtPayment: true,
        isApplyPromotion: false,
        isApplyEarningPoint: false,
        isApplyCustomerPricingPolicy: false,
        isPrintMaterials: false,
        isAllowPriceModified: false,
        isAllowQuantityAsDecimal: false,
        isProductReturnDay: true,
        productReturnDay: 14,
        cogsCalculationMethod: 2,
        saleReportSetting: 0
    },
    printer: {
        ordering: 'asc'
    },
    result: {
        isSuccess: true,
        description: '',
        data: null
    },
    authService: {
        //domain: 'http://localhost:6985',
        domain: 'http://beta.suno.vn',
        loginUrl: '/api/auth/hugate',
        isAuthenticatedUrl: '/api/provider/isauthenticated',
        getUserSessionUrl: '/api/provider/getusersession',
        refreshTokenUrl: '/api/provider/refreshToken'
    },
    sunoService: {
        //domain: 'http://localhost:14952',
        domain: 'http://apibeta.suno.vn',
        category: {
            getCategoriesUrl: '/api/categories'
        },
        productItem: {
            search: '/api/productitem/search',
            getProductItemsUrl: '/api/productitems',
            getNewProductItemsUrl: '/api/productitems/new',
            getBestSellingProductItemsUrl: '/api/productitems/bestselling',
            createProductUrl: '/api/product/create?format=json'
        },
        customer: {
            search: '/api/customers/search',
            getCustomersUrl: '/api/customers',
            createCustomerUrl: '/api/customer/create?format=json'
        },
        saleOrder: {
            getSaleOrderUrl: '/api/sale/order',
            getSaleOrderByCodeUrl: '/api/sale/order/code',
            getSaleOrdersUrl: '/api/sale/orders',
            search: '/api/sale/searchorders',
            completeOrderUrl: '/api/sale/complete?format=json'
        },
        earningPoint: {
            getConfigUrl: '/api/earningpoint/getconfig',
            getCustomerPointUrl: '/api/earningpoint/getcustomerpoint',
            getEarningHistoryUrl: '/api/earningpoint/history'
        },
        promotion: {
            getActivePromotionUrl: '/api/promotion/getactive',
            getPromotionOnItemUrl: '/api/promotion/getApplying?format=json',
            getPromotionOnBillUrl: '/api/promotion/getBillApplying',
            getPromotionByCodeUrl: '/api/promotion/getIdByCode'
        }
    },
    sunoCallback: {
        preRequest: function () { },
        completeRequest: function () { },
        redirectLogin: function () { },
		refreshToken: function () { }
    },
    isNullOrEmpty: function(str) {
        var isNullOrEmpty = true;
        if(str){
            if(typeof str === 'string'){
                if(str.length > 0){
                    isNullOrEmpty = false;
                }
            }
        }
        return isNullOrEmpty; 
    },
    querystring: function(jsonData) {
        var result = '';
        if (jsonData) {
            var qArray = [];
            Object.getOwnPropertyNames(jsonData).forEach(function(key, idx, array) {
                var val = '';
                if (jsonData[key] !== undefined && jsonData[key] !== null){
                    if (typeof jsonData[key] === 'string'){
                        if (jsonData[key].length > 0 ){
                            val = encodeURIComponent(jsonData[key]);
                        }
                    }
                    else{
                        val = jsonData[key];
                    }
                } 
                qArray.push(key + '=' + val);
            });
            result = qArray.join('&');
        }
        return result;
    },
    isContains: function(str, substr) {
        return (str.indexOf(substr) >= 0) ? true : false;
    },
    replaceCharacter: function (str, oldReplace, newReplace) {
        var newStr = str.split(oldReplace);
        newStr = newStr.join(newReplace);
        return newStr;
    },
    generateGUID: function () {
        var s = [];
        var hexDigits = "0123456789abcdef";
        for (var i = 0; i < 36; i++) {
            s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
        }
        s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
        s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
        s[8] = s[13] = s[18] = s[23] = "-";
        var uuid = s.join("");
        return uuid;
    },
    formatFileSize: function (size) {
        var i = Math.floor(Math.log(size) / Math.log(1024));
        return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
    },
    convertJsonDateTimeToJs: function (jsonDate) {
        var dateSlice = jsonDate.slice(6, 24);
        var milliseconds = parseInt(dateSlice);
        var date = new Date(milliseconds);
        return date;
    },
    cloneObject: function(object) {
        return JSON.parse(JSON.stringify(object));
    }
};


if (SUNOCONFIG.MODE == 'Beta') {
    SunoGlobal.authService.domain = 'http://beta.suno.vn';
    SunoGlobal.sunoService.domain = 'http://apibeta.suno.vn';
}
else if (SUNOCONFIG.MODE == 'Production') {
    SunoGlobal.authService.domain = 'https://auth.suno.vn';
    SunoGlobal.sunoService.domain = 'https://api.suno.vn';
}
else { //Dev is default
    SunoGlobal.authService.domain = 'http://localhost:6985';
    SunoGlobal.sunoService.domain = 'http://localhost:14952';
}
