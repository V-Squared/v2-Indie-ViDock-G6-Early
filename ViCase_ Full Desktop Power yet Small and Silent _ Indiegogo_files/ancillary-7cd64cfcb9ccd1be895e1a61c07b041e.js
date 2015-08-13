(function () {
  angular.module('utils', ['templates', 'ui.select', 'angular-table', 'mgcrea.ngStrap'])
    .config(['$logProvider', '$httpProvider',
      function ($logProvider, $httpProvider) {
        $logProvider.debugEnabled(false); // Set to true to see debug statements

        var csrfToken = $('meta[name=csrf-token]').attr('content');
        $httpProvider.defaults.headers.post['X-CSRF-Token'] = csrfToken;
        $httpProvider.defaults.headers.put['X-CSRF-Token'] = csrfToken;
        $httpProvider.defaults.headers.patch['X-CSRF-Token'] = csrfToken;
        $httpProvider.defaults.headers.delete = {'X-CSRF-Token': csrfToken};
    }])
    .constant('lodash', _)
    .value('gon', window.gon || {})
    .value('ga', window.ga)
    .constant('I18nRails', window.I18n);


  angular.module('header', [
    'templates',
    'ngAnimate',
    'utils',
    'adminBar'
  ]);

  angular.module('footer', [
    'templates',
    'utils'
  ]);

  angular.module('lite', [
    'templates',
    'header',
    'footer',
    'utils',
    'angular-carousel',
    'ng.picturefill'
  ]);

  angular.module('adminBar', []);

  angular.module('perks', ['utils', 'slick']);


})();

(function () {
  'use strict';

  angular.module('footer').directive("footerTrustBbb",
    ['i18n', function (i18n) {
      return {
        restrict: 'A',
        templateUrl: 'views/footer-trust-bbb.html',
        scope: {
          bbbImageUrl: "@footerTrustBbbImageUrl"
        },
        link: function (scope) {
          igg.externalService(function() {
            // TRUSTe logo in footer
            var tl = document.createElement('script');
            tl.type = 'text/javascript';
            tl.src = '//privacy-policy.truste.com/privacy-seal/Indiegogo,-Inc-/asc?rid=f11cda4f-ffd6-4d45-b3c3-dea39f0b8194';
            tl.async = true;
            var s = document.getElementsByTagName('script')[0];
            s.parentNode.insertBefore(tl, s);
          });
          scope.inEnglish = i18n.locale === 'en';
        }
      };
    }]
  );
})();

(function () {
  'use strict';

  angular.module('footer').directive("footerLocaleDropdown",
    ['$window', 'i18n', 'bootstrap', function ($window, i18n, bootstrap) {
      return {
        restrict: 'A',
        templateUrl: "views/footer_locale_dropdown.html",
        scope: {},
        link: function (scope, element, attrs) {
          var $localeSelect = element.find(".js-locale-select");
          bootstrap.dropdown($localeSelect);

          scope.localeOptions = JSON.parse(attrs.localeOptions);
          scope.currentLocale = i18n.locale;

          var localeUrl = function (locale) {
            var location = $window.location;
            var queryParams = (location.search === "") ? [] : location.search.substring(1).split("&");
            queryParams = _(queryParams).reject(function (param) {
              return param.indexOf("locale") != -1;
            });
            queryParams.push("locale=" + locale);
            return location.protocol + "//" + location.host + location.pathname +
              "?" + queryParams.join("&");
          };

          scope.selectLocale = function (locale) {
            $window.location.href = localeUrl(locale);
          };
        }
      };
    }]
  );
})();

(function () {
  'use strict';

  angular.module('footer').directive("footerNewsletterForm",
    function () {
      return {
        restrict: 'A',
        link: function (scope, element) {
          scope.submitForm = function () {
            element.submit();
          };
        }
      };
    }
  );


})();

(function () {
  'use strict';

  angular.module('footer').directive("footerShareIcons",
    ['browser', function (browser) {
      return {
        restrict: "A",
        link: function (scope, element, attrs) {
          igg.externalService(function() {
            if (browser.isTabletPlus()) {

              // Google+ +1 button in footer
              (function () {
                var po = document.createElement('script');
                po.type = 'text/javascript';
                po.async = true;
                po.src = 'https://apis.google.com/js/plusone.js';
                var s = document.getElementsByTagName('script')[0];
                s.parentNode.insertBefore(po, s);
              })();
            }
          });
        }
      };
    }]
  );
})();

(function() {
  angular.module('header')
    .directive("deleteLink", ['$window', '$http', function($window, $http) {
      return {
        restrict: "A",
        scope: {},
        link: function(scope, element, attrs) {
          function performDeleteRequest() {
            $http.delete(element.attr("href")).then(function() {
              $window.location.href = attrs.deleteLinkHref || '/';
            });
          }

          element.on("click", function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (attrs.deleteLinkConfirm) {
              if ($window.confirm(attrs.deleteLinkConfirm)) {
                performDeleteRequest();
              }
            } else {
              performDeleteRequest();
            }
          });
        }
      };
    }]);
})();

(function() {
  'use strict';

  var header = angular.module("header");

  header.directive("headerFlashContainer", ['flash', '$sce', function(flash, $sce) {
    return {
      restrict: 'A',
      scope: {},
      templateUrl: 'views/header_flash_container.html',
      transclude: true,
      link: function(scope, element) {
        element.removeClass("hidden");

        scope.flashes = [];

        flash.onNewMessage(function(alertLevel, message, optionsOverrides) {
          var options = _.merge({html: false, fromOutsideAngular: false}, optionsOverrides);
          if (options.html) {
            scope.flashes.push({
              messageHtml: $sce.trustAsHtml(message),
              alertLevel: alertLevel
            });
          } else {
            scope.flashes.push({
              messageText: message,
              alertLevel: alertLevel
            });
          }
          if (options.fromOutsideAngular) {
            scope.$apply();
          }
        });
      }
    };
  }]);

  header.directive("headerFlash", function() {
    return {
      restrict: 'A',
      scope: {level: "@headerFlashLevel"},
      templateUrl: 'views/header_flash.html',
      transclude: true,
      link: function (scope) {
        if (scope.level === "alert" || scope.level === "error") {
          scope.style = "i-flash-error";
        } else {
          scope.style = "i-flash-info";
        }

        scope.open = true;
        scope.closeFlash = function() {
          scope.open = false;
        };
      }
    };
  });
})();

(function(){
  angular.module('header')
    .directive('headerSearchForm', [
      'i18n', 'browser',
      function(i18n, browser) {
        return {
          restrict: 'A',
          scope: true,
          templateUrl: function(elem,attrs) {
            return 'views/' + attrs.template + '.html';
          },
          link: function(scope, element, attrs) {
	    scope.$watch('inSearchMode', function(subsequent, last) {
	      if (!last && subsequent) {
		  element.find('input').focus();
	      }
	    });
            scope.i18n = i18n;
            scope.searchTerm = attrs.term;
            scope.reset = function() {
              scope.searchTerm = '';
              if (attrs.term && attrs.term.length > 0) {
                browser.redirectTo(attrs.action);
              }
            };
            scope.go = function() {
              element.submit();
            };
          }
        };
      }]
  );
})();

(function() {
  angular.module('header')
    .directive("headerDropdownLink", ['bootstrap', function (bootstrap) {
      return {
        restrict: "A",
        scope: {},
        link: function (scope, element) {
          bootstrap.dropdown(element);
          element.parent().on("show.bs.dropdown", function () {
            scope.$emit('dropdownOpen');
          });
        }
      };
    }]);
})();

(function() {
  angular.module('header')
    .directive("headerMain", function() {
      return {
        restrict: "A",
        scope: false,
        link: function(scope, element, attrs) {
          scope.inSearchMode = false;
          scope.toggleSearchMode = function() {
            scope.inSearchMode = !scope.inSearchMode;
          };
          scope.$on('dropdownOpen', function() {
            scope.inSearchMode = false;
            scope.$digest();
          });
        }
      };
    });
})();

(function() {
  angular.module('header')
    .controller('SessionController', ['$scope', function($scope) {
      $scope.master = {};

      $scope.submit = function(account) {
        $scope.master = angular.copy(account);
      };

    }]);
})();

(function() {
  'use strict';

  var sessionModal = function ($http, $window, bootstrap, browser, ga, modals) {
    var link = function (scope, element) {
      element.find('form').each(function (index, form) {
        angular.element(form).bind('submit', function (e) {
          e.preventDefault();
        });
      });

      var loginForm = element.find('form[name=loginForm]');
      var signupForm = element.find('form[name=signupForm]');
      var EMAIL_REGEXP = /^[a-z0-9!#$%&'*+\/=?^_`{|}~.-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

      scope.loginFailed = false;
      scope.signupFailed = false;
      scope.currentForm = 'loginForm';
      scope.loginAccount = {};
      scope.loginAccount.password = null;

      scope.signupAccount = {
        emailValid: function () {
          if(typeof this.email === 'undefined'){
            return true;
          } else {
            return EMAIL_REGEXP.test(this.email);
          }
        },

        passwordValid: function () {
          if(typeof this.password === 'undefined'){
            return true;
          } else {
            var length = this.password.length;
            return (length >= 6) && (length <= 40);
          }
        },

        allFieldsPresent: function () {
          return !!(this.firstname && this.lastname && this.email && this.password);
        }
      };

      modals.register('session', element);

      scope.openModal = function (formType) {
        scope.currentForm = formType;
        modals.openModal('session');
        scope.sendGaForForm(formType);
      };

      scope.closeModal = function () {
        scope.loginFailed = false;
        scope.securityMessage = null;
        scope.loginAccount.password = null;
      };

      scope.switchForm = function () {
        if (scope.currentForm === 'loginForm') {
          scope.currentForm = 'signupForm';
        } else {
          scope.currentForm = 'loginForm';
        }
        scope.sendGaForForm(scope.currentForm);
      };

      scope.submitLogin = function () {
        $http({
          url: loginForm.attr('action'),
          method: 'POST',
          data: loginForm.serialize(),
          headers: {'Content-Type': 'application/x-www-form-urlencoded'}
        }).success(function (data, status, request) {
          scope.sendGaForLoginSuccess(request);
        }).error(function (data) {
          scope.loginFailed = true;
          scope.sendGaForLoginError(data.error);
          if(data.error == "resource_owner_credentials_revoked") {
            scope.securityMessage = data.error_description;
          }
        });
      };

      scope.submitSignup = function () {
        var account = scope.signupAccount;
        if(account.passwordValid() && account.emailValid() && account.allFieldsPresent()) {
          $http({
            url: signupForm.attr('action'),
            method: 'POST',
            data: signupForm.serialize(),
            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
          }).success(function () {
            scope.sendGaForSignupSuccess();
          }).error(function (data) {
            scope.signupFailed = false;
            scope.errorMessage = data.error;
            scope.sendGaForSignupError(data.error);
          });
        } else {
          scope.signupFailed = true;
        }
      };

      scope.safeGa = function (action, category, label, callback) {
        if (typeof callback === 'undefined') {
          callback = function () {
          };
        }
        // make sure the callback gets triggered even when ga blocked
        if (typeof ga !== 'undefined' && ga.loaded) {
          ga('send', 'event', action, category, label, {
            hitCallback: callback
          });
        } else {
          callback();
        }
      };

      scope.sendGaForForm = function (formtype) {
        if (formtype == 'loginForm') {
          scope.sendGaForLoginShow();
        } else {
          scope.sendGaForSignupShow();
        }
      };

      scope.sendGaForLoginShow = function () {
        scope.safeGa('Account Login', 'view', window.location.href);
      };

      scope.sendGaForSignupShow = function () {
        scope.safeGa('Account Sign-up', 'view', window.location.href);
      };

      scope.sendGaForLoginSuccess = function (request) {
        var cb = function() { browser.redirectTo(request().location); };
        scope.safeGa('Account Login', 'login complete', window.location.href, cb);
      };

      scope.sendGaForSignupSuccess = function () {
        var cb = function() { $window.location.reload(); };
        scope.safeGa('Account Sign-up', 'sign-up complete', window.location.href, cb);
      };

      scope.sendGaForLoginError = function (message) {
        scope.safeGa('Account Login', 'error', message);
      };

      scope.sendGaForSignupError = function (message) {
        scope.safeGa('Account Sign-up', 'error', message);
      };
    };

    return {
      restrict: "A",
      scope: false,
      link: link
    };
  };

  angular
    .module('header')
    .directive('sessionModal', ['$http', '$window', 'bootstrap', 'browser', 'ga', 'modals', sessionModal]);
})();

(function() {
  function perkCalloutLabel(i18n, $log, perkFromGonUsingId) {
    return {
      restrict: 'E',
      scope: {},
      replace: false,
      template: '<div ng-if="perk.has_callout_label" class="highlight bold fr top_perk i-top-perk">{{::perk.callout_label}}</div>',
      link: function (scope, element, attrs, nullController, transclude) {
        if (attrs.optionPerk) {
          scope.perk = attrs.optionPerk;
        } else if (attrs.optionPerkId) {
          scope.perk = perkFromGonUsingId(attrs.optionPerkId);
        }
      }
    };
  }

  angular.module('perks').directive('perkCalloutLabel', ['i18n', '$log', 'perkFromGonUsingId', perkCalloutLabel]);

})();

(function () {
  function perk(i18n, countriesService) {

    return {
      restrict: 'E',
      scope: {
        perk: '=',
        currency: '&currency'
      },
      transclude: true,
      templateUrl: 'views/perk.html',
      link: function (scope, element, attrs) {
        scope.i18n = i18n;
        scope.countries = countriesService;
        scope.isShippingLabelDisplayed = scope.perk.isShippingLabelDisplayed();
      }
    };
  }

  function perkChange () {
    return {
      restrict: 'E',
      templateUrl: 'views/perk-change.html'
    };
  }

  function perkTitle () {
    return {
      restrict: 'E',
      templateUrl: 'views/perk-title.html',
      transclude: true
    };
  }

  function perkDescription (i18n) {
    return {
      restrict: 'E',
      templateUrl: 'views/perk-description.html',
      link: function (scope) {
        function perksClaimed() {
          if (scope.perk.number_available) {
            return i18n.t('x_out_of_y_claimed_html', {
              x: scope.perk.number_claimed,
              y: scope.perk.number_available
            });
          } else {
            return i18n.t('x_claimed_html', {
              number_claimed: scope.perk.number_claimed
            });
          }
        }

        scope.perksClaimed = perksClaimed;
        scope.i18n = i18n;
      }
    };
  }

  function amountWithCurrency() {
    return {
      restrict: 'E',
      templateUrl: 'views/amount-with-currency.html'
    };
  }

  angular.module('perks')
    .directive('perk', ['i18n', 'countriesService', perk])
    .directive('perkChange', perkChange)
    .directive('perkTitle', perkTitle)
    .directive('perkDescription', ['i18n', perkDescription])
    .directive('amountWithCurrency', [amountWithCurrency]);
})();

(function () {
  function PerkFactory ($http, $rootScope, _, countries, i18n, $log, gon) {

    /**
     * TODO: list attributes explicitly as function arguments, rather than a single argument with docs
     * @param attributes
     *  REQUIRED
     *    amount: positive int
     *    label: string at most 30 long
     *    description: string at most 500 long
     *  OPTIONAL
     *    number_available: positive int, null = unlimited i think
     *    estimated_delivery_date:
     *    shipping_address_required: true/false
     *    shipping: object of form:
     *       { fees: { <countrycode>: <fee> },
     *         is_free_everywhere: true/false }
     * @constructor
     */

    function syncShippingFees (perkAttributes) {
      var hasShippingDotFees, hasShippingObj, hasShippingUnderscoreFees,
        updatedShippingDotFees, difference;
      var self = perkAttributes ? perkAttributes : this;
      self.wasShippingSetByDefault = false;

      hasShippingObj = _.isObject(self.shipping);
      hasShippingUnderscoreFees = _.isObject(self.shipping_fees);

      if(hasShippingObj){
        hasShippingDotFees = _.isObject(self.shipping.fees);
      } else {
        self.shipping = {fees: {}};
      }

      // If it DOES HAVE shipping.fees
      // but DOES NOT HAVE shipping_fees,
      // build shipping_fees.
      if(hasShippingDotFees && !hasShippingUnderscoreFees){
        var shipKeys = Object.keys(self.shipping.fees);
        var updatedShippingUnderscoreFees = [];
        _.each(shipKeys, function(shipKey){
          var shipFee = {};
          shipFee.country_code = shipKey;
          shipFee.fee = self.shipping.fees[shipKey];
          updatedShippingUnderscoreFees.push(shipFee);
        });
        self.shipping_fees = updatedShippingUnderscoreFees;
      }

      // If it DOES NOT HAVE shipping.fees
      // but DOES HAVE shipping_fees,
      // build shipping.fees.
      if(!hasShippingDotFees && hasShippingUnderscoreFees){
        updatedShippingDotFees = {};
        _.each(self.shipping_fees, function(feeObj){
          updatedShippingDotFees[feeObj.country_code] = feeObj.fee;
        });
        self.shipping.fees = updatedShippingDotFees;
      }

      // If it has BOTH shipping.fees AND shipping_fees,
      // make sure shipping.fees matches shipping_fees.
      if(hasShippingDotFees && hasShippingUnderscoreFees){
        difference = _.difference(_.pluck(self.shipping_fees, "country_code"), Object.keys(self.shipping.fees));

        // If shipping_fees and shipping.fees DO NOT MATCH
        // set shipping.fees to match shipping_fees.
        if(!_.isEmpty(difference)){
          updatedShippingDotFees = {};
          _.each(self.shipping_fees, function(feeObj){
            updatedShippingDotFees[feeObj.country_code] = feeObj.fee;
          });
          self.shipping.fees = updatedShippingDotFees;
        }
      }

      // If it has NEITHER shipping.fees nor shipping_fees,
      // set default objects of everywhere for free for both.
      if(!hasShippingDotFees && !hasShippingUnderscoreFees){
        self.wasShippingSetByDefault = true;
        self.shipping = {is_free_everywhere: true, fees: {everywhere: 0}};
        self.shipping_fees = [{ country_code: "everywhere", fee: 0}];
      }
    }

    function Perk (attributes, options) {
      attributes = this._processIncomingAttributes(attributes);
      options    = (options || { });

      if(angular.isUndefined(options.createDropdownCountryObjects)) {
        options.createDropdownCountryObjects = true;
      }

      ///TODO: Check all required attributes AND VALUES are present

      if (attributes.estimated_delivery_date) {
        attributes.estimated_delivery_date = new Date(attributes.estimated_delivery_date);
      }
      attributes.shipping_address_required = attributes.shipping_address_required || false;
      if(attributes.shipping_address_required){
        syncShippingFees(attributes);
      }

      _.merge(this, attributes);

      // without this the mobile campaign page has big problems
      // the default is to create the dropdown country objects,
      // but there is the option to turn it off
      if(options.createDropdownCountryObjects) {
        this.dropdownCountryObjects = this._createDropdownCountryObjects();
      }

      this.sold_out = !!(this.number_available && this.number_claimed >= this.number_available);
      this.has_callout_label = !this.sold_out && (this.shipping_now || this.featured);

      if (this.has_callout_label) {
        this.callout_label = this.shipping_now ? i18n.t('perk_store.shipping_now') : i18n.t('featured');
      }

      var thisPerkID = 'perk' + this.id;
      var objToRegister = {};
      objToRegister[thisPerkID] = this;
    }

    Perk.prototype.syncShippingFees = syncShippingFees;

    Perk.prototype._processIncomingAttributes = function(attributes) {
      // create/edit page provides attributes in camel case
      var dashed_attrs = {};
      var self = this;
      _.forEach(attributes, function (n, key) {
        var ckey = self._snakeCase(key); // use _.snakeCase after lodash upgrade
        dashed_attrs[ckey] = n;
      });
      if (dashed_attrs.shipping) {
        if (_.has(dashed_attrs.shipping.fees, "europeanUnion")) {
          dashed_attrs.shipping.fees.european_union = dashed_attrs.shipping.fees.europeanUnion;
          delete(dashed_attrs.shipping.fees.europeanUnion);
        }
      }
      return dashed_attrs;
    };

    Perk.prototype._snakeCase = function(str) {
      return str.replace(/([a-z\d])([A-Z])/g, '$1_$2').toLowerCase();
    };

    Perk.prototype.displayShippingCountries = function() {
      if (!(this.shipping && typeof(this.shipping_fees) === 'object')) {
        return;
      } else if (this._displayShippingCountries) {
        return this._displayShippingCountries;
      }

      var perkShippingCountries = _.pluck(this.shipping_fees, 'country_code');
      var countryList = [];
      if (_.include(perkShippingCountries, "everywhere")){
        return [i18n.t('worldwide')];
      } else if (_.include(perkShippingCountries, "european_union")) {
        perkShippingCountries = _.difference(perkShippingCountries, countries.europeanUnion());
        perkShippingCountries = _.difference(perkShippingCountries, ["european_union"]);
        countryList.push(i18n.t("european_union"));
      }
      _.each(perkShippingCountries, function(cc){
        var currentCountry = countries.findByAlpha2(cc);
        countryList.push(currentCountry.text);
      });

      this._displayShippingCountries = countryList.sort();
      return this._displayShippingCountries;
    };

    Perk.prototype.hasShippingObject = function() {
      if (_.isUndefined(this.shipping_address_required)) {
        $log.error("hashShippingObject() called but shipping_address_required is undefined");
      }
      return (!!this.shipping && !!this.shipping_address_required);
    };

    Perk.prototype.isShippingLabelDisplayed = function() {
      if (this.hasShippingObject()) {
        var shippingCountries = this.shipping.fees;
        return !_.all(shippingCountries, function(fee){ return fee === 0; });
      } else {
        return false;
      }
    };

    Perk.prototype.feeForCountry = function(country) {
      if (!country) { return null; }
      if(this.shipping && typeof(this.shipping.fees) === 'object'){
        var shippingCountries = Object.keys(this.shipping.fees);
        var shipsToSpecificCountry = _.include(shippingCountries, country.country_code_alpha_2);
        var shipsToEU = _.include(shippingCountries, "european_union");
        var shipsWorldwide = _.include(shippingCountries, "everywhere");

        if (shipsToSpecificCountry) {
          return this.shipping.fees[country.country_code_alpha_2];
        } else if (shipsToEU && _.include(country.tags, "european_union")){
          return this.shipping.fees.european_union;
        } else if (shipsWorldwide) {
          return this.shipping.fees.everywhere;
        } else {
          return null;
        }
      }
      return null;
    };

    Perk.prototype.feeFor = function(twoLetterCtryCode) {
      return this.feeForCountry(countries.findByAlpha2(twoLetterCtryCode));
    };

    Perk.prototype.shipsWorldwide = function(){
      var perkShippingCountryCodes = _.keys(this.shipping.fees);
      return _.include(perkShippingCountryCodes, 'everywhere');
    };

    Perk.prototype.shipsToCountry = function(country) {
      var perkShippingCountryCodes = null;
      if (!this.shipping){
        return true;
      }
      if (!perkShippingCountryCodes) {
        perkShippingCountryCodes = Object.keys(this.shipping.fees);
      }
      if (_.include(perkShippingCountryCodes, 'everywhere')) {
        return !!country;
      }

      if (_.include(country.tags, "european_union") && _.include(perkShippingCountryCodes, 'european_union')) {
        return true;
      }
      return _.include(perkShippingCountryCodes, country.country_code_alpha_2);
    };

    Perk.prototype.shipsToCode = function(twoLetterCtryCode) {
      return this.shipsToCountry(countries.findByAlpha2(twoLetterCtryCode));
    };

    Perk.prototype._createDropdownCountryObjects = function() {
      var self = this;
      if (!this.shipping_address_required) {
        return [];
      }
      if (self._modifiedCountries) {
        return self._modifiedCountries;
      }
      self._modifiedCountries = _.cloneDeep(countries.asUiSelectItems());
      _.map(self._modifiedCountries, function(ctry){
        var countryCode = ctry.country_code_alpha_2;
        var labelForDropdown = ctry.text;
        var shipsTo = self.shipsToCountry(ctry);
        var fee = self.feeForCountry(ctry);

        if (countryCode && !shipsTo) { labelForDropdown += " – " + i18n.t('not_available'); }

        ctry.label_for_dropdown = labelForDropdown;
        ctry.ships_to = shipsTo;
        ctry.fee = fee;
      });

      return self._modifiedCountries;
    };

    Perk.prototype.saveOrUpdatePerk = function(campaignId){
      var url, method, self = this;
      var perkParams = _.pick(self, gon.api_settings.campaign_perks_controller.permitted_params);

      if (self.id) {
        url = '/private_api/campaigns/' + campaignId + '/perks/' + self.id;
        method = 'PUT';
      } else {
        url = '/private_api/campaigns/' + campaignId + '/perks/';
        method = 'POST';
      }

      var httpCall = $http({
        method: method,
        url: url,
        data: { perk: perkParams }
      });

      httpCall.success(function(data) {
        if (data.response.validation_errors) {
          $rootScope.$broadcast('perkSaveFailure');
        } else {
          if (method === 'PUT') {
            self.syncShippingFees();
            self._displayShippingCountries = null;
            self._displayShippingCountries = self.displayShippingCountries();
            $rootScope.$broadcast('perkUpdated', self);
          }
          if (method === 'POST') {
            self.syncShippingFees();
            self.id = data.response.id;
            $rootScope.$broadcast('perkCreated', self);
          }
        }
      });

      httpCall.error(function(){
        $rootScope.$broadcast('perkSaveFailure');
      });
    };

    Perk.prototype.deletePerk = function(campaignId){
      var self = this;
      var url = '/private_api/campaigns/' + campaignId + '/perks/' + self.id;

      $http({
        method: 'DELETE',
        url: url
      }).success(function() {
        $rootScope.$broadcast('perkDeleted', self);
      }).error(function(){
        $rootScope.$broadcast('perkDeleteFailure');
      });
    };

    return Perk;
  }

  angular.module('perks').factory('perkFactory', ['$http', '$rootScope', 'lodash', 'countriesService', 'i18n', '$log', 'gon', PerkFactory]);
})();

(function () {
  function perkFromGonUsingId (gon, Perk, $log, _) {
    return function findPerk (perkId) {
      var perkAttr = _.find(gon.campaign.perks, function (perkAttrs) {
        return perkAttrs.id === parseInt(perkId);
      });
      return new Perk(perkAttr);
    };
  }

  angular.module('perks').factory('perkFromGonUsingId', ['gon', 'perkFactory', '$log', 'lodash', perkFromGonUsingId]);
})();

(function() {
  angular.module('perks')
      .directive('perkStoreCard', ['iggCurrencyFilter', 'i18n', '$timeout', 'gon',
          function(iggCurrencyFilter, i18n, $timeout, gon) {
            return {
              replace: true,
              scope: {
                perk: '=',
                anchorToBucket: '@'
              },
              templateUrl: 'views/perk-store-card.html',
              link: function (scope, element) {
                scope.i18n = i18n;

                scope.amountHtml = function() {

                  return iggCurrencyFilter(scope.perk.perk_amount, scope.perk.currency_iso_num, 'html');
                };

                scope._calculateSendToPath = function() {
                  if (scope.perk.ad_target_url) {
                    return scope.perk.ad_target_url;
                  } else if (scope.anchorToBucket == "anchor_to_perk") {
                    return "/projects/" + scope.perk.campaign_slug + "/" + gon.iggref + "/#/perks/" + scope.perk.perk_id;
                  } else {
                    return "/projects/" + scope.perk.campaign_slug + "/" + gon.iggref;
                  }
                };

                scope.sendToPath = scope._calculateSendToPath();

                $timeout(function () {
                  element.find('.perkCard-label').dotdotdot({
                    wrap: "letter",
                    watch: "window"
                  });
                });
              }
            };
  }]);
}());

(function() {
  function shipsToCountries(i18n, Perk, $log, perkFromGonUsingId) {
    return {
      restrict: 'E',
      scope: {
        // one of the following options is required:
        optionPerk: '=', // perkFactory baby
        optionPerkId: '=', // perk ID (int)
        optionPerkAttr: '=' // perk attributes for perkFactory
      },
      templateUrl: 'views/ships-to-countries.html',
      link: function (scope) {
        var MAX_COUNTRY_COUNT = 5;
        scope.labelText = '';
        scope.i18n = i18n;
        scope.andMoreClicked = false;

        if (scope.optionPerkId) {
          scope.perk = perkFromGonUsingId(scope.optionPerkId);
        } else if (scope.optionPerkAttr) {
          scope.perk = new Perk(scope.optionPerkAttr);
        } else if (scope.optionPerk) {
          scope.perk = scope.optionPerk;
        } else {
          $log.error("ships-to-countries directive incorrectly called");
        }

        function shipsWorldwide(){ return scope.perk.shipsWorldwide(); }
        function moreThanFiveCountries(){
          var countries = scope.perk.displayShippingCountries();
          return countries.length > MAX_COUNTRY_COUNT;
        }

        scope.showCountries = function () {
          return (!shipsWorldwide() && !moreThanFiveCountries());
        };

        // Select Label
        if (shipsWorldwide()) {
          scope.labelText = i18n.t('contribution_flow.line_items.ships_worldwide');
        } else if (moreThanFiveCountries()) {
          scope.labelText = i18n.t('contribution_flow.line_items.ships_many');
        } else {
          scope.labelText = i18n.t('contribution_flow.line_items.ships_to');
        }

        scope.perkShippingCountries = scope.perk.displayShippingCountries();
        scope.$on('perkUpdated', function(event, updatedPerk){
          if(updatedPerk.id === scope.perk.id){
            scope.perkShippingCountries = scope.perk.displayShippingCountries();
          }
        });
      }
    };
  }

  angular.module('perks').directive('shipsToCountries', ['i18n', 'perkFactory', '$log', 'perkFromGonUsingId', shipsToCountries]);
})();

(function() {
  'use strict';
  angular.module('utils').filter('abbrevNumFmt', function() {
    return function(input) {
      var num_after_decimal = 1;
      var million = 1000000;
      var thousand = 1000;


      if (input >= million) {
        if (input/million >= 100 || input % million < 50000) {
          num_after_decimal = 0;
        }
        return (input / million).toFixed(num_after_decimal) + 'M';
      } else if (input >= thousand) {
        if (input/thousand >= 100 || input % 1000 < 50){
          num_after_decimal = 0;
        }
        return (input / thousand).toFixed(num_after_decimal) + 'k';
      } else if (input === null) {
        return '';
      } else if (input <= 0) {
        return '0';
      } else {
        return '' + input;
      }
    };
  });
})();

(function () {
  function backupBeforeUnloadService (_, $window) {
    var self = this;
    var objects = {};
    var storageElement = angular.element('#contribution-backup input');

    function setStorageElement(element) {
      storageElement = element;
    }

    function saveJson(json) {
      return storageElement.val(json);
    }

    function loadJson() {
      return storageElement.val();
    }

    function saveState() {
      var current = {};

      _.each(_.keys(objects), function (objectName) {
        var objectToBackup;
        if (typeof objects[objectName] === 'function') {
          objectToBackup = objects[objectName]();
        } else {
          objectToBackup = objects[objectName];
        }

        if (objectToBackup.campaign) {
          //TODO: make backupservice smart enough to not save certain unwanted attributes.
          delete objectToBackup.campaign;
        }

        current[objectName] = objectToBackup;
      });
      var json = JSON.stringify(current);
      self.saveJson(json);
    }

    function restoreStateIfSaved(objectName, object) {
      try {
        var data = JSON.parse(self.loadJson());
        var objectToRestore = data[objectName];
        if (objectToRestore.campaign) {
          //TODO: make backupservice smart enough to not save certain unwanted attributes.
          delete objectToRestore.campaign;
        }
        _.merge(object, objectToRestore);
        return true;
      } catch (e) {
        return false;
      }
    }

    function register(obj) {
      _.merge(objects, obj);
    }

    function pointerRegister(obj) {
      for (var key in obj) {
        objects[key] = obj[key];
      }
    }

    _.merge(self, {
      objects: function () {
        return objects;
      },
      setStorageElement: setStorageElement,
      saveState: saveState,
      saveJson: saveJson,
      loadJson: loadJson,
      restoreStateIfSaved: restoreStateIfSaved,
      pointerRegister: pointerRegister,
      register: register
    });

    $window.onbeforeunload = function () {
      self.saveState();
    };
  }

  angular.module('utils').service('backupBeforeUnloadService', ['lodash', '$window', backupBeforeUnloadService]);
})();

(function () {
  angular.module('utils').factory('bootstrap', [function () {
    return {
      modal: function(element, command) {
        element.modal(command);
      },

      dropdown: function(element) {
        element.attr("data-toggle", "dropdown");
        element.dropdown();
      },

      popover: function(element, options) {
        element.popover(element, options);
      }
    };
  }]);
})();

(function () {
  angular.module('utils').factory('browser', ['$window', function ($window) {
    return {
      isTabletPlus: function() {
        return $window.innerWidth >= 768;
      },
      isMobile: function() {
        return $window.innerWidth < 768;
      },
      height: function () {
        return $window.innerHeight;
      },
      onResize: function(callback) {
        angular.element($window).on("resize", callback);
      },
      onLoad: function(callback) {
        angular.element($window).on("load", callback);
      },
      isAndroid: function() {
        var ua = $window.navigator.userAgent.toLowerCase();
        return ua.indexOf("android") > -1;
      },
      isIphone: function() {
        return !!($window.navigator.userAgent.match(/iPhone|iPod/g) && !$window.navigator.userAgent.match(/iPad/g));
      },
      scrollToTop: function(element) {
        var elementToScroll = element || angular.element('html,body');
        elementToScroll.animate({scrollTop: 0});
      },
      redirectTo: function(url) {
        $window.location.href = url;
      },
      refreshPage: function() {
        $window.location.reload();
      },
      openTab: function(url) {
        $window.open(url, '_blank');
      },
      openWindow: function(url, name, options) {
        options = options || {};
        var width = (options.width || 670);
        var height = (options.height || 400);
        var size = 'width=' + width + ',height=' + height + ',' +
          'top=' + (screen.height / 2 - height / 2) + ',' +
          'left=' + (screen.width / 2 - width / 2);

        $window.open(url, name, size);
      },
      close: function () {
        $window.close();
      }
    };
  }]);
})();

(function () {
  'use strict';

  angular.module('utils').factory('categories', ['gon', function (gon) {

    function CategoriesService(initialCategories) {
      var categories;

      this.setCategories = function (cats) {
        categories = cats;
      };

      this.asOptions = function() {
        return  _.map(categories, function (category) {
          return { value: category.id, text: category.name };
        });
      };

      this.forId = function(id) {
        return _.findWhere(categories, {id: parseInt(id)});
      };

      this.setCategories(initialCategories);
    }

    return new CategoriesService(gon && gon.services && gon.services.categories || []);
  }]);
})();

(function() {
  'use strict';
  angular.module('utils').filter('charCounter', function() {
    return function(input, maxLength, delimiter) {
      delimiter = delimiter ? " " + delimiter + " " : " / ";
      var charsLeft = input ? maxLength - input.length : maxLength;
      return charsLeft.toString() + delimiter + maxLength;
    };
  });
})();

(function() {
  'use strict';
  angular.module('utils')
    .directive('clImage', function () {
      return {
        restrict: 'A',
        scope: {
          publicId: "=",
          placeholderPath: "@",
          width: '@',
          height: '@',
          crop: '@',
          background: '@'
        },

        link: function (scope, element) {
          scope.$watch('publicId', function (newPublicId) {
            if (newPublicId) {
              element.webpify(_.extend({'width': scope.width, 'height': scope.height, 'crop': scope.crop, 'background': scope.background}, {'src': newPublicId + '.jpg'}, {'secure': true}));
            } else if (scope.placeholderPath) {
              element.attr('src', scope.placeholderPath);
            }
          });
        }
      };
    });
})();

(function () {
  'use strict';

  angular.module('utils').factory('cloudinary', ['gon', function (gon) {
    var cloudinaryOptions = {};
    if (gon && gon.services && gon.services.cloudinary) {
      cloudinaryOptions = {
        url: gon.services.cloudinary.data.url,
        cloudName: gon.services.cloudinary.data.cloud_name,
        formData: gon.services.cloudinary.data.form_data
      };
    }

    return {
      setCloudinaryOptions: function(options) {
        cloudinaryOptions = options;
      },
      forFileInput: function($fileInput, $dropzone) {
        $fileInput.cloudinary_fileupload(
          angular.extend(
            { headers: {"X-Requested-With": "XMLHttpRequest"}, dropZone: $dropzone, pasteZone: $dropzone },
            cloudinaryOptions)
        );
        return {
          onUploadStart: function(callback) {
            $fileInput.on('cloudinarystart', callback);
            return this;
          },
          onUploadComplete: function(callback) {
            $fileInput.on('cloudinarydone', function(e, response) {
              callback(response.result);
            });
            return this;
          },
          onUploadFail: function(callback) {
            $fileInput.on('cloudinaryfail', function(e, response) {
              callback(response);
            });
            return this;
          }
        };
      }
    };
  }]);
})();

(function () {
  'use strict';

  angular.module('utils').directive('copyUrl', [
    '$http', 'gon', 'i18n', 'fb', 'twitter', 'gplus', '$timeout', '$window', 'browser',
    function ($http, gon, i18n, fb, twitter, gplus, $timeout, $window, browser) {

      return {
        restrict: 'A',
        link: function(scope, element, attrs) {
          element.on('click', function () {
            $window.prompt("Copy link, then click OK.", attrs.copyUrl);
          });
        }
      };

    }]);
})();

(function (countries) {

  function countriesService (_, i18n) {
    var localizedCountries = _.map(countries, function(country) {
      return {
        "country_code_alpha_2": country.alpha_2,
        "country_code": 'CTRY_' + country.alpha_2,
        "text": country.locales[i18n.locale || 'en'],
        "common": _.include(country.tags, "common"),
        "tags": country.tags
      };
    });
    var sortedCountries = _.sortBy(localizedCountries, function(country) {
      return (country.country_code_alpha_2 === 'US' ? '' : country.text);
    });
    var commonChoices = _.select(sortedCountries, function(country) { return country.common; });
    var remainingChoices = _.select(sortedCountries, function(country) { return !country.common; });
    var europeanCountries = _.select(sortedCountries, function(country) { return _.include(country.tags, "european_union"); });

    var self = this;
    var divider = {
      "country_code_alpha_2": null,
      "text": "—",
      ships_to: false,
      isDisabled: true,
      tags: ["divider"]
    };

    function all() {
      return _.union(commonChoices, remainingChoices);
    }

    function asUiSelectItems (options) {
      if (options && options.grouped) {
        return all();
      } else {
        return _.union(commonChoices, [divider], remainingChoices);
      }
    }

    function countryGrouping(item) {
      return item.common ? i18n.t('country_groups.common') : i18n.t('country_groups.other');
    }

    function findByAlpha2 (alpha2) {
      return _.find(all(), function (country) {
        return alpha2 === country.country_code_alpha_2;
      });
    }

    function findByText (text) {
      return _.findWhere(all(), {text: text});
    }

    function findByCode (code) {
      return _.find(all(), function (country) {
        return code === 'CTRY_' + country.country_code_alpha_2;
      });
    }

    function findByTwoLetterCode(twoLetter) {
      return findByCode('CTRY_' + twoLetter);
    }

    function europeanUnion () {
      return _.map(europeanCountries, function(country) { return country.country_code_alpha_2;});
    }

    function alpha2InEU (code) {
      return !!_.contains(this.europeanUnion(), code);
    }

    function alphabetized () {
      return _.sortBy(localizedCountries, function(ctry){ return ctry.text; });
    }

    function zipCodeLabelKey(countryCode) {
      if (countryCode === '' || countryCode === 'CTRY_US') {
        return 'zip_code';
      } else if (countryCode === 'CTRY_CA') {
        return 'postal_code';
      } else {
        var postalCodeOverrides = {
          CTRY_GB: 'post_code',
          CTRY_PH: 'zip_code',
          CTRY_IN: 'pin_code'
        };
        return postalCodeOverrides[countryCode] || 'postal_code';
      }
    }


    _.merge(self, {
      all: all,
      asUiSelectItems: asUiSelectItems,
      countryGrouping: countryGrouping,
      findByText: findByText,
      findByAlpha2: findByAlpha2,
      findByCode: findByCode,
      findByTwoLetterCode: findByTwoLetterCode,
      europeanUnion: europeanUnion,
      alpha2InEU: alpha2InEU,
      alphabetized: alphabetized,
      zipCodeLabelKey: zipCodeLabelKey
    });

  }

  angular.module('utils').service('countriesService', ['lodash', 'i18n', countriesService]);
})(
  /* To refresh, open up a Rails console and type "puts JSON.pretty_generate(Country.in_order.map(&:as_country_service_json))" */
  [{
    "alpha_2": "US",
    "locales": {
      "en": "United States",
      "fr": "Etats-Unis",
      "de": "Vereinigte Staaten",
      "es": "Estados Unidos"
    },
    "tags": [
      "common"
    ]
  },
  {
    "alpha_2": "AU",
    "locales": {
      "en": "Australia",
      "fr": "Australie",
      "de": "Australien",
      "es": "Australia"
    },
    "tags": [
      "common"
    ]
  },
  {
    "alpha_2": "CA",
    "locales": {
      "en": "Canada",
      "fr": "Canada",
      "de": "Kanada",
      "es": "Canadá"
    },
    "tags": [
      "common"
    ]
  },
  {
    "alpha_2": "DE",
    "locales": {
      "en": "Germany",
      "fr": "Allemagne",
      "de": "Deutschland",
      "es": "Alemania"
    },
    "tags": [
      "common",
      "european_union"
    ]
  },
  {
    "alpha_2": "GB",
    "locales": {
      "en": "United Kingdom",
      "fr": "Royaume-Uni",
      "de": "Großbritannien",
      "es": "Reino Unido"
    },
    "tags": [
      "common",
      "european_union"
    ]
  },
  {
    "alpha_2": "AF",
    "locales": {
      "en": "Afghanistan",
      "fr": "Afghanistan",
      "de": "Afghanistan",
      "es": "Afganistán"
    },
    "tags": []
  },
  {
    "alpha_2": "AX",
    "locales": {
      "en": "Aland Islands",
      "fr": "Aland",
      "de": "Alandinseln",
      "es": "Islas Aland"
    },
    "tags": []
  },
  {
    "alpha_2": "AL",
    "locales": {
      "en": "Albania",
      "fr": "Albanie",
      "de": "Albanien",
      "es": "Albania"
    },
    "tags": []
  },
  {
    "alpha_2": "DZ",
    "locales": {
      "en": "Algeria",
      "fr": "Algérie",
      "de": "Algerien",
      "es": "Argelia"
    },
    "tags": []
  },
  {
    "alpha_2": "AS",
    "locales": {
      "en": "American Samoa",
      "fr": "Samoa américaines",
      "de": "Amerikanisch-Samoa",
      "es": "Samoa Americana"
    },
    "tags": []
  },
  {
    "alpha_2": "AD",
    "locales": {
      "en": "Andorra",
      "fr": "Andorre",
      "de": "Andorra",
      "es": "Andorra"
    },
    "tags": []
  },
  {
    "alpha_2": "AO",
    "locales": {
      "en": "Angola",
      "fr": "Angola",
      "de": "Angola",
      "es": "Angola"
    },
    "tags": []
  },
  {
    "alpha_2": "AI",
    "locales": {
      "en": "Anguilla",
      "fr": "Anguilla",
      "de": "Anguilla",
      "es": "Anguila"
    },
    "tags": []
  },
  {
    "alpha_2": "AQ",
    "locales": {
      "en": "Antarctica",
      "fr": "Antarctique",
      "de": "Antarktis",
      "es": "Antártida"
    },
    "tags": []
  },
  {
    "alpha_2": "AG",
    "locales": {
      "en": "Antigua and Barbuda",
      "fr": "Antigua-et-Barbuda",
      "de": "Antigua und Barbuda",
      "es": "Antigua y Barbuda"
    },
    "tags": []
  },
  {
    "alpha_2": "AR",
    "locales": {
      "en": "Argentina",
      "fr": "Argentine",
      "de": "Argentinien",
      "es": "Argentina"
    },
    "tags": []
  },
  {
    "alpha_2": "AM",
    "locales": {
      "en": "Armenia",
      "fr": "Arménie",
      "de": "Armenien",
      "es": "Armenia"
    },
    "tags": []
  },
  {
    "alpha_2": "AW",
    "locales": {
      "en": "Aruba",
      "fr": "Aruba",
      "de": "Aruba",
      "es": "Aruba"
    },
    "tags": []
  },
  {
    "alpha_2": "AT",
    "locales": {
      "en": "Austria",
      "fr": "Autriche",
      "de": "Österreich",
      "es": "Austria"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "AZ",
    "locales": {
      "en": "Azerbaijan",
      "fr": "Azerbaïdjan",
      "de": "Aserbaidschan",
      "es": "Azerbaiyán"
    },
    "tags": []
  },
  {
    "alpha_2": "BS",
    "locales": {
      "en": "Bahamas",
      "fr": "Bahams",
      "de": "Bahamas",
      "es": "Bahamas"
    },
    "tags": []
  },
  {
    "alpha_2": "BH",
    "locales": {
      "en": "Bahrain",
      "fr": "Bahreïn",
      "de": "Bahrain",
      "es": "Bahréin"
    },
    "tags": []
  },
  {
    "alpha_2": "BD",
    "locales": {
      "en": "Bangladesh",
      "fr": "Bangladesh",
      "de": "Bangladesh",
      "es": "Bangladesh"
    },
    "tags": []
  },
  {
    "alpha_2": "BB",
    "locales": {
      "en": "Barbados",
      "fr": "Barbade",
      "de": "Barbados",
      "es": "Barbados"
    },
    "tags": []
  },
  {
    "alpha_2": "BY",
    "locales": {
      "en": "Belarus",
      "fr": "Biélorussie",
      "de": "Belarus",
      "es": "Belarús"
    },
    "tags": []
  },
  {
    "alpha_2": "BE",
    "locales": {
      "en": "Belgium",
      "fr": "Belgique",
      "de": "Belgien",
      "es": "Bélgica"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "BZ",
    "locales": {
      "en": "Belize",
      "fr": "Belize",
      "de": "Belize",
      "es": "Belice"
    },
    "tags": []
  },
  {
    "alpha_2": "BJ",
    "locales": {
      "en": "Benin",
      "fr": "Bénin",
      "de": "Benin",
      "es": "Benín"
    },
    "tags": []
  },
  {
    "alpha_2": "BM",
    "locales": {
      "en": "Bermuda",
      "fr": "Bermudes",
      "de": "Bermuda",
      "es": "Bermudas"
    },
    "tags": []
  },
  {
    "alpha_2": "BT",
    "locales": {
      "en": "Bhutan",
      "fr": "Bhoutan",
      "de": "Bhutan",
      "es": "Bután"
    },
    "tags": []
  },
  {
    "alpha_2": "BO",
    "locales": {
      "en": "Bolivia",
      "fr": "Bolivie",
      "de": "Bolivien",
      "es": "Bolivia"
    },
    "tags": []
  },
  {
    "alpha_2": "BA",
    "locales": {
      "en": "Bosnia and Herzegovina",
      "fr": "Bosnie-Herzégovine",
      "de": "Bosnien-Herzegowina",
      "es": "Bosnia y Herzegovina"
    },
    "tags": []
  },
  {
    "alpha_2": "BW",
    "locales": {
      "en": "Botswana",
      "fr": "Botswana",
      "de": "Botswana",
      "es": "Botsuana"
    },
    "tags": []
  },
  {
    "alpha_2": "BV",
    "locales": {
      "en": "Bouvet Island",
      "fr": "Île Bouvet",
      "de": "Bouvetinsel",
      "es": "Isla Bouvet"
    },
    "tags": []
  },
  {
    "alpha_2": "BR",
    "locales": {
      "en": "Brazil",
      "fr": "Brésil",
      "de": "Brasilien",
      "es": "Brasil"
    },
    "tags": []
  },
  {
    "alpha_2": "IO",
    "locales": {
      "en": "British Indian Ocean Territory",
      "fr": "Territoire britannique de l'océan Indien",
      "de": "Britisches Territorium im Indischen Ozean",
      "es": "Territorio Británico del Océano Índico"
    },
    "tags": []
  },
  {
    "alpha_2": "BN",
    "locales": {
      "en": "Brunei Darussalam",
      "fr": "Brunei",
      "de": "Brunei Darussalam",
      "es": "Brunei Darussalam"
    },
    "tags": []
  },
  {
    "alpha_2": "BG",
    "locales": {
      "en": "Bulgaria",
      "fr": "Bulgarie",
      "de": "Bulgarien",
      "es": "Bulgaria"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "BF",
    "locales": {
      "en": "Burkina Faso",
      "fr": "Burkina Faso",
      "de": "Burkina Faso",
      "es": "Burkina Faso"
    },
    "tags": []
  },
  {
    "alpha_2": "BI",
    "locales": {
      "en": "Burundi",
      "fr": "Burundi",
      "de": "Burundi",
      "es": "Burundi"
    },
    "tags": []
  },
  {
    "alpha_2": "KH",
    "locales": {
      "en": "Cambodia",
      "fr": "Cambodge",
      "de": "Kambodscha",
      "es": "Camboya"
    },
    "tags": []
  },
  {
    "alpha_2": "CM",
    "locales": {
      "en": "Cameroon",
      "fr": "Cameroun",
      "de": "Kamerun",
      "es": "Camerún"
    },
    "tags": []
  },
  {
    "alpha_2": "CV",
    "locales": {
      "en": "Cape Verde",
      "fr": "Cap-Vert",
      "de": "Kap Verde",
      "es": "Cabo Verde"
    },
    "tags": []
  },
  {
    "alpha_2": "KY",
    "locales": {
      "en": "Cayman Islands",
      "fr": "Îles Caïman",
      "de": "Kaimaninseln",
      "es": "Islas Caimán"
    },
    "tags": []
  },
  {
    "alpha_2": "CF",
    "locales": {
      "en": "Central African Republic",
      "fr": "Centrafrique",
      "de": "Zentralafrikanische Republik",
      "es": "República Centroafricana"
    },
    "tags": []
  },
  {
    "alpha_2": "TD",
    "locales": {
      "en": "Chad",
      "fr": "Tchad",
      "de": "Tschad",
      "es": "Chad"
    },
    "tags": []
  },
  {
    "alpha_2": "CL",
    "locales": {
      "en": "Chile",
      "fr": "Chili",
      "de": "Chile",
      "es": "Chile"
    },
    "tags": []
  },
  {
    "alpha_2": "CN",
    "locales": {
      "en": "China",
      "fr": "Chine",
      "de": "China",
      "es": "China"
    },
    "tags": []
  },
  {
    "alpha_2": "CX",
    "locales": {
      "en": "Christmas Island",
      "fr": "Île Christmas",
      "de": "Weihnachtsinsel",
      "es": "Isla de Navidad"
    },
    "tags": []
  },
  {
    "alpha_2": "CC",
    "locales": {
      "en": "Cocos (Keeling) Islands",
      "fr": "Îles Cocos",
      "de": "Cocosinseln",
      "es": "Islas Cocos (Keeling)"
    },
    "tags": []
  },
  {
    "alpha_2": "CO",
    "locales": {
      "en": "Colombia",
      "fr": "Colombie",
      "de": "Kolumbien",
      "es": "Colombia"
    },
    "tags": []
  },
  {
    "alpha_2": "KM",
    "locales": {
      "en": "Comoros",
      "fr": "Comores",
      "de": "Komoren",
      "es": "Comoras"
    },
    "tags": []
  },
  {
    "alpha_2": "CG",
    "locales": {
      "en": "Congo",
      "fr": "Congo",
      "de": "Kongo",
      "es": "Congo"
    },
    "tags": []
  },
  {
    "alpha_2": "CD",
    "locales": {
      "en": "Congo, the Democratic Republic of the",
      "fr": "République Démocratique du Congo",
      "de": "Kongo, demokratische Republik",
      "es": "República Democrática del Congo"
    },
    "tags": []
  },
  {
    "alpha_2": "CK",
    "locales": {
      "en": "Cook Islands",
      "fr": "Îles Cook",
      "de": "Cookinseln",
      "es": "Islas Cook"
    },
    "tags": []
  },
  {
    "alpha_2": "CR",
    "locales": {
      "en": "Costa Rica",
      "fr": "Costa Rica",
      "de": "Costa Rica",
      "es": "Costa Rica"
    },
    "tags": []
  },
  {
    "alpha_2": "CI",
    "locales": {
      "en": "Cote d'Ivoire",
      "fr": "Côte d'Ivoire",
      "de": "Elfenbeinküste",
      "es": "Costa de Marfil"
    },
    "tags": []
  },
  {
    "alpha_2": "HR",
    "locales": {
      "en": "Croatia",
      "fr": "Croatie",
      "de": "Kroatien",
      "es": "Croacia"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "CW",
    "locales": {
      "en": "Curacao",
      "fr": "Curaçao",
      "de": "Curacao",
      "es": "Curacao"
    },
    "tags": []
  },
  {
    "alpha_2": "CY",
    "locales": {
      "en": "Cyprus",
      "fr": "Chypre",
      "de": "Zypern",
      "es": "Chipre"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "CZ",
    "locales": {
      "en": "Czech Republic",
      "fr": "République Tchèque",
      "de": "Tschechische Republik",
      "es": "República Checa"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "DK",
    "locales": {
      "en": "Denmark",
      "fr": "Danemark",
      "de": "Dänemark",
      "es": "Dinamarca"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "DJ",
    "locales": {
      "en": "Djibouti",
      "fr": "Djibouti",
      "de": "Dschibuti",
      "es": "Yibuti"
    },
    "tags": []
  },
  {
    "alpha_2": "DM",
    "locales": {
      "en": "Dominica",
      "fr": "Dominique",
      "de": "Dominica",
      "es": "Dominica"
    },
    "tags": []
  },
  {
    "alpha_2": "DO",
    "locales": {
      "en": "Dominican Republic",
      "fr": "République Dominicaine",
      "de": "Dominikanische Republik",
      "es": "República Dominicana"
    },
    "tags": []
  },
  {
    "alpha_2": "EC",
    "locales": {
      "en": "Ecuador",
      "fr": "Equateur",
      "de": "Ecuador",
      "es": "Ecuador"
    },
    "tags": []
  },
  {
    "alpha_2": "EG",
    "locales": {
      "en": "Egypt",
      "fr": "Egypte",
      "de": "Ägypten",
      "es": "Egipto"
    },
    "tags": []
  },
  {
    "alpha_2": "SV",
    "locales": {
      "en": "El Salvador",
      "fr": "El Salvador",
      "de": "El Salvador",
      "es": "El Salvador"
    },
    "tags": []
  },
  {
    "alpha_2": "GQ",
    "locales": {
      "en": "Equatorial Guinea",
      "fr": "Guinée équatoriale",
      "de": "Äquatorialguinea",
      "es": "Guinea Ecuatorial"
    },
    "tags": []
  },
  {
    "alpha_2": "ER",
    "locales": {
      "en": "Eritrea",
      "fr": "Erythrée",
      "de": "Eritrea",
      "es": "Eritrea"
    },
    "tags": []
  },
  {
    "alpha_2": "EE",
    "locales": {
      "en": "Estonia",
      "fr": "Estonie",
      "de": "Estland",
      "es": "Estonia"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "ET",
    "locales": {
      "en": "Ethiopia",
      "fr": "Ethiopie",
      "de": "Äthiopien",
      "es": "Etiopía"
    },
    "tags": []
  },
  {
    "alpha_2": "FK",
    "locales": {
      "en": "Falkland Islands (Malvinas)",
      "fr": "Îles Falkland (Malouines)",
      "de": "Falklandinseln (Malwinen)",
      "es": "Islas Malvinas (Falkland)"
    },
    "tags": []
  },
  {
    "alpha_2": "FO",
    "locales": {
      "en": "Faroe Islands",
      "fr": "Îles Faroe",
      "de": "Färöer Inseln",
      "es": "Islas Feroe"
    },
    "tags": []
  },
  {
    "alpha_2": "FJ",
    "locales": {
      "en": "Fiji",
      "fr": "Fidji",
      "de": "Fidschi",
      "es": "Fiji"
    },
    "tags": []
  },
  {
    "alpha_2": "FI",
    "locales": {
      "en": "Finland",
      "fr": "Finlande",
      "de": "Finnland",
      "es": "Finlandia"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "FR",
    "locales": {
      "en": "France",
      "fr": "France",
      "de": "Frankreich",
      "es": "Francia"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "GF",
    "locales": {
      "en": "French Guiana",
      "fr": "Guyane",
      "de": "Französisch-Guayana",
      "es": "Guayana Francesa"
    },
    "tags": []
  },
  {
    "alpha_2": "PF",
    "locales": {
      "en": "French Polynesia",
      "fr": "Polynésie française",
      "de": "Französisch-Polynesien",
      "es": "Polinesia Francesa"
    },
    "tags": []
  },
  {
    "alpha_2": "TF",
    "locales": {
      "en": "French Southern Territories",
      "fr": "Terres australes et antarctiques françaises",
      "de": "Französische Südpolar-Territorien",
      "es": "Territorios Australes Franceses"
    },
    "tags": []
  },
  {
    "alpha_2": "GA",
    "locales": {
      "en": "Gabon",
      "fr": "Gabon",
      "de": "Gabun",
      "es": "Gabón"
    },
    "tags": []
  },
  {
    "alpha_2": "GM",
    "locales": {
      "en": "Gambia",
      "fr": "Gambie",
      "de": "Gambia",
      "es": "Gambia"
    },
    "tags": []
  },
  {
    "alpha_2": "GE",
    "locales": {
      "en": "Georgia",
      "fr": "Géorgie",
      "de": "Georgien",
      "es": "Georgia"
    },
    "tags": []
  },
  {
    "alpha_2": "GH",
    "locales": {
      "en": "Ghana",
      "fr": "Ghana",
      "de": "Ghana",
      "es": "Ghana"
    },
    "tags": []
  },
  {
    "alpha_2": "GI",
    "locales": {
      "en": "Gibraltar",
      "fr": "Gibraltar",
      "de": "Gibraltar",
      "es": "Gibraltar"
    },
    "tags": []
  },
  {
    "alpha_2": "GR",
    "locales": {
      "en": "Greece",
      "fr": "Grèce",
      "de": "Griechenland",
      "es": "Grecia"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "GL",
    "locales": {
      "en": "Greenland",
      "fr": "Groenland",
      "de": "Grönland",
      "es": "Groenlandia"
    },
    "tags": []
  },
  {
    "alpha_2": "GD",
    "locales": {
      "en": "Grenada",
      "fr": "Grenade",
      "de": "Grenada",
      "es": "Granada"
    },
    "tags": []
  },
  {
    "alpha_2": "GP",
    "locales": {
      "en": "Guadeloupe",
      "fr": "Guadeloupe",
      "de": "Guadeloupe",
      "es": "Guadalupe"
    },
    "tags": []
  },
  {
    "alpha_2": "GU",
    "locales": {
      "en": "Guam",
      "fr": "Guam",
      "de": "Guam",
      "es": "Guam"
    },
    "tags": []
  },
  {
    "alpha_2": "GT",
    "locales": {
      "en": "Guatemala",
      "fr": "Guatemala",
      "de": "Guatemala",
      "es": "Guatemala"
    },
    "tags": []
  },
  {
    "alpha_2": "GN",
    "locales": {
      "en": "Guinea",
      "fr": "Guinée",
      "de": "Guinea",
      "es": "Guinea"
    },
    "tags": []
  },
  {
    "alpha_2": "GW",
    "locales": {
      "en": "Guinea-Bissau",
      "fr": "Guinée-Bissau",
      "de": "Guinea-Bissau",
      "es": "Guinea-Bissau"
    },
    "tags": []
  },
  {
    "alpha_2": "GY",
    "locales": {
      "en": "Guyana",
      "fr": "Guyana",
      "de": "Guyana",
      "es": "Guayana"
    },
    "tags": []
  },
  {
    "alpha_2": "HT",
    "locales": {
      "en": "Haiti",
      "fr": "Haïti",
      "de": "Haiti",
      "es": "Haití"
    },
    "tags": []
  },
  {
    "alpha_2": "HM",
    "locales": {
      "en": "Heard Island and McDonald Islands",
      "fr": "Îles Heard-et-MacDonald",
      "de": "Heard-Insel und McDonald-Inseln",
      "es": "Islas Heard y McDonald"
    },
    "tags": []
  },
  {
    "alpha_2": "VA",
    "locales": {
      "en": "Holy See (Vatican City State)",
      "fr": "Saint-Siège (Etat du Vatican)",
      "de": "Vatikanstadt",
      "es": "Santa Sede (Ciudad del Vaticano)"
    },
    "tags": []
  },
  {
    "alpha_2": "HN",
    "locales": {
      "en": "Honduras",
      "fr": "Honduras",
      "de": "Honduras",
      "es": "Honduras"
    },
    "tags": []
  },
  {
    "alpha_2": "HK",
    "locales": {
      "en": "Hong Kong",
      "fr": "Hong Kong",
      "de": "Hong Kong",
      "es": "Hong Kong"
    },
    "tags": []
  },
  {
    "alpha_2": "HU",
    "locales": {
      "en": "Hungary",
      "fr": "Hongrie",
      "de": "Ungarn",
      "es": "Hungría"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "IS",
    "locales": {
      "en": "Iceland",
      "fr": "Islande",
      "de": "Island",
      "es": "Islandia"
    },
    "tags": []
  },
  {
    "alpha_2": "IN",
    "locales": {
      "en": "India",
      "fr": "Inde",
      "de": "Indien",
      "es": "India"
    },
    "tags": []
  },
  {
    "alpha_2": "ID",
    "locales": {
      "en": "Indonesia",
      "fr": "Indonésie",
      "de": "Indonesien",
      "es": "Indonesia"
    },
    "tags": []
  },
  {
    "alpha_2": "IQ",
    "locales": {
      "en": "Iraq",
      "fr": "Irak",
      "de": "Irak",
      "es": "Iraq"
    },
    "tags": []
  },
  {
    "alpha_2": "IE",
    "locales": {
      "en": "Ireland",
      "fr": "Irlande",
      "de": "Irland",
      "es": "Irlanda"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "IL",
    "locales": {
      "en": "Israel",
      "fr": "Israël",
      "de": "Israel",
      "es": "Israel"
    },
    "tags": []
  },
  {
    "alpha_2": "IT",
    "locales": {
      "en": "Italy",
      "fr": "Italie",
      "de": "Italien",
      "es": "Italia"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "JM",
    "locales": {
      "en": "Jamaica",
      "fr": "Jamaïque",
      "de": "Jamaica",
      "es": "Jamaica"
    },
    "tags": []
  },
  {
    "alpha_2": "JP",
    "locales": {
      "en": "Japan",
      "fr": "Japon",
      "de": "Japan",
      "es": "Japón"
    },
    "tags": []
  },
  {
    "alpha_2": "JO",
    "locales": {
      "en": "Jordan",
      "fr": "Jordanie",
      "de": "Jordanien",
      "es": "Jordania"
    },
    "tags": []
  },
  {
    "alpha_2": "KZ",
    "locales": {
      "en": "Kazakhstan",
      "fr": "Kazakhstan",
      "de": "Kasachstan",
      "es": "Kazajistán"
    },
    "tags": []
  },
  {
    "alpha_2": "KE",
    "locales": {
      "en": "Kenya",
      "fr": "Kenya",
      "de": "Kenia",
      "es": "Kenia"
    },
    "tags": []
  },
  {
    "alpha_2": "KI",
    "locales": {
      "en": "Kiribati",
      "fr": "Kiribati",
      "de": "Kiribati",
      "es": "Kiribati"
    },
    "tags": []
  },
  {
    "alpha_2": "KR",
    "locales": {
      "en": "Korea, Republic of",
      "fr": "République de Corée",
      "de": "Korea, Republik",
      "es": "República de Corea"
    },
    "tags": []
  },
  {
    "alpha_2": "XK",
    "locales": {
      "en": "Kosovo",
      "fr": "Kosovo",
      "de": "Kosovo",
      "es": "Kosovo"
    },
    "tags": []
  },
  {
    "alpha_2": "KW",
    "locales": {
      "en": "Kuwait",
      "fr": "Koweït",
      "de": "Kuwait",
      "es": "Kuwait"
    },
    "tags": []
  },
  {
    "alpha_2": "KG",
    "locales": {
      "en": "Kyrgyzstan",
      "fr": "Kirghizistan",
      "de": "Kirgisistan",
      "es": "Kirguistán"
    },
    "tags": []
  },
  {
    "alpha_2": "LA",
    "locales": {
      "en": "Lao People's Democratic Republic",
      "fr": "Laos",
      "de": "Laos",
      "es": "República Democrática Popular Lao"
    },
    "tags": []
  },
  {
    "alpha_2": "LV",
    "locales": {
      "en": "Latvia",
      "fr": "Lettonie",
      "de": "Lettland",
      "es": "Letonia"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "LB",
    "locales": {
      "en": "Lebanon",
      "fr": "Liban",
      "de": "Libanon",
      "es": "Líbano"
    },
    "tags": []
  },
  {
    "alpha_2": "LS",
    "locales": {
      "en": "Lesotho",
      "fr": "Lesotho",
      "de": "Lesotho",
      "es": "Lesoto"
    },
    "tags": []
  },
  {
    "alpha_2": "LR",
    "locales": {
      "en": "Liberia",
      "fr": "Liberia",
      "de": "Liberien",
      "es": "Liberia"
    },
    "tags": []
  },
  {
    "alpha_2": "LY",
    "locales": {
      "en": "Libya",
      "fr": "Libye",
      "de": "Libyen",
      "es": "Libia"
    },
    "tags": []
  },
  {
    "alpha_2": "LI",
    "locales": {
      "en": "Liechtenstein",
      "fr": "Liechtenstein",
      "de": "Liechtenstein",
      "es": "Liechtenstein"
    },
    "tags": []
  },
  {
    "alpha_2": "LT",
    "locales": {
      "en": "Lithuania",
      "fr": "Lituanie",
      "de": "Litauen",
      "es": "Lituania"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "LU",
    "locales": {
      "en": "Luxembourg",
      "fr": "Luxembourg",
      "de": "Luxembourg",
      "es": "Luxemburgo"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "MO",
    "locales": {
      "en": "Macao",
      "fr": "Macao",
      "de": "Macau",
      "es": "Macao"
    },
    "tags": []
  },
  {
    "alpha_2": "MK",
    "locales": {
      "en": "Macedonia",
      "fr": "Macédoine",
      "de": "Mazedonien",
      "es": "Macedonia"
    },
    "tags": []
  },
  {
    "alpha_2": "MG",
    "locales": {
      "en": "Madagascar",
      "fr": "Madagascar",
      "de": "Madagaskar",
      "es": "Madagascar"
    },
    "tags": []
  },
  {
    "alpha_2": "MW",
    "locales": {
      "en": "Malawi",
      "fr": "Malawi",
      "de": "Malawi",
      "es": "Malawi"
    },
    "tags": []
  },
  {
    "alpha_2": "MY",
    "locales": {
      "en": "Malaysia",
      "fr": "Malaisie",
      "de": "Malaysia",
      "es": "Malasia"
    },
    "tags": []
  },
  {
    "alpha_2": "MV",
    "locales": {
      "en": "Maldives",
      "fr": "Maldives",
      "de": "Malediven",
      "es": "Maldivas"
    },
    "tags": []
  },
  {
    "alpha_2": "ML",
    "locales": {
      "en": "Mali",
      "fr": "Mali",
      "de": "Mali",
      "es": "Mali"
    },
    "tags": []
  },
  {
    "alpha_2": "MT",
    "locales": {
      "en": "Malta",
      "fr": "Malte",
      "de": "Malta",
      "es": "Malta"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "MH",
    "locales": {
      "en": "Marshall Islands",
      "fr": "Îles Marshall",
      "de": "Marshallinseln",
      "es": "Islas Marshall"
    },
    "tags": []
  },
  {
    "alpha_2": "MQ",
    "locales": {
      "en": "Martinique",
      "fr": "Martinique",
      "de": "Martinique",
      "es": "Martinica"
    },
    "tags": []
  },
  {
    "alpha_2": "MR",
    "locales": {
      "en": "Mauritania",
      "fr": "Mauritanie",
      "de": "Mauritanien",
      "es": "Mauritania"
    },
    "tags": []
  },
  {
    "alpha_2": "MU",
    "locales": {
      "en": "Mauritius",
      "fr": "Île Maurice",
      "de": "Mauritius",
      "es": "Mauricio"
    },
    "tags": []
  },
  {
    "alpha_2": "YT",
    "locales": {
      "en": "Mayotte",
      "fr": "Mayotte",
      "de": "Mayotte",
      "es": "Mayotte"
    },
    "tags": []
  },
  {
    "alpha_2": "MX",
    "locales": {
      "en": "Mexico",
      "fr": "Mexique",
      "de": "Mexiko",
      "es": "México"
    },
    "tags": []
  },
  {
    "alpha_2": "FM",
    "locales": {
      "en": "Micronesia, Federated States of",
      "fr": "Micronésie (Etats fédéraux de)",
      "de": "Mikronesien",
      "es": "Estados Federados de Micronesia"
    },
    "tags": []
  },
  {
    "alpha_2": "MD",
    "locales": {
      "en": "Moldova, Republic of",
      "fr": "Moldavie (République de)",
      "de": "Moldawien",
      "es": "Moldavia, República de"
    },
    "tags": []
  },
  {
    "alpha_2": "MC",
    "locales": {
      "en": "Monaco",
      "fr": "Monaco",
      "de": "Monaco",
      "es": "Mónaco"
    },
    "tags": []
  },
  {
    "alpha_2": "MN",
    "locales": {
      "en": "Mongolia",
      "fr": "Mongolie",
      "de": "Mongolei",
      "es": "Mongolia"
    },
    "tags": []
  },
  {
    "alpha_2": "ME",
    "locales": {
      "en": "Montenegro",
      "fr": "Monténégro",
      "de": "Montenegro",
      "es": "Montenegro"
    },
    "tags": []
  },
  {
    "alpha_2": "MS",
    "locales": {
      "en": "Montserrat",
      "fr": "Montserrat",
      "de": "Montserrat",
      "es": "Montserrat"
    },
    "tags": []
  },
  {
    "alpha_2": "MA",
    "locales": {
      "en": "Morocco",
      "fr": "Maroc",
      "de": "Marokko",
      "es": "Marruecos"
    },
    "tags": []
  },
  {
    "alpha_2": "MZ",
    "locales": {
      "en": "Mozambique",
      "fr": "Mozambique",
      "de": "Mosambik",
      "es": "Mozambique"
    },
    "tags": []
  },
  {
    "alpha_2": "MM",
    "locales": {
      "en": "Myanmar",
      "fr": "Myanmar",
      "de": "Myanmar",
      "es": "Birmania"
    },
    "tags": []
  },
  {
    "alpha_2": "NA",
    "locales": {
      "en": "Namibia",
      "fr": "Namibie",
      "de": "Namibia",
      "es": "Namibia"
    },
    "tags": []
  },
  {
    "alpha_2": "NR",
    "locales": {
      "en": "Nauru",
      "fr": "Nauru",
      "de": "Nauru",
      "es": "Nauru"
    },
    "tags": []
  },
  {
    "alpha_2": "NP",
    "locales": {
      "en": "Nepal",
      "fr": "Népal",
      "de": "Nepal",
      "es": "Nepal"
    },
    "tags": []
  },
  {
    "alpha_2": "NL",
    "locales": {
      "en": "Netherlands",
      "fr": "Pays-Bas",
      "de": "Niederlande",
      "es": "Países Bajos"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "AN",
    "locales": {
      "en": "Netherlands Antilles",
      "fr": "Pays-Bas antillais",
      "de": "Niederländische Antillen",
      "es": "Antillas Neerlandesas"
    },
    "tags": []
  },
  {
    "alpha_2": "NC",
    "locales": {
      "en": "New Caledonia",
      "fr": "Nouvelle-Calédonie",
      "de": "Neukaledonien",
      "es": "Nueva Caledonia"
    },
    "tags": []
  },
  {
    "alpha_2": "NZ",
    "locales": {
      "en": "New Zealand",
      "fr": "Nouvelle-Zélande",
      "de": "Neuseeland",
      "es": "Nueva Zelandia"
    },
    "tags": []
  },
  {
    "alpha_2": "NI",
    "locales": {
      "en": "Nicaragua",
      "fr": "Nicaragua",
      "de": "Nicaragua",
      "es": "Nicaragua"
    },
    "tags": []
  },
  {
    "alpha_2": "NE",
    "locales": {
      "en": "Niger",
      "fr": "Niger",
      "de": "Niger",
      "es": "Níger"
    },
    "tags": []
  },
  {
    "alpha_2": "NG",
    "locales": {
      "en": "Nigeria",
      "fr": "Nigeria",
      "de": "Nigeria",
      "es": "Nigeria"
    },
    "tags": []
  },
  {
    "alpha_2": "NU",
    "locales": {
      "en": "Niue",
      "fr": "Niue",
      "de": "Niue",
      "es": "Niue"
    },
    "tags": []
  },
  {
    "alpha_2": "NF",
    "locales": {
      "en": "Norfolk Island",
      "fr": "Île de Norfolk",
      "de": "Norfolkinseln",
      "es": "Isla Norfolk"
    },
    "tags": []
  },
  {
    "alpha_2": "MP",
    "locales": {
      "en": "Northern Mariana Islands",
      "fr": "Îles Mariannes du Nord",
      "de": "Nördliche Marianen",
      "es": "Islas Marianas del Norte"
    },
    "tags": []
  },
  {
    "alpha_2": "NO",
    "locales": {
      "en": "Norway",
      "fr": "Norvège",
      "de": "Norwegen",
      "es": "Noruega"
    },
    "tags": []
  },
  {
    "alpha_2": "OM",
    "locales": {
      "en": "Oman",
      "fr": "Oman",
      "de": "Oman",
      "es": "Omán"
    },
    "tags": []
  },
  {
    "alpha_2": "PK",
    "locales": {
      "en": "Pakistan",
      "fr": "Pakistan",
      "de": "Pakistan",
      "es": "Pakistán"
    },
    "tags": []
  },
  {
    "alpha_2": "PW",
    "locales": {
      "en": "Palau",
      "fr": "Palaos",
      "de": "Palau",
      "es": "Palau"
    },
    "tags": []
  },
  {
    "alpha_2": "PS",
    "locales": {
      "en": "Palestine, State of",
      "fr": "Etat de Palestine",
      "de": "Staat Palästina",
      "es": "Estado de Palestina"
    },
    "tags": []
  },
  {
    "alpha_2": "PA",
    "locales": {
      "en": "Panama",
      "fr": "Panama",
      "de": "Panama",
      "es": "Panamá"
    },
    "tags": []
  },
  {
    "alpha_2": "PG",
    "locales": {
      "en": "Papua New Guinea",
      "fr": "Papouasie-Nouvelle Guinée",
      "de": "Papua-Neuguinea",
      "es": "Papúa Nueva Guinea"
    },
    "tags": []
  },
  {
    "alpha_2": "PY",
    "locales": {
      "en": "Paraguay",
      "fr": "Paraguay",
      "de": "Paraguay",
      "es": "Paraguay"
    },
    "tags": []
  },
  {
    "alpha_2": "PE",
    "locales": {
      "en": "Peru",
      "fr": "Pérou",
      "de": "Peru",
      "es": "Perú"
    },
    "tags": []
  },
  {
    "alpha_2": "PH",
    "locales": {
      "en": "Philippines",
      "fr": "Philippines",
      "de": "Philippinen",
      "es": "Filipinas"
    },
    "tags": []
  },
  {
    "alpha_2": "PN",
    "locales": {
      "en": "Pitcairn",
      "fr": "Île Pitcairn",
      "de": "Pitcairninseln",
      "es": "Islas Pitcairn"
    },
    "tags": []
  },
  {
    "alpha_2": "PL",
    "locales": {
      "en": "Poland",
      "fr": "Pologne",
      "de": "Polen",
      "es": "Polonia"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "PT",
    "locales": {
      "en": "Portugal",
      "fr": "Portugal",
      "de": "Portugal",
      "es": "Portugal"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "PR",
    "locales": {
      "en": "Puerto Rico",
      "fr": "Porto Rico",
      "de": "Puerto Rico",
      "es": "Puerto Rico"
    },
    "tags": []
  },
  {
    "alpha_2": "QA",
    "locales": {
      "en": "Qatar",
      "fr": "Qatar",
      "de": "Katar",
      "es": "Qatar"
    },
    "tags": []
  },
  {
    "alpha_2": "RO",
    "locales": {
      "en": "Romania",
      "fr": "Roumanie",
      "de": "Rumänien",
      "es": "Rumania"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "RU",
    "locales": {
      "en": "Russian Federation",
      "fr": "Russie (Fédération de)",
      "de": "Russische Federation",
      "es": "Federación Rusa"
    },
    "tags": []
  },
  {
    "alpha_2": "RW",
    "locales": {
      "en": "Rwanda",
      "fr": "Rwanda",
      "de": "Ruanda",
      "es": "Ruanda"
    },
    "tags": []
  },
  {
    "alpha_2": "RE",
    "locales": {
      "en": "Réunion",
      "fr": "La Réunion",
      "de": "Réunion",
      "es": "Reunión"
    },
    "tags": []
  },
  {
    "alpha_2": "BL",
    "locales": {
      "en": "Saint Barthélemy",
      "fr": "Saint-Barthélemy",
      "de": "Saint-Barthélemy",
      "es": "San Bartolomé"
    },
    "tags": []
  },
  {
    "alpha_2": "SH",
    "locales": {
      "en": "Saint Helena",
      "fr": "Saint-Hélène",
      "de": "St. Helena",
      "es": "Santa Helena"
    },
    "tags": []
  },
  {
    "alpha_2": "KN",
    "locales": {
      "en": "Saint Kitts and Nevis",
      "fr": "Saint-Christophe-et-Niévès",
      "de": "St. Kitts und Nevis",
      "es": "San Cristóbal y Nieves"
    },
    "tags": []
  },
  {
    "alpha_2": "LC",
    "locales": {
      "en": "Saint Lucia",
      "fr": "Sainte-Lucie",
      "de": "St. Lucia",
      "es": "Santa Lucía"
    },
    "tags": []
  },
  {
    "alpha_2": "PM",
    "locales": {
      "en": "Saint Pierre and Miquelon",
      "fr": "Saint-Pierre-et-Miquelon",
      "de": "Saint Pierre und Miquelon",
      "es": "San Pedro y Miquelón"
    },
    "tags": []
  },
  {
    "alpha_2": "VC",
    "locales": {
      "en": "Saint Vincent and the Grenadines",
      "fr": "Saint-Vincent-et-les-Grenadines",
      "de": "St. Vincent und die Grenadinen",
      "es": "San Vicente y las Granadinas"
    },
    "tags": []
  },
  {
    "alpha_2": "WS",
    "locales": {
      "en": "Samoa",
      "fr": "Samoa",
      "de": "Samoa",
      "es": "Samoa"
    },
    "tags": []
  },
  {
    "alpha_2": "SM",
    "locales": {
      "en": "San Marino",
      "fr": "Saint-Marin",
      "de": "San Marino",
      "es": "San Marino"
    },
    "tags": []
  },
  {
    "alpha_2": "ST",
    "locales": {
      "en": "Sao Tome and Principe",
      "fr": "Sao Tomé-et-Principe",
      "de": "Sao Tome und Principe",
      "es": "Santo Tomé y Príncipe"
    },
    "tags": []
  },
  {
    "alpha_2": "SA",
    "locales": {
      "en": "Saudi Arabia",
      "fr": "Arabie Saoudite",
      "de": "Saudi Arabien",
      "es": "Arabia Saudita"
    },
    "tags": []
  },
  {
    "alpha_2": "SN",
    "locales": {
      "en": "Senegal",
      "fr": "Sénégal",
      "de": "Senegal",
      "es": "Senegal"
    },
    "tags": []
  },
  {
    "alpha_2": "RS",
    "locales": {
      "en": "Serbia",
      "fr": "Serbie",
      "de": "Serbien",
      "es": "Serbia"
    },
    "tags": []
  },
  {
    "alpha_2": "SC",
    "locales": {
      "en": "Seychelles",
      "fr": "Seychelles",
      "de": "Seychellen",
      "es": "Seychelles"
    },
    "tags": []
  },
  {
    "alpha_2": "SL",
    "locales": {
      "en": "Sierra Leone",
      "fr": "Sierra Leone",
      "de": "Sierra Leone",
      "es": "Sierra Leona"
    },
    "tags": []
  },
  {
    "alpha_2": "SG",
    "locales": {
      "en": "Singapore",
      "fr": "Singapour",
      "de": "Singapur",
      "es": "Singapur"
    },
    "tags": []
  },
  {
    "alpha_2": "SX",
    "locales": {
      "en": "Sint Maarten",
      "fr": "Sint Maarten",
      "de": "Sint Maarten",
      "es": "Sint Maarten"
    },
    "tags": []
  },
  {
    "alpha_2": "SK",
    "locales": {
      "en": "Slovakia",
      "fr": "Slovaque",
      "de": "Slowakei",
      "es": "Eslovaquia"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "SI",
    "locales": {
      "en": "Slovenia",
      "fr": "Slovénie",
      "de": "Slowenien",
      "es": "Eslovenia"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "SB",
    "locales": {
      "en": "Solomon Islands",
      "fr": "Îles Salomon",
      "de": "Salomoninseln",
      "es": "Islas Salomón"
    },
    "tags": []
  },
  {
    "alpha_2": "SO",
    "locales": {
      "en": "Somalia",
      "fr": "Somalie",
      "de": "Somalia",
      "es": "Somalia"
    },
    "tags": []
  },
  {
    "alpha_2": "ZA",
    "locales": {
      "en": "South Africa",
      "fr": "Afrique du Sud",
      "de": "Südafrika",
      "es": "Sudáfrica"
    },
    "tags": []
  },
  {
    "alpha_2": "GS",
    "locales": {
      "en": "South Georgia and the South Sandwich Islands",
      "fr": "Géorgie du Sud-et-les Îles Sandwich du Sud",
      "de": "Süd-Georgien und südliche Sandwichinseln",
      "es": "Islas Georgia del Sur y Sandwich del Sur"
    },
    "tags": []
  },
  {
    "alpha_2": "ES",
    "locales": {
      "en": "Spain",
      "fr": "Espagne",
      "de": "Spanien",
      "es": "España"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "LK",
    "locales": {
      "en": "Sri Lanka",
      "fr": "Sri Lanka",
      "de": "Sri Lanka",
      "es": "Sri Lanka"
    },
    "tags": []
  },
  {
    "alpha_2": "SR",
    "locales": {
      "en": "Suriname",
      "fr": "Surinam",
      "de": "Suriname",
      "es": "Surinam"
    },
    "tags": []
  },
  {
    "alpha_2": "SJ",
    "locales": {
      "en": "Svalbard and Jan Mayen",
      "fr": "Svalbard et île Jan Mayen",
      "de": "Svalbard und Jan Mayen Insel",
      "es": "Svalbard y Jan Mayen"
    },
    "tags": []
  },
  {
    "alpha_2": "SZ",
    "locales": {
      "en": "Swaziland",
      "fr": "Swaziland",
      "de": "Swaziland",
      "es": "Swazilandia"
    },
    "tags": []
  },
  {
    "alpha_2": "SE",
    "locales": {
      "en": "Sweden",
      "fr": "Suède",
      "de": "Schweden",
      "es": "Suecia"
    },
    "tags": [
      "european_union"
    ]
  },
  {
    "alpha_2": "CH",
    "locales": {
      "en": "Switzerland",
      "fr": "Suisse",
      "de": "Schweiz",
      "es": "Suiza"
    },
    "tags": []
  },
  {
    "alpha_2": "TW",
    "locales": {
      "en": "Taiwan",
      "fr": "Taïwan",
      "de": "Taiwan",
      "es": "Taiwán"
    },
    "tags": []
  },
  {
    "alpha_2": "TJ",
    "locales": {
      "en": "Tajikistan",
      "fr": "Tadjikistan",
      "de": "Tadshikistan",
      "es": "Tayikistán"
    },
    "tags": []
  },
  {
    "alpha_2": "TZ",
    "locales": {
      "en": "Tanzania, United Republic of",
      "fr": "Tanzanie (République unie de)",
      "de": "Tansania",
      "es": "República Unida de Tanzania"
    },
    "tags": []
  },
  {
    "alpha_2": "TH",
    "locales": {
      "en": "Thailand",
      "fr": "Thaïlande",
      "de": "Thailand",
      "es": "Tailandia"
    },
    "tags": []
  },
  {
    "alpha_2": "TL",
    "locales": {
      "en": "Timor-Leste",
      "fr": "Timor-Oriental",
      "de": "Timor-Leste",
      "es": "Timor Oriental"
    },
    "tags": []
  },
  {
    "alpha_2": "TG",
    "locales": {
      "en": "Togo",
      "fr": "Togo",
      "de": "Togo",
      "es": "Togo"
    },
    "tags": []
  },
  {
    "alpha_2": "TK",
    "locales": {
      "en": "Tokelau",
      "fr": "Tokelau",
      "de": "Tokelau",
      "es": "Tokelau"
    },
    "tags": []
  },
  {
    "alpha_2": "TO",
    "locales": {
      "en": "Tonga",
      "fr": "Tonga",
      "de": "Tonga",
      "es": "Tonga"
    },
    "tags": []
  },
  {
    "alpha_2": "TT",
    "locales": {
      "en": "Trinidad and Tobago",
      "fr": "Trinidad-et-Tobago",
      "de": "Trinidad und Tobago",
      "es": "Trinidad y Tobago"
    },
    "tags": []
  },
  {
    "alpha_2": "TN",
    "locales": {
      "en": "Tunisia",
      "fr": "Tunisie",
      "de": "Tunesien",
      "es": "Túnez"
    },
    "tags": []
  },
  {
    "alpha_2": "TR",
    "locales": {
      "en": "Turkey",
      "fr": "Turquie",
      "de": "Türkei",
      "es": "Turquía"
    },
    "tags": []
  },
  {
    "alpha_2": "TM",
    "locales": {
      "en": "Turkmenistan",
      "fr": "Turkménistan",
      "de": "Turkmenistan",
      "es": "Turkmenistán"
    },
    "tags": []
  },
  {
    "alpha_2": "TC",
    "locales": {
      "en": "Turks and Caicos Islands",
      "fr": "Îles Turques-et-Caïques",
      "de": "Turks- und Caicosinseln",
      "es": "Islas Turcos y Caicos"
    },
    "tags": []
  },
  {
    "alpha_2": "TV",
    "locales": {
      "en": "Tuvalu",
      "fr": "Tuvalu",
      "de": "Tuvalu",
      "es": "Tuvalu"
    },
    "tags": []
  },
  {
    "alpha_2": "UG",
    "locales": {
      "en": "Uganda",
      "fr": "Ouganda",
      "de": "Uganda",
      "es": "Uganda"
    },
    "tags": []
  },
  {
    "alpha_2": "UA",
    "locales": {
      "en": "Ukraine",
      "fr": "Ukraine",
      "de": "Ukraine",
      "es": "Ucrania"
    },
    "tags": []
  },
  {
    "alpha_2": "AE",
    "locales": {
      "en": "United Arab Emirates",
      "fr": "Emirats Arabes Unis",
      "de": "Vereinte Arabische Emirate",
      "es": "Emiratos Árabes Unidos"
    },
    "tags": []
  },
  {
    "alpha_2": "UM",
    "locales": {
      "en": "United States Minor Outlying Islands",
      "fr": "Îles mineures éloignées des Etats-Unis",
      "de": "Amerikanisch-Ozeanien",
      "es": "Islas Ultramarinas Menores de Estados Unidos"
    },
    "tags": []
  },
  {
    "alpha_2": "UY",
    "locales": {
      "en": "Uruguay",
      "fr": "Uruguay",
      "de": "Uruguay",
      "es": "Uruguay"
    },
    "tags": []
  },
  {
    "alpha_2": "UZ",
    "locales": {
      "en": "Uzbekistan",
      "fr": "Ouzbékistan",
      "de": "Usbekistan",
      "es": "Uzbekistán"
    },
    "tags": []
  },
  {
    "alpha_2": "VU",
    "locales": {
      "en": "Vanuatu",
      "fr": "Vanuatu",
      "de": "Vanuatu",
      "es": "Vanuatu"
    },
    "tags": []
  },
  {
    "alpha_2": "VE",
    "locales": {
      "en": "Venezuela",
      "fr": "Vénézuela",
      "de": "Venezuela",
      "es": "Venezuela"
    },
    "tags": []
  },
  {
    "alpha_2": "VN",
    "locales": {
      "en": "Vietnam",
      "fr": "Viêtnam",
      "de": "Vietnam",
      "es": "Vietnam"
    },
    "tags": []
  },
  {
    "alpha_2": "VG",
    "locales": {
      "en": "Virgin Islands, British",
      "fr": "Îles Vierges britanniques",
      "de": "Britische Jungferninseln",
      "es": "Islas Vírgenes Británicas"
    },
    "tags": []
  },
  {
    "alpha_2": "VI",
    "locales": {
      "en": "Virgin Islands, U.S.",
      "fr": "Îles Vierges américaines",
      "de": "US-Jungferninseln",
      "es": "Islas Vírgenes de los EE.UU."
    },
    "tags": []
  },
  {
    "alpha_2": "WF",
    "locales": {
      "en": "Wallis and Futuna",
      "fr": "Wallis-et-Futuna",
      "de": "Wallis und Futuna",
      "es": "Wallis y Futuna"
    },
    "tags": []
  },
  {
    "alpha_2": "EH",
    "locales": {
      "en": "Western Sahara",
      "fr": "Sahara occidental",
      "de": "Westsahara",
      "es": "Sahara Occidental"
    },
    "tags": []
  },
  {
    "alpha_2": "YE",
    "locales": {
      "en": "Yemen",
      "fr": "Yémen",
      "de": "Jemen",
      "es": "Yemen"
    },
    "tags": []
  },
  {
    "alpha_2": "ZM",
    "locales": {
      "en": "Zambia",
      "fr": "Zambie",
      "de": "Sambia",
      "es": "Zambia"
    },
    "tags": []
  },
  {
    "alpha_2": "ZW",
    "locales": {
      "en": "Zimbabwe",
      "fr": "Zimbabwe",
      "de": "Simbabwe",
      "es": "Zimbabue"
    },
    "tags": []
  }
]);

(function () {
  'use strict';
  angular.module('utils').factory('csrfToken', function () {
    var csrfTokenService = {};
    var _token;

    csrfTokenService.getToken = function() {
      if (typeof _token === 'undefined') {
        _token = $('meta[name=csrf-token]').attr('content');
      }

      return _token;
    };

    return csrfTokenService;
  });
})();

(function (currenciesJson) {
  'use strict';
  angular.module('utils').factory('currencies', function () {
    function CurrenciesService(initialCurrencies) {
      var currencies = initialCurrencies;

      this.asOptions = function () {
        return _.map(currencies, function (currency) {
          return { value: currency.iso_num, text: currency.iso_code };
        });
      };

      this.all = function () {
        return currencies;
      };

      this.asPartnerOptions = function () {
        return _.map(currencies, function (currency) {
          return { value: currency.id, text: (currency.iso_code + ' (' + currency.symbol + ')')};
        });
      };

      this.asSimpleOptions = function () {
        return _.select(this.asOptions(), function (currencyOption) {
          return currencyOption.text === 'USD' ||
            currencyOption.text === 'CAD' ||
            currencyOption.text === 'GBP';
        });
      };

      this.forIsoNum = function (isoNum) {
        return _.findWhere(currencies, {iso_num: parseInt(isoNum)});
      };

      this.forIsoCode = function (isoCode) {
        return _.findWhere(currencies, {iso_code: isoCode});
      };
    }

    return new CurrenciesService(currenciesJson);
  });
})(
  /* To refresh, open up a Rails console and type "puts JSON.pretty_generate(Currency.visible_list.map { |cur| CurrencySerializer.new(cur).serializable_hash })" */
  [
    {
      "iso_num": 840,
      "symbol": "$",
      "iso_code": "USD"
    },
    {
      "iso_num": 978,
      "symbol": "€",
      "iso_code": "EUR"
    },
    {
      "iso_num": 826,
      "symbol": "£",
      "iso_code": "GBP"
    },
    {
      "iso_num": 124,
      "symbol": "$",
      "iso_code": "CAD"
    },
    {
      "iso_num": 36,
      "symbol": "$",
      "iso_code": "AUD"
    }
  ]
);

(function() {
  angular.module('utils').filter('currencyDisplay', ['currencies', function(currencies) {
    return function(input, property) {
      var currentCurrency = currencies.forIsoNum(input.currency_iso_num);
      return currentCurrency[property || 'symbol'];
    };
  }]);
})();

(function () {
  'use strict';

  angular.module('utils').directive('dotdotdot', ['$timeout',
    function ($timeout) {
      return {
        restrict: 'A',
        scope: {
          numLines: '=dotdotdotNumLines'
        },
        link: function(scope, element) {
          if (typeof scope.numLines === 'undefined') {
            element.dotdotdot();
          } else {
            $timeout(function() {
              var desiredTotalHeight = parseInt(element.css("line-height")) * scope.numLines;
              element.dotdotdot({
                height: desiredTotalHeight,
                wrap: "letter",
                watch: "window"
              });
            });
          }
        }
      };
    }
  ]);
})();

(function() {
  angular.module('utils')
    .directive('eventOn', ['gogoEvents', function (gogoEvents) {
      function isCommand(element) {
        return ['a:','button:','button:button','button:submit','input:button','input:submit'].indexOf(
            element.tagName.toLowerCase()+':'+(element.type||'')) >= 0;
      }

      function inferEventName(element) {
        if (isCommand(element)) return element.innerText || element.value;
        return element.id || element.name || element.tagName;
      }

      function isProperty(name) {
        return name.substr(0, 5) === 'event' && ['On', 'If', 'Tags', 'Name'].indexOf(name.substr(5)) === -1;
      }

      function propertyName(name) {
        var s = name.slice(5); // slice off the 'event' prefix
        if (typeof s !== 'undefined' && s!==null && s.length > 0) {
          return camelToUnderscore(s.substring(0, 1).toLowerCase() + s.substring(1));
        }
        else {
          return s;
        }
      }

      function camelToUnderscore(str) {
        return str.replace(/([A-Z])/g, function($1){return "_"+$1.toLowerCase();});
      }

      function eventTrack(action, properties) {
        gogoEvents.captureEvent(action, properties);
      }

      return {
        restrict: 'A',
        link: function ($scope, $element, $attrs) {
          var eventType = $attrs.eventOn;
          var trackingData = {};

          angular.forEach($attrs.$attr, function(attr, name) {
            if (isProperty(name)) {
              trackingData[propertyName(name)] = $attrs[name];
              $attrs.$observe(name, function(value){
                trackingData[propertyName(name)] = value;
              });
            }
          });

          angular.element($element[0]).bind(eventType, function ($event) {
            var eventName = $attrs.eventName || inferEventName($element[0]);

            if($attrs.eventIf){
              if(!$scope.$eval($attrs.eventIf)){
                return; // Cancel this event if we don't pass the event-if condition
              }
            }
            // Allow components to pass through an expression that gets merged on to the event properties
            // eg. event-tags='{{eventTags()}}'
            if($attrs.eventTags){
              angular.extend(trackingData, $scope.$eval($attrs.eventTags));
            }
            eventTrack(eventName, trackingData);
          });
        }
      };
    }]);
})();

/* global FB:false */
(function () {
  angular.module('utils').factory('fb', ['$http', '$q', 'gon', function ($http, $q, gon) {
    var fb = {};

    fb.login = function(args) {
      var deferred = $q.defer();
      FB.login(function(response) {
        deferred.resolve(response);
      }, args);
      return deferred.promise;
    };

    fb.simple_share = function(uri, options){
      var params = _.merge({
        method: 'share',
        href: uri
      }, options || {});
      return fb.ui(params);
    };

    fb.og_share = function(uri, options){
      options = options || {};

      var ref = 'gogo__'.concat(options.iggref || 'fblk');
      var properties = {
        campaign: uri,
        ref: options.account_id? ref.concat('__', options.account_id): ref,
        'fb:explicitly_shared': 1,
      };

      var action_type = gon.fb_namespace + ':share';
      var params = {
        method: 'share_open_graph',
        action_type: action_type,
        action_properties: JSON.stringify(properties)
      };
      return fb.ui(params);
    };

    fb.share = function(uri, options){
      if (gon.fb_og_active){
        return fb.og_share(uri, options);
      } else {
        return fb.simple_share(uri, options);
      }
    };

    fb.ui = function(params) {
      var deferred = $q.defer();
      FB.ui(params, function(response) {
        if (response && !response.error_code) {
          deferred.resolve(response);
        } else {
          deferred.reject(response);
        }
      });
      return deferred.promise;
    };

    fb.getShareCount = function(canonicalUri) {
      var deferred = $q.defer();
      FB.api(
        "/?id=" + encodeURIComponent(canonicalUri),
        function (response) {
          var count = 0;
          if (response && response.share) {
            if (response.share.share_count) {
              count += response.share.share_count;
            }
            if (response.share.comment_count) {
              count += response.share.comment_count;
            }
          }
          deferred.resolve(count);
        }
      );
      return deferred.promise;
    };

    fb.refreshAllWidgets = function () {
      try{
        FB.XFBML.parse();
      }catch(ex){}
    };

    return fb;
  }]);
})();

(function() {
  'use strict';

  angular.module('utils').directive('fbTrackingPixel', ['$window', '$log', 'gon', function ($window, $log, gon) {
    return {
      restrict: 'E',
      scope: {},
      templateUrl: 'views/fb_tracking_pixel.html',
      link: function(scope, element, attrs) {
        scope.shouldTrack = gon.tracking_info &&
                            gon.tracking_info.fb_pixel_id &&
                            (gon.tracking_info.amount || gon.tracking_info.amount === 0) &&
                            gon.tracking_info.currency_iso_code;

        angular.element(document).ready(function () {
          if (scope.shouldTrack) {
            var _fbq = $window._fbq || ($window._fbq = []);
            if (!_fbq.loaded) {
              var fbds = document.createElement('script');
              fbds.async = true;
              fbds.src = '//connect.facebook.net/en_US/fbds.js';
              var s = document.getElementsByTagName('script')[0];
              s.parentNode.insertBefore(fbds, s);
              _fbq.loaded = true;
            }
            $window._fbq = $window._fbq || [];
            _fbq.push(['track', gon.tracking_info.fb_pixel_id, {
              'value': gon.tracking_info.amount,
              'currency': gon.tracking_info.currency_iso_code
            }]);
          } else {
            $log.debug('fbTrackingPixel directive rendered without required attributes: pixel-id, amount, currencyIsoCode');
          }
        });

        scope.fbTrackingPixelUrl = function() {
          return "https://www.facebook.com/tr?ev=" + gon.tracking_info.fb_pixel_id +
            "&cd[value]=" + gon.tracking_info.amount +
            "&cd[currency]=" + gon.tracking_info.currency_iso_code +
            "&noscript=1";
        };
      }
    };
  }]);
}());

var showFlashMessage;

(function() {
  angular.module("utils").factory("flash", ['browser', function (browser) {
    var flashService = {};
    var callbacks = [];
    flashService.addMessage = function (alertLevel, msg, options) {
      for (var i=0; i<callbacks.length; ++i) {
        callbacks[i](alertLevel, msg, options);
      }
      browser.scrollToTop();
    };

    flashService.onNewMessage = function(callback) {
      callbacks.push(callback);
    };

    showFlashMessage = function(args) {
      flashService.addMessage(args.alertLevel, args.messageText, {fromOutsideAngular: true, html: args.html});
    };

    return flashService;
  }]);
})();

angular.module('utils').directive('gaContentGroup', ['ga', function (ga) {
  return {
    scope: {},
    link: function(scope, element, attrs) {
      ga('set', 'contentGroup1', attrs.gaContentGroup);
    }
  };
}]);

(function() {
  angular.module('utils')
  .directive('gaRawOn', function($window) {
    return {
      scope: {
        'gaRawOn': '@',
        'gaRaw': '@'
      },
      link: function($scope, $element, $attrs) {
        $element.on($attrs.gaRawOn || 'click', function() {
          var args = $scope.$eval($scope.gaRaw);
          $window.ga.apply(ga, args);
        });
      }
    };
  });
}());

(function () {
  angular.module('utils').factory('gogoLocation', ['$window', function gogoLocation ($window) {
    return $window.location;
  }]);
})();

(function () {
  angular.module('utils').factory('gogoEvents', ['$http', '$window', '$log', 'gon', function ($http, $window, $log, gon) {
    var service = {};
    var defaultAnnotations = [
      'request_remote_ip',
      'request_user_agent',
      'request_host',
      'source_bot',
      'source_locale',
      'source_country',
      'source_region',
      'source_browser',
      'source_mobile',
      'visitor_id',
      'session_id'
    ];

    var defaultEventTags = function() {
      return _.clone(gon.default_event_tags) || {};
    };

    service.captureEvent = function(eventName, properties){
      var eventProperties = angular.extend(defaultEventTags(), properties);

      var data = {
        event_types: [eventName],
        event_data: eventProperties,
        annotations: defaultAnnotations
      };

      $http.post('/analytics/events/batch', {events: [data]})
        .success(function(response){
          return true;
        })
        .error(function(response){
          $log.debug(eventName, "gogoEvent Failure");
          $log.debug(response);
          return false;
        });
    };

    return service;
  }]);
})();

(function() {
  'use strict';

  angular.module("utils").directive("gaEventOn", ['ga', function(ga) {

    return {
      restrict: 'A',
      scope: {
        category: '@gaEventCategory',
        action: '@gaEventAction',
        label: '@gaEventLabel',
        value: '@gaEventValue',
        performIf: '&gaEventIf'
      },
      link: function(scope, element, attrs) {
        // jQuery DOM event like click, blur, hover
        var onEvent = attrs.gaEventOn.toLowerCase();
        element.bind(onEvent, function() {
          var params = ['category', 'action', 'label', 'value'];
          var gaArgs = ['send', 'event'];

          var perform = scope.performIf();
          if (perform === undefined) { // if not present, perform unconditionally
            perform = true;
          }
          if (!perform) { // skip submitting this event because criteria aren't right
            return;
          }

          // Add Category, Action, Label, and Value GA parameters, in this order.
          // Stop looking and proceed when any of the four are not present.
          for (var i=0; i < params.length; i++) {
            var val = scope.$eval(params[i]);

            if (!val ) { // skip if parameter not present
              break;
            }

            gaArgs.push(val);
          }

          // only send events that have a category (3rd argument)
          if (gaArgs.length > 2) {
            ga.apply(this, gaArgs);
          }
        });
      }
    };
  }]);
})();

(function () {
  'use strict';
  angular.module('utils').factory('gplus', ['$window', function($window) {
    return {
      refreshAllWidgets: function () {
        var gapi = $window.gapi;
        if (typeof(gapi) !== 'undefined') {
          gapi.plusone.go();
        }
      }
    };
  }]);
})();

(function () {
  angular.module('utils').filter('htmlWrapped', function() {
    return function(text, tag) {
      var tagEl = $(tag);
      tagEl.text(text);
      var wrapperEl = $("<div>");
      wrapperEl.append(tagEl);
      return wrapperEl.html();
    };
  });
})();

(function () {

  function i18n ($sce, gon, I18nRails) {

    function translatePrependingPersonalIfOnIggLife (key, options) {
      if (typeof(gon) !== 'undefined' && gon.subdomain === "life") {
        return translate('personal.' + key, options);
      } else {
        return translate(key, options);
      }
    }

    function translate (key, options) {
      var translation = I18nRails.t(key, options);
      if (key.match(/html$/)) {
        return $sce.trustAsHtml(translation);
      } else {
        return translation;
      }
    }

    function strftime (object, format) {
      return I18nRails.strftime(object, format);
    }

    function setLocale (newLocale) {
      I18nRails.locale = newLocale || I18nRails.defaultLocale;
      this.locale = newLocale || I18nRails.defaultLocale;
    }

    function localize(date, options) {
      var format = I18nRails.lookup('date.formats.' + options.format);
      return strftime(date, format);
    }

    return {
      locale: I18nRails.locale,
      setLocale: setLocale,
      strftime: strftime,
      t: translate,
      l: localize,
      pt: translatePrependingPersonalIfOnIggLife
    };
  }

  angular.module('utils').factory('i18n', ['$sce', 'gon', 'I18nRails', i18n]);
})();

(function () {
  var utilities = angular.module('utils');

  utilities.directive('iggAffixContainer', function () {
    return {
      restrict: 'A',
      controller: ['$scope', '$element', function (scope, element) {
        this.element = element;
      }]
    };
  });

  utilities.directive('iggAffix', ['$window', '$interval', 'lodash', function ($window, $interval, _) {
    return {
      restrict: 'A',
      scope: {
        showOnScroll: "@iggAffixShowOnScroll",
        minParentHeight: "@iggAffixMinParentHeight"
      },
      require: '^iggAffixContainer',
      link: function (scope, element, attrs, iggAffixContainerCtrl) {
        var win = angular.element($window),
          affixed;

        scope.containerEl = iggAffixContainerCtrl.element;

        function checkPosition () {
          scope.offsetTop = scope.containerEl.offset().top;
          scope.offsetBottom = scope.offsetTop + scope.containerEl.height();

          var scrollTop = $window.pageYOffset,
            scrollBottom = scrollTop + element.outerHeight();

          if ( scrollTop >= scope.offsetTop && scrollBottom < scope.offsetBottom ) {
            affixed = true;
            element.css({position: 'fixed', top: '0px', bottom: ''});
          }
          else if ( scrollBottom > scope.offsetBottom ) {
            affixed = true;
            var bottom = win.height() - (scope.offsetBottom - scrollTop);
            element.css({position: 'fixed', bottom: bottom + 'px', top: ''});
          }
          else {
            affixed = false;
            element.css({position: '', bottom: '', top: ''});
          }

          var isParentTallEnough = (_.isUndefined(scope.minParentHeight) || scope.containerEl.height() >= scope.minParentHeight);

          element.toggle(isParentTallEnough && (affixed || !scope.showOnScroll));
          element.toggleClass('igg-affix', affixed);
        }

        win.bind('resize', checkPosition);
        win.bind('scroll', checkPosition);
        win.bind('click', checkPosition);

        $interval(checkPosition, 100);
      }
    };
  }]);
})();


(function() {
  angular.module('utils').filter('iggCurrency',
    ['currencies', 'numberFilter', '$sce', function(currencies, numberFilter, $sce) {
      return function(input, isoNumber, optionsString) {
        var options = (optionsString || '').split(",");
        var currentCurrency = currencies.forIsoNum(isoNumber);

        var precision = options.indexOf("cents") >= 0 ? 2 : 0;
        var value = numberFilter((input || 0), precision);
        var symbolicValue = currentCurrency.symbol + value;
        var isoCode = currentCurrency.iso_code;

        if (options.indexOf("html") >= 0) {
          var markup = '<span class="currency"><span>' + symbolicValue + '</span><em>' +
            isoCode + '</em></span>';
          return $sce.trustAsHtml(markup);
        } else if(options.indexOf("separated") >= 0) {
          return {"symbolicValue": symbolicValue, "isoCode": isoCode};
        } else if (options.indexOf('noIso') >= 0) {
          return symbolicValue;
        } else {
          return symbolicValue + " " + isoCode;
        }
      };
    }]);
})();

/* global igg:true */
/*
 This functionality is turned OFF when we run in 'test' mode. See
 monorail/app/assets/turn_off_external_service.js for how we handle acceptance tests, and
 ng-gogo/test_support/external_service_stub.js for how we handle Karma tests.
 */

var igg = igg || {};
igg.externalService = function(callback) {
  callback.apply(this, arguments);
};

(function() {
  'use strict';
  angular.module('utils')
    .directive('iggPopover', ['$popover', '$sce', '$compile', '$timeout',
      function ($popover, $sce, $compile, $timeout) {
        return {
          restrict: 'A',
          transclude: true,
          replace: true,
          templateUrl: function(elem,attrs) {
            if (attrs.text) {
              return 'views/igg-popover-text.html';
            } else {
              return 'views/igg-popover-icon.html';
            }
          },
          scope: {
            placement: '@',
            classIcon: '@',
            text: '@'
          },
          link: function (scope, element, attributes, controller, transclude) {
            var placement = scope.placement || 'right';
            scope.iconClass = scope.classIcon || 'i-icon-info-bubble';
            transclude(function (clone) {
              var ctx = $("<div></div>");
              clone.appendTo(ctx);
              var compiledElement = $compile(ctx)(scope);
              element.show();
              $timeout(function () {
                var popoverOptions = {
                  content: $sce.trustAsHtml(compiledElement.html()),
                  trigger: 'hover click',
                  html: true,
                  placement: placement,
                  autoClose: true
                };
                if (typeof(attributes.closeDelay) !== 'undefined') {
                  popoverOptions.delay = {show: 0, hide: 1500};
                }
                $popover(element, popoverOptions);
              });
            });
          }
      };
    }]);
})();

(function() {
  'use strict';
  angular.module('utils')
    .directive('iggProjectCard', [
      'projectCard',
      function (projectCard) {
        return {
          restrict: 'A',
          link: function (scope, element) {
            projectCard.setupDelayedImageLoad(element);
            projectCard.ellipsizeProjectCardTagline(element);
          }
        };
      }]);
})();


(function() {
  angular.module('utils')
    .directive('enterKeypress', function() {
      return {
        restrict: 'A',
        link: function(scope, element, attrs) {
          element.bind("keyup", function(event) {
            if (event.which === 13) {
              scope.$apply(function() {
                scope.$eval(attrs.enterKeypress);
              });
              event.preventDefault();
            }
          });
        }
      };
    });
})();

(function() {
  angular.module('utils')
    .directive('konami', ['browser', function(browser) {
      return {
        restrict: 'A',
        link: function(scope, element, attrs) {
          var konamiSequence = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
          var sequenceIndex = 0;

          $(element).on('keydown', function(ev) {
            if (ev.keyCode === konamiSequence[sequenceIndex]) {
              sequenceIndex += 1;
              if (sequenceIndex === konamiSequence.length) {
                browser.redirectTo('https://www.indiegogo.com/explore/gaming');
              }
            } else {
              sequenceIndex = 0;
            }
          });

        }
      };
    }]);
})();

(function () {
  angular.module('utils').factory('modals', ['bootstrap', function(bootstrap) {
    var currentModal;
    var service = {};
    var modals = {};

    service.register = function(modalId, modal) {
      modals[modalId] = modal;
    };

    service.openModal = function(modalId) {
      service.closeCurrentModal();
      currentModal = modals[modalId];
      bootstrap.modal(currentModal, 'show');
    };

    service.closeCurrentModal = function() {
      if (currentModal) {
        bootstrap.modal(currentModal, 'hide');
        currentModal = null;
      }
    };

    return service;
  }]);
})();

(function() {
  'use strict';
  angular.module('utils').directive('pagination', ['i18n', function (i18n) {
    return {
      restrict: 'A',
      scope: {
        pagination: "="
      },
      transclude: false,
      replace: false,
      templateUrl: 'views/pagination_directive.html',
      link: function(scope, element, attrs, nullController, transclude) {
        scope.i18n = i18n;
        var MAX_PAGES = 9;
        var SURROUNDING_PAGES = Math.floor(MAX_PAGES / 2);

        var inMiddle = function(pagination) {
          // there are more than 4 pages to either side of the current page
          return pagination.data.current - SURROUNDING_PAGES >= 1 && 
            pagination.data.current + SURROUNDING_PAGES <= pagination.data.pages;
        };

        var morePages = function(pagination) {
          return pagination.data.pages > MAX_PAGES;
        };

        var atEnd = function(pagination) {
          return pagination.data.current >= (pagination.data.pages - SURROUNDING_PAGES);
        };

        scope.generatePageRange = function(pagination) {
          if (inMiddle(pagination)) {
            // the current page can fit comfortably in the middle of all pages
            // (as defined by SURROUNDING_PAGES, so there need to be 4 pages on either side)
            var start = pagination.data.current - SURROUNDING_PAGES;
            var end = pagination.data.current + SURROUNDING_PAGES;
            return _.range(start, end + 1);
          } else if (atEnd(pagination) && morePages(pagination)) {
            return _.range(pagination.data.pages - MAX_PAGES + 1, pagination.data.pages + 1);
          }

          // the normal case is to just return the number of pages we have, starting at 1.
          return _.range(1, Math.min(MAX_PAGES, pagination.data.pages) + 1);
        };

        scope.isCurrentPage = function(pageNumber) {
          return scope.pagination.data.current === pageNumber;
        };

        scope.showBeginningPageGap = function(pagination) {
          return scope.generatePageRange(pagination)[0] != 1;
        };

        scope.showEndingPageGap = function(pagination) {
          var range = scope.generatePageRange(pagination);
          return range[range.length - 1] != pagination.data.pages;
        };
      }
    };
  }]);
}());

(function() {
  angular.module('utils')
    .directive('pcModal', ['i18n', 'modals', 'bootstrap', function(i18n, modals, bootstrap) {
      return {
        templateUrl: 'views/pc_modal.html',
        transclude: true,
        scope: {
          modalId: '@modalId'
        },
        link: function (scope, element) {
          modals.register(scope.modalId, element);

          scope.openModal = function() {
            modals.openModal(scope.modalId);
          };

          scope.closeModal = function() {
            modals.closeCurrentModal();
          };
        }
      };
    }]);
})();

(function () {
  angular.module('utils').factory('projectCard', function() {
    function setupDelayedImageLoad(element) {
      var $imgContainer = element.find(".i-img");
      if ($imgContainer.length > 0) {
        var $img = $("<img />");
        $img.attr("src", $imgContainer.data("src"));
        $imgContainer.replaceWith($img);
      }
    }

    function ellipsizeProjectCardTagline(element) {
      var $content = element.find(".i-content");
      var $title = $content.find(".i-title");
      var titleLineHeight = parseInt($title.css("line-height"));
      $title.dotdotdot({
        height: titleLineHeight*3,
        wrap: "letter",
        watch: "window"
      });

      var $tagline = $content.find(".i-tagline");
      var taglineHeight = $content.height() - $title.height();

      var $partner = $content.find(".i-partner-name");
      if ($partner.length > 0) {
        var partnerLineHeight = parseInt($partner.css("line-height"));
        $partner.dotdotdot({
          height: partnerLineHeight*1,
          watch: "window"
        });
        taglineHeight = taglineHeight - $partner.height() - parseInt($partner.css("margin-top"));
      }
      $tagline.css("max-height", taglineHeight);
      $tagline.dotdotdot({
        watch: 'window'
      });
    }

    return {
      setupDelayedImageLoad: setupDelayedImageLoad,
      ellipsizeProjectCardTagline: ellipsizeProjectCardTagline
    };
  });
})();

/**
 *
 * Modified from https://github.com/TylerGarlick/angular-redactor#e453c5977bd29fb7df62cc5cfd88081cac37165c
 * to work with Redactor 8.2.2.
 *
 * Redactor cannot be bound to model so we update it using the keyupCallback passed to redactor.
 * Directive responds to "updateRedactor" event to update from the model (e.g. in case a save
 * changes the value).
 *
 */

(function () {
  'use strict';

  /**
   * usage: <textarea ng-model="content" redactor></textarea>
   *
   *    additional options:
   *      redactor: hash (pass in a redactor options hash)
   *
   */
  angular.module('utils')
    .factory('redactor', function () {
      return {
        redactorize: function(element, options) {
          element.redactor(options);
        },
        editorElement: function(element) {
          return $(element.siblings()[1]); // redactor element
        }
      };
    })
    .directive("redactor", ['redactor', function (redactor) {
      return {
        restrict: 'A',
        require: "ngModel",
        scope: {
          focus: "@redactorFocus",
          buttons: "@redactorButtons",
          maxlength: "@redactorMaxlength",
          minlength: "@redactorMinlength"
        },
        link: function (scope, element, attrs, ngModel) {
          var editor, charCounter;

          var updateCharCounter = function () {
            if (charCounter) {
              var html = $("<div>" + ngModel.$viewValue + "</div>").text();
              var cleanedChars = html.replace(/\t+/g, " ").replace(/\n/g, "").replace(/^\s/g, '');
              charCounter.text(cleanedChars.length + " / "  + scope.maxlength);

              scope.$emit('redactor:updatedCount', cleanedChars.length);
              element.parent().toggleClass('redactor-hasError',
                cleanedChars.length > parseInt(scope.maxlength) ||
                cleanedChars.length < parseInt(scope.minlength));
            }
          };

          ngModel.$viewChangeListeners.push(updateCharCounter);
          scope.$on('postUpdateFinished', function() {
            ngModel.$setViewValue('');
            ngModel.$render();
          });

          var updateModel = function updateModel(value) {
            ngModel.$setViewValue(value.getCode());
            scope.$apply();
          };
          var options = {
            keyupCallback: updateModel,
            execCommandCallback: updateModel,
            imageUpload: '/api/attachments/upload_image',
            imageUploadErrorCallback: function(unusedRedactor, json) { window.alert(json.error); },
            fileUpload: '/api/attachments/upload_file',
            buttons: ['formatting', '|', 'bold', 'italic', 'deleted', '|',
              'unorderedlist', 'orderedlist', '|',
              'image', 'video', 'link', 'embedly', '|',
              'alignment', '|', 'html']
          };
          var $_element = angular.element(element);
          if (scope.buttons) {
            options.buttons = scope.buttons.split(" ");
          }

          if (scope.focus) {
            options.focus = (scope.focus === "true");
          }

          redactor.redactorize($_element, options);
          editor = redactor.editorElement($_element);
          ngModel.$render();

          if (scope.maxlength) {
            charCounter = $('<div class="redactor-charCounter"></div>');
            charCounter.text("0 / " + scope.maxlength);
            editor.parent().append(charCounter);
          }

          ngModel.$render = function () {
            $_element.val(ngModel.$viewValue);
            if (angular.isDefined(editor)) {
              editor.html(ngModel.$viewValue || '');
            }
          };

          scope.$on('updateRedactor', function () {
            var text = ngModel.$modelValue;
            editor.html(text);
          });
        }
      };
    }]);
})();

(function (regionsJson) {
  'use strict';
  angular.module('utils').factory('regions', function() {
    function RegionsService(regionsJson) {
      var regions = regionsJson;
      var states = _.select(regions, function(region) { return region.country === 'us'; });
      var provinces = _.select(regions, function(region) { return region.country === 'ca'; });

      function regionsAsOptions (regions) {
        return _.map(regions, function(region) {
          return { value: region.code, text: region.text };
        });
      }

      this.all = function () {
        return regions;
      };

      this.getStates = function() {
        return states;
      };

      this.getProvinces = function() {
        return provinces;
      };

      this.statesAsOptions = function() {
        return regionsAsOptions(states);
      };
      this.provincesAsOptions = function() {
        return regionsAsOptions(provinces);
      };
      this.byCode = function (code) {
        return _.findWhere(regions, {code: code});
      };

      this.byTwoLetterCode = function(code) {
        if(code.match(/^STTE_/)) {
          return _.findWhere(regions, { code: code });
        }
        return _.findWhere(regions, {two_letter: code});
      };

      this.byText = function (text) {
        return _.findWhere(regions, {text: text});
      };

      this.toCode = function(region, country) {
        return ["STTE_", country, region].join('');
      };
    }

    return new RegionsService(regionsJson);
  });
})(
  /* To refresh, open up a Rails console and type "puts JSON.pretty_generate(Code.region_service_json_hash)" */
  [
    {
      "code": "STTE_CAAB",
      "text": "Alberta",
      "two_letter": "AB",
      "country": "ca"
    },
    {
      "code": "STTE_CABC",
      "text": "British Columbia",
      "two_letter": "BC",
      "country": "ca"
    },
    {
      "code": "STTE_CAMB",
      "text": "Manitoba",
      "two_letter": "MB",
      "country": "ca"
    },
    {
      "code": "STTE_CANB",
      "text": "New Brunswick",
      "two_letter": "NB",
      "country": "ca"
    },
    {
      "code": "STTE_CANL",
      "text": "Newfoundland and Labrador",
      "two_letter": "NL",
      "country": "ca"
    },
    {
      "code": "STTE_CANS",
      "text": "Nova Scotia",
      "two_letter": "NS",
      "country": "ca"
    },
    {
      "code": "STTE_CANT",
      "text": "Northwest Territories",
      "two_letter": "NT",
      "country": "ca"
    },
    {
      "code": "STTE_CANU",
      "text": "Nunavut",
      "two_letter": "NU",
      "country": "ca"
    },
    {
      "code": "STTE_CAON",
      "text": "Ontario",
      "two_letter": "ON",
      "country": "ca"
    },
    {
      "code": "STTE_CAPE",
      "text": "Prince Edward Island",
      "two_letter": "PE",
      "country": "ca"
    },
    {
      "code": "STTE_CAQC",
      "text": "Quebec",
      "two_letter": "QC",
      "country": "ca"
    },
    {
      "code": "STTE_CASK",
      "text": "Saskatchewan",
      "two_letter": "SK",
      "country": "ca"
    },
    {
      "code": "STTE_CAYT",
      "text": "Yukon",
      "two_letter": "YT",
      "country": "ca"
    },
    {
      "code": "STTE_USAK",
      "text": "Alaska",
      "two_letter": "AK",
      "country": "us"
    },
    {
      "code": "STTE_USAL",
      "text": "Alabama",
      "two_letter": "AL",
      "country": "us"
    },
    {
      "code": "STTE_USAR",
      "text": "Arkansas",
      "two_letter": "AR",
      "country": "us"
    },
    {
      "code": "STTE_USAZ",
      "text": "Arizona",
      "two_letter": "AZ",
      "country": "us"
    },
    {
      "code": "STTE_USCA",
      "text": "California",
      "two_letter": "CA",
      "country": "us"
    },
    {
      "code": "STTE_USCO",
      "text": "Colorado",
      "two_letter": "CO",
      "country": "us"
    },
    {
      "code": "STTE_USCT",
      "text": "Connecticut",
      "two_letter": "CT",
      "country": "us"
    },
    {
      "code": "STTE_USDC",
      "text": "District of Columbia",
      "two_letter": "DC",
      "country": "us"
    },
    {
      "code": "STTE_USDE",
      "text": "Delaware",
      "two_letter": "DE",
      "country": "us"
    },
    {
      "code": "STTE_USFL",
      "text": "Florida",
      "two_letter": "FL",
      "country": "us"
    },
    {
      "code": "STTE_USGA",
      "text": "Georgia",
      "two_letter": "GA",
      "country": "us"
    },
    {
      "code": "STTE_USHI",
      "text": "Hawaii",
      "two_letter": "HI",
      "country": "us"
    },
    {
      "code": "STTE_USIA",
      "text": "Iowa",
      "two_letter": "IA",
      "country": "us"
    },
    {
      "code": "STTE_USID",
      "text": "Idaho",
      "two_letter": "ID",
      "country": "us"
    },
    {
      "code": "STTE_USIL",
      "text": "Illinois",
      "two_letter": "IL",
      "country": "us"
    },
    {
      "code": "STTE_USIN",
      "text": "Indiana",
      "two_letter": "IN",
      "country": "us"
    },
    {
      "code": "STTE_USKS",
      "text": "Kansas",
      "two_letter": "KS",
      "country": "us"
    },
    {
      "code": "STTE_USKY",
      "text": "Kentucky",
      "two_letter": "KY",
      "country": "us"
    },
    {
      "code": "STTE_USLA",
      "text": "Louisiana",
      "two_letter": "LA",
      "country": "us"
    },
    {
      "code": "STTE_USMA",
      "text": "Massachusetts",
      "two_letter": "MA",
      "country": "us"
    },
    {
      "code": "STTE_USMD",
      "text": "Maryland",
      "two_letter": "MD",
      "country": "us"
    },
    {
      "code": "STTE_USME",
      "text": "Maine",
      "two_letter": "ME",
      "country": "us"
    },
    {
      "code": "STTE_USMI",
      "text": "Michigan",
      "two_letter": "MI",
      "country": "us"
    },
    {
      "code": "STTE_USMN",
      "text": "Minnesota",
      "two_letter": "MN",
      "country": "us"
    },
    {
      "code": "STTE_USMO",
      "text": "Missouri",
      "two_letter": "MO",
      "country": "us"
    },
    {
      "code": "STTE_USMS",
      "text": "Mississippi",
      "two_letter": "MS",
      "country": "us"
    },
    {
      "code": "STTE_USMT",
      "text": "Montana",
      "two_letter": "MT",
      "country": "us"
    },
    {
      "code": "STTE_USNC",
      "text": "North Carolina",
      "two_letter": "NC",
      "country": "us"
    },
    {
      "code": "STTE_USND",
      "text": "North Dakota",
      "two_letter": "ND",
      "country": "us"
    },
    {
      "code": "STTE_USNE",
      "text": "Nebraska",
      "two_letter": "NE",
      "country": "us"
    },
    {
      "code": "STTE_USNH",
      "text": "New Hampshire",
      "two_letter": "NH",
      "country": "us"
    },
    {
      "code": "STTE_USNJ",
      "text": "New Jersey",
      "two_letter": "NJ",
      "country": "us"
    },
    {
      "code": "STTE_USNM",
      "text": "New Mexico",
      "two_letter": "NM",
      "country": "us"
    },
    {
      "code": "STTE_USNV",
      "text": "Nevada",
      "two_letter": "NV",
      "country": "us"
    },
    {
      "code": "STTE_USNY",
      "text": "New York",
      "two_letter": "NY",
      "country": "us"
    },
    {
      "code": "STTE_USOH",
      "text": "Ohio",
      "two_letter": "OH",
      "country": "us"
    },
    {
      "code": "STTE_USOK",
      "text": "Oklahoma",
      "two_letter": "OK",
      "country": "us"
    },
    {
      "code": "STTE_USOR",
      "text": "Oregon",
      "two_letter": "OR",
      "country": "us"
    },
    {
      "code": "STTE_USPA",
      "text": "Pennsylvania",
      "two_letter": "PA",
      "country": "us"
    },
    {
      "code": "STTE_USRI",
      "text": "Rhode Island",
      "two_letter": "RI",
      "country": "us"
    },
    {
      "code": "STTE_USSC",
      "text": "South Carolina",
      "two_letter": "SC",
      "country": "us"
    },
    {
      "code": "STTE_USSD",
      "text": "South Dakota",
      "two_letter": "SD",
      "country": "us"
    },
    {
      "code": "STTE_USTN",
      "text": "Tennessee",
      "two_letter": "TN",
      "country": "us"
    },
    {
      "code": "STTE_USTX",
      "text": "Texas",
      "two_letter": "TX",
      "country": "us"
    },
    {
      "code": "STTE_USUT",
      "text": "Utah",
      "two_letter": "UT",
      "country": "us"
    },
    {
      "code": "STTE_USVA",
      "text": "Virginia",
      "two_letter": "VA",
      "country": "us"
    },
    {
      "code": "STTE_USVT",
      "text": "Vermont",
      "two_letter": "VT",
      "country": "us"
    },
    {
      "code": "STTE_USWA",
      "text": "Washington",
      "two_letter": "WA",
      "country": "us"
    },
    {
      "code": "STTE_USWI",
      "text": "Wisconsin",
      "two_letter": "WI",
      "country": "us"
    },
    {
      "code": "STTE_USWV",
      "text": "West Virginia",
      "two_letter": "WV",
      "country": "us"
    },
    {
      "code": "STTE_USWY",
      "text": "Wyoming",
      "two_letter": "WY",
      "country": "us"
    }
  ]
);

(function () {
  angular.module('utils').factory('sessionModal', ['bootstrap', function(bootstrap) {
    var modalElement;

    return {
      registerModal: function(element) {
        modalElement = element;
      },
      openModal: function() {
        bootstrap.modal(modalElement, 'show');
      }
    };
  }]);
})();

angular.module('utils').directive('simpleImageUpload', [
  'cloudinary', '$http', 'i18n', function (cloudinary, $http, i18n) {
    return {
      restrict: 'A',
      scope: {
        imagePublicId: '@',
        updateImagePath: '@',
        placeholderPath: '@',
        attr: '@',
        width: '@',
        height: '@',
        crop: '@'
      },
      templateUrl: 'views/simple-image-upload.html',
      link: function(scope, element) {
        scope.i18n = i18n;
        var fileInput = element.find("input");
        scope.status = {loading: false, publicId: scope.imagePublicId};

        function setupFileUpload() {
          var fileUploader = cloudinary.forFileInput(fileInput, element);

          fileUploader.onUploadStart(function() {
            scope.status.loading = true;
          }).onUploadComplete(function(result) {
            scope.status.loading = false;
            scope.status.publicId = result.public_id;
            scope.$apply();
            var data = {image_params: result};
            if (scope.attr) {
              data.attr = scope.attr;
            }
            $http.post(scope.updateImagePath, data);
            fileInput = element.find("input");
          }).onUploadFail(function() {
            scope.status.loading = false;
            fileInput = element.find("input");
          });
        }
        setupFileUpload();

        scope.clickPhoto = function() {
          fileInput.trigger('click');
        };
      }
    };
  }
]);

(function () {
  angular.module('utils').factory('startsWith', function() {
    return function (actual, expected) {
      var lowerStr = (actual + "").toLowerCase();
      return lowerStr.indexOf(expected.toLowerCase()) === 0;
    };
  });
})();

(function () {
  angular.module('utils').factory('twitter', ['$window', function($window) {
    return {
      onTweet: function (callback) {
        $window.twttr.ready(function (twttr) {
          twttr.events.bind('tweet', callback);
        });
      },
      refreshAllWidgets: function () {
        $window.twttr.ready(function (twttr) {
          twttr.widgets.load();
        });
      }
    };
  }]);
})();

(function () {

  function oauthServiceUrl($location) {
    if ($location.host().match(/(www|life)\.indiegogo\.com/g) !== null) {
      return 'https://oauth.indiegogo.com';
    } else if ($location.host().match(/stage-(\w*)\.staging\.indiegogo\.(com|net)/)) {
      return 'https://' + $location.host() + ':6661';
    } else {
      return 'http://' + $location.host() + ':4001';
    }
  }

  function userService($http, $q, $log, oauthServiceUrl, apiLoginEndpoint, apiSignupEndpoint, backup, gon, fb) {
    var oauthServiceEndpoint = oauthServiceUrl + '/oauth/token';
    var token = '';
    var user = {};
    var apiToken = gon.api_token;

    function load() {
      backup.restoreStateIfSaved('user', user);
    }

    function logInPromise(email, password) {
      var deferred = $q.defer();

      $http.post(oauthServiceEndpoint,
        {
          credential_type: 'email',
          grant_type: 'password',
          email: email,
          password: password
        })
       .success(function (data, status, headers, config) {
          token = data.access_token;
          $http.get(apiLoginEndpoint + '?access_token=' + token)
            .success(function (data, status, headers, config) {
              setUser(data.response);
              deferred.resolve(user);
            })
            .error(function (data, status, headers, config) {
              deferred.reject('Rejected in credentials: ', data);
            });
        })
        .error(function (data, status, headers, config) {
          deferred.reject(data.error);
        });

      return deferred.promise;
    }

    function logOut(){
      var oauthDeferred = $q.defer();
      if (token) {
        $http.post(oauthServiceUrl + '/oauth/revoke', {
          token: token,
          access_token: token
        }).success(function (data) {
          oauthDeferred.resolve(data);
        }).error(function (error) {
          $log.debug('revoke error');
          oauthDeferred.reject(error);
        });
      } else {
        oauthDeferred.resolve('No oauth credentials');
      }

      var sessionDeferred = $q.defer();
      $http.delete('/accounts/sign_out').success(function (data) {
        setUser(null);
        token = null;
        sessionDeferred.resolve(data);
      }).error(function (error) {
        $log.debug('logout rejected', error);
        sessionDeferred.reject(error);
      });

      return $q.all([oauthDeferred.promise, sessionDeferred.promise]);
    }

    function signUp(firstname, lastname, email, password, newsletterOptIn) {
      var deferred = $q.defer();

      $http.post(apiSignupEndpoint + '?api_token=' + apiToken,
        {
          account: {
            fullname: [firstname, lastname].join(' '),
            email: email,
            password: password,
            general_opt_in: newsletterOptIn
          }
        })
        .success(function (data, status, headers, config) {
          logInPromise(email, password).then(deferred.resolve(user));
        })
        .error(function (data, status, headers, config) {
          deferred.reject(data.messages);
        });

      return deferred.promise;
    }

    function facebookLogin() {
      var deferred = $q.defer(),
        csrfToken = gon.csrf_token;

      fb.login({ scope: 'email', state: 'abc123' }).then(function (response) {
        if (response.authResponse) {
          $log.debug('Connected! Hitting OmniAuth callback (GET /auth/facebook/callback)...');
          // since we have cookies enabled, this request will allow omniauth to parse
          // out the auth code from the signed request in the fbsr_XXX cookie
          $http.get('/accounts/auth/facebook/callback',
            {params: {csrf_token: csrfToken}})
            .success(function (json) {
              $log.debug('Connected! Callback complete.');
              $log.debug(JSON.stringify(json));
              setUser(json.account_privileged);
              deferred.resolve(json.account_privileged);
            })
            .error(function(error) {
              $log.debug('error getting /accounts/auth/facebook/callback:');
              $log.debug(error);
              deferred.reject(error);
            });
        }
      });

      return deferred.promise;
    }

    function setUser(data) {
      if (data === null){
        _.each(_.keys(user), function (k) { delete user[k]; });
      } else {
        var displayName = data.display_for_feed || data.firstname || data.email;

        user.firstname = data.firstname;
        user.lastname = data.lastname;
        user.email = data.email;
        user.avatarUrl = data.avatar_url;
        user.displayName = displayName;
      }
    }

    function current() {
      return user;
    }

    function authToken() {
      return token;
    }

    _.merge(this, {
      logIn: logInPromise,
      logOut: logOut,
      signUp: signUp,
      facebookLogin: facebookLogin,
      current: current,
      authToken: authToken,
      setUser: setUser,
      load: load
    });

    load();

    backup.register({ user: this.current });

  }

  angular.module('utils')
    .service('userService', ['$http', '$q', '$log', 'oauthServiceUrl', 'API_LOGIN_ENDPOINT', 'API_SIGNUP_ENDPOINT', 'backupBeforeUnloadService', 'gon', 'fb', userService])
    .factory('oauthServiceUrl', ['$location', oauthServiceUrl])
    .constant('API_LOGIN_ENDPOINT', '/private_api/me.json')
    .constant('API_SIGNUP_ENDPOINT', '/api/1/accounts.json');
})();

var youtubeIframeApiCallbacks = [];
var youtubeApiReady = false;
/* global youtubeIframeApiCallbacks */

(function () {
  angular.module('utils').factory('youtube', function() {

    var iframeAPIIncluded = false;

    return {
      onReady: function (callback, include) {
        if (typeof(include) === 'undefined') {
          include = true;
        }

        if (include && !iframeAPIIncluded) {
          igg.externalService(function () {
            // This code loads the IFrame Player API code asynchronously.
            var tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            var firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            iframeAPIIncluded = true;
          });
        }

        if (youtubeApiReady) {
          callback();
        } else {
          youtubeIframeApiCallbacks.push(callback);
        }
      }
    };
  });
})();

/* jshint ignore:start */
function onYouTubeIframeAPIReady() {
  for (var i=0; i<youtubeIframeApiCallbacks.length; ++i) {
    youtubeIframeApiCallbacks[i]();
  }
  youtubeApiReady = true;
}
/* jshint ignore:end */

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/footer-trust-bbb.html',
    '<a id="bbblink" class="bbb sehzbus" href="http://www.bbb.org/greater-san-francisco/business-reviews/internet-services/indiegogo-in-san-francisco-ca-372843#bbblogo" target="_blank"><img id="bbblinkimg" ng-src="{{bbbImageUrl}}" width="100" height="38" alt="{{::i18n.t(\'footer.bbb\')}}"/></a>\n' +
    '<div ng-if="::inEnglish" id="f11cda4f-ffd6-4d45-b3c3-dea39f0b8194" class="truste"><a href="//privacy.truste.com/privacy-seal/Indiegogo,-Inc-/validation?rid=6d279abc-bf79-4648-bbc3-ac58bb077a34" title="TRUSTe European Safe Harbor certification" target="_blank"><img style="border: none" src="//privacy-policy.truste.com/privacy-seal/Indiegogo,-Inc-/seal?rid=6d279abc-bf79-4648-bbc3-ac58bb077a34" height="38" alt="TRUSTe European Safe Harbor certification"/></a></div>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/footer_locale_dropdown.html',
    '<a href="" class="js-locale-select"><span>{{localeOptions[currentLocale]}}</span>\n' +
    '<span class="i-icon i-glyph-icon-30-downcarrot"></span></a>\n' +
    '<ul class="dropdown-menu">\n' +
    '  <li ng-repeat="(localeKey, localeString) in localeOptions">\n' +
    '    <a href="" ng-click="selectLocale(localeKey)">{{localeString}}</a>\n' +
    '  </li>\n' +
    '</ul>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/header_flash.html',
    '<div class="i-flash" ng-class="style" ng-if="open">\n' +
    '  <span ng-transclude /><a class="i-icon i-glyph-icon-30-close" ng-click="closeFlash()"></a>\n' +
    '</div>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/header_flash_container.html',
    '<div ng-transclude></div>\n' +
    '<div header-flash header-flash-level="{{flash.alertLevel}}" ng-repeat="flash in flashes">\n' +
    '  <span ng-if="::flash.messageHtml" ng-bind-html="::flash.messageHtml"></span>\n' +
    '  <span ng-if="::flash.messageText" ng-bind="::flash.messageText"></span>\n' +
    '</div>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/header_search_dropdown.html',
    '<div class="i-search-box">\n' +
    '  <div class="i-search-cell">\n' +
    '    <div class="i-search-close" ng-show="searchTerm.length > 0" ng-click="reset()">\n' +
    '      <span class="i-icon i-glyph-icon-30-close"></span>\n' +
    '    </div>\n' +
    '    <input type="text" name="filter_title" ng-model="searchTerm" maxlength="300" />\n' +
    '  </div>\n' +
    '  <div class="i-go-cell">\n' +
    '    <div class="i-search-go" \n' +
    '         ng-click="go()"\n' +
    '         ga-event-on="click"\n' +
    '         ga-event-category="Mobile Web Campaign Page"\n' +
    '         ga-event-action="Complete Search">\n' +
    '      <a href="">{{::i18n.t(\'go\')}}</a>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/header_search_form.html',
    '<label class="visible-only-to-screenreader" for="search_term">{{i18n.t(\'search\')}}</label>\n' +
    '<input type="text" name="filter_title" id="search_term" ng-model="searchTerm" maxlength="300" class="i-text-field" />\n' +
    '<div class="i-icon i-glyph-icon-30-search"></div>\n' +
    '<a class="i-icon i-glyph-icon-30-close i-search-close" ng-show="searchTerm.length > 0"\n' +
    '   ng-click="reset()"></a>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/pc_header_search_dropdown.html',
    '<div class="pc-search-box">\n' +
    '  <div class="pc-search-cell">\n' +
    '    <input type="text" name="filter_title" placeholder=\'{{::i18n.t("personal.homepage.search_by_title")}}\' ng-model="searchTerm" maxlength="300" />\n' +
    '  </div>\n' +
    '  <div class="pc-search-btn" ng-click="go()">\n' +
    '    {{::i18n.t(\'explorepage.search\')}}\n' +
    '  </div>\n' +
    '</div>\n' +
    '\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/amount-with-currency.html',
    '<span class="perkItem-perkAmount">{{currency().symbol}}{{perk.amount}}</span>\n' +
    '<span class="perkItem-currencyAndLabeling">{{currency().iso_code}}\n' +
    '  <span ng-if="isShippingLabelDisplayed"> + {{::i18n.t(\'contribution_flow.shipping\')}}</span>\n' +
    '</span>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/perk-change.html',
    '<a href="" class="perkItem-changePerkLink">\n' +
    '  {{::i18n.t(\'contribution_flow.change_perk\')}}\n' +
    '</a>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/perk-description.html',
    '<div>\n' +
    '  <div class="perkItem-description hidden-xs">{{perk.description}}</div>\n' +
    '  <span class="perkItem-lineItem-label availability" ng-bind-html="perksClaimed()"></span>\n' +
    '  <div ng-if="perk.estimated_delivery_date">\n' +
    '    <span class="perkItem-lineItem-label">{{i18n.t(\'contribution_flow.line_items.estimated_delivery\')}}</span>\n' +
    '    <span class="perkItem-lineItem-value">{{i18n.strftime(perk.estimated_delivery_date, "%B %Y")}}</span>\n' +
    '  </div>\n' +
    '</div>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/perk-store-card.html',
    '<a ng-href="{{ ::sendToPath }}" class="perkCard">\n' +
    '\n' +
    '  <div ng-if="::perk.perk_name">\n' +
    '    <div class="perkCard-imageContainer">\n' +
    '      <img class="perkCard-image" ng-src="{{ ::perk.perk_image_url }}" alt="{{ ::perk.perk_name }}">\n' +
    '\n' +
    '      <div class="perkCard-duskify"></div>\n' +
    '\n' +
    '      <div class="perkCard-hoverOverlay">\n' +
    '        <div class="i-cta-2 i-cta-2-white i-cta-2-white--noHover">\n' +
    '          {{ ::i18n.t(\'see_details\') }}\n' +
    '        </div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '\n' +
    '    <div class="perkCard-details i-mobile-container--15">\n' +
    '      <div class="perkCard-price"\n' +
    '           ng-bind-html="::amountHtml()">\n' +
    '      </div>\n' +
    '\n' +
    '      <div class="perkCard-label">\n' +
    '        {{ ::perk.perk_name }}\n' +
    '        <span class="perkCard-description">\n' +
    '          {{ ::perk.short_description }}\n' +
    '        </span>\n' +
    '      </div>\n' +
    '\n' +
    '    </div>\n' +
    '  </div>\n' +
    '\n' +
    '  <div ng-if="::perk.ad_target_url" class="perkStoreAd">\n' +
    '    <div class="perkStoreAd-slug">\n' +
    '      {{ ::i18n.t(\'share_wizard.did_you_know\') }}\n' +
    '    </div>\n' +
    '    <div class="perkStoreAd-description">\n' +
    '      {{ ::i18n.t(\'perk_store.browsing_products\') }}\n' +
    '    </div>\n' +
    '    <div class="perkStoreAd-cta">\n' +
    '      {{ ::i18n.t(\'learn_more\') }}\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</a>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/perk-title.html',
    '<div class="perkItem-title">\n' +
    '  {{perk.label}}\n' +
    '  <span ng-transclude></span>\n' +
    '</div>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/perk.html',
    '<div class="perkItem open">\n' +
    '  <div class="mobile-container">\n' +
    '    <div class="perkItem-contributewrap clearfix">\n' +
    '      <div ng-if="!perk.available" class="i-soldout-mask">\n' +
    '        <span class="i-text">{{::i18n.t(\'sold_out\')}}</span>\n' +
    '      </div>\n' +
    '      <amount-with-currency></amount-with-currency>\n' +
    '      <div ng-if="perk.has_callout_label"\n' +
    '           class="highlight bold fr top_perk i-top-perk perkItem-topPerk">\n' +
    '        {{::perk.callout_label}}\n' +
    '      </div>\n' +
    '\n' +
    '      <div ng-transclude></div>\n' +
    '\n' +
    '    </div>\n' +
    '    <div ng-if="$state.is(\'select-perk\') && perk.available" ng-click="selectPerkAndContinue()" class="i-cta-1 perkItem-getThisPerkButton visible-xs">\n' +
    '      {{::i18n.t(\'contribution_flow.get_this_perk\')}}\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/ships-to-countries.html',
    '<div>\n' +
    '  <span class="shipsTo-label i-perkBottom-label">{{::labelText}}</span>\n' +
    '  <span class="shipsTo-value i-perkBottom-value"\n' +
    '        ng-if="showCountries()" ng-repeat="country in perkShippingCountries">\n' +
    '    {{::country}}{{($last) ? \'\' : \', \'}}\n' +
    '  </span>\n' +
    '</div>\n' +
    '\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/fb_tracking_pixel.html',
    '<noscript ng-if="shouldTrack"><img height="1" width="1" alt="" style="display:none" src="{{fbTrackingPixelUrl()}}"></noscript>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/igg-popover-icon.html',
    '<span class="i-icon" ng-class="iconClass"></span>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/igg-popover-text.html',
    '<span>{{text}}</span>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/pagination_directive.html',
    '<!-- note: minified to avoid spaces between inline-block elements -->\n' +
    '<div class="js-pagination-links i-pagination-directive-links" ng-if="pagination.data.pages > 1"><div class="pagination-previous" ng-class="{\'pagination-previous\': true, \'i-hidden\' : !pagination.data.previous}"><a class="first-link unselected" ng-click="pagination.getPage({ page: 1 })">{{i18n.t(\'will_paginate.first_label\')}}</a><a class="previous-link unselected" ng-click="pagination.getPage({ page: pagination.data.previous })">{{i18n.t(\'will_paginate.previous_label\')}}</a><span class="page-gap" ng-if="showBeginningPageGap(pagination)">{{i18n.t(\'will_paginate.page_gap\')}}</span></div><div ng-class="{\'selected-page-number\': isCurrentPage(pageNumber), \'page-number\': true}" ng-repeat="pageNumber in generatePageRange(pagination)"><div ng-if="!isCurrentPage(pageNumber)"><a class="page-link page-{{pageNumber}} unselected" ng-click="pagination.getPage({page: pageNumber})">{{ pageNumber}}</a></div><div ng-if="isCurrentPage(pageNumber)"><span class="current selected">{{pageNumber}}</span></div></div><div ng-class="{\'pagination-next\': true, \'i-hidden\' : !pagination.data.next}"><span class="page-gap" ng-if="showEndingPageGap(pagination)">{{i18n.t(\'will_paginate.page_gap\')}}</span><a class="next-link unselected" ng-click="pagination.getPage({page: pagination.data.next})">{{i18n.t(\'will_paginate.next_label\')}}</a><a class="last-link unselected" ng-click="pagination.getPage({page: pagination.data.pages})">{{i18n.t(\'will_paginate.last_label\')}}</a></div></div>');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/pc_modal.html',
    '<div class="modal-dialog pc-modal-dialog">\n' +
    '  <a class="pc-modal-close" ng-click="closeModal()">\n' +
    '    <span class="i-icon i-glyph-icon-30-close"></span>\n' +
    '  </a>\n' +
    '  <div class="pc-modal-content">\n' +
    '    <div ng-transclude></div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '');
}]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/simple-image-upload.html',
    '<div class="i-cloudinaryUploader-image" ng-click="clickPhoto()">\n' +
    '  <img ng-if="placeholderPath && !status.publicId" ng-src="{{placeholderPath}}" width="{{width}}" height="{{height}}" />\n' +
    '  <img ng-if="status.publicId" cl-image width="{{width}}" height="{{height}}" crop="{{crop}}" public-id="status.publicId" />\n' +
    '  <div ng-if="!placeholderPath && !status.publicId" class="i-cloudinaryUploader-placeholder" ng-style="{width: width + \'px\', height: height + \'px\'}"></div>\n' +
    '  <i class="i-fa-centered i-fa-gogenta fa fa-spinner fa-4x fa-spin" ng-show="status.loading"></i>\n' +
    '</div><input type="file" name="file" class="i-hide-offscreen" data-cloudinary-field="image_id" />\n' +
    '<button type="button" ng-click="clickPhoto()" class="i-cta-1 i-cta-1-grey i-cloudinaryUploader-button">\n' +
    '  <span ng-if="status.publicId">{{::i18n.t(\'change_image\')}}</span>\n' +
    '  <span ng-if="!status.publicId">{{::i18n.t(\'add_image\')}}</span>\n' +
    '</button>\n' +
    '');
}]);
})();
