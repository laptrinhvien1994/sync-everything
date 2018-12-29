angular.module('sunoPos.printerFactory', [])
.factory('printer', ['$rootScope', '$compile', '$http', '$timeout', function ($rootScope, $compile, $http, $timeout) {
    var printHtml = function (html) {

        var htmlContent =
             "<!DOCTYPE HTML>" +
             "<html>" +
             "<head>" +
             '<meta charset="utf-8">' +
             '<meta http-equiv= "X-UA-Compatible" content="IE=edge">' +
             '<meta name="viewport" content="width=device-width, initial-scale=1">' +
                        '<body onload="print();">' +

                            html +
                        '</body>' +
                    "</html>";

        var ua = window.navigator.userAgent.toLowerCase(),
        platform = window.navigator.platform.toLowerCase();
        platformName = ua.match(/ip(?:ad|od|hone)/) ? 'ios' : (ua.match(/(?:webos|android)/) || platform.match(/mac|win|linux/) || ['other'])[0];
        var isMobile = /ios|android|webos/.test(platformName);
        if (isMobile) {
            openNewWindow(html);
            return;
        }
        var hiddenFrame = $('<iframe style="visibility: hidden; border: none; pointer-events: none;"></iframe>').appendTo('body')[0];

        var doc;
        if (hiddenFrame.contentDocument) { // DOM
            doc = hiddenFrame.contentDocument;
        } else if (hiddenFrame.contentWindow) { // IE win
            doc = hiddenFrame.contentWindow.document;
        } else {
            console.log('Could not print for browser ' + window.navigator.userAgent);
            return;
        }
        doc.write(htmlContent);
        doc.close();

        var print = function () {
            if (window.navigator.userAgent.indexOf("MSIE") > 0) {
                hiddenFrame.contentWindow.document.execCommand('print', false, null);
            }
            else {
                hiddenFrame.contentWindow.focus();
                hiddenFrame.contentWindow.print();
            }
            $(hiddenFrame).remove();
        }
    };

    var openNewWindow = function (html) {
        var newWindow = window.open(PrintUrl);
        newWindow.addEventListener('load', function () {

            $(newWindow.document.body).html(html);
        }, false);
        //var newWindow = window.open("print.html");
        //newWindow.document.write(html);
        //newWindow.print();
    };

    var print = function (template, data) {
        var printScope = $rootScope.$new()
        angular.extend(printScope, data);

        var element = $compile($('<div>' + template + '</div>'))(printScope);
        var waitForRenderAndPrint = function () {
            if (!printScope.$$phase) {
                printScope.$apply();
            }
            // console.log(printScope.$$phase,$http.pendingRequests.length);
            if (printScope.$$phase || $http.pendingRequests.length) {
                $timeout(waitForRenderAndPrint);
            } else {
                // Replace printHtml with openNewWindow for debugging
                printHtml(element.html());

                //openNewWindow(element.html());
                printScope.$destroy();
            }
        }
        waitForRenderAndPrint();
    };

    var findSelectedTemplate = function (type) {
        for (var i = 0; i < PrintSetting.Templates.length; i++) {
            //if (PrintSetting.Templates[i].Type === type && PrintSetting.Templates[i].IsSelected)
            if (PrintSetting.Templates[i].Type === type)
                return PrintSetting.Templates[i];
        }
        return null;
    }

    var findTemplate = function (code, type) {
        for (var i = 0; i < PrintSetting.Templates.length; i++) {
            if (PrintSetting.Templates[i].Type === type && PrintSetting.Templates[i].Code === code)
                return PrintSetting.Templates[i];
        }
        return null;
    }

    var initializeTemplates = function (data) {
        if (data && data.templates && data.templates.length > 0) {
            var isSelected = false;
            for (var i = 0; i < data.templates.length; i++) {
                var template = findTemplate(data.templates[i].code, data.templates[i].type);
                if (template) {
                    template.Content = data.templates[i].content;
                    template.IsSelected = data.templates[i].isSelected;
                    if (template.IsSelected) isSelected = true;
                }
            }

            for (var i = 0; i < PrintSetting.Templates.length; i++) {
                if (PrintSetting.Templates[i].Content == '') {
                    PrintSetting.Templates[i].Content = PrintSetting.Templates[i].Original;
                    if (isSelected) PrintSetting.Templates[i].IsSelected = false;
                }
            }
        }
        else {
            for (var i = 0; i < PrintSetting.Templates.length; i++) {
                PrintSetting.Templates[i].Content = PrintSetting.Templates[i].Original;
            }
        }
    }

    function escapeRegExp(str) {
        return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    }

    function replaceAll(str, find, replace) {
        return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
    }

    var initializeOrder = function (template, type) {
        var isTemplateError = false;
        if (!template) {
            if (!type) template = findSelectedTemplate(1);
            else template = findSelectedTemplate(type);
        }

        if (!template) return null;
        var content = Encoder.htmlDecode(template.Content);
        //Relplace E:expresion by M:model
        for (i = 0; i < template.TemplAttrs.length; i++) {
            //content = content.replace(template.TemplAttrs[i].E, template.TemplAttrs[i].M);
            content = replaceAll(content, template.TemplAttrs[i].E, template.TemplAttrs[i].M);
        }
        //For ng-repeat
        var el = $('<div>' + content + '</div>');
        var items = el.find("tr:contains('item.')");

        if (!items || items.length == 0) {
            items = el.find("ul:contains('item.')");
        }

        if (!items || items.length == 0) {
            items = el.find("div:contains('item.')");
        }

        if (items != undefined && items.length > 0) {
            if (items.length == 1) {
                $(items[0]).attr("ng-repeat", "item in orderDetails");
            }
            else {
                if (items[0].parentNode === items[items.length - 1].parentNode) {
                    $(items[0]).attr("ng-repeat-start", "item in orderDetails");
                    $(items[items.length - 1]).attr("ng-repeat-end", "");
                }
                else {
                    isTemplateError = true;
                }
            }
        }
        else {
            if (template.Type == 32 || template.Type == 512) isTemplateError = false;
            else isTemplateError = true;
        }

        return isTemplateError ? null : el.html();
    }

    return {
        print: print,
        initializeTemplates: initializeTemplates,
        initializeOrder: initializeOrder,
        findSelectedTemplate: findSelectedTemplate
    }
}]);

if (!window.PrintSetting) window.PrintSetting = PrintSetting = {
    Templates: [
        //Type: 1, //1: Ban hang POS
        {
            Code: 'Sale_order_small',
            Type: 1, //1: Ban hang POS
            Name: 'Hóa đơn bán hàng (POS)',
            Content: '',
            Original: '<table style="width:100%">' +
                        '<tbody>' +
                        '<tr> <td style=";font-size:12px;">{Ten_Cua_Hang}</td> </tr>' +
                        '<tr> <td style="font-size:12px;"><span >Địa chỉ: {Dia_Chi_Cua_Hang}</span></td> </tr>' +
                        '<tr> <td style=";font-size:12px;"><span >Điện thoại: {SDT_Cua_Hang}</span></td> </tr>' +
                        '</tbody>' +
                        '</table>' +
                        '<div style="text-align:center;font-size:14px;">' +
                        '<span ><strong style="text-align:center;font-size:14px;">HÓA ĐƠN BÁN HÀNG</strong></span>' +
                        '<br/>' +
                        '<span><strong style="text-align:center;font-size:14px;">{Ma_Don_Hang}</strong></span>' +
                        '</div>' +
                        '<div style="font-size:12px;"><span><strong>Ngày bán:</strong> {Ngay_Xuat}</span></div>' +
                        '<div style="font-size:12px;"><span><strong>Khách hàng:</strong> {Khach_Hang}</span></div>' +
                        '<div style="font-size:12px;"><span><strong>Thu ngân:</strong> {Nhan_Vien_Thu_Ngan}</span></div>' +
                        '<div style="font-size:12px;"><span><strong>Giờ vào:</strong> {Gio_Vao} </span></div>' +
                        '<div style="font-size:12px;"><span><strong>Giờ ra:</strong> {Gio_Ra} </span></div>' +
                        '<br />' +
                        '<table style="width:100%" padding="2">' +
                        '<tbody>' +
                        '<tr>' +
                        '<td style="width:35%;font-size:12px;"><strong><span >Đơn giá</span></strong><br /></td>' +
                        '<td style="text-align:center;width:30%;font-size:12px;"><strong><span >SL</span></strong><br /></td>' +
                        '<td style="text-align:right;font-size:12px;padding-right:10px;"><strong><span >TT</span></strong><br /></td>' +
                        '</tr>' +
                        '<tr> <td colspan="3"><span style="font-size:12px;">{Ten_Hang_Hoa}</span><br /></td></tr>' +
                        '<tr>' +
                        '<td style="font-size:12px;"><span >{Don_Gia_Sau_Giam_Gia}</span><br /></td>' +
                        '<td style="text-align:center;font-size:12px;"><span ng-if="!item.duration">{So_Luong}</span ng-if="item.duration"><span>{Thoi_Gian}</span><br /></td>' +
                        '<td style="text-align:right;font-size:12px;padding-right:10px;"><span >{Thanh_Tien}</span><br /></td>' +
                        '</tr>' +
                        '</tbody>' +
                        '</table>' +
                        '<br/>' +
                        '<table style="width:100%">' +
                        '<tbody>' +
                        '<tr>' +
                        '<td style="text-align:right;font-size:12px;"><span >Tổng tiền hàng:</span><br /></td>' +
                        '<td style="text-align:right;font-size:12px;padding-right:10px;"><span >{Tong_Tien_Hang}</span><br /></td>' +
                        '</tr>' +
                        '<tr>' +
                        '<td style="text-align:right;font-size:12px;"><span >Giảm giá:</span><br /></td>' +
                        '<td style="text-align:right;font-size:12px;padding-right:10px;"><span >{Giam_Gia_Tren_Hoa_Don}</span><br /></td>' +
                        '</tr>' +
                        '<tr>' +
                        '<td style="text-align:right;font-size:12px;"><span >Tổng thanh toán:</span><br /></td>' +
                        '<td style="text-align:right;font-size:12px;padding-right:10px;"><strong><span >{Tong_Thanh_Toan}</span></strong><br /></td>' +
                        '</tr>' +
                        '</tbody>' +
                        '</table>' +
                        '<p style="text-align:left;font-size:12px;"><span >Ghi chú: </span> {Ghi_Chu}</p>' +
                        '<div style="text-align:left;font-size:12px;">' +
                        '<span>Xin cảm ơn và hẹn gặp lại!</span>' +
                        '</div >',
            IsSelected: true,
            TemplAttrs:
                [
                    { E: '{Ten_Cua_Hang}', M: '{{companyName}}' },
                    { E: '{Dia_Chi_Cua_Hang}', M: '{{companyAddress}}' },
                    { E: '{SDT_Cua_Hang}', M: '{{companyPhone}}' },
                    { E: '{Ten_Chi_Nhanh}', M: '{{storeName}}' },
                    { E: '{Dia_Chi_Chi_Nhanh}', M: '{{storeAddress}}' },
                    { E: '{SDT_Chi_Nhanh}', M: '{{storePhone}}' },
                    { E: '{Ngay_Xuat}', M: '{{saleDateString}}' },
                    { E: '{Ngay_Thang_Nam}', M: '{{Date | date:"dd/MM/yyyy HH:mm:ss"}}' },
                    { E: '{Ghi_Chu}', M: '{{comment}}' },
                    { E: '{Ma_Don_Hang}', M: '{{saleOrderCode}}' },
                    { E: '{Nhan_Vien_Ban_Hang}', M: '{{saleUserName}}' },
                    { E: '{Nhan_Vien_Thu_Ngan}', M: '{{cashierName}}' },
                    { E: '{Ten_ban_phong}', M: '{{tableName}}' },
                    { E: '{Ma_Khach_Hang}', M: '{{customer.code}}' },
                    { E: '{Khach_Hang}', M: '{{customer.name}}' },
                    { E: '{Mon_phu}', M: '{{item.isChild}}' },
                    { E: '{So_Dien_Thoai}', M: '{{customer.phone}}' },
                    { E: '{Dia_Chi_Khach_Hang}', M: '{{customer.address}}' },
                    { E: '{STT}', M: '{{$index+1}}' },
                    { E: '{Ma_Hang}', M: '{{item.barcode}}' },
                    { E: '{Ten_Hang_Hoa}', M: '{{item.itemName}} <i data-ng-if="item.isSerial==true">(<span ng-repeat="s in item.serials">{{s.serial}}{{$last ? "" : ","}}</span>)</i>' },
                    { E: '{Ghi_Chu_Hang_Hoa}', M: '{{Ghi chú hàng hóa}}' },
                    { E: '{So_Luong}', M: '{{item.quantity | roundQuantityIfFloating:2 }}' },
                    { E: '{Thoi_Gian}', M: '{{item.blockCount}}' },
                    { E: '{Don_Gia_Sau_Giam_Gia}', M: '{{item.discountIsPercent ? item.unitPrice*(1-item.discount/100): item.unitPrice - item.discount | number:0}}' },
					{ E: '{Don_Gia}', M: '{{item.unitPrice | number:0}}' },
                    { E: '{Giam_Gia}', M: '{{item.discountIsPercent ? item.discount * item.unitPrice / 100 : item.discount | number:0}}' },
                    { E: '{Giam_Gia_HH}', M: '<span data-ng-if="item.discount > 0 && item.isDiscountPercent">{{item.discountPercent | number:2}}%</span><span data-ng-if="item.discount > 0 && !item.isDiscountPercent">{{item.discount | number:0}}</span>' },
                    { E: '{Thanh_Tien}', M: '{{item.subTotal | number:0}}' },
                    { E: '{Tong_So_Luong}', M: '{{totalQuantity}}' },
                    { E: '{Tong_Tien_Hang}', M: '{{subTotal | number:0}}' },
                    { E: '{Giam_Gia_Tren_Hoa_Don}', M: '{{discount | number:0}}' },
                    { E: '{Giam_Gia_PT_Tren_Hoa_Don}', M: '{{(discount*100/subTotal) | number:2}}' },
                    { E: '{Phu_Phi}', M: '{{subFee | number:0}}' },
                    { E: '{Tong_Thanh_Toan}', M: '{{total | number:0}}' },
                    { E: '{Da_Thanh_Toan}', M: '{{amountPaid | number:0}}' },
                    { E: '{Chua_Thanh_Toan}', M: '{{paymentBalance | number:0}}' },
                    { E: '{Tien_Thua}', M: '{{amountPaid - total | number:0}}' },
                    { E: '{Tong_No_Khach_Hang}', M: '{{totalPaymentBalance | number:0}}' },
                    { E: '{Gio_Vao}', M: '{{startTime | date:"dd/MM/yyyy HH:mm:ss"}}' },
                    { E: '{Gio_Ra}', M: '{{saleDateString}}' },
                    { E: '{Tien_Quy_Doi}', M: '{{exchangedMoney | number:0}}' },
                    { E: '{Diem_Tich_Luy}', M: '{{convertPoint}}' },
                    { E: '{Diem_Quy_Doi}', M: '{{exchangedPoint}}' },
                    { E: '{Diem_Con_Lai}', M: '{{customer.remainPoint - exchangedPoint + convertPoint}}' },
                    { E: '{STT_TachMon}', M: '{{item.sttTachMon}}'},
                    { E: '{Tong_Tien_Bang_Chu}', M: '{{total | convertMoneyFromNumberToWord}}' },
                    { E: '{Giam_Gia_Da_Nhap}', M: '<span data-ng-if="discount > 0 && isDiscountPercent">{{discountPercent | number:2}}%</span><span data-ng-if="discount > 0 && !isDiscountPercent">{{discount | number:0}}</span>'}
                ]
        },
        //Type: 2, //2:Don hang
        {
            Code: 'Sale_order_large',
            Name: 'Hóa đơn bán hàng (Đơn hàng)',
            Type: 2, //2:Don hang
            Content: '',
            Original: '<table style="width:100%;">' +
                              '<tbody>' +
                              '<tr> <td>{Ten_Cua_Hang}</td> </tr>' +
                              '<tr> <td><span >Địa chỉ: {Dia_Chi_Cua_Hang}</span></td> </tr>' +
                              '<tr> <td><span >Điện thoại: {SDT_Cua_Hang}</span></td> </tr>' +
                              '</tbody>' +
                              '</table>' +
                              '<div style="text-align:center;">' +
                              '<span ><strong>HÓA ĐƠN BÁN HÀNG</strong></span>' +
                              '<br/>' +
                              '<span><strong>{Ma_Don_Hang}</strong></span>' +
                              '</div>' +
                              '<div><span><strong>Ngày bán:</strong> {Ngay_Xuat}</span></div>' +
                              '<div><span ><strong>Khách hàng:</strong> {Khach_Hang}</span></div>' +
                              '<div><span><strong>Thu ngân:</strong> {Nhan_Vien_Thu_Ngan}</span></div>' +
                              '<br />' +
                              '<table style="width:100%; border-collapse: collapse" border="1">' +
                              '<tbody>' +
                              '<tr>' +
                              '<td style="text-align:center;width:5%;"><strong><span>STT</span></strong></td>' +
                              '<td style="width:40%;padding-left:5px;"><strong><span >Tên hàng hóa</span></strong><br /></td>' +
                              '<td style="text-align:right;padding-right:5px;width:15%;"><strong><span >Đơn giá</span></strong><br /></td>' +
                              '<td style="text-align:right;padding-right:5px;width:15%;"><strong><span >Giảm giá</span></strong><br /></td>' +
                              '<td style="text-align:center;width:7%;"><strong><span >SL</span></strong><br /></td>' +
                              '<td style="text-align:right;padding-right:5px;width:18%;"><strong><span >Thành tiền</span></strong><br /></td>' +
                              '</tr>' +
                              '<td style="text-align:center;width:5%;"><span>{STT}</span><br /></td>' +
                              '<td style="width:40%;padding-left:5px;"><span >{Ten_Hang_Hoa}</span><br /></td>' +
                              '<td style="text-align:right;padding-right:5px;"><span >{Don_Gia}</span><br /></td>' +
                              '<td style="text-align:right;padding-right:5px;"><span >{Giam_Gia}</span><br /></td>' +
                              '<td style="text-align:center;"><span >{So_Luong}</span><br /></td>' +
                              '<td style="text-align:right;padding-right:5px;"><span >{Thanh_Tien}</span><br /></td>' +
                              '</tr>' +
                              '</tbody>' +
                              '</table>' +
                              '<br/>' +
                              '<table style="width:100%;">' +
                              '<tbody>' +
                              '<tr>' +
                              '<td style="text-align:right;"><span >Tổng tiền hàng:</span><br /></td>' +
                              '<td style="text-align:right;"><span >{Tong_Tien_Hang}</span><br /></td>' +
                              '</tr>' +
                              '<tr>' +
                              '<td style="text-align:right;"><span >Giảm giá:</span><br /></td>' +
                              '<td style="text-align:right;"><span >{Giam_Gia_Tren_Hoa_Don}</span><br /></td>' +
                              '</tr>' +
                              '<tr>' +
                              '<td style="text-align:right;"><span >Phí vận chuyển:</span><br /></td>' +
                              '<td style="text-align:right;"><span >{Phu_Phi}</span><br /></td>' +
                              '</tr>' +
                              '<tr>' +
                              '<td style="text-align:right;"><strong><span >Tổng thanh toán:</span></strong><br /></td>' +
                              '<td style="text-align:right;"><strong><span >{Tong_Thanh_Toan}</span></strong><br /></td>' +
                              '</tr>' +
                              '<tr>' +
                              '<td style="text-align:right;"><span >Đã thanh toán:</span><br /></td>' +
                              '<td style="text-align:right;"><span >{Da_Thanh_Toan}</span><br /></td>' +
                              '</tr>' +
                              '<tr>' +
                              '<td style="text-align:right;"><span >Còn nợ:</span><br /></td>' +
                              '<td style="text-align:right;"><span >{Chua_Thanh_Toan}</span><br /></td>' +
                              '</tr>' +
                              '</tbody>' +
                              '</table>' +
                              '<p><span >Ghi chú: </span> {Ghi_Chu}</p>',
            IsSelected: false,
            TemplAttrs:
                        [
                            { E: '{Ten_Cua_Hang}', M: '{{companyName}}' },
                            { E: '{Dia_Chi_Cua_Hang}', M: '{{companyAddress}}' },
                            { E: '{SDT_Cua_Hang}', M: '{{companyPhone}}' },
                            { E: '{Ten_Chi_Nhanh}', M: '{{storeName}}' },
                            { E: '{Dia_Chi_Chi_Nhanh}', M: '{{storeAddress}}' },
                            { E: '{SDT_Chi_Nhanh}', M: '{{storePhone}}' },
                            { E: '{Ngay_Xuat}', M: '{{saleDateString}}' },
                            { E: '{Ngay_Thang_Nam}', M: '{{Date | date:"dd/MM/yyyy HH:MM:ss"}}' },
                            { E: '{Ghi_Chu}', M: '{{comment}}' },
                            { E: '{Ma_Don_Hang}', M: '{{saleOrderCode}}' },
                            { E: '{Nhan_Vien_Ban_Hang}', M: '{{saleUserName}}' },
                            { E: '{Nhan_Vien_Thu_Ngan}', M: '{{cashierName}}' },
                            { E: '{Ma_Khach_Hang}', M: '{{customer.code}}' },
                            { E: '{Khach_Hang}', M: '{{customer.name}}' },
                            { E: '{So_Dien_Thoai}', M: '{{customer.phone}}' },
                            { E: '{Dia_Chi_Khach_Hang}', M: '{{customer.address}}' },
                            { E: '{STT}', M: '{{$index + 1}}' },
                            { E: '{Ma_Hang}', M: '{{item.barcode}}' },
                            { E: '{Ten_Hang_Hoa}', M: '{{item.itemName}} <i data-ng-if="item.isSerial==true">(<span ng-repeat="s in item.serials">{{s.serial}}{{$last ? "" : ","}}</span>)</i>' },
                            { E: '{Ghi_Chu_Hang_Hoa}', M: '{{Ghi chú hàng hóa}}' },
                            { E: '{So_Luong}', M: '{{item.quantity | roundQuantityIfFloating:2}}' },
                            { E: '{Don_Gia}', M: '{{item.unitPrice | number:0}}' },
                            { E: '{Don_Gia_Sau_Giam_Gia}', M: '{{item.discountIsPercent ? item.unitPrice*(1-item.discount/100): item.unitPrice - item.discount | number:0}}' },
                            { E: '{Giam_Gia}', M: '{{item.discountIsPercent ? item.discount * item.unitPrice / 100 : item.discount | number:0}}' },
                            { E: '{Giam_Gia_HH}', M: '<span data-ng-if="item.discount > 0 && item.discountIsPercent">{{item.discount | number:2}}%</span><span data-ng-if="item.discount > 0 && !item.discountIsPercent">{{item.discount | number:0}}</span>' },
                            { E: '{Thanh_Tien}', M: '{{item.subTotal | number:0}}' },
                            { E: '{Tong_So_Luong}', M: '{{totalQuantity}}' },
                            { E: '{Tong_Tien_Hang}', M: '{{subTotal | number:0}}' },
                            { E: '{Giam_Gia_Tren_Hoa_Don}', M: '{{discount | number:0}}' },
                            { E: '{Giam_Gia_PT_Tren_Hoa_Don}', M: '{{(discount * 100/subTotal) | number:2}}' },
                            { E: '{Phu_Phi}', M: '{{subFee | number:0}}' },
                            { E: '{Tong_Thanh_Toan}', M: '{{total | number:0}}' },
                            { E: '{Da_Thanh_Toan}', M: '{{amountPaid | number:0}}' },
                            { E: '{Chua_Thanh_Toan}', M: '{{paymentBalance | number:0}}' },
                            { E: '{Tien_Thua}', M: '{{amountPaid - total | number:0}}' },
                            { E: '{Tong_No_Khach_Hang}', M: '{{totalPaymentBalance | number:0}}' },
                            { E: '{Tien_Quy_Doi}', M: '{{exchangedMoney | number:0}}' },
                            { E: '{Diem_Tich_Luy}', M: '{{convertPoint}}' },
                            { E: '{Diem_Quy_Doi}', M: '{{exchangedPoint}}' },
                            { E: '{Diem_Con_Lai}', M: '{{customer.remainPoint - exchangedPoint + convertPoint}}' }
                        ]
        },
        //Type: 4, //4:Nhap hang
        {
            Code: 'Purchase_order',
            Name: 'Hóa đơn nhập hàng',
            Type: 4, //4:Nhap hang
            Content: '',
            Original: '<table style="width:100%;">' +
                                '<tbody>' +
                                '<tr> <td>{Ten_Cua_Hang}</td> </tr>' +
                                '<tr> <td><span >Địa chỉ: {Dia_Chi_Cua_Hang}</span></td> </tr>' +
                                '<tr> <td><span >Điện thoại: {SDT_Cua_Hang}</span></td> </tr>' +
                                '</tbody>' +
                                '</table>' +
                                '<div style="text-align:center;">' +
                                '<span ><strong>HÓA ĐƠN NHẬP HÀNG</strong></span>' +
                                '<br/>' +
                                '<span><strong>{Ma_Phieu_Nhap}</strong></span>' +
                                '</div>' +
                                '<div><span ><strong>Nhà cung cấp:</strong> {Nha_Cung_Cap}</span></div>' +
                                '<div><span><strong>Ngày nhập:</strong> {Ngay_Nhap}</span></div>' +
                                '<div><span><strong>Người nhập:</strong> {Nhan_Vien_Nhap_Hang}</span></div>' +
                                '<br />' +
                                '<table style="width:100%; border-collapse: collapse" border="1">' +
                                '<tbody>' +
                                '<tr>' +
                                '<td style="text-align:center;padding-right:5px;width:5%;"><strong><span>STT</span></strong></td>' +
                                '<td style="width:50%;padding-left:5px;"><strong><span >Tên hàng hóa</span></strong><br /></td>' +
                                '<td has-permission="POSIM_Price_ReadBuyPrice" style="text-align:right;padding-right:5px;width:15%;"><strong><span >Đơn giá</span></strong><br /></td>' +
                                '<td style="text-align:center;width:7%;"><strong><span >SL</span></strong><br /></td>' +
                                '<td has-permission="POSIM_Price_ReadBuyPrice" style="text-align:right;padding-right:5px;width:18%;"><strong><span >Thành tiền</span></strong><br /></td>' +
                                '</tr>' +
                                '<td style="text-align:center;width:5%;"><span>{STT}</span><br /></td>' +
                                '<td style="width:40%;padding-left:5px;"><span >{Ten_Hang_Hoa}</span><br /></td>' +
                                '<td has-permission="POSIM_Price_ReadBuyPrice" style="text-align:right;padding-right:5px;"><span >{Don_Gia}</span><br /></td>' +
                                '<td style="text-align:center;"><span >{So_Luong}</span><br /></td>' +
                                '<td has-permission="POSIM_Price_ReadBuyPrice" style="text-align:right;padding-right:5px;"><span>{Thanh_Tien}</span><br /></td>' +
                                '</tr>' +
                                '</tbody>' +
                                '</table>' +
                                '<br/>' +
                                '<table style="width:100%;">' +
                                '<tbody>' +
                                '<tr>' +
                                '<td has-permission="POSIM_Price_ReadBuyPrice" style="text-align:right;"><span >Tổng tiền hàng:</span><br /></td>' +
                                '<td has-permission="POSIM_Price_ReadBuyPrice" style="text-align:right;"><span >{Tong_Tien_Hang}</span><br /></td>' +
                                '</tr>' +
                                '<tr>' +
                                '<td has-permission="POSIM_Price_ReadBuyPrice" style="text-align:right;"><span >Tiền thuế:</span><br /></td>' +
                                '<td has-permission="POSIM_Price_ReadBuyPrice" style="text-align:right;"><span >{Tong_Tien_Thue}</span><br /></td>' +
                                '</tr>' +
                                '<tr>' +
                                '<td has-permission="POSIM_Price_ReadBuyPrice" style="text-align:right;"><strong><span >Tổng thanh toán:</span></strong><br /></td>' +
                                '<td has-permission="POSIM_Price_ReadBuyPrice" style="text-align:right;"><strong><span >{Tong_Thanh_Toan}</span></strong><br /></td>' +
                                '</tr>' +
                                '<tr>' +
                                '<td has-permission="POSIM_Price_ReadBuyPrice" style="text-align:right;"><span >Đã thanh toán:</span><br /></td>' +
                                '<td has-permission="POSIM_Price_ReadBuyPrice" style="text-align:right;"><span >{Da_Thanh_Toan}</span><br /></td>' +
                                '</tr>' +
                                '<tr>' +
                                '<td has-permission="POSIM_Price_ReadBuyPrice" style="text-align:right;"><span >Còn nợ:</span><br /></td>' +
                                '<td has-permission="POSIM_Price_ReadBuyPrice" style="text-align:right;"><span >{Chua_Thanh_Toan}</span><br /></td>' +
                                '</tr>' +
                                '</tbody>' +
                                '</table>' +
                                '<p><span >Ghi chú: </span> {Ghi_Chu}</p>',
            IsSelected: false,
            TemplAttrs:
                        [
                            { E: '{Ten_Cua_Hang}', M: '{{companyName}}' },
                            { E: '{Dia_Chi_Cua_Hang}', M: '{{companyAddress}}' },
                            { E: '{SDT_Cua_Hang}', M: '{{companyPhone}}' },
                            { E: '{Ten_Chi_Nhanh}', M: '{{storeName}}' },
                            { E: '{Dia_Chi_Chi_Nhanh}', M: '{{storeAddress}}' },
                            { E: '{SDT_Chi_Nhanh}', M: '{{storePhone}}' },
                            { E: '{Ngay_Nhap}', M: '{{purchaseDateString}}' },
                            { E: '{Ngay_Thang_Nam}', M: '{{Date | date:"dd/MM/yyyy HH:MM:ss"}}' },
                            { E: '{Ma_Phieu_Nhap}', M: '{{purchaseOrderCode}}' },
                            { E: '{Nhan_Vien_Nhap_Hang}', M: '{{purchaseUserName}}' },
                            { E: '{Nha_Cung_Cap}', M: '{{supplier.name}}' },
                            { E: '{SDT_Nha_Cung_Cap}', M: '{{supplier.phone}}' },
                            { E: '{Dia_Chi_Nha_Cung_Cap}', M: '{{supplier.address}}' },
                            { E: '{STT}', M: '{{$index + 1}}' },
                            { E: '{Ma_Hang}', M: '{{item.barcode}}' },
                            { E: '{Ten_Hang_Hoa}', M: '{{item.itemName}} <i data-ng-if="item.isSerial==true">(<span ng-repeat="s in item.serials">{{s.serial}}{{$last ? "" : ","}}</span>)</i>' },
                            { E: '{Ghi_Chu_Hang_Hoa}', M: '{{Ghi chú hàng hóa}}' },
                            { E: '{So_Luong}', M: '{{item.quantity}}' },
                            { E: '{Don_Gia}', M: '{{item.unitPrice | number:0}}' },
                            { E: '{Thanh_Tien}', M: '{{item.unitPrice * item.quantity | number:0}}' },
                            { E: '{Tong_So_Luong}', M: '{{totalQuantity}}' },
                            { E: '{Tong_Tien_Hang}', M: '{{subTotal | number:0}}' },
                            { E: '{Tong_Tien_Thue}', M: '{{tax | number:0}}' },
                            { E: '{Tong_Thanh_Toan}', M: '{{total | number:0}}' },
                            { E: '{Da_Thanh_Toan}', M: '{{amountPaid | number:0}}' },
                            { E: '{Chua_Thanh_Toan}', M: '{{paymentBalance | number:0}}' },
                            { E: '{Ghi_Chu}', M: '{{comment}}' }
                        ]
        },
        //Type: 8, //Phiếu chuyển kho
        {
            Code: 'Change_Order',
            Name: 'Phiếu chuyển kho',
            Type: 8, //2:Don hang
            Content: '',
            Original: '<table style="width:100%;">' +
                                '<tbody>' +
                                '<tr> <td>{Ten_Cua_Hang}</td> </tr>' +
                                '<tr> <td><span >Địa chỉ: {Dia_Chi_Cua_Hang}</span></td> </tr>' +
                                '<tr> <td><span >Điện thoại: {SDT_Cua_Hang}</span></td> </tr>' +
                                '</tbody>' +
                                '</table>' +
                                '<div style="text-align:center;">' +
                                '<span ><strong>PHIẾU CHUYỂN KHO</strong></span>' +
                                '<br/>' +
                                '<span><strong>{Ma_Phieu_Chuyen}</strong></span>' +
                                '</div>' +
                                '<div><span><strong>Ngày chuyển:</strong> {Ngay_Chuyen}</span></div>' +
                                '<div><span><strong>Người chuyển:</strong> {Nhan_Vien_Chuyen_Hang}</span></div>' +
                                '<div><span><strong>Từ kho:</strong> {Tu_Kho}</span></div>' +
                                '<div><span><strong>Đến kho:</strong> {Den_Kho}</span></div>' +
                                '<br />' +
                                '<table style="width:100%; border-collapse: collapse" border="1">' +
                                '<tbody>' +
                                '<tr>' +
                                '<td style="text-align:center;width:10%;"><strong><span>STT</span></strong></td>' +
                                '<td style="width:20%;padding-left:5px;"><strong><span >Mã hàng hóa</span></strong><br /></td>' +
                                '<td style="width:50%;padding-left:5px;"><strong><span >Tên hàng hóa</span></strong><br /></td>' +
                                '<td style="text-align:center;"><strong><span >SL</span></strong><br /></td>' +
                                '</tr>' +
                                '<td style="text-align:center;width:10%;"><span>{STT}</span><br /></td>' +
                                '<td style="width:20%;padding-left:5px;"><span >{Ma_Hang}</span><br /></td>' +
                                '<td style="width:50%;padding-left:5px;"><span >{Ten_Hang_Hoa}</span><br /></td>' +
                                '<td style="text-align:center;"><span >{So_Luong}</span><br /></td>' +
                                '</tr>' +
                                '</tbody>' +
                                '</table>' +
                                '<br/>' +
                                '<table style="width:100%;">' +
                                '<tbody>' +
                                '<tr>' +
                                '<td style="text-align:right;"><span >Tổng số lượng:</span><br /></td>' +
                                '<td style="text-align:center;"><span >{Tong_So_Luong}</span><br /></td>' +
                                '</tr>' +
                                '</tbody>' +
                                '</table>' +
                                '<p><span >Ghi chú: </span> {Ghi_Chu}</p>' +
                                '<br/>' +
                                '<table style="width:100%;">' +
                                '<theade>' +
                                '<th style="text-align:center;width:50%;"><span >Người chuyển <br/> (Ký và ghi rõ họ tên)</span><br /></th>' +
                                '<th style="text-align:center;"><span >Người nhận <br/> (Ký và ghi rõ họ tên)</span><br /></th>' +
                                '</thead>' +
                                '<tbody>' +
                                '<tr>' +
                                '<td style="text-align:center;width:50%;"><span ></span><br /></td>' +
                                '<td style="text-align:center;"><span ></span><br /></td>' +
                                '</tr>' +
                                '</tbody>',
            IsSelected: false,
            TemplAttrs:
                        [
                            { E: '{Ten_Cua_Hang}', M: '{{companyName}}' },
                            { E: '{Dia_Chi_Cua_Hang}', M: '{{companyAddress}}' },
                            { E: '{SDT_Cua_Hang}', M: '{{companyPhone}}' },
                            { E: '{Ten_Chi_Nhanh}', M: '{{storeName}}' },
                            { E: '{Dia_Chi_Chi_Nhanh}', M: '{{storeAddress}}' },
                            { E: '{SDT_Chi_Nhanh}', M: '{{storePhone}}' },
                            { E: '{Ngay_Chuyen}', M: '{{changeDateString}}' },
                            { E: '{Nhan_Vien_Chuyen_Hang}', M: '{{changeUserName}}' },
                            { E: '{Tu_Kho}', M: '{{fromStoreName}}' },
                            { E: '{Den_Kho}', M: '{{toStoreName}}' },
                            { E: '{Ngay_Thang_Nam}', M: '{{Date | date:"dd/MM/yyyy HH:MM:ss"}}' },
                            { E: '{Ghi_Chu}', M: '{{description}}' },
                            { E: '{Ma_Phieu_Chuyen}', M: '{{stockChangeCode}}' },
                            { E: '{Nhan_Vien_Chuyen_Hang}', M: '{{changeUserName}}' },
                            { E: '{STT}', M: '{{$index + 1}}' },
                            { E: '{Ma_Hang}', M: '{{item.barcode}}' },
                            { E: '{Ten_Hang_Hoa}', M: '{{item.itemName}} <i data-ng-if="item.isSerial==true">(<span ng-repeat="s in item.serials">{{s.serial}}{{$last ? "" : ","}}</span>)</i>' },
                            { E: '{So_Luong}', M: '{{item.changeQty}}' },
                            { E: '{Tong_So_Luong}', M: '{{totalQuantity}}' }
                        ]
        },
        //Type: 16, //16:Danh sách đơn hàng
        {
            Code: 'Sale_orders_list',
            Name: 'Phiếu giao hàng',
            Type: 16, //16:Danh sách đơn hàng
            Content: '',
            Original: '<table style="width:100%;">' +
    		          '<tbody>' +
                      '<tr> <td>{Ten_Cua_Hang}</td> </tr>' +
                      '<tr> <td><span >Địa chỉ: {Dia_Chi_Cua_Hang}</span></td> </tr>' +
                      '<tr> <td><span >Điện thoại: {SDT_Cua_Hang}</span></td> </tr>' +
                      '</tbody>' +
                      '</table>' +
                      '<div style="text-align:center;">' +
                      '<span ><strong>PHIẾU GIAO HÀNG</strong></span>' +
                      '<br/>' +
                      '<span><strong>{Ma_Don_Hang}</strong></span>' +
                      '</div>' +
                      '<table style="width:100%">' +
                      '<tr style="width:50%">' +
                      '<td><span>Khách hàng: {Khach_Hang}</span></td>' +
                      '<td><span>Ngày giao: {Ngay_Xuat}</span></td>' +

                      '</tr>' + '<tr style="width:50%">' +
                      '<td><span>Số ĐT: {So_Dien_Thoai}</span></td>' +
                      '<td><span >ĐV vận chuyển: {Don_Vi_Giao}</span></td>' +

                      '</tr>' +
                      '<tr style="width:50%">' +
                      '<td><span>Địa chỉ: {Dia_Chi_Khach_Hang}</span></td>' +
                      '<td><span>Nhân viên giao: {Nhan_Vien_Giao}</span></td>' +

                      '</tr></table>' +
                      '<br />' +
                      '<table style="width:100%; border-collapse: collapse" border="1">' +
                      '<tbody>' +
                      '<tr>' +
                      '<td style="text-align:center;width:5%;"><strong><span>STT</span></strong></td>' +
                      '<td style="width:40%;padding-left:5px;"><strong><span >Tên hàng hóa</span></strong><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;width:15%;"><strong><span >Đơn giá</span></strong><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;width:15%;"><strong><span >Giảm giá</span></strong><br /></td>' +
                      '<td style="text-align:center;width:7%;"><strong><span >SL</span></strong><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;width:18%;"><strong><span >Thành tiền</span></strong><br /></td>' +
                      '</tr> <tr>' +
                      '<td style="text-align:center;width:5%;"><span>{STT}</span><br /></td>' +
                      '<td style="width:40%;padding-left:5px;"><span >{Ten_Hang_Hoa}</span><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;"><span >{Don_Gia}</span><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;"><span >{Giam_Gia}</span><br /></td>' +
                      '<td style="text-align:center;"><span >{So_Luong}</span><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;"><span >{Thanh_Tien}</span><br /></td>' +
                      '</tr>' +
                      '</tbody>' +
                      '</table>' +
                      '<br/>' +
                      '<table style="width:100%;">' +
                      '<tbody>' +
                      '<tr>' +
                      '<td style="text-align:right;"><span >Tổng tiền hàng:</span><br /></td>' +
                      '<td style="text-align:right;"><span >{Tong_Tien_Hang}</span><br /></td>' +
                      '</tr>' +
                      '<tr>' +
                      '<td style="text-align:right;"><span >Giảm giá:</span><br /></td>' +
                      '<td style="text-align:right;"><span >{Giam_Gia_Tren_Hoa_Don}</span><br /></td>' +
                      '</tr>' +
                      '<tr>' +
                      '<td style="text-align:right;"><span >Phí vận chuyển:</span><br /></td>' +
                      '<td style="text-align:right;"><span >{Phu_Phi}</span><br /></td>' +
                      '</tr>' +
                      '<tr>' +
                      '<td style="text-align:right;"><strong><span >Tổng thanh toán:</span></strong><br /></td>' +
                      '<td style="text-align:right;"><strong><span >{Tong_Thanh_Toan}</span></strong><br /></td>' +
                      '</tr>' +
                      '<tr>' +
                      '<td style="text-align:right;"><span >Đã thanh toán:</span><br /></td>' +
                      '<td style="text-align:right;"><span >{Da_Thanh_Toan}</span><br /></td>' +
                      '</tr>' +
                      '<tr>' +
                      '<td style="text-align:right;"><span >Còn nợ:</span><br /></td>' +
                      '<td style="text-align:right;"><span >{Chua_Thanh_Toan}</span><br /></td>' +
                      '</tr>' +
                      '<tr>' +
                      '<td style="text-align:right;"><span >Khách trả thêm:</span><br /></td>' +
                      '<td style="text-align:right;">...........................<br /></td>' +
                      '</tr>' +
                      '</tbody>' +
                      '</table>' +
                      '<br/>' +
                      '<table style="width:100%">' +
                      '<tr>' +
                      '<td style="width:50%;text-align:center"> Chữ ký của người giao<br/>(Ký và ghi rõ họ tên)</td>' +
                      '<td style="width:50%;text-align:center"> Chữ ký Khách hàng<br/>(Ký và ghi rõ họ tên)</td>' +
                      '</tr>' +
                      '</table>',
            IsSelected: false,
            TemplAttrs:
                [
                    { E: '{Ten_Cua_Hang}', M: '{{companyName}}' },
                    { E: '{Dia_Chi_Cua_Hang}', M: '{{companyAddress}}' },
                    { E: '{SDT_Cua_Hang}', M: '{{companyPhone}}' },
                    { E: '{Ten_Chi_Nhanh}', M: '{{storeName}}' },
                    { E: '{Dia_Chi_Chi_Nhanh}', M: '{{storeAddress}}' },
                    { E: '{SDT_Chi_Nhanh}', M: '{{storePhone}}' },
                    { E: '{Ngay_Xuat}', M: '{{saleDateString}}' },
                    { E: '{Ngay_Thang_Nam}', M: '{{Date | date:"dd/MM/yyyy HH:MM:ss"}}' },
                    { E: '{Ghi_Chu}', M: '{{comment}}' },
                    { E: '{Ma_Don_Hang}', M: '{{saleOrderCode}}' },
                    { E: '{Ma_Khach_Hang}', M: '{{customer.code}}' },
                    { E: '{Khach_Hang}', M: '{{customer.name}}' },
                    { E: '{So_Dien_Thoai}', M: '{{customer.phone}}' },
                    { E: '{Dia_Chi_Khach_Hang}', M: '{{customer.address}}' },
                    { E: '{STT}', M: '{{$index + 1}}' },
                    { E: '{Ma_Hang}', M: '{{item.barcode}}' },
                    { E: '{Ten_Hang_Hoa}', M: '{{item.itemName}}' },
                    { E: '{Ghi_Chu_Hang_Hoa}', M: '{{Ghi chú hàng hóa}}' },
                    { E: '{So_Luong}', M: '{{item.quantity}}' },
                    { E: '{Don_Gia}', M: '{{item.unitPrice | number:0}}' },
                    { E: '{Don_Gia_Sau_Giam_Gia}', M: '{{item.discountIsPercent ? item.unitPrice*(1-item.discount/100): item.unitPrice - item.discount | number:0}}' },
                    { E: '{Giam_Gia}', M: '{{item.discountIsPercent ? item.discount * item.unitPrice / 100 : item.discount | number:0}}' },
                    { E: '{Giam_Gia_HH}', M: '<span data-ng-if="item.discount > 0 && item.discountIsPercent">{{item.discount | number:2}}%</span><span data-ng-if="item.discount > 0 && !item.discountIsPercent">{{item.discount | number:0}}</span>' },
                    { E: '{Thanh_Tien}', M: '{{item.subTotal | number:0}}' },
                    { E: '{Tong_So_Luong}', M: '{{totalQuantity}}' },
                    { E: '{Tong_Tien_Hang}', M: '{{subTotal | number:0}}' },
                    { E: '{Giam_Gia_Tren_Hoa_Don}', M: '{{discount | number:0}}' },
                    { E: '{Phu_Phi}', M: '{{subFee | number:0}}' },
                    { E: '{Tong_Thanh_Toan}', M: '{{total | number:0}}' },
                    { E: '{Da_Thanh_Toan}', M: '{{amountPaid | number:0}}' },
                    { E: '{Chua_Thanh_Toan}', M: '{{paymentBalance | number:0}}' },
                    { E: '{Don_Vi_Giao}', M: '{{shipper.name}}' },
                    { E: '{Nhan_Vien_Giao}', M: '{{shipper.shipper}}' },
                    { E: '{Tien_Thua}', M: '{{amountPaid - total | number:0}}' }
                ]
        },
        //Type: 32, //32: Phiếu chi
        {
            Code: 'Payment',
            Name: 'Phiếu chi',
            Type: 32,
            Content: '',
            Original: '<table style="width:100%;">' +
    		          '<tbody>' +
                      '<tr> <td>{Ten_Cua_Hang}</td> </tr>' +
                      '<tr> <td><span >Địa chỉ: {Dia_Chi_Cua_Hang}</span></td> </tr>' +
                      '<tr> <td><span >Điện thoại: {SDT_Cua_Hang}</span></td> </tr>' +
                      '</tbody>' +
                      '</table>' +
                      '<div style="text-align:center;">' +
                      '<span ><strong>PHIẾU CHI</strong></span>' +
                      '<br/>' +
                      '<span><strong>{Ma_Phieu_Chi}</strong></span>' +
                      '</div><br/>' +
                      '<div><span >Ngày chi: {Ngay_Chi} </span></div>' +
                      '<div><span>Người chi: {Nguoi_Chi} </span></div>' +
                      '<br />' +
                      '<table style="width:100%; border-collapse: collapse">' +
                      '<tbody>' +
                      '<tr>' +
                      '<td style="width:40%;padding-left:5px"><strong><span >Tên chi phí</span></strong><br /></td>' +
                      '<td style="text-align:center;padding-right:5px;width:25%;"><strong><span >Loại chi phí</span></strong><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;width:30%;"><strong><span >Thành tiền</span></strong><br /></td>' +
                      '</tr>' +
                      '<tr>' +
                      '<td style="padding-left:5px"><span >{Ten_Chi_Phi}</span><br /></td>' +
                      '<td style="text-align:center;padding-right:5px;"><span >{Loai_Chi_Phi}</span><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;"><span >{Thanh_Tien}</span><br /></td>' +
                      '</tr>' +
                      '</tbody>' +
                      '</table><br/>' +
                      '<p><span >Ghi chú: </span> {Ghi_Chu}</p>' +
                      '<br/><br/>' +
                      '<table style="width:100%">' +
                      '<tr>' +
                      '<td style="text-align:right;padding-right:10%;"> Người chi &nbsp; &nbsp; &nbsp; &nbsp;&nbsp;<br/><span>(Ký và ghi rõ họ tên)</span></td>' +
                      '</tr>' +
                      '</table>',
            IsSelected: false,
            TemplAttrs:
                [
                    { E: '{Ten_Cua_Hang}', M: '{{companyName}}' },
                    { E: '{Dia_Chi_Cua_Hang}', M: '{{companyAddress}}' },
                    { E: '{SDT_Cua_Hang}', M: '{{companyPhone}}' },
                    { E: '{Ten_Chi_Nhanh}', M: '{{storeName}}' },
                    { E: '{Dia_Chi_Chi_Nhanh}', M: '{{storeAddress}}' },
                    { E: '{SDT_Chi_Nhanh}', M: '{{storePhone}}' },
                    { E: '{Ngay_Thang_Nam}', M: '{{Date | date:"dd/MM/yyyy HH:MM:ss"}}' },
                    { E: '{Ngay_Chi}', M: '{{receivedDate}}' },
                    { E: '{Nguoi_Chi}', M: '{{payer}}' },
                    { E: '{Ma_Phieu_Chi}', M: '{{code}}' },
                    { E: '{Ten_Chi_Phi}', M: '{{name}}' },
                    { E: '{Loai_Chi_Phi}', M: '{{typename}}' },
                    { E: '{Thanh_Tien}', M: '{{payment | number:0}}' },
                    { E: '{Ghi_Chu}', M: '{{description}}' }
                ]
        },
        //Type: 64, //64:Phiếu xuất trả
        {
            Code: 'Sale_return_order',
            Name: 'Phiếu xuất trả nhà cung cấp',
            Type: 64, //64:Phiếu xuất trả
            Content: '',
            Original: '<table style="width:100%;">' +
                                '<tbody>' +
                                '<tr> <td>{Ten_Cua_Hang}</td> </tr>' +
                                '<tr> <td><span >Địa chỉ: {Dia_Chi_Cua_Hang}</span></td> </tr>' +
                                '<tr> <td><span >Điện thoại: {SDT_Cua_Hang}</span></td> </tr>' +
                                '</tbody>' +
                                '</table>' +
                                '<div style="text-align:center;">' +
                                '<span ><strong>PHIẾU XUẤT TRẢ</strong></span>' +
                                '<br/>' +
                                '<span><strong>{Ma_Don_Hang}</strong></span>' +
                                '</div>' +
                                '<div><span><strong>Ngày trả:</strong> {Ngay_Xuat}</span></div>' +
                                '<div><span ><strong>Nhà cung cấp:</strong> {Khach_Hang}</span></div>' +
                                '<div><span><strong>Người trả:</strong> {Nguoi_Tra}</span></div>' +
                                '<br />' +
                                '<table style="width:100%; border-collapse: collapse" border="1">' +
                                '<tbody>' +
                                '<tr>' +
                                '<td style="text-align:center;width:5%;"><strong><span>STT</span></strong></td>' +
                                '<td style="width:40%;padding-left:5px;"><strong><span >Tên hàng hóa</span></strong><br /></td>' +
                                '<td style="text-align:right;padding-right:5px;width:15%;"  data-ng-if="isAdmin"><strong><span >Đơn giá</span></strong><br /></td>' +
                                '<td style="text-align:center;width:7%;"><strong><span >SL</span></strong><br /></td>' +
                                '<td style="text-align:right;padding-right:5px;width:18%;"  data-ng-if="isAdmin"><strong><span >Thành tiền</span></strong><br /></td>' +
                                '</tr>' +
                                '<td style="text-align:center;width:5%;"><span>{STT}</span><br /></td>' +
                                '<td style="width:40%;padding-left:5px;"><span >{Ten_Hang_Hoa}</span><br /></td>' +
                                '<td style="text-align:right;padding-right:5px;" data-ng-if="isAdmin"><span >{Don_Gia}</span><br /></td>' +
                                '<td style="text-align:center;"><span >{So_Luong}</span><br /></td>' +
                                '<td style="text-align:right;padding-right:5px;" data-ng-if="isAdmin"><span >{Thanh_Tien}</span><br /></td>' +
                                '</tr>' +
                                '</tbody>' +
                                '</table>' +
                                '<br/>' +
                                '<table style="width:100%;">' +
                                '<tbody>' +
                                '<tr data-ng-if="isAdmin">' +
                                '<td style="text-align:right;"><strong><span >Tổng thanh toán:</span></strong><br /></td>' +
                                '<td style="text-align:right;"><strong><span >{Tong_Thanh_Toan}</span></strong><br /></td>' +
                                '</tr>' +
                                '<tr data-ng-if="isAdmin">' +
                                '<td style="text-align:right;"><span >Đã thanh toán:</span><br /></td>' +
                                '<td style="text-align:right;"><span >{Da_Thanh_Toan}</span><br /></td>' +
                                '</tbody>' +
                                '</table>' +
                                '<p><span >Ghi chú: </span> {Ghi_Chu}</p>',
            IsSelected: false,
            TemplAttrs:
                        [
                            { E: '{Ten_Cua_Hang}', M: '{{companyName}}' },
                            { E: '{Dia_Chi_Cua_Hang}', M: '{{companyAddress}}' },
                            { E: '{SDT_Cua_Hang}', M: '{{companyPhone}}' },
                            { E: '{Ten_Chi_Nhanh}', M: '{{storeName}}' },
                            { E: '{Dia_Chi_Chi_Nhanh}', M: '{{storeAddress}}' },
                            { E: '{SDT_Chi_Nhanh}', M: '{{storePhone}}' },
                            { E: '{Ngay_Xuat}', M: '{{saleDateString}}' },
                            { E: '{Ngay_Thang_Nam}', M: '{{Date | date:"dd/MM/yyyy HH:MM:ss"}}' },
                            { E: '{Ghi_Chu}', M: '{{comment}}' },
                            { E: '{Ma_Don_Hang}', M: '{{saleOrderCode}}' },
                            { E: '{Nhan_Vien_Ban_Hang}', M: '{{saleUserName}}' },
                            { E: '{Nguoi_Tra}', M: '{{returnUserDisplay}}' },
                            { E: '{Ma_Khach_Hang}', M: '{{supplier.code}}' },
                            { E: '{Khach_Hang}', M: '{{supplier.name}}' },
                            { E: '{So_Dien_Thoai}', M: '{{supplier.phone}}' },
                            { E: '{Dia_Chi_Khach_Hang}', M: '{{supplier.address}}' },
                            { E: '{STT}', M: '{{$index + 1}}' },
                            { E: '{Ma_Hang}', M: '{{item.barcode}}' },
                            { E: '{Ten_Hang_Hoa}', M: '{{item.itemName}} <i data-ng-if="item.isSerial==true">(<span ng-repeat="s in item.serials">{{s.serial}}{{$last ? "" : ","}}</span>)</i>' },
                            { E: '{Ghi_Chu_Hang_Hoa}', M: '{{Ghi chú hàng hóa}}' },
                            { E: '{So_Luong}', M: '{{(item.qtyAvailable == undefined) ? item.quantity : item.qtyAvailable }}' },
                            { E: '{Don_Gia}', M: '{{item.unitPrice | number:0}}' },
                            { E: '{Thanh_Tien}', M: '{{(isAdmin) ? item.subTotal : 0 | number:0}}' },
                            { E: '{Tong_So_Luong}', M: '{{totalQuantity}}' },
                            { E: '{Tong_Tien_Hang}', M: '{{(isAdmin) ? subTotal : 0 | number:0}}' },
                            { E: '{Tong_Thanh_Toan}', M: '{{total | number:0}}' },
                            { E: '{Da_Thanh_Toan}', M: '{{(isAdmin)? amountPaid : 0 | number:0}}' },
                            { E: '{Chua_Thanh_Toan}', M: '{{paymentBalance | number:0}}' },
                            { E: '{Tien_Thua}', M: '{{amountPaid - total | number:0}}' },
                            { E: '{Tong_No_Khach_Hang}', M: '{{totalPaymentBalance | number:0}}' }
                        ]
        },
        //Type: 128 Mẫu in phiếu báo bếp
        {
            Code: 'kitchen_order_small',
            Type: 128, //128: in bếp
            Name: 'Mẫu in bếp',
            Content: '',
            Original: '<table style="width:100%">' +
                        '<tbody>' +
                        '<tr> <td style=";font-size:12px;">{Ten_Cua_Hang}</td> </tr>' +
                        // '<tr> <td style="font-size:12px;"><span >Địa chỉ: {Dia_Chi_Cua_Hang}</span></td> </tr>' +
                        // '<tr> <td style=";font-size:12px;"><span >Điện thoại: {SDT_Cua_Hang}</span></td> </tr>' +
                        '</tbody>' +
                        '</table>' +
                        '<div style="text-align:center;font-size:14px;">' +
                        '<span ><strong style="text-align:center;font-size:14px;">PHIẾU IN BẾP</strong></span>' +
                        '<br/>' +
                        '<span><strong style="text-align:center;font-size:14px;"> PIB #{Stt_in_bep}</strong></span>' +
                        '</div>' +
                        '<div style="font-size:12px;"><span><strong>Ngày bán:</strong> {Ngay_Xuat}</span></div>' +
                        '<div style="font-size:12px;"><span><strong>Bàn / phòng:</strong> {Ten_ban_phong}</span></div>' +
                        '<div style="font-size:12px;"><span><strong>Phục vụ :</strong> {Nhan_Vien_Ban_Hang}</span></div>' +
                        '<br />' +
                        '<table style="width:100%" padding="2">' +
                        '<tbody>' +
                        '<tr>' +
                        '<td style="width:80%;font-size:12px;"><strong><span >MÓN</span></strong><br /></td>' +
                        '<td style="text-align:center;width:20%;font-size:12px;"><strong><span >SL</span></strong><br /></td>' +
                        // '<td style="text-align:right;font-size:12px;padding-right:10px;"><strong><span >TT</span></strong><br /></td>' +
                        '</tr>' +
                        '<tr> <td><span style="font-size:12px;"><strong>{Ten_Hang_Hoa}</strong></span><br /></td>' +
                        '<td style="text-align:center;font-size:12px;"><span >{So_Luong}</span><br /></td>' +
                        '</tr>' +
                        '<tr> <td><span style="font-size:12px;">Ghi chú món : {Ghi_chu_mon}</span><br /></td>' +
                        '</tr>' +
                        // '<td style="font-size:12px;"><span >{Don_Gia_Sau_Giam_Gia}</span><br /></td>' +
                        // '<td style="text-align:center;font-size:12px;"><span >{So_Luong}</span><br /></td>' +
                        // '<td style="text-align:right;font-size:12px;padding-right:10px;"><span >{Thanh_Tien}</span><br /></td>' +
                        // '</tr>' +
                        '</tbody>' +
                        '</table>' +
                        '<br/>' +

                        '<p style="text-align:left;font-size:12px;"><span >Ghi chú: </span> {Ghi_Chu}</p>' +
                        '<div style="text-align:left;font-size:12px;">' +

                        '</div >',
            IsSelected: true,
            TemplAttrs:
                [
                    { E: '{Ten_Cua_Hang}', M: '{{companyName}}' },
                    { E: '{Dia_Chi_Cua_Hang}', M: '{{companyAddress}}' },
                    { E: '{SDT_Cua_Hang}', M: '{{companyPhone}}' },
                    { E: '{Ten_Chi_Nhanh}', M: '{{storeName}}' },
                    { E: '{Dia_Chi_Chi_Nhanh}', M: '{{storeAddress}}' },
                    { E: '{SDT_Chi_Nhanh}', M: '{{storePhone}}' },
                    { E: '{Ngay_Xuat}', M: '{{saleDateString}}' },
                    { E: '{Ngay_Thang_Nam}', M: '{{Date | date:"dd/MM/yyyy HH:mm:ss"}}' },
                    { E: '{Ghi_Chu}', M: '{{comment}}' },
                    { E: '{Ma_Don_Hang}', M: '{{saleOrderCode}}' },
                    { E: '{Stt_in_bep}', M: '{{printedCount}}' },
                    { E: '{Nhan_Vien_Ban_Hang}', M: '{{saleUserName}}' },
                    { E: '{Nhan_Vien_Thu_Ngan}', M: '{{cashierName}}' },
                    { E: '{Ma_Khach_Hang}', M: '{{customer.code}}' },
                    { E: '{Khach_Hang}', M: '{{customer.name}}' },
                    { E: '{So_Dien_Thoai}', M: '{{customer.phone}}' },
                    { E: '{Dia_Chi_Khach_Hang}', M: '{{customer.address}}' },
                    { E: '{Ten_ban_phong}', M: '{{tableName}}' },
                    { E: '{STT}', M: '{{$index+1}}' },
                    { E: '{Ma_Hang}', M: '{{item.barcode}}' },
                    { E: '{Ten_Hang_Hoa}', M: '{{item.itemName}} <i data-ng-if="item.isSerial==true">(<span ng-repeat="s in item.serials">{{s.serial}}{{$last ? "" : ","}}</span>)</i>' },

                    { E: '{Ghi_chu_mon}', M: '{{item.comment | blankIfNullOrUndefined}}' },
                    { E: '{So_Luong}', M: '{{item.quantity}}' },
                    { E: '{Don_Gia_Sau_Giam_Gia}', M: '{{item.discountIsPercent ? item.unitPrice*(1-item.discount/100): item.unitPrice - item.discount | number:0}}' },
                    { E: '{Don_Gia}', M: '{{item.unitPrice | number:0}}' },
                    { E: '{Giam_Gia}', M: '{{item.discountIsPercent ? item.discount * item.unitPrice / 100 : item.discount | number:0}}' },
                    { E: '{Giam_Gia_HH}', M: '<span data-ng-if="item.discount > 0 && item.discountIsPercent">{{item.discount | number:2}}%</span><span data-ng-if="item.discount > 0 && !item.discountIsPercent">{{item.discount | number:0}}</span>' },
                    { E: '{Thanh_Tien}', M: '{{item.subTotal | number:0}}' },
                    { E: '{Tong_So_Luong}', M: '{{totalQuantity}}' },
                    { E: '{Tong_Tien_Hang}', M: '{{subTotal | number:0}}' },
                    { E: '{Giam_Gia_Tren_Hoa_Don}', M: '{{discount | number:0}}' },
                    { E: '{Giam_Gia_PT_Tren_Hoa_Don}', M: '{{(discount*100/subTotal) | number:2}}' },
                    { E: '{Phu_Phi}', M: '{{subFee | number:0}}' },
                    { E: '{Tong_Thanh_Toan}', M: '{{total | number:0}}' },
                    { E: '{Da_Thanh_Toan}', M: '{{amountPaid | number:0}}' },
                    { E: '{Chua_Thanh_Toan}', M: '{{paymentBalance | number:0}}' },
                    { E: '{Tien_Thua}', M: '{{amountPaid - total | number:0}}' },
                    { E: '{Tong_No_Khach_Hang}', M: '{{totalPaymentBalance | number:0}}' }
                ]
        },
        //Type: 256 Mẫu in tem báo bếp
        {
            Code: 'kitchen_order_stamps',
            Type: 256, //128: in bếp
            Name: 'Mẫu in tem báo bếp',
            Content: '',
            Original: '<div style="break-before: page; margin-top:5px;">'
                        + '<p style="font-family:tahoma;font-size:10px;padding:0;margin:0"><b>{Ten_Hang_Hoa} <span ng-if="item.quantity > 1">(x{So_Luong})<span></b></p>'
                        + '<ul style="margin:0;padding:0">'
                        + '<li ng-repeat="i in item.childItem" style="font-size:8px;list-style:none;margin:0;padding:0;width:50%;float:left;font-family:tahoma">- {{i.childName}} <span>(x{{i.quantity}})</span></li>'
                        + '</ul>'
						+ '<div style="clear:both"></div>'
                        + '<p style="font-family:tahoma;font-size:8px;font-style:italic;text-decoration:underline;padding:0;margin:0" ng-if="item.comment !== null && item.comment !== undefined && item.comment !== \'\' ">* {Ghi_chu_mon}</p>'
                        + '</div>',
            IsSelected: true,
            TemplAttrs:
                [
                    { E: '{Ten_Cua_Hang}', M: '{{companyName}}' },
                    { E: '{Dia_Chi_Cua_Hang}', M: '{{companyAddress}}' },
                    { E: '{SDT_Cua_Hang}', M: '{{companyPhone}}' },
                    { E: '{Ten_Chi_Nhanh}', M: '{{storeName}}' },
                    { E: '{Dia_Chi_Chi_Nhanh}', M: '{{storeAddress}}' },
                    { E: '{SDT_Chi_Nhanh}', M: '{{storePhone}}' },
                    { E: '{Ngay_Xuat}', M: '{{saleDateString}}' },
                    { E: '{Ngay_Thang_Nam}', M: '{{Date | date:"dd/MM/yyyy HH:mm:ss"}}' },
                    { E: '{Ghi_Chu}', M: '{{comment}}' },
                    { E: '{Ma_Don_Hang}', M: '{{saleOrderCode}}' },
                    { E: '{Stt_in_bep}', M: '{{printedCount}}' },
                    { E: '{Nhan_Vien_Ban_Hang}', M: '{{saleUserName}}' },
                    { E: '{Nhan_Vien_Thu_Ngan}', M: '{{cashierName}}' },
                    { E: '{Ma_Khach_Hang}', M: '{{customer.code}}' },
                    { E: '{Khach_Hang}', M: '{{customer.name}}' },
                    { E: '{So_Dien_Thoai}', M: '{{customer.phone}}' },
                    { E: '{Dia_Chi_Khach_Hang}', M: '{{customer.address}}' },
                    { E: '{Ten_ban_phong}', M: '{{tableName}}' },
                    { E: '{STT}', M: '{{$index+1}}' },
                    { E: '{Ma_Hang}', M: '{{item.barcode}}' },
                    { E: '{Ten_Hang_Hoa}', M: '{{item.itemName}} <i data-ng-if="item.isSerial==true">(<span ng-repeat="s in item.serials">{{s.serial}}{{$last ? "" : ","}}</span>)</i>' },

                    { E: '{Ghi_chu_mon}', M: '{{item.comment | blankIfNullOrUndefined}}' },
                    { E: '{So_Luong}', M: '{{item.quantity}}' },
                    { E: '{Don_Gia_Sau_Giam_Gia}', M: '{{item.discountIsPercent ? item.unitPrice*(1-item.discount/100): item.unitPrice - item.discount | number:0}}' },
                    { E: '{Don_Gia}', M: '{{item.unitPrice | number:0}}' },
                    { E: '{Giam_Gia}', M: '{{item.discountIsPercent ? item.discount * item.unitPrice / 100 : item.discount | number:0}}' },
                    { E: '{Giam_Gia_HH}', M: '<span data-ng-if="item.discount > 0 && item.discountIsPercent">{{item.discount | number:2}}%</span><span data-ng-if="item.discount > 0 && !item.discountIsPercent">{{item.discount | number:0}}</span>' },
                    { E: '{Thanh_Tien}', M: '{{item.subTotal | number:0}}' },
                    { E: '{Tong_So_Luong}', M: '{{totalQuantity}}' },
                    { E: '{Tong_Tien_Hang}', M: '{{subTotal | number:0}}' },
                    { E: '{Giam_Gia_Tren_Hoa_Don}', M: '{{discount | number:0}}' },
                    { E: '{Giam_Gia_PT_Tren_Hoa_Don}', M: '{{(discount*100/subTotal) | number:2}}' },
                    { E: '{Phu_Phi}', M: '{{subFee | number:0}}' },
                    { E: '{Tong_Thanh_Toan}', M: '{{total | number:0}}' },
                    { E: '{Da_Thanh_Toan}', M: '{{amountPaid | number:0}}' },
                    { E: '{Chua_Thanh_Toan}', M: '{{paymentBalance | number:0}}' },
                    { E: '{Tien_Thua}', M: '{{amountPaid - total | number:0}}' },
                    { E: '{Tong_No_Khach_Hang}', M: '{{totalPaymentBalance | number:0}}' }
                ]
        },
        //Type: 512 Mẫu in báo cáo cuối ngày
        {
            Code: 'report',
            Name: 'Báo cáo cuối ngày',
            Type: 512,
            Content: '',
            Original: '<table style="width:100%;">' +
                      '<tbody>' +
                      '<tr> <td>{Ten_Chi_Nhanh}</td> </tr>' +
                      '<tr> <td><span >Địa chỉ: {Dia_Chi_Chi_Nhanh}</span></td> </tr>' +
                      '<tr> <td><span >Điện thoại: {SDT_Chi_Nhanh}</span></td> </tr>' +
                      '</tbody>' +
                      '</table>' +
                      '<div style="text-align:center;">' +
                      '<span ><strong>Báo cáo bán hàng</strong></span>' +
                      '<br/>' +
                      '<span><strong>Từ ngày {Tu_Ngay} </strong></span>' +
                      '<span><strong> - Đến ngày {Den_Ngay} </strong></span>' +
                      '<br/>' +
                      '<span><strong></strong></span>' +
                      '</div><br/>' +
                      '<table style="width:60%; border-collapse: collapse" align="center">' +
                      '<tbody>' +
                      '<tr>' +
                      '<td style="padding-left:5px"><span >Loại thanh toán:</span><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;"><span >{Loai_Thanh_Toan}</span><br /></td>' +
                      '</tr>' +
                      '<tr>' +
                      '<td style="padding-left:5px"><span >Số đơn hàng:</span><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;"><span >{So_Don_Hang}</span><br /></td>' +
                      '</tr>' +
                      '<tr>' +
                      '<td style="padding-left:5px"><span >Tồn quỹ đầu ngày:</span><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;"><span >{Ton_Quy_Dau_Ngay}</span><br /></td>' +
                      '</tr>' +
                      '<tr>' +
                      '<td style="padding-left:5px"><span >Thu bán hàng:</span><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;"><span >{Thu_Ban_Hang}</span><br /></td>' +
                      '</tr>' +
                      '<tr ng-if="totalPaidDebt > 0">' +
                      '<td style="padding-left:5px"><span >Thu nợ:</span><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;"><span >{Thu_No}</span><br /></td>' +
                      '</tr>' +
                      '<tr ng-if="totalExpense > 0">' +
                      '<td style="padding-left:5px"><span >Chi phí:</span><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;"><span >({Chi_Phi})</span><br /></td>' +
                      '</tr>' +
                      '<tr>' +
                      '<td style="padding-left:5px"><span >Tồn quỹ cuối ngày:</span><br /></td>' +
                      '<td style="text-align:right;padding-right:5px;"><span >{Ton_Quy_Cuoi_Ngay}</span><br /></td>' +
                      '</tr>' +
                      '</tbody>' +
                      '</table><br/>' +
                      '<br/><br/>' +
                      '<table style="width:100%">' +
                      '<tr>' +
                      '<td style="text-align:left;padding-left:10%;"> Người in báo cáo &nbsp; &nbsp; &nbsp; &nbsp;&nbsp;<br/><span>(Ký và ghi rõ họ tên)</span></td>' +
                      '<td style="text-align:right;padding-right:10%;"> Người xác nhận &nbsp; &nbsp; &nbsp; &nbsp;&nbsp;<br/><span>(Ký và ghi rõ họ tên)</span></td>' +
                      '</tr>' +
                      '</table>',
            IsSelected: false,
            TemplAttrs:
                [
                    { E: '{Ten_Cua_Hang}', M: '{{companyName}}' },
                    { E: '{Dia_Chi_Cua_Hang}', M: '{{companyAddress}}' },
                    { E: '{SDT_Cua_Hang}', M: '{{companyPhone}}' },
                    { E: '{Ten_Chi_Nhanh}', M: '{{storeName}}' },
                    { E: '{Dia_Chi_Chi_Nhanh}', M: '{{storeAddress}}' },
                    { E: '{SDT_Chi_Nhanh}', M: '{{storePhone}}' },
                    { E: '{Tu_Ngay}', M: '{{fromDate | date:"dd/MM/yyyy HH:mm"}}' },
                    { E: '{Den_Ngay}', M: '{{toDate | date:"dd/MM/yyyy HH:mm"}}' },
                    { E: '{So_Don_Hang}', M: '{{saleCount}}' },
                    { E: '{Thu_Ban_Hang}', M: '{{total | number}}' },
                    { E: '{Thu_No}', M: '{{totalPaidDebt}}' },
                    { E: '{Khach_No}', M: '{{debtTotal | number}}' },
                    { E: '{Chi_Phi}', M: '{{totalExpense | number}}' },
                    { E: '{Ton_Quy_Dau_Ngay}', M: '{{balance | number}}' },
                    { E: '{Ton_Quy_Cuoi_Ngay}', M: '{{totalCash | number}}' },
                    { E: '{Loai_Thanh_Toan}', M: '{{paymentMethod}}' },
                ]
        },
    ],
    Expressions: [
        { M: '{Ten_Cua_Hang}', H: 'Hiển thị tên cửa hàng/công ty', T: 255 },
        { M: '{Dia_Chi_Cua_Hang}', H: 'Địa chỉ cửa hàng', T: 255 },
        { M: '{SDT_Cua_Hang}', H: 'Điện thoại cửa hàng', T: 255 },
        { M: '{Ten_Chi_Nhanh}', H: 'Hiển thị tên chi nhánh cửa hàng', T: 255 },
        { M: '{Dia_Chi_Chi_Nhanh}', H: 'Địa chỉ chi nhánh cửa hàng', T: 255 },
        { M: '{SDT_Chi_Nhanh}', H: 'Điện thoại chi nhánh cửa hàng', T: 255 },
        { M: '{Tu_Kho}', H: 'Chi nhánh cửa hàng được chuyển hàng đi', T: 8 },
        { M: '{Den_Kho}', H: 'Chi nhánh cửa hàng được chuyển hàng đến', T: 8 },
        { M: '{Ngay_Xuat}', H: 'Ngày tháng năm xuất hàng', T: 19 },
        { M: '{Ngay_Nhap}', H: 'Ngày tháng năm nhập hàng', T: 4 },
        { M: '{Ngay_Chuyen}', H: 'Ngày tháng năm chuyển hàng', T: 8 },
        { M: '{Ngay_Thang_Nam}', H: 'Ngày tháng năm hiện tại', T: 255 },
        { M: '{Ghi_Chu}', H: 'Hiển thị ghi chú trong hóa đơn', T: 255 },
        { M: '{Ma_Don_Hang}', H: 'Hiển thị mã đơn hàng', T: 19 },
        { M: '{Ma_Phieu_Nhap}', H: 'Hiển thị mã phiếu nhập', T: 4 },
        { M: '{Ma_Phieu_Chuyen}', H: 'Hiển thị mã phiếu chuyển', T: 8 },
        { M: '{Nhan_Vien_Ban_Hang}', H: 'Hiển thị nhân viên bán hàng', T: 3 },
        { M: '{Nhan_Vien_Nhap_Hang}', H: 'Hiển thị nhân viên nhập hàng', T: 4 },
        { M: '{Nhan_Vien_Chuyen_Hang}', H: 'Hiển thị nhân viên chuyển hàng', T: 8 },
        { M: '{Nhan_Vien_Thu_Ngan}', H: 'Hiển thị nhân viên thu ngân', T: 3 },
        { M: '{Ma_Khach_Hang}', H: 'Hiển thị mã khách hàng', T: 19 },
        { M: '{Khach_Hang}', H: 'Hiển thị tên khách hàng', T: 19 },
        { M: '{So_Dien_Thoai}', H: 'Hiển thị số điện thoại khách hàng', T: 19 },
        { M: '{Dia_Chi_Khach_Hang}', H: 'Hiển thị địa chỉ khách hàng', T: 19 },
        { M: '{Nha_Cung_Cap}', H: 'Hiển thị tên khách hàng', T: 4 },
        { M: '{SDT_Nha_Cung_Cap}', H: 'Hiển thị số điện thoại nhà cung cấp', T: 4 },
        { M: '{Dia_Chi_Nha_Cung_Cap}', H: 'Hiển thị địa chỉ nhà cung cấp', T: 4 },
        { M: '{STT}', H: 'Hiển thị số thứ tự', T: 31 },
        { M: '{Ma_Hang}', H: 'Hiển thị mã hàng hóa', T: 31 },
        { M: '{Ten_Hang_Hoa}', H: 'Hiển thị tên hàng hóa', T: 31 },
        { M: '{Ghi_Chu_Hang_Hoa}', H: 'Ghi chú hàng hóa', T: 31 },
        { M: '{So_Luong}', H: 'Hiển thị số lượng hàng hóa', T: 31 },
        { M: '{Don_Gia}', H: 'Hiển thị đơn giá', T: 23 },
        { M: '{Giam_Gia}', H: 'Hiển thị giảm giá trên hàng hóa đã thành tiền', T: 19 },
        { M: '{Giam_Gia_HH}', H: 'Hiển thị giảm giá trên hàng hóa đã nhập', T: 19 },
        { M: '{Don_Gia_Sau_Giam_Gia}', H: 'Hiển thị đơn giá bán đã trừ giảm giá trên hàng hóa', T: 19 },
        { M: '{Thanh_Tien}', H: 'Hiển thị thành tiền ', T: 39 },
        { M: '{Tong_So_Luong}', H: 'Hiển thị tổng số lượng', T: 31 },
        { M: '{Tong_Tien_Hang}', H: 'Hiển thị tổng tiền hàng bán', T: 7 },
        { M: '{Giam_Gia_Tren_Hoa_Don}', H: 'Hiển thị giảm giá trên tổng hóa đơn', T: 19 },
        { M: '{Giam_Gia_PT_Tren_Hoa_Don}', H: 'Hiển thị giảm giá theo phần trăm trên tổng hóa đơn', T: 19 },
        { M: '{Tong_Tien_Thue}', H: 'Hiển thị tổng tiền thuế cho phiếu nhập', T: 4 },
        { M: '{Phu_Phi}', H: 'Phụ phí khác như Phí vận chuyển, Phí dịch vụ', T: 19 },
        { M: '{Tong_Thanh_Toan}', H: 'Hiển thị tổng tiền cần thanh toán', T: 7 },
        { M: '{Da_Thanh_Toan}', H: 'Hiển thị số tiền khách hàng đã thanh toán', T: 23 },
        { M: '{Chua_Thanh_Toan}', H: 'Hiển thị số tiền khách hàng còn nợ', T: 23 },
        { M: '{Tien_Thua}', H: 'Hiển thị số tiền cần thối lại cho khách hàng', T: 19 },
        { M: '{Don_Vi_Giao}', H: 'Hiển thị đơn vị giao vận', T: 16 },
        { M: '{Nhan_Vien_Giao}', H: 'Hiển thị nhân viên giao vận đơn hàng', T: 16 },
        { M: '{Ngay_Chi}', H: 'Ngày tháng năm tạo phiếu chi', T: 32 },
        { M: '{Ma_Phieu_Chi}', H: 'Hiển thị mã phiếu chi', T: 32 },
        { M: '{Nguoi_Chi}', H: 'Hiển thị người tạo phiếu chi', T: 32 },
        { M: '{Ten_Chi_Phi}', H: 'Tên chi phí', T: 32 },
        { M: '{Loai_Chi_Phi}', H: 'Loai chi phí', T: 32 },
        { M: '{Tong_No_Khach_Hang}', H: 'Hiển thị tổng nợ của khách hàng', T: 3 },
    ]
};
