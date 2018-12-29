
angular.module('SunoPosCafe', ['ionic','sunoPos.factory','SunoPosCafe.controllers','sunoPos.printerFactory'])

.run(function($ionicPlatform,$rootScope, $location, $window,$ionicScrollDelegate) {
  $ionicPlatform.ready(function() {

    if (ionic.Platform.isAndroid() || ionic.Platform.isIOS()){
      
      if(window.cordova && window.cordova.plugins.Keyboard) {
        cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
        cordova.plugins.Keyboard.disableScroll(false);
      }
      ionic.Platform.fullScreen();
      if (window.StatusBar) {
        StatusBar.hide();
      }
    }

    $ionicPlatform.on("resume", function(event) {
      //if (ionic.Platform.isAndroid() || ionic.Platform.isIOS())
      //    window.location.reload(true);
    });  

    $window.ga('create', 'UA-39655416-6', 'auto');
    $rootScope.$on('$stateChangeSuccess', function (event) {
        $window.ga('send', 'pageview', $location.path());
    });
                    
  });
})

.config(function($stateProvider, $urlRouterProvider, $httpProvider, $ionicConfigProvider) {
  if (ionic.Platform.isAndroid()) {
    $ionicConfigProvider.scrolling.jsScrolling(false);
  }
  
  $stateProvider
    .state('pos', {
        url: '/',
        templateUrl: 'pos.html',
        controller: 'PosCtrl',
    })
    .state('login', {
        url: '/login',
        templateUrl: 'login.html',
        controller: 'LoginCtrl'
    });

    $urlRouterProvider.otherwise('/login');
})

.filter('formatDate', function() {

  // In the return function, we must pass in a single parameter which will be the data we will work on.
  // We have the ability to support multiple other parameters that can be passed into the filter optionally
  return function(datejson, formatstring) {

    if (datejson == null)
        return "";
    var date = convertJsonDateTimeToJs(datejson);
    if (formatstring) {
        return dateFormat(date, formatstring);
    }
    else {
        var today = dateFormat(new Date(), 'dd/mm/yyyy');
        var sDate = dateFormat(date, 'dd/mm/yyyy');
        if (today == sDate) {
            return dateFormat(date, 'HH:MM:ss');
        }
        else {
            return dateFormat(date, "dd/mm/yyyy HH:MM:ss");
        }
    }

  }

})

.filter('cashier', function() {

  // In the return function, we must pass in a single parameter which will be the data we will work on.
  // We have the ability to support multiple other parameters that can be passed into the filter optionally
  return function(id, userList) {
    
    var name = '';
    if (id == null)
        return "";
    if (userList) {
      var cashierUserIndex = findIndex(userList,'userId',id);
      if(cashierUserIndex != null){
        name =  userList[cashierUserIndex].displayName;
      }
      return name;
    }
  }

})

// var orderScroll = $ionicScrollDelegate.$getByHandle('orders-details');
// window.addEventListener('native.keyboardshow', function(e){
//   // orderScroll.resize();
// });

window.addEventListener('native.keyboardhide', keyboardHideHandler);
function keyboardHideHandler(e){
    // orderScroll.resize();
    StatusBar.hide();
}
if (window.isMobileDevice) {
    window.addEventListener('click', function () {
        StatusBar.hide();
    })
}