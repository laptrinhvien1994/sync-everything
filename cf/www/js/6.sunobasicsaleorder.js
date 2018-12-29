function SunoBasicSaleOrder (storeId) {
    this.request = new SunoRequest();
    this.storeId = storeId;
};

//#region prototype
SunoBasicSaleOrder.prototype.customer = new SunoCustomer();
SunoBasicSaleOrder.prototype.saleType = { retail: 1, wholeSale: 2, online: 3, return : 4 };
SunoBasicSaleOrder.prototype.saleStatus = { draft: 1, complete: 2 };
SunoBasicSaleOrder.prototype.saleOnlineStatus = { draft: 1, confirm: 2, onDelivery: 3, complete: 4, cancel: 5 };
SunoBasicSaleOrder.prototype.paymentMethod = { cash: 1, card: 2, transfer: 3 };
SunoBasicSaleOrder.prototype.saleOrder = null;
SunoBasicSaleOrder.prototype.saleOrderUid = '';
SunoBasicSaleOrder.prototype.saleOrders = [];

/* 
    Description: Khởi tạo đơn hàng.
*/
SunoBasicSaleOrder.prototype.initOrder = function() {
    var self = this;
    self.saleOrders = [];
};
/*
    Description: Tạo cấu trúc đơn hàng. 
 */
SunoBasicSaleOrder.prototype.generateSaleOrder = function() {
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
    return saleOrder;
};
/*
    Description: Tạo cấu trúc hàng hóa trong đơn hàng. 
 */
SunoBasicSaleOrder.prototype.generateOrderDetail = function(item) {
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
        productId: item.productId
    };
    return saleOrderDetail;
};
/* 
    Description: Tạo mới đơn hàng.
*/
SunoBasicSaleOrder.prototype.createNewOrder = function() {
    var self = this;
    var saleOrder = self.generateSaleOrder();
    self.saleOrders.push(saleOrder);
    self.saleOrder = saleOrder;
};

/* 
    Description: Chọn đơn hàng. 
*/
SunoBasicSaleOrder.prototype.selectOrder = function(uid) {
    var self = this;
    var saleOrder = self.saleOrders.find(function(order){ return order.uid == uid; });
    if (saleOrder !== undefined) { 
        self.saleOrder = saleOrder; 
        self.saleOrderUid = uid; 
    }
    else {
        self.saleOrder = null;
    }
};

/*
    Description: Hủy đơn hàng hiện tại. 
    Return: Reset đơn hàng hiện tại về mặc định.
*/
SunoBasicSaleOrder.prototype.cancelOrder = function() {
    var self = this;
    var saleOrderUid = self.saleOrderUid;
    var saleOrder = self.saleOrders.find(function(order){ return order.uid == self.saleOrder.uid; });
    if (saleOrder !== undefined) {
        saleOrder = self.generateSaleOrder();
        saleOrder.uid = saleOrderUid;
        self.saleOrder = saleOrder;
        self.saleOrderUid = saleOrderUid;
    }
};

/*
    Description: Xóa đơn hàng.
*/
SunoBasicSaleOrder.prototype.deleteOrder = function(uid) {
    var self = this;
    if (self.saleOrders.length > 0) {
        if (self.saleOrders.length == 1){
            self.cancelOrder();
        }
        else {
            var index = self.saleOrders.findIndex(function(order){ return order.uid == uid; });
            if (index > -1) {
                self.saleOrders.splice(index, 1);
                self.saleOrder = self.saleOrders[index -1];
                self.saleOrderUid = self.saleOrder.saleOrderUid;
            }
        }
    }
};

/*
    Description: Kiểm tra ràng buộc đơn hàng.
    Return: 'string' (ok: hợp lệ, !ok: thông báo lỗi.)
*/
SunoBasicSaleOrder.prototype.validateOrder = function(order) {
    var self = this;
    if (!order || !order.orderDetails || order.total < 0) return 'Hóa đơn bán hàng không hợp lệ.';
    if (order.orderDetails.length == 0) {
        return 'Chọn ít nhất 1 hàng hóa cần bán trước khi lưu.';
    }

    //Kiểm tra số lượng hàng hóa.
    var arrInvalidQuantity = order.orderDetails.filter(function(detail){ return detail.quantity == 0 && detail.isSerial == false; });
    if (arrInvalidQuantity.length > 0) {
        return 'Nhập số lượng cho hàng hóa [' + arrInvalidQuantity.map(function(order){ return order.itemName;}).join(', ') + '] trước khi lưu.';
    }

    //Kiểm tra serial.
    var arrInvalidQuantitySerial = order.orderDetails.filter(function(detail){ return detail.quantity == 0 && detail.isSerial == true; });
    if (arrInvalidQuantitySerial.length > 0) {
        return 'Chọn serial/imei cho hàng hóa [' + arrInvalidQuantitySerial.map(function(order){ return order.itemName;}).join(', ') + '] trước khi lưu.';
    }

    if(order.saleType == self.saleType.retail && order.saleStatus <= self.saleStatus.complete) {
        var existsUntrackedSale = order.orderDetails.filter(function (detail) {
            return detail.qtyAvailable < detail.quantity && detail.isUntrackedItemSale === false && detail.isInventoryTracked === true;
        });
        if (existsUntrackedSale.length > 0) {
            return 'Hệ thống được cấu hình yêu cầu nhập kho cho hàng đã hết trước khi bán. Xin vui lòng nhập kho cho [' + existsUntrackedSale.map(function (d) { return d.itemName; }).join(',') + '] và thử lại.';
        }
    }

    //Kiểm tra cấu hình bán nợ.
    if (!SunoGlobal.saleSetting.isAllowDebtPayment && order.amountPaid < order.total) {
        return 'Hệ thống được cấu hình không cho phép bán nợ. Xin vui lòng thanh toán đủ mỗi lần bán.';
    }

    //Kiểm tra khách hàng khi bán nợ.
    if (SunoGlobal.saleSetting.isAllowDebtPayment && order.amountPaid < order.total && order.customer == null) {
        return 'Vui lòng thêm thông tin khách hàng khi bán nợ.';
    }
    
    return 'ok';
};

/*
    Description: Calculate sale order model.
    Return: orderModel
*/
SunoBasicSaleOrder.prototype.prepareOrder = function(order) {
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
            payments: []
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
            unit: item.unitName
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
                paymentMethodId: receipt.paymentMethod,
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
    Description: Lưu đơn hàng.
    Return: function promise.
*/
SunoBasicSaleOrder.prototype.saveOrder = function(order) {
    var self = this;
    return new Promise(function(resolve, reject) {
        var validMessage = self.validateOrder(order);
        if (validMessage == 'ok') {
            var data = self.prepareOrder(order);
            self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.saleOrder.completeOrderUrl, 'POST', data).then(function(body) {
                resolve(body);
            }).catch(function(error){
                reject(error);
            });
        }
        else {
            reject(validMessage);
        }
    });
};

SunoBasicSaleOrder.prototype.calculatePricingPolicy = function (item, customer) {
    var self = this;
    var result = item.retailPrice;
    if (customer !== null && customer !== undefined && SunoGlobal.saleSetting.isApplyCustomerPricingPolicy) {
        switch(customer.type) {
            case self.customer.customerType.wholeSale : 
                result = item.wholeSalePrice;
                break;
            case self.customer.customerType.vip : 
                result = item.vipPrice;
                break;
            default: 
                result = item.retailPrice;
                break;
        };
    }
    return result;
};
SunoBasicSaleOrder.prototype.isValidUntrackedItemSale = function (item) {
    var result = true;
    if ((item.qtyAvailable <= 0 || item.qtyAvailable < item.quantity + 1) && item.isInventoryTracked == true && item.isUntrackedItemSale == false) {
        result = false;
    }
    return result;
};
/*
    Description: Tính tổng tiền hàng.
*/
SunoBasicSaleOrder.prototype.calculateTotal = function() {
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
    self.saleOrder.paymentBalance = Math.max(self.saleOrder.total - self.saleOrder.amountPaid, 0);
};

/*
    Description: Tính giảm giá trên đơn hàng.
*/
SunoBasicSaleOrder.prototype.calculateDiscount = function(isDiscountPercent, discount) {
    var self = this;
    self.saleOrder.isDiscountPercent = isDiscountPercent;
    if (self.saleOrder.isDiscountPercent) {
        self.saleOrder.discountPercent = Math.min(discount, 100);
        self.saleOrder.discount = Math.round(self.saleOrder.subTotal * self.saleOrder.discountPercent / 100);
    }
    else {
        self.saleOrder.discount = Math.min(discount, self.saleOrder.subTotal);
        self.saleOrder.discountPercent = Math.round(self.saleOrder.discount * 100 / self.saleOrder.subTotal);
    }
};

/*
    Description: Thực hiện giảm giá trên đơn hàng.
*/
SunoBasicSaleOrder.prototype.changeDiscount = function(isDiscountPercent, discount) {
    var self = this;
    self.calculateDiscount(isDiscountPercent, discount);
    self.calculateTotal();
};

/*
    Description: Tính giảm giá trên hàng hóa.
*/
SunoBasicSaleOrder.prototype.calculatePriceOnItem = function (detail, isDiscountPercent, discount) {
    var self = this;
    detail.isDiscountPercent = isDiscountPercent;
    detail.unitPrice = self.calculatePricingPolicy(detail, self.saleOrder.customer);
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
    Params: - item: productItem
    Return: - {isSuccess: boolean, description: 'string', data: object}
*/
SunoBasicSaleOrder.prototype.addItem = function(item) {
    var self = this;
    var result = Object.assign({}, SunoGlobal.result);
    if (!self.isValidUntrackedItemSale(item)) {
        result.isSuccess = false;
        result.description = 'Hệ thống được cấu hình yêu cầu nhập kho cho hàng đã hết trước khi bán. Xin vui lòng nhập kho cho [' + item.itemName + '] và thử lại.';
    }
    else {
        var detail = self.saleOrder.orderDetails.find(function(d){ return d.itemId == item.itemId; });
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

        result.isSuccess = true;
        result.description = '';
        result.data = detail;
    }
    return result;
};

/*
    Description: Xóa hàng hóa khỏi đơn hàng.
*/
SunoBasicSaleOrder.prototype.removeItem = function(item) {
    var self = this;
    var index = self.saleOrder.orderDetails.findIndex(function(d){ return d.itemId == item.itemId; });
    if (index > -1) {
        self.saleOrder.orderDetails.splice(index, 1);

        //Tính lại giảm giá cho đơn hàng.
        var discount = self.saleOrder.isDiscountPercent ? self.saleOrder.discountPercent : self.saleOrder.discount;
        self.calculateDiscount(self.saleOrder.isDiscountPercent, discount);

        //Tính lại tiền hàng cho đơn hàng.
        self.calculateTotal();
    }
};

/*
    Description: Thay đổi số lượng của hàng hóa trên đơn hàng.
*/
SunoBasicSaleOrder.prototype.changeQuantityOnItem = function(item) {
    var self = this;
    var detail = self.saleOrder.orderDetails.find(function(d){ return d.itemId == item.itemId; });
    if (detail !== undefined) {
        detail.quantity = item.quantity;
        detail.subTotal = detail.quantity * detail.sellPrice;

        //Tính lại giảm giá cho đơn hàng.
        var discount = self.saleOrder.isDiscountPercent ? self.saleOrder.discountPercent : self.saleOrder.discount;
        self.calculateDiscount(self.saleOrder.isDiscountPercent, discount);

        //Tính lại tiền hàng cho đơn hàng.
        self.calculateTotal();
    }
};

/*
    Description: Thay đổi giá mới của hàng hóa trên đơn hàng.
*/
SunoBasicSaleOrder.prototype.changeNewPriceOnItem = function(itemId, newPrice) {
    var self = this;
    var detail = self.saleOrder.orderDetails.find(function(d){ return d.itemId == itemId; });
    if (detail !== undefined) {
        var retailPrice = self.calculatePricingPolicy(detail, self.saleOrder.customer);
        if (newPrice > retailPrice) {
            //Apply giá mới cho hàng hóa.
            detail.unitPrice = newPrice;
            detail.isDiscountPercent = false;
            detail.discount = 0;
            detail.discountPercent = 0;
        }
        else {
            //Thực hiện giảm giá.
            var discountPrice = retailPrice - newPrice;
            detail.discount = discountPrice;
            detail.discountPercent = Math.round(discountPrice / retailPrice * 100);
            detail.unitPrice = retailPrice;
        }
        
        //Tính lại giá bán cho hàng hóa.
        detail.sellPrice = detail.unitPrice - detail.discount;
        detail.subTotal = detail.quantity * detail.sellPrice;

        //Tính lại giảm giá cho đơn hàng.
        var discount = self.saleOrder.isDiscountPercent ? self.saleOrder.discountPercent : self.saleOrder.discount;
        self.calculateDiscount(self.saleOrder.isDiscountPercent, discount);

        //Tính lại tiền hàng cho đơn hàng.
        self.calculateTotal();
    }
};

/*
    Description: Thay đổi cửa hàng khi bán đơn hàng.
*/
SunoBasicSaleOrder.prototype.changeStore = function(storeId) {
    var self = this;
    self.storeId = storeId;
};

/*
    Description: Thêm khách hàng vào đơn hàng.
*/
SunoBasicSaleOrder.prototype.addCustomer = function(customer) {
    var self = this;
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
};

/*
    Description: Xóa khách hàng khỏi đơn hàng.
*/
SunoBasicSaleOrder.prototype.removeCustomer = function() {
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
};


SunoBasicSaleOrder.prototype.generateReceiptVoucher = function() {
    var self = this;
    var receipt = new Object();
    receipt.id = SunoGlobal.generateGUID();
    receipt.voucherId = 0;
    receipt.code = '';
    receipt.receivedDate = self.saleOrder.saleDate;
    receipt.amount = 0;
    receipt.paymentMethodId = self.paymentMethod.cash;
    receipt.status = 3;
    receipt.description = '';
    return receipt;
};

SunoBasicSaleOrder.prototype.selectReceiptVoucher = function(id) {
    var self = this;
    var receiptVoucher = self.saleOrder.receiptVouchers.find(function(rv){ return rv.id == id; });
    return receiptVoucher;
};

SunoBasicSaleOrder.prototype.addReceiptVoucher = function(voucher) {
    var self = this;
    var receiptVoucher = self.selectReceiptVoucher(voucher.Id);
    if (receiptVoucher === undefined) {
        self.saleOrder.receiptVouchers.push(voucher);
    }
};

SunoBasicSaleOrder.prototype.removeReceiptVoucher = function(id) {
    var self = this;
    var index = self.saleOrder.receiptVouchers.findIndex(function(rv){ return rv.id == id; });
    if (index > -1) {
        self.saleOrder.receiptVouchers.splice(index, 1);
    }
};

/* 
    Description: Áp dụng mã khuyến mãi.
*/
SunoBasicSaleOrder.prototype.applyCodeForPromotion = function(code) {
    var self = this;
    return new Promise(function(resolve, reject){
        if (self.saleOrder.isPromotion && code != '') {
            var data = { format: 'json', promotionCode: code };
            self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.promotion.getPromotionByCodeUrl, 'GET', data)
            .then(function(body){
                if (body != null && self.saleOrder.promotionOnBill.length > 0) {
                    //body.promotionId
                    var promotion = self.saleOrder.promotionOnBill.find(function(p){ return p.promotionId == body.promotionId;});
                    if (promotion !== undefined) {
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
                }
                else {
                    reject('Mã khuyến mãi không hợp lệ.');
                }
            })
            .catch(function(error){
                console.log('SunoBasicSaleOrder.prototype.applyCodeForPromotion', error);
                reject('Mã khuyến mãi không hợp lệ.');
            });
        }
        else {
            reject('Mã khuyến mãi không hợp lệ.');
        }
    });
}
//#endregion
