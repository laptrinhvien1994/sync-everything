function SunoCustomer() {
    this.request = new SunoRequest();
    this.customerType = {
        retail: 0,
        wholeSale: 1,
        vip: 2
    };
    this.customer = {
        customerId: 0,
        customerName: '',
        code: '',
        phone: '',
        email: '',
        gender: false,
        birthday: new Date(1970, 0, 1),
        address: '',
        description: '',
        remainPoint: 0,
        type: 0, //Khách lẻ: 0, Khách sỉ: 1, Khách VIP: 2
    };
    this.customers = {
        total: 0,
        items: []
    };
};

SunoCustomer.prototype.generateCustomer = function(customer){
    var result = new Object();
    result.customerId = customer.customerId;
    result.customerName = customer.name;
    result.code = customer.code;
    result.phone = customer.phone;
    result.email = customer.emails != null && customer.emails.length > 0 ? customer.emails[0].email : '';
    result.birthday = customer.birthday != null ? SunoGlobal.convertJsonDateTimeToJs(customer.birthday): new Date(1970, 0, 1);
    result.gender = customer.gender != null ? customer.gender : false;
    result.address = customer.address;
    result.description = customer.description;
    result.remainPoint = customer.remainPoint;
    result.type = customer.type;
    return result;
};

/* 
    Description: Tìm kiếm khách hàng theo mã, tên và số điện thoại.
*/
SunoCustomer.prototype.search = function(keyword, limit, pageNo) {
    var self = this;
    var result = null;
    if (!SunoGlobal.isNullOrEmpty(keyword)) {
        var data = { format: 'json', keyword: keyword, limit: limit, pageIndex: pageNo, sorting: '' };
        result = new Promise(function (resolve, reject) {
            self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.customer.search, 'GET', data).then(function(body){
                self.customers.total = 0;
                self.customers.items = [];
                if (body != null && body.total > 0) {
                    self.customers.total = body.total;
                    for(var i = 0; i < body.customers.length; i++) {
                        var customer = body.customers[i];
                        self.customers.items.push(self.generateCustomer(customer));
                    }
                }
                resolve(self.customers);
            }).catch(function(error){
                reject(error);
            });
        });
    }
    return result;
};

/* 
    Description: Lấy danh sách khách hàng.
*/
SunoCustomer.prototype.getCustomers = function(limit, pageNo) {
    var self = this;
    var result = null;
    var data = { format: 'json', keyword: '', limit: limit, pageIndex: pageNo, sorting: '', type: 0, customerType: -1 };
    result = new Promise(function(resolve, reject) {
        self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.customer.getCustomersUrl, 'GET', data).then(function(body){
            self.customers.total = 0;
            self.customers.items = [];
            if (body != null && body.total > 0) {
                self.customers.total = body.total;
                for(var i = 0; i < body.customers.length; i++) {
                    var customer = body.customers[i];
                    self.customers.items.push(self.generateCustomer(customer));
                }
            }
            resolve(self.customers);
        }).catch(function(error){
            reject(error);
        });
    });
    return result;
};

/*
    Description: Tạo mới khách hàng.
    Params: 
        - customer: { customerName: 'string', code: 'string', phone: 'string', email: 'string', gender: boolean, birthday: date, address: 'string', description: 'stirng', remainPoint: int, type: int }
            + type: Loại khách hàng (Khách lẻ: 0, Khách sỉ: 1, Khách VIP: 2)
*/
SunoCustomer.prototype.createCustomer = function(customer) {
    var self = this;
    var result = null;
    var data = { customer: { 
                    name: customer.customerName, 
                    code: customer.code, 
                    gender: customer.gender, 
                    phone: customer.phone, 
                    email: customer.email, 
                    address: customer.address, 
                    birthday: customer.birthday != null ? customer.birthday : new Date(1970, 0, 1),
                    description: customer.description,
                    remainPoint: 0,  
                    type: customer.type }
                };
    result = new Promise(function(resolve, reject) {
        self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.customer.createCustomer, 'POST', data).then(function(body){
            if (body && body.customerId > 0) {
                self.customer = data.customer;
                self.customer.customerId = body.customerId;
                self.customer.code = body.code;
            }
            resolve(self.customer);
        }).catch(function(error){
            reject(error);
        });
    });
    return result;
};

/* 
    Description: Lấy điểm tích lũy của khách hàng.
*/
SunoCustomer.prototype.getCustomerPoint = function(customerId) {
    var self = this;
    var result = null;
    var data = { format: 'json', customerId: customerId };
    result = new Promise(function(resolve, reject) {
        self.request.makeRestful(SunoGlobal.sunoService.domain + SunoGlobal.sunoService.earningPoint.getCustomerPointUrl, 'GET', data).then(function(body){
            var remainPoint = (body != null ? body.remainPoint : 0);
            resolve(remainPoint);
        }).catch(function(error){
            reject(error);
        });
    });
    return result;
};
