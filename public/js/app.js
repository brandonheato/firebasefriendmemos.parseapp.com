(function(){
  var app = angular.module('friendmemos', [
    'firebase',
    'infinite-scroll'
  ])
  .value('firebaseRef', new Firebase(FIREBASE_URL))
  .config([
    '$routeProvider',
    function ($routeProvider) {
      $routeProvider
      .when('/home', {
        templateUrl: 'partials/home.html',
        controller: HomeCtrl,
        resolve: HomeCtrl.resolve
      })
      .when('/friends/:uid', {
        templateUrl: 'partials/memo.html',
        controller: MemoCtrl,
        resolve: MemoCtrl.resolve
      })
      .when('/login', {
        templateUrl: 'partials/login.html',
        controller: LoginCtrl,
        resolve: LoginCtrl.resolve
      })
      .when('/logout', {
        templateUrl: 'partials/logout.html',
        controller: LogoutCtrl
      })
      .otherwise({redirectTo: '/home' });
    }
  ])
  .filter('constructDisplayName', ['constructDisplayName', function(constructDisplayName){
    return constructDisplayName;
  }])
  .run(function ($rootScope, firebaseRef, userProvider) {
    $rootScope.auth = new FirebaseSimpleLogin(firebaseRef, userProvider.onLoginStateChange);
  });
  
  var FRIEND_SEARCH_RESULTS_LIMIT = 10;
  var INFINITE_SCROLL_ITEMS_PER_BATCH = 20;

  function HomeCtrl($scope, $location, user, fbFriends, searchForFriends) {
    if (!user){
      return $location.path('/login');
    }

    $scope.showMainList = true;

    var index = 0;
    $scope.loadMore = function() { //infinite scrolling loadMore function
      if (!$scope.friends) {
        $scope.friends = [];
      }

      for (var i = 0; i < INFINITE_SCROLL_ITEMS_PER_BATCH; i++) {
        if (!$scope.fbFriends || !$scope.fbFriends[index]) { //empty fb friend list or all fb friends looped
          break;
        }
        $scope.friends.push($scope.fbFriends[index]);
        index++;
      }
    }

    $scope.pageName = 'Friends';
    
    $scope.fbFriends = fbFriends; //cache friend list

    var previousQueryStringLength = 0;
    var previousResults = [];
    
    $scope.$watch('query', function () {
      if ($scope.query) {
        var lowerCaseQueryString = $scope.query.toLowerCase();
      } else {
        lowerCaseQueryString = '';
      }
      if (lowerCaseQueryString) {
        $scope.showMainList = false;
      } else {
        $scope.showMainList = true;
        return;
      }
      if (lowerCaseQueryString.length < previousQueryStringLength) {
        var friends = previousResults;
        var results = searchForFriends(lowerCaseQueryString, friends, FRIEND_SEARCH_RESULTS_LIMIT);
        $scope.searchListResults = _.first(results, FRIEND_SEARCH_RESULTS_LIMIT);
        previousResults = results;
      } else {
        
        var results = searchForFriends(lowerCaseQueryString, $scope.fbFriends, FRIEND_SEARCH_RESULTS_LIMIT);
        $scope.searchListResults = _.first(results, FRIEND_SEARCH_RESULTS_LIMIT);
        
        previousResults = results;
      }
    });
  }
  HomeCtrl.resolve = {
    user: ['userProvider', function(userProvider){
      return userProvider.get();
    }],
    fbFriends: ['fbFriendsProvider', function(fbFriendsProvider){
      return fbFriendsProvider.get();
    }]
  };


  function MemoCtrl($scope, $routeParams, $location, angularFire, fbFriends, user, constructDisplayName) {
    if (!user){
      return $location.path('/login');
    }

    var friend = _.find(fbFriends, function(friend){
      if (friend.uid == $routeParams.uid) {
        return friend;
      }
    });
    $scope.pageName = "Memo for "+ constructDisplayName(friend);
    $scope.saveButtonDisabled = true;

    var dataRef = new Firebase(FIREBASE_URL);
    
    var memoRefUrl = FIREBASE_URL + '/users/'+user.id+'/fbFriendMemos/'+ $routeParams.uid;
    angularFire(memoRefUrl, $scope, 'memo', {});
  };
  MemoCtrl.resolve = {
    user: ['userProvider', function(userProvider){
      return userProvider.get();
    }],
    fbFriends: ['fbFriendsProvider', function(fbFriendsProvider){
      return fbFriendsProvider.get()
    }]
  };

  function LoginCtrl($scope, $location, user) {
    if (user){
      return $location.path('/home');
    }
    $scope.display = true;
    $scope.pageTitle = 'Friend Memos';
    $scope.loginButtonText = 'Login with Facebook';
    $scope.login = function () {
      $scope.auth.login('facebook', {
        rememberMe: true
      });
    };
  }
  LoginCtrl.resolve = {
    user: ['userProvider', function(userProvider){
      return userProvider.get();
    }]
  }

  function LogoutCtrl($scope, $location) {  
    $scope.auth.logout();
    $location.path("/login");
  }

  app.factory('userProvider', function($q, $rootScope, $location, $timeout) {
    var cachedUser = null;
    var authResponseDeferred = $q.defer();

    function get() {
      var deferred = $q.defer();
      authResponseDeferred.promise.then(function(){
        deferred.resolve(cachedUser);
      });
      return deferred.promise;
    }

    function onLoginStateChange(error, user) {
      if (error) {
        // an error occurred while attempting login
        console.log(error);
      }

      var oldCachedUser = cachedUser;
      cachedUser = user;
      
      if (!oldCachedUser && cachedUser) {
        if ($location.path() == '/login') {
          $location.path('/home');
        }
      } else if (!user) {
        $location.path('/login');
      }

      $timeout(function(){
        authResponseDeferred.resolve();
      });      
    }
    
    return {
      get: get,
      onLoginStateChange: onLoginStateChange
    }
  });



  app.factory("fbFriendsProvider", function($q, userProvider, $rootScope, $location, $timeout) {
    var cached = undefined;
    var get = function() {
      var deferred = $q.defer();

      if (cached) {
        deferred.resolve(cached);
        return deferred.promise;
      }

      var userPromise = userProvider.get();
      userPromise.then(function(user){

        if (!user) {
          deferred.resolve([]);
        }
        
        var fbAccessToken = user.accessToken;
        var fbUserId = user.id;
        var fqlQuery = "SELECT first_name, middle_name, last_name, uid FROM user WHERE uid IN (SELECT uid2 FROM friend WHERE uid1="+fbUserId+") ORDER BY first_name";
        
        FB.api(
          '/fql', 
          {
            access_token: fbAccessToken,
            q: fqlQuery
          },
          function(response){
            var error = false;
            if (!response || response.error) {
              if (response && response.error.type=='OAuthException') {
                console.log('fboauthexception')
              } else {
                alert('could not retrieve fb friends, try reloading');
                response.data = [];
              }
              error = true;
            }
            if (!error) {
              cached = response.data;
            }
            
            $timeout(function(){
              deferred.resolve(response.data);
            });
          }
        );
      
      });
      return deferred.promise;
    };

    return {
      get : get
    };
  });

  /* helpers */
  app.factory('constructDisplayName', function() {
    return function (input){
      var displayName = '';
      if (input.first_name) {
        displayName = displayName + input.first_name;
      }
      if (input.middle_name) {
        displayName = displayName + ' ' + input.middle_name;
      }
      if (input.last_name) {
        displayName = displayName + ' ' + input.last_name;
      }
      return displayName;
    }
  });
  app.factory('searchForFriends', function(constructDisplayName){
    return function(queryString, friends) {
      var searchListIndex = 0;
      var firstNameStringMatches = [];
      var middleNameStringMatches = [];
      var lastNameStringMatches = [];
      var containStringMatches = [];
      while (searchListIndex < friends.length - 1) {
        var friend = friends[searchListIndex];
        var firstNameIndex = -1;
        var middleNameIndex = -1;
        var lastNameIndex = -1;
        var matched = false;
        if (friend.first_name) {
          firstNameIndex = friend.first_name.toLowerCase().indexOf(queryString);
          if (firstNameIndex == 0) {
            firstNameStringMatches.push(friend);
            matched = true;
          }
        }
        if (!matched && friend.middle_name) {
          middleNameIndex = friend.middle_name.toLowerCase().indexOf(queryString);
          if (middleNameIndex == 0) {
            middleNameStringMatches.push(friend);
            matched = true;
          }
        }
        if (!matched && friend.last_name) {
          lastNameIndex = friend.last_name.indexOf(queryString);
          if (lastNameIndex == 0) {
            lastNameStringMatches.push(friend);
            matched = true;
          }
        }
        if (!matched) {
          var fullName = constructDisplayName(friend);
          if (fullName.toLowerCase().indexOf(queryString) != -1) {
            containStringMatches.push(friend);
          }
        }
        searchListIndex++;
      }
      return _.union(firstNameStringMatches, middleNameStringMatches, lastNameStringMatches, containStringMatches);
    }
  });
})();