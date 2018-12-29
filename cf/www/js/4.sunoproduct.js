function SunoProduct() {
    //region contructor
    this.request = new SunoRequest();
    this.productItem = {
        itemId: 0,
        itemName: '',
        barcode: '',
        qtyAvailable: 0,
        buyPrice: 0,
        retailPrice: 0,
        wholeSalePrice: 0,
        vipPrice: 0,
        imageUrl: '',
        isInventoryTracked: true,
        isUntrackedItemSale: true,
        isSerial: false,
        isTaxable: false,
        tax: 0,
        unitName: '',
        isExchangeQuantity: false,
        exchangeQuantity: 0,
        unitName: '',
        productType: 0,
        productId: 0
    };
    this.productItems = {
        total: 0,
        items: []
    };
    //endregion
};

//region method
/*
    Description: Bind data to product item.
*/
SunoProduct.prototype.generateProductItem = function(item){
    var productItem = new Object();
    productItem.itemId = item.itemId;
    productItem.itemName = item.itemName;
    productItem.barcode = item.barcode.trim();
    productItem.qtyAvailable = item.qtyAvailable;
    productItem.buyPrice = item.buyPrice;
    productItem.retailPrice = item.retailPrice;
    productItem.wholeSalePrice = item.wholeSalePrice == null ? 0 : item.wholeSalePrice;
    productItem.vipPrice = item.vipPrice == null ? 0 : item.vipPrice;
    productItem.imageUrl = item.image != null && item.image.thumbnail != '' ? item.image.thumbnail : '';
    productItem.isInventoryTracked = item.isInventoryTracked;
    productItem.isUntrackedItemSale = item.isUntrackedItemSale;
    productItem.isSerial = item.isSerial;
    productItem.isTaxable = item.isTaxable;
    productItem.tax = item.tax;
    productItem.unitName = item.unitName;
    productItem.isExchangeQuantity = item.isExchangeQuantity == null ? false : item.isExchangeQuantity;
    productItem.exchangeQuantity = item.exchangeQuantity == null ? 0 : item.exchangeQuantity;
    productItem.productType = item.productType;
    productItem.productId = item.productId;
    return productItem;
};
/*
    Description: Tìm kiếm hàng hóa theo mã, tên hàng hóa. Và hiển thị số lượng tồn kho theo cửa hàng.
*/
SunoProduct.prototype.searchProductItems = function(storeId, keyword, limit, pageNo) {
    var self = this;
    var result = null;
    if (!SunoGlobal.isNullOrEmpty(keyword)) {
        var data = { format: 'json', keyword: keyword, limit: limit, pageIndex: pageNo, storeId: storeId };
        result = new Promise(function (resolve, reject) {
            self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.productItem.search, 'GET', data).then(function(body){
                self.productItems.total = 0;
                self.productItems.items = [];
                if (body != null && body.total > 0) {
                    self.productItems.total = body.total;
                    for(var i = 0; i < body.items.length; i++) {
                        var item = body.items[i];
                        self.productItems.items.push(self.generateProductItem(item));
                    }
                }
                resolve(self.productItems);
            }).catch(function(error){
                reject(error);
            });
        });
    }
    return result;
};

/*
    Description: Lấy danh sách hàng hóa theo cửa hàng.
*/
SunoProduct.prototype.getProductItems = function(storeId, limit, pageNo) {
    var self = this;
    var result = null;
    var data = { format: 'json', storeId: storeId, hasImages: true, limit: limit, pageIndex: pageNo };
    result = new Promise(function(resolve, reject) {
        self.request = new SunoRequest();
        self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.productItem.getProductItemsUrl, 'GET', data).then(function(body){
            self.productItems.total = 0;
            self.productItems.items = [];
            if (body != null && body.total > 0) {
                self.productItems.total = body.total;
                for(var i = 0; i < body.items.length; i++) {
                    var item = body.items[i];
                    self.productItems.items.push(self.generateProductItem(item));
                }
            }
            resolve(self.productItems);
        }).catch(function(error){
            reject(error);
        });
    });
    return result;
};

/*
    Description: Lấy danh sách hàng hóa theo cửa hàng và nhóm hàng.
*/
SunoProduct.prototype.getProductItemsByCategory = function(storeId, categoryId, limit, pageNo) {
    var self = this;
    var result = null;
    var data = { format: 'json', storeId: storeId, categoryId: categoryId, hasImages: true, limit: limit, pageIndex: pageNo };
    result = new Promise(function(resolve, reject) {
        self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.productItem.getProductItemsUrl, 'GET', data).then(function(body){
            self.productItems.total = 0;
            self.productItems.items = [];
            if (body != null && body.total > 0) {
                self.productItems.total = body.total;
                for(var i = 0; i < body.items.length; i++) {
                    var item = body.items[i];
                    self.productItems.items.push(self.generateProductItem(item));
                }
            }
            resolve(self.productItems);
        }).catch(function(error){
            reject(error);
        });
    });
    return result;
};

/*
    Description: Lấy danh sách hàng hóa mới nhất.
*/
SunoProduct.prototype.getNewProductItems = function(storeId, limit, pageNo) {
    var self = this;
    var result = null;
    var data = { format: 'json', storeId: storeId, hasImages: true, limit: limit, pageIndex: pageNo };
    result = new Promise(function(resolve, reject) {
        self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.productItem.getNewProductItemsUrl, 'GET', data).then(function(body){
            self.productItems.total = 0;
            self.productItems.items = [];
            if (body != null && body.total > 0) {
                self.productItems.total = body.total;
                for(var i = 0; i < body.items.length; i++) {
                    var item = body.items[i];
                    self.productItems.items.push(self.generateProductItem(item));
                }
            }
            resolve(self.productItems);
        }).catch(function(error){
            reject(error);
        });
    });
    return result;
};

/*
    Description: Lấy danh sách hàng hóa bán chạy nhất.
*/
SunoProduct.prototype.getBestSellingProductItems = function(storeId, limit, pageNo) {
    var self = this;
    var result = null;
    var data = { format: 'json', storeId: storeId, hasImages: true, limit: limit, pageIndex: pageNo };
    result = new Promise(function(resolve, reject) {
        self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.productItem.getBestSellingProductItemsUrl, 'GET', data).then(function(body){
            self.productItems.total = 0;
            self.productItems.items = [];
            if (body != null && body.total > 0) {
                self.productItems.total = body.total;
                for(var i = 0; i < body.items.length; i++) {
                    var item = body.items[i];
                    self.productItems.items.push(self.generateProductItem(item));
                }
            }
            resolve(self.productItems);
        }).catch(function(error){
            reject(error);
        });
    });
    return result;
};

/*
    Description: Tạo mới hàng hóa.
    Params: 
        - product: { productName: 'string', barcode: '', qtyAvailable: float, buyPrice: int, retailPrice: int, wholeSalePrice: int, vipPrice: int, isInventoryTracked: boolean, isUntrackedItemSale: boolean, unitName: 'string', productType: int, isPOSPublished: boolean }
        - storeId: int
    Params Description: 
        - productName: Tên hàng hóa.
        - barcode: Mã hàng hóa.
        - qtyAvailable: Số lượng hàng hóa.
        - buyPrice: Giá mua.
        - retailPrice: Giá bán.
        - wholeSalePrice: Giá sỉ.
        - vipPrice: Giá vip.
        - isInventoryTracked: Có quản lý tồn kho ?
        - isUntrackedItemSale: Cho phép bán âm ?
        - unitName: Đơn vị.
        - productType: Loại hàng hóa (0: Hàng hóa, 1: Chế biến, 2: Sản xuất, 3: Quy đổi).
        - isPOSPublished: Có hiển thị ra POS ?
        - storeId: Mã cửa hàng.
*/
SunoProduct.prototype.createProduct = function(product, storeId) {
    var self = this;
    var result = null;
    var data = {
        storeId: storeId, 
        product: {
            upc_ean: '',
            productName: product.productName,
            isAttrative: false,
            isAttributed: false,
            isSerial: false,
            isActived: true,
            metaTitle: '',
            metaDescription: '',
            productType: product.productType,
            productItems: [{
                itemName: product.productName, 
                barcode: product.barcode, 
                qtyAvailable: product.qtyAvailable,
                buyPrice: product.buyPrice, 
                retailPrice: product.retailPrice, 
                wholeSalePrice: product.wholeSalePrice, 
                vipPrice: product.vipPrice, 
                onlinePrice: product.retailPrice,
                isTaxalbe: false,
                tax: 0,
                isInventoryTracked: product.isInventoryTracked,
                isUntrackedItemSale: product.isUntrackedItemSale,
                isSerial: false,
                minQuantity: 1,
                maxQuantity: 100,
                isExchangeQuantity: false,
                exchangeQuantity: 0,
                unitName: product.unitName,
                productType: product.productType,
                isPOSPublished: product.isPOSPublished
            }]
        }
    };

    result = new Promise(function(resolve, reject) {
        self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.productItem.createProductUrl, 'POST', data).then(function(body) {
            if (body != null && body.productId > 0) {
                //Assign to productItem object
                self.productItem.itemName = product.productName;
                self.productItem.qtyAvailable = product.qtyAvailable;
                self.productItem.buyPrice = product.buyPrice;
                self.productItem.retailPrice = product.retailPrice;
                self.productItem.wholeSalePrice = product.wholeSalePrice;
                self.productItem.vipPrice = product.vipPrice;
                self.productItem.onlinePrice = product.retailPrice;
                self.productItem.isInventoryTracked = product.isInventoryTracked;
                self.productItem.isUntrackedItemSale = product.isUntrackedItemSale;
                self.productItem.unitName = product.unitName;
                self.productItem.productType = product.productType;
                self.productItem.productId = body.productId;
                if (body.items && body.items.length > 0) {
                    var item = body.items[0];
                    self.productItem.itemId = item.itemID;
                    self.productItem.barcode = item.barCode;
                }
            }
            resolve(self.productItem);
        }).catch(function(error){
            reject(error);
        });
    });
    return result;
};

SunoProduct.prototype.categories = [];
/*
    Description: Lấy danh sách nhóm hàng.
    Return: categories
*/
SunoProduct.prototype.getCategories = function() {
    var self = this;
    var result = null;
    var data = { format: 'json' };
    result = new Promise(function(resolve, reject) {
        self.request = new SunoRequest();
        self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.category.getCategoriesUrl, 'GET', data).then(function(body){
            self.categories = [];
            if (body != null && body.categories != null && body.categories.length > 0) {
                for (var i = 0; i < body.categories.length; i++) {
                    var category = body.categories[i];
                    self.categories.push({
                        categoryId: category.categoryID,
                        categoryName: category.categoryName,
                        parentCategoryId: category.parentCategoryID,
                        level: category.level
                    });
                }
            }
            resolve(self.categories);
        }).catch(function(error){
            reject(error);
        });
    });
    return result;
};
//endregion
