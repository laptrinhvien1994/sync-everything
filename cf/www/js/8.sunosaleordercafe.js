//SunoSaleOrderCafe prototype is inherited from SunoBasicSaleOrder prototype.
var SC = function () { };
SC.prototype = SunoBasicSaleOrder.prototype;

function SunoSaleOrderCafe(storeId) {
    this.request = new SunoRequest();
    this.storeId = storeId;
};

//#region Prototype
SunoSaleOrderCafe.prototype = new SC();
SunoSaleOrderCafe.prototype.constructor = SunoSaleOrderCafe;
//#endregion

SunoSaleOrderCafe.prototype.promotionType = {
    None: 0,
    onItem: 1,
    onBill: 2,
    onCode: 3
};
SunoSaleOrderCafe.prototype.promotion = null;
SunoSaleOrderCafe.prototype.promotions = [];

/*
    Description: Tạo cấu trúc đơn hàng.
 */
SunoSaleOrderCafe.prototype.generateSaleOrder = function () {
    var self = this;
    self.saleOrderUid = SunoGlobal.generateGUID();
    var saleOrder = {
        uid: self.saleOrderUid,
        saleOrderId: 0,
        saleDate: new Date(),
        code: '',
        totalQuantity: 0,
        subTotal: 0,
        discount: 0,
        discountPercent: 0,
        isDiscountPercent: false,
        tax: 0,
        subFee: 0,
        subFeeName: '',
        total: 0,
        amountPaid: 0,
        balance: 0,
        comment: '',
        saleTypeId: self.saleType.retail, //Bán lẻ: 1 - Bản sỉ: 2 - Online: 3 - Xuất trả: 4
        status: self.saleStatus.complete,
        orderDetails: [],
        receiptVouchers: [],
        customer: null,
        seller: { userId: SunoGlobal.userProfile.userId, displayName: SunoGlobal.userProfile.fullName },
        cashier: { userId: SunoGlobal.userProfile.userId, displayName: SunoGlobal.userProfile.fullName }
    };
    //promotion
    saleOrder.isPromotion = false;
    saleOrder.promotionId = 0;
    saleOrder.promotionOnBill = [];
    saleOrder.promotionOnBillSelected = null;
    saleOrder.promotionOnItem = [];
    saleOrder.promotionType = self.promotionType.None;
    //earning point
    saleOrder.convertPoint = 0;
    saleOrder.convertMoney = 0;
    saleOrder.exchangedMoney = 0;
    saleOrder.exchangedPoint = 0;
    saleOrder.earningPointStatus = self.earningPointStatus.notExchangabled;
    //Cafe
    saleOrder.storeId = self.storeId;
    saleOrder.createdBy = saleOrder.cashier.userId;
    saleOrder.createdByName = saleOrder.cashier.displayName;
    saleOrder.revision = 1;
    saleOrder.logs = [];
    saleOrder.sharedWith = [];
    saleOrder.startTime = new Date();
    saleOrder.hasNotice = false;
    saleOrder.lastInputedIndex = -1;
    saleOrder.saleOrderUuid = saleOrder.uid;
    saleOrder.tableName = '';
    saleOrder.isSubFeePercent = false;
    saleOrder.subFeePercent = 0;
    return saleOrder;
};

/*
    Description: Tạo cấu trúc hàng hóa trong đơn hàng.
*/
SunoSaleOrderCafe.prototype.generateOrderDetail = function (item) {
    var self = this;
    var saleOrderDetail = {
        itemId: item.itemId,
        itemName: item.itemName,
        barcode: item.barcode,
        qtyAvailable: item.qtyAvailable,
        quantity: item.quantity,
        minQuantity: item.minQuantity,
        maxQuantity: item.maxQuantity,
        unitPrice: item.unitPrice,
        retailPrice: item.retailPrice,
        wholeSalePrice: item.wholeSalePrice,
        vipPrice: item.vipPrice,
        isDiscountPercent: false,
        discount: 0,
        discountPercent: 0,
        sellPrice: item.sellPrice,
        subTotal: item.quantity * item.sellPrice,
        isInventoryTracked: item.isInventoryTracked,
        isUntrackedItemSale: item.isUntrackedItemSale,
        isSerial: item.isSerial,
        serials: item.isSerial ? item.serials : [],
        isTaxable: item.isTaxable,
        tax: item.tax,
        vat: 0,
        unitName: item.unitName,
        productType: item.productType,
        productItemId: item.productId
    };
    saleOrderDetail.promotionId = 0;
    saleOrderDetail.promotionOnItemSelected = null;
    saleOrderDetail.newOrderCount = 0;
    if (item.hasOwnProperty('detailID')) saleOrderDetail.detailID = item.detailID//SunoGlobal.generateGUID();
    if (item.hasOwnProperty('isChild')) saleOrderDetail.isChild = item.isChild;//undefined;
    if (item.hasOwnProperty('parentID')) saleOrderDetail.parentID = item.parentID; //''
    if (item.hasOwnProperty('isServiceItem')) saleOrderDetail.isServiceItem = item.isServiceItem;
    if (item.hasOwnProperty('timer')) saleOrderDetail.timer = item.timer;
    if (item.hasOwnProperty('timeCounter')) saleOrderDetail.timeCounter = item.timeCounter;
    if (item.hasOwnProperty('startTime')) saleOrderDetail.startTime = item.startTime;
    return saleOrderDetail;
};
/*
    Description: Tạo cấu trúc chương trình khuyến mãi.
*/
SunoSaleOrderCafe.prototype.generatePromotion = function () {
    var promotion = new Object();
    promotion.isPromotion = false;
    promotion.isCallApi = false;
    promotion.promotionOnItem = [];
    promotion.promotionOnBill = [];
    return promotion;
};

SunoSaleOrderCafe.prototype.earningPointStatus = {
    exchanged: 1,
    notExchangabled: 0
};

SunoSaleOrderCafe.prototype.earningPointConfig = {
    convertPoint: 0,
    convertMoney: 0,
    exchangeMoney: 0,
    exchangePoint: 0,
    isApplyEarningPoint: SunoGlobal.saleSetting.isApplyEarningPoint
};

SunoSaleOrderCafe.prototype.getEarningPointConfig = function () {
    var self = this;
    var data = { format: 'json' };
    return new Promise(function (resolve, reject) {
        self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.earningPoint.getConfigUrl, 'GET', data).then(function (body) {
            if (body != null) {
                self.earningPointConfig.convertMoney = body.convertMoney;
                self.earningPointConfig.convertPoint = body.convertPoint;
                if (body.groupConfig != null && body.groupConfig.length > 0) {
                    self.earningPointConfig.exchangeMoney = body.groupConfig[0].exchangeMoney;
                    self.earningPointConfig.exchangePoint = body.groupConfig[0].exchangePoint;
                }
                else {
                    self.earningPointConfig.exchangeMoney = 0;
                    self.earningPointConfig.exchangePoint = 0;
                }
            }
            resolve(self.earningPointConfig);
            //return self.earningPointConfig;
        }).catch(function (error) {
            reject(error);
            //return error;
        });
    });
};

/*
    Description: Khởi tạo đơn hàng. Lấy thông tin cấu hình tích lũy điểm.
*/
SunoSaleOrderCafe.prototype.initOrder = function () {
    var self = this;
    self.saleOrders = [];
    if (SunoGlobal.saleSetting.isApplyEarningPoint) {
        self.earningPointConfig.isApplyEarningPoint = SunoGlobal.saleSetting.isApplyEarningPoint;
        self.getEarningPointConfig().then(function (response) {
            self.earningPointConfig = response;
        }).catch(function (error) {
            console.log('SunoSaleOrderCafe.prototype.getEarningPointConfig', error);
        });
    }
};

/*
    Description: Tạo mới đơn hàng.
*/
SunoSaleOrderCafe.prototype.createNewOrder = function (saleType) {
    var self = this;
    var saleOrder = self.generateSaleOrder();
    saleOrder.saleTypeId = saleType !== undefined && saleType !== null ? saleType : self.saleType.retail;
    self.promotion = self.generatePromotion();
    self.promotions.push(self.promotion);
    self.saleOrders.push(saleOrder);
    self.saleOrder = saleOrder;
    if (SunoGlobal.saleSetting.isApplyPromotion && saleOrder.saleTypeId != self.saleType.online) {
        var data = { format: 'json' };
        self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.promotion.getActivePromotionUrl, 'GET', data)
        .then(function (body) {
            self.promotion.isCallApi = body;
            if (self.promotion.isCallApi) {
                //Lấy danh sách CTKM trên hóa đơn
                var promotionData = { format: 'json', saleDate: saleOrder.saleDate.toJSON() };
                self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.promotion.getPromotionOnBillUrl, 'GET', promotionData)
                .then(function (result) {
                    if (result != null && result.response != null && result.response.length > 0) {
                        self.promotion.promotionOnBill = result.response;
                    }
                })
                .catch(function (error) {
                    console.log('SunoSaleOrderCafe.prototype.createNewOrder: getPromotionOnBillUrl', error);
                });
            }
        })
        .catch(function (error) {
            console.log('SunoSaleOrderCafe.prototype.createNewOrder: getActivePromotionUrl', error);
        });
    }
};

/*
    Description: Chọn đơn hàng.
*/
SunoSaleOrderCafe.prototype.selectOrder = function (uid) {
    var self = this;
    var saleOrder = self.saleOrders.find(function (order) { return order.uid == uid; });
    if (saleOrder !== undefined) {
        self.saleOrder = saleOrder;
        self.saleOrderUid = uid;
        var index = self.saleOrders.indexOf(self.saleOrder);
        if (index > -1) {
            self.promotion = self.promotions[index];
        }
    }
};

/*
    Description: Reset đơn hàng hiện tại.
*/
SunoSaleOrderCafe.prototype.cancelOrder = function () {
    var self = this;
    var saleOrderUid = self.saleOrderUid;
    var saleOrder = self.saleOrders.find(function (order) { return order.uid == self.saleOrder.uid; });
    if (saleOrder !== undefined) {
        saleOrder = self.generateSaleOrder();
        saleOrder.uid = saleOrderUid;
        self.saleOrder = saleOrder;
        self.saleOrderUid = saleOrderUid;

        self.saleOrder.convertPoint = 0;
        self.saleOrder.convertMoney = 0;
        self.saleOrder.exchangedMoney = 0;
        self.saleOrder.exchangedPoint = 0;
        self.saleOrder.earningPointStatus = self.earningPointStatus.notExchangabled;
        var index = self.saleOrders.findIndex(function (order) { return order.uid == self.saleOrder.uid; });
        if (index > -1) {
            self.saleOrders[index] = self.saleOrder;
            var promotion = self.generatePromotion();
            self.promotions[index] = promotion;
            self.promotion = promotion;
            if (SunoGlobal.saleSetting.isApplyPromotion && self.saleOrder.saleTypeId != self.saleType.online) {
                var data = { format: 'json' };
                self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.promotion.getActivePromotionUrl, 'GET', data)
                .then(function (body) {
                    self.promotions[index].isCallApi = body;
                    self.promotion.isCallApi = body;
                    if (self.promotion.isCallApi) {
                        //Lấy danh sách CTKM trên hóa đơn
                        var promotionData = { format: 'json', saleDate: saleOrder.saleDate.toJSON() };
                        self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.promotion.getPromotionOnBillUrl, 'GET', promotionData)
                        .then(function (result) {
                            if (result != null && result.response != null && result.response.length > 0) {
                                self.promotions[index].promotionOnBill = result.response;
                                self.promotion.promotionOnBill = result.response;
                            }
                        })
                        .catch(function (error) {
                            console.log('SunoSaleOrderCafe.prototype.cancelOrder: getPromotionOnBillUrl', error);
                        });
                    }
                })
                .catch(function (error) {
                    console.log('SunoSaleOrderCafe.prototype.cancelOrder: getActivePromotionUrl', error);
                });
            }
        }
    }

};

/*
    Description: Xóa đơn hàng.
*/
SunoSaleOrderCafe.prototype.deleteOrder = function (uid) {
    var self = this;
    var index = self.saleOrders.findIndex(function (order) { return order.uid == uid; });
    if (index > -1) {
        self.saleOrders.splice(index, 1);
        self.promotions.splice(index, 1);
    }
};

/*
    Description: Tạo model cho việc lưu đơn hàng.
*/
SunoSaleOrderCafe.prototype.prepareOrder = function (order) {
    var self = this;
    var balance = 0;
    var request = {
        saleOrder: {
            storeId: self.storeId,
            saleOrderId: order.saleOrderId,
            saleOrderCode: order.code,
            saleOrderDate: order.saleDate,
            saleTypeId: order.saleTypeId,
            status: order.status,
            totalQuantity: order.totalQuantity,
            subTotal: order.subTotal,
            discount: order.discount,
            subFee: order.subFee,
            subFeeName: order.subFeeName,
            total: order.total,
            amountPaid: order.amountPaid,
            paymentBalance: Math.max(order.total - order.amountPaid, 0),
            tax: order.tax,
            comment: order.comment,
            saleUser: order.seller.userId,
            cashier: order.cashier.userId,
            customer: order.customer,
            orderDetails: [],
            payments: [],
            isPromotion: order.isPromotion,
            promotionId: order.promotionId,
            convertPoint: order.convertPoint,
            convertMoney: order.convertMoney,
            earningPointStatus: order.earningPointStatus,
            exchangedMoney: order.exchangedMoney,
            exchangedPoint: order.exchangedPoint
        }
    };
    for (var i = 0; i < order.orderDetails.length; i++) {
        var item = order.orderDetails[i];
        var orderDetail = {
            saleOrderDetailId: 0,
            productItemId: item.itemId,
            itemName: item.itemName,
            barcode: item.barcode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            sellPrice: item.sellPrice,
            discount: item.isDiscountPercent ? item.discountPercent : item.discount,
            discountIsPercent: item.isDiscountPercent,
            subTotal: item.subTotal,
            isInventoryTracked: item.isInventoryTracked,
            isUntrackedItemSale: item.isUntrackedItemSale,
            isSerial: item.isSerial,
            serials: item.serials,
            isTaxable: item.isTaxable,
            tax: item.tax,
            vat: 0,
            productType: item.productType,
            unit: item.unitName,
            promotionId: item.promotionId,
        };
        request.saleOrder.orderDetails.push(orderDetail);
    }

    //Payments
    if (order.amountPaid <= 0 || !order.receiptVouchers || order.receiptVouchers.length == 0) {
        balance = order.total;
        request.saleOrder.payments.push({
            voucherId: 0,
            code: '',
            receivedDate: order.saleDate,
            status: 3,
            paymentMethodId: self.paymentMethod.cash,
            amount: 0,
            balance: order.total,
            description: ''
        });
    }
    else {
        var totalAmount = 0;
        for (var i = 0; i < order.receiptVouchers.length; i++) {
            var receipt = order.receiptVouchers[i];
            var payment = {
                voucherId: 0,
                code: '',
                receivedDate: order.saleDate,
                status: 3,
                paymentMethodId: receipt.paymentMethodId,
                amount: receipt.amount,
                balance: 0,
                description: receipt.comment
            };
            request.saleOrder.payments.push(payment);
            totalAmount += receipt.amount;
        }
        balance = order.total - totalAmount;
    }
    request.saleOrder.paymentBalance = Math.max(balance, 0);
    return request;
};

/*
    Description: Tính toán thông tin đơn hàng.
*/
SunoSaleOrderCafe.prototype.calculateTotal = function () {
    var self = this;
    self.saleOrder.totalQuantity = 0;
    self.saleOrder.subTotal = 0;
    self.saleOrder.total = 0;
    self.saleOrder.tax = 0;
    for (var i = 0; i < self.saleOrder.orderDetails.length; i++) {
        var detail = self.saleOrder.orderDetails[i];
        self.saleOrder.totalQuantity += detail.quantity;
        detail.subTotal = detail.quantity * detail.sellPrice;
        self.saleOrder.subTotal += detail.subTotal;
        self.saleOrder.tax += detail.quantity * detail.tax;
    }
    self.saleOrder.totalQuantity = Math.round(self.saleOrder.totalQuantity * 1e12) / 1e12;
    self.saleOrder.discount = self.saleOrder.isDiscountPercent ? Math.round(self.saleOrder.subTotal * self.saleOrder.discountPercent / 100) : Math.min(self.saleOrder.discount, self.saleOrder.subTotal);
    self.saleOrder.total = self.saleOrder.subTotal + self.saleOrder.subFee - self.saleOrder.discount;

    var totalWithoutFee = 0;

    //Đổi điểm
    if (self.earningPointConfig.isApplyEarningPoint && self.saleOrder.customer != null && self.saleOrder.exchangedPoint >= 0) {
        self.saleOrder.exchangedMoney = self.calculateEarningMoney(self.saleOrder.exchangedPoint);
        self.saleOrder.total = self.saleOrder.total - self.saleOrder.exchangedMoney;
    }

    //Tích điểm
    if (self.earningPointConfig.isApplyEarningPoint && self.saleOrder.customer != null) {
        self.saleOrder.earningPointStatus = self.earningPointStatus.exchanged;
        totalWithoutFee = Math.max(self.saleOrder.total - self.saleOrder.subFee, 0);
        self.saleOrder.convertPoint = self.calculateEarningPoint(totalWithoutFee);
    }
    self.saleOrder.paymentBalance = Math.max(self.saleOrder.total - self.saleOrder.amountPaid, 0);
};

/*
    Description: Tính toán thông tin đơn hàng.
*/
SunoSaleOrderCafe.prototype.calculateTotalByOrder = function (order) {
    var self = this;
    order.totalQuantity = 0;
    order.subTotal = 0;
    order.total = 0;
    order.tax = 0;
    for (var i = 0; i < order.orderDetails.length; i++) {
        var detail = order.orderDetails[i];
        order.totalQuantity += detail.quantity;
        detail.subTotal = detail.quantity * detail.sellPrice;
        order.subTotal += detail.subTotal;
        order.tax += detail.quantity * detail.tax;
    }
    order.totalQuantity = Math.round(order.totalQuantity * 1e12) / 1e12;
    order.discount = order.isDiscountPercent ? Math.round(order.subTotal * order.discountPercent / 100) : Math.min(order.discount, order.subTotal);
    order.total = order.subTotal + order.subFee - order.discount;

    if (self.earningPointConfig.isApplyEarningPoint && order.customer != null && order.exchangedPoint > 0) {
        order.earningPointStatus = self.earningPointStatus.exchanged;
        order.exchangedMoney = self.calculateEarningMoneyByOrder(order, order.exchangedPoint);
        order.total = order.total - order.exchangedMoney;
        totalWithoutFee = Math.max(order.total - order.subFee, 0);
        order.convertPoint = self.calculateEarningPointByOrder(order, totalWithoutFee);
    }
    order.paymentBalance = Math.max(order.total - order.amountPaid, 0);
};

SunoSaleOrderCafe.prototype.calculatePriceOnItemByOrder = function (order, detail, isDiscountPercent, discount) {
    var self = this;
    detail.isDiscountPercent = isDiscountPercent;
    detail.unitPrice = self.calculatePricingPolicy(detail, order.customer);
    if (detail.isDiscountPercent) {
        detail.discountPercent = Math.min(discount, 100);
        detail.discount = Math.round(detail.unitPrice * detail.discountPercent / 100);
    }
    else {
        detail.discount = Math.min(discount, detail.unitPrice);
        detail.discountPercent = Math.round(detail.discount * 100 / detail.unitPrice);
    }
    detail.sellPrice = detail.unitPrice - detail.discount;
};


/*
    Description: Thêm hàng hóa vào đơn hàng.
*/
SunoSaleOrderCafe.prototype.addItem = function (item, callback) {
    var self = this;
    var result = Object.assign({}, SunoGlobal.result);
    if (!self.isValidUntrackedItemSale(item)) {
        result.isSuccess = false;
        result.description = 'Hệ thống được cấu hình yêu cầu nhập kho cho hàng đã hết trước khi bán. Xin vui lòng nhập kho cho [' + item.itemName + '] và thử lại.';
    }
    else {
        var detail = self.saleOrder.orderDetails.find(function (d) { return d.itemId == item.itemId; });
        if (detail === undefined) {
            var quantity = item.isSerial ? item.serials.length : 1;
            var unitPrice = self.calculatePricingPolicy(item, self.saleOrder.customer);
            item.quantity = quantity;
            item.unitPrice = unitPrice;
            item.sellPrice = unitPrice;
            detail = self.generateOrderDetail(item);
            if (SunoGlobal.printer.ordering == 'desc')
                self.saleOrder.orderDetails.unshift(detail);
            else
                self.saleOrder.orderDetails.push(detail);
        }
        else {
            var unitPrice = self.calculatePricingPolicy(item, self.saleOrder.customer);
            detail.quantity = item.isSerial ? item.serials.length : (detail.quantity + 1);
            detail.unitPrice = unitPrice;
            var discount = detail.isDiscountPercent ? detail.discountPercent : detail.discount;
            self.calculatePriceOnItem(detail, detail.isDiscountPercent, discount);
            detail.subTotal = detail.quantity * detail.sellPrice;
        }


        //Tính lại giảm giá cho đơn hàng.
        var discount = self.saleOrder.isDiscountPercent ? self.saleOrder.discountPercent : self.saleOrder.discount;
        self.calculateDiscount(self.saleOrder.isDiscountPercent, discount);

        //Tính lại tiền hàng cho đơn hàng.
        self.calculateTotal();

        //promotion
        if (SunoGlobal.saleSetting.isApplyPromotion && self.promotion.isCallApi) {
            var objItems = [{
                itemId: item.itemId,
                quantity: item.quantity,
                retailPrice: item.retailPrice
            }];
            var customerId = self.saleOrder.customer == null ? 0 : self.saleOrder.customer.customerId;
            self.getPromotionOnItem(objItems, self.storeId, customerId, self.saleOrder.saleDate)
            .then(function (body) {
                if (body != null && body.response != null && body.response.length > 0) {
                    for (var i = 0; i < body.response.length; i++) {
                        var item = {
                            itemId: body.response[i].itemID,
                            quantity: body.response[i].quantity,
                            retailPrice: body.response[i].retailPrice,
                            promotions: body.response[i].promotions
                        };
                        self.promotion.promotionOnItem.push(item);
                    }
                }
                self.calculatePromotion();
                self.applyPromotion();
                if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
            })
            .catch(function (error) {
                console.log('SunoSaleOrderCafe.prototype.addItem: getPromotionOnItem', error);
                self.calculatePromotion();
                self.applyPromotion();
                if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
            });
        }

        result.isSuccess = true;
        result.description = '';
        result.data = detail;
    }
    return result;
};
/*
    Description: Thêm hàng hóa vào đơn hàng có tách món.
*/
SunoSaleOrderCafe.prototype.addItemGroup = function (item, callback) {
    var self = this;
    var result = Object.assign({}, SunoGlobal.result);
    if (!self.isValidUntrackedItemSale(item)) {
        result.isSuccess = false;
        result.description = 'Hệ thống được cấu hình yêu cầu nhập kho cho hàng đã hết trước khi bán. Xin vui lòng nhập kho cho [' + item.itemName + '] và thử lại.';
    }
    else {
        var detail = self.saleOrder.orderDetails.find(function (d) { return d.detailID == item.detailID; });
        if (detail === undefined) {
            var quantity = item.isSerial ? item.serials.length : 1;
            var unitPrice = self.calculatePricingPolicy(item, self.saleOrder.customer);
            item.quantity = quantity;
            item.unitPrice = unitPrice;
            item.sellPrice = unitPrice;
            detail = self.generateOrderDetail(item);
            if (item.isChild) {
                var parentItem = self.saleOrder.orderDetails.find(function (d) { return d.detailID == item.parentID; });
                if (parentItem !== undefined) {
                    var childItem = self.saleOrder.orderDetails.find(function (d) { return d.detailID == item.detailID; });
                    if (childItem) {
                        childItem.quantity++;
                    }
                    else {
                        var parentIndex = self.saleOrder.orderDetails.indexOf(parentItem);
                        self.saleOrder.orderDetails.splice(parentIndex + 1, 0, detail);
                    }
                }
            }
            else {
                if (SunoGlobal.printer.ordering == 'desc')
                    self.saleOrder.orderDetails.unshift(detail);
                else
                    self.saleOrder.orderDetails.push(detail);
            }
        }
        else {
            var unitPrice = self.calculatePricingPolicy(item, self.saleOrder.customer);
            detail.quantity = item.isSerial ? item.serials.length : (detail.quantity + 1);
            detail.unitPrice = unitPrice;
            var discount = detail.isDiscountPercent ? detail.discountPercent : detail.discount;
            self.calculatePriceOnItem(detail, detail.isDiscountPercent, discount);
            detail.subTotal = detail.quantity * detail.sellPrice;
        }

        //Tính lại giảm giá cho đơn hàng.
        var discount = self.saleOrder.isDiscountPercent ? self.saleOrder.discountPercent : self.saleOrder.discount;
        self.calculateDiscount(self.saleOrder.isDiscountPercent, discount);

        //Tính lại tiền hàng cho đơn hàng.
        self.calculateTotal();

        //promotion
        if (SunoGlobal.saleSetting.isApplyPromotion && self.promotion.isCallApi) {
            var objItems = [{
                itemId: item.itemId,
                quantity: item.quantity,
                retailPrice: item.retailPrice
            }];
            var customerId = self.saleOrder.customer == null ? 0 : self.saleOrder.customer.customerId;
            self.getPromotionOnItem(objItems, self.storeId, customerId, self.saleOrder.saleDate)
            .then(function (body) {
                if (body != null && body.response != null && body.response.length > 0) {
                    for (var i = 0; i < body.response.length; i++) {
                        var item = {
                            itemId: body.response[i].itemID,
                            quantity: body.response[i].quantity,
                            retailPrice: body.response[i].retailPrice,
                            promotions: body.response[i].promotions
                        };
                        self.promotion.promotionOnItem.push(item);
                    }
                }
                self.calculatePromotion();
                self.applyPromotion();
                if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
            })
            .catch(function (error) {
                console.log('SunoSaleOrderCafe.prototype.addItemGroup: getPromotionOnItem', error);
                self.calculatePromotion();
                self.applyPromotion();
                if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
            });
        }

        result.isSuccess = true;
        result.description = '';
        result.data = detail;
    }
    return result;
};
/*
    Description: Xóa hàng hóa khỏi đơn hàng.
*/
SunoSaleOrderCafe.prototype.removeItem = function (item) {
    var self = this;
    var index = self.saleOrder.orderDetails.findIndex(function (d) { return d.itemId == item.itemId; });
    if (index > -1) {
        self.saleOrder.orderDetails.splice(index, 1);

        if (SunoGlobal.saleSetting.isApplyPromotion && self.saleOrder.saleTypeId != self.saleType.online) {
            if (self.promotion.promotionOnItem.length > 0) {
                var promoOnItem = self.promotion.promotionOnItem.filter(function (p) { return p.itemId == item.itemId; });
                if (promoOnItem.length > 0) {
                    for (var i = 0; i < promoOnItem.length; i++) {
                        var promo = promoOnItem[i];
                        var index = self.promotion.promotionOnItem.indexOf(promo);
                        if (index > -1) {
                            self.promotion.promotionOnItem.splice(index, 1);
                        }
                    }
                }
            }
            if (self.saleOrder.orderDetails.length > 0) {
                self.calculatePromotion();
                self.applyPromotion();
            }
            else {
                self.cancelPromotion();
            }
        }

        //Tính lại giảm giá cho đơn hàng.
        var discount = self.saleOrder.isDiscountPercent ? self.saleOrder.discountPercent : self.saleOrder.discount;
        self.calculateDiscount(self.saleOrder.isDiscountPercent, discount);

        //Tính lại tiền hàng cho đơn hàng.
        self.calculateTotal();
    }
};

/*
    Description: Xóa hàng hóa tách món khỏi đơn hàng.
*/
SunoSaleOrderCafe.prototype.removeItemGroup = function (item) {
    var self = this;
    var index = self.saleOrder.orderDetails.findIndex(function (d) { return d.detailID == item.detailID; });
    if (index > -1) {
        self.saleOrder.orderDetails.splice(index, 1);

        if (SunoGlobal.saleSetting.isApplyPromotion && self.saleOrder.saleTypeId != self.saleType.online) {
            if (self.promotion.promotionOnItem.length > 0) {
                var promoOnItem = self.promotion.promotionOnItem.filter(function (p) { return p.itemId == item.itemId; });
                if (promoOnItem.length > 0) {
                    for (var i = 0; i < promoOnItem.length; i++) {
                        var promo = promoOnItem[i];
                        var index = self.promotion.promotionOnItem.indexOf(promo);
                        if (index > -1) {
                            self.promotion.promotionOnItem.splice(index, 1);
                        }
                    }
                }
            }
            if (self.saleOrder.orderDetails.length > 0) {
                self.calculatePromotion();
                self.applyPromotion();
            }
            else {
                self.cancelPromotion();
            }
        }

        //Tính lại giảm giá cho đơn hàng.
        var discount = self.saleOrder.isDiscountPercent ? self.saleOrder.discountPercent : self.saleOrder.discount;
        self.calculateDiscount(self.saleOrder.isDiscountPercent, discount);

        //Tính lại tiền hàng cho đơn hàng.
        self.calculateTotal();
    }
};

/*
    Description: Thay đổi số lượng hàng hóa.
*/
SunoSaleOrderCafe.prototype.changeQuantityOnItem = function (item) {
    var self = this;
    var detail = self.saleOrder.orderDetails.find(function (d) { return d.itemId == item.itemId; });
    if (detail !== undefined) {
        detail.quantity = item.quantity;
        detail.subTotal = detail.quantity * detail.sellPrice;
        if (SunoGlobal.saleSetting.isApplyPromotion && self.saleOrder.saleTypeId != self.saleType.online) {
            self.calculatePromotion();
            self.applyPromotion();
        }

        //Tính lại giảm giá cho đơn hàng.
        var discount = self.saleOrder.isDiscountPercent ? self.saleOrder.discountPercent : self.saleOrder.discount;
        self.calculateDiscount(self.saleOrder.isDiscountPercent, discount);

        //Tính lại tiền hàng cho đơn hàng.
        self.calculateTotal();
    }
};
/*
    Description: Thay đổi số lượng hàng hóa tách món.
*/
SunoSaleOrderCafe.prototype.changeQuantityOnItemGroup = function (item) {
    var self = this;
    var detail = self.saleOrder.orderDetails.find(function (d) { return d.detailID == item.detailID; });
    if (detail !== undefined) {
        detail.quantity = item.quantity;
        detail.subTotal = detail.quantity * detail.sellPrice;
        if (SunoGlobal.saleSetting.isApplyPromotion && self.saleOrder.saleTypeId != self.saleType.online) {
            self.calculatePromotion();
            self.applyPromotion();
        }

        //Tính lại giảm giá cho đơn hàng.
        var discount = self.saleOrder.isDiscountPercent ? self.saleOrder.discountPercent : self.saleOrder.discount;
        self.calculateDiscount(self.saleOrder.isDiscountPercent, discount);

        //Tính lại tiền hàng cho đơn hàng.
        self.calculateTotal();
    }
};
/*
    Description: Đổi cửa hàng.
*/
SunoSaleOrderCafe.prototype.changeStore = function (storeId, callback) {
    var self = this;
    self.storeId = storeId;
    if (SunoGlobal.saleSetting.isApplyPromotion
        && self.saleOrder.saleTypeId != self.saleType.online
        && self.saleOrder.orderDetails.length > 0
        && self.promotion.isCallApi) {

        var items = [];
        for (var i = 0; i < self.saleOrder.orderDetails.length; i++) {
            var detail = self.saleOrder.orderDetails[i];
            items.push({
                itemId: detail.itemId,
                quantity: detail.quantity,
                retailPrice: detail.retailPrice
            });
        }
        var customerId = self.saleOrder.customer == null ? 0 : self.saleOrder.customer.customerId;
        self.getPromotionOnItem(items, self.storeId, customerId, self.saleOrder.saleDate)
        .then(function (body) {
            self.promotion.promotionOnItem = [];
            if (body != null && body.response != null && body.response.length > 0) {
                for (var i = 0; i < body.response.length; i++) {
                    var item = {
                        itemId: body.response[i].itemID,
                        quantity: body.response[i].quantity,
                        retailPrice: body.response[i].retailPrice,
                        promotions: body.response[i].promotions
                    };
                    self.promotion.promotionOnItem.push(item);
                }
                self.calculatePromotion();
                self.applyPromotion();
            }
            if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
        })
        .catch(function (error) {
            console.log('SunoSaleOrderCafe.prototype.changeStore', error);
            if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
        });
    }
};

/*
    Description: Đổi cửa hàng để tính lại CTKM cho đơn hàng.
*/
SunoSaleOrderCafe.prototype.changeStoreByOrder = function (order, storeId, callback) {
    var self = this;
    self.storeId = storeId;
    var index = self.saleOrders.findIndex(function(o) { return o.uid == order.uid;});
    var promotion = self.promotions[index];

    if (SunoGlobal.saleSetting.isApplyPromotion
        && order.saleTypeId != self.saleType.online
        && order.orderDetails.length > 0
        && promotion.isCallApi) {

        var items = [];
        for (var i = 0; i < order.orderDetails.length; i++) {
            var detail = order.orderDetails[i];
            items.push({
                itemId: detail.itemId,
                quantity: detail.quantity,
                retailPrice: detail.retailPrice
            });
        }
        var customerId = order.customer == null ? 0 : order.customer.customerId;
        self.getPromotionOnItem(items, self.storeId, customerId, order.saleDate)
        .then(function (body) {
            promotion.promotionOnItem = [];
            if (body != null && body.response != null && body.response.length > 0) {
                for (var i = 0; i < body.response.length; i++) {
                    var item = {
                        itemId: body.response[i].itemID,
                        quantity: body.response[i].quantity,
                        retailPrice: body.response[i].retailPrice,
                        promotions: body.response[i].promotions
                    };
                    promotion.promotionOnItem.push(item);
                }
            }
            self.calculatePromotionByOrder(order, promotion);
            self.applyPromotionByOrder(order);
            if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
        })
        .catch(function (error) {
            console.log('SunoSaleOrderCafe.prototype.changeStoreByOrder', error);
            if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
        });
    }
};

/*
    Description: Lấy danh sách chương trình khuyến mãi trên hàng hóa.
*/
SunoSaleOrderCafe.prototype.getPromotionOnItem = function (items, storeId, customerId, saleDate) {
    var self = this;
    var data = { storeId: storeId, customerId: customerId, saleDate: saleDate, items: items };
    return self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.promotion.getPromotionOnItemUrl, 'POST', data);
};

/*
    Description: Thêm mới khách hàng vào đơn hàng.
*/
SunoSaleOrderCafe.prototype.addCustomer = function (customer, callback) {
    var self = this;
    //self.constructor.uber.addCustomer(customer);
    self.saleOrder.customer = customer;
    for (var i = 0; i < self.saleOrder.orderDetails.length; i++) {
        var detail = self.saleOrder.orderDetails[i];
        detail.unitPrice = self.calculatePricingPolicy(detail, self.saleOrder.customer);
        detail.sellPrice = detail.unitPrice - detail.discount;
    }

    //Tính lại giảm giá cho đơn hàng.
    var discount = self.saleOrder.isDiscountPercent ? self.saleOrder.discountPercent : self.saleOrder.discount;
    self.calculateDiscount(self.saleOrder.isDiscountPercent, discount);

    //Tính lại tiền hàng cho đơn hàng.
    self.calculateTotal();

    //Tính lại CTKM
    if (SunoGlobal.saleSetting.isApplyPromotion) {
        if (customer.type == self.customer.customerType.retail
            && self.saleOrder.saleTypeId != self.saleType.online
            && self.saleOrder.orderDetails.length > 0
            && self.promotion.isCallApi) {
            var items = [];
            for (var i = 0; i < self.saleOrder.orderDetails.length; i++) {
                var detail = self.saleOrder.orderDetails[i];
                items.push({
                    itemId: detail.itemId,
                    quantity: detail.quantity,
                    retailPrice: detail.retailPrice
                });
            }
            var customerId = self.saleOrder.customer == null ? 0 : self.saleOrder.customer.customerId;
            self.getPromotionOnItem(items, self.storeId, customerId, self.saleOrder.saleDate)
            .then(function (body) {
                self.promotion.promotionOnItem = [];
                if (body != null && body.response != null && body.response.length > 0) {
                    for (var i = 0; i < body.response.length; i++) {
                        var item = {
                            itemId: body.response[i].itemID,
                            quantity: body.response[i].quantity,
                            retailPrice: body.response[i].retailPrice,
                            promotions: body.response[i].promotions
                        };
                        self.promotion.promotionOnItem.push(item);
                    }
                }
                self.calculatePromotion();
                self.applyPromotion();
                if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
            })
            .catch(function (error) {
                console.log('SunoSaleOrderCafe.prototype.addCustomer', error);
                if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
            });
        }
        else {
            self.cancelPromotion();
            self.promotion.promotionOnItem = [];
        }
    }

    //Lấy thông tin tích điểm
    if (self.earningPointConfig.isApplyEarningPoint
        && self.earningPointConfig.convertPoint > 0
        && self.earningPointConfig.convertMoney > 0) {
        self.customer.getCustomerPoint(self.saleOrder.customer.customerId).then(function (point) {
            self.saleOrder.customer.remainPoint = point;
            self.saleOrder.convertMoney = self.earningPointConfig.convertMoney;
            self.calculateTotal();
            if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
        }).catch(function (error) {
            console.log('SunoSaleOrderCafe.prototype.addCustomer', error);
        });
    }

};

/*
    Description: Xóa khách hàng khỏi đơn hàng.
*/
SunoSaleOrderCafe.prototype.removeCustomer = function (callback) {
    var self = this;
    self.saleOrder.customer = null;
    for (var i = 0; i < self.saleOrder.orderDetails.length; i++) {
        var detail = self.saleOrder.orderDetails[i];
        detail.unitPrice = self.calculatePricingPolicy(detail, self.saleOrder.customer);
        detail.sellPrice = detail.unitPrice - detail.discount;
    }

    //Tính lại giảm giá cho đơn hàng.
    var discount = self.saleOrder.isDiscountPercent ? self.saleOrder.discountPercent : self.saleOrder.discount;
    self.calculateDiscount(self.saleOrder.isDiscountPercent, discount);

    //Tính lại tiền hàng cho đơn hàng.
    self.calculateTotal();
    if (SunoGlobal.saleSetting.isApplyPromotion) {
        if (self.saleOrder.saleTypeId != self.saleType.online
            && self.saleOrder.orderDetails.length > 0
            && self.promotion.isCallApi) {
            var items = [];
            for (var i = 0; i < self.saleOrder.orderDetails.length; i++) {
                var detail = self.saleOrder.orderDetails[i];
                items.push({
                    itemId: detail.itemId,
                    quantity: detail.quantity,
                    retailPrice: detail.retailPrice
                });
            }
            var customerId = 0;
            self.getPromotionOnItem(items, self.storeId, customerId, self.saleOrder.saleDate)
            .then(function (body) {
                self.promotion.promotionOnItem = [];
                if (body != null && body.response != null && body.response.length > 0) {
                    for (var i = 0; i < body.response.length; i++) {
                        var item = {
                            itemId: body.response[i].itemID,
                            quantity: body.response[i].quantity,
                            retailPrice: body.response[i].retailPrice,
                            promotions: body.response[i].promotions
                        };
                        self.promotion.promotionOnItem.push(item);
                    }
                }
                self.calculatePromotion();
                self.applyPromotion();
                if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
            })
            .catch(function (error) {
                console.log('SunoSaleOrderCafe.prototype.addCustomer', error);
                if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
            });
        }
        else {
            self.cancelPromotion();
            self.promotion.promotionOnItem = [];
        }
    }
    
    //Reset earning point
    self.saleOrder.earningPointStatus = self.earningPointStatus.notExchangabled;
    self.saleOrder.convertPoint = 0;
    self.saleOrder.convertMoney = 0;
    self.saleOrder.exchangedPoint = 0;
    self.saleOrder.exchangedMoney = 0;
};

/* 
    Description: Tính chương trình khuyến mãi tối ưu cho khách hàng.
*/
SunoSaleOrderCafe.prototype.calculatePromotion = function () {
    var self = this;
    var maxDiscountOnBill = 0, maxDiscountOnItem = 0, customerId = self.saleOrder.customer == null ? 0 : self.saleOrder.customer.customerId;
    var getSubTotal = function (details) {
        var subTotal = 0;
        for (var i = 0; i < details.length; i++) {
            var detail = details[i];
            subTotal += detail.quantity * detail.retailPrice;
        }
        return subTotal;
    };
    var getMaxDiscount = function (promotions) {
        var result = 0;
        if (promotions.length > 0) {
            var discounts = promotions.map(function (p) { return p.discountValue; });
            result = Math.max.apply(null, discounts);
        }
        return result;
    };
    var getMaxDiscountOnItem = function(promotions) {
        var result = 0;
        if (promotions.length > 0) {
            var promos = promotions.reduce(function(arr, item) {
                var isExist = arr[item.itemId];
                if(!isExist) {
                    arr[item.itemId] = [];
                    arr[item.itemId].push(item.discountValue * item.quantity);  
                }
                else {
                    arr[item.itemId].push(item.discountValue * item.quantity);
                }
                return arr;
            }, []);
            promos.forEach(function(p){ result += Math.max.apply(null, p); });
        }
        return result;    
    };
    var calculatePromotionOnItem = function (promotions, orderDetails) {
        for (var i = 0; i < orderDetails.length; i++) {
            var detail = orderDetails[i];
            var promos = promotions.filter(function (p) { return p.itemId == detail.itemId; });
            if (promos.length > 0) {
                var maxDiscount = getMaxDiscount(promos);
                var promo = promos.find(function (p) { return p.discountValue == maxDiscount; });
                if (promo !== undefined) {
                    detail.promotionId = promo.promotionId;
                    detail.promotionOnItemSelected = promo;
                }
            }
        }
    };

    var calculatePromotionOnBill = function (promotions, saleOrder) {
        var maxDiscount = getMaxDiscount(promotions);
        var promo = promotions.find(function (p) { return p.discountValue == maxDiscount; });
        if (promo !== undefined) {
            promo.isSelected = true;
            saleOrder.promotionOnBillSelected = promo;
        }
    };
    
    //#region CTKM trên đơn hàng
    var subTotal = getSubTotal(self.saleOrder.orderDetails);
    //Lấy danh sách CTKM trên đơn hàng
    self.saleOrder.promotionOnBill = [];
    for (var i = 0; i < self.promotion.promotionOnBill.length; i++) {
        var promoOnBill = self.promotion.promotionOnBill[i];
        if ((promoOnBill.storeIds.indexOf(0) > -1 || promoOnBill.storeIds.indexOf(self.storeId) > -1)
            && (promoOnBill.customerIds.indexOf(0) > -1 || promoOnBill.customerIds.indexOf(customerId) > -1)
            && subTotal > 0) {
            var details = promoOnBill.detail.filter(function (d) {
                return d.appliedAmount <= subTotal;
            });
            if (details.length > 0) {
                var appliedAmounts = details.map(function (d) { return d.appliedAmount; });
                var maxAppliedAmount = Math.max.apply(null, appliedAmounts);
                var detail = details.find(function (d) { return d.appliedAmount == maxAppliedAmount; });
                if (detail !== undefined) {
                    self.saleOrder.promotionOnBill.push({
                        promotionId: promoOnBill.promotionID,
                        promotionName: promoOnBill.promotionName,
                        promotionCode: promoOnBill.promotionCode,
                        promotionType: promoOnBill.promotionType,
                        isCodeRequired: promoOnBill.isCodeRequired,
                        isPercent: detail.isPercent,
                        discountPercent: detail.discountPercent,
                        discountPrice: detail.discountPrice,
                        discountValue: detail.isPercent ? Math.round(detail.discountPercent * subTotal / 100) : detail.discountPrice,
                        isSelected: false,
                        itemId: 0,
                        quantity: 0
                    });
                }
            }
        }
    }
    //#endregion

    //#region CTKM trên hàng hóa
    self.saleOrder.promotionOnItem = [];
    for (var i = 0; i < self.promotion.promotionOnItem.length; i++) {
        var promoOnItem = self.promotion.promotionOnItem[i];
        var detail = self.saleOrder.orderDetails.find(function (d) {
            return d.itemId == promoOnItem.itemId;
        });
        var quantityOfItem = detail !== undefined ? detail.quantity : 1;
        var promotions = promoOnItem.promotions.filter(function (p) {
            return p.minQuantity <= quantityOfItem;
        });
        if (promotions.length > 0) {
            promotions.forEach(function (p) {
                self.saleOrder.promotionOnItem.push({
                    promotionId: p.promotionID,
                    promotionName: p.promotionName,
                    promotionCode: p.promotionCode,
                    promotionType: p.promotionType,
                    isCodeRequired: p.isCodeRequired,
                    isPercent: p.isPercent,
                    discountPercent: p.discountPercent,
                    discountPrice: p.discountPrice,
                    discountValue: p.discountValue,
                    isSelected: false,
                    itemId: promoOnItem.itemId,
                    quantity: quantityOfItem
                });
            });
        }
    }
    //#endregion

    //#region optimize promotion
    //self.cancelPromotion();
    if (self.saleOrder.promotionOnBill.length > 0 && self.saleOrder.promotionOnItem.length > 0) {
        //Reset promotion
        self.cancelPromotion();
        self.saleOrder.isPromotion = true;
        var promosWithoutCode = self.saleOrder.promotionOnBill.filter(function (p) {
            return p.isCodeRequired == false;
        });
        maxDiscountOnBill = getMaxDiscount(promosWithoutCode);
        maxDiscountOnItem = getMaxDiscountOnItem(self.saleOrder.promotionOnItem);
        if (maxDiscountOnBill >= maxDiscountOnItem) {
            self.saleOrder.promotionType = self.promotionType.onBill;
            calculatePromotionOnBill(promosWithoutCode, self.saleOrder);
        }
        else {
            self.saleOrder.promotionType = self.promotionType.onItem;
            calculatePromotionOnItem(self.saleOrder.promotionOnItem, self.saleOrder.orderDetails);
        }
    }
    else if (self.saleOrder.promotionOnBill.length > 0) {
        //Reset promotion
        self.cancelPromotion();
        self.saleOrder.isPromotion = true;
        var promosWithoutCode = self.saleOrder.promotionOnBill.filter(function (p) {
            return p.isCodeRequired == false;
        });
        if (promosWithoutCode.length > 0) {
            self.saleOrder.promotionType = self.promotionType.onBill;
            calculatePromotionOnBill(promosWithoutCode, self.saleOrder);
        }
        else {
            self.saleOrder.promotionType = self.promotionType.onCode;
            self.saleOrder.promotionOnBillSelected = null;
        }
    }
    else if (self.saleOrder.promotionOnItem.length > 0) {
        //Reset promotion
        self.cancelPromotion();
        self.saleOrder.isPromotion = true;
        self.saleOrder.promotionType = self.promotionType.onItem;
        calculatePromotionOnItem(self.saleOrder.promotionOnItem, self.saleOrder.orderDetails);
    }
    else {
        if (self.saleOrder.isPromotion) {
            self.cancelPromotion();
        }
        self.saleOrder.isPromotion = false;
        self.saleOrder.promotionType = self.promotionType.None;
    }
    //#endregion
};

/* 
    Description: Tính chương trình khuyến mãi tối ưu theo đơn hàng.
*/
SunoSaleOrderCafe.prototype.calculatePromotionByOrder = function (order, promotion) {
    var self = this;
    var maxDiscountOnBill = 0, maxDiscountOnItem = 0, customerId = order.customer == null ? 0 : order.customer.customerId;
    var getSubTotal = function (details) {
        var subTotal = 0;
        for (var i = 0; i < details.length; i++) {
            var detail = details[i];
            subTotal += detail.quantity * detail.retailPrice;
        }
        return subTotal;
    };
    var getMaxDiscount = function (promotions) {
        var result = 0;
        if (promotions.length > 0) {
            var discounts = promotions.map(function (p) { return p.discountValue; });
            result = Math.max.apply(null, discounts);
        }
        return result;
    };
    var getMaxDiscountOnItem = function(promotions) {
        var result = 0;
        if (promotions.length > 0) {
            var promos = promotions.reduce(function(arr, item) {
                var isExist = arr[item.itemId];
                if(!isExist) {
                    arr[item.itemId] = [];
                    arr[item.itemId].push(item.discountValue * item.quantity);
                }
                else {
                    arr[item.itemId].push(item.discountValue * item.quantity);
                }
                return arr;
            }, []);
            promos.forEach(function(p){ result += Math.max.apply(null, p); });
        }
        return result;    
    };
    var calculatePromotionOnItem = function (promotions, orderDetails) {
        for (var i = 0; i < orderDetails.length; i++) {
            var detail = orderDetails[i];
            var promos = promotions.filter(function (p) { return p.itemId == detail.itemId; });
            if (promos.length > 0) {
                var maxDiscount = getMaxDiscount(promos);
                var promo = promos.find(function (p) { return p.discountValue == maxDiscount; });
                if (promo !== undefined) {
                    detail.promotionId = promo.promotionId;
                    detail.promotionOnItemSelected = promo;
                }
            }
        }
    };

    var calculatePromotionOnBill = function (promotions, saleOrder) {
        var maxDiscount = getMaxDiscount(promotions);
        var promo = promotions.find(function (p) { return p.discountValue == maxDiscount; });
        if (promo !== undefined) {
            promo.isSelected = true;
            saleOrder.promotionOnBillSelected = promo;
        }
    };

    //#region CTKM trên đơn hàng
    var subTotal = getSubTotal(order.orderDetails);
    //Lấy danh sách CTKM trên đơn hàng
    order.promotionOnBill = [];
    for (var i = 0; i < promotion.promotionOnBill.length; i++) {
        var promoOnBill = promotion.promotionOnBill[i];
        if ((promoOnBill.storeIds.indexOf(0) > -1 || promoOnBill.storeIds.indexOf(self.storeId) > -1)
            && (promoOnBill.customerIds.indexOf(0) > -1 || promoOnBill.customerIds.indexOf(customerId) > -1)
            && subTotal > 0) {
            var details = promoOnBill.detail.filter(function (d) {
                return d.appliedAmount <= subTotal;
            });
            if (details.length > 0) {
                var appliedAmounts = details.map(function (d) { return d.appliedAmount; });
                var maxAppliedAmount = Math.max.apply(null, appliedAmounts);
                var detail = details.find(function (d) { return d.appliedAmount == maxAppliedAmount; });
                if (detail !== undefined) {
                    order.promotionOnBill.push({
                        promotionId: promoOnBill.promotionID,
                        promotionName: promoOnBill.promotionName,
                        promotionCode: promoOnBill.promotionCode,
                        promotionType: promoOnBill.promotionType,
                        isCodeRequired: promoOnBill.isCodeRequired,
                        isPercent: detail.isPercent,
                        discountPercent: detail.discountPercent,
                        discountPrice: detail.discountPrice,
                        discountValue: detail.isPercent ? Math.round(detail.discountPercent * subTotal / 100) : detail.discountPrice,
                        isSelected: false,
                        itemId: 0,
                        quantity: 0
                    });
                }
            }
        }
    }
    //#endregion

    //#region CTKM trên hàng hóa
    order.promotionOnItem = [];
    for (var i = 0; i < promotion.promotionOnItem.length; i++) {
        var promoOnItem = promotion.promotionOnItem[i];
        var detail = order.orderDetails.find(function (d) {
            return d.itemId == promoOnItem.itemId;
        });
        var quantityOfItem = detail !== undefined ? detail.quantity : 1;
        var promotions = promoOnItem.promotions.filter(function (p) {
            return p.minQuantity <= quantityOfItem;
        });
        if (promotions.length > 0) {
            promotions.forEach(function (p) {
                order.promotionOnItem.push({
                    promotionId: p.promotionID,
                    promotionName: p.promotionName,
                    promotionCode: p.promotionCode,
                    promotionType: p.promotionType,
                    isCodeRequired: p.isCodeRequired,
                    isPercent: p.isPercent,
                    discountPercent: p.discountPercent,
                    discountPrice: p.discountPrice,
                    discountValue: p.discountValue,
                    isSelected: false,
                    itemId: promoOnItem.itemId,
                    quantity: quantityOfItem
                });
            });
        }
    }
    //#endregion

    //#region optimize promotion
    //self.cancelPromotionByOrder(order);
    if (order.promotionOnBill.length > 0 && order.promotionOnItem.length > 0) {
        //Reset promotion
        self.cancelPromotionByOrder(order);
        order.isPromotion = true;
        var promosWithoutCode = order.promotionOnBill.filter(function (p) {
            return p.isCodeRequired == false;
        });
        maxDiscountOnBill = getMaxDiscount(promosWithoutCode);
        maxDiscountOnItem = getMaxDiscountOnItem(order.promotionOnItem);
        if (maxDiscountOnBill >= maxDiscountOnItem) {
            order.promotionType = self.promotionType.onBill;
            calculatePromotionOnBill(promosWithoutCode, order);
        }
        else {
            order.promotionType = self.promotionType.onItem;
            calculatePromotionOnItem(order.promotionOnItem, order.orderDetails);
        }
    }
    else if (order.promotionOnBill.length > 0) {
        self.cancelPromotionByOrder(order);
        order.isPromotion = true;
        var promosWithoutCode = order.promotionOnBill.filter(function (p) {
            return p.isCodeRequired == false;
        });
        if (promosWithoutCode.length > 0) {
            order.promotionType = self.promotionType.onBill;
            calculatePromotionOnBill(promosWithoutCode, order);
        }
        else {
            order.promotionType = self.promotionType.onCode;
            order.promotionOnBillSelected = null;
        }
    }
    else if (order.promotionOnItem.length > 0) {
        self.cancelPromotionByOrder(order);        
        order.isPromotion = true;
        order.promotionType = self.promotionType.onItem;
        calculatePromotionOnItem(order.promotionOnItem, order.orderDetails);
    }
    else {
        if (order.isPromotion) {
            self.cancelPromotionByOrder(order);        
        }
        order.isPromotion = false;
        order.promotionType = self.promotionType.None;
    }
    //#endregion
};

/* 
    Description: Hủy chương trình khuyến mãi trên đơn hàng.
*/
SunoSaleOrderCafe.prototype.cancelPromotion = function () {
    var self = this;
    self.saleOrder.totalQuantity = 0;
    self.saleOrder.subTotal = 0;
    self.saleOrder.total = 0;
    self.saleOrder.tax = 0;
    for (var i = 0; i < self.saleOrder.orderDetails.length; i++) {
        var detail = self.saleOrder.orderDetails[i];
        detail.unitPrice = self.calculatePricingPolicy(detail, self.saleOrder.customer);
        detail.isDiscountPercent = false;
        detail.discount = 0;
        detail.discountPercent = 0;
        detail.sellPrice = detail.unitPrice;
        detail.subTotal = detail.quantity * detail.sellPrice;
        detail.promotionId = 0;
        detail.promotionOnItemSelected = null;

        self.saleOrder.totalQuantity += detail.quantity;
        self.saleOrder.subTotal += detail.subTotal;
        self.saleOrder.tax += detail.quantity * detail.tax;
    }
    self.saleOrder.totalQuantity = Math.round(self.saleOrder.totalQuantity * 1e12) / 1e12;
    self.saleOrder.isDiscountPercent = false;
    self.saleOrder.discount = 0;
    self.saleOrder.discountPercent = 0;
    self.saleOrder.total = self.saleOrder.subTotal + self.saleOrder.subFee - self.saleOrder.discount;
    self.saleOrder.paymentBalance = Math.max(self.saleOrder.total - self.saleOrder.amountPaid, 0);

    self.saleOrder.promotionId = 0;
    self.saleOrder.isPromotion = false;
    self.saleOrder.promotionOnBillSelected = null;
    self.saleOrder.promotionType = self.promotionType.None;
};

/* 
    Description: Hủy chương trình khuyến mãi trên đơn hàng.
*/
SunoSaleOrderCafe.prototype.cancelPromotionByOrder = function (order) {
    var self = this;
    order.totalQuantity = 0;
    order.subTotal = 0;
    order.total = 0;
    order.tax = 0;
    for (var i = 0; i < order.orderDetails.length; i++) {
        var detail = order.orderDetails[i];
        detail.unitPrice = self.calculatePricingPolicy(detail, order.customer);
        detail.isDiscountPercent = false;
        detail.discount = 0;
        detail.discountPercent = 0;
        detail.sellPrice = detail.unitPrice;
        detail.subTotal = detail.quantity * detail.sellPrice;
        detail.promotionId = 0;
        detail.promotionOnItemSelected = null;

        order.totalQuantity += detail.quantity;
        order.subTotal += detail.subTotal;
        order.tax += detail.quantity * detail.tax;
    }
    order.totalQuantity = Math.round(order.totalQuantity * 1e12) / 1e12;
    order.isDiscountPercent = false;
    order.discount = 0;
    order.discountPercent = 0;
    order.total = order.subTotal + order.subFee - order.discount;
    order.paymentBalance = Math.max(order.total - order.amountPaid, 0);

    order.promotionId = 0;
    order.isPromotion = false;
    order.promotionOnBillSelected = null;
    order.promotionType = self.promotionType.None;
};

/* 
    Description: Thực hiện giảm giá chương trình khuyến mãi.
*/
SunoSaleOrderCafe.prototype.applyPromotion = function () {
    var self = this;
    if (self.saleOrder.isPromotion) {
        if (self.saleOrder.promotionType == self.promotionType.onBill) {
            if (self.saleOrder.promotionOnBillSelected != null) {
                self.saleOrder.promotionId = self.saleOrder.promotionOnBillSelected.promotionId;
                self.saleOrder.isDiscountPercent = self.saleOrder.promotionOnBillSelected.isPercent;
                self.saleOrder.discountPercent = self.saleOrder.promotionOnBillSelected.discountPercent;
                self.saleOrder.discount = self.saleOrder.promotionOnBillSelected.discountPrice;
                //self.saleOrder.discount = self.saleOrder.promotionOnBillSelected.discountValue;
                self.saleOrder.total = self.saleOrder.subTotal + self.saleOrder.subFee - self.saleOrder.discount;
                var totalWithoutFee = 0;
                //Đổi điểm
                if (self.earningPointConfig.isApplyEarningPoint && self.saleOrder.customer != null && self.saleOrder.exchangedPoint >= 0) {
                    self.saleOrder.exchangedMoney = self.calculateEarningMoney(self.saleOrder.exchangedPoint);
                    self.saleOrder.total = self.saleOrder.total - self.saleOrder.exchangedMoney;
                }

                //Tích điểm
                if (self.earningPointConfig.isApplyEarningPoint && self.saleOrder.customer != null) {
                    self.saleOrder.earningPointStatus = self.earningPointStatus.exchanged;
                    totalWithoutFee = Math.max(self.saleOrder.total - self.saleOrder.subFee, 0);
                    self.saleOrder.convertPoint = self.calculateEarningPoint(totalWithoutFee);
                }
                self.saleOrder.paymentBalance = Math.max(self.saleOrder.total - self.saleOrder.amountPaid, 0);
            }
        }
        else if (self.saleOrder.promotionType == self.promotionType.onItem) {
            for (var i = 0; i < self.saleOrder.orderDetails.length; i++) {
                var detail = self.saleOrder.orderDetails[i];
                if (detail.promotionOnItemSelected != null) {
                    detail.promotionId = detail.promotionOnItemSelected.promotionId;
                    var discount = detail.promotionOnItemSelected.isPercent ? detail.promotionOnItemSelected.discountPercent : detail.promotionOnItemSelected.discountPrice;
                    self.calculatePriceOnItem(detail, detail.promotionOnItemSelected.isPercent, discount);
                }
                else {
                    detail.promotionId = 0;
                    detail.isDiscountPercent = false;
                    detail.discount = 0;
                    detail.discountPercent = 0;
                    detail.sellPrice = detail.unitPrice - detail.discount;
                }
            }
        }
    }
    self.calculateTotal();
};

/* 
    Description: Thực hiện giảm giá chương trình khuyến mãi.
*/
SunoSaleOrderCafe.prototype.applyPromotionByOrder = function (order) {
    var self = this;
    if (order.isPromotion) {
        if (order.promotionType == self.promotionType.onBill) {
            if (order.promotionOnBillSelected != null) {
                order.promotionId = order.promotionOnBillSelected.promotionId;
                order.isDiscountPercent = order.promotionOnBillSelected.isPercent;
                order.discountPercent = order.promotionOnBillSelected.discountPercent;
                order.discount = order.promotionOnBillSelected.discountPrice;
                //order.discount = order.promotionOnBillSelected.discountValue;
                order.total = order.subTotal + order.subFee - order.discount;
                var totalWithoutFee = 0;
                //Đổi điểm
                if (self.earningPointConfig.isApplyEarningPoint && order.customer != null && order.exchangedPoint >= 0) {
                    order.exchangedMoney = self.calculateEarningMoneyByOrder(order, order.exchangedPoint);
                    order.total = order.total - order.exchangedMoney;
                }

                //Tích điểm
                if (self.earningPointConfig.isApplyEarningPoint && order.customer != null) {
                    order.earningPointStatus = self.earningPointStatus.exchanged;
                    totalWithoutFee = Math.max(order.total - order.subFee, 0);
                    order.convertPoint = self.calculateEarningPointByOrder(order, totalWithoutFee);
                }
                order.paymentBalance = Math.max(order.total - order.amountPaid, 0);
            }
        }
        else if (order.promotionType == self.promotionType.onItem) {
            for (var i = 0; i < order.orderDetails.length; i++) {
                var detail = order.orderDetails[i];
                if (detail.promotionOnItemSelected != null) {
                    detail.promotionId = detail.promotionOnItemSelected.promotionId;
                    var discount = detail.promotionOnItemSelected.isPercent ? detail.promotionOnItemSelected.discountPercent : detail.promotionOnItemSelected.discountPrice;
                    self.calculatePriceOnItemByOrder(order, detail, detail.promotionOnItemSelected.isPercent, discount);
                }
                else {
                    detail.promotionId = 0;
                    detail.isDiscountPercent = false;
                    detail.discount = 0;
                    detail.discountPercent = 0;
                    detail.sellPrice = detail.unitPrice - detail.discount;
                }
            }
            
        }
    }
    self.calculateTotalByOrder(order);
};

/* 
    Description: Áp dụng chương trình khuyến mãi nhập mã.
*/
SunoSaleOrderCafe.prototype.applyPromotionCode = function (code, promotion) {
    var self = this;
    return new Promise(function (resolve, reject) {
        if (self.saleOrder.isPromotion && promotion.isCodeRequired && code != '') {
            var data = { format: 'json', promotionCode: code };
            self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.promotion.getPromotionByCodeUrl, 'GET', data)
            .then(function (body) {
                if (body != null && body.promotionId == promotion.promotionId) {
                    //Reset promotion
                    self.cancelPromotion();

                    //Apply promotion
                    self.saleOrder.isPromotion = true;
                    self.saleOrder.promotionOnBillSelected = promotion;
                    self.saleOrder.promotionType = self.promotionType.onBill;
                    self.applyPromotion();

                    resolve('Áp dụng thành công chương trình khuyến mãi [' + promotion.promotionName + '] cho đơn hàng.');
                }
                else {
                    reject('Mã khuyến mãi không hợp lệ.');
                }
            })
            .catch(function (error) {
                console.log('SunoSaleOrderCafe.prototype.applyPromotionCode', error);
                reject('Mã khuyến mãi không hợp lệ.');
            });
        }
        else {
            reject('Mã khuyến mãi không hợp lệ.');
        }
    });
};

/* 
    Description: Áp dụng chương trình khuyến mãi trên đơn hàng.
*/
SunoSaleOrderCafe.prototype.applyPromotionOnBill = function (promotion) {
    var self = this;
    if (self.saleOrder.isPromotion) {
        self.cancelPromotion();

        self.saleOrder.isPromotion = true;
        self.saleOrder.promotionOnBillSelected = promotion;
        self.saleOrder.promotionType = self.promotionType.onBill;
        self.applyPromotion();
    }
};

/* 
    Description: Áp dụng chương trình khuyến mãi cho hàng hóa.
*/
SunoSaleOrderCafe.prototype.applyPromotionOnItem = function (promotions) {
    var self = this;
    if (self.saleOrder.isPromotion) {
        self.cancelPromotion();
        for (var i = 0; i < promotions.length; i++) {
            var promo = promotions[i];
            var detail = self.saleOrder.orderDetails.find(function (d) { return d.itemId == promo.itemId; });
            if (detail !== undefined) {
                detail.promotionId = promo.promotionId;
                detail.promotionOnItemSelected = promo;
            }
        }
        self.saleOrder.isPromotion = true;
        self.saleOrder.promotionType = self.promotionType.onItem;
        self.applyPromotion();
    }
};

/* 
    Description: Lấy danh sách CTKM theo hàng hóa.
*/
SunoSaleOrderCafe.prototype.getPromotionByItem = function (itemId) {
    var self = this;
    var result = [];
    if (self.saleOrder.promotionOnItem != null && self.saleOrder.promotionOnItem.length > 0) {
        var data = self.saleOrder.promotionOnItem.filter(function (p) { return p.itemId == itemId; });
        if (data.length > 0) result = data;
    }
    return result;
};

/* 
    Description: Lấy danh sách CTKM trên đơn hàng.
*/
SunoSaleOrderCafe.prototype.getPromotionOnBill = function () {
    var self = this;
    var result = [];
    if (self.saleOrder.promotionOnBill != null && self.saleOrder.promotionOnBill.length > 0) {
        result = self.saleOrder.promotionOnBill;
    }
    return result;
};

/* 
    Description: Lấy danh sách CTKM.
*/
SunoSaleOrderCafe.prototype.getPromotions = function () {
    var self = this;
    var result = [];
    if (self.saleOrder.promotionOnBill != null && self.saleOrder.promotionOnBill.length > 0) {
        for (var i = 0; i < self.saleOrder.promotionOnBill.length; i++) {
            var promo = self.saleOrder.promotionOnBill[i];
            var existsPromotion = result.find(function (p) { return p.promotionId == promo.promotionId; });
            if (existsPromotion === undefined) result.push(promo);
        }
    }
    if (self.saleOrder.promotionOnItem != null && self.saleOrder.promotionOnItem.length > 0) {
        for (var i = 0; i < self.saleOrder.promotionOnItem.length; i++) {
            var promo = self.saleOrder.promotionOnItem[i];
            var existsPromotion = result.find(function (p) { return p.promotionId == promo.promotionId; });
            if (existsPromotion === undefined) result.push(promo);
        }
    }
    return result;
};


/* 
    Description: Tính điểm quy đổi từ tiền hàng.
    Params: - totalMoney: Tổng tiền hàng sau khi trừ phụ phí (phí vận chuyển).
*/
SunoSaleOrderCafe.prototype.calculateEarningPoint = function(totalMoney) {
    var self = this;
    var result = 0;
    if (self.earningPointConfig.isApplyEarningPoint && self.earningPointConfig.convertPoint > 0 && self.earningPointConfig.convertMoney > 0 && self.saleOrder.customer != null && totalMoney > 0) {
        result = Math.floor(totalMoney * self.earningPointConfig.convertPoint / self.earningPointConfig.convertMoney);
    }
    return result;
};
SunoSaleOrderCafe.prototype.calculateEarningPointByOrder = function (order, totalMoney) {
    var self = this;
    var result = 0;
    if (self.earningPointConfig.isApplyEarningPoint && self.earningPointConfig.convertPoint > 0 && self.earningPointConfig.convertMoney > 0 && order.customer != null && totalMoney > 0) {
        result = Math.floor(totalMoney * self.earningPointConfig.convertPoint / self.earningPointConfig.convertMoney);
    }
    return result;
};

/* 
    Description: Tính tiền quy đổi từ điểm.
    Params: - point: Điểm cần quy đổi.
*/
SunoSaleOrderCafe.prototype.calculateEarningMoney = function (point) {
    var self = this;
    var result = 0;
    if (self.earningPointConfig.isApplyEarningPoint && self.earningPointConfig.exchangePoint > 0 && self.earningPointConfig.exchangeMoney > 0 && self.saleOrder.customer != null && point > 0) {
        result = Math.round(point * self.earningPointConfig.exchangeMoney / self.earningPointConfig.exchangePoint);
    }
    return result;
};
SunoSaleOrderCafe.prototype.calculateEarningMoneyByOrder = function (order, point) {
    var self = this;
    var result = 0;
    if (self.earningPointConfig.isApplyEarningPoint && self.earningPointConfig.exchangePoint > 0 && self.earningPointConfig.exchangeMoney > 0 && order.customer != null && point > 0) {
        result = Math.round(point * self.earningPointConfig.exchangeMoney / self.earningPointConfig.exchangePoint);
    }
    return result;
};

/*
    Description: Thực hiên đổi điểm thành tiền hàng.
*/
SunoSaleOrderCafe.prototype.exchangeEarningPoint = function (point) {
    var self = this;
    var result = Object.assign({}, SunoGlobal.result);
    if (point <= self.saleOrder.customer.remainPoint) {
        self.saleOrder.exchangedPoint = point;
        self.calculateTotal();
        result.isSuccess = true;
        result.description = '';
    }
    else {
        result.isSuccess = false;
        result.description = 'Điểm tích lũy của khách hàng [' + self.saleOrder.customer.customerName + '] còn ' + self.saleOrder.customer.remainPoint + ' điểm, không đủ để thực hiện đổi điểm.';
    }
    return result;
};

/*
    Description: Tính toán điểm quy đổi tối đa cho đơn hàng.
*/
SunoSaleOrderCafe.prototype.getMaxEarningPoint = function (point) {
    var self = this;
    var result = 0, totalWithoutFee = self.saleOrder.subTotal - self.saleOrder.discount;
    var exchangedMoney = self.calculateEarningMoney(point);
    if (exchangedMoney <= totalWithoutFee) {
        result = point;
    }
    else {
        result = Math.floor(totalWithoutFee * self.earningPointConfig.exchangePoint / self.earningPointConfig.exchangeMoney);
    }
    return result;
};

/*
    Description: Thêm mới đơn hàng vào danh sách đơn hàng.
*/
SunoSaleOrderCafe.prototype.addNewOrder = function (order, callback) {
    var self = this;
    var existsOrder = self.saleOrders.find(function (o) { return o.uid == order.uid; });
    if (existsOrder === undefined) {
        var promotion = self.generatePromotion();
        self.promotions.push(promotion);
        self.saleOrders.push(order);
        if (SunoGlobal.saleSetting.isApplyPromotion && order.saleTypeId != self.saleType.online) {
            var data = { format: 'json' };
            self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.promotion.getActivePromotionUrl, 'GET', data)
            .then(function (body) {
                promotion.isCallApi = body;
                if (promotion.isCallApi) {
                    //Lấy danh sách CTKM trên hóa đơn
                    var jsonDate = order.saleDate.constructor.name === 'Date' ? order.saleDate.toJSON() : order.saleDate;
                    var promotionData = { format: 'json', saleDate: jsonDate };
                    self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.promotion.getPromotionOnBillUrl, 'GET', promotionData)
                    .then(function (result) {
                        if (result != null && result.response != null && result.response.length > 0) {
                            promotion.promotionOnBill = result.response;
                        }
                        //Lấy danh sách CTKM trên hàng hóa
                        if (order.orderDetails.length > 0) {
                            var items = [];
                            for (var i = 0; i < order.orderDetails.length; i++) {
                                var detail = order.orderDetails[i];
                                items.push({
                                    itemId: detail.itemId,
                                    quantity: detail.quantity,
                                    retailPrice: detail.retailPrice
                                });
                            }
                            var customerId = order.customer == null ? 0 : order.customer.customerId;
                            self.getPromotionOnItem(items, order.storeId, customerId, order.saleDate)
                            .then(function (data) {
                                promotion.promotionOnItem = [];
                                if (data != null && data.response != null && data.response.length > 0) {
                                    for (var i = 0; i < data.response.length; i++) {
                                        var item = {
                                            itemId: data.response[i].itemID,
                                            quantity: data.response[i].quantity,
                                            retailPrice: data.response[i].retailPrice,
                                            promotions: data.response[i].promotions
                                        };
                                        promotion.promotionOnItem.push(item);
                                    }
                                }
                                //Calculate to promote for order
                                self.calculatePromotionByOrder(order, promotion);
                                self.applyPromotionByOrder(order);
                                if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
                            })
                            .catch(function (error) {
                                console.log('SunoSaleOrderCafe.prototype.addNewOrder: getPromotionOnItemUrl', error);
                                //Calculate to promote for order
                                self.calculatePromotionByOrder(order, promotion);
                                self.applyPromotionByOrder(order);
                                if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
                            });
                        }
                        else {
                            //Calculate to promote for order
                            self.calculatePromotionByOrder(order, promotion);
                            self.applyPromotionByOrder(order);
                            if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
                        }
                    })
                    .catch(function (error) {
                        console.log('SunoSaleOrderCafe.prototype.addNewOrder: getPromotionOnBillUrl', error);
                        //Calculate to promote for order
                        self.calculateTotalByOrder(order);
                        if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
                    });
                }
                else {
                    //Calculate to promote for order
                    self.calculateTotalByOrder(order);
                    if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
                }
            })
            .catch(function (error) {
                console.log('SunoSaleOrderCafe.prototype.addNewOrder: getActivePromotionUrl', error);
                //Calculate to promote for order
                self.calculateTotalByOrder(order);
                if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
            });
        }
        else {
            //Calculate to promote for order
            self.calculateTotalByOrder(order);
            if (callback !== undefined && callback !== null && typeof callback === 'function') callback();
        }
    }
};

/*
    Description: Tính toán lại thông tin đơn hàng đồng bộ.
*/
SunoSaleOrderCafe.prototype.calculateOrder = function (order, callback) {
    var self = this;
    var index = self.saleOrders.findIndex(function (o) { return o.uid == order.uid; });
    if (index > -1) {
        if (SunoGlobal.saleSetting.isApplyPromotion) {
            self.changeStoreByOrder(order, order.storeId, callback);
        }
        self.calculateTotalByOrder(order);
        self.saleOrders[index] = order;
    }
    else {
        self.addNewOrder(order, callback);
    }
};