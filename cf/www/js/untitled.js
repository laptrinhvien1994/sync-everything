if($scope.isSync){
	socket = io.connect(socketUrl, {query : 'room=' + $scope.userSession.companyId + '_' + $scope.currentStore.storeID});
	var ownerOrder = filterOwnerOrder($scope.tables,$scope.userSession.userId);
  	var initData = {
        "companyId": $scope.userSession.companyId,
        "storeId" : $scope.currentStore.storeID,
        "clientId" : $scope.clientId,
        "shiftId" : LSFactory.get('shiftId'),
        "startDate" : "",
        "finishDate": "",
        "tables" : ownerOrder,
        "zone" : $scope.tableMap
      }

	  initData = angular.toJson( initData );
	  initData = JSON.parse(initData);
	  socket.emit('initShift',initData);
	  console.log('gọi init: ' + LSFactory.get('shiftId') );
}