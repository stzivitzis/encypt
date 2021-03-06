/**
 * @fileoverview Provides layout-specific functionality for the
 * Arcadian layout.
 *
 * This file includes layout specific directives that are responsible for
 * interaction with the user, alignment of the blocks and texts in them.
 * Also includes layout specification and initialization.
 */


/**
 * Utils object with specific functionality for the layout.
 * @return {!Object.<function>} Available functions.
 */
var layout = (function() {

  /**
   * Max allowed duration for which animation can occur per AdWords policy.
   * @type {number}
   */
  var AUTO_ROTATE_MAX_DURATION = 30000;

  /**
   * Duration to hold on each highlighted item before moving to the next.
   * @type {number}
   */
  var ITEM_HOLD_DUR = 3500;

  /**
   * Flag to indicate whether this version of the layout supports stars.
   * @type {boolean}
   */
  var SUPPORT_STARS = true;

  /**
   * Name of event to broadcast when Google Web Fonts have loaded.
   * @type {string}
   */
  var FONTS_LOADED = 'fontsLoaded';

  /**
   * Enum of various timeout lengths.
   * @enum {number}
   */
  var timeout = {
    SHORT: 10,
    MEDIUM: 125,
    LONG: 750,
    EXTRA_LONG: 2000
  };


  /**
   * Selectors to find elements to set uniform font size to.
   * @enum {string}
   */
  var uniformSizeSelector = {
    DESCRIPTION: '.description',
    NAME: '.name',
    PRICE: 'div[class^="price"]:not(.price-holder):not(.price-aligner):not(' +
        '.price-wrapper)'
  };

  /**
   * Module on which layout-specific directives are defined.
   * @type {!angular.Module}
   */
  var module = angular.module('custom', []);

  /**
   * Interval on which to autocycle the product items.
   * @type {number}
   */
  var autoCycleInterval;

  /**
   * Time at which timer was started. Used to calculate time elapsed.
   * @type {number}
   */
  var autoCycleStartTime;

  /**
   * Indicates if the browser being used is Safari.
   * @type {boolean}
   */
  var isSafari = /constructor/i.test(window.HTMLElement);

  /**
   * Overrides global window.onAdData.
   * @param  {!Object} data Dynamic data payload.
   * @param  {!Object} util Dragomir util object.
   */
  window.onAdData = function(data, util) {
    var preloader = initPreloading(data);
    preloader.addCompletionListener(function() {
      preloader.getLoadedImages();
      utils.onAdData(data, util);
    });
    preloader.start();
  };


  /**
   * Convenience alias for querySelectorAll that returns results as Array
   * (instead of querySelectorAll's native nodeList.)
   * @param  {string} selector A CSS-style selector. ex: "#foo .bar>img"
   * @param  {Element=} opt_element Root element to query (document is default).
   * @return {Array<Element>}
   */
  function getElementsList(selector, opt_element) {
    var parentElement = opt_element || document;
    return Array.prototype.slice.call(parentElement.querySelectorAll(selector));
  }


  /**
   * Main Controller for layout
   * @param {!angular.Scope} $scope Angular scope object.
   * @param {!Object} dynamicData Contains dynamic data payload.
   */
  function LayoutController($scope, dynamicData) {
    helpers.LayoutController($scope, dynamicData);

    $scope.classes = getClasses($scope);
    $scope.itemsLimit = 1;
    $scope.currentItemIndex = 0;
    $scope.supportStars = SUPPORT_STARS;
    $scope.fontsLoaded = loadFonts($scope);
    $scope.isSafari = isSafari;
    $scope.$on(FONTS_LOADED, function() {
      $scope.layoutInit();
      setTimeout(uniformSize, 500, uniformSizeSelector.PRICE);
      setTimeout(uniformSize, 500, uniformSizeSelector.NAME);
      setTimeout(uniformSize, 500, uniformSizeSelector.DESCRIPTION);
    });

    angular.forEach($scope.products, function(product) {
      product.price = product.salePrice || product.price;
    });


    /**
     * Called when Webfonts have loaded. (when fontsLoaded method is broadcast)
     */
    $scope.layoutInit = function() {
      if ($scope.itemsLimit > 1) {
        $scope.startCarousel();
      }
      showLayout();

      // Allow dynamic text/image to take place before animation build.
      setTimeout(function() {
        buildAnimation($scope);
      }, timeout.MEDIUM);
    };


    /**
     * Rotate Featured Item.
     */
    $scope.startCarousel = function() {
      autoCycleStartTime = new Date().getTime();

      // Init timer.
      $scope.startInterval();
    };


    /**
     * Move to the next item
     */
    $scope.nextItem = function() {
      // Check to see if time is under DAB max animation limit.
      var timeElapsed = (new Date().getTime() - autoCycleStartTime);
      if (timeElapsed > AUTO_ROTATE_MAX_DURATION) {
        clearInterval(autoCycleInterval);
        $scope.currentItemIndex = 0;
        $scope.$apply();
        return;
      }

      // Make next item active
      if ($scope.currentItemIndex + 1 < $scope.itemsLimit) {
        $scope.currentItemIndex++;
      } else {
        $scope.currentItemIndex = 0;
      }

      $scope.$apply();
    };


    /**
     * Match index to current item index.
     * @param  {number}  index Index for item to test.
     * @return {boolean}
     */
    $scope.isCurrentItemIndex = function(index) {
      return $scope.currentItemIndex == index;
    };


    /**
     * Start autoCycleInterval.
     */
    $scope.startInterval = function() {
      if (autoCycleInterval) {
        clearInterval(autoCycleInterval);
      }
      autoCycleInterval = window.setInterval($scope.nextItem, ITEM_HOLD_DUR);
    };

  }


  /**
   * Removes the 'hide' class from the ad, effectively fading in the layout.
   */
  function showLayout() {
    setTimeout(function() {
      angular.element(getElementsList('.layout')[0]).removeClass('hide');
    }, timeout.MEDIUM);
  }


  /**
   * Do build animation sequence.
   * @param {!angular.Scope} scope Angular scope object.
   */
  function buildAnimation(scope) {
    var body = document.getElementsByTagName('body')[0];
    var w = window.innerWidth || document.documentElement.clientWidth ||
        body.clientWidth;
    var h = window.innerHeight || document.documentElement.clientHeight ||
        body.clientHeight;
    var wh = w + 'x' + h;
    var tl = new TimelineLite({onComplete: onAnimationComplete});

    CSSPlugin.defaultTransformPerspective = 200;

    angular.element(getElementsList('.img-holder img')).css('opacity', 0);

    switch (scope.layoutType) {
      case LayoutTypes.SQUARE:
        tl.from(getElementsList('#items-segment'), .75, {
          width: 0, marginLeft: '100%',
          ease: Power3.easeInOut, delay: .5
        });
        tl.staggerFrom(getElementsList('.item-panel'), .5, {
          rotationY: 90,
          transformOrigin: '0% 50%'
        }, 0.4);
        tl.staggerTo(getElementsList('.img-holder img'), 1.35, {
          opacity: 1
        }, .25, '-=1.05');
        break;

      case LayoutTypes.VERTICAL:
        tl.from(getElementsList('#items-segment'), 1, {
          height: 0, y: '-=30',
          ease: Power3.easeInOut, delay: .5
        });
        tl.from(getElementsList('.logo, .disclaimer-panel'), .5, {
          alpha: 0
        }, '-=.05');
        tl.staggerFrom(getElementsList('.item-panel'), .5, {
          rotationX: -90,
          transformOrigin: '50% 0%'
        }, 0.4, '-=.4');
        tl.staggerTo(getElementsList('.img-holder img'), 1.35, {
          opacity: 1
        }, .25, '-=1.05');
        break;

      case LayoutTypes.HORIZONTAL:
      case LayoutTypes.MIN:
        tl.from(getElementsList('#items-segment'), .75, {
          width: 0, marginLeft: '100%',
          ease: Power3.easeInOut, delay: .5
        });
        tl.from(getElementsList('.logo, .disclaimer-panel'), .5, {
          alpha: 0
        }, '-=.05');
        tl.staggerFrom(getElementsList('.item-panel'), .5, {
          rotationY: 90,
          transformOrigin: '0% 50%'
        }, 0.4, '-=.4');
        tl.staggerTo(getElementsList('.img-holder img'), 1.35, {
          opacity: 1
        }, .25, '-=1.05');
        break;
    }

    tl.staggerFrom(getElementsList('.star'), .25, {alpha: 0}, .075, '-=1.5');
  }


  /**
   * Callback that is triggered when build animation is complete.
   */
  function onAnimationComplete() {
    angular.element(getElementsList('.item-panel')).addClass('built');
  }


  /**
   * Applies text fit to the product price and the product prefix in queue
   * to make them of the same size finally.
   * @param {!angular.JQLite} element The jQuery element object to handle.
   */
  function customExtTextFit(element) {
    helpers.extTextFit(element);
  }


  /**
   * Makes the font sizes of the elements to be unified by the smallest font
   * size.
   * @param {string} classToUniform String with selector for elements to
   *     uniform.
   */
  function uniformSize(classToUniform) {
    var smallestFontSize = 1000;
    // Find smallest font size.
    angular.forEach(getElementsList(classToUniform + ' span'),
        function(textFitElement) {
          // Make sure that the element is visible.
          if (textFitElement.offsetParent) {
            var elementMinimumFontSize =
                textFitElement.parentElement.getAttribute('minfontsize');
            var elementFontSize = parseInt(
                helpers.getStyleProperty(textFitElement, 'font-size'));
            if (elementFontSize < elementMinimumFontSize) {
              elementFontSize = elementMinimumFontSize;
            }
            if (elementFontSize < smallestFontSize) {
              smallestFontSize = elementFontSize;
            }
          }
        });

    // Make uniform.
    angular.forEach(getElementsList(classToUniform), function(el) {
      var ngEl = angular.element(el);
      var ngSpan = angular.element(ngEl[0].querySelector('span'));
      ngEl.css('font-size', smallestFontSize + 'px');
      ngSpan.css('font-size', smallestFontSize + 'px');
    });
  }


  /**
   * Load the custom fonts for the layout
   * @param {!angular.Scope} scope Angular scope object.
   * @return {boolean} if the fonts were loaded or not.
   */
  function loadFonts(scope) {
    // We need to load the fonts before we try to fit the texts.
    var el = document.getElementById('ad-container');

    el.style.visibility = 'hidden';
    if (!helpers.isIE()) {
      WebFont.load({
        google: {
          families: ['Roboto+Condensed:400,300,700:cyrillic-ext,greek-ext,' +
              'vietnamese,latin-ext']
        },
        timeout: timeout.EXTRA_LONG,
        active: function() {
          // Set a small timeout to be sure that the font is available in the
          // browser.
          setTimeout(function() {
            // Broadcast the event so customExtTextFit can fit the text using
            // the loaded font.
            scope.$broadcast('fontsLoaded');
            el.style.visibility = 'visible';
            return true;
          }, timeout.SHORT);
        }
      });
    } else {
      setTimeout(function() {
        // Broadcast the event and use the default fonts.
        scope.$broadcast('fontsLoaded');
        el.style.visibility = 'visible';
        return true;
      }, timeout.MEDIUM);
    }
  }


  /**
   * Creates the list of the CSS classes to apply to the layout content
   * depending on parameters from DAB.
   * @param {!angular.Scope} scope AngularJS layout scope.
   * @return {!Object.<string>} All available CSS classes.
   */
  function getClasses(scope) {
    var layout = [];
    var design = scope.design;

    layout.push(design['cornerStyle']);
    var bg = [];
    var btn = [design['btnStyle']];
    return {
      layout: layout.join(' '),
      bg: bg.join(' '),
      button: btn.join(' ')
    };
  }


  /**
   * Exposes enhanced CustomTextFit as a custom attribute.
   * @return {!angular.Directive} Directive definition object.
   */
  module.directive('customExtTextFit', function() {
    return {
      restrict: 'A',
      link: function(scope, el, attrs) {
        scope.$on('fontsLoaded', function() {
          customExtTextFit(el);
        });
      }
    };
  });


  /**
   * Exposes DynamicImageFit as a custom attribute.
   * @return {!angular.Directive} Directive definition object.
   */
  module.directive('customImageFit', function() {
    return {
      restrict: 'A',
      link: function(scope, element, attributes) {
        setTimeout(function() {
          var loc = scope.$eval(attributes.loc);
          new ddab.layouts.utils.DynamicImageFit(element[0], loc,
              attributes.scaletype, attributes.aligntype);
        }, timeout.SHORT);
      }
    };
  });


  /**
   * Make an item the current item based on mouse interaction
   * @return {!angular.Directive} Directive definition object.
   */
  module.directive('setItem', function() {
    return {
      restrict: 'A',
      link: function(scope, el) {
        el.bind('mouseover', function() {
          scope.$parent.currentItemIndex = scope.$index;
          scope.startInterval();
          scope.$parent.$apply();
        });
      }
    };
  });


  /**
   * Exposes logoFit as a custom attribute.
   * Sets minimum and maximum padding values for the logo.
   * @return {!angular.Directive} Directive definition object.
   */
  module.directive('customLogoFit', function() {
    return {
      restrict: 'A',
      link: function(scope, elem, attrs) {
        var done = false;

        function computeSize() {
          if (!done) {
            var el = elem[0];
            var src = scope.$eval(attrs.loc);

            if (scope.checkUrl(src)) {
              setTimeout(function() {
                var data = scope.design['logoPadding'] || 0;
                var logoMargins = utils.logoMargin(elem);
                var padding = parseInt(data, 10);
                var parent = elem.parent();

                var maxLogoPadding = LogoPadding.MAX;
                var minLogoPadding = LogoPadding.MIN;

                if (attrs.maxLogoPadding) {
                  maxLogoPadding = attrs.maxLogoPadding;
                }
                if (attrs.minLogoPadding) {
                  minLogoPadding = attrs.minLogoPadding;
                }

                padding = Math.min(Math.max(minLogoPadding,
                    padding), maxLogoPadding);
                var availableHeight = parseInt((parent[0].offsetHeight -
                    MIN_LOGO_SIZE) / 2, 10);
                var availableWidth = parseInt((parent[0].offsetWidth -
                    MIN_LOGO_SIZE) / 2, 10);
                parent.css({
                  paddingTop: Math.min(availableHeight, padding +
                      logoMargins.t) + 'px',
                  paddingRight: Math.min(availableWidth, padding +
                      logoMargins.r) + 'px',
                  paddingBottom: Math.min(availableHeight, padding +
                      logoMargins.b) + 'px',
                  paddingLeft: Math.min(availableWidth, padding +
                      logoMargins.l) + 'px'
                });

                new ddab.layouts.utils.DynamicImageFit(el, src, attrs.scaletype,
                    attrs.aligntype);
                scope.isLogoPlaced = true;
                scope.$digest();
              }, 0);
            }
            done = true;
          }
        }

        scope.$watch(attrs.loc, computeSize);
      }
    };
  });


  angular.module('layout', ['utils', module.name]);

  return {
    controller: LayoutController
  };

})(angular, angular.element);


/* Layout Spec */
(function() {
  // Layout is used for Retail and all Generic verticals.
  utils.defineMeta('version', '1.0');

  // REQUIRED
  utils.defineAttribute('Headline', 'productClickOnly', true);
  utils.defineAttribute('Product', 'name', true);
  utils.defineAttribute('Product', 'url', true);
  utils.defineAttribute('Design', 'imageUrl', true);

  // OPTIONAL
  utils.defineAttribute('Headline', 'disclaimer', false);
  utils.defineAttribute('Headline', 'cta', false);
  utils.defineAttribute('Headline', 'pricePrefix', false);

  utils.defineAttribute('Product', 'subTitle', false);
  utils.defineAttribute('Product', 'rating', false);
  utils.defineAttribute('Product', 'price', false);

  utils.defineAttribute('Design', 'borderColor', false);
  utils.defineAttribute('Design', 'bgColor', false);
  utils.defineAttribute('Design', 'bgColorAlt', false);
  utils.defineAttribute('Design', 'txtColorProduct', false);
  utils.defineAttribute('Design', 'txtColorSubTitle', false);
  utils.defineAttribute('Design', 'txtColorPricePrefix', false);
  utils.defineAttribute('Design', 'txtColorCta', false);
  utils.defineAttribute('Design', 'txtColorPrice', false);
  utils.defineAttribute('Design', 'btnColor', false);
  utils.defineAttribute('Design', 'btnRollColor', false);
  utils.defineAttribute('Design', 'txtColorDisc', false);
  utils.defineAttribute('Design', 'cornerStyle', false);
  utils.defineAttribute('Design', 'logoImageUrl', false);
  utils.defineAttribute('Design', 'logoPadding', false);

  // OCCURRENCES
  utils.defineOccurrences('Headline', 1, 1);
  utils.defineOccurrences('Design', 1, 1);
  utils.defineOccurrences('Product', 3, 3);

  /**
   * Setup function called by onAdData.
   */
  window.setup = function() {
    document.getElementById('ad-container').addEventListener('click',
        utils.clickHandler, false);
  };

  /**
   * Function to initialize asset preloading
   * @param {Object} dynamicData Contains dynamic data payload.
   * @return {function} utils.preloader Function for image preloading.
   */
  window.initPreloading = function(dynamicData) {
    var data = dynamicData.google_template_data.adData[0];
    var design = utils.parse(data, 'Design')[0];
    var prods = utils.parse(data, 'Product').slice(0);
    var preloader = utils.preloader;
    for (var i = 0; i < prods.length; i++) {
      preloader.addImage(prods[i].imageUrl);
    }
    preloader.addImage(design.logoImageUrl);
    preloader.addImage(design.bgImageUrl);
    return preloader;
  };

})();
