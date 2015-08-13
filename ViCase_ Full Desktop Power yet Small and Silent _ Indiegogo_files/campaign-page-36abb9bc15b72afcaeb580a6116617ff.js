/*!
 * Pusher JavaScript Library v2.2.4
 * http://pusher.com/
 *
 * Copyright 2014, Pusher
 * Released under the MIT licence.
 */


;(function() {
  function Pusher(app_key, options) {
    checkAppKey(app_key);
    options = options || {};

    var self = this;

    this.key = app_key;
    this.config = Pusher.Util.extend(
      Pusher.getGlobalConfig(),
      options.cluster ? Pusher.getClusterConfig(options.cluster) : {},
      options
    );

    this.channels = new Pusher.Channels();
    this.global_emitter = new Pusher.EventsDispatcher();
    this.sessionID = Math.floor(Math.random() * 1000000000);

    this.timeline = new Pusher.Timeline(this.key, this.sessionID, {
      cluster: this.config.cluster,
      features: Pusher.Util.getClientFeatures(),
      params: this.config.timelineParams || {},
      limit: 50,
      level: Pusher.Timeline.INFO,
      version: Pusher.VERSION
    });
    if (!this.config.disableStats) {
      this.timelineSender = new Pusher.TimelineSender(this.timeline, {
        host: this.config.statsHost,
        path: "/timeline/v2/jsonp"
      });
    }

    var getStrategy = function(options) {
      var config = Pusher.Util.extend({}, self.config, options);
      return Pusher.StrategyBuilder.build(
        Pusher.getDefaultStrategy(config), config
      );
    };

    this.connection = new Pusher.ConnectionManager(
      this.key,
      Pusher.Util.extend(
        { getStrategy: getStrategy,
          timeline: this.timeline,
          activityTimeout: this.config.activity_timeout,
          pongTimeout: this.config.pong_timeout,
          unavailableTimeout: this.config.unavailable_timeout
        },
        this.config,
        { encrypted: this.isEncrypted() }
      )
    );

    this.connection.bind('connected', function() {
      self.subscribeAll();
      if (self.timelineSender) {
        self.timelineSender.send(self.connection.isEncrypted());
      }
    });
    this.connection.bind('message', function(params) {
      var internal = (params.event.indexOf('pusher_internal:') === 0);
      if (params.channel) {
        var channel = self.channel(params.channel);
        if (channel) {
          channel.handleEvent(params.event, params.data);
        }
      }
      // Emit globaly [deprecated]
      if (!internal) {
        self.global_emitter.emit(params.event, params.data);
      }
    });
    this.connection.bind('disconnected', function() {
      self.channels.disconnect();
    });
    this.connection.bind('error', function(err) {
      Pusher.warn('Error', err);
    });

    Pusher.instances.push(this);
    this.timeline.info({ instances: Pusher.instances.length });

    if (Pusher.isReady) {
      self.connect();
    }
  }
  var prototype = Pusher.prototype;

  Pusher.instances = [];
  Pusher.isReady = false;

  // To receive log output provide a Pusher.log function, for example
  // Pusher.log = function(m){console.log(m)}
  Pusher.debug = function() {
    if (!Pusher.log) {
      return;
    }
    Pusher.log(Pusher.Util.stringify.apply(this, arguments));
  };

  Pusher.warn = function() {
    var message = Pusher.Util.stringify.apply(this, arguments);
    if (window.console) {
      if (window.console.warn) {
        window.console.warn(message);
      } else if (window.console.log) {
        window.console.log(message);
      }
    }
    if (Pusher.log) {
      Pusher.log(message);
    }
  };

  Pusher.ready = function() {
    Pusher.isReady = true;
    for (var i = 0, l = Pusher.instances.length; i < l; i++) {
      Pusher.instances[i].connect();
    }
  };

  prototype.channel = function(name) {
    return this.channels.find(name);
  };

  prototype.allChannels = function() {
    return this.channels.all();
  };

  prototype.connect = function() {
    this.connection.connect();

    if (this.timelineSender) {
      if (!this.timelineSenderTimer) {
        var encrypted = this.connection.isEncrypted();
        var timelineSender = this.timelineSender;
        this.timelineSenderTimer = new Pusher.PeriodicTimer(60000, function() {
          timelineSender.send(encrypted);
        });
      }
    }
  };

  prototype.disconnect = function() {
    this.connection.disconnect();

    if (this.timelineSenderTimer) {
      this.timelineSenderTimer.ensureAborted();
      this.timelineSenderTimer = null;
    }
  };

  prototype.bind = function(event_name, callback) {
    this.global_emitter.bind(event_name, callback);
    return this;
  };

  prototype.bind_all = function(callback) {
    this.global_emitter.bind_all(callback);
    return this;
  };

  prototype.subscribeAll = function() {
    var channelName;
    for (channelName in this.channels.channels) {
      if (this.channels.channels.hasOwnProperty(channelName)) {
        this.subscribe(channelName);
      }
    }
  };

  prototype.subscribe = function(channel_name) {
    var channel = this.channels.add(channel_name, this);
    if (this.connection.state === 'connected') {
      channel.subscribe();
    }
    return channel;
  };

  prototype.unsubscribe = function(channel_name) {
    var channel = this.channels.remove(channel_name);
    if (this.connection.state === 'connected') {
      channel.unsubscribe();
    }
  };

  prototype.send_event = function(event_name, data, channel) {
    return this.connection.send_event(event_name, data, channel);
  };

  prototype.isEncrypted = function() {
    if (Pusher.Util.getDocument().location.protocol === "https:") {
      return true;
    } else {
      return Boolean(this.config.encrypted);
    }
  };

  function checkAppKey(key) {
    if (key === null || key === undefined) {
      Pusher.warn(
        'Warning', 'You must pass your app key when you instantiate Pusher.'
      );
    }
  }

  Pusher.HTTP = {};

  this.Pusher = Pusher;
}).call(this);

;(function() {
  // We need to bind clear functions this way to avoid exceptions on IE8
  function clearTimeout(timer) {
    window.clearTimeout(timer);
  }
  function clearInterval(timer) {
    window.clearInterval(timer);
  }

  function GenericTimer(set, clear, delay, callback) {
    var self = this;

    this.clear = clear;
    this.timer = set(function() {
      if (self.timer !== null) {
        self.timer = callback(self.timer);
      }
    }, delay);
  }
  var prototype = GenericTimer.prototype;

  /** Returns whether the timer is still running.
   *
   * @return {Boolean}
   */
  prototype.isRunning = function() {
    return this.timer !== null;
  };

  /** Aborts a timer when it's running. */
  prototype.ensureAborted = function() {
    if (this.timer) {
      // Clear function is already bound
      this.clear(this.timer);
      this.timer = null;
    }
  };

  /** Cross-browser compatible one-off timer abstraction.
   *
   * @param {Number} delay
   * @param {Function} callback
   */
  Pusher.Timer = function(delay, callback) {
    return new GenericTimer(setTimeout, clearTimeout, delay, function(timer) {
      callback();
      return null;
    });
  };
  /** Cross-browser compatible periodic timer abstraction.
   *
   * @param {Number} delay
   * @param {Function} callback
   */
  Pusher.PeriodicTimer = function(delay, callback) {
    return new GenericTimer(setInterval, clearInterval, delay, function(timer) {
      callback();
      return timer;
    });
  };
}).call(this);

;(function() {
  Pusher.Util = {
    now: function() {
      if (Date.now) {
        return Date.now();
      } else {
        return new Date().valueOf();
      }
    },

    defer: function(callback) {
      return new Pusher.Timer(0, callback);
    },

    /** Merges multiple objects into the target argument.
     *
     * For properties that are plain Objects, performs a deep-merge. For the
     * rest it just copies the value of the property.
     *
     * To extend prototypes use it as following:
     *   Pusher.Util.extend(Target.prototype, Base.prototype)
     *
     * You can also use it to merge objects without altering them:
     *   Pusher.Util.extend({}, object1, object2)
     *
     * @param  {Object} target
     * @return {Object} the target argument
     */
    extend: function(target) {
      for (var i = 1; i < arguments.length; i++) {
        var extensions = arguments[i];
        for (var property in extensions) {
          if (extensions[property] && extensions[property].constructor &&
              extensions[property].constructor === Object) {
            target[property] = Pusher.Util.extend(
              target[property] || {}, extensions[property]
            );
          } else {
            target[property] = extensions[property];
          }
        }
      }
      return target;
    },

    stringify: function() {
      var m = ["Pusher"];
      for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] === "string") {
          m.push(arguments[i]);
        } else {
          if (window.JSON === undefined) {
            m.push(arguments[i].toString());
          } else {
            m.push(JSON.stringify(arguments[i]));
          }
        }
      }
      return m.join(" : ");
    },

    arrayIndexOf: function(array, item) { // MSIE doesn't have array.indexOf
      var nativeIndexOf = Array.prototype.indexOf;
      if (array === null) {
        return -1;
      }
      if (nativeIndexOf && array.indexOf === nativeIndexOf) {
        return array.indexOf(item);
      }
      for (var i = 0, l = array.length; i < l; i++) {
        if (array[i] === item) {
          return i;
        }
      }
      return -1;
    },

    /** Applies a function f to all properties of an object.
     *
     * Function f gets 3 arguments passed:
     * - element from the object
     * - key of the element
     * - reference to the object
     *
     * @param {Object} object
     * @param {Function} f
     */
    objectApply: function(object, f) {
      for (var key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          f(object[key], key, object);
        }
      }
    },

    /** Return a list of object's own property keys
     *
     * @param {Object} object
     * @returns {Array}
     */
    keys: function(object) {
      var keys = [];
      Pusher.Util.objectApply(object, function(_, key) {
        keys.push(key);
      });
      return keys;
    },

    /** Return a list of object's own property values
     *
     * @param {Object} object
     * @returns {Array}
     */
    values: function(object) {
      var values = [];
      Pusher.Util.objectApply(object, function(value) {
        values.push(value);
      });
      return values;
    },

    /** Applies a function f to all elements of an array.
     *
     * Function f gets 3 arguments passed:
     * - element from the array
     * - index of the element
     * - reference to the array
     *
     * @param {Array} array
     * @param {Function} f
     */
    apply: function(array, f, context) {
      for (var i = 0; i < array.length; i++) {
        f.call(context || window, array[i], i, array);
      }
    },

    /** Maps all elements of the array and returns the result.
     *
     * Function f gets 4 arguments passed:
     * - element from the array
     * - index of the element
     * - reference to the source array
     * - reference to the destination array
     *
     * @param {Array} array
     * @param {Function} f
     */
    map: function(array, f) {
      var result = [];
      for (var i = 0; i < array.length; i++) {
        result.push(f(array[i], i, array, result));
      }
      return result;
    },

    /** Maps all elements of the object and returns the result.
     *
     * Function f gets 4 arguments passed:
     * - element from the object
     * - key of the element
     * - reference to the source object
     * - reference to the destination object
     *
     * @param {Object} object
     * @param {Function} f
     */
    mapObject: function(object, f) {
      var result = {};
      Pusher.Util.objectApply(object, function(value, key) {
        result[key] = f(value);
      });
      return result;
    },

    /** Filters elements of the array using a test function.
     *
     * Function test gets 4 arguments passed:
     * - element from the array
     * - index of the element
     * - reference to the source array
     * - reference to the destination array
     *
     * @param {Array} array
     * @param {Function} f
     */
    filter: function(array, test) {
      test = test || function(value) { return !!value; };

      var result = [];
      for (var i = 0; i < array.length; i++) {
        if (test(array[i], i, array, result)) {
          result.push(array[i]);
        }
      }
      return result;
    },

    /** Filters properties of the object using a test function.
     *
     * Function test gets 4 arguments passed:
     * - element from the object
     * - key of the element
     * - reference to the source object
     * - reference to the destination object
     *
     * @param {Object} object
     * @param {Function} f
     */
    filterObject: function(object, test) {
      var result = {};
      Pusher.Util.objectApply(object, function(value, key) {
        if ((test && test(value, key, object, result)) || Boolean(value)) {
          result[key] = value;
        }
      });
      return result;
    },

    /** Flattens an object into a two-dimensional array.
     *
     * @param  {Object} object
     * @return {Array} resulting array of [key, value] pairs
     */
    flatten: function(object) {
      var result = [];
      Pusher.Util.objectApply(object, function(value, key) {
        result.push([key, value]);
      });
      return result;
    },

    /** Checks whether any element of the array passes the test.
     *
     * Function test gets 3 arguments passed:
     * - element from the array
     * - index of the element
     * - reference to the source array
     *
     * @param {Array} array
     * @param {Function} f
     */
    any: function(array, test) {
      for (var i = 0; i < array.length; i++) {
        if (test(array[i], i, array)) {
          return true;
        }
      }
      return false;
    },

    /** Checks whether all elements of the array pass the test.
     *
     * Function test gets 3 arguments passed:
     * - element from the array
     * - index of the element
     * - reference to the source array
     *
     * @param {Array} array
     * @param {Function} f
     */
    all: function(array, test) {
      for (var i = 0; i < array.length; i++) {
        if (!test(array[i], i, array)) {
          return false;
        }
      }
      return true;
    },

    /** Builds a function that will proxy a method call to its first argument.
     *
     * Allows partial application of arguments, so additional arguments are
     * prepended to the argument list.
     *
     * @param  {String} name method name
     * @return {Function} proxy function
     */
    method: function(name) {
      var boundArguments = Array.prototype.slice.call(arguments, 1);
      return function(object) {
        return object[name].apply(object, boundArguments.concat(arguments));
      };
    },

    getWindow: function() {
      return window;
    },

    getDocument: function() {
      return document;
    },

    getNavigator: function() {
      return navigator;
    },

    getLocalStorage: function() {
      try {
        return window.localStorage;
      } catch (e) {
        return undefined;
      }
    },

    getClientFeatures: function() {
      return Pusher.Util.keys(
        Pusher.Util.filterObject(
          { "ws": Pusher.WSTransport, "flash": Pusher.FlashTransport },
          function (t) { return t.isSupported({}); }
        )
      );
    },

    addWindowListener: function(event, listener) {
      var _window = Pusher.Util.getWindow();
      if (_window.addEventListener !== undefined) {
        _window.addEventListener(event, listener, false);
      } else {
        _window.attachEvent("on" + event, listener);
      }
    },

    removeWindowListener: function(event, listener) {
      var _window = Pusher.Util.getWindow();
      if (_window.addEventListener !== undefined) {
        _window.removeEventListener(event, listener, false);
      } else {
        _window.detachEvent("on" + event, listener);
      }
    },

    isXHRSupported: function() {
      var XHR = window.XMLHttpRequest;
      return Boolean(XHR) && (new XHR()).withCredentials !== undefined;
    },

    isXDRSupported: function(encrypted) {
      var protocol = encrypted ? "https:" : "http:";
      var documentProtocol = Pusher.Util.getDocument().location.protocol;
      return Boolean(window.XDomainRequest) && documentProtocol === protocol;
    }
  };
}).call(this);

;(function() {
  Pusher.VERSION = '2.2.4';
  Pusher.PROTOCOL = 7;

  // DEPRECATED: WS connection parameters
  Pusher.host = 'ws.pusherapp.com';
  Pusher.ws_port = 80;
  Pusher.wss_port = 443;
  // DEPRECATED: SockJS fallback parameters
  Pusher.sockjs_host = 'sockjs.pusher.com';
  Pusher.sockjs_http_port = 80;
  Pusher.sockjs_https_port = 443;
  Pusher.sockjs_path = "/pusher";
  // DEPRECATED: Stats
  Pusher.stats_host = 'stats.pusher.com';
  // DEPRECATED: Other settings
  Pusher.channel_auth_endpoint = '/pusher/auth';
  Pusher.channel_auth_transport = 'ajax';
  Pusher.activity_timeout = 120000;
  Pusher.pong_timeout = 30000;
  Pusher.unavailable_timeout = 10000;
  // CDN configuration
  Pusher.cdn_http = 'http://js.pusher.com/';
  Pusher.cdn_https = 'https://js.pusher.com/';
  Pusher.dependency_suffix = '';

  Pusher.getDefaultStrategy = function(config) {
    var wsStrategy;
    if (config.encrypted) {
      wsStrategy = [
        ":best_connected_ever",
        ":ws_loop",
        [":delayed", 2000, [":http_fallback_loop"]]
      ];
    } else {
      wsStrategy = [
        ":best_connected_ever",
        ":ws_loop",
        [":delayed", 2000, [":wss_loop"]],
        [":delayed", 5000, [":http_fallback_loop"]]
      ];
    }

    return [
      [":def", "ws_options", {
        hostUnencrypted: config.wsHost + ":" + config.wsPort,
        hostEncrypted: config.wsHost + ":" + config.wssPort
      }],
      [":def", "wss_options", [":extend", ":ws_options", {
        encrypted: true
      }]],
      [":def", "sockjs_options", {
        hostUnencrypted: config.httpHost + ":" + config.httpPort,
        hostEncrypted: config.httpHost + ":" + config.httpsPort,
        httpPath: config.httpPath
      }],
      [":def", "timeouts", {
        loop: true,
        timeout: 15000,
        timeoutLimit: 60000
      }],

      [":def", "ws_manager", [":transport_manager", {
        lives: 2,
        minPingDelay: 10000,
        maxPingDelay: config.activity_timeout
      }]],
      [":def", "streaming_manager", [":transport_manager", {
        lives: 2,
        minPingDelay: 10000,
        maxPingDelay: config.activity_timeout
      }]],

      [":def_transport", "ws", "ws", 3, ":ws_options", ":ws_manager"],
      [":def_transport", "wss", "ws", 3, ":wss_options", ":ws_manager"],
      [":def_transport", "flash", "flash", 2, ":ws_options", ":ws_manager"],
      [":def_transport", "sockjs", "sockjs", 1, ":sockjs_options"],
      [":def_transport", "xhr_streaming", "xhr_streaming", 1, ":sockjs_options", ":streaming_manager"],
      [":def_transport", "xdr_streaming", "xdr_streaming", 1, ":sockjs_options", ":streaming_manager"],
      [":def_transport", "xhr_polling", "xhr_polling", 1, ":sockjs_options"],
      [":def_transport", "xdr_polling", "xdr_polling", 1, ":sockjs_options"],

      [":def", "ws_loop", [":sequential", ":timeouts", ":ws"]],
      [":def", "wss_loop", [":sequential", ":timeouts", ":wss"]],
      [":def", "flash_loop", [":sequential", ":timeouts", ":flash"]],
      [":def", "sockjs_loop", [":sequential", ":timeouts", ":sockjs"]],

      [":def", "streaming_loop", [":sequential", ":timeouts",
        [":if", [":is_supported", ":xhr_streaming"],
          ":xhr_streaming",
          ":xdr_streaming"
        ]
      ]],
      [":def", "polling_loop", [":sequential", ":timeouts",
        [":if", [":is_supported", ":xhr_polling"],
          ":xhr_polling",
          ":xdr_polling"
        ]
      ]],

      [":def", "http_loop", [":if", [":is_supported", ":streaming_loop"], [
        ":best_connected_ever",
          ":streaming_loop",
          [":delayed", 4000, [":polling_loop"]]
      ], [
        ":polling_loop"
      ]]],

      [":def", "http_fallback_loop",
        [":if", [":is_supported", ":http_loop"], [
          ":http_loop"
        ], [
          ":sockjs_loop"
        ]]
      ],

      [":def", "strategy",
        [":cached", 1800000,
          [":first_connected",
            [":if", [":is_supported", ":ws"],
              wsStrategy,
            [":if", [":is_supported", ":flash"], [
              ":best_connected_ever",
              ":flash_loop",
              [":delayed", 2000, [":http_fallback_loop"]]
            ], [
              ":http_fallback_loop"
            ]]]
          ]
        ]
      ]
    ];
  };
}).call(this);

;(function() {
  Pusher.getGlobalConfig = function() {
    return {
      wsHost: Pusher.host,
      wsPort: Pusher.ws_port,
      wssPort: Pusher.wss_port,
      httpHost: Pusher.sockjs_host,
      httpPort: Pusher.sockjs_http_port,
      httpsPort: Pusher.sockjs_https_port,
      httpPath: Pusher.sockjs_path,
      statsHost: Pusher.stats_host,
      authEndpoint: Pusher.channel_auth_endpoint,
      authTransport: Pusher.channel_auth_transport,
      // TODO make this consistent with other options in next major version
      activity_timeout: Pusher.activity_timeout,
      pong_timeout: Pusher.pong_timeout,
      unavailable_timeout: Pusher.unavailable_timeout
    };
  };

  Pusher.getClusterConfig = function(clusterName) {
    return {
      wsHost: "ws-" + clusterName + ".pusher.com",
      httpHost: "sockjs-" + clusterName + ".pusher.com"
    };
  };
}).call(this);

;(function() {
  function buildExceptionClass(name) {
    var constructor = function(message) {
      Error.call(this, message);
      this.name = name;
    };
    Pusher.Util.extend(constructor.prototype, Error.prototype);

    return constructor;
  }

  /** Error classes used throughout pusher-js library. */
  Pusher.Errors = {
    BadEventName: buildExceptionClass("BadEventName"),
    RequestTimedOut: buildExceptionClass("RequestTimedOut"),
    TransportPriorityTooLow: buildExceptionClass("TransportPriorityTooLow"),
    TransportClosed: buildExceptionClass("TransportClosed"),
    UnsupportedTransport: buildExceptionClass("UnsupportedTransport"),
    UnsupportedStrategy: buildExceptionClass("UnsupportedStrategy")
  };
}).call(this);

;(function() {
  /** Manages callback bindings and event emitting.
   *
   * @param Function failThrough called when no listeners are bound to an event
   */
  function EventsDispatcher(failThrough) {
    this.callbacks = new CallbackRegistry();
    this.global_callbacks = [];
    this.failThrough = failThrough;
  }
  var prototype = EventsDispatcher.prototype;

  prototype.bind = function(eventName, callback, context) {
    this.callbacks.add(eventName, callback, context);
    return this;
  };

  prototype.bind_all = function(callback) {
    this.global_callbacks.push(callback);
    return this;
  };

  prototype.unbind = function(eventName, callback, context) {
    this.callbacks.remove(eventName, callback, context);
    return this;
  };

  prototype.unbind_all = function(eventName, callback) {
    this.callbacks.remove(eventName, callback);
    return this;
  };

  prototype.emit = function(eventName, data) {
    var i;

    for (i = 0; i < this.global_callbacks.length; i++) {
      this.global_callbacks[i](eventName, data);
    }

    var callbacks = this.callbacks.get(eventName);
    if (callbacks && callbacks.length > 0) {
      for (i = 0; i < callbacks.length; i++) {
        callbacks[i].fn.call(callbacks[i].context || window, data);
      }
    } else if (this.failThrough) {
      this.failThrough(eventName, data);
    }

    return this;
  };

  /** Callback registry helper. */

  function CallbackRegistry() {
    this._callbacks = {};
  }

  CallbackRegistry.prototype.get = function(name) {
    return this._callbacks[prefix(name)];
  };

  CallbackRegistry.prototype.add = function(name, callback, context) {
    var prefixedEventName = prefix(name);
    this._callbacks[prefixedEventName] = this._callbacks[prefixedEventName] || [];
    this._callbacks[prefixedEventName].push({
      fn: callback,
      context: context
    });
  };

  CallbackRegistry.prototype.remove = function(name, callback, context) {
    if (!name && !callback && !context) {
      this._callbacks = {};
      return;
    }

    var names = name ? [prefix(name)] : Pusher.Util.keys(this._callbacks);

    if (callback || context) {
      Pusher.Util.apply(names, function(name) {
        this._callbacks[name] = Pusher.Util.filter(
          this._callbacks[name] || [],
          function(binding) {
            return (callback && callback !== binding.fn) ||
                   (context && context !== binding.context);
          }
        );
        if (this._callbacks[name].length === 0) {
          delete this._callbacks[name];
        }
      }, this);
    } else {
      Pusher.Util.apply(names, function(name) {
        delete this._callbacks[name];
      }, this);
    }
  };

  function prefix(name) {
    return "_" + name;
  }

  Pusher.EventsDispatcher = EventsDispatcher;
}).call(this);

(function() {
  /** Builds receivers for JSONP and Script requests.
   *
   * Each receiver is an object with following fields:
   * - number - unique (for the factory instance), numerical id of the receiver
   * - id - a string ID that can be used in DOM attributes
   * - name - name of the function triggering the receiver
   * - callback - callback function
   *
   * Receivers are triggered only once, on the first callback call.
   *
   * Receivers can be called by their name or by accessing factory object
   * by the number key.
   *
   * @param {String} prefix the prefix used in ids
   * @param {String} name the name of the object
   */
  function ScriptReceiverFactory(prefix, name) {
    this.lastId = 0;
    this.prefix = prefix;
    this.name = name;
  }
  var prototype = ScriptReceiverFactory.prototype;

  /** Creates a script receiver.
   *
   * @param {Function} callback
   * @return {ScriptReceiver}
   */
  prototype.create = function(callback) {
    this.lastId++;

    var number = this.lastId;
    var id = this.prefix + number;
    var name = this.name + "[" + number + "]";

    var called = false;
    var callbackWrapper = function() {
      if (!called) {
        callback.apply(null, arguments);
        called = true;
      }
    };

    this[number] = callbackWrapper;
    return { number: number, id: id, name: name, callback: callbackWrapper };
  };

  /** Removes the script receiver from the list.
   *
   * @param {ScriptReceiver} receiver
   */
  prototype.remove = function(receiver) {
    delete this[receiver.number];
  };

  Pusher.ScriptReceiverFactory = ScriptReceiverFactory;
  Pusher.ScriptReceivers = new ScriptReceiverFactory(
    "_pusher_script_", "Pusher.ScriptReceivers"
  );
}).call(this);

(function() {
  /** Sends a generic HTTP GET request using a script tag.
   *
   * By constructing URL in a specific way, it can be used for loading
   * JavaScript resources or JSONP requests. It can notify about errors, but
   * only in certain environments. Please take care of monitoring the state of
   * the request yourself.
   *
   * @param {String} src
   */
  function ScriptRequest(src) {
    this.src = src;
  }
  var prototype = ScriptRequest.prototype;

  /** Sends the actual script request.
   *
   * @param {ScriptReceiver} receiver
   */
  prototype.send = function(receiver) {
    var self = this;
    var errorString = "Error loading " + self.src;

    self.script = document.createElement("script");
    self.script.id = receiver.id;
    self.script.src = self.src;
    self.script.type = "text/javascript";
    self.script.charset = "UTF-8";

    if (self.script.addEventListener) {
      self.script.onerror = function() {
        receiver.callback(errorString);
      };
      self.script.onload = function() {
        receiver.callback(null);
      };
    } else {
      self.script.onreadystatechange = function() {
        if (self.script.readyState === 'loaded' ||
            self.script.readyState === 'complete') {
          receiver.callback(null);
        }
      };
    }

    // Opera<11.6 hack for missing onerror callback
    if (self.script.async === undefined && document.attachEvent &&
        /opera/i.test(navigator.userAgent)) {
      self.errorScript = document.createElement("script");
      self.errorScript.id = receiver.id + "_error";
      self.errorScript.text = receiver.name + "('" + errorString + "');";
      self.script.async = self.errorScript.async = false;
    } else {
      self.script.async = true;
    }

    var head = document.getElementsByTagName('head')[0];
    head.insertBefore(self.script, head.firstChild);
    if (self.errorScript) {
      head.insertBefore(self.errorScript, self.script.nextSibling);
    }
  };

  /** Cleans up the DOM remains of the script request. */
  prototype.cleanup = function() {
    if (this.script) {
      this.script.onload = this.script.onerror = null;
      this.script.onreadystatechange = null;
    }
    if (this.script && this.script.parentNode) {
      this.script.parentNode.removeChild(this.script);
    }
    if (this.errorScript && this.errorScript.parentNode) {
      this.errorScript.parentNode.removeChild(this.errorScript);
    }
    this.script = null;
    this.errorScript = null;
  };

  Pusher.ScriptRequest = ScriptRequest;
}).call(this);

;(function() {
  /** Handles loading dependency files.
   *
   * Dependency loaders don't remember whether a resource has been loaded or
   * not. It is caller's responsibility to make sure the resource is not loaded
   * twice. This is because it's impossible to detect resource loading status
   * without knowing its content.
   *
   * Options:
   * - cdn_http - url to HTTP CND
   * - cdn_https - url to HTTPS CDN
   * - version - version of pusher-js
   * - suffix - suffix appended to all names of dependency files
   *
   * @param {Object} options
   */
  function DependencyLoader(options) {
    this.options = options;
    this.receivers = options.receivers || Pusher.ScriptReceivers;
    this.loading = {};
  }
  var prototype = DependencyLoader.prototype;

  /** Loads the dependency from CDN.
   *
   * @param  {String} name
   * @param  {Function} callback
   */
  prototype.load = function(name, options, callback) {
    var self = this;

    if (self.loading[name] && self.loading[name].length > 0) {
      self.loading[name].push(callback);
    } else {
      self.loading[name] = [callback];

      var request = new Pusher.ScriptRequest(self.getPath(name, options));
      var receiver = self.receivers.create(function(error) {
        self.receivers.remove(receiver);

        if (self.loading[name]) {
          var callbacks = self.loading[name];
          delete self.loading[name];

          var successCallback = function(wasSuccessful) {
            if (!wasSuccessful) {
              request.cleanup();
            }
          };
          for (var i = 0; i < callbacks.length; i++) {
            callbacks[i](error, successCallback);
          }
        }
      });
      request.send(receiver);
    }
  };

  /** Returns a root URL for pusher-js CDN.
   *
   * @returns {String}
   */
  prototype.getRoot = function(options) {
    var cdn;
    var protocol = Pusher.Util.getDocument().location.protocol;
    if ((options && options.encrypted) || protocol === "https:") {
      cdn = this.options.cdn_https;
    } else {
      cdn = this.options.cdn_http;
    }
    // make sure there are no double slashes
    return cdn.replace(/\/*$/, "") + "/" + this.options.version;
  };

  /** Returns a full path to a dependency file.
   *
   * @param {String} name
   * @returns {String}
   */
  prototype.getPath = function(name, options) {
    return this.getRoot(options) + '/' + name + this.options.suffix + '.js';
  };

  Pusher.DependencyLoader = DependencyLoader;
}).call(this);

;(function() {
  Pusher.DependenciesReceivers = new Pusher.ScriptReceiverFactory(
    "_pusher_dependencies", "Pusher.DependenciesReceivers"
  );
  Pusher.Dependencies = new Pusher.DependencyLoader({
    cdn_http: Pusher.cdn_http,
    cdn_https: Pusher.cdn_https,
    version: Pusher.VERSION,
    suffix: Pusher.dependency_suffix,
    receivers: Pusher.DependenciesReceivers
  });

  function initialize() {
    Pusher.ready();
  }

  // Allows calling a function when the document body is available
   function onDocumentBody(callback) {
    if (document.body) {
      callback();
    } else {
      setTimeout(function() {
        onDocumentBody(callback);
      }, 0);
    }
  }

  function initializeOnDocumentBody() {
    onDocumentBody(initialize);
  }

  if (!window.JSON) {
    Pusher.Dependencies.load("json2", {}, initializeOnDocumentBody);
  } else {
    initializeOnDocumentBody();
  }
})();

(function() {

  var Base64 = {
    encode: function (s) {
      return btoa(utob(s));
    }
  };

  var fromCharCode = String.fromCharCode;

  var b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var b64tab = {};

  for (var i = 0, l = b64chars.length; i < l; i++) {
    b64tab[b64chars.charAt(i)] = i;
  }

  var cb_utob = function(c) {
    var cc = c.charCodeAt(0);
    return cc < 0x80 ? c
        : cc < 0x800 ? fromCharCode(0xc0 | (cc >>> 6)) +
                       fromCharCode(0x80 | (cc & 0x3f))
        : fromCharCode(0xe0 | ((cc >>> 12) & 0x0f)) +
          fromCharCode(0x80 | ((cc >>>  6) & 0x3f)) +
          fromCharCode(0x80 | ( cc         & 0x3f));
  };

  var utob = function(u) {
    return u.replace(/[^\x00-\x7F]/g, cb_utob);
  };

  var cb_encode = function(ccc) {
    var padlen = [0, 2, 1][ccc.length % 3];
    var ord = ccc.charCodeAt(0) << 16
      | ((ccc.length > 1 ? ccc.charCodeAt(1) : 0) << 8)
      | ((ccc.length > 2 ? ccc.charCodeAt(2) : 0));
    var chars = [
      b64chars.charAt( ord >>> 18),
      b64chars.charAt((ord >>> 12) & 63),
      padlen >= 2 ? '=' : b64chars.charAt((ord >>> 6) & 63),
      padlen >= 1 ? '=' : b64chars.charAt(ord & 63)
    ];
    return chars.join('');
  };

  var btoa = window.btoa || function(b) {
    return b.replace(/[\s\S]{1,3}/g, cb_encode);
  };

  Pusher.Base64 = Base64;

}).call(this);

(function() {
  /** Sends data via JSONP.
   *
   * Data is a key-value map. Its values are JSON-encoded and then passed
   * through base64. Finally, keys and encoded values are appended to the query
   * string.
   *
   * The class itself does not guarantee raising errors on failures, as it's not
   * possible to support such feature on all browsers. Instead, JSONP endpoint
   * should call back in a way that's easy to distinguish from browser calls,
   * for example by passing a second argument to the receiver.
   *
   * @param {String} url
   * @param {Object} data key-value map of data to be submitted
   */
  function JSONPRequest(url, data) {
    this.url = url;
    this.data = data;
  }
  var prototype = JSONPRequest.prototype;

  /** Sends the actual JSONP request.
   *
   * @param {ScriptReceiver} receiver
   */
  prototype.send = function(receiver) {
    if (this.request) {
      return;
    }

    var params = Pusher.Util.filterObject(this.data, function(value) {
      return value !== undefined;
    });
    var query = Pusher.Util.map(
      Pusher.Util.flatten(encodeParamsObject(params)),
      Pusher.Util.method("join", "=")
    ).join("&");
    var url = this.url + "/" + receiver.number + "?" + query;

    this.request = new Pusher.ScriptRequest(url);
    this.request.send(receiver);
  };

  /** Cleans up the DOM remains of the JSONP request. */
  prototype.cleanup = function() {
    if (this.request) {
      this.request.cleanup();
    }
  };

  function encodeParamsObject(data) {
    return Pusher.Util.mapObject(data, function(value) {
      if (typeof value === "object") {
        value = JSON.stringify(value);
      }
      return encodeURIComponent(Pusher.Base64.encode(value.toString()));
    });
  }

  Pusher.JSONPRequest = JSONPRequest;
}).call(this);

(function() {
  function Timeline(key, session, options) {
    this.key = key;
    this.session = session;
    this.events = [];
    this.options = options || {};
    this.sent = 0;
    this.uniqueID = 0;
  }
  var prototype = Timeline.prototype;

  // Log levels
  Timeline.ERROR = 3;
  Timeline.INFO = 6;
  Timeline.DEBUG = 7;

  prototype.log = function(level, event) {
    if (level <= this.options.level) {
      this.events.push(
        Pusher.Util.extend({}, event, { timestamp: Pusher.Util.now() })
      );
      if (this.options.limit && this.events.length > this.options.limit) {
        this.events.shift();
      }
    }
  };

  prototype.error = function(event) {
    this.log(Timeline.ERROR, event);
  };

  prototype.info = function(event) {
    this.log(Timeline.INFO, event);
  };

  prototype.debug = function(event) {
    this.log(Timeline.DEBUG, event);
  };

  prototype.isEmpty = function() {
    return this.events.length === 0;
  };

  prototype.send = function(sendJSONP, callback) {
    var self = this;

    var data = Pusher.Util.extend({
      session: self.session,
      bundle: self.sent + 1,
      key: self.key,
      lib: "js",
      version: self.options.version,
      cluster: self.options.cluster,
      features: self.options.features,
      timeline: self.events
    }, self.options.params);

    self.events = [];
    sendJSONP(data, function(error, result) {
      if (!error) {
        self.sent++;
      }
      if (callback) {
        callback(error, result);
      }
    });

    return true;
  };

  prototype.generateUniqueID = function() {
    this.uniqueID++;
    return this.uniqueID;
  };

  Pusher.Timeline = Timeline;
}).call(this);

(function() {
  function TimelineSender(timeline, options) {
    this.timeline = timeline;
    this.options = options || {};
  }
  var prototype = TimelineSender.prototype;

  prototype.send = function(encrypted, callback) {
    var self = this;

    if (self.timeline.isEmpty()) {
      return;
    }

    var sendJSONP = function(data, callback) {
      var scheme = "http" + (encrypted ? "s" : "") + "://";
      var url = scheme + (self.host || self.options.host) + self.options.path;
      var request = new Pusher.JSONPRequest(url, data);

      var receiver = Pusher.ScriptReceivers.create(function(error, result) {
        Pusher.ScriptReceivers.remove(receiver);
        request.cleanup();

        if (result && result.host) {
          self.host = result.host;
        }
        if (callback) {
          callback(error, result);
        }
      });
      request.send(receiver);
    };
    self.timeline.send(sendJSONP, callback);
  };

  Pusher.TimelineSender = TimelineSender;
}).call(this);

;(function() {
  /** Launches all substrategies and emits prioritized connected transports.
   *
   * @param {Array} strategies
   */
  function BestConnectedEverStrategy(strategies) {
    this.strategies = strategies;
  }
  var prototype = BestConnectedEverStrategy.prototype;

  prototype.isSupported = function() {
    return Pusher.Util.any(this.strategies, Pusher.Util.method("isSupported"));
  };

  prototype.connect = function(minPriority, callback) {
    return connect(this.strategies, minPriority, function(i, runners) {
      return function(error, handshake) {
        runners[i].error = error;
        if (error) {
          if (allRunnersFailed(runners)) {
            callback(true);
          }
          return;
        }
        Pusher.Util.apply(runners, function(runner) {
          runner.forceMinPriority(handshake.transport.priority);
        });
        callback(null, handshake);
      };
    });
  };

  /** Connects to all strategies in parallel.
   *
   * Callback builder should be a function that takes two arguments: index
   * and a list of runners. It should return another function that will be
   * passed to the substrategy with given index. Runners can be aborted using
   * abortRunner(s) functions from this class.
   *
   * @param  {Array} strategies
   * @param  {Function} callbackBuilder
   * @return {Object} strategy runner
   */
  function connect(strategies, minPriority, callbackBuilder) {
    var runners = Pusher.Util.map(strategies, function(strategy, i, _, rs) {
      return strategy.connect(minPriority, callbackBuilder(i, rs));
    });
    return {
      abort: function() {
        Pusher.Util.apply(runners, abortRunner);
      },
      forceMinPriority: function(p) {
        Pusher.Util.apply(runners, function(runner) {
          runner.forceMinPriority(p);
        });
      }
    };
  }

  function allRunnersFailed(runners) {
    return Pusher.Util.all(runners, function(runner) {
      return Boolean(runner.error);
    });
  }

  function abortRunner(runner) {
    if (!runner.error && !runner.aborted) {
      runner.abort();
      runner.aborted = true;
    }
  }

  Pusher.BestConnectedEverStrategy = BestConnectedEverStrategy;
}).call(this);

;(function() {
  /** Caches last successful transport and uses it for following attempts.
   *
   * @param {Strategy} strategy
   * @param {Object} transports
   * @param {Object} options
   */
  function CachedStrategy(strategy, transports, options) {
    this.strategy = strategy;
    this.transports = transports;
    this.ttl = options.ttl || 1800*1000;
    this.encrypted = options.encrypted;
    this.timeline = options.timeline;
  }
  var prototype = CachedStrategy.prototype;

  prototype.isSupported = function() {
    return this.strategy.isSupported();
  };

  prototype.connect = function(minPriority, callback) {
    var encrypted = this.encrypted;
    var info = fetchTransportCache(encrypted);

    var strategies = [this.strategy];
    if (info && info.timestamp + this.ttl >= Pusher.Util.now()) {
      var transport = this.transports[info.transport];
      if (transport) {
        this.timeline.info({
          cached: true,
          transport: info.transport,
          latency: info.latency
        });
        strategies.push(new Pusher.SequentialStrategy([transport], {
          timeout: info.latency * 2 + 1000,
          failFast: true
        }));
      }
    }

    var startTimestamp = Pusher.Util.now();
    var runner = strategies.pop().connect(
      minPriority,
      function cb(error, handshake) {
        if (error) {
          flushTransportCache(encrypted);
          if (strategies.length > 0) {
            startTimestamp = Pusher.Util.now();
            runner = strategies.pop().connect(minPriority, cb);
          } else {
            callback(error);
          }
        } else {
          storeTransportCache(
            encrypted,
            handshake.transport.name,
            Pusher.Util.now() - startTimestamp
          );
          callback(null, handshake);
        }
      }
    );

    return {
      abort: function() {
        runner.abort();
      },
      forceMinPriority: function(p) {
        minPriority = p;
        if (runner) {
          runner.forceMinPriority(p);
        }
      }
    };
  };

  function getTransportCacheKey(encrypted) {
    return "pusherTransport" + (encrypted ? "Encrypted" : "Unencrypted");
  }

  function fetchTransportCache(encrypted) {
    var storage = Pusher.Util.getLocalStorage();
    if (storage) {
      try {
        var serializedCache = storage[getTransportCacheKey(encrypted)];
        if (serializedCache) {
          return JSON.parse(serializedCache);
        }
      } catch (e) {
        flushTransportCache(encrypted);
      }
    }
    return null;
  }

  function storeTransportCache(encrypted, transport, latency) {
    var storage = Pusher.Util.getLocalStorage();
    if (storage) {
      try {
        storage[getTransportCacheKey(encrypted)] = JSON.stringify({
          timestamp: Pusher.Util.now(),
          transport: transport,
          latency: latency
        });
      } catch (e) {
        // catch over quota exceptions raised by localStorage
      }
    }
  }

  function flushTransportCache(encrypted) {
    var storage = Pusher.Util.getLocalStorage();
    if (storage) {
      try {
        delete storage[getTransportCacheKey(encrypted)];
      } catch (e) {
        // catch exceptions raised by localStorage
      }
    }
  }

  Pusher.CachedStrategy = CachedStrategy;
}).call(this);

;(function() {
  /** Runs substrategy after specified delay.
   *
   * Options:
   * - delay - time in miliseconds to delay the substrategy attempt
   *
   * @param {Strategy} strategy
   * @param {Object} options
   */
  function DelayedStrategy(strategy, options) {
    this.strategy = strategy;
    this.options = { delay: options.delay };
  }
  var prototype = DelayedStrategy.prototype;

  prototype.isSupported = function() {
    return this.strategy.isSupported();
  };

  prototype.connect = function(minPriority, callback) {
    var strategy = this.strategy;
    var runner;
    var timer = new Pusher.Timer(this.options.delay, function() {
      runner = strategy.connect(minPriority, callback);
    });

    return {
      abort: function() {
        timer.ensureAborted();
        if (runner) {
          runner.abort();
        }
      },
      forceMinPriority: function(p) {
        minPriority = p;
        if (runner) {
          runner.forceMinPriority(p);
        }
      }
    };
  };

  Pusher.DelayedStrategy = DelayedStrategy;
}).call(this);

;(function() {
  /** Launches the substrategy and terminates on the first open connection.
   *
   * @param {Strategy} strategy
   */
  function FirstConnectedStrategy(strategy) {
    this.strategy = strategy;
  }
  var prototype = FirstConnectedStrategy.prototype;

  prototype.isSupported = function() {
    return this.strategy.isSupported();
  };

  prototype.connect = function(minPriority, callback) {
    var runner = this.strategy.connect(
      minPriority,
      function(error, handshake) {
        if (handshake) {
          runner.abort();
        }
        callback(error, handshake);
      }
    );
    return runner;
  };

  Pusher.FirstConnectedStrategy = FirstConnectedStrategy;
}).call(this);

;(function() {
  /** Proxies method calls to one of substrategies basing on the test function.
   *
   * @param {Function} test
   * @param {Strategy} trueBranch strategy used when test returns true
   * @param {Strategy} falseBranch strategy used when test returns false
   */
  function IfStrategy(test, trueBranch, falseBranch) {
    this.test = test;
    this.trueBranch = trueBranch;
    this.falseBranch = falseBranch;
  }
  var prototype = IfStrategy.prototype;

  prototype.isSupported = function() {
    var branch = this.test() ? this.trueBranch : this.falseBranch;
    return branch.isSupported();
  };

  prototype.connect = function(minPriority, callback) {
    var branch = this.test() ? this.trueBranch : this.falseBranch;
    return branch.connect(minPriority, callback);
  };

  Pusher.IfStrategy = IfStrategy;
}).call(this);

;(function() {
  /** Loops through strategies with optional timeouts.
   *
   * Options:
   * - loop - whether it should loop through the substrategy list
   * - timeout - initial timeout for a single substrategy
   * - timeoutLimit - maximum timeout
   *
   * @param {Strategy[]} strategies
   * @param {Object} options
   */
  function SequentialStrategy(strategies, options) {
    this.strategies = strategies;
    this.loop = Boolean(options.loop);
    this.failFast = Boolean(options.failFast);
    this.timeout = options.timeout;
    this.timeoutLimit = options.timeoutLimit;
  }
  var prototype = SequentialStrategy.prototype;

  prototype.isSupported = function() {
    return Pusher.Util.any(this.strategies, Pusher.Util.method("isSupported"));
  };

  prototype.connect = function(minPriority, callback) {
    var self = this;

    var strategies = this.strategies;
    var current = 0;
    var timeout = this.timeout;
    var runner = null;

    var tryNextStrategy = function(error, handshake) {
      if (handshake) {
        callback(null, handshake);
      } else {
        current = current + 1;
        if (self.loop) {
          current = current % strategies.length;
        }

        if (current < strategies.length) {
          if (timeout) {
            timeout = timeout * 2;
            if (self.timeoutLimit) {
              timeout = Math.min(timeout, self.timeoutLimit);
            }
          }
          runner = self.tryStrategy(
            strategies[current],
            minPriority,
            { timeout: timeout, failFast: self.failFast },
            tryNextStrategy
          );
        } else {
          callback(true);
        }
      }
    };

    runner = this.tryStrategy(
      strategies[current],
      minPriority,
      { timeout: timeout, failFast: this.failFast },
      tryNextStrategy
    );

    return {
      abort: function() {
        runner.abort();
      },
      forceMinPriority: function(p) {
        minPriority = p;
        if (runner) {
          runner.forceMinPriority(p);
        }
      }
    };
  };

  /** @private */
  prototype.tryStrategy = function(strategy, minPriority, options, callback) {
    var timer = null;
    var runner = null;

    if (options.timeout > 0) {
      timer = new Pusher.Timer(options.timeout, function() {
        runner.abort();
        callback(true);
      });
    }

    runner = strategy.connect(minPriority, function(error, handshake) {
      if (error && timer && timer.isRunning() && !options.failFast) {
        // advance to the next strategy after the timeout
        return;
      }
      if (timer) {
        timer.ensureAborted();
      }
      callback(error, handshake);
    });

    return {
      abort: function() {
        if (timer) {
          timer.ensureAborted();
        }
        runner.abort();
      },
      forceMinPriority: function(p) {
        runner.forceMinPriority(p);
      }
    };
  };

  Pusher.SequentialStrategy = SequentialStrategy;
}).call(this);

;(function() {
  /** Provides a strategy interface for transports.
   *
   * @param {String} name
   * @param {Number} priority
   * @param {Class} transport
   * @param {Object} options
   */
  function TransportStrategy(name, priority, transport, options) {
    this.name = name;
    this.priority = priority;
    this.transport = transport;
    this.options = options || {};
  }
  var prototype = TransportStrategy.prototype;

  /** Returns whether the transport is supported in the browser.
   *
   * @returns {Boolean}
   */
  prototype.isSupported = function() {
    return this.transport.isSupported({
      encrypted: this.options.encrypted
    });
  };

  /** Launches a connection attempt and returns a strategy runner.
   *
   * @param  {Function} callback
   * @return {Object} strategy runner
   */
  prototype.connect = function(minPriority, callback) {
    if (!this.isSupported()) {
      return failAttempt(new Pusher.Errors.UnsupportedStrategy(), callback);
    } else if (this.priority < minPriority) {
      return failAttempt(new Pusher.Errors.TransportPriorityTooLow(), callback);
    }

    var self = this;
    var connected = false;

    var transport = this.transport.createConnection(
      this.name, this.priority, this.options.key, this.options
    );
    var handshake = null;

    var onInitialized = function() {
      transport.unbind("initialized", onInitialized);
      transport.connect();
    };
    var onOpen = function() {
      handshake = new Pusher.Handshake(transport, function(result) {
        connected = true;
        unbindListeners();
        callback(null, result);
      });
    };
    var onError = function(error) {
      unbindListeners();
      callback(error);
    };
    var onClosed = function() {
      unbindListeners();
      callback(new Pusher.Errors.TransportClosed(transport));
    };

    var unbindListeners = function() {
      transport.unbind("initialized", onInitialized);
      transport.unbind("open", onOpen);
      transport.unbind("error", onError);
      transport.unbind("closed", onClosed);
    };

    transport.bind("initialized", onInitialized);
    transport.bind("open", onOpen);
    transport.bind("error", onError);
    transport.bind("closed", onClosed);

    // connect will be called automatically after initialization
    transport.initialize();

    return {
      abort: function() {
        if (connected) {
          return;
        }
        unbindListeners();
        if (handshake) {
          handshake.close();
        } else {
          transport.close();
        }
      },
      forceMinPriority: function(p) {
        if (connected) {
          return;
        }
        if (self.priority < p) {
          if (handshake) {
            handshake.close();
          } else {
            transport.close();
          }
        }
      }
    };
  };

  function failAttempt(error, callback) {
    Pusher.Util.defer(function() {
      callback(error);
    });
    return {
      abort: function() {},
      forceMinPriority: function() {}
    };
  }

  Pusher.TransportStrategy = TransportStrategy;
}).call(this);

(function() {
  function getGenericURL(baseScheme, params, path) {
    var scheme = baseScheme + (params.encrypted ? "s" : "");
    var host = params.encrypted ? params.hostEncrypted : params.hostUnencrypted;
    return scheme + "://" + host + path;
  }

  function getGenericPath(key, queryString) {
    var path = "/app/" + key;
    var query =
      "?protocol=" + Pusher.PROTOCOL +
      "&client=js" +
      "&version=" + Pusher.VERSION +
      (queryString ? ("&" + queryString) : "");
    return path + query;
  }

  /** URL schemes for different transport types. */
  Pusher.URLSchemes = {
    /** Standard WebSocket URL scheme. */
    ws: {
      getInitial: function(key, params) {
        return getGenericURL("ws", params, getGenericPath(key, "flash=false"));
      }
    },
    /** URL scheme for Flash. Same as WebSocket, but with a flash parameter. */
    flash: {
      getInitial: function(key, params) {
        return getGenericURL("ws", params, getGenericPath(key, "flash=true"));
      }
    },
    /** SockJS URL scheme. Supplies the path separately from the initial URL. */
    sockjs: {
      getInitial: function(key, params) {
        return getGenericURL("http", params, params.httpPath || "/pusher", "");
      },
      getPath: function(key, params) {
        return getGenericPath(key);
      }
    },
    /** URL scheme for HTTP transports. Basically, WS scheme with a prefix. */
    http: {
      getInitial: function(key, params) {
        var path = (params.httpPath || "/pusher") + getGenericPath(key);
        return getGenericURL("http", params, path);
      }
    }
  };
}).call(this);

(function() {
  /** Provides universal API for transport connections.
   *
   * Transport connection is a low-level object that wraps a connection method
   * and exposes a simple evented interface for the connection state and
   * messaging. It does not implement Pusher-specific WebSocket protocol.
   *
   * Additionally, it fetches resources needed for transport to work and exposes
   * an interface for querying transport features.
   *
   * States:
   * - new - initial state after constructing the object
   * - initializing - during initialization phase, usually fetching resources
   * - intialized - ready to establish a connection
   * - connection - when connection is being established
   * - open - when connection ready to be used
   * - closed - after connection was closed be either side
   *
   * Emits:
   * - error - after the connection raised an error
   *
   * Options:
   * - encrypted - whether connection should use ssl
   * - hostEncrypted - host to connect to when connection is encrypted
   * - hostUnencrypted - host to connect to when connection is not encrypted
   *
   * @param {String} key application key
   * @param {Object} options
   */
  function TransportConnection(hooks, name, priority, key, options) {
    Pusher.EventsDispatcher.call(this);

    this.hooks = hooks;
    this.name = name;
    this.priority = priority;
    this.key = key;
    this.options = options;

    this.state = "new";
    this.timeline = options.timeline;
    this.activityTimeout = options.activityTimeout;
    this.id = this.timeline.generateUniqueID();
  }
  var prototype = TransportConnection.prototype;
  Pusher.Util.extend(prototype, Pusher.EventsDispatcher.prototype);

  /** Checks whether the transport handles activity checks by itself.
   *
   * @return {Boolean}
   */
  prototype.handlesActivityChecks = function() {
    return Boolean(this.hooks.handlesActivityChecks);
  };

  /** Checks whether the transport supports the ping/pong API.
   *
   * @return {Boolean}
   */
  prototype.supportsPing = function() {
    return Boolean(this.hooks.supportsPing);
  };

  /** Initializes the transport.
   *
   * Fetches resources if needed and then transitions to initialized.
   */
  prototype.initialize = function() {
    var self = this;

    self.timeline.info(self.buildTimelineMessage({
      transport: self.name + (self.options.encrypted ? "s" : "")
    }));

    if (self.hooks.beforeInitialize) {
      self.hooks.beforeInitialize.call(self);
    }

    if (self.hooks.isInitialized()) {
      self.changeState("initialized");
    } else if (self.hooks.file) {
      self.changeState("initializing");
      Pusher.Dependencies.load(
        self.hooks.file,
        { encrypted: self.options.encrypted },
        function(error, callback) {
          if (self.hooks.isInitialized()) {
            self.changeState("initialized");
            callback(true);
          } else {
            if (error) {
              self.onError(error);
            }
            self.onClose();
            callback(false);
          }
        }
      );
    } else {
      self.onClose();
    }
  };

  /** Tries to establish a connection.
   *
   * @returns {Boolean} false if transport is in invalid state
   */
  prototype.connect = function() {
    var self = this;

    if (self.socket || self.state !== "initialized") {
      return false;
    }

    var url = self.hooks.urls.getInitial(self.key, self.options);
    try {
      self.socket = self.hooks.getSocket(url, self.options);
    } catch (e) {
      Pusher.Util.defer(function() {
        self.onError(e);
        self.changeState("closed");
      });
      return false;
    }

    self.bindListeners();

    Pusher.debug("Connecting", { transport: self.name, url: url });
    self.changeState("connecting");
    return true;
  };

  /** Closes the connection.
   *
   * @return {Boolean} true if there was a connection to close
   */
  prototype.close = function() {
    if (this.socket) {
      this.socket.close();
      return true;
    } else {
      return false;
    }
  };

  /** Sends data over the open connection.
   *
   * @param {String} data
   * @return {Boolean} true only when in the "open" state
   */
  prototype.send = function(data) {
    var self = this;

    if (self.state === "open") {
      // Workaround for MobileSafari bug (see https://gist.github.com/2052006)
      Pusher.Util.defer(function() {
        if (self.socket) {
          self.socket.send(data);
        }
      });
      return true;
    } else {
      return false;
    }
  };

  /** Sends a ping if the connection is open and transport supports it. */
  prototype.ping = function() {
    if (this.state === "open" && this.supportsPing()) {
      this.socket.ping();
    }
  };

  /** @private */
  prototype.onOpen = function() {
    if (this.hooks.beforeOpen) {
      this.hooks.beforeOpen(
        this.socket, this.hooks.urls.getPath(this.key, this.options)
      );
    }
    this.changeState("open");
    this.socket.onopen = undefined;
  };

  /** @private */
  prototype.onError = function(error) {
    this.emit("error", { type: 'WebSocketError', error: error });
    this.timeline.error(this.buildTimelineMessage({ error: error.toString() }));
  };

  /** @private */
  prototype.onClose = function(closeEvent) {
    if (closeEvent) {
      this.changeState("closed", {
        code: closeEvent.code,
        reason: closeEvent.reason,
        wasClean: closeEvent.wasClean
      });
    } else {
      this.changeState("closed");
    }
    this.unbindListeners();
    this.socket = undefined;
  };

  /** @private */
  prototype.onMessage = function(message) {
    this.emit("message", message);
  };

  /** @private */
  prototype.onActivity = function() {
    this.emit("activity");
  };

  /** @private */
  prototype.bindListeners = function() {
    var self = this;

    self.socket.onopen = function() {
      self.onOpen();
    };
    self.socket.onerror = function(error) {
      self.onError(error);
    };
    self.socket.onclose = function(closeEvent) {
      self.onClose(closeEvent);
    };
    self.socket.onmessage = function(message) {
      self.onMessage(message);
    };

    if (self.supportsPing()) {
      self.socket.onactivity = function() { self.onActivity(); };
    }
  };

  /** @private */
  prototype.unbindListeners = function() {
    if (this.socket) {
      this.socket.onopen = undefined;
      this.socket.onerror = undefined;
      this.socket.onclose = undefined;
      this.socket.onmessage = undefined;
      if (this.supportsPing()) {
        this.socket.onactivity = undefined;
      }
    }
  };

  /** @private */
  prototype.changeState = function(state, params) {
    this.state = state;
    this.timeline.info(this.buildTimelineMessage({
      state: state,
      params: params
    }));
    this.emit(state, params);
  };

  /** @private */
  prototype.buildTimelineMessage = function(message) {
    return Pusher.Util.extend({ cid: this.id }, message);
  };

  Pusher.TransportConnection = TransportConnection;
}).call(this);

(function() {
  /** Provides interface for transport connection instantiation.
   *
   * Takes transport-specific hooks as the only argument, which allow checking
   * for transport support and creating its connections.
   *
   * Supported hooks:
   * - file - the name of the file to be fetched during initialization
   * - urls - URL scheme to be used by transport
   * - handlesActivityCheck - true when the transport handles activity checks
   * - supportsPing - true when the transport has a ping/activity API
   * - isSupported - tells whether the transport is supported in the environment
   * - getSocket - creates a WebSocket-compatible transport socket
   *
   * See transports.js for specific implementations.
   *
   * @param {Object} hooks object containing all needed transport hooks
   */
  function Transport(hooks) {
    this.hooks = hooks;
  }
  var prototype = Transport.prototype;

  /** Returns whether the transport is supported in the environment.
   *
   * @param {Object} environment the environment details (encryption, settings)
   * @returns {Boolean} true when the transport is supported
   */
  prototype.isSupported = function(environment) {
    return this.hooks.isSupported(environment);
  };

  /** Creates a transport connection.
   *
   * @param {String} name
   * @param {Number} priority
   * @param {String} key the application key
   * @param {Object} options
   * @returns {TransportConnection}
   */
  prototype.createConnection = function(name, priority, key, options) {
    return new Pusher.TransportConnection(
      this.hooks, name, priority, key, options
    );
  };

  Pusher.Transport = Transport;
}).call(this);

(function() {
  /** WebSocket transport.
   *
   * Uses native WebSocket implementation, including MozWebSocket supported by
   * earlier Firefox versions.
   */
  Pusher.WSTransport = new Pusher.Transport({
    urls: Pusher.URLSchemes.ws,
    handlesActivityChecks: false,
    supportsPing: false,

    isInitialized: function() {
      return Boolean(window.WebSocket || window.MozWebSocket);
    },
    isSupported: function() {
      return Boolean(window.WebSocket || window.MozWebSocket);
    },
    getSocket: function(url) {
      var Constructor = window.WebSocket || window.MozWebSocket;
      return new Constructor(url);
    }
  });

  /** Flash transport using the WebSocket protocol. */
  Pusher.FlashTransport = new Pusher.Transport({
    file: "flashfallback",
    urls: Pusher.URLSchemes.flash,
    handlesActivityChecks: false,
    supportsPing: false,

    isSupported: function() {
      try {
        return Boolean(new ActiveXObject('ShockwaveFlash.ShockwaveFlash'));
      } catch (e1) {
        try {
          var nav = Pusher.Util.getNavigator();
          return Boolean(
            nav &&
            nav.mimeTypes &&
            nav.mimeTypes["application/x-shockwave-flash"] !== undefined
          );
        } catch (e2) {
          return false;
        }
      }
    },
    beforeInitialize: function() {
      if (window.WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR === undefined) {
        window.WEB_SOCKET_SUPPRESS_CROSS_DOMAIN_SWF_ERROR = true;
      }
      window.WEB_SOCKET_SWF_LOCATION =
        Pusher.Dependencies.getRoot({ encrypted: this.options.encrypted }) +
        "/WebSocketMain.swf";
    },
    isInitialized: function() {
      return window.FlashWebSocket !== undefined;
    },
    getSocket: function(url) {
      return new FlashWebSocket(url);
    }
  });

  /** SockJS transport. */
  Pusher.SockJSTransport = new Pusher.Transport({
    file: "sockjs",
    urls: Pusher.URLSchemes.sockjs,
    handlesActivityChecks: true,
    supportsPing: false,

    isSupported: function() {
      return true;
    },
    isInitialized: function() {
      return window.SockJS !== undefined;
    },
    getSocket: function(url, options) {
      return new SockJS(url, null, {
        js_path: Pusher.Dependencies.getPath("sockjs", {
          encrypted: options.encrypted
        }),
        ignore_null_origin: options.ignoreNullOrigin
      });
    },
    beforeOpen: function(socket, path) {
      socket.send(JSON.stringify({
        path: path
      }));
    }
  });

  var httpConfiguration = {
    urls: Pusher.URLSchemes.http,
    handlesActivityChecks: false,
    supportsPing: true,
    isInitialized: function() {
      return Boolean(Pusher.HTTP.Socket);
    }
  };

  var streamingConfiguration = Pusher.Util.extend(
    { getSocket: function(url) {
        return Pusher.HTTP.getStreamingSocket(url);
      }
    },
    httpConfiguration
  );
  var pollingConfiguration = Pusher.Util.extend(
    { getSocket: function(url) {
        return Pusher.HTTP.getPollingSocket(url);
      }
    },
    httpConfiguration
  );

  var xhrConfiguration = {
    file: "xhr",
    isSupported: Pusher.Util.isXHRSupported
  };
  var xdrConfiguration = {
    file: "xdr",
    isSupported: function(environment) {
      return Pusher.Util.isXDRSupported(environment.encrypted);
    }
  };

  /** HTTP streaming transport using CORS-enabled XMLHttpRequest. */
  Pusher.XHRStreamingTransport = new Pusher.Transport(
    Pusher.Util.extend({}, streamingConfiguration, xhrConfiguration)
  );
  /** HTTP streaming transport using XDomainRequest (IE 8,9). */
  Pusher.XDRStreamingTransport = new Pusher.Transport(
    Pusher.Util.extend({}, streamingConfiguration, xdrConfiguration)
  );
  /** HTTP long-polling transport using CORS-enabled XMLHttpRequest. */
  Pusher.XHRPollingTransport = new Pusher.Transport(
    Pusher.Util.extend({}, pollingConfiguration, xhrConfiguration)
  );
  /** HTTP long-polling transport using XDomainRequest (IE 8,9). */
  Pusher.XDRPollingTransport = new Pusher.Transport(
    Pusher.Util.extend({}, pollingConfiguration, xdrConfiguration)
  );
}).call(this);

;(function() {
  /** Creates transport connections monitored by a transport manager.
   *
   * When a transport is closed, it might mean the environment does not support
   * it. It's possible that messages get stuck in an intermediate buffer or
   * proxies terminate inactive connections. To combat these problems,
   * assistants monitor the connection lifetime, report unclean exits and
   * adjust ping timeouts to keep the connection active. The decision to disable
   * a transport is the manager's responsibility.
   *
   * @param {TransportManager} manager
   * @param {TransportConnection} transport
   * @param {Object} options
   */
  function AssistantToTheTransportManager(manager, transport, options) {
    this.manager = manager;
    this.transport = transport;
    this.minPingDelay = options.minPingDelay;
    this.maxPingDelay = options.maxPingDelay;
    this.pingDelay = undefined;
  }
  var prototype = AssistantToTheTransportManager.prototype;

  /** Creates a transport connection.
   *
   * This function has the same API as Transport#createConnection.
   *
   * @param {String} name
   * @param {Number} priority
   * @param {String} key the application key
   * @param {Object} options
   * @returns {TransportConnection}
   */
  prototype.createConnection = function(name, priority, key, options) {
    var self = this;

    options = Pusher.Util.extend({}, options, {
      activityTimeout: self.pingDelay
    });
    var connection = self.transport.createConnection(
      name, priority, key, options
    );

    var openTimestamp = null;

    var onOpen = function() {
      connection.unbind("open", onOpen);
      connection.bind("closed", onClosed);
      openTimestamp = Pusher.Util.now();
    };
    var onClosed = function(closeEvent) {
      connection.unbind("closed", onClosed);

      if (closeEvent.code === 1002 || closeEvent.code === 1003) {
        // we don't want to use transports not obeying the protocol
        self.manager.reportDeath();
      } else if (!closeEvent.wasClean && openTimestamp) {
        // report deaths only for short-living transport
        var lifespan = Pusher.Util.now() - openTimestamp;
        if (lifespan < 2 * self.maxPingDelay) {
          self.manager.reportDeath();
          self.pingDelay = Math.max(lifespan / 2, self.minPingDelay);
        }
      }
    };

    connection.bind("open", onOpen);
    return connection;
  };

  /** Returns whether the transport is supported in the environment.
   *
   * This function has the same API as Transport#isSupported. Might return false
   * when the manager decides to kill the transport.
   *
   * @param {Object} environment the environment details (encryption, settings)
   * @returns {Boolean} true when the transport is supported
   */
  prototype.isSupported = function(environment) {
    return this.manager.isAlive() && this.transport.isSupported(environment);
  };

  Pusher.AssistantToTheTransportManager = AssistantToTheTransportManager;
}).call(this);

;(function() {
  /** Keeps track of the number of lives left for a transport.
   *
   * In the beginning of a session, transports may be assigned a number of
   * lives. When an AssistantToTheTransportManager instance reports a transport
   * connection closed uncleanly, the transport loses a life. When the number
   * of lives drops to zero, the transport gets disabled by its manager.
   *
   * @param {Object} options
   */
  function TransportManager(options) {
    this.options = options || {};
    this.livesLeft = this.options.lives || Infinity;
  }
  var prototype = TransportManager.prototype;

  /** Creates a assistant for the transport.
   *
   * @param {Transport} transport
   * @returns {AssistantToTheTransportManager}
   */
  prototype.getAssistant = function(transport) {
    return new Pusher.AssistantToTheTransportManager(this, transport, {
      minPingDelay: this.options.minPingDelay,
      maxPingDelay: this.options.maxPingDelay
    });
  };

  /** Returns whether the transport has any lives left.
   *
   * @returns {Boolean}
   */
  prototype.isAlive = function() {
    return this.livesLeft > 0;
  };

  /** Takes one life from the transport. */
  prototype.reportDeath = function() {
    this.livesLeft -= 1;
  };

  Pusher.TransportManager = TransportManager;
}).call(this);

;(function() {
  var StrategyBuilder = {
    /** Transforms a JSON scheme to a strategy tree.
     *
     * @param {Array} scheme JSON strategy scheme
     * @param {Object} options a hash of symbols to be included in the scheme
     * @returns {Strategy} strategy tree that's represented by the scheme
     */
    build: function(scheme, options) {
      var context = Pusher.Util.extend({}, globalContext, options);
      return evaluate(scheme, context)[1].strategy;
    }
  };

  var transports = {
    ws: Pusher.WSTransport,
    flash: Pusher.FlashTransport,
    sockjs: Pusher.SockJSTransport,
    xhr_streaming: Pusher.XHRStreamingTransport,
    xdr_streaming: Pusher.XDRStreamingTransport,
    xhr_polling: Pusher.XHRPollingTransport,
    xdr_polling: Pusher.XDRPollingTransport
  };

  var UnsupportedStrategy = {
    isSupported: function() {
      return false;
    },
    connect: function(_, callback) {
      var deferred = Pusher.Util.defer(function() {
        callback(new Pusher.Errors.UnsupportedStrategy());
      });
      return {
        abort: function() {
          deferred.ensureAborted();
        },
        forceMinPriority: function() {}
      };
    }
  };

  // DSL bindings

  function returnWithOriginalContext(f) {
    return function(context) {
      return [f.apply(this, arguments), context];
    };
  }

  var globalContext = {
    extend: function(context, first, second) {
      return [Pusher.Util.extend({}, first, second), context];
    },

    def: function(context, name, value) {
      if (context[name] !== undefined) {
        throw "Redefining symbol " + name;
      }
      context[name] = value;
      return [undefined, context];
    },

    def_transport: function(context, name, type, priority, options, manager) {
      var transportClass = transports[type];
      if (!transportClass) {
        throw new Pusher.Errors.UnsupportedTransport(type);
      }

      var enabled =
        (!context.enabledTransports ||
          Pusher.Util.arrayIndexOf(context.enabledTransports, name) !== -1) &&
        (!context.disabledTransports ||
          Pusher.Util.arrayIndexOf(context.disabledTransports, name) === -1) &&
        (name !== "flash" || context.disableFlash !== true);

      var transport;
      if (enabled) {
        transport = new Pusher.TransportStrategy(
          name,
          priority,
          manager ? manager.getAssistant(transportClass) : transportClass,
          Pusher.Util.extend({
            key: context.key,
            encrypted: context.encrypted,
            timeline: context.timeline,
            ignoreNullOrigin: context.ignoreNullOrigin
          }, options)
        );
      } else {
        transport = UnsupportedStrategy;
      }

      var newContext = context.def(context, name, transport)[1];
      newContext.transports = context.transports || {};
      newContext.transports[name] = transport;
      return [undefined, newContext];
    },

    transport_manager: returnWithOriginalContext(function(_, options) {
      return new Pusher.TransportManager(options);
    }),

    sequential: returnWithOriginalContext(function(_, options) {
      var strategies = Array.prototype.slice.call(arguments, 2);
      return new Pusher.SequentialStrategy(strategies, options);
    }),

    cached: returnWithOriginalContext(function(context, ttl, strategy){
      return new Pusher.CachedStrategy(strategy, context.transports, {
        ttl: ttl,
        timeline: context.timeline,
        encrypted: context.encrypted
      });
    }),

    first_connected: returnWithOriginalContext(function(_, strategy) {
      return new Pusher.FirstConnectedStrategy(strategy);
    }),

    best_connected_ever: returnWithOriginalContext(function() {
      var strategies = Array.prototype.slice.call(arguments, 1);
      return new Pusher.BestConnectedEverStrategy(strategies);
    }),

    delayed: returnWithOriginalContext(function(_, delay, strategy) {
      return new Pusher.DelayedStrategy(strategy, { delay: delay });
    }),

    "if": returnWithOriginalContext(function(_, test, trueBranch, falseBranch) {
      return new Pusher.IfStrategy(test, trueBranch, falseBranch);
    }),

    is_supported: returnWithOriginalContext(function(_, strategy) {
      return function() {
        return strategy.isSupported();
      };
    })
  };

  // DSL interpreter

  function isSymbol(expression) {
    return (typeof expression === "string") && expression.charAt(0) === ":";
  }

  function getSymbolValue(expression, context) {
    return context[expression.slice(1)];
  }

  function evaluateListOfExpressions(expressions, context) {
    if (expressions.length === 0) {
      return [[], context];
    }
    var head = evaluate(expressions[0], context);
    var tail = evaluateListOfExpressions(expressions.slice(1), head[1]);
    return [[head[0]].concat(tail[0]), tail[1]];
  }

  function evaluateString(expression, context) {
    if (!isSymbol(expression)) {
      return [expression, context];
    }
    var value = getSymbolValue(expression, context);
    if (value === undefined) {
      throw "Undefined symbol " + expression;
    }
    return [value, context];
  }

  function evaluateArray(expression, context) {
    if (isSymbol(expression[0])) {
      var f = getSymbolValue(expression[0], context);
      if (expression.length > 1) {
        if (typeof f !== "function") {
          throw "Calling non-function " + expression[0];
        }
        var args = [Pusher.Util.extend({}, context)].concat(
          Pusher.Util.map(expression.slice(1), function(arg) {
            return evaluate(arg, Pusher.Util.extend({}, context))[0];
          })
        );
        return f.apply(this, args);
      } else {
        return [f, context];
      }
    } else {
      return evaluateListOfExpressions(expression, context);
    }
  }

  function evaluate(expression, context) {
    var expressionType = typeof expression;
    if (typeof expression === "string") {
      return evaluateString(expression, context);
    } else if (typeof expression === "object") {
      if (expression instanceof Array && expression.length > 0) {
        return evaluateArray(expression, context);
      }
    }
    return [expression, context];
  }

  Pusher.StrategyBuilder = StrategyBuilder;
}).call(this);

;(function() {
  /**
   * Provides functions for handling Pusher protocol-specific messages.
   */
  var Protocol = {};

  /**
   * Decodes a message in a Pusher format.
   *
   * Throws errors when messages are not parse'able.
   *
   * @param  {Object} message
   * @return {Object}
   */
  Protocol.decodeMessage = function(message) {
    try {
      var params = JSON.parse(message.data);
      if (typeof params.data === 'string') {
        try {
          params.data = JSON.parse(params.data);
        } catch (e) {
          if (!(e instanceof SyntaxError)) {
            // TODO looks like unreachable code
            // https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/JSON/parse
            throw e;
          }
        }
      }
      return params;
    } catch (e) {
      throw { type: 'MessageParseError', error: e, data: message.data};
    }
  };

  /**
   * Encodes a message to be sent.
   *
   * @param  {Object} message
   * @return {String}
   */
  Protocol.encodeMessage = function(message) {
    return JSON.stringify(message);
  };

  /** Processes a handshake message and returns appropriate actions.
   *
   * Returns an object with an 'action' and other action-specific properties.
   *
   * There are three outcomes when calling this function. First is a successful
   * connection attempt, when pusher:connection_established is received, which
   * results in a 'connected' action with an 'id' property. When passed a
   * pusher:error event, it returns a result with action appropriate to the
   * close code and an error. Otherwise, it raises an exception.
   *
   * @param {String} message
   * @result Object
   */
  Protocol.processHandshake = function(message) {
    message = this.decodeMessage(message);

    if (message.event === "pusher:connection_established") {
      if (!message.data.activity_timeout) {
        throw "No activity timeout specified in handshake";
      }
      return {
        action: "connected",
        id: message.data.socket_id,
        activityTimeout: message.data.activity_timeout * 1000
      };
    } else if (message.event === "pusher:error") {
      // From protocol 6 close codes are sent only once, so this only
      // happens when connection does not support close codes
      return {
        action: this.getCloseAction(message.data),
        error: this.getCloseError(message.data)
      };
    } else {
      throw "Invalid handshake";
    }
  };

  /**
   * Dispatches the close event and returns an appropriate action name.
   *
   * See:
   * 1. https://developer.mozilla.org/en-US/docs/WebSockets/WebSockets_reference/CloseEvent
   * 2. http://pusher.com/docs/pusher_protocol
   *
   * @param  {CloseEvent} closeEvent
   * @return {String} close action name
   */
  Protocol.getCloseAction = function(closeEvent) {
    if (closeEvent.code < 4000) {
      // ignore 1000 CLOSE_NORMAL, 1001 CLOSE_GOING_AWAY,
      //        1005 CLOSE_NO_STATUS, 1006 CLOSE_ABNORMAL
      // ignore 1007...3999
      // handle 1002 CLOSE_PROTOCOL_ERROR, 1003 CLOSE_UNSUPPORTED,
      //        1004 CLOSE_TOO_LARGE
      if (closeEvent.code >= 1002 && closeEvent.code <= 1004) {
        return "backoff";
      } else {
        return null;
      }
    } else if (closeEvent.code === 4000) {
      return "ssl_only";
    } else if (closeEvent.code < 4100) {
      return "refused";
    } else if (closeEvent.code < 4200) {
      return "backoff";
    } else if (closeEvent.code < 4300) {
      return "retry";
    } else {
      // unknown error
      return "refused";
    }
  };

  /**
   * Returns an error or null basing on the close event.
   *
   * Null is returned when connection was closed cleanly. Otherwise, an object
   * with error details is returned.
   *
   * @param  {CloseEvent} closeEvent
   * @return {Object} error object
   */
  Protocol.getCloseError = function(closeEvent) {
    if (closeEvent.code !== 1000 && closeEvent.code !== 1001) {
      return {
        type: 'PusherError',
        data: {
          code: closeEvent.code,
          message: closeEvent.reason || closeEvent.message
        }
      };
    } else {
      return null;
    }
  };

  Pusher.Protocol = Protocol;
}).call(this);

;(function() {
  /**
   * Provides Pusher protocol interface for transports.
   *
   * Emits following events:
   * - message - on received messages
   * - ping - on ping requests
   * - pong - on pong responses
   * - error - when the transport emits an error
   * - closed - after closing the transport
   *
   * It also emits more events when connection closes with a code.
   * See Protocol.getCloseAction to get more details.
   *
   * @param {Number} id
   * @param {AbstractTransport} transport
   */
  function Connection(id, transport) {
    Pusher.EventsDispatcher.call(this);

    this.id = id;
    this.transport = transport;
    this.activityTimeout = transport.activityTimeout;
    this.bindListeners();
  }
  var prototype = Connection.prototype;
  Pusher.Util.extend(prototype, Pusher.EventsDispatcher.prototype);

  /** Returns whether used transport handles activity checks by itself
   *
   * @returns {Boolean} true if activity checks are handled by the transport
   */
  prototype.handlesActivityChecks = function() {
    return this.transport.handlesActivityChecks();
  };

  /** Sends raw data.
   *
   * @param {String} data
   */
  prototype.send = function(data) {
    return this.transport.send(data);
  };

  /** Sends an event.
   *
   * @param {String} name
   * @param {String} data
   * @param {String} [channel]
   * @returns {Boolean} whether message was sent or not
   */
  prototype.send_event = function(name, data, channel) {
    var message = { event: name, data: data };
    if (channel) {
      message.channel = channel;
    }
    Pusher.debug('Event sent', message);
    return this.send(Pusher.Protocol.encodeMessage(message));
  };

  /** Sends a ping message to the server.
   *
   * Basing on the underlying transport, it might send either transport's
   * protocol-specific ping or pusher:ping event.
   */
  prototype.ping = function() {
    if (this.transport.supportsPing()) {
      this.transport.ping();
    } else {
      this.send_event('pusher:ping', {});
    }
  };

  /** Closes the connection. */
  prototype.close = function() {
    this.transport.close();
  };

  /** @private */
  prototype.bindListeners = function() {
    var self = this;

    var listeners = {
      message: function(m) {
        var message;
        try {
          message = Pusher.Protocol.decodeMessage(m);
        } catch(e) {
          self.emit('error', {
            type: 'MessageParseError',
            error: e,
            data: m.data
          });
        }

        if (message !== undefined) {
          Pusher.debug('Event recd', message);

          switch (message.event) {
            case 'pusher:error':
              self.emit('error', { type: 'PusherError', data: message.data });
              break;
            case 'pusher:ping':
              self.emit("ping");
              break;
            case 'pusher:pong':
              self.emit("pong");
              break;
          }
          self.emit('message', message);
        }
      },
      activity: function() {
        self.emit("activity");
      },
      error: function(error) {
        self.emit("error", { type: "WebSocketError", error: error });
      },
      closed: function(closeEvent) {
        unbindListeners();

        if (closeEvent && closeEvent.code) {
          self.handleCloseEvent(closeEvent);
        }

        self.transport = null;
        self.emit("closed");
      }
    };

    var unbindListeners = function() {
      Pusher.Util.objectApply(listeners, function(listener, event) {
        self.transport.unbind(event, listener);
      });
    };

    Pusher.Util.objectApply(listeners, function(listener, event) {
      self.transport.bind(event, listener);
    });
  };

  /** @private */
  prototype.handleCloseEvent = function(closeEvent) {
    var action = Pusher.Protocol.getCloseAction(closeEvent);
    var error = Pusher.Protocol.getCloseError(closeEvent);
    if (error) {
      this.emit('error', error);
    }
    if (action) {
      this.emit(action);
    }
  };

  Pusher.Connection = Connection;
}).call(this);

;(function() {
  /**
   * Handles Pusher protocol handshakes for transports.
   *
   * Calls back with a result object after handshake is completed. Results
   * always have two fields:
   * - action - string describing action to be taken after the handshake
   * - transport - the transport object passed to the constructor
   *
   * Different actions can set different additional properties on the result.
   * In the case of 'connected' action, there will be a 'connection' property
   * containing a Connection object for the transport. Other actions should
   * carry an 'error' property.
   *
   * @param {AbstractTransport} transport
   * @param {Function} callback
   */
  function Handshake(transport, callback) {
    this.transport = transport;
    this.callback = callback;
    this.bindListeners();
  }
  var prototype = Handshake.prototype;

  prototype.close = function() {
    this.unbindListeners();
    this.transport.close();
  };

  /** @private */
  prototype.bindListeners = function() {
    var self = this;

    self.onMessage = function(m) {
      self.unbindListeners();

      try {
        var result = Pusher.Protocol.processHandshake(m);
        if (result.action === "connected") {
          self.finish("connected", {
            connection: new Pusher.Connection(result.id, self.transport),
            activityTimeout: result.activityTimeout
          });
        } else {
          self.finish(result.action, { error: result.error });
          self.transport.close();
        }
      } catch (e) {
        self.finish("error", { error: e });
        self.transport.close();
      }
    };

    self.onClosed = function(closeEvent) {
      self.unbindListeners();

      var action = Pusher.Protocol.getCloseAction(closeEvent) || "backoff";
      var error = Pusher.Protocol.getCloseError(closeEvent);
      self.finish(action, { error: error });
    };

    self.transport.bind("message", self.onMessage);
    self.transport.bind("closed", self.onClosed);
  };

  /** @private */
  prototype.unbindListeners = function() {
    this.transport.unbind("message", this.onMessage);
    this.transport.unbind("closed", this.onClosed);
  };

  /** @private */
  prototype.finish = function(action, params) {
    this.callback(
      Pusher.Util.extend({ transport: this.transport, action: action }, params)
    );
  };

  Pusher.Handshake = Handshake;
}).call(this);

;(function() {
  /** Manages connection to Pusher.
   *
   * Uses a strategy (currently only default), timers and network availability
   * info to establish a connection and export its state. In case of failures,
   * manages reconnection attempts.
   *
   * Exports state changes as following events:
   * - "state_change", { previous: p, current: state }
   * - state
   *
   * States:
   * - initialized - initial state, never transitioned to
   * - connecting - connection is being established
   * - connected - connection has been fully established
   * - disconnected - on requested disconnection
   * - unavailable - after connection timeout or when there's no network
   * - failed - when the connection strategy is not supported
   *
   * Options:
   * - unavailableTimeout - time to transition to unavailable state
   * - activityTimeout - time after which ping message should be sent
   * - pongTimeout - time for Pusher to respond with pong before reconnecting
   *
   * @param {String} key application key
   * @param {Object} options
   */
  function ConnectionManager(key, options) {
    Pusher.EventsDispatcher.call(this);

    this.key = key;
    this.options = options || {};
    this.state = "initialized";
    this.connection = null;
    this.encrypted = !!options.encrypted;
    this.timeline = this.options.timeline;

    this.connectionCallbacks = this.buildConnectionCallbacks();
    this.errorCallbacks = this.buildErrorCallbacks();
    this.handshakeCallbacks = this.buildHandshakeCallbacks(this.errorCallbacks);

    var self = this;

    Pusher.Network.bind("online", function() {
      self.timeline.info({ netinfo: "online" });
      if (self.state === "connecting" || self.state === "unavailable") {
        self.retryIn(0);
      }
    });
    Pusher.Network.bind("offline", function() {
      self.timeline.info({ netinfo: "offline" });
      if (self.connection) {
        self.sendActivityCheck();
      }
    });

    this.updateStrategy();
  }
  var prototype = ConnectionManager.prototype;

  Pusher.Util.extend(prototype, Pusher.EventsDispatcher.prototype);

  /** Establishes a connection to Pusher.
   *
   * Does nothing when connection is already established. See top-level doc
   * to find events emitted on connection attempts.
   */
  prototype.connect = function() {
    if (this.connection || this.runner) {
      return;
    }
    if (!this.strategy.isSupported()) {
      this.updateState("failed");
      return;
    }
    this.updateState("connecting");
    this.startConnecting();
    this.setUnavailableTimer();
  };

  /** Sends raw data.
   *
   * @param {String} data
   */
  prototype.send = function(data) {
    if (this.connection) {
      return this.connection.send(data);
    } else {
      return false;
    }
  };

  /** Sends an event.
   *
   * @param {String} name
   * @param {String} data
   * @param {String} [channel]
   * @returns {Boolean} whether message was sent or not
   */
  prototype.send_event = function(name, data, channel) {
    if (this.connection) {
      return this.connection.send_event(name, data, channel);
    } else {
      return false;
    }
  };

  /** Closes the connection. */
  prototype.disconnect = function() {
    this.disconnectInternally();
    this.updateState("disconnected");
  };

  prototype.isEncrypted = function() {
    return this.encrypted;
  };

  /** @private */
  prototype.startConnecting = function() {
    var self = this;
    var callback = function(error, handshake) {
      if (error) {
        self.runner = self.strategy.connect(0, callback);
      } else {
        if (handshake.action === "error") {
          self.emit("error", { type: "HandshakeError", error: handshake.error });
          self.timeline.error({ handshakeError: handshake.error });
        } else {
          self.abortConnecting(); // we don't support switching connections yet
          self.handshakeCallbacks[handshake.action](handshake);
        }
      }
    };
    self.runner = self.strategy.connect(0, callback);
  };

  /** @private */
  prototype.abortConnecting = function() {
    if (this.runner) {
      this.runner.abort();
      this.runner = null;
    }
  };

  /** @private */
  prototype.disconnectInternally = function() {
    this.abortConnecting();
    this.clearRetryTimer();
    this.clearUnavailableTimer();
    if (this.connection) {
      var connection = this.abandonConnection();
      connection.close();
    }
  };

  /** @private */
  prototype.updateStrategy = function() {
    this.strategy = this.options.getStrategy({
      key: this.key,
      timeline: this.timeline,
      encrypted: this.encrypted
    });
  };

  /** @private */
  prototype.retryIn = function(delay) {
    var self = this;
    self.timeline.info({ action: "retry", delay: delay });
    if (delay > 0) {
      self.emit("connecting_in", Math.round(delay / 1000));
    }
    self.retryTimer = new Pusher.Timer(delay || 0, function() {
      self.disconnectInternally();
      self.connect();
    });
  };

  /** @private */
  prototype.clearRetryTimer = function() {
    if (this.retryTimer) {
      this.retryTimer.ensureAborted();
      this.retryTimer = null;
    }
  };

  /** @private */
  prototype.setUnavailableTimer = function() {
    var self = this;
    self.unavailableTimer = new Pusher.Timer(
      self.options.unavailableTimeout,
      function() {
        self.updateState("unavailable");
      }
    );
  };

  /** @private */
  prototype.clearUnavailableTimer = function() {
    if (this.unavailableTimer) {
      this.unavailableTimer.ensureAborted();
    }
  };

  /** @private */
  prototype.sendActivityCheck = function() {
    var self = this;
    self.stopActivityCheck();
    self.connection.ping();
    // wait for pong response
    self.activityTimer = new Pusher.Timer(
      self.options.pongTimeout,
      function() {
        self.timeline.error({ pong_timed_out: self.options.pongTimeout });
        self.retryIn(0);
      }
    );
  };

  /** @private */
  prototype.resetActivityCheck = function() {
    var self = this;
    self.stopActivityCheck();
    // send ping after inactivity
    if (!self.connection.handlesActivityChecks()) {
      self.activityTimer = new Pusher.Timer(self.activityTimeout, function() {
        self.sendActivityCheck();
      });
    }
  };

  /** @private */
  prototype.stopActivityCheck = function() {
    if (this.activityTimer) {
      this.activityTimer.ensureAborted();
    }
  };

  /** @private */
  prototype.buildConnectionCallbacks = function() {
    var self = this;
    return {
      message: function(message) {
        // includes pong messages from server
        self.resetActivityCheck();
        self.emit('message', message);
      },
      ping: function() {
        self.send_event('pusher:pong', {});
      },
      activity: function() {
        self.resetActivityCheck();
      },
      error: function(error) {
        // just emit error to user - socket will already be closed by browser
        self.emit("error", { type: "WebSocketError", error: error });
      },
      closed: function() {
        self.abandonConnection();
        if (self.shouldRetry()) {
          self.retryIn(1000);
        }
      }
    };
  };

  /** @private */
  prototype.buildHandshakeCallbacks = function(errorCallbacks) {
    var self = this;
    return Pusher.Util.extend({}, errorCallbacks, {
      connected: function(handshake) {
        self.activityTimeout = Math.min(
          self.options.activityTimeout,
          handshake.activityTimeout,
          handshake.connection.activityTimeout || Infinity
        );
        self.clearUnavailableTimer();
        self.setConnection(handshake.connection);
        self.socket_id = self.connection.id;
        self.updateState("connected", { socket_id: self.socket_id });
      }
    });
  };

  /** @private */
  prototype.buildErrorCallbacks = function() {
    var self = this;

    function withErrorEmitted(callback) {
      return function(result) {
        if (result.error) {
          self.emit("error", { type: "WebSocketError", error: result.error });
        }
        callback(result);
      };
    }

    return {
      ssl_only: withErrorEmitted(function() {
        self.encrypted = true;
        self.updateStrategy();
        self.retryIn(0);
      }),
      refused: withErrorEmitted(function() {
        self.disconnect();
      }),
      backoff: withErrorEmitted(function() {
        self.retryIn(1000);
      }),
      retry: withErrorEmitted(function() {
        self.retryIn(0);
      })
    };
  };

  /** @private */
  prototype.setConnection = function(connection) {
    this.connection = connection;
    for (var event in this.connectionCallbacks) {
      this.connection.bind(event, this.connectionCallbacks[event]);
    }
    this.resetActivityCheck();
  };

  /** @private */
  prototype.abandonConnection = function() {
    if (!this.connection) {
      return;
    }
    this.stopActivityCheck();
    for (var event in this.connectionCallbacks) {
      this.connection.unbind(event, this.connectionCallbacks[event]);
    }
    var connection = this.connection;
    this.connection = null;
    return connection;
  };

  /** @private */
  prototype.updateState = function(newState, data) {
    var previousState = this.state;
    this.state = newState;
    if (previousState !== newState) {
      Pusher.debug('State changed', previousState + ' -> ' + newState);
      this.timeline.info({ state: newState, params: data });
      this.emit('state_change', { previous: previousState, current: newState });
      this.emit(newState, data);
    }
  };

  /** @private */
  prototype.shouldRetry = function() {
    return this.state === "connecting" || this.state === "connected";
  };

  Pusher.ConnectionManager = ConnectionManager;
}).call(this);

;(function() {
  /** Really basic interface providing network availability info.
   *
   * Emits:
   * - online - when browser goes online
   * - offline - when browser goes offline
   */
  function NetInfo() {
    Pusher.EventsDispatcher.call(this);

    var self = this;
    // This is okay, as IE doesn't support this stuff anyway.
    if (window.addEventListener !== undefined) {
      window.addEventListener("online", function() {
        self.emit('online');
      }, false);
      window.addEventListener("offline", function() {
        self.emit('offline');
      }, false);
    }
  }
  Pusher.Util.extend(NetInfo.prototype, Pusher.EventsDispatcher.prototype);

  var prototype = NetInfo.prototype;

  /** Returns whether browser is online or not
   *
   * Offline means definitely offline (no connection to router).
   * Inverse does NOT mean definitely online (only currently supported in Safari
   * and even there only means the device has a connection to the router).
   *
   * @return {Boolean}
   */
  prototype.isOnline = function() {
    if (window.navigator.onLine === undefined) {
      return true;
    } else {
      return window.navigator.onLine;
    }
  };

  Pusher.NetInfo = NetInfo;
  Pusher.Network = new NetInfo();
}).call(this);

;(function() {
  /** Represents a collection of members of a presence channel. */
  function Members() {
    this.reset();
  }
  var prototype = Members.prototype;

  /** Returns member's info for given id.
   *
   * Resulting object containts two fields - id and info.
   *
   * @param {Number} id
   * @return {Object} member's info or null
   */
  prototype.get = function(id) {
    if (Object.prototype.hasOwnProperty.call(this.members, id)) {
      return {
        id: id,
        info: this.members[id]
      };
    } else {
      return null;
    }
  };

  /** Calls back for each member in unspecified order.
   *
   * @param  {Function} callback
   */
  prototype.each = function(callback) {
    var self = this;
    Pusher.Util.objectApply(self.members, function(member, id) {
      callback(self.get(id));
    });
  };

  /** Updates the id for connected member. For internal use only. */
  prototype.setMyID = function(id) {
    this.myID = id;
  };

  /** Handles subscription data. For internal use only. */
  prototype.onSubscription = function(subscriptionData) {
    this.members = subscriptionData.presence.hash;
    this.count = subscriptionData.presence.count;
    this.me = this.get(this.myID);
  };

  /** Adds a new member to the collection. For internal use only. */
  prototype.addMember = function(memberData) {
    if (this.get(memberData.user_id) === null) {
      this.count++;
    }
    this.members[memberData.user_id] = memberData.user_info;
    return this.get(memberData.user_id);
  };

  /** Adds a member from the collection. For internal use only. */
  prototype.removeMember = function(memberData) {
    var member = this.get(memberData.user_id);
    if (member) {
      delete this.members[memberData.user_id];
      this.count--;
    }
    return member;
  };

  /** Resets the collection to the initial state. For internal use only. */
  prototype.reset = function() {
    this.members = {};
    this.count = 0;
    this.myID = null;
    this.me = null;
  };

  Pusher.Members = Members;
}).call(this);

;(function() {
  /** Provides base public channel interface with an event emitter.
   *
   * Emits:
   * - pusher:subscription_succeeded - after subscribing successfully
   * - other non-internal events
   *
   * @param {String} name
   * @param {Pusher} pusher
   */
  function Channel(name, pusher) {
    Pusher.EventsDispatcher.call(this, function(event, data) {
      Pusher.debug('No callbacks on ' + name + ' for ' + event);
    });

    this.name = name;
    this.pusher = pusher;
    this.subscribed = false;
  }
  var prototype = Channel.prototype;
  Pusher.Util.extend(prototype, Pusher.EventsDispatcher.prototype);

  /** Skips authorization, since public channels don't require it.
   *
   * @param {Function} callback
   */
  prototype.authorize = function(socketId, callback) {
    return callback(false, {});
  };

  /** Triggers an event */
  prototype.trigger = function(event, data) {
    if (event.indexOf("client-") !== 0) {
      throw new Pusher.Errors.BadEventName(
        "Event '" + event + "' does not start with 'client-'"
      );
    }
    return this.pusher.send_event(event, data, this.name);
  };

  /** Signals disconnection to the channel. For internal use only. */
  prototype.disconnect = function() {
    this.subscribed = false;
  };

  /** Handles an event. For internal use only.
   *
   * @param {String} event
   * @param {*} data
   */
  prototype.handleEvent = function(event, data) {
    if (event.indexOf("pusher_internal:") === 0) {
      if (event === "pusher_internal:subscription_succeeded") {
        this.subscribed = true;
        this.emit("pusher:subscription_succeeded", data);
      }
    } else {
      this.emit(event, data);
    }
  };

  /** Sends a subscription request. For internal use only. */
  prototype.subscribe = function() {
    var self = this;

    self.authorize(self.pusher.connection.socket_id, function(error, data) {
      if (error) {
        self.handleEvent('pusher:subscription_error', data);
      } else {
        self.pusher.send_event('pusher:subscribe', {
          auth: data.auth,
          channel_data: data.channel_data,
          channel: self.name
        });
      }
    });
  };

  /** Sends an unsubscription request. For internal use only. */
  prototype.unsubscribe = function() {
    this.pusher.send_event('pusher:unsubscribe', {
      channel: this.name
    });
  };

  Pusher.Channel = Channel;
}).call(this);

;(function() {
  /** Extends public channels to provide private channel interface.
   *
   * @param {String} name
   * @param {Pusher} pusher
   */
  function PrivateChannel(name, pusher) {
    Pusher.Channel.call(this, name, pusher);
  }
  var prototype = PrivateChannel.prototype;
  Pusher.Util.extend(prototype, Pusher.Channel.prototype);

  /** Authorizes the connection to use the channel.
   *
   * @param  {String} socketId
   * @param  {Function} callback
   */
  prototype.authorize = function(socketId, callback) {
    var authorizer = new Pusher.Channel.Authorizer(this, this.pusher.config);
    return authorizer.authorize(socketId, callback);
  };

  Pusher.PrivateChannel = PrivateChannel;
}).call(this);

;(function() {
  /** Adds presence channel functionality to private channels.
   *
   * @param {String} name
   * @param {Pusher} pusher
   */
  function PresenceChannel(name, pusher) {
    Pusher.PrivateChannel.call(this, name, pusher);
    this.members = new Pusher.Members();
  }
  var prototype = PresenceChannel.prototype;
  Pusher.Util.extend(prototype, Pusher.PrivateChannel.prototype);

  /** Authenticates the connection as a member of the channel.
   *
   * @param  {String} socketId
   * @param  {Function} callback
   */
  prototype.authorize = function(socketId, callback) {
    var _super = Pusher.PrivateChannel.prototype.authorize;
    var self = this;
    _super.call(self, socketId, function(error, authData) {
      if (!error) {
        if (authData.channel_data === undefined) {
          Pusher.warn(
            "Invalid auth response for channel '" +
            self.name +
            "', expected 'channel_data' field"
          );
          callback("Invalid auth response");
          return;
        }
        var channelData = JSON.parse(authData.channel_data);
        self.members.setMyID(channelData.user_id);
      }
      callback(error, authData);
    });
  };

  /** Handles presence and subscription events. For internal use only.
   *
   * @param {String} event
   * @param {*} data
   */
  prototype.handleEvent = function(event, data) {
    switch (event) {
      case "pusher_internal:subscription_succeeded":
        this.members.onSubscription(data);
        this.subscribed = true;
        this.emit("pusher:subscription_succeeded", this.members);
        break;
      case "pusher_internal:member_added":
        var addedMember = this.members.addMember(data);
        this.emit('pusher:member_added', addedMember);
        break;
      case "pusher_internal:member_removed":
        var removedMember = this.members.removeMember(data);
        if (removedMember) {
          this.emit('pusher:member_removed', removedMember);
        }
        break;
      default:
        Pusher.PrivateChannel.prototype.handleEvent.call(this, event, data);
    }
  };

  /** Resets the channel state, including members map. For internal use only. */
  prototype.disconnect = function() {
    this.members.reset();
    Pusher.PrivateChannel.prototype.disconnect.call(this);
  };

  Pusher.PresenceChannel = PresenceChannel;
}).call(this);

;(function() {
  /** Handles a channel map. */
  function Channels() {
    this.channels = {};
  }
  var prototype = Channels.prototype;

  /** Creates or retrieves an existing channel by its name.
   *
   * @param {String} name
   * @param {Pusher} pusher
   * @return {Channel}
   */
  prototype.add = function(name, pusher) {
    if (!this.channels[name]) {
      this.channels[name] = createChannel(name, pusher);
    }
    return this.channels[name];
  };

  /** Returns a list of all channels
   *
   * @return {Array}
   */
  prototype.all = function(name) {
    return Pusher.Util.values(this.channels);
  };

  /** Finds a channel by its name.
   *
   * @param {String} name
   * @return {Channel} channel or null if it doesn't exist
   */
  prototype.find = function(name) {
    return this.channels[name];
  };

  /** Removes a channel from the map.
   *
   * @param {String} name
   */
  prototype.remove = function(name) {
    var channel = this.channels[name];
    delete this.channels[name];
    return channel;
  };

  /** Proxies disconnection signal to all channels. */
  prototype.disconnect = function() {
    Pusher.Util.objectApply(this.channels, function(channel) {
      channel.disconnect();
    });
  };

  function createChannel(name, pusher) {
    if (name.indexOf('private-') === 0) {
      return new Pusher.PrivateChannel(name, pusher);
    } else if (name.indexOf('presence-') === 0) {
      return new Pusher.PresenceChannel(name, pusher);
    } else {
      return new Pusher.Channel(name, pusher);
    }
  }

  Pusher.Channels = Channels;
}).call(this);

;(function() {
  Pusher.Channel.Authorizer = function(channel, options) {
    this.channel = channel;
    this.type = options.authTransport;

    this.options = options;
    this.authOptions = (options || {}).auth || {};
  };

  Pusher.Channel.Authorizer.prototype = {
    composeQuery: function(socketId) {
      var query = 'socket_id=' + encodeURIComponent(socketId) +
        '&channel_name=' + encodeURIComponent(this.channel.name);

      for(var i in this.authOptions.params) {
        query += "&" + encodeURIComponent(i) + "=" + encodeURIComponent(this.authOptions.params[i]);
      }

      return query;
    },

    authorize: function(socketId, callback) {
      return Pusher.authorizers[this.type].call(this, socketId, callback);
    }
  };

  var nextAuthCallbackID = 1;

  Pusher.auth_callbacks = {};
  Pusher.authorizers = {
    ajax: function(socketId, callback){
      var self = this, xhr;

      if (Pusher.XHR) {
        xhr = new Pusher.XHR();
      } else {
        xhr = (window.XMLHttpRequest ? new window.XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP"));
      }

      xhr.open("POST", self.options.authEndpoint, true);

      // add request headers
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      for(var headerName in this.authOptions.headers) {
        xhr.setRequestHeader(headerName, this.authOptions.headers[headerName]);
      }

      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            var data, parsed = false;

            try {
              data = JSON.parse(xhr.responseText);
              parsed = true;
            } catch (e) {
              callback(true, 'JSON returned from webapp was invalid, yet status code was 200. Data was: ' + xhr.responseText);
            }

            if (parsed) { // prevents double execution.
              callback(false, data);
            }
          } else {
            Pusher.warn("Couldn't get auth info from your webapp", xhr.status);
            callback(true, xhr.status);
          }
        }
      };

      xhr.send(this.composeQuery(socketId));
      return xhr;
    },

    jsonp: function(socketId, callback){
      if(this.authOptions.headers !== undefined) {
        Pusher.warn("Warn", "To send headers with the auth request, you must use AJAX, rather than JSONP.");
      }

      var callbackName = nextAuthCallbackID.toString();
      nextAuthCallbackID++;

      var document = Pusher.Util.getDocument();
      var script = document.createElement("script");
      // Hacked wrapper.
      Pusher.auth_callbacks[callbackName] = function(data) {
        callback(false, data);
      };

      var callback_name = "Pusher.auth_callbacks['" + callbackName + "']";
      script.src = this.options.authEndpoint +
        '?callback=' +
        encodeURIComponent(callback_name) +
        '&' +
        this.composeQuery(socketId);

      var head = document.getElementsByTagName("head")[0] || document.documentElement;
      head.insertBefore( script, head.firstChild );
    }
  };
}).call(this);


'use strict';

angular.module('pusher-angular', [])

.factory('$pusher', ['$rootScope', '$channel', '$connection',
  function ($rootScope, $channel, $connection) {

    function PusherAngular (pusherClient) {
      if (!(this instanceof PusherAngular)) {
        return new PusherAngular(pusherClient);
      }

      this._assertValidClient(pusherClient);
      this.client = pusherClient;
      this.connection = $connection(pusherClient.connection, pusherClient);
      this.channels = {};
    }

    PusherAngular.prototype = {
      /**
       * Subscribe the client to the specified channelName and returns the channel object.
       * {@link https://pusher.com/docs/client_api_guide/client_public_channels#subscribe}
       *
       * @param {String} channelName name of the channel
       * @returns {Object} channel object
       */
      subscribe: function (channelName) {
        var channel = $channel(this.client.subscribe(channelName), this);
        this.channels[channelName] = channel;
        return channel;
      },

      /**
       * Unsubscribes the client from the specified channel
       * {@link https://pusher.com/docs/client_api_guide/client_public_channels#unsubscribe}
       *
       * @param {String} channelName name of the channel
       */
      unsubscribe: function (channelName) {
        if (this.client.channel(channelName)) {
          this.client.unsubscribe(channelName);
          if (this.channels[channelName]) { delete this.channels[channelName]; }
        }
      },

      /**
       * Binds to global events on the pusher client. You can attach behaviour to these events
       * regardless of the channel the event is broadcast to.
       *
       * @param {String} eventName name of the event you want to bind to
       * @param {Function|undefined} callback callback that you want called upon the event occurring
       */
      bind: function (eventName, callback) {
        this.client.bind(eventName, function (data) {
          callback(data);
          $rootScope.$digest();
        });
      },

      /**
       * Binds to all of the global client messages.
       *
       * @param {Function|undefined} callback callback that you want called upon a message being received
       */
      bind_all: function (callback) {
        this.client.bind_all(function (eventName, data) {
          callback(eventName, data);
          $rootScope.$digest();
        });
      },

      /**
       * Unbinds from global events on the pusher client.
       *
       * @param {String} eventName name of the event you want to bind from
       * @param {Function|undefined} callback callback that you want to unbind
       */
      unbind: function (eventName, callback) {
        this.client.unbind(eventName, callback);
      },

      /**
       * Disconnects the pusher client.
       * {@link http://pusher.com/docs/client_api_guide/client_connect#disconnecting}
       */
      disconnect: function () {
        this.client.disconnect();
      },

      /**
       * Returns a pusher channel object.
       * {@link https://pusher.com/docs/client_api_guide/client_channels#access}
       *
       * @param {String} channelName name of the channel
       * @returns {Array} channel object
       */
      channel: function (channelName) {
        return this.channels[channelName];
      },

      /**
       * Returns a an array of the channels that the client is subscribed to.
       * {@link https://pusher.com/docs/client_api_guide/client_channels#access}
       *
       * @returns {Array} array of subscribed channels
       */
      allChannels: function () {
        return this.channels;
      },

      /**
       * Asserts that the $pusher object is being initialised with valid pusherClient.
       * Throws an error if pusherClient is invalid.
       *
       * @param {Object} pusherClient members object from base pusher channel object
       */
      _assertValidClient: function (pusherClient) {
        if (!angular.isObject(pusherClient) ||
            !angular.isObject(pusherClient.connection) ||
            typeof(pusherClient.channel) !== 'function') {
          throw new Error('Invalid Pusher client object');
        }
      }
    };

    return PusherAngular;
  }
])

.factory('$channel', ['$rootScope', '$members',
  function ($rootScope, $members) {

    function checkPresenceOrPrivateChannel (channelName) {
      if (channelName.indexOf('presence-') == -1 && channelName.indexOf('private-') == -1) {
        throw new Error('Presence or private channel required');
      }
    }

    function $channel (baseChannel, $pusherClient) {
      if (!(this instanceof $channel)) {
        return new $channel(baseChannel, $pusherClient);
      }

      this._assertValidChannel(baseChannel);
      this.baseChannel = baseChannel;
      this.client = $pusherClient;
      this.name = baseChannel.name;

      if (baseChannel.name.indexOf('presence') == -1) {
        this.members = function () { throw new Error('Members object only exists for presence channels'); }
      } else {
        this.members = $members(baseChannel.members, baseChannel);
      }
    }

    $channel.prototype = {
      /**
       * Binds to the given event name on the channel.
       *
       * @param {String} eventName name of the event you want to bind to
       * @param {Function|undefined} callback callback that you want called upon the event occurring
       */
      bind: function (eventName, callback) {
        this.baseChannel.bind(eventName, function (data) {
          callback(data);
          $rootScope.$digest();
        });
      },

      /**
       * Unbinds from the given event name on the channel.
       *
       * @param {String} eventName name of the event you want to bind from
       * @param {Function|undefined} callback callback that you want to unbind
       */
      unbind: function (eventName, callback) {
        this.baseChannel.unbind(eventName, callback);
      },

      /**
       * Binds to all of the channel events.
       *
       * @param {Function|undefined} callback callback that you want called upon the event occurring
       */
      bind_all: function (callback) {
        this.baseChannel.bind_all(function (eventName, data) {
          callback(eventName, data);
          $rootScope.$digest();
        });
      },

      /**
       * Triggers a client event.
       * {@link https://pusher.com/docs/client_api_guide/client_events#trigger-events}
       *
       * @param {String} channelName name of the channel
       * @param {String} eventName name of the event
       * @param {Object} obj object that you wish to pass along with your client event
       * @returns {}
       */
      trigger: function (eventName, obj) {
        checkPresenceOrPrivateChannel(this.name);
        if (eventName.indexOf('client-') == -1) { throw new Error('Event name requires \'client-\' prefix'); }
        return this.baseChannel.trigger(eventName, obj);
      },

      /**
       * Asserts that the $channel object is being initialised with valid baseChannel.
       * Throws an error if baseChannel is invalid.
       *
       * @param {Object} baseChannel channel object from base pusher channel object
       */
      _assertValidChannel: function (baseChannel) {
        if (!angular.isObject(baseChannel) ||
            typeof(baseChannel.name) !== 'string') {
          throw new Error('Invalid Pusher channel object');
        }
      }
    };

    return $channel;
  }
])

.factory('$members', ['$rootScope',
  function ($rootScope) {

    function $members (baseMembers, baseChannel) {
      if (!(this instanceof $members)) {
        return new $members(baseMembers, baseChannel);
      }
      var self = this;

      this._assertValidMembers(baseMembers);
      this.baseMembers = baseMembers;
      this.baseChannel = baseChannel;
      this.me = {};
      this.count = 0;
      this.members = {};

      baseChannel.bind('pusher:subscription_succeeded', function (members) {
        self.me = members.me;
        self.count = members.count;
        self.members = members.members;
        $rootScope.$digest();
      });

      baseChannel.bind('pusher:member_added', function (member) {
        self.count++;
        if (member.info) {
          self.members[member.id.toString()] = member.info;
        } else {
          self.members[member.id.toString()] = null;
        }
        $rootScope.$digest();
      });

      baseChannel.bind('pusher:member_removed', function (member) {
        self.count--;
        delete self.members[member.id.toString()];
        $rootScope.$digest();
      });
    }

    $members.prototype = {
     /**
      * Returns member's info for given id. Resulting object containts two fields - id and info.
      *
      * @param {Number} id user's id
      * @return {Object} member's info or null
      */
      get: function (id) {
        return this.baseMembers.get(id);
      },

      /**
       * Calls back for each member in unspecified order.
       *
       * @param {Function} callback callback function
       */
      each: function (callback) {
        this.baseMembers.each(function (member) {
          callback(member);
          $rootScope.$digest();
        });
      },

      /**
       * Asserts that the $members object is being initialised with valid baseMembers.
       * Throws an error if baseMembers is invalid.
       *
       * @param {Object} baseMembers members object from base pusher channel object
       */
      _assertValidMembers: function (baseMembers) {
        if (!angular.isObject(baseMembers) ||
            typeof(baseMembers.me) !== 'object') {
          throw new Error('Invalid Pusher channel members object');
        }
      }
    };

    return $members;
  }
])

.factory('$connection', ['$rootScope',
  function ($rootScope) {

    function $connection (baseConnection, baseClient) {
      if (!(this instanceof $connection)) {
        return new $connection(baseConnection, baseClient);
      }

      this._assertValidConnection(baseConnection);
      this.baseConnection = baseConnection;
      this.baseClient = baseClient;
    }

    $connection.prototype = {
      /**
       * Binds to the given event name on the connection.
       *
       * @param {String} eventName name of the event you want to bind to
       * @param {Function|undefined} callback callback that you want called upon the event occurring
       */
      bind: function (eventName, callback) {
        this.baseConnection.bind(eventName, function (data) {
          callback(data);
          $rootScope.$digest();
        });
      },

      /**
       * Binds to all of the global connection events.
       *
       * @param {Function|undefined} callback callback that you want called upon the event occurring
       */
      bind_all: function (callback) {
        this.baseConnection.bind_all(function (eventName, data) {
          callback(eventName, data);
          $rootScope.$digest();
        });
      },

      /**
       * Asserts that the $connection object is being initialised with valid baseConnection.
       * Throws an error if baseConnection is invalid.
       *
       * @param {Object} baseConnection connection object from base pusher object
       */
      _assertValidConnection: function (baseConnection) {
        if (!angular.isObject(baseConnection)) {
          throw new Error('Invalid Pusher connection object');
        }
      }
    };

    return $connection;
  }
]);

(function () {
  'use strict';

  angular.module('campaignPage.mobile', [
    'ui.router',
    'header',
    'footer',
    'utils',
    'perks'
  ])

  .config(['$stateProvider', '$urlRouterProvider', '$provide', function($stateProvider, $urlRouterProvider, $provide) {
      $urlRouterProvider.otherwise('/');

      $stateProvider.state('main', {
        url: '/',
        templateUrl: 'views/main.html'
      });

      $stateProvider.state('story', {
        url: '/story',
        templateUrl: 'views/story.html'
      });

      $stateProvider.state('trust_passport', {
        url: '/trust_passport',
        templateUrl: 'views/trust-passport.html'
      });

      $stateProvider.state('contact', {
        url: '/contact',
        templateUrl: 'views/contact.html'
      });

      $stateProvider.state('perks', {
        url: '/perks/:perkId',
        templateUrl: 'views/main.html'
      });

      $provide.decorator('$uiViewScroll', function ($delegate, $window, browser) {
        return function (uiViewElement) {
          if (browser.isIphone()) {
            var iPhoneSmartAppBannerPadding = -100;
            $window.scrollTo(0, iPhoneSmartAppBannerPadding);
          } else {
            $window.scrollTo(0, 0);
          }
        };
      });
    }])
  .run(['campaign', '$http', 'gon', 'ga', function(campaign, $http, gon, ga) {
    if (gon && gon.campaign) {
      campaign.setCampaignJson(gon.campaign);
    }

    if (gon && gon.campaignPrivateJson) {
      _.merge(campaign, gon.campaignPrivateJson);
    }

    if (gon && gon.tracking_info && gon.tracking_info.google_analytics_id) {
      ga('create', gon.tracking_info.google_analytics_id, 'auto', {'name': 'campaign'});
      ga('campaign.send', 'pageview');
    }

    var csrfToken = $('meta[name=csrf-token]').attr('content');
    $http.defaults.headers.common['X-CSRF-Token'] = csrfToken;
  }]);

  angular.module('campaignPage.life', [
    'templates',
    'header',
    'footer',
    'campaignPage.utils',
    'campaignPage.share',
    'utils'
  ])
    .run(['pcCampaign', 'gogoEvents', 'gon', function(pcCampaign, gogoEvents, gon) {
      if (gon && gon.load_campaign_async) {
        gogoEvents.captureEvent('visit_fundraiser');
        pcCampaign.refresh();
      }
    }]);

  angular.module('campaignPage.dashboard', [
    'templates',
    'header',
    'footer',
    'campaignPage.utils',
    'campaignPage.share',
    'ui.router',
    'utils',
    'LocalStorageModule',
    'angularMoment',
    'ngTouch'
  ])
    .config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
      $urlRouterProvider.otherwise('/manage');

      $stateProvider.state('manage', {
        url: '/manage',
        templateUrl: 'views/pc-manage-tab.html'
      });

      $stateProvider.state('funds', {
        url: '/funds',
        templateUrl: 'views/pc-funds-tab.html'
      });

      $stateProvider.state('donations', {
        url: '/donations',
        templateUrl: 'views/pc-donations-tab.html'
      });
    }]);

  angular.module('campaignPage.shareWizard', [
      'campaignPage.share'
  ])
  .config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {

    $urlRouterProvider.otherwise('/');

    $stateProvider.state('facebook', {
      url: '/',
      templateUrl: 'views/share-facebook.html',
      controller: function($scope){
        $scope.captureEvent('share_wizard_fb');
      }
    });

    $stateProvider.state('facebook-2', {
      url: '/facebook',
      templateUrl: 'views/share-facebook-2.html',
      controller: function($scope){
        $scope.captureEvent('share_wizard_fb_2');
      }
    });

    $stateProvider.state('twitter', {
      url: '/twitter',
      templateUrl: 'views/share-twitter.html',
      controller: function($scope){
        $scope.captureEvent('share_wizard_tw');
      }
    });

    $stateProvider.state('email', {
      url: '/email',
      templateUrl: 'views/share-email.html',
      controller: function($scope){
        $scope.captureEvent('share_wizard_email');
      }
    });
  }]);

  angular.module('campaignPage.share', [
    'templates',
    'header',
    'footer',
    'utils',
    'campaignPage.utils',
    'ui.router'
  ]);

  angular.module('campaignPage.utils', ['utils']);
  angular.module('campaignPage.preview', ['templates', 'campaignPage.utils']);

  angular.module('campaignPage.desktop', [
    'templates',
    'utils',
    'ngAnimate',
    'perks',
    'ui.router',
    'campaignPage.share',
    'pusher-angular'
  ])
    .config(['storyTabCacheProvider', '$stateProvider', '$urlRouterProvider',
      function(storyTabCacheProvider, $stateProvider, $urlRouterProvider) {
        storyTabCacheProvider.cacheHtml(angular.element('[ui-view]'));

        $urlRouterProvider.when('/activity', '/updates');
        $urlRouterProvider.when('/pledges', '/funders');
        $urlRouterProvider.otherwise('/story');

        var storyTemplateProvider = function(storyTabCache) {
          return storyTabCache.cachedHtml();
        };
        storyTemplateProvider.$inject = ['storyTabCache'];

        $stateProvider.state('story', {
          url: '/story',
          templateProvider: storyTemplateProvider
        });

        $stateProvider.state('updates', {
          url: '/updates',
          template: "<desktop-updates></desktop-updates>",
          controller: function($scope){
          }
        });

        $stateProvider.state('comments', {
          url: '/comments',
          template: "<desktop-comments></desktop-comments>",
          controller: function($scope){
          }
        });

        $stateProvider.state('funders', {
          url: '/funders',
          template: "<desktop-funders></desktop-funders>",
          controller: function($scope){
          }
        });

        $stateProvider.state('gallery', {
          url: '/gallery',
          template: "<desktop-gallery></desktop-gallery>",
          controller: function($scope){
          }
        });

        $stateProvider.state('perks', {
          url: '/perks/:perkId',
          templateProvider: storyTemplateProvider,
          controller: function($scope){
          }
        });
    }]).run(['campaignPusher', 'gon', 'ga', function(campaignPusher, gon, ga) {
      if (gon && gon.tracking_info && gon.tracking_info.google_analytics_id) {
        ga('create', gon.tracking_info.google_analytics_id, 'auto', {'name': 'campaign'});
        ga('campaign.send', 'pageview');
      }
      angular.element("[ui-view]").show();
      if (gon && gon.pusher) {
        campaignPusher.start();
      }
      ga('send', 'event', 'Trust', 'Teaser');
    }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('lifeFundsBreakdown', [
    'i18n', 'gon', 'pcDashboard', 'currencies', 'iggCurrencyFilter', '$modal',
    function (i18n, gon, pcDashboard, currencies, iggCurrencyFilter, $modal) {
      return {
        scope: {
        },
        restrict: 'A',
        templateUrl: 'views/life-funds-breakdown.html',

        link: function(scope) {
          scope.i18n = i18n;
          scope.fundsData = pcDashboard.fundsData;
          scope.showExplanation = function () {
            $modal({
              scope: scope,
              template: 'views/when-funds-modal.html'
            });
          };

          var creditCardFund = _.findWhere(scope.fundsData.funds, {contribution_method_raw: "credit_card"});
          var paypalFund = _.findWhere(scope.fundsData.funds, {contribution_method_raw: "paypal"});
          var totalFund = _.findWhere(scope.fundsData.funds, {contribution_method_raw: "total"}) || creditCardFund;
          var adjustmentFund = _.findWhere(scope.fundsData.funds, {contribution_method_raw: "adjustment"});

          if (creditCardFund) {
            var isoNum = currencies.forIsoCode(creditCardFund.currency_iso_code).iso_num;
            var includeCents = function(amount) {
              return iggCurrencyFilter(amount, isoNum, 'noIso,cents');
            };

            var feeDesc = (creditCardFund.transaction_fee_percent * 100) + '%';
            if (parseFloat(creditCardFund.transaction_fee_fixed) > 0) {
              var fixedFee = includeCents(creditCardFund.transaction_fee_fixed);
              var fixedCost = i18n.t('personal.dashboard.funds.fixed_cost_phrase', {fixed_cost: fixedFee});
              feeDesc = feeDesc + ' + ' + fixedCost;
            }
            scope.transactionFeeLabel = i18n.t('personal.dashboard.funds.transaction_fee_label', {fee_desc: feeDesc});
            scope.transactionFees = '- ' + includeCents(creditCardFund.transaction_fees_raw);
            scope.transactionFeeTooltip = i18n.t('personal.dashboard.funds.transaction_fee_tooltip', {fee_desc: feeDesc});
            scope.fundsRaised = [];

            var optionalFees = [];
            if (parseFloat(totalFund.delivery_fees_raw) > 0) {
              optionalFees.push({
                label: i18n.t('personal.dashboard.funds.bank_delivery_fees'),
                value: '- ' + includeCents(totalFund.delivery_fees_raw),
                tooltip: i18n.t('personal.dashboard.funds.bank_delivery_tooltip')
              });
            }
            if (parseFloat(totalFund.platform_fees_raw) > 0) {
              optionalFees.push({
                label: i18n.t('personal.dashboard.funds.platform_fees'),
                value: '- ' + includeCents(totalFund.platform_fees_raw)
              });
            }
            if (paypalFund) {
              optionalFees.push({
                label: i18n.t('personal.dashboard.funds.paypal_fees'),
                value: i18n.t('command_center.estimated_3_to_5_percent')
              });

              scope.fundsRaised = [
                {label: 'PayPal', value: includeCents(paypalFund.total_raised)},
                {label: 'Debit/Credit Card', value: includeCents(creditCardFund.total_raised)}
              ];
            }

            var totalRaised = totalFund.total_raised;
            if (adjustmentFund) {
              totalRaised -= adjustmentFund.total_raised;
              optionalFees.push({
                label: i18n.t('campaigner_dashboard.adjustment'),
                value: includeCents(adjustmentFund.total_raised)
              });
            }

            scope.fundsRaisedToDate = includeCents(totalRaised);
            scope.optionalFees = optionalFees;


            var totalTakeawayAmount =
              parseFloat(totalFund.total_raised_not_yet_disbursed_raw) +
              parseFloat(totalFund.total_raised_disbursed_raw);
            scope.totalTakeaway = includeCents(totalTakeawayAmount);
            if (paypalFund) {
              scope.totalTakeaway = scope.totalTakeaway + ' (' +
               i18n.t('campaigner_dashboard.minus_paypal_fees') + ')';
            }
          }
        }
      };
    }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('lifeFunds', [
    'i18n', 'gon', 'pcDashboard',
    function (i18n, gon, pcDashboard) {
      return {
        scope: {},
        restrict: 'A',
        templateUrl: 'views/life-funds.html',

        link: function(scope) {
          scope.inFundsTabRedesign = gon.funds_tab_redesign;
          scope.funds = pcDashboard.fundsData;
          scope.underReview = pcDashboard.underReview;
          pcDashboard.getFunds();
          pcDashboard.getDisbursements();
          pcDashboard.getDonationsUnderReview({page: 1, per_page: scope.inFundsTabRedesign ? 5 : 20});
        }
      };
    }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('lifeFundsDisbursement', [
    'i18n', 'gon', 'pcDashboard', 'currencies', 'iggCurrencyFilter', '$http', '$modal', 'weekOfFilter',
    function (i18n, gon, pcDashboard, currencies, iggCurrencyFilter, $http, $modal, weekOfFilter) {
      return {
        scope: {},
        restrict: 'A',
        templateUrl: 'views/life-funds-disbursement.html',

        link: function(scope) {
          scope.i18n = i18n;
          scope.fundsData = pcDashboard.fundsData;
          var creditCardFund = _.findWhere(scope.fundsData.funds, {contribution_method_raw: "credit_card"});
          var totalFund = _.findWhere(scope.fundsData.funds, {contribution_method_raw: "total"}) || creditCardFund;

          if (totalFund) {
            var isoNum = currencies.forIsoCode(totalFund.currency_iso_code).iso_num;
            var includeCents = function(amount) {
              return iggCurrencyFilter(amount, isoNum, 'noIso,cents');
            };

            scope.notDisbursed = includeCents(totalFund.total_raised_not_yet_disbursed_raw);
            scope.alreadyDisbursed = includeCents(totalFund.total_raised_disbursed_raw);
          }

          scope.disbursements = pcDashboard.disbursements;
          scope.showHistory = function () {

            var paymentMappings = {
              bank: i18n.t('personal.dashboard.funds.debit_credit'),
              paypal: 'PayPal',
              first_giving: 'FirstGiving'
            };
            scope.disbursementsHistory = _.map(pcDashboard.disbursements.items, function(disbursement) {
              return {
                weekDisplay: weekOfFilter(disbursement.created_at),
                paymentMethod: paymentMappings[disbursement.payment_method],
                amount: includeCents(disbursement.net)
              };
            });
            $modal({
              template: 'views/disbursement-history-modal.html',
              scope: scope
            });
          };
        }
      };
    }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('lifeFundsUnderReview', [
    'i18n', 'pcDashboard',
    function (i18n, pcDashboard) {
      return {
        scope: {},
        restrict: 'A',
        templateUrl: 'views/life-funds-under-review.html',

        link: function(scope) {
          scope.i18n = i18n;
          scope.underReview = pcDashboard.underReview;

          scope.showMore = function() {
            pcDashboard.loadMoreDonationsUnderReview();
          };
        }
      };
    }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('lifeReceiveFunds', [
    'i18n', 'gon',
    function (i18n, gon) {
      return {
        scope: {},
        restrict: 'A',
        templateUrl: 'views/life-receive-funds.html',

        link: function(scope) {
          scope.i18n = i18n;
          scope.editUrl = gon.urls.edit_fundraiser;
          scope.hasDonated = gon.fundraiser.donations_count > 0;
        }
      };
    }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('pcAutomatedFacebookUpdates', [
    'i18n', '$modal', 'gon', 'fbAutopost', 'gogoEvents',
    function(i18n, $modal, gon, fbAutopost, gogoEvents) {
    return {
      templateUrl: 'views/pc-automated-facebook-updates.html',
      scope: {},
      link: function (scope) {
        scope.i18n = i18n;
        scope.authorizeFacebookUrl = gon.urls.facebook_authorize_url;
        scope.canWallPost = gon.current_account.facebook_can_wall_post;
        scope.fbAutopost = fbAutopost;

        scope.frequencyOptions = _.map([1, 2, 3, 7], function(value) {
          return {
            value: value,
            title: i18n.t('personal.dashboard.automated_updates.frequency_' + value.toString() + '.title'),
            description: i18n.t('personal.dashboard.automated_updates.frequency_' + value.toString() + '.description')
          };
        });

        scope.showModal = function() {
          fbAutopost.makeSnapshot();
          fbAutopost.snapshot.postingActive = true;
          $modal({
            scope: scope,
            template: 'views/pc-automated-facebook-modal.html'
          });
        };

        scope.turnOffAutopost = function () {
          fbAutopost.setPostingActive(false).then(function () {
            gogoEvents.captureEvent('fb_autopost_dashboard_off');
          });
        };

        scope.changeFrequency = function(freq) {
          fbAutopost.snapshot.frequency = freq.value;
        };

        scope.frequencyText = function () {
          var frequencyOption =  _.detect(scope.frequencyOptions, function(freqOption) {
            return freqOption.value === fbAutopost.snapshot.frequency;
          });
          return frequencyOption ? frequencyOption.description : '';
        };

        scope.updateAutopostFrequency = function () {
          fbAutopost.saveSnapshot().then(function () {
            gogoEvents.captureEvent('fb_autopost_dashboard_changefreq_' + fbAutopost.frequency.toString());
          });
        };
      }
    };
  }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('pcDashboardCampaignCard', [
    'browser', 'i18n', 'pcCampaign',
    function (browser, i18n, pcCampaign) {
      return {
        scope: {},
        restrict: 'A',
        templateUrl: 'views/pc-dashboard-campaign-card.html',
        link: function(scope) {
          scope.browser = browser;
          scope.i18n = i18n;
          scope.pcCampaign = pcCampaign;
          scope.raisedOfGoal = i18n.t("personal.fundraiser_dashboard.raised_of_goal",
            {goal: pcCampaign.json().goal});
        }
      };
    }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('pcDashboard', ['i18n', '$state', 'pcDashboard', 'pcCampaign', 'gon', 'browser',
    function (i18n, $state, pcDashboard, pcCampaign, gon, browser) {
      return {
      scope: {
        version: '@pcDashboardVersion'
      },
      restrict: 'A',
      templateUrl: 'views/pc-dashboard.html',

      link: function(scope) {
        scope.i18n = i18n;
        pcCampaign.setCampaignJson(gon.fundraiser);

        scope.fundraiserUrl = gon.fundraiser.url;
        scope.isMobile = browser.isMobile();
        scope.hasRecentDonations = gon.fundraiser.donations && gon.fundraiser.donations.length > 0;
      }
    };
  }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('pcDashboardDonations', ['i18n', 'pcDashboard', 'gon', function (i18n, pcDashboard, gon) {
    return {
      templateUrl: 'views/pc-dashboard-donations.html',
      link: function(scope) {
        scope.i18n = i18n;
        scope.offset = 4;

        scope.csvPath = gon.urls.donations_csv_endpoint;
        scope.donationsData = {};
        scope.showData = false;
        scope.pledges = [];

        scope.getDonations = function(params) {
          scope.showData = false;
          pcDashboard.getDonations(params).then(function() {
            scope.showData = true;
            scope.currentPage = params.page;
            scope.pledges = pcDashboard.donationsData.pledges;
            scope.totalPages = pcDashboard.donationsData.totalPages;

            var rangeStart = scope.currentPage > scope.offset ? scope.currentPage - scope.offset : 1;
            var rangeEnd = scope.totalPages - scope.currentPage > scope.offset ? scope.currentPage + scope.offset : scope.totalPages;
            scope.paginatedPages = _.range(rangeStart, rangeEnd + 1);
          });
        };

        scope.isCurrentPage = function(page) {
          return scope.currentPage === page;
        };

        scope.getDonations({page: 1});
      }
    };
  }]);
})();

(function() {
  angular.module('campaignPage.dashboard').directive('pcDashboardEndFundraiser', [
      'i18n', 'pcCampaign', '$modal', '$http', 'gon', 'flash', 'pcDashboard',
      function(i18n, pcCampaign, $modal, $http, gon, flash, pcDashboard) {
        var endFundraiserModal, removeDeadlineModal;

        return {
          templateUrl: 'views/pc-dashboard-end-fundraiser.html',
          scope: {
          },
          link: function(scope) {
            scope.i18n = i18n;
            scope.fundingStartedAt = i18n.t('personal.dashboard.started_on_html', {
              date: pcCampaign.json().start_date
            });

            scope.showAnswer = false;
            scope.hasDeadline = pcCampaign.hasDeadline();
            scope.endsOn = i18n.t('personal.dashboard.ends_on_html', {
              date: pcCampaign.json().end_date
            });

            scope.hasEnded = pcCampaign.json().has_ended;
            if (scope.hasEnded) {
              scope.endDate = i18n.t('personal.dashboard.ended_on_html', {
                date: pcCampaign.json().end_date
              });
            }

            scope.endFundraiser = function() {
              $http.post(gon.urls.end_fundraiser).then(function(response) {
                scope.hasEnded = true;
                scope.endDate = i18n.t('personal.dashboard.ended_on_html', {
                  date: response.data.end_date
                });
                pcDashboard.pillState = response.data.pill_state;
                flash.addMessage('notice', i18n.t('personal.dashboard.successfully_ended'));
                endFundraiserModal.hide();
              });
            };

            scope.removeDeadline = function() {
              $http.post(gon.urls.remove_deadline).then(function() {
                scope.hasDeadline = false;
                flash.addMessage('notice', i18n.t('personal.dashboard.deadline_removed'));
                removeDeadlineModal.hide();
              });
            };

            scope.showEndFundraiserModal = function() {
              endFundraiserModal = $modal({
                template: 'views/pc-dashboard-end-fundraiser-modal.html',
                scope: scope
              });
            };

            scope.showRemoveDeadlineModal = function() {
              removeDeadlineModal = $modal({
                template: 'views/pc-dashboard-remove-deadline-modal.html',
                scope: scope
              });
            };
          }
      };
    }]
  );
})();

(function() {
  angular.module('campaignPage.dashboard').directive('pcDashboardFundraiserLink', ['i18n', 'pcDashboard', 'browser', function(i18n, pcDashboard, browser) {
    return {
      templateUrl: 'views/pc-dashboard-fundraiser-link.html',
      scope: {
        title: '@'
      },
      link: function(scope, element) {
        scope.i18n = i18n;
        scope.projectUrl = pcDashboard.urls.fundraiser_short_link_url;
        scope.browser = browser;

        scope.selectUrl = function() {
          element.find('input').select();
        };

        scope.preventDefault = function(event) {
          event.preventDefault();
        };
      }
    };
  }]);
})();

(function() {
  angular.module('campaignPage.dashboard').directive('pcDashboardMobileFundraiserLink', ['i18n', 'pcDashboard', 'modals', function(i18n, pcDashboard, modals) {
    return {
      templateUrl: 'views/pc-dashboard-mobile-fundraiser-link.html',
      link: function(scope) {
        scope.openModal = function() {
          modals.openModal("fundraiser-link-modal");
        };
      }
    };
  }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('pcDashboardPostUpdate', [
    'pcDashboard', 'i18n', '$http', 'gon', 'flash', 'browser', 'localStorageService',
    function (pcDashboard, i18n, $http, gon, flash, browser, localStorageService) {
      return {
        scope: {},
        templateUrl: 'views/pc-dashboard-post-update.html',
        link: function(scope) {
          scope.i18n = i18n;
          scope.showSpinner = false;
          scope.postToFacebook = gon.current_account.facebook_can_wall_post;

          var updateBody = localStorageService.get('campaignUpdate');

          if (updateBody) {
            scope.editMode = true;
            scope.charLength = updateBody.length;
            scope.newUpdate = {
              body: localStorageService.get('campaignUpdate')
            };
            localStorageService.remove('campaignUpdate');
          } else {
            scope.editMode = false;
            scope.charLength = 0;
            scope.newUpdate = {
              body: ''
            };
          }

          scope.connectToFacebook = function() {
            if (gon.current_account.facebook_can_wall_post) {
              return true;
            } else {
              localStorageService.set('campaignUpdate', scope.newUpdate.body);
              browser.redirectTo(gon.urls.facebook_authorize_url);
              return false;
            }
          };

          scope.serverError = null;
          scope.needHelpUrl = gon.urls.help_url;

          scope.$on('redactor:updatedCount', function (event, newLength) {
            scope.charLength = newLength;
            scope.serverError = null;
          });

          scope.showEditor = function() {
            scope.editMode = true;
          };

          scope.isValidLength = function () {
            return scope.charLength < 2 || scope.charLength > 1500;
          };

          scope.postUpdate = function() {
            if (scope.isValidLength()) {
              return;
            }

            scope.showSpinner = true;
            $http.post(gon.urls.fundraiser_new_update, {
              body_html: scope.newUpdate.body,
              post_to_facebook: scope.postToFacebook
            }).then(function onSuccess() {
              scope.showSpinner = false;
              scope.$broadcast('postUpdateFinished');
              flash.addMessage('notice', 'Update posted successfully.');
            }, function onError(response) {
              scope.showSpinner = false;
              scope.serverError = response.data.error;
            });
          };
        }
      };
    }]);
})();

(function () {
  angular.module('campaignPage.dashboard').factory('pcDashboard', ['$http', '$sce', 'gon', function ($http, $sce, gon) {
    var dashboard = {
      fundsData: {
        loaded: false
      },
      underReview: {
        loaded: false
      },
      donationsData: {},
      pillState: null,
      urls: gon.urls
    };

    dashboard.getFunds = function() {
      return $http.get(dashboard.urls.funds_endpoint)
        .success(function(response) {
          dashboard.fundsData.loaded = true;
          dashboard.fundsData.date = response.date;
          dashboard.fundsData.funds = response.funds;
          _.each(dashboard.fundsData.funds, function(fund) {
            fund.destination = $sce.trustAsHtml(fund.destination);
            fund.description = $sce.trustAsHtml(fund.description);
          });
        });
    };

    function loadDonationsUnderReview(pagingOptions) {
      var params = {filter_on_hold: true, page: pagingOptions.page, per_page: pagingOptions.per_page};
      return $http.get(dashboard.urls.donations_endpoint, {params: params})
        .success(function(response) {
          dashboard.underReview.loaded = true;
          dashboard.underReview.pagination = response.pagination;
        });
    }

    dashboard.getDonationsUnderReview = function(pagingOptions) {
      return loadDonationsUnderReview(pagingOptions).then(function (response) {
        dashboard.underReview.donations = response.data.response;
      });
    };

    dashboard.loadMoreDonationsUnderReview = function() {
      var pagination = dashboard.underReview.pagination;
      return loadDonationsUnderReview({page: pagination.next, per_page: pagination.per_page}).then(function (response) {
        response.data.response.forEach(function(donation) {
          dashboard.underReview.donations.push(donation);
        });
      });
    };

    dashboard.getDonations = function(params) {
      var defaultParams = { page: 1, per_page: 20 };
      params = params ? _.merge(defaultParams, params) : defaultParams;

      return $http.get(dashboard.urls.donations_endpoint, {params: params})
        .success(function(response) {
          dashboard.donationsData.pledges = response.response;
          dashboard.donationsData.totalPages = response.pagination.pages;
        });
    };

    dashboard.disbursements = {loaded: false};
    dashboard.getDisbursements = function() {
      $http.get(gon.urls.disbursement_history_endpoint).then(function(response) {
        dashboard.disbursements.loaded = true;
        _.merge(dashboard.disbursements, response.data);
      });
    };

    return dashboard;
  }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('pcFunds', ['i18n', 'pcDashboard', function (i18n, pcDashboard) {
    return {
      templateUrl: 'views/pc-funds.html',
      scope: {},
      link: function(scope) {
        scope.i18n = i18n;
        scope.fundsData = pcDashboard.fundsData;
      }
    };
  }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('pcFundsHeld', [
    'i18n', 'pcDashboard',
    function (i18n, pcDashboard) {
      return {
        templateUrl: 'views/pc-funds-held.html',
        scope: {},
        link: function(scope) {
          scope.i18n = i18n;
          scope.pledges = pcDashboard.underReview.donations;
          scope.totalPages = _.range(1, pcDashboard.underReview.pagination.pages + 1);
          scope.currentPage = 1;

          scope.getHeldDonations = function(page) {
            pcDashboard.getDonationsUnderReview({page: page, per_page: 20}).then(function () {
              scope.pledges = pcDashboard.underReview.donations;
              scope.currentPage = page;
            });
          };

          scope.isCurrentPage = function(page) {
            return scope.currentPage === page;
          };
        }
      };
    }
  ]);
})();

(function() {
  angular.module('campaignPage.dashboard').directive('pcManagementBar',
    ['i18n', 'pcDashboard', function(i18n, pcDashboard) {
      return {
        scope: {},
        link: function(scope, element) {
          var pill = element.find('.i-annotation-pill');
          scope.pcDashboard = pcDashboard;
          scope.$watch('pcDashboard.pillState', function(newVal, oldVal) {
            if (!_.isUndefined(newVal) && !_.isNull(newVal)) {
              pill.attr('class', 'i-annotation-pill ' + newVal.pill_class);
              pill.attr('title', newVal.body_text);
              pill.text(newVal.pill_text);
            }
          });
        }
      };
    }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('pcRecentDonations', ['gon', 'i18n', '$sce', function(gon, i18n, $sce) {
    return {
      templateUrl: 'views/pc-recent-donations.html',
      scope: {},
      link: function (scope) {
        scope.i18n = i18n;
        scope.recentDonations = _.take(gon.fundraiser.donations, 5);
        scope.donationAmountHtml = function(donationAmount) {
          return $sce.trustAsHtml(i18n.t('personal.fundraiser_dashboard.donated_amount', {amount: '<strong>' + donationAmount + '</strong>'}));
        };
      }
    };
  }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('pcTodoItems',
    ['i18n', 'pcDashboard', 'fb', 'gon', 'todoItems', 'twitter', 'gogoEvents', '$modal', 'fbAutopost', '$http',
    function (i18n, pcDashboard, fb, gon, todoItems, twitter, gogoEvents, $modal, fbAutopost, $http) {
      var offlineFundraiserModal;

      return {
        scope: {},
        templateUrl: 'views/pc-todo-items.html',
        link: function(scope) {
          scope.i18n = i18n;
          scope.urls = pcDashboard.urls;
          scope.todoItems = todoItems.get();
          scope.showTips = false;
          scope.relevantHashtagHtml = i18n.t('personal.fundraiser_dashboard.use_a_relevant_hashtag_html', {learn_how_url: scope.urls.help_url});
          scope.showPromotionProgramTodoItem = gon.show_promotion_program_todo_item;
          scope.offlineFundraiserItems = ['hold_an_event', 'raise_awareness', 'share_with_press'];

          scope.toggleShowTips = function() {
            scope.showTips = !scope.showTips;
          };

          scope.clickFacebook = function () {
            var options = gon.current_account? {account_id: gon.current_account.account_id} : {};
            fb.share(pcDashboard.urls.fundraiser_url, options).then(function() {
              todoItems.markCompleted('facebook_share');
              gogoEvents.captureEvent('complete_facebook_todo_item');
              if (gon.urls.schedule_next_post_date_url) {
                $http.put(gon.urls.schedule_next_post_date_url).then(function(response) {
                  fbAutopost.nextPostDate = response.data.next_post_date;
                });
              }
            });
          };

          scope.completeEmailItemCallback = function() {
            todoItems.markCompleted('email_share');
            gogoEvents.captureEvent('complete_email_todo_item');
          };

          scope.completePromotionProgramCallback = function() {
            todoItems.markCompleted('promotion_program');
            gogoEvents.captureEvent('dashboard_promotional_program');
          };

          scope.clickOfflineFundraiser = function() {
            todoItems.markCompleted('offline_fundraiser');
            gogoEvents.captureEvent('dashboard_offline_fundraiser');
            offlineFundraiserModal = $modal({
              template: 'views/pc-offline-fundraiser-modal.html',
              scope: scope
            });
          };

          twitter.onTweet(function() {
            todoItems.markCompleted('twitter_share');
            gogoEvents.captureEvent('complete_twitter_todo_item');
          });
        }
      };
  }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').directive('pcVisitStats', ['i18n', 'gon', '$filter', 'bootstrap', 'browser', function (i18n, gon, $filter, bootstrap, browser) {
    return {
      scope: {},
      templateUrl: 'views/pc-visit-stats.html',
      link: function(scope, element) {
        scope.currentTab = 'today';
        scope.i18n = i18n;
        bootstrap.dropdown(element.find('.pc-dashboard-visitStats-dropdown'));

        var previousKeyForTab = {
          today: 'yesterday',
          this_week: 'last_week'
        };

        scope.tabs = [
          'today', 'this_week', 'total'
        ];

        scope.header = function(tab) {
          return i18n.t('personal.dashboard.visits.tab_headers.' + tab);
        };

        scope.visits = function(tab) {
          var visits = gon.visits[tab];
          if (browser.isMobile() || visits >= 1000000) {
            return $filter('abbrevNumFmt')(visits);
          }
          return $filter('number')(visits);
        };

        scope.percentChange = function(tab) {
          if (tab === 'total') {
            return '';
          }
          var currentCount = gon.visits[tab];
          var initialCount = gon.visits[previousKeyForTab[tab]];
          if (initialCount === 0) {
            return '';
          }
          var change = (currentCount - initialCount) / initialCount;
          return $filter('percentChange')(change);
        };

        scope.changeTab = function(tab) {
          scope.currentTab = tab;
        };
      }
    };

  }]);
}());

(function() {
  'use strict';
  angular.module('campaignPage.dashboard').filter('percentChange', ['$filter', function ($filter) {
    return function(input) {
      var stringValue = $filter('number')(input * 100, 0);
      if (input < 0) {
        return stringValue + '%';
      } else {
        return '+' + stringValue + '%';
      }
    };
  }]);
})();

/* global moment:false */
(function() {
  'use strict';
  angular.module('campaignPage.dashboard').filter('weekOf', [
    'i18n', function(i18n) {
      return function(value) {
        return i18n.t('personal.dashboard.funds.week_of_x', {
          x: moment(value).day(1).format('MMM D, YYYY')
        });
      };
    }
  ]);
})();

(function () {
  'use strict';

  angular.module('campaignPage.desktop').factory('campaignComments', [
    '$http', 'gon', '$sce', '$q', 'campaignPusher', 'ga',
    function($http, gon, $sce, $q, campaignPusher, ga) {
      var service = {};
      var loaded = false;
      var toggleSpamPath = gon.urls.toggle_spam_path;

      function processCommentJson(commentJson) {
        commentJson.comment_html = $sce.trustAsHtml(commentJson.comment_html);
      }

      function load() {
        if (loaded) {
          var deferred = $q.defer();
          deferred.resolve();
          return deferred.promise;
        }

        return $http.get(gon.urls.comments).then(function(result){
          loaded = true;
          var comments = result.data.response;
          comments.forEach(function(comment) {
            processCommentJson(comment);
          });
          service.comments = comments;
          service.pagination = result.data.pagination;
        });
      }

      function loadMore() {
        return $http.get(gon.urls.comments + '?page=' + service.pagination.next).then(function(result) {
          var newComments = result.data.response;
          newComments.forEach(function(comment) {
            comment.comment_html = $sce.trustAsHtml(comment.comment_html);
          });
          service.comments = service.comments.concat(newComments);
          service.pagination = result.data.pagination;
        });
      }

      function deleteComment(comment) {
        return $http.delete(comment.delete_path, comment).then(function(response) {
          service.comments = _.without(service.comments, comment);
        });
      }

      function postComment(newComment) {
        var gaAppearance = newComment.appearance === 'STAP_PRVT' ? 'private' : 'public';
        ga('send', 'event', 'Campaign Comment', 'comment sent - ' + gaAppearance, gon.ga_impression_data.name);
        return $http.post(gon.urls.comments, {comment: newComment}).then(function (response) {
          var responseComment = response.data;
          processCommentJson(responseComment);
          service.comments = [responseComment].concat(service.comments);
        });
      }

      function toggleSpam(comment) {
        return $http.put(toggleSpamPath, {comment: comment});
      }

      campaignPusher.bind('new_comment', function(message) {
        var existingComment = _.findWhere(service.comments, {id: message.comment_id});
        if (!existingComment) {
          $http.get(gon.urls.comments + '/' + message.comment_id).then(function(response) {
            var responseComment = response.data;
            processCommentJson(responseComment);
            service.comments = [responseComment].concat(service.comments);
          });
        }
      });

      service = {
        load: load,
        loadMore: loadMore,
        deleteComment: deleteComment,
        postComment: postComment,
        toggleSpam: toggleSpam,
        allowPublicComments: gon.allow_public_comments
      };

      return service;
    }
  ]);
})();


/* global Pusher */
var campaignPusherService;
/* global campaignPusherService:true */

(function () {
  'use strict';

  angular.module('campaignPage.desktop').factory('pusherWrapper',
    function() {
      return {
        createPusher: function(appId, options) {
          return new Pusher(appId, options);
        }
      };
    }).factory('campaignPusher', [
    'gon', '$window', '$timeout', '$pusher', 'pusherWrapper',
    function(gon, $window, $timeout, $pusher, pusherWrapper) {

      var pusher, channel, pusherTimeout;
      var boundCallbacks = [];

      var createPusher = function() {
        $timeout.cancel(pusherTimeout);
        if (!pusher) {
          pusher = $pusher(pusherWrapper.createPusher(gon.pusher.app_id, gon.pusher.options));
          channel = pusher.subscribe(gon.pusher.channel);
          boundCallbacks.forEach(function(boundCallback) {
            channel.bind(boundCallback.bindMessage, boundCallback.callback);
          });
        }
      };

      var timeoutPusher = function() {
        pusherTimeout = $timeout(function() {
          if (pusher) {
            pusher.disconnect();
            pusher = null;
          }
        }, 1000*30);
      };

      campaignPusherService = {
        start: function() {
          createPusher();
          $window.addEventListener('focus', createPusher);
          $window.addEventListener('blur', timeoutPusher);
        },
        forceStart: createPusher,
        bind: function(bindMessage, callback) {
          boundCallbacks.push({bindMessage: bindMessage, callback: callback});
          if (pusher) {
            channel.bind(bindMessage, callback);
          }
        },
        active: function() {
          return (!!pusher);
        },
        push: function(channelName, json) {
          boundCallbacks.forEach(function(boundCallback) {
            if (boundCallback.bindMessage === channelName) {
              boundCallback.callback(json);
            }
          });
        }
      };
      return campaignPusherService;
  }]);
})();

(function () {
  'use strict';

  angular.module('campaignPage.desktop').directive('campaignShareLinks', [
    '$http', 'gon', 'i18n', 'fb', 'twitter', 'gplus', '$timeout', '$window', 'browser', '$modal', '$sce', '$compile',
    function ($http, gon, i18n, fb, twitter, gplus, $timeout, $window, browser, $modal, $sce, $compile) {

      return {
        scope: {},
        restrict: 'A',
        templateUrl: 'views/campaign-share-links.html',
        link: function(scope, element) {
          var changeFollowingStatus = function (finalStatus, path) {
            var originalStatus = scope.isStartingToFollowProject;
            scope.isStartingToFollowProject = finalStatus;
            $http.post(path).then(function () {
              scope.isFollowingProject = finalStatus;
            }, function () {
              scope.isStartingToFollowProject = originalStatus;
            });
          };

          scope.i18n = i18n;
          scope.share_info = gon.share;
          scope.fbTotalCount = gon.fb_share_count;
          scope.fb_og_active = gon.fb_og_active;
          scope.isFollowingProject = gon.share.following;
          scope.isStartingToFollowProject = scope.isFollowingProject;
          scope.shareLinkUrl = gon.share.sharing_url;
          scope.toggleFollowing = function() {
            if (gon.share.account_id) {
              if (scope.isFollowingProject) {
                changeFollowingStatus(false, gon.urls.campaign_unfollow_path);
              } else {
                changeFollowingStatus(true, gon.urls.campaign_follow_path);
              }
            } else {
              browser.redirectTo(gon.urls.follow_login_path);
            }

          };

          scope.shareFacebook = function() {
            var options = gon.current_account? {account_id: gon.current_account.account_id} : {};
            fb.share(gon.share.canonical_url, options);
          };

          $timeout(function () {
            fb.refreshAllWidgets();
            twitter.refreshAllWidgets();
            gplus.refreshAllWidgets();
          });

          scope.openEmbedModal = function () {
            $modal({
              scope: scope,
              template: 'views/campaign-embed-modal.html'
            });
            $timeout(function () {
              $compile(angular.element('.i-project-card'))(scope);
            });
          };

          scope.projectCardHtml = $sce.trustAsHtml(gon.embed_modal_info.card_html);
          scope.iframeString = gon.embed_modal_info.iframe_html;
          scope.selectTextarea = function () {
            element.get('textarea').select();
          };
        }
      };

    }]);
})();

(function () {
  'use strict';

  angular.module('campaignPage.desktop').directive('campaignShareModal', [
    '$modal', 'i18n', 'gon', '$window',
    function($modal, i18n, gon, $window) {
      var launchEmailAfterHide = false;
      return {
        scope: {},
        replace: true,
        link: function(scope) {
          scope.i18n = i18n;
          scope.share_info = gon.share;
          var modal = $modal({
            scope: scope,
            template: 'views/campaign-share-modal.html',
            show: gon.show_share_modal
          });
          scope.openWindow = function(url) {
            $window.open(url, '', 'width=640, height=480, top=' + ($window.innerHeight / 2 - 480 / 2) +', left=' + ($window.innerWidth / 2 - 640 / 2));
          };

          scope.onEmailClick = function() {
            launchEmailAfterHide = true;
            modal.hide();
          };

          scope.$on('modal.hide', function (event, hidingModal) {
            if (modal === hidingModal) {
              if (launchEmailAfterHide) {
                scope.$broadcast('emailImporter.launch');
                launchEmailAfterHide = false;
              }
            } else {
              modal.show();
            }
          });
        }
      };
    }
  ]);
})();

(function () {
  'use strict';

  angular.module("campaignPage.desktop").directive('contributeButtonGaTracking', [
    'ga', 'gon',
    function (ga, gon) {

      return {
        scope: {
          gaPerkName: '@'
        },
        link: function(scope, element) {
          element.bind('click', function () {
            var coupon;
            if (scope.gaPerkName) {
              coupon = 'Perk | ' + gon.ga_impression_data.name + ' | ' + scope.gaPerkName;
            } else {
              coupon = 'No Perk';
            }
            ga('ec:addProduct', _.merge({}, gon.ga_impression_data, {coupon: coupon}));
            ga('ec:setAction', 'add', {});
            ga('ec:setAction', 'click', {});
            ga('send', 'event', 'Campaign page', 'Contribute button clicked');
          });
        }
      };

    }
  ]);
})();

(function () {
  'use strict';

  angular.module('campaignPage.desktop').directive('desktopApprovalButton', [
    '$modal', 'i18n', 'browser', '$http',
    function($modal, i18n, browser, $http) {
      return {
        scope: {
          approvalHref: '@approvalHref'
        },
        replace: true,
        link: function(scope, element) {
          scope.launchText = i18n.t("campaign_editor.buttons.launch_campaign");

          var showModal = function() {
            $modal({
              scope: scope,
              template: 'views/desktop-approval-button-modal.html'
            });
          };

          scope.publishAndRefresh = function() {
            scope.launchText = i18n.t("campaign_editor.buttons.launching");
            $http.post(scope.approvalHref).then(
              function () {
                browser.refreshPage();
              });
          };

          scope.i18n = i18n;
          element.bind('click', showModal);
        }
      };
    }
  ]);
})();

(function () {
  'use strict';

  angular.module('campaignPage.desktop').directive('desktopCampaignPage', [
    'gon', 'ga', '$window', '$state', '$stateParams',
    function (gon, ga, $window, $state, $stateParams) {

      var gaTracking = function() {
        ga('ec:addImpression', gon.ga_impression_data);
        ga('ec:addProduct', gon.ga_impression_data);
        ga('ec:setAction', 'detail', {});
        ga('set', 'contentGroup1', 'Campaign');
        ga('send', 'pageview', gon.pageview_data.analytics_friendly_url);
      };

      var setupFacebookAnalytics = function(trackingInfo) {
        $window.fb_param = {
          'pixel_id': trackingInfo.fb_pixel_id,
          'value': trackingInfo.amount,
          'currency': trackingInfo.currency_iso_code
        };
      };

      var setupGoogleTracking = function(trackingInfo) {
        $window._gaq = [
          ['campaign._setAccount', trackingInfo.google_analytics_id],
          ['campaign._trackPageview']
        ];
        setTimeout(pushAdjustedBounceEvent, 30000);
      };

      var pushAdjustedBounceEvent = function() {
        $window._gaq.push(['campaign._trackEvent', '30_seconds', 'read']);
      };

      return {
        scope: {},
        link: function(scope) {
          gaTracking();
          if (gon.tracking_info) {
            var trackingInfo = gon.tracking_info;
            if (trackingInfo.fb_pixel_id) {
              setupFacebookAnalytics(trackingInfo);
            }
            if (trackingInfo.google_analytics_id) {
              setupGoogleTracking(trackingInfo);
            }
          }
          function scrollToPerk () {
            var perkIdStr = "#perk_id_" + $stateParams.perkId;
            $("html, body").animate({ scrollTop: $(perkIdStr).offset().top }, 600);
          }

          angular.element(document).ready(function() {
              if($stateParams.perkId) {
                scrollToPerk();
              } else {
                $state.transitionTo('story');
              }
          });
        }
      };

    }]);
})();

(function () {
  'use strict';

  angular.module('campaignPage.desktop').directive('desktopComments', [
    'i18n', '$window', 'flash', 'browser', 'campaignComments', 'gon',
    function (i18n, $window, flash, browser, campaignComments, gon) {

      return {
        scope: {},
        templateUrl: 'views/desktop-comments.html',
        link: function(scope) {
          scope.i18n = i18n;
          scope.gon = gon;
          scope.counterText = function(text, maxLength) {
            return i18n.t("x_of_y", {x: maxLength - text.length, y: maxLength.toString()});
          };
          scope.newComment = {
            comment_html: '',
            appearance: campaignComments.allowPublicComments ? 'STAP_VSBL' : 'STAP_PRVT'
          };
          campaignComments.load().then(function() {
            scope.comments = campaignComments.comments;
            scope.pagination = campaignComments.pagination;
          });

          scope.appearanceClicked = function() {
            if (!campaignComments.allowPublicComments) {
              scope.newComment.appearance = 'STAP_PRVT';
              flash.addMessage('error', i18n.t('you_must_contribute_to_make_public_comment'));
            }
          };

          scope.showMore = function() {
            campaignComments.loadMore().then(function () {
              scope.comments = campaignComments.comments;
              scope.pagination = campaignComments.pagination;
            });
          };

          scope.deleteComment = function(comment) {
            if ($window.confirm(
                i18n.t('deleting_comment_cant_be_undone') + '\n' +
                i18n.t('are_you_sure_you_want_to_continue')
              )) {
              campaignComments.deleteComment(comment).then(function() {
                flash.addMessage('info', i18n.t('delete_success'));
                scope.comments = campaignComments.comments;
              }, function(response) {
                flash.addMessage('error', response.data.error_description);
              });
            }
          };

          scope.postComment = function() {
            campaignComments.postComment(scope.newComment).then(function() {
              scope.newComment.comment_html = '';
              scope.comments = campaignComments.comments;
              flash.addMessage('info', i18n.t('comment_success'));
            }, function(response) {
              if (response.status === 401) {
                browser.redirectTo('/accounts/sign_up');
              } else {
                flash.addMessage('error', response.data.error_description);
              }
            });
          };

          scope.toggleSpam = function (comment) {
            comment.spam = !comment.spam;
            campaignComments.toggleSpam(comment);
          };
        }
      };

    }]);
})();

(function () {
  'use strict';

  angular.module('campaignPage.desktop').directive('desktopFunders', [
    '$http', 'gon', 'i18n',
    function ($http, gon, i18n) {

    return {
      scope: {},
      templateUrl: 'views/desktop-funders.html',
      link: function(scope) {
        scope.i18n = i18n;
        $http.get(gon.urls.funders).then(function(result){
          scope.pledges = result.data.response;
          scope.pagination = result.data.pagination;
        });

        scope.showMore = function() {
          $http.get(gon.urls.funders + '?page=' + scope.pagination.next).then(function(result) {
            scope.pledges = scope.pledges.concat(result.data.response);
            scope.pagination = result.data.pagination;
          });
        };
      }
    };

  }]);
})();

(function () {
  'use strict';

  angular.module('campaignPage.desktop').directive('desktopGallery', [
    '$http', 'gon', 'i18n', '$sce',
    function ($http, gon, i18n, $sce) {

      return {
        scope: {},
        templateUrl: 'views/desktop-gallery.html',
        link: function(scope) {
          scope.i18n = i18n;

          scope.makeCurrentVideo = function(video) {
            scope.currentVideoHtml = $sce.trustAsHtml(video.html);
            scope.currentVideoDescription = video.description;
          };

          scope.selectImage = function(index) {
            scope.currentImageIndex = index;
          };

          scope.nextImage = function() {
            scope.selectImage((scope.currentImageIndex + 1) % scope.images.length);
          };

          $http.get(gon.urls.gallery).then(function(result){
            scope.videos = result.data.videos;
            if(scope.videos.length > 0) {
              scope.makeCurrentVideo(scope.videos[0]);
            }
            scope.images = result.data.images;
            if (scope.images.length > 0) {
              scope.selectImage(0);
            }
            scope.editLink = result.data.edit_link;
          });
        }
      };

    }]);
})();

(function () {
  'use strict';

  angular.module('campaignPage.desktop').directive('desktopProjectFunderCount', [
    'gon', 'campaignPusher',
    function (gon, campaignPusher) {

      return {
        scope: {},
        link: function(scope, element) {
          campaignPusher.bind('balance_changed', function (message) {
            element.find('#js-tab-funders-count').text(message.raised_funders_count);
          });
        }
      };

    }]);
})();

(function () {
  'use strict';

  angular.module('campaignPage.desktop').directive('desktopProjectNutshell', [
    'gon', 'campaignPusher', '$filter',
    function (gon, campaignPusher, $filter) {

      return {
        scope: {},
        link: function(scope, element) {
          campaignPusher.bind('balance_changed', function (message) {
            var newBalance = $filter("iggCurrency")(message.balance, gon.campaign.currency.iso_num, 'separated');
            element.find('.i-balance span.currency span, .i-stats span.currency span').text(newBalance.symbolicValue);
            element.find('.i-balance span.currency em, .i-stats span.currency em').text(newBalance.isoCode);
            element.find('.i-progress-bar .i-complete').css('width', message.nearest_percent + "%");
            element.find('.i-percent').html(message.collected_percentage);
            element.find('.i-raised-funders').text(message.raised_funders);
            element.find('.i-raised-in-time').text(message.raised_in_time);
          });
        }
      };

    }]);
})();

(function() {
  angular.module('campaignPage.desktop').directive('desktopTrustPassport',
    ['i18n', '$http', 'ga', 'bootstrap', 'gon', function(i18n, $http, ga, bootstrap, gon) {
    return {
      scope: {
        loggedIn: '=',
        loginUrl: '@',
        idVerifiedEnabled: '='
      },
      templateUrl: 'views/desktop-trust-passport.html',
      link: function(scope, element) {
        scope.project = _.clone(gon.trust_passport.project);
        scope.owner = _.clone(gon.trust_passport.owner);
        scope.i18n = i18n;
        scope.hasVerifications = false;
        scope.hasWebsites = scope.project.websites.length > 0;
        scope.websites = [];
        scope.currentView = 'project';
        scope.firstName = scope.owner.name.split(' ')[0];
        scope.messageFailed = false;
        scope.message = {
          text: ''
        };
        scope.helpCenterUrl = _.clone(gon.trust_passport.help_center_url);

        // minHeight is the min-height for .i-trustPassport-body.
        var minHeight = 550;
        var contactOwnerEndpointUrl = _.clone(gon.trust_passport.contact_owner_endpoint_url);
        var passportModal = element.find('.i-trustPassport-modal');
        var verifications = [scope.owner.email_verified,
          scope.owner.facebook_friends_count, scope.owner.linkedin_profile_url];

        if (scope.idVerifiedEnabled) {
          verifications.push(scope.owner.admin_verified);
        }

        var websiteGaAction = function(url) {
          var urlMatcher = new RegExp('(.+)\\..+');
          var domain = urlMatcher.exec(url)[1];
          var gaActions = {
            'facebook': 'FBPage',
            'twitter': 'Twitter',
            'youtube': 'Youtube',
            'imdb': 'IMDb'
          };

          var gaAction = gaActions[domain];
          return gaAction || 'Website';
        };

        verifications.forEach(function(verification) {
          if (verification) {
            scope.hasVerifications = true;
          }
        });

        scope.project.team_members.forEach(function(member) {
          var verifications = [member.email_verified,
            member.linkedin_verified, member.facebook_verified];

          if (scope.idVerifiedEnabled) {
            verifications.push(member.admin_verified);
          }

          verifications.forEach(function(verification) {
            if (verification) {
              member.hasVerification = true;
            }
          });
        });

        scope.project.websites.forEach(function(url) {
          var urlMatcher = new RegExp('https?://(?:www.)?(.*)');
          var website = {
            url: url,
            text: urlMatcher.exec(url)[1],
            gaAction: websiteGaAction(urlMatcher.exec(url)[1])
          };

          scope.websites.push(website);
        });

        scope.openModal = function(view) {
          scope.setView(view);
          bootstrap.modal(passportModal, 'show');

          var ownerSection = element.find('.i-trustPassport-owner');
          var sideSection = element.find('.i-trustPassport-sideSection');
          ownerSection.css('height', '');
          sideSection.css('height', '');

          var ownerSectionHeight = ownerSection.height();
          var sideSectionHeight = sideSection.height();

          // account for absolute positioned help center div
          if (view === 'project') {
            sideSectionHeight += 50;
          }

          var maxHeight = _([ownerSectionHeight, sideSectionHeight, minHeight]).max();

          ownerSection.height(maxHeight);
          sideSection.height(maxHeight);
        };

        scope.closeModal = function() {
          passportModal.modal('hide');
        };

        scope.setView = function(view) {
          scope.currentView = view;
        };

        scope.sendMessage = function() {
          $http.post(contactOwnerEndpointUrl, {comment: {text: scope.message.text}}).then(function() {
            scope.setView('message-sent');
            scope.message.text = '';
            scope.messageFailed = false;
          }, function() {
            scope.messageFailed = true;
          });
        };
      }
    };
  }]);
})();


(function () {
  'use strict';

  angular.module('campaignPage.desktop').directive('desktopUpdates', [
    '$http', 'gon', 'i18n', '$sce', 'flash', '$window',
    function ($http, gon, i18n, $sce, flash, $window) {

      return {
        scope: {},
        templateUrl: 'views/desktop-updates.html',
        link: function(scope) {
          scope.i18n = i18n;
          scope.showSpinner = false;
          scope.charLength = 0;
          scope.newUpdate = {bodyHtml: ''};

          $http.get(gon.urls.updates).then(function(result){
            var updates = result.data.response;
            updates.forEach(function(update) {
              update.body_html = $sce.trustAsHtml(update.body_html);
            });
            scope.updates = updates;
            scope.pagination = result.data.pagination;
            scope.editable = result.data.editable;
          });

          scope.$on('redactor:updatedCount', function (event, newLength) {
            scope.charLength = newLength;
          });

          scope.postUpdate = function() {
            if (scope.charLength < 2 || scope.charLength > 2500) {
              return;
            }

            scope.showSpinner = true;
            $http.post(gon.urls.updates, {
              body_html: scope.newUpdate.bodyHtml
            }).then(function(response) {
              scope.showSpinner = false;
              var newUpdate = response.data;
              newUpdate.body_html = $sce.trustAsHtml(newUpdate.body_html);
              scope.updates = [newUpdate].concat(scope.updates);
              scope.$broadcast('postUpdateFinished');
              flash.addMessage('info', i18n.t('successful_announcement_message'));
            }, function(response) {
              scope.showSpinner = false;
              flash.addMessage('error', response.data.error);
            });
          };

          scope.deleteUpdate = function(update) {
            if ($window.confirm(
                i18n.t('deleting_update_cant_be_undone') + '\n' +
                i18n.t('are_you_sure_you_want_to_continue')
              )) {
              $http.delete(update.delete_path, update).then(function(response) {
                flash.addMessage('info', i18n.t('delete_success'));
                scope.updates = _.without(scope.updates, update);
              }, function(response) {
                flash.addMessage('error', response.data.error);
              });
            }
          };


          scope.showMore = function() {
            $http.get(gon.urls.updates + '?page=' + scope.pagination.next).then(function(result) {
              var newUpdates = result.data.response;
              newUpdates.forEach(function(update) {
                update.body_html = $sce.trustAsHtml(update.body_html);
              });
              scope.updates = scope.updates.concat(newUpdates);
              scope.pagination = result.data.pagination;
            });
          };
        }
      };

    }]);
})();

(function () {
  'use strict';

  angular.module("campaignPage.desktop").directive('earlyContribute', [
    'i18n', '$filter',
    function (i18n, $filter) {

      return {
        templateUrl: 'views/early-contribute.html',
        scope: {
          baseContributePath: '@',
          currencySymbol: '@'
        },
        link: function(scope) {
          scope.i18n = i18n;
          scope.placeholderText = scope.currencySymbol + "5, " + scope.currencySymbol +
            "10, " + scope.currencySymbol + "100";

          var userAmountChanged = function(userAmount) {
            if (userAmount) {
              scope.contributeMessage = i18n.t('campaign_page_contribute.contribute') + ' ' + scope.currencySymbol + $filter('number')(userAmount, 0);
              scope.contributeHref = scope.baseContributePath + '?nonperk_amt=' + userAmount;
            } else {
              scope.contributeMessage = i18n.t('contribute_now');
              scope.contributeHref = scope.baseContributePath + '?nonperk_amt=100';
            }
          };

          scope.contribution = {userAmount: null};
          userAmountChanged(scope.contribution.userAmount);
          scope.changeUserAmount = function() {
            userAmountChanged(scope.contribution.userAmount);
          };
        }
      };

    }
  ]);
})();

(function () {
  'use strict';

  angular.module('campaignPage.desktop').provider('storyTabCache', function () {
    var cachedHtml;
    this.cacheHtml = function(element) {
      cachedHtml = element.html();
    };

    this.cachedHtml = function() {
      return cachedHtml;
    };

    this.$get = function() {
      return this;
    };
  });
})();

/* global YT */
(function () {
  'use strict';

  angular.module('campaignPage.desktop').directive('videoOverlay', [
    'youtube', '$sce',
    function(youtube, $sce) {
      return {
        restrict: 'A',
        scope: {
          link: '@videoOverlayLink',
          mediaType: '@videoOverlayMediaType',
          width: '@videoOverlayWidth',
          height: '@videoOverlayHeight'
        },
        templateUrl: 'views/video-overlay.html',
        link: function(scope, element) {
          scope.faded = false;
          scope.playerId = 'youtube_player';
          var $fadeLayer = element.find('.i-fade-layer');

          var fade = function() {
            if(!scope.faded) {
              $fadeLayer.animate({ opacity: '1.0' }, 2500);
              scope.faded = true;
            }
          };

          var startYoutubeOverlay = function() {
            youtube.onReady(function () {
              var player = new YT.Player(scope.playerId, {
                videoId: scope.link,
                height: +scope.height,
                width: +scope.width,
                playerVars: {
                  rel: 0,
                  showinfo: 0,
                  autoplay: 1,
                  modestbranding: 1
                },
                events: {
                  'onReady': function (e) {
                    player.playVideo();
                  },
                  'onStateChange': function (e) {
                    fade();
                  }
                }
              });
            });
          };

          scope.showVideo = function () {
            fade();
            if (scope.mediaType === 'MDIA_YTPC') {
              startYoutubeOverlay();
            } else {
              var vimeoUrl = '//player.vimeo.com/video/' + scope.link + '?autoplay=1';
              var $iframe = angular.element('<iframe src="' +
                vimeoUrl + '" width="' + scope.width +
                '" height="' + scope.height + '" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>');
              $fadeLayer.append($iframe);
            }
          };
        }
      };
    }
  ]);
})();

(function() {
  angular.module('campaignPage.life').directive('backToTop', ['browser',
    function (browser) {
      return {
        restrict: 'A',
        scope: {},
        replace: true,
        template: '<a ng-transclude href="" ng-click="scrollToTop()"></a>',
        transclude: true,
        link: function (scope) {
          scope.scrollToTop = function () {
            browser.scrollToTop();
          };
        }
      };
    }]
  );
}());

(function () {
  angular.module('campaignPage.utils').factory('pcCampaign', ['$http', '$sce', 'i18n', 'gon', function ($http, $sce, i18n, gon) {
    var campaignJson;
    var donationsPage = 2;
    var changeCallbacks = [];
    var service = {
      setCampaignJson: function(newCampaignJson) {
        campaignJson = newCampaignJson;
        donationsPage = 2;
        _(campaignJson.updates).each(function(update) {
          update.body_html = $sce.trustAsHtml(update.body_html);
        });
        for (var i=0; i<changeCallbacks.length; ++i) {
          changeCallbacks[i]();
        }
      },
      onChange: function(func) {
        changeCallbacks.push(func);
      },
      descriptionHtml: function() {
        return campaignJson.description_html;
      },
      updates: function() {
        return campaignJson.updates;
      },
      donations: function() {
        return campaignJson.donations;
      },
      donationsCount: function () {
        return campaignJson.donations_count;
      },
      hasDeadline: function() {
        return campaignJson.has_deadline;
      },
      json: function () {
        return campaignJson;
      },
      fetchDonations: function () {
        return $http.get(gon.urls.fundraiser_json, {params: {locale: i18n.locale, donations_page: donationsPage++}}).then(function(response) {
          campaignJson.donations = campaignJson.donations.concat(response.data.fundraiser.donations);
          campaignJson.donationsCount = response.data.fundraiser.donations_count;
        });
      },
      deleteUpdate: function(update) {
        return $http.delete(update.delete_path).then(function(response) {
          service.setCampaignJson(response.data.fundraiser);
        });
      },
      refresh: function() {
        return $http.get(gon.urls.fundraiser_json, {params: {locale: i18n.locale}}).then(function(response) {
          service.setCampaignJson(response.data.fundraiser);
        });
      }
    };

    return service;
  }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.life').directive('pcPostUpdate',
    ['pcCampaign', 'i18n', '$http', 'gon', function (pcCampaign, i18n, $http, gon) {
      return {
        restrict: 'A',
        scope: {},
        templateUrl: 'views/pc-post-update.html',
        link: function(scope) {
          scope.i18n = i18n;
          scope.showSpinner = false;
          scope.charLength = 0;
          scope.serverError = null;

          scope.$on('redactor:updatedCount', function (event, newLength) {
            scope.charLength = newLength;
            scope.serverError = null;
          });

          scope.postUpdate = function() {
            if (scope.charLength < 2 || scope.charLength > 1500) {
              return;
            }

            scope.showSpinner = true;
            $http.post(gon.urls.fundraiser_new_update, {
              body_html: scope.newUpdate
            }).then(function(response) {
              scope.showSpinner = false;
              pcCampaign.setCampaignJson(response.data.fundraiser);
              scope.$broadcast('postUpdateFinished');
            }, function(response) {
              scope.showSpinner = false;
              scope.serverError = response.data.error;
            });
          };
        }
      };
  }]);
}());

(function() {
  'use strict';
  angular.module('campaignPage.life').directive('pcStory', ['i18n', '$sce', 'gon', function (i18n, $sce, gon) {
    return {
      restrict: 'A',
      scope: {
        truncationLength: '=',
        showTagline: '='
      },
      templateUrl: 'views/pc_story.html',
      link: function(scope) {
        var description = gon.description_html;

        scope.i18n = i18n;

        if(scope.showTagline && gon.tagline) {
          scope.truncated = true;
          scope.campaignStoryHtml = $sce.trustAsHtml(gon.tagline);
        } else {
          scope.truncated = description.length > scope.truncationLength;

          if(scope.truncated) {
            scope.campaignStoryHtml = $sce.trustAsHtml(description.substring(0, scope.truncationLength) + '...');
          } else {
            scope.campaignStoryHtml = $sce.trustAsHtml(description.substring(0, scope.truncationLength));
          }
        }

        scope.showMore = function () {
          var tagline = (scope.showTagline && gon.tagline) ? gon.tagline : "";
          scope.campaignStoryHtml = $sce.trustAsHtml(tagline + description);
          scope.truncated = false;
        };
      }
    };
  }]);
}());

(function() {
  angular.module('campaignPage.life').factory('campaignOwner', ['$http', function ($http) {
    var campaignOwner = gon.campaign_owner;

    campaignOwner.sendMessage = function(message) {
      return $http.post(gon.urls.contact_owner, {comment: {text: message}});
    };

    return campaignOwner;
  }]);
})();

(function() {
  angular.module('campaignPage.life').directive('pcContact',
    ['pcCampaign', 'i18n', 'modals', 'campaignOwner', 'flash', '$sce', 'gon',
      function (pcCampaign, i18n, modals, campaignOwner, flash, $sce, gon) {
    return {
      restrict: 'A',
      templateUrl: 'views/pc_contact.html',
      scope: {
        owner: "@pcContactOwner"
      },
      link: function (scope) {
        scope.i18n = i18n;
        scope.message = { text: '' };
        scope.loginPath = gon.urls.login_url;
        scope.$sce = $sce;

        scope.sendMessage = function(message) {
          campaignOwner.sendMessage(message).then(function() {
            scope.closeModal();
            scope.message.text = '';
            flash.addMessage('notice', i18n.t("personal.your_message_was_sent", {x: campaignOwner.name}));
          }, function() {
            scope.closeModal();
            flash.addMessage('error', i18n.t('something_went_wrong'));
          });
        };

        scope.contactOwner = function() {
          if (gon.current_account) {
            modals.openModal('pc-contact-modal');
          } else {
            modals.openModal('pc-plz-sign-in-modal');
          }
        };

        scope.closeModal = function() {
          modals.closeCurrentModal();
        };
      }
    };
  }]);
}());

 (function() {
  'use strict';
  angular.module('campaignPage.life').directive('pcDonations', ['pcCampaign', 'i18n', '$sce', function (pcCampaign, i18n, $sce) {
    return {
      restrict: 'A',
      scope: {
        donationsCount: "@pcDonationsCount"
      },
      transclude: true,
      templateUrl: 'views/pc_donations.html',
      link: function(scope, element, attrs,  nullController, transclude) {
        var SHOW_MORE_AMOUNT = 5;
        var DONATIONS_BUFFER_AMOUNT = 10;

        scope.compressedMobile = true;
        transclude(scope, function(clone) {
          var donations = [];
          _(clone.find(".pc-donation")).each(function(donationNode) {
            var $node = angular.element(donationNode);
            var donation = {
              amount: $node.find(".pc-donation-amt").text(),
              photo_url: $node.find(".pc-donation-photo").attr("src"),
              timestamp: $node.find(".pc-donation-timestamp").text(),
              name: $node.find(".pc-donation-name").text(),
              comment: $node.find(".pc-donation-comment").text()
            };
            donations.push(donation);
          });
          scope.shownDonations = donations;
        });

        scope.i18n = i18n;

        scope.showMore = function() {
          var allDonations = pcCampaign.donations();
          if (scope.shownDonations.length + DONATIONS_BUFFER_AMOUNT > allDonations.length &&
            allDonations.length < pcCampaign.donationsCount()) {
              pcCampaign.fetchDonations().then(function() {
              scope.donationsCount = pcCampaign.donationsCount();
            });
          }

          scope.shownDonations = allDonations.slice(0, scope.shownDonations.length + SHOW_MORE_AMOUNT);
        };

        scope.toggleMobile = function() {
          scope.compressedMobile = !scope.compressedMobile;
        };
      }
    };
  }]);
}());

(function() {
  'use strict';
  angular.module('campaignPage.life')
    .directive('pcFbShare', ['$http', 'i18n', 'fb', 'gon',
      function($http, i18n, fb, gon) {
      return {
        templateUrl: 'views/pc_fb_share.html',
        scope: {},
        transclude: true,
        link: function (scope, element, attrs, controller, transclude) {
          transclude(function(clone) {
            scope.buttonText = clone.filter(".pc-social-text").text();
          });

          scope.fbTotalCount = gon.fb_share_count;
          scope.i18n = i18n;

          scope.shareFacebook = function() {
            var options = gon.current_account ? {account_id: gon.current_account.account_id} : {};
            fb.share(gon.urls.fundraiser_url, options).then(function() {
              var account = gon.current_account || {};
              var isFundraiserOwner = account.account_id === gon.campaign_owner.id;
              if (isFundraiserOwner && gon.urls.schedule_next_post_date_url) {
                $http.put(gon.urls.schedule_next_post_date_url);
              }
            });
          };
        }
      };
    }]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.life').directive('pcUpdates', ['pcCampaign', 'i18n', '$sce', '$window', function (pcCampaign, i18n, $sce, $window) {
    return {
      restrict: 'A',
      scope: {
        count: "@pcUpdatesCount"
      },
      transclude: true,
      templateUrl: 'views/pc_updates.html',
      link: function(scope, element, attrs, nullController, transclude) {
        transclude(scope, function(clone) {
          var update = clone.find(".pc-update");
          scope.updates = [
            {
              timestamp: update.find(".pc-update-timestamp").text(),
              title: update.find(".pc-update-title").text(),
              body_html: $sce.trustAsHtml(update.find(".pc-update-body").html())
            }
          ];
          scope.showOneUpdate = true;
        });

        scope.compressedMobile = true;
        scope.i18n = i18n;

        scope.visibleUpdates = function () {
          return (scope.showOneUpdate ? scope.updates.slice(0, 1) : scope.updates);
        };

        scope.showMore = function () {
          scope.showOneUpdate = false;
        };

        scope.toggleMobile = function() {
          scope.showOneUpdate = false;
          scope.compressedMobile = !scope.compressedMobile;
        };

        pcCampaign.onChange(function() {
          scope.updates = pcCampaign.updates();
          scope.count = scope.updates.length;
        });

        scope.showDeleteConfirmation = function(update) {
          var confirmed = $window.confirm(i18n.t('deleting_update_cant_be_undone') + '\n' + i18n.t('are_you_sure_you_want_to_continue'));

          if(confirmed) {
            pcCampaign.deleteUpdate(update);
          }
        };
      }
    };
  }]);
}());

(function () {
  'use strict';
  angular.module('campaignPage.mobile').directive('campaignBasicInfo', ['ga', 'campaign', '$state', 'i18n', 'gon', '$rootScope', function (ga, campaign, $state, i18n, gon, $rootScope) {
    return {
      restrict: 'A',
      transclude: false,
      replace: false,
      scope: {},
      templateUrl: 'views/campaign-basic-info.html',
      link: function (scope, element) {
        scope.campaign = campaign;
        scope.i18n = i18n;
        scope.campaignFollowPath = gon.urls.campaign_follow_path;
        scope.campaignUnfollowPath = gon.urls.campaign_unfollow_path;
        scope.campaignFbLoginFollowPath = gon.urls.campaign_fb_login_follow_path;
        scope.loadingFollowAsync = false;
        scope.loggedIn = gon.logged_in;

        scope.followToggle = function () {
          scope.loadingFollowAsync = true;

          var stopSpinner = function (errorStatus) {
            scope.loadingFollowAsync = false;

            if (errorStatus == 401) {
              element.find('[campaign-login]').removeClass("i-hidden");
              element.find('.i-login-modal').addClass('i-pop-in-modal');
            } else {
              var followStatusMessage;
              if (scope.campaign.followed) {
                followStatusMessage = i18n.t("tracking_success", {title: campaign.title, email: gon.current_user_email});
                ga.apply(this, ['send', 'event', 'Mobile Web Campaign Page', 'Successful Follow']);
              } else {
                followStatusMessage = i18n.t("remove_tracking_success", {title: campaign.title});
                ga.apply(this, ['send', 'event', 'Mobile Web Campaign Page', 'Successful Unfollow']);
              }
              $rootScope.$broadcast('campaignNotification', followStatusMessage);
            }
          };

          if (campaign.followed) {
            campaign.unfollow(stopSpinner);
          } else {
            campaign.follow(stopSpinner);
          }
        };

        scope.campaignCategory = function() {
          return scope.campaign.category.toLowerCase().replace(' / ','');
        };

        if (gon.follow_after_load && !campaign.followed) {
          scope.followToggle();
        }
      }
    };
  }]);
}());

(function () {
  'use strict';
  angular.module('campaignPage.mobile').directive('campaignContact', ['gon', 'i18n', '$http', '$state', '$rootScope', '$timeout', function (gon, i18n, $http, $state, $rootScope, $timeout) {
    return {
      restrict: 'A',
      scope: {},
      transclude: false,
      replace: false,
      templateUrl: 'views/campaign-contact.html',
      link: function (scope) {
        scope.i18n = i18n;
        scope.owner = _.clone(gon.trust_passport.owner);
        scope.message = {
          text: ''
        };

        var contactOwnerEndpointUrl = _.clone(gon.trust_passport.contact_owner_endpoint_url);

        scope.sendMessage = function () {
          $http.post(contactOwnerEndpointUrl, {comment: {text: scope.message.text}}).then(
            function () {
              returnToMainStateAndNotify('trust_passport.your_message_has_been_sent');
            }, function () {
              returnToMainStateAndNotify('trust_passport.sorry_somethings_wrong_on_our_end');
            }
          );
        };

        var returnToMainStateAndNotify = function (translation_id) {
          $state.go('main').then(function () {
            // Send the event after the current digest cycle, so that it takes effect after the state changes
            $timeout(function () {
              $rootScope.$broadcast('campaignNotification', i18n.t(translation_id));
            });
          });
          scope.message.text = '';
        };

      }
    };
  }]);
}());

(function() {
  'use strict';
  angular.module('campaignPage.mobile').directive('campaignFundingInfo', ['$filter', 'campaign', 'i18n', 'gon', 'ga', 'fb', function ($filter, campaign, i18n, gon, ga, fb) {
    return {
      restrict: 'A',
      transclude: false,
      scope: {},
      templateUrl: 'views/campaign-funding-info.html',
      link: function(scope, element, attrs,  nullController, transclude) {
        scope.iggCurrency = $filter('iggCurrency');
        scope.campaign = campaign;
        scope.i18n = i18n;
        scope.campaignContributionPath = gon.urls.campaign_contribution_path;
        scope.campaignPath = gon.share ? gon.share.canonical_fb_url : encodeURI(window.location.href);
        scope.showMobileShareButton = gon.show_mobile_share_button;

        var percentFunding = function() {
          if(campaign.goal === 0) {
            return 0;
          } else {
            return campaign.collected_funds / campaign.goal * 100;
          }
        };

        scope.shareFacebook = function() {
          var options = {
            "redirect_uri": scope.campaignPath,
          };

          fb.share(scope.campaignPath, options).then(function() {
            ga('send', 'social', {
              'socialNetwork': 'facebook_mobileweb',
              'socialAction': 'share',
              'socialTarget': scope.campaignPath,
            });
          });
        };

        scope.progressBarWidth = function() {
          var percent = percentFunding();
          if (0 < percent && percent < 5) {
            return 2;
          } else {
            var nearest_5_percent = Math.floor(percent / 5)*5;
            return Math.min(100, nearest_5_percent);
          }
        };

        scope.timeLeft = function() {
          var timeValues = {
            amount: null,
            unit: null
          };

          if (campaign.funding_ends_at) {
            var now = new Date();
            var difference = campaign.funding_ends_at.getTime() - now.getTime();
            var daysLeft = difference / (1000.0 * 60 * 60 * 24);
            var hoursLeft = difference / (1000.0 * 60 * 60);
            var minutesLeft = difference / (1000.0 * 60);

            if (daysLeft >= 3 && hoursLeft > 72) {
              timeValues.amount = Math.round(daysLeft);
              timeValues.unit = i18n.t("days_remaining");
            } else if (hoursLeft >= 1) {
              timeValues.amount = Math.round(hoursLeft);
              timeValues.unit = timeValues.amount == 1 ? i18n.t("hour_remaining") : i18n.t("hours_remaining");
            } else if (minutesLeft >= 1) {
              timeValues.amount = Math.round(minutesLeft);
              timeValues.unit = timeValues.amount == 1 ? i18n.t("minute_remaining") : i18n.t("minutes_remaining");
            } else {
              timeValues.amount = 0;
              timeValues.unit = i18n.t("days_remaining");
            }
          } else {
            timeValues.amount = 0;
            timeValues.unit = i18n.t("days_remaining");
          }

          return timeValues;
        };

        scope.stringForNumberOfFunders = function() {
          return campaign.contributions_count == 1 ? i18n.t("project_card.funder") : i18n.t("project_card.funders");
        };

        scope.fundingType = function() {
          if(campaign.funding_type === 'fixed') {
            return i18n.t("fixed_funding");
          } else if(campaign.funding_type === 'flexible') {
            return i18n.t("flexible_funding");
          }
        };

        scope.fundingBlurb = function() {
          var goalReached = campaign.collected_funds >= campaign.goal;

          if(campaign.state() === campaign.states.ended && goalReached) {
            return i18n.t('flex_or_fixed_hit_goal_expired_blurb');
          }

          if(campaign.state() === campaign.states.ended) {
            // Goal is not reached
            if(campaign.funding_type === 'fixed') {
              return i18n.t('fixed_didnt_hit_goal_expired_blurb', {agent_show_goal: scope.iggCurrency(campaign.goal, campaign.currency.iso_num, null)});
            }
            else if(campaign.funding_type === 'flexible') {
              return i18n.t('flex_or_fixed_hit_goal_expired_blurb');
            }
          }
          else {
            if(campaign.funding_type === 'fixed') {
              if(goalReached) {
                return i18n.t('fixed_campaign_hit_goal_still_funding_blurb');
              }
              else {
                return i18n.t('fixed_still_funding_hasnt_hit_goal_blurb', {agent_show_goal: scope.iggCurrency(campaign.goal, campaign.currency.iso_num, null)});
              }
            }
            else if(campaign.funding_type === 'flexible') {
              return i18n.t('flex_campaign_still_funding_blurb');
            }
          }
        };

        scope.foreverFundingBlurb = function() {
          var blurb;

          if (campaign.is_external_campaign) {
            var display_end_date = new Date(campaign.external_campaign_info.external_end_date);

            blurb = i18n.t("funded_on_another_platform_on", {
              "date": $filter('date')(display_end_date, 'MMMM d, yyyy')
            });
          } else {
            blurb = i18n.t("percent_funded_on_end_date", {
              "percent":  (Math.round(percentFunding()) + '%'),
              "end_date": $filter('date')(campaign.funding_ends_at, 'MMMM d, yyyy')
            });
          }

          return blurb;
        };

        var facebookFriendNameWithLink = function(fb_friend) {
          var url = "/individuals/" + fb_friend.id;
          var html = "<a href='" + url + "'>" + fb_friend.name + "</a>";
          return html;
        };

        scope.facebookFriendContributor = function() {
          var numContributors = campaign.facebook_friend_contributors.length;
          if (numContributors === 0) {
            return null;
          }

          var contributor = campaign.facebook_friend_contributors[0];
          var nameWithLink = facebookFriendNameWithLink(contributor);

          var nameWithCount = (function() {
            if(numContributors == 2) {
              return i18n.t('project_card.funded.one_html', {
                name_with_link: nameWithLink,
                count: numContributors - 1
              });
            }
            else if (numContributors == 1) {
              return i18n.t('project_card.funded.zero_html', {
                name_with_link: nameWithLink
              });
            }
            else {
              return i18n.t('project_card.funded.other_html', {
                name_with_link: nameWithLink,
                count: numContributors
              });
            }
          })();

          return _.assign(contributor, { nameWithCount: nameWithCount });
        };

        scope.inDemandCTA = function() {
          return campaign.perks_available ? i18n.t('select_perk') : i18n.t('contribute_now');
        };

        scope.onDateText = function(date) {
          var formattedDate = $filter('date')(date, 'MMMM d, yyyy');
          return i18n.t('on_date', { date: formattedDate });
        };
      }
    };
  }]);
}());

(function() {
  'use strict';
  angular.module('campaignPage.mobile').directive('campaignLogin', ['campaign', '$state', 'i18n', function (campaign, $state, i18n) {
    return {
      restrict: 'A',
      scope: {},
      transclude: false,
      replace: false,
      templateUrl: 'views/campaign-login-modal.html',
      link: function(scope, element, attrs,  nullController, transclude) {
        scope.campaign = campaign;
        scope.i18n = i18n;
        scope.path = attrs.path;

        scope.hideModal = function() {
          $(element).addClass("i-hidden");
        };

        element.bind('click', function(e){
          if(e.target !== this) {
            return;
          }
          scope.hideModal();
        });
      }
    };
  }]);
}());

(function () {
  'use strict';
  angular.module('campaignPage.mobile').directive('campaignMain', ['campaign', 'gon', function (campaign, gon) {
    return {
      restrict: 'E',
      scope: {},
      templateUrl: 'views/main-dynamic.html',
      link: function (scope) {
        scope.mobileTrustPassport = gon.mobile_trust_passport_enabled;
      }
    };
  }]);
})();

(function () {
  'use strict';
  angular.module('campaignPage.mobile').directive('campaignModal', ['$sce', 'browser', function ($sce, browser) {
    return {
      restrict: 'A',
      transclude: false,
      replace: false,
      scope: {
        message: "@"
      },
      templateUrl: 'views/campaign-modal.html',
      link: function (scope) {
        scope.modalVisible = false;

        scope.$on('campaignNotification', function (event, message) {
          browser.scrollToTop();
          scope.trustedMessage = $sce.trustAsHtml(message);
          scope.modalVisible = true;
        });

        scope.hideModal = function () {
          scope.modalVisible = false;
        };

      }
    };
  }]);
}());

(function() {
  'use strict';
  angular.module('campaignPage.mobile')
  .directive('campaignPerks', ['campaign', 'i18n', '$sce', 'perkFactory', 'gon', '$stateParams', '$state', function (campaign, i18n, $sce, PerkFactoryPerk, gon, $stateParams, $state) {
    return {
      restrict: 'A',
      scope: {},
      transclude: false,
      replace: false,
      templateUrl: 'views/campaign-perks.html',
      link: function(scope, element, attrs,  nullController, transclude) {
        var processPerks = function(perks) {
          return _.map(perks, function(perkAttrs){
            var perk = new PerkFactoryPerk(perkAttrs, {
              createDropdownCountryObjects: false
            });
            perk.expanded = perk.featured;
            return perk;
          });
        };

        function scrollToPerk () {
          var perkIdStr = "#perk_id_" + $stateParams.perkId;
          $("html, body").animate({ scrollTop: $(perkIdStr).offset().top }, 600);
        }

        angular.element(document).ready(function() {
            if($stateParams.perkId) {
              scrollToPerk();
            } else {
              $state.transitionTo('main');
            }
        });

        scope.campaign = campaign;
        scope.i18n = i18n;
        scope.perks = processPerks(campaign.perks);

        scope.gaEventLabelForPerk = function(perk) {
          var eventLabel = [];
          if(perk.featured) {
            eventLabel.push('Featured');
          }

          if(!perk.featured) {
            eventLabel.push('Non-Featured');
          }

          if(perk.sold_out) {
            eventLabel.push('Sold-Out');
          }

          if(campaign.state() === campaign.states.ended) {
            eventLabel.push('Ended');
          }

          return eventLabel.join(" ");
        };

        scope.contributionFlowWithPerk = function(perk) {
          if(gon.responsive_contribution_flow) {
            return $sce.trustAsUrl(gon.urls.campaign_contribution_path + "/#/contribute?perk_amt=" + perk.amount + "&perk_id=" + perk.id);
          }
          else {
            return $sce.trustAsUrl(gon.urls.campaign_contribution_path + "?perk_amt=" + perk.amount + "&perk_id=" + perk.id);
          }
        };

        scope.capClaimedPerks = function(perk) {
          return Math.min(perk.number_claimed, perk.number_available);
        };
      }
    };
  }]);
}());

(function() {
  'use strict';
  angular.module('campaignPage.mobile').directive('campaignPitchmedia', ['$sce', 'campaign', 'gon', function ($sce, campaign, gon) {
    return {
      restrict: 'A',
      scope: {},
      transclude: false,
      replace: false,
      templateUrl: 'views/campaign-pitchmedia.html',
      link: function(scope, element, attrs,  nullController, transclude) {
        scope.campaign = campaign;
        scope.campaign_pitch_image = gon.urls.pitch_image_url || "";
        scope.videoHeight = campaign.main_video_info.type === 'vimeo' ? '150px' : '180px';
      }
    };
  }]);
}());

(function() {
  'use strict';
  angular.module('campaignPage.mobile').directive('campaignStory', ['campaign', 'i18n', function (campaign, i18n) {
    return {
      restrict: 'A',
      scope: {},
      transclude: false,
      replace: false,
      templateUrl: 'views/campaign-story.html',
      link: function(scope, element, attrs, nullController) {
        scope.campaign = campaign;
        scope.i18n = i18n;
        scope.campaignContributionPath = gon.urls.campaign_contribution_path;

        scope.showContributeSection = function() {
          return campaign.nonprofit ||
                 campaign.partner_name ||
                 campaign.state() === campaign.states.draft ||
                 campaign.state() === campaign.states.published ||
                 campaign.state() === campaign.states.inDemand;
        };

        scope.showContributeButton = function() {
          return !campaign.funding_invalid_yet_live &&
           (campaign.state() === campaign.states.published || campaign.state() === campaign.states.inDemand);
         };
      }
    };
  }]);
}());

(function () {
  'use strict';
  angular.module('campaignPage.mobile').directive('campaignTags', [
    'gon', 'i18n', 'campaign',
    function (gon, i18n, campaign) {
      return {
        replace: true,
        scope: { },
        templateUrl: 'views/campaign-tags.html',
        link: function(scope) {
          scope.i18n = i18n;
          scope.campaign = campaign;
        }
      };
    }
  ]);
})();


(function() {
  'use strict';
  angular.module('campaignPage.mobile').directive('campaignTeamMembers', ['campaign', '$sce', 'i18n', function (campaign, $sce, i18n) {
    return {
      restrict: 'A',
      scope: {},
      transclude: false,
      replace: false,
      templateUrl: 'views/campaign-team-members.html',
      link: function(scope, element, attrs,  nullController, transclude) {
        var processTeamMembers = function(teamMembers) {
          teamMembers[0].expanded = true;
          return teamMembers;
        };

        scope.$sce = $sce;
        scope.i18n = i18n;
        scope.campaign = campaign;
        scope.campaign.team_members = processTeamMembers(campaign.team_members);
      }
    };
  }]);
}());

(function() {
  'use strict';
  angular.module('campaignPage.mobile').directive('campaignTrustPassport', ['campaign', 'i18n', 'gon', '$state', 'browser', function (campaign, i18n, gon, $state, browser) {
    return {
      restrict: 'A',
      scope: {},
      transclude: false,
      replace: false,
      templateUrl: 'views/campaign-trust-passport.html',
      link: function(scope) {
        scope.i18n = i18n;
        scope.campaign = campaign;
        scope.campaignContributionPath = gon.urls.campaign_contribution_path;
        scope.owner = _.clone(gon.trust_passport.owner);
        scope.project = _.clone(gon.trust_passport.project);
        scope.loggedIn = _.clone(gon.logged_in);
        scope.loginUrl = _.clone(gon.login_url);

        var verifications = [
          scope.owner.email_verified,
          scope.owner.facebook_friends_count,
          scope.owner.linkedin_profile_url
        ];
        verifications.forEach(function (verification) {
          if (verification) {
            scope.hasVerifications = true;
          }
        });

        scope.contact = function () {
          $state.go('contact').then(function () {
            browser.scrollToTop();
          });
        };

        scope.websites = [];
        scope.project.websites.forEach(function (url) {
          var urlMatcher = new RegExp('https?://(?:www.)?(.*)');
          var website = {
            url: url,
            text: urlMatcher.exec(url)[1]
          };
          scope.websites.push(website);
        });

        scope.teamMemberDetailsVisibility = {};
        gon.trust_passport.project.team_members.forEach(function (team_member) {
          scope.teamMemberDetailsVisibility[team_member.id] = false;
        });
        scope.teamMemberDetailsAreVisible = function (id) {
          return scope.teamMemberDetailsVisibility[id];
        };
        scope.showTeamMemberDetails = function (id) {
          scope.teamMemberDetailsVisibility[id] = true;
        };
        scope.hideTeamMemberDetails = function (id) {
          scope.teamMemberDetailsVisibility[id] = false;
        };

      }
    };
  }]);
}());

(function () {
  'use strict';
  angular.module('campaignPage.mobile').directive('campaignTrustTeaser', ['i18n', '$state', 'browser', function (i18n, $state, browser) {
    return {
      restrict: 'A',
      scope: {},
      templateUrl: 'views/campaign-trust-teaser.html',
      link: function(scope) {
        scope.i18n = i18n;
        scope.owner = _.clone(gon.trust_passport.owner);
        scope.project = _.clone(gon.trust_passport.project);

        scope.seeMoreDetails = function () {
          $state.go('trust_passport').then(function () {
            browser.scrollToTop();
          });
        };
      }
    };
  }]);
}());

/* global YT */
(function() {
  'use strict';

  angular.module('campaignPage.mobile').directive('campaignVideo', ['$sce', 'youtube', 'ga', function ($sce, youtube, ga) {
    return {
      restrict: 'A',
      scope: {},
      templateUrl: 'views/campaign-video.html',
      link: function(scope, element, attrs) {
        var player;

        scope.overlayUrl = attrs.overlayUrl;
        scope.type = attrs.type;
        scope.videoPlaying = false;

        scope.vimeo_video_url = $sce.trustAsResourceUrl('//player.vimeo.com/video/' + attrs.id + '?api=1&amp;player_id=vimeoPlayer&amp;title=0&amp;byline=0&amp;portrait=0');
        scope.videoHeight = scope.type === 'vimeo' ? '150px' : '180px';

        if (scope.type === 'youtube') {
          youtube.onReady(function() {
            player = new YT.Player('i-campaign-video-youtube', {
              width: '320',
              height: '180',
              videoId: attrs.id,
              playerVars: {
                rel: 0,
                showinfo: 0,
                autoplay: 0,
                modestbranding: 1,
                fs: 1,
                wmode: 'opaque'
              }
            });
          });
        }

        scope.playVideo = function() {
          ga.apply(this, ['send', 'event', 'Mobile Web Campaign Page', 'Play Video']);
          scope.videoPlaying = true;
          if (scope.type === 'youtube' && player) {
            //the YouTube API should have instantiated a player object that has a playVideo() function
            player.playVideo();
          } else if (scope.type === 'vimeo') {
            // post a message to the vimeo API
            var vimeoPlayer = element.find('#vimeoPlayer')[0];
            var url = vimeoPlayer.src.split('?')[0];
            vimeoPlayer.contentWindow.postMessage({ method: 'play' }, url);
          }
        };
      }
    };
  }]);
}());

//  This is a sample interface for how this directive should work:
// <collapsable image-url="…" title="" subtitle="" collapsed="">
//     I am <strong>lovely</strong> inner content!
// </collapsable>
//
//  If no image is specificed, no sidebar is rendered.
//  If no inner content is supplied, no collapse controls are created.
//  `collapsed` controls the initial collapsed state of the directive.
//
// <collapsable title="" subtitle="" collapsed="" show-collapse-control="">
//     <collapsable-side>
//       <div class="custom-thing"></div>
//     </collapsable-side>
//     I am <strong>lovely</strong> inner content!
// </collapsable>

(function() {
  'use strict';
  angular.module('campaignPage.mobile').directive('collapsable', ['$compile', function ($compile) {
    return {
      restrict: 'E',
      scope: {
        imageUrl: "@",
        title: "@",
        subtitle: "@",
        collapsed: "@",
        glyphClass: "@",
        hasContent: "@",
        gaCategory: "@",
        gaEvent: "@"
      },
      transclude: true,
      templateUrl: 'views/collapsable.html',
      link: function(scope, element, attrs,  nullController, transclude) {
        scope.hasExpandableContent = (scope.hasContent === 'true');
        scope.showCollapseControl = scope.hasExpandableContent;

        var itemCollapsed = true;
        if (scope.collapsed) {
          itemCollapsed = (scope.collapsed === 'true');
        }

        scope.itemOpen = scope.hasExpandableContent && !(itemCollapsed);

        scope.toggleItemOpen = function() {
          scope.itemOpen = !scope.itemOpen;
        };
      }
    };
  }]);
}());

(function () {
  angular.module('campaignPage.mobile').factory('campaign', ['$sce', '$http', 'gon', function($sce, $http, gon) {

    var formatLocation = function(campaign) {
      var locationArray = [];
      if (campaign.city) {
        locationArray.push(campaign.city);
      }
      if (campaign.region) {
        locationArray.push(campaign.region);
      }
      if (campaign.country) {
        locationArray.push(campaign.country);
      }

      return locationArray.join(", ");
    };

    var postFollow = function(self, followUrl, newFollowState, callback) {
      $http.post(followUrl, { params: {}})
        .success(function(data, status, headers, config){
          self.followed = newFollowState;
          if (callback) callback(null);
        })
        .error(function(data, status, headers, config){
          //TODO: Handle Error
          if (callback) callback(status);
        });
    };

    return {
      title: null,
      image_types: null,
      tagline: null,
      category: null,
      created_at: null,
      updated_at: null,
      funding_ends_at: null,
      forever_funding_ends_at: null,
      currency: null,
      collected_funds: null,
      external_campaign_info: null,
      forever_funding_collected_funds: null,
      forever_funding_combined_balance: null,
      goal: null,
      funding_type: null,
      forever_funding_active: null,
      funding_invalid_yet_live: false,
      perks_available: null,
      location: null,
      city: null,
      description_html: null,
      contributions_count: null,
      followed: false,
      main_video_info: {
        type: null,
        id: null
      },
      video_overlay_url: null,
      team_members: [],
      perks: [ ],
      facebook_friend_contributors: [],
      partner_name: null,
      partner_campaign_page_description: null,
      partner_image_url: null,
      nonprofit: false,
      nonprofit_campaign_page_description: null,
      affiliated_with_nonprofit: false,
      funding_status: null,
      setCampaignJson: function(newCampaign) {
        this.external_campaign_info = newCampaign.external_campaign_info;
        this.is_external_campaign = newCampaign.is_external_campaign;
        this.title = newCampaign.title;
        this.image_types = newCampaign.image_types;
        this.tagline = newCampaign.tagline;
        this.category = newCampaign.category && newCampaign.category.text ? newCampaign.category.text : null;
        this.created_at = new Date(newCampaign.created_at);
        this.updated_at = new Date(newCampaign.updated_at);
        this.funding_ends_at = newCampaign.funding_ends_at ? new Date(newCampaign.funding_ends_at) : null;
        this.forever_funding_ends_at = newCampaign.forever_funding_ends_at ? new Date(newCampaign.forever_funding_ends_at) : null;
        this.location = formatLocation(newCampaign);
        this.city = newCampaign.city;
        this.currency = newCampaign.currency;
        this.collected_funds = newCampaign.collected_funds;
        this.forever_funding_collected_funds = newCampaign.forever_funding_collected_funds;
        this.forever_funding_combined_balance = newCampaign.forever_funding_combined_balance;
        this.goal = newCampaign.goal;
        this.funding_type = newCampaign.funding_type;
        this.forever_funding_active = newCampaign.forever_funding_active;
        this.funding_invalid_yet_live = newCampaign.funding_invalid_yet_live;
        this.perks_available = newCampaign.perks_available;
        this.description_html = $sce.trustAsHtml(newCampaign.description_html);
        this.contributions_count = newCampaign.contributions_count;
        this.main_video_info = newCampaign.main_video_info;
        this.video_overlay_url = newCampaign.video_overlay_url;
        this.facebook_friend_contributors = newCampaign.facebook_friend_contributors;
        this.team_members = newCampaign.team_members;
        this.perks = newCampaign.perks;
        this.tag_list = newCampaign.tag_list;
        this.partner_name = newCampaign.partner_name;
        this.nonprofit = newCampaign.nonprofit;
        this.funding_status = newCampaign.funding_status;
      },
      follow: function(callback){
        var newFollowState = true;
        postFollow(this, gon.urls.campaign_follow_path, newFollowState, callback);
      },
      unfollow: function(callback){
        var newFollowState = false;
        postFollow(this, gon.urls.campaign_unfollow_path, newFollowState, callback);
      },
      states: {
        unknown: -1,
        draft: 0,
        published: 1,
        ended: 2,
        inDemand: 3,
        inDemandEnded: 4
      },
      state: function() {
        if(this.funding_status === 'draft') {
          return this.states.draft;
        }
        else if(this.funding_status === 'published') {
          if(this.forever_funding_active) {
            return this.states.inDemand;
          } else {
            return this.states.published;
          }
        }
        else if(this.funding_status === 'ended') {
          if(this.forever_funding_ends_at) {
            return this.states.inDemandEnded;
          }
          else {
            return this.states.ended;
          }
        }

        return this.states.unknown;
      },
      isInDemand: function() {
        return this.state() === this.states.inDemand ||
               this.state() === this.states.inDemandEnded;
      }
    };
  }]);
})();

angular.module('campaignPage.preview').directive('usNonprofitModal',
  ['bootstrap', 'i18n', function(bootstrap, i18n) {
  return {
    restrict: 'A',
    templateUrl: 'views/us-nonprofit-modal.html',
    link: function(scope, element) {
      scope.i18n = i18n;
      bootstrap.modal(element.find('.modal'), 'show');
      scope.closeModal = function() {
        bootstrap.modal(element.find('.modal'), 'hide');
      };
    }
  };
}]);

(function() {
  angular.module('campaignPage.share')
    .directive('emailImporter', [
      'i18n', '$modal', 'emailImporter', 'flash', 'browser', '$timeout', 'gon',
      function(i18n, $modal, emailImporter, flash, browser, $timeout, gon) {


      return {
        scope: {
          postEmailCallback: "&",
          emailFrom: "@",
          emailImporterClick: '&'
        },
        replace: true,
        templateUrl: 'views/email-importer.html',
        transclude: true,
        link: function(scope, element, attrs) {
          var CONTACT_OFFSET = 92;
          var VIEW_OFFSET = 185;
          var VALID_EMAIL = /.*@.*\..{2,}/;
          var currentAccount = _(gon.current_account).clone() || {};
          var postEmailCallback = scope.postEmailCallback;
          var fundraiserRecipient = gon.fundraiser && gon.fundraiser.fundraiser_recipient;
          var onLife = gon.subdomain === 'life';
          var emailFrom = scope.emailFrom || 'from_supporter';
          var modal = $modal({scope: scope, template: 'views/email-importer-modal.html', show: false});

          function changeSelectedStatus(contact, newContactStatus) {
            if (contact.isSelected !== newContactStatus) {
              contact.isSelected = newContactStatus;
              if(contact.isSelected) {
                scope.totalSelected += 1;
              } else {
                scope.totalSelected -= 1;
              }
            }

            var contactLi = findContactLi(contact);
            contactLi.toggleClass('ng-hide', !scope.showContact(contact));
            updateContactSelectionLook(contact);
          }

          function updateContactSelectionLook(contact) {
            var contactLi = findContactLi(contact);
            var checkbox = contactLi.find('div.pull-right');
            checkbox.toggleClass('pc-checked-checkbox', contact.isSelected);
            checkbox.toggleClass('pc-unchecked-checkbox', !contact.isSelected);
          }

          function updateContactListVisibility() {
            scope.contactList.forEach(function(contact) {
              var contactLi = findContactLi(contact);
              contactLi.toggleClass('ng-hide', !scope.showContact(contact));
            });
          }

          scope.i18n = i18n;
          scope.contact = {};
          scope.contactList = gon.email_contacts || [];
          scope.gmailImported = false;
          scope.yahooImported = false;
          scope.isComposing = false;
          var fundraiserTitle = gon.fundraiser && gon.fundraiser.title;
          scope.totalSelected = 0;
          scope.showSelectedContacts = false;

          if (gon && gon.email_contacts_data) {
            scope.emailLimitReachedMsg = i18n.t('email_import.limit_reached', {daily_limit: gon.email_contacts_data.max});
            scope.remainingMessage = function () {
              return i18n.t('email_import.emails_remaining', {remaining: scope.remainingCount(), daily_limit: gon.email_contacts_data.max});
            };
          }

          scope.remainingCount = function () {
            return gon.email_contacts_data.remaining - scope.totalSelected;
          };

          scope.ableToCompose = function () {
            return scope.contactList.length > 0 &&
                scope.totalSelected > 0 &&
                scope.remainingCount() > 0;
          };

          scope.onImporterClick = function () {
            if (attrs.emailImporterClick) {
              scope.emailImporterClick();
            } else {
              scope.openModal();
            }
          };

          scope.message = {
            subject: i18n.pt('email_import.' + emailFrom + '.email_subject', {project_title: fundraiserTitle, full_name: currentAccount.full_name})
          };

          scope.message.body = !!fundraiserRecipient && onLife ?
            i18n.pt('email_import.' + emailFrom + '.email_message_with_beneficiary', {project_title: fundraiserTitle, beneficiary: fundraiserRecipient, organizer_name: currentAccount.full_name}) :
            i18n.pt('email_import.' + emailFrom + '.email_message', {project_title: fundraiserTitle, organizer_name: currentAccount.full_name});

          var selectedContacts = function() {
            return scope.contactList.filter(function(contact) {
              return contact.isSelected;
            });
          };

          var selectedContactsIds = function() {
            return selectedContacts().map(function(contact) {
              return contact.id;
            });
          };

          var findContactLi = function(contact) {
           return modal.$element.find(".emailImporter-contactList-contact#email-contact-" + contact.id);
          };

          var viewHeight = function() {
            return Math.max(browser.height() * 0.9 - 600, 200);
          };

          scope.contactListHeight = function() {
            if (scope.showSelectedContacts) {
              var msgHeight = modal.$element.find('.emailImporter-importContacts-selectedMessage').height();
              return (viewHeight() - msgHeight - 42) + 'px';
            } else {
              return viewHeight() + 'px';
            }
          };

          scope.emailChanged = function() {
            updateContactListVisibility();
          };

          scope.showContact = function(contactItem) {
            if (scope.showSelectedContacts && !contactItem.isSelected) {
              return false;
            }
            if (scope.contact.email) {
              if (contactItem.email.toLowerCase().indexOf(scope.contact.email.toLowerCase()) === -1) {
                return false;
              }
            }
            return true;
          };

          scope.openModal = function() {
            if (gon.current_account) {
              modal.show();
            } else {
              browser.redirectTo(gon.urls.email_login_url);
            }
          };

          scope.validEmail = function() {
            return scope.contact.email && scope.contact.email.match(VALID_EMAIL);
          };

          scope.onlyShowSelectedContacts = function() {
            scope.showSelectedContacts = true;
            updateContactListVisibility();
          };

          scope.showAllContacts = function() {
            scope.showSelectedContacts = false;
            updateContactListVisibility();
          };

          scope.toggleSelection = function(event) {
            var contactId = $(event.target).closest('li').attr('id').replace('email-contact-', '');
            var contact = _.findWhere(scope.contactList, {id: +contactId});
            changeSelectedStatus(contact, !contact.isSelected);
          };

          scope.addContact = function() {
            emailImporter.createContact({email: scope.contact.email}).then(function(contact) {
              if (contact) {
                scope.contactList.push(contact);

                $timeout(function() {
                  updateContactListVisibility();
                  changeSelectedStatus(contact, true);

                  var contactLi = findContactLi(contact);

                  if (contactLi.position()) {
                    var contactPosition = contactLi.position().top - CONTACT_OFFSET;
                    var contactList = modal.$element.find('.emailImporter-importContacts-contactList');
                    contactList.animate({scrollTop: contactPosition});
                  }
                });
              }
            });

            scope.contact.email = '';
          };

          scope.allContactsSelected = function() {
            return scope.totalSelected === scope.contactList.length && scope.contactList.length > 0;
          };

          scope.sendMessages = function(message) {
            emailImporter.sendBulkMessages(message, selectedContactsIds()).then(function() {
              flash.addMessage('notice', i18n.t('email_import.successful_send'));
              modal.hide();
              scope.isComposing = false;

              if (postEmailCallback) {
                postEmailCallback();
              }
            });
          };

          scope.selectAllContacts = function(newContactStatus) {
            if (newContactStatus) {
              scope.showSelectedContacts = false;
            }
            scope.contactList.forEach(function(contact) {
              changeSelectedStatus(contact, newContactStatus);
            });
          };

          scope.messageFieldHeight = function () {
            return viewHeight() + VIEW_OFFSET + 'px';
          };

          scope.toggleCompose = function() {
            scope.isComposing = !scope.isComposing;
          };

          scope.importGmailContacts = function() {
            var provider = onLife ? 'gmail_life' : 'gmail';
            emailImporter.importContacts(provider).then(function (contacts) {
              scope.contactList = contacts.concat(scope.contactList);
              scope.gmailImported = true;
            });
          };

          scope.importYahooContacts = function() {
            var provider = onLife ? 'yahoo_life' : 'yahoo';
            emailImporter.importContacts(provider).then(function (contacts) {
              scope.contactList = contacts.concat(scope.contactList);
              scope.yahooImported = true;
            });
          };

          browser.onLoad(function() {
            if (gon.show_email_importer && gon.current_account) {
              scope.openModal();
            }
          });

          scope.$on('emailImporter.launch', function () {
            scope.openModal();
          });
        }
      };
    }]);
})();

(function() {
  angular.module('campaignPage.share').factory('emailImporter', ['$http', '$window', 'browser', '$q', 'gon',
    function($http, $window, browser, $q, gon) {
    var service = {};

    service.createContact = function(contact) {
      var data = {source_type: 'user_entered', email: contact.email};

      return $http.post(gon.urls.contact_create_url, {contact: data}).then(function(response) {
        return response.data;
      });
    };

    service.sendBulkMessages = function(message, contactIds) {
      var email = {project_id: gon.fundraiser.id, subject: message.subject, message: message.body, email_contact_ids: contactIds};
      return $http.post(gon.urls.bulk_message_url, {email: email});
    };

    service.importContacts = function(provider) {
      var deferred = $q.defer();
      $window.addContacts = function(contacts) {
        deferred.resolve(contacts);
      };

      browser.openWindow('/contacts/' + provider, provider, {width: 800, height: 600});
      return deferred.promise;
    };

    return service;
  }]);
})();

(function(){
  angular.module('campaignPage.share').directive('shareWizard', [
    'browser', '$timeout', 'i18n', 'fb', '$state', 'twitter', 'gogoEvents', 'gon',
    'todoItems', '$http', 'fbAutopost', 'flash',
    function(browser, $timeout, i18n, fb, $state, twitter, gogoEvents, gon, todoItems, $http,
             fbAutopost, flash) {
    return {
      scope: {},
      templateUrl: 'views/share-wizard.html',
      link: function(scope, element) {
        var currentAccount = _.clone(gon.current_account);
        var eventMap = {
          "facebook": "share_wizard_fb",
          "facebook-2": "share_wizard_fb_2",
          "twitter": "share_wizard_tw",
          "email": "share_wizard_email"
        };

        var eventPage = function () {
          return eventMap[$state.current.name];
        };

        var defaultEventProperties = _.clone(gon.default_event_properties);

        scope.eventTags = function(){
          return _.merge({page: eventPage()}, defaultEventProperties);
        };

        scope.i18n = i18n;
        scope.urls = gon.urls;
        scope.fundraiser = gon.fundraiser;
        scope.facebookShared = false;
        scope.twitterShared = false;
        scope.twitterShareUrl = gon.urls.twitter_share_url;
        scope.fbAutopost = fbAutopost;
        scope.subdomain = gon.subdomain;

        twitter.onTweet(function () {
          scope.twitterShared = true;
          todoItems.markCompleted('twitter_share');
          scope.goTo('email');
        });

        scope.shareFacebook = function() {
          fb.share(scope.urls.facebook_share_url, {account_id: currentAccount.account_id}).then(function() {
            todoItems.markCompleted('facebook_share');
            scope.goTo('twitter');
            scope.facebookShared = true;
          }).catch(function() {
            if ($state.current.name == 'facebook-2') {
              scope.goTo('twitter');
            } else {
              scope.goTo('facebook-2');
            }
          });
        };

        scope.toggleAutoFbPost = function() {
          if (currentAccount.facebook_can_wall_post) {
            fbAutopost.setPostingActive(!fbAutopost.postingActive).then(function () {
              var flashMessage = fbAutopost.postingActive ?
                i18n.pt('share_wizard.great_well_post_your_fundraiser_to_facebook') :
                i18n.pt('share_wizard.successfully_opted_out_of_autopost');
              flash.addMessage('notice', flashMessage);
              if (fbAutopost.postingActive) {
                gogoEvents.captureEvent('automatic_fb_post_share_wizard');
              }
            });
          } else {
            browser.redirectTo(gon.urls.facebook_authorize_url);
          }
        };

        scope.emailCallback = function() {
          todoItems.markCompleted('email_share');
          $timeout(function() {
            scope.goToPostShare();
          }, 2000);
        };

        scope.captureEvent = function(event_name){
          gogoEvents.captureEvent(event_name, scope.eventTags());
        };

        scope.goTo = function(state) {
          $state.go(state);
        };

        scope.goToPostShare = function() {
          browser.redirectTo(scope.urls.post_share_url);
        };

        scope.openEmailImporter = function() {
          var emailImporterBtn = element.find('.js-emailImporter');

          $timeout(function() {
            emailImporterBtn.click();
          });
        };

        browser.onLoad(function() {
          scope.captureEvent('share_wizard_start');
        });
      }
    };
  }]);
})();


(function () {
  angular.module('campaignPage.utils').factory('fbAutopost', [
    '$http', 'gon', 'gogoEvents',
    function ($http, gon, gogoEvents) {
      var automaticFbPostUrl = gon.urls.automatic_facebook_post_url;

      function updateServiceFromAutopostJson(autopostJson) {
        service.postingActive = autopostJson.posting_active;
        service.frequency = autopostJson.frequency;
        service.nextPostDate = autopostJson.next_post_date;
        service.automatedMessage = autopostJson.automated_message;
      }

      function setPostingActive(postingActiveValue) {
        makeSnapshot();
        service.snapshot.postingActive = postingActiveValue;
        return saveSnapshot();
      }

      function makeSnapshot() {
        service.snapshot = _.pick(service, 'postingActive', 'frequency', 'automatedMessage');
      }

      function saveSnapshot() {
        return $http.put(automaticFbPostUrl, {
          automatic_facebook_post: {
            posting_active: service.snapshot.postingActive,
            frequency: service.snapshot.frequency,
            automated_message: service.snapshot.automatedMessage
          }
        }).then(function(response) {
          updateServiceFromAutopostJson(response.data || {});
        });
      }

      var service = {
        makeSnapshot: makeSnapshot,
        saveSnapshot: saveSnapshot,
        setPostingActive: setPostingActive
      };
      updateServiceFromAutopostJson(gon.fb_autopost || {});
      makeSnapshot();
      return service;
    }
  ]);
})();

(function() {
  'use strict';
  angular.module('campaignPage.utils').directive('publishButton', ['browser', '$http', '$timeout', 'bootstrap', function (browser, $http, $timeout, bootstrap) {
    return {
      restrict: 'A',
      scope: {
        actionHref: "@publishButtonActionHref",
        finalHref: "@publishButtonFinalHref"
      },
      template: '<a ng-transclude ng-href="" ng-click="publish()"></a>',
      transclude: true,
      replace: true,
      link: function(scope, element) {
        var liveModal = element.find('#js-live-modal');

        scope.publish = function () {
          $http.put(scope.actionHref).then(function() {
            if (scope.finalHref) {
              bootstrap.modal(liveModal, 'show');
              $timeout(function() {
                browser.redirectTo(scope.finalHref);
              }, 2000);
            } else {
              browser.refreshPage();
            }
          });
        };
      }
    };
  }]);
}());

(function () {
  angular.module('campaignPage.utils').factory('todoItems', ['$http', 'gon', 'i18n', function ($http, gon, i18n) {
    var service = {};
    var todoItems = {};

    var notYetCompletedText = {
      facebook_share: i18n.t('personal.fundraiser_dashboard.not_posted_on_facebook'),
      twitter_share: i18n.t('personal.fundraiser_dashboard.not_posted_on_twitter'),
      email_share: i18n.t('personal.fundraiser_dashboard.not_sent_email'),
      promotion_program: null,
      offline_fundraiser: null
    };

    var urls = {
      facebook_share: gon.urls.todo_items_facebook_share_url,
      twitter_share: gon.urls.todo_items_twitter_share_url,
      email_share: gon.urls.todo_items_email_share_url,
      promotion_program: gon.urls.todo_items_promotion_program_url,
      offline_fundraiser: gon.urls.todo_items_offline_fundraiser_url
    };

    var storeTodoItem = function(itemName, todoData) {
      if (typeof todoData === 'undefined') {
        todoItems[itemName] = {
          completedRecently: false,
          lastCompletedText: notYetCompletedText[itemName]
        };
      } else {
        todoItems[itemName] = {
          completedRecently: todoData.completed_recently,
          lastCompletedText: todoData.last_completed_text
        };
      }
    };

    service.markCompleted = function(itemName){
      return $http.put(urls[itemName], {}).then(function(response) {
        storeTodoItem(itemName, response.data[itemName]);
      });
    };

    service.get = function() {
      return todoItems;
    };

    _(['facebook_share', 'twitter_share', 'email_share', 'promotion_program', 'offline_fundraiser']).each(function(itemName) {
      var gonData = gon.fundraiser.todo_items || {};
      var todoData = gonData[itemName];
      storeTodoItem(itemName, todoData);
    });

    return service;
  }]);
})();

(function(module) {
try {
  module = angular.module('templates');
} catch (e) {
  module = angular.module('templates', []);
}
module.run(['$templateCache', function($templateCache) {
  $templateCache.put('views/disbursement-history-modal.html',
    '<div class="modal modal--lifeDashboard">\n' +
    '  <div class="modal-dialog pc-modal-dialog">\n' +
    '    <a class="pc-modal-close" ng-click="$hide()">\n' +
    '      <span class="i-icon i-glyph-icon-30-close"></span>\n' +
    '    </a>\n' +
    '    <div class="pc-modal-content pc-modal-content--disburseHistory">\n' +
    '      <h2 class="pc-modal-miniheading pc-modal-miniheading--lifeDashboard">{{::i18n.t(\'personal.dashboard.funds.disbursements_history\')}}</h2>\n' +
    '      <div class="disburseHistory">\n' +
    '        <div class="disburseHistory-header hidden-xs">\n' +
    '          <div class="disburseHistory-date">{{::i18n.t(\'personal.dashboard.funds.date_disbursed\')}}</div>\n' +
    '          <div class="disburseHistory-payment hidden-xs">{{::i18n.t(\'personal.dashboard.funds.payment_method\')}}</div>\n' +
    '          <div class="disburseHistory-amount">{{::i18n.t(\'personal.dashboard.funds.amount\')}}</div>\n' +
    '        </div>\n' +
    '        <div class="disburseHistory-item" ng-repeat="disbursement in disbursementsHistory">\n' +
    '          <div class="disburseHistory-date">{{::disbursement.weekDisplay}}</div>\n' +
    '          <div class="disburseHistory-payment hidden-xs">{{::disbursement.paymentMethod}}</div>\n' +
    '          <div class="disburseHistory-amount">{{::disbursement.amount}}</div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '    </div>\n' +
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
  $templateCache.put('views/life-funds-breakdown.html',
    '<div class="pc-dashboard-section">\n' +
    '  <div class="pc-dashboard-section-header">\n' +
    '    <a href="" ng-click="showExplanation()" class="pc-dashboard-section-header-rtLink visible-lg">{{::i18n.t(\'personal.dashboard.funds.when_receive_funds\')}}</a>\n' +
    '    <div class="pc-dashboard-section-title">{{::i18n.t(\'personal.dashboard.funds.funds_breakdown\')}}</div>\n' +
    '  </div>\n' +
    '  <ul class="pc-dashboard-section-body lifeFunds-body">\n' +
    '    <li class="lifeFunds-item" ng-class="{\'lifeFunds-item--hasSubItems\': fundsRaised.length > 0}">\n' +
    '      <div class="label">{{::i18n.t(\'personal.dashboard.funds.funds_raised_to_date\')}}</div>\n' +
    '      <div class="value">{{fundsRaisedToDate}}</div>\n' +
    '    </li>\n' +
    '    <li class="lifeFunds-item lifeFunds-item--subItem hidden-xs" ng-repeat="fundRaised in fundsRaised">\n' +
    '      <div class="label">{{::fundRaised.label}}</div>\n' +
    '      <div class="value">({{::fundRaised.value}})</div>\n' +
    '    </li>\n' +
    '    <li class="lifeFunds-item">\n' +
    '      <div class="label">{{transactionFeeLabel}} <span igg-popover placement="bottom">{{transactionFeeTooltip}}</span></div>\n' +
    '      <div class="value">{{transactionFees}}</div>\n' +
    '    </li>\n' +
    '    <li class="lifeFunds-item" ng-repeat="fee in optionalFees">\n' +
    '      <div class="label">{{::fee.label}} <span igg-popover placement="bottom" ng-if="fee.tooltip">{{fee.tooltip}}</span></div>\n' +
    '      <div class="value">{{::fee.value}}</div>\n' +
    '    </li>\n' +
    '    <li class="lifeFunds-item lifeFunds-item--total">\n' +
    '      <div class="label">{{::i18n.t(\'personal.dashboard.funds.total_takeaway\')}}</div>\n' +
    '      <div class="value">{{totalTakeaway}}</div>\n' +
    '    </li>\n' +
    '  </ul>\n' +
    '</div>\n' +
    '<a href="" ng-click="showExplanation()" class="lifeFunds-underSection hidden-lg">{{::i18n.t(\'personal.dashboard.funds.when_receive_funds\')}}</a>\n' +
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
  $templateCache.put('views/life-funds-disbursement.html',
    '<div class="pc-dashboard-section">\n' +
    '  <div class="pc-dashboard-section-header">\n' +
    '    <div class="pc-dashboard-section-title">{{::i18n.t(\'personal.dashboard.funds.funds_disbursement\')}}</div>\n' +
    '  </div>\n' +
    '  <ul class="pc-dashboard-section-body lifeFunds-body">\n' +
    '    <li class="lifeFunds-item">\n' +
    '      <div class="label">{{::i18n.t(\'personal.dashboard.funds.next_disbursement\')}}\n' +
    '        <div class="lifeFunds-labelNote" ng-if="disbursements.loaded">({{disbursements.next_disbursement|weekOf}})</div>\n' +
    '      </div>\n' +
    '      <div class="value">{{notDisbursed}}</div>\n' +
    '    </li>\n' +
    '    <li class="lifeFunds-item">\n' +
    '      <div class="label">{{::i18n.t(\'personal.dashboard.funds.already_disbursed\')}}\n' +
    '        <a href="" ng-if="disbursements.loaded && disbursements.items.length > 0"\n' +
    '           class="lifeFunds-desktopSubLink" ng-click="showHistory()">{{::i18n.t(\'personal.dashboard.funds.view_disbursements_history\')}}</a>\n' +
    '      </div>\n' +
    '      <div class="value">{{alreadyDisbursed}}</div>\n' +
    '    </li>\n' +
    '  </ul>\n' +
    '</div>\n' +
    '<div class="lifeFunds-underSection hidden-lg" ng-if="disbursements.loaded && disbursements.items.length > 0">\n' +
    '  <a href="" ng-click="showHistory()">{{::i18n.t(\'personal.dashboard.funds.view_disbursements_history\')}}</a>\n' +
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
  $templateCache.put('views/life-funds-under-review.html',
    '<div class="pc-dashboard-section">\n' +
    '  <div class="pc-dashboard-section-header">\n' +
    '    <div class="pc-dashboard-section-title">{{::i18n.t(\'personal.dashboard.funds.funds_under_review\')}}</div>\n' +
    '  </div>\n' +
    '  <div class="pc-dashboard-section-body lifeFunds-body pc-donations">\n' +
    '    <div class="pc-donation" ng-repeat="donation in underReview.donations">\n' +
    '      <div class="pc-donation-image">\n' +
    '        <img class="pc-donation-imagePhoto" ng-src="{{::donation.contributor.avatar_url}}" />\n' +
    '        <div class="pc-donation-imageAmt">{{::-donation.amount|iggCurrency:donation.currency.iso_num:\'noIso\'}}</div>\n' +
    '      </div>\n' +
    '      <div class="pc-donation-mainCol">\n' +
    '        <div class="pc-donation-name">{{::donation.contributor.name}}</div>\n' +
    '        <div class="pc-donation-info pc-donation-email">{{::donation.contributor.email}}</div>\n' +
    '        <div class="pc-donation-info pc-donation-time">{{::donation.created_at | amDateFormat:\'MMM D, YYYY\'}}</div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div ng-if="underReview.pagination.next" class="pc-dashboard-section-footer">\n' +
    '    <a ng-click="showMore()">{{::i18n.t(\'show_more_caps\')}}</a>\n' +
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
  $templateCache.put('views/life-funds.html',
    '<div ng-if="!inFundsTabRedesign">\n' +
    '  <div class="pc-dashboard-funds" pc-funds></div>\n' +
    '  <div ng-if="underReview.loaded" class="pc-dashboard-funds-held" pc-funds-held></div>\n' +
    '</div>\n' +
    '<div ng-if="inFundsTabRedesign" class="pc-dashboard-layout">\n' +
    '  <div class="pc-dashboard-rightRailCol pc-dashboard-rightRailCol--funds">\n' +
    '    <div life-receive-funds class="pc-dashboard-rightRailCol-item"></div>\n' +
    '  </div>\n' +
    '  <div class="pc-dashboard-mainCol">\n' +
    '    <div ng-if="funds.loaded" life-funds-breakdown class="pc-dashboard-mainCol-item"></div>\n' +
    '    <div ng-if="funds.loaded" life-funds-disbursement class="pc-dashboard-mainCol-item"></div>\n' +
    '    <div ng-if="underReview.loaded && underReview.donations.length > 0" life-funds-under-review class="pc-dashboard-mainCol-item"></div>\n' +
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
  $templateCache.put('views/life-receive-funds.html',
    '<div class="pc-dashboard-section">\n' +
    '  <div class="pc-dashboard-section-header">\n' +
    '    <div class="pc-dashboard-section-title">{{::i18n.t(\'personal.dashboard.funds.receive_funds\')}}</div>\n' +
    '  </div>\n' +
    '  <div class="pc-dashboard-section-body lifeFunds-body">\n' +
    '    <div ng-if="::!hasDonated">{{::i18n.t(\'personal.dashboard.funds.bank_info_not_yet_needed_prompt\')}}</div>\n' +
    '    <div ng-if="::hasDonated">{{::i18n.t(\'personal.dashboard.funds.bank_info_prompt\')}}</div>\n' +
    '    <a ng-if="::hasDonated" class="pc-cta pc-cta--hollow lifeFunds-cta" ng-href="{{::editUrl}}"><span>{{::i18n.t(\'personal.dashboard.funds.add_bank_account\')}}</span> <span class="i-icon i-glyph-icon-30-rightarrow"></span></a>\n' +
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
  $templateCache.put('views/pc-automated-facebook-modal.html',
    '<div class="modal autopostSettingsModal">\n' +
    '  <div class="modal-dialog pc-modal-dialog">\n' +
    '    <a class="pc-modal-close" ng-click="$hide()">\n' +
    '      <span class="i-icon i-glyph-icon-30-close"></span>\n' +
    '    </a>\n' +
    '    <div class="autopostSettingsModal-section">\n' +
    '      <h2 class="pc-modal-miniheading autopostSettingsModal-title">{{::i18n.t(\'personal.dashboard.automated_updates.automated_facebook_updates\')}}</h2>\n' +
    '      <p class="autopostSettingsModal-explanation">\n' +
    '        {{::i18n.t(\'personal.dashboard.automated_updates.tight_on_time_change_settings\')}}\n' +
    '      </p>\n' +
    '    </div>\n' +
    '\n' +
    '    <div class="autopostSettingsModal-section autopostSettingsModal-section--body">\n' +
    '      <div class="autopostSettingsModal-section--message">\n' +
    '        <div class="compose-message">{{::i18n.t(\'personal.dashboard.automated_updates.compose_automated_message\')}}</div>\n' +
    '        <textarea class="automated-message" ng-model="fbAutopost.snapshot.automatedMessage" maxlength="500"></textarea>\n' +
    '      </div>\n' +
    '\n' +
    '      <div class="autopostSettingsModal-frequency-question">{{::i18n.t(\'personal.dashboard.automated_updates.frequency_question\')}}</div>\n' +
    '      <span igg-popover class="hidden-xs">{{::i18n.t(\'personal.dashboard.automated_updates.auto_post_dont_worry\')}}</span>\n' +
    '      <ui-select class="visible-xs autopostSettingsModal-frequency-dropdown frequencyDropdown" ng-model="fbAutopost.snapshot.frequency" theme="select2">\n' +
    '        <ui-select-match>\n' +
    '          <div class="frequencyDropdown-title">{{$select.selected.title}}</div>\n' +
    '          <div class="frequencyDropdown-desc">{{$select.selected.description}}</div>\n' +
    '        </ui-select-match>\n' +
    '        <ui-select-choices repeat="option.value as option in frequencyOptions | filter: $select.search">\n' +
    '          <div class="frequencyDropdown-title">{{option.title}}</div>\n' +
    '          <div class="frequencyDropdown-desc">{{option.description}}</div>\n' +
    '        </ui-select-choices>\n' +
    '      </ui-select>\n' +
    '      <div class="hidden-xs segmentedControl">\n' +
    '        <a class="segmentedControl-segment segmentedControl-segment--frequency" ng-class="{selected: freq.value === fbAutopost.snapshot.frequency}"\n' +
    '           href="" ng-click="changeFrequency(freq)" ng-repeat="freq in frequencyOptions">{{::freq.title}}</a>\n' +
    '      </div>\n' +
    '      <div class="hidden-xs autopostSettingsModal-frequency-explanation">{{frequencyText()}}</div>\n' +
    '    </div>\n' +
    '    <div class="autopostSettingsModal-section autopostSettingsModal-btnContainer">\n' +
    '      <a class="hidden-inline-xs autopostSettingsModal-btn pc-cancel" href="" ng-click="$hide()">{{::i18n.t(\'cancel\')}}</a>\n' +
    '      <a href="{{::authorizeFacebookUrl}}" class="autopostSettingsModal-btn pc-cta pc-cta--facebook"\n' +
    '         ng-if="!canWallPost">\n' +
    '        <span class="i-glyph-icon-30-facebook i-icon"></span>\n' +
    '        <span>{{::i18n.t(\'personal.dashboard.automated_updates.enable_automated_updates\')}}</span>\n' +
    '      </a>\n' +
    '      <button class="autopostSettingsModal-btn pc-cta" ng-click="updateAutopostFrequency(); $hide();" ng-if="canWallPost">{{::i18n.t(\'save_settings\')}}</button>\n' +
    '      <a class="visible-xs autopostSettingsModal-btn pc-cancel" href="" ng-click="$hide()">{{::i18n.t(\'cancel\')}}</a>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '\n' +
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
  $templateCache.put('views/pc-automated-facebook-updates.html',
    '<div class="pc-dashboard-section-header">\n' +
    '  <a href="" ng-click="showModal()" ng-if="fbAutopost.postingActive" class="visible-lg pc-dashboard-section-header-rtLink">{{::i18n.t(\'settings\')}}</a>\n' +
    '  <div class="pc-dashboard-section-title">{{::i18n.t(\'personal.dashboard.automated_updates.automate_your_messages\')}}</div>\n' +
    '</div>\n' +
    '<div class="pc-dashboard-section-body pc-automatedFacebookUpdates">\n' +
    '  <div class="pc-automatedFacebookUpdates-title"><span class="i-icon i-glyph-icon-30-facebook"></span><span class="text">{{::i18n.t(\'personal.dashboard.automated_updates.automated_facebook_updates\')}}:</span></div>\n' +
    '  <div class="pc-automatedFacebookUpdates-segmentedControl">\n' +
    '    <a href="" class="pc-automatedFacebookUpdates-segment segmentedControl-segment" ng-class="{selected: fbAutopost.postingActive}" ng-click="showModal()">{{::i18n.t(\'button_on\')}}</a><!--\n' +
    '    --><a href="" class="pc-automatedFacebookUpdates-segment segmentedControl-segment" ng-class="{selected: !fbAutopost.postingActive}" ng-click="turnOffAutopost()">{{::i18n.t(\'button_off\')}}</a>\n' +
    '  </div>\n' +
    '\n' +
    '  <div class="pc-automatedFacebookUpdates-nextPostDate" ng-if="fbAutopost.postingActive && fbAutopost.nextPostDate">\n' +
    '    <div class="pc-automatedFacebookUpdates-nextPostDate-title">{{::i18n.t(\'personal.dashboard.automated_updates.next_post_scheduled_for\')}}</div>\n' +
    '    <div class="pc-automatedFacebookUpdates-nextPostDate-value">{{fbAutopost.nextPostDate | amDateFormat:\'dddd, MMMM D, YYYY\'}}</div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '<div ng-if="fbAutopost.postingActive" class="hidden-lg pc-dashboard-section-footer">\n' +
    '  <a href="" ng-click="showModal()">{{::i18n.t(\'settings\')}}</a>\n' +
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
  $templateCache.put('views/pc-dashboard-campaign-card.html',
    '<img class="pc-dashboard-campaignCard-img" ng-src="{{pcCampaign.json().expanded_image_url}}" />\n' +
    '<div class="pc-dashboard-campaignCard-content">\n' +
    '  <div class="pc-dashboard-campaignCard-title hidden-xs">{{pcCampaign.json().title}}</div>\n' +
    '  <div class="pc-dashboard-campaignCard-money">\n' +
    '    <div class="pc-dashboard-campaignCard-money-bigMoney">{{pcCampaign.json().balance}}</div>\n' +
    '    <div class="pc-dashboard-campaignCard-money-raised">{{raisedOfGoal}}</div>\n' +
    '  </div>\n' +
    '  <div class="pc-dashboard-campaignCard-progressBar">\n' +
    '    <div class="pc-dashboard-campaignCard-progressBar-filled" ng-style="{width: pcCampaign.json().nearest_five_percent + \'%\'}"></div>\n' +
    '  </div>\n' +
    '  <div class="pc-dashboard-campaignCard-bottomRow">\n' +
    '    <div class="pc-dashboard-campaignCard-bottomRow-pct">{{pcCampaign.json().percent_complete}}</div>\n' +
    '    <div ng-if="pcCampaign.hasDeadline()" class="pc-dashboard-campaignCard-bottomRow-timeLeft">{{pcCampaign.json().amt_time_left}}</div>\n' +
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
  $templateCache.put('views/pc-dashboard-donations.html',
    '<div class="pc-tab-header">\n' +
    '  <span class="pc-updated-at" ng-if="showData">\n' +
    '    {{i18n.t(\'command_center.last_updated_less_than_min_ago\')}}\n' +
    '  </span>\n' +
    '  <h3 class="pc-tab-header-title">\n' +
    '    {{::i18n.t(\'personal.donations\')}}\n' +
    '  </h3>\n' +
    '</div>\n' +
    '\n' +
    '<div class="pc-spinner" ng-class="{\'hidden\' : showData}">\n' +
    '  <span class="fa fa-spinner fa-4x fa-spin"></span>\n' +
    '</div>\n' +
    '\n' +
    '<div class="pc-donations-container" ng-if="showData">\n' +
    '  <a class="btn btn-default pc-btn-csv" ng-href="{{csvPath}}">\n' +
    '    {{::i18n.t(\'command_center.generate_csv\')}}\n' +
    '  </a>\n' +
    '\n' +
    '  <table class="table">\n' +
    '    <thead>\n' +
    '      <tr>\n' +
    '        <th>{{::i18n.t(\'command_center.amount\')}}</th>\n' +
    '        <th>{{::i18n.t(\'command_center.email\')}}</th>\n' +
    '        <th>{{::i18n.t(\'name\')}}</th>\n' +
    '        <th>{{::i18n.t(\'command_center.appearance\')}}</th>\n' +
    '        <th>{{::i18n.t(\'command_center.funding_date\')}}</th>\n' +
    '      </tr>\n' +
    '    </thead>\n' +
    '    <tbody>\n' +
    '      <tr ng-repeat="pledge in pledges">\n' +
    '        <td>{{pledge.amount | iggCurrency:pledge.currency.iso_num:"noIso"}}</td>\n' +
    '        <td>{{pledge.contributor.email}}</td>\n' +
    '        <td>{{pledge.contributor.name}}</td>\n' +
    '        <td>{{i18n.t(pledge.appearance)}}</td>\n' +
    '        <td>{{pledge.created_at | amDateFormat:\'D-MMM-YYYY\'}}</td>\n' +
    '      </tr>\n' +
    '    </tbody>\n' +
    '  </table>\n' +
    '</div>\n' +
    '\n' +
    '<div class="pc-pagination" ng-if="showData">\n' +
    '  <ul class="pc-pagination-links">\n' +
    '    <li ng-if="currentPage !== 1">\n' +
    '      <a href="#" ng-click="getDonations({page: 1})">{{i18n.t(\'first\')}}</a>\n' +
    '    </li>\n' +
    '\n' +
    '    <li ng-if="currentPage !== 1">\n' +
    '      <a href="#" ng-click="getDonations({page: (currentPage - 1)})">{{i18n.t(\'previous\')}}</a>\n' +
    '    </li>\n' +
    '\n' +
    '    <li ng-if="currentPage > offset + 1">...</li>\n' +
    '\n' +
    '    <li ng-repeat="page in paginatedPages">\n' +
    '      <a href="#" id="page-{{page}}-link" ng-click="getDonations({page: page})" ng-class="{\'pc-selected-page\' : isCurrentPage(page)}">\n' +
    '        {{page}}\n' +
    '      </a>\n' +
    '    </li>\n' +
    '\n' +
    '    <li ng-if="totalPages - offset > currentPage">...</li>\n' +
    '\n' +
    '    <li ng-if="currentPage !== totalPages">\n' +
    '      <a href="#" ng-click="getDonations({page: (currentPage + 1)})">{{i18n.t(\'next\')}}</a>\n' +
    '    </li>\n' +
    '\n' +
    '    <li ng-if="currentPage !== totalPages">\n' +
    '      <a href="#" ng-click="getDonations({page: totalPages})">{{i18n.t(\'last\')}}</a>\n' +
    '    </li>\n' +
    '  </ul>\n' +
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
  $templateCache.put('views/pc-dashboard-end-fundraiser-modal.html',
    '<div class="modal modal--lifeDashboard pc-end-fundraiser-modal">\n' +
    '  <div class="modal-dialog pc-modal-dialog">\n' +
    '    <a class="pc-modal-close" ng-click="$hide()">\n' +
    '      <span class="i-icon i-glyph-icon-30-close"></span>\n' +
    '    </a>\n' +
    '    <div class="pc-modal-content">\n' +
    '      <h2 class="pc-modal-miniheading pc-modal-miniheading--lifeDashboard">{{::i18n.t(\'personal.dashboard.end_fundraiser_modal.title\')}}</h2>\n' +
    '      <p class="pc-endFundraiser-modal-explanation">{{::i18n.t(\'personal.dashboard.end_fundraiser_modal.explanation\')}}</p>\n' +
    '\n' +
    '      <div class="pc-endFundraiser-modal-buttons hidden-xs">\n' +
    '        <div class="pc-cancel pc-cta-spaceAfter" ng-click="$hide()">{{::i18n.t(\'cancel\')}}</div>\n' +
    '        <a href="" class="pc-cta pc-endFundraiser" ng-click="endFundraiser()">{{::i18n.t(\'personal.dashboard.end_fundraiser\')}}</a>\n' +
    '      </div>\n' +
    '\n' +
    '      <div class="pc-endFundraiser-modal-buttons visible-xs">\n' +
    '        <a href="" class="pc-cta pc-endFundraiser" ng-click="endFundraiser()">{{::i18n.t(\'personal.dashboard.end_fundraiser\')}}</a>\n' +
    '        <div class="pc-cancel" ng-click="$hide()">{{::i18n.t(\'cancel\')}}</div>\n' +
    '      </div>\n' +
    '    </div>\n' +
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
  $templateCache.put('views/pc-dashboard-end-fundraiser.html',
    '<div ng-if="!hasDeadline">\n' +
    '  <div ng-if="!hasEnded">\n' +
    '    <span ng-bind-html="fundingStartedAt"></span>\n' +
    '    <a class="pc-endFundraiser-link" ng-click="showEndFundraiserModal()">{{::i18n.t(\'personal.dashboard.end_fundraiser\')}}</a>\n' +
    '  </div>\n' +
    '\n' +
    '  <div ng-if="hasEnded" ng-bind-html="endDate"></div>\n' +
    '</div>\n' +
    '\n' +
    '<div ng-if="hasDeadline">\n' +
    '  <div ng-if="!hasEnded">\n' +
    '    <span ng-bind-html="endsOn"></span>\n' +
    '    <a class="pc-removeDeadline-link" ng-click="showRemoveDeadlineModal()">{{::i18n.t(\'personal.dashboard.remove_deadline\')}}</a>\n' +
    '  </div>\n' +
    '\n' +
    '  <div ng-if="hasEnded" ng-bind-html="endDate"></div>\n' +
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
  $templateCache.put('views/pc-dashboard-fundraiser-link.html',
    '<div class="pc-dashboard-fundraiserLink-title">{{title}}</div>\n' +
    '<div class="pc-dashboard-fundraiserLink-content">\n' +
    '  <div ng-if="!browser.isMobile()" ng-click="selectUrl()">\n' +
    '    <span class="pc-dashboard-fundraiserLink-icon i-glyph-icon-30-link"></span><!--\n' +
    '    --><input type="text" readonly value="{{projectUrl}}"/>\n' +
    '  </div>\n' +
    '  <div ng-if="browser.isMobile()">\n' +
    '    <a ng-href="{{projectUrl}}" target="_blank" ng-click="preventDefault($event)">\n' +
    '      <span class="pc-dashboard-fundraiserLink-icon i-glyph-icon-30-link"></span><!--\n' +
    '      --><input type="text" disabled value="{{projectUrl}}"/>\n' +
    '    </a>\n' +
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
  $templateCache.put('views/pc-dashboard-mobile-fundraiser-link.html',
    '<div class="pc-mobile-fundraiserLink-content pc-dashboard-section-title">\n' +
    '  <span>Share URL</span> <a href="#" class="pc-cta-basic" ng-click="openModal()">Copy Fundraiser Link</a>\n' +
    '</div>\n' +
    '\n' +
    '<div pc-modal class="modal pc-fundraiserLink-modal" modal-id="fundraiser-link-modal">\n' +
    '  <div pc-dashboard-fundraiser-link title="Share Your Fundraiser"></div>\n' +
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
  $templateCache.put('views/pc-dashboard-post-update.html',
    '<div class="pc-dashboard-section-header">\n' +
    '  <div class="pc-dashboard-section-title">{{::i18n.t("personal.dashboard.post_an_update")}}</div>\n' +
    '</div>\n' +
    '<div class="pc-postUpdate-body">\n' +
    '  <div class="pc-postUpdate-placeholder i-text-field" ng-click="showEditor()" ng-if="!editMode">{{::i18n.t("personal.dashboard.whats_new")}}</div>\n' +
    '  <textarea ng-if="editMode" ng-model="newUpdate.body" redactor redactor-focus=true redactor-rows="16" redactor-minlength="2" redactor-maxlength="1500" redactor-buttons="bold italic deleted | image video link"></textarea>\n' +
    '  <div class="pc-postUpdate-error" ng-if="charLength > 1500">{{::i18n.t("personal.dashboard.updates_must_be_less_than")}}</div>\n' +
    '  <div class="pc-postUpdate-error" ng-if="serverError">{{serverError}}</div>\n' +
    '\n' +
    '  <div class="pc-postUpdate-xpost">\n' +
    '    <span>{{::i18n.t("personal.dashboard.also_post_to")}}</span>\n' +
    '    <span ng-click="connectToFacebook()" class="pc-postToFacebook">\n' +
    '      <label>\n' +
    '        <input type="checkbox"\n' +
    '               name="postToFacebook"\n' +
    '               id="postToFacebook"\n' +
    '               ng-model="postToFacebook">\n' +
    '        <span class="i-glyph-icon-30-facebook pc-xpost-facebook-icon"></span>\n' +
    '        {{::i18n.t("facebook")}}\n' +
    '      </label>\n' +
    '    </span>\n' +
    '  </div>\n' +
    '\n' +
    '  <div class="pc-postUpdate-bottomRow">\n' +
    '    <button class="i-cta-1 pc-postUpdate-cta" ng-click="postUpdate()" ng-disabled="isValidLength()">\n' +
    '     <span ng-if="showSpinner" class="fa fa-spinner fa-spin"></span>\n' +
    '     <span ng-if="!showSpinner">{{::i18n.t(\'personal.dashboard.post_an_update\')}}</span>\n' +
    '    </button>\n' +
    '    <div class="pc-postUpdate-descriptionCol">\n' +
    '      <span class="pc-postUpdate-descriptionCol-text visible-lg">{{::i18n.t("personal.dashboard.regular_updates")}}</span>\n' +
    '      <a class="pc-postUpdate-descriptionCol-url" ng-href="{{needHelpUrl}}" target="_blank">{{::i18n.t("personal.dashboard.need_help")}}</a>\n' +
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
  $templateCache.put('views/pc-dashboard-remove-deadline-modal.html',
    '<div class="modal modal--lifeDashboard pc-remove-deadline-modal">\n' +
    '  <div class="modal-dialog pc-modal-dialog">\n' +
    '    <a class="pc-modal-close" ng-click="$hide()">\n' +
    '      <span class="i-icon i-glyph-icon-30-close"></span>\n' +
    '    </a>\n' +
    '    <div class="pc-modal-content">\n' +
    '      <h2 class="pc-modal-miniheading pc-modal-miniheading--lifeDashboard">{{::i18n.t(\'personal.dashboard.remove_deadline_modal.title\')}}</h2>\n' +
    '      <p class="pc-removeDeadline-modal-explanation">{{::i18n.t(\'personal.dashboard.remove_deadline_modal.explanation\')}}</p>\n' +
    '\n' +
    '      <div class="pc-removeDeadline-funds-question" ng-click="showAnswer = !showAnswer">\n' +
    '        <span class="pc-remove-fundraiser-dropArrow i-icon i-glyph-icon-30-downcarrot" ng-class="{\'show-answer\' : showAnswer}"></span>\n' +
    '        <span class="pc-removeDeadline-question-text">{{::i18n.t(\'personal.dashboard.remove_deadline_modal.funds_question\')}}</span>\n' +
    '      </div>\n' +
    '\n' +
    '      <div class="pc-removeDeadline-funds-answer" ng-if="showAnswer">\n' +
    '        {{::i18n.t(\'personal.dashboard.remove_deadline_modal.funds_answer\')}}\n' +
    '      </div>\n' +
    '\n' +
    '      <div class="pc-removeDeadline-modal-buttons hidden-xs">\n' +
    '        <div class="pc-cancel pc-cta-spaceAfter" ng-click="$hide()">{{::i18n.t(\'cancel\')}}</div>\n' +
    '        <a href="" class="pc-cta pc-removeDeadline" ng-click="removeDeadline()">{{::i18n.t(\'personal.dashboard.remove_deadline\')}}</a>\n' +
    '      </div>\n' +
    '\n' +
    '      <div class="pc-removeDeadline-modal-buttons visible-xs">\n' +
    '        <a href="" class="pc-cta pc-removeDeadline" ng-click="removeDeadline()">{{::i18n.t(\'personal.dashboard.remove_deadline\')}}</a>\n' +
    '        <div class="pc-cancel" ng-click="$hide()">{{::i18n.t(\'cancel\')}}</div>\n' +
    '      </div>\n' +
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
  $templateCache.put('views/pc-dashboard.html',
    '<div class="i-float-tab-links i-float-tab-links--dashboard">\n' +
    '  <a class="i-tab" ui-sref="manage" ui-sref-active="i-selected pc-selected">\n' +
    '    <span>{{::i18n.t(\'manage\')}}</span>\n' +
    '  </a>\n' +
    '  <a class="i-tab" ui-sref="donations" ui-sref-active="i-selected pc-selected">\n' +
    '    <span>{{::i18n.t(\'personal.donations\')}}</span>\n' +
    '  </a>\n' +
    '  <a class="i-tab" ui-sref="funds" ui-sref-active="i-selected pc-selected">\n' +
    '    <span>{{::i18n.t(\'command_center.funds\')}}</span>\n' +
    '  </a>\n' +
    '</div>\n' +
    '\n' +
    '<div class="pc-dashboard-content" ui-view>\n' +
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
  $templateCache.put('views/pc-donations-tab.html',
    '<div class="pc-dashboard-donations" pc-dashboard-donations>\n' +
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
  $templateCache.put('views/pc-funds-held.html',
    '<div class="pc-donations-container">\n' +
    '  <div class="pc-tab-header">\n' +
    '    <h3 class="pc-tab-header-title">\n' +
    '      {{::i18n.t(\'campaigner_dashboard.funds_under_review\')}}\n' +
    '    </h3>\n' +
    '  </div>\n' +
    '\n' +
    '  <table class="table">\n' +
    '    <thead>\n' +
    '    <tr>\n' +
    '      <th>{{::i18n.t(\'command_center.amount\')}}</th>\n' +
    '      <th>{{::i18n.t(\'command_center.email\')}}</th>\n' +
    '      <th>{{::i18n.t(\'name\')}}</th>\n' +
    '      <th>{{::i18n.t(\'command_center.appearance\')}}</th>\n' +
    '      <th>{{::i18n.t(\'command_center.funding_date\')}}</th>\n' +
    '    </tr>\n' +
    '    </thead>\n' +
    '    <tbody>\n' +
    '    <tr ng-repeat="pledge in pledges">\n' +
    '      <td>{{pledge.amount | iggCurrency:pledge.currency.iso_num:"noIso"}}</td>\n' +
    '      <td>{{pledge.contributor.email}}</td>\n' +
    '      <td>{{pledge.contributor.name}}</td>\n' +
    '      <td>{{i18n.t(pledge.appearance)}}</td>\n' +
    '      <td>{{pledge.created_at | amDateFormat:\'D-MMM-YYYY\'}}</td>\n' +
    '    </tr>\n' +
    '    </tbody>\n' +
    '  </table>\n' +
    '</div>\n' +
    '\n' +
    '<div class="pc-pagination">\n' +
    '  <ul class="pc-pagination-links">\n' +
    '    <li ng-repeat="page in totalPages">\n' +
    '      <a id="page-{{page}}-link" ng-click="getHeldDonations(page)" ng-class="{\'pc-selected-page\' : isCurrentPage(page)}">\n' +
    '        {{page}}\n' +
    '      </a>\n' +
    '    </li>\n' +
    '  </ul>\n' +
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
  $templateCache.put('views/pc-funds-tab.html',
    '<div life-funds></div>\n' +
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
  $templateCache.put('views/pc-funds.html',
    '<div class="pc-tab-header">\n' +
    '  <span class="pc-updated-at" ng-if="fundsData.loaded">\n' +
    '    {{i18n.t(\'command_center.last_updated_x_ago\', {date: fundsData.date})}}\n' +
    '  </span>\n' +
    '\n' +
    '  <h3 class="pc-tab-header-title">\n' +
    '    {{::i18n.t(\'command_center.funds\')}}\n' +
    '  </h3>\n' +
    '</div>\n' +
    '\n' +
    '<div class="pc-spinner" ng-class="{\'hidden\' : fundsData.loaded}">\n' +
    '  <span class="fa fa-spinner fa-4x fa-spin"></span>\n' +
    '</div>\n' +
    '\n' +
    '<table class="table" ng-if="fundsData.loaded">\n' +
    '  <thead>\n' +
    '    <tr>\n' +
    '      <th></th>\n' +
    '      <th ng-repeat="fund in fundsData.funds">{{fund.contribution_method}}</th>\n' +
    '    </tr>\n' +
    '  </thead>\n' +
    '\n' +
    '  <tbody>\n' +
    '    <tr><th>{{::i18n.t(\'command_center.raised_to_date\')}}</th><td ng-repeat="fund in fundsData.funds" class="number-cell">{{fund.total_raised_formatted}}</td></tr>\n' +
    '    <tr><th>{{::i18n.t(\'command_center.payment_processor_fees_deducted\')}}</th><td ng-repeat="fund in fundsData.funds" class="string-cell">{{fund.transaction_fees}}</td></tr>\n' +
    '    <tr><th>{{::i18n.t(\'command_center.bank_delivery_fees\')}}</th><td ng-repeat="fund in fundsData.funds" class="string-cell">{{fund.delivery_fees}}</td></tr>\n' +
    '    <tr><th>{{::i18n.t(\'command_center.disbursed_to_date\')}}</th><td ng-repeat="fund in fundsData.funds" class="string-cell">{{fund.total_raised_disbursed}}</td></tr>\n' +
    '    <tr><th>{{::i18n.t(\'command_center.not_yet_disbursed\')}}</th><td ng-repeat="fund in fundsData.funds" class="string-cell">{{fund.total_raised_not_yet_disbursed}}</td></tr>\n' +
    '    <tr><th>{{::i18n.t(\'command_center.funds_disbursed_to\')}}</th><td ng-repeat="fund in fundsData.funds" class="linkable-cell" ng-bind-html="fund.destination"></td></tr>\n' +
    '    <tr><th>{{::i18n.t(\'command_center.when_to_expect_your_funds\')}}</th><td ng-repeat="fund in fundsData.funds" class="linkable-cell" ng-bind-html="fund.description"></td></tr>\n' +
    '  </tbody>\n' +
    '</table>\n' +
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
  $templateCache.put('views/pc-manage-tab.html',
    '<div class="pc-dashboard-header hidden-xs">{{::i18n.t(\'personal.fundraiser_dashboard.manage_your_fundraiser\')}}</div>\n' +
    '<div class="pc-dashboard-layout">\n' +
    '  <div class="pc-dashboard-rightRailCol">\n' +
    '    <a ng-href="{{fundraiserUrl}}" pc-dashboard-campaign-card class="pc-dashboard-campaignCard pc-dashboard-rightRailCol-item"></a>\n' +
    '    <div pc-dashboard-fundraiser-link class="hidden-xs pc-dashboard-rightRailCol-item pc-dashboard-section pc-dashboard-section--simple" title="{{::i18n.t(\'personal.dashboard.your_fundraiser_link\')}}"></div>\n' +
    '    <div pc-visit-stats class="pc-dashboard-visitStats pc-dashboard-rightRailCol-item"></div>\n' +
    '    <div pc-dashboard-end-fundraiser class="hidden-xs pc-dashboard-rightRailCol-item pc-dashboard-section pc-dashboard-section--simple"></div>\n' +
    '  </div>\n' +
    '  <div class="pc-dashboard-mainCol">\n' +
    '    <div pc-dashboard-post-update class="pc-dashboard-section pc-dashboard-mainCol-item pc-dashboard-section--darker"></div>\n' +
    '    <div pc-todo-items class="pc-dashboard-section pc-dashboard-mainCol-item pc-dashboard-todoItems"></div>\n' +
    '    <div pc-automated-facebook-updates class="pc-dashboard-mainCol-item pc-dashboard-section"></div>\n' +
    '    <div pc-recent-donations ng-if="hasRecentDonations" class="pc-dashboard-mainCol-item pc-dashboard-section"></div>\n' +
    '    <div pc-dashboard-end-fundraiser class="visible-xs pc-dashboard-mainCol-item pc-dashboard-section pc-dashboard-section--simple"></div>\n' +
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
  $templateCache.put('views/pc-offline-fundraiser-modal.html',
    '<div class="modal pc-offline-fundraiser-modal">\n' +
    '  <div class="modal-dialog pc-modal-dialog">\n' +
    '    <a class="pc-modal-close" ng-click="$hide()">\n' +
    '      <span class="i-icon i-glyph-icon-30-close"></span>\n' +
    '    </a>\n' +
    '    <div class="pc-modal-content">\n' +
    '      <div class="pc-offlineFundraiser-header">\n' +
    '        <div class="i-icon i-glyph-icon-30-personalcause pc-offlineFundraiser-megaphone"></div>\n' +
    '        <h2 class="pc-modal-miniheading pc-modal-miniheading--lifeDashboard">{{::i18n.t(\'personal.fundraiser_dashboard.offline_fundraiser_modal.header\')}}</h2>\n' +
    '        <p class="pc-offlineFundraiser-modal-explanation">{{::i18n.t(\'personal.fundraiser_dashboard.offline_fundraiser_modal.spreading_the_word\')}}</p>\n' +
    '      </div>\n' +
    '\n' +
    '      <p class="pc-offlineFundraiser-header-explanation">{{::i18n.t(\'personal.fundraiser_dashboard.offline_fundraiser_modal.some_ideas\')}}<p>\n' +
    '    </div>\n' +
    '\n' +
    '    <ul class="pc-offlineFundraiser-ideas-section">\n' +
    '      <li ng-repeat="item in offlineFundraiserItems">\n' +
    '        <div class="pc-offlineFundraiser-item-title">{{::i18n.t(\'personal.fundraiser_dashboard.offline_fundraiser_modal.\' + item)}}</div>\n' +
    '        <div class="pc-offlineFundraiser-item-explanation">{{::i18n.t(\'personal.fundraiser_dashboard.offline_fundraiser_modal.\' + item + \'_explanation\')}}</div>\n' +
    '      </li>\n' +
    '    </ul>\n' +
    '\n' +
    '    <div class="pc-modal-content">\n' +
    '      <div class="pc-offlineFundraiser-modal-buttons">\n' +
    '        <a class="pc-cta" ng-click="$hide()">{{::i18n.t(\'personal.fundraiser_dashboard.offline_fundraiser_modal.got_it\')}}</a>\n' +
    '      </div>\n' +
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
  $templateCache.put('views/pc-recent-donations.html',
    '<div class="pc-dashboard-section-header">\n' +
    '  <div class="pc-dashboard-section-title">{{::i18n.t(\'personal.fundraiser_dashboard.recent_donations\')}}</div>\n' +
    '</div>\n' +
    '<div class="pc-dashboard-section-body pc-donations">\n' +
    '  <div class="pc-donation" ng-repeat="donation in recentDonations">\n' +
    '    <div class="pc-donation-image">\n' +
    '      <img class="pc-donation-imagePhoto" ng-src="{{donation.photo_url}}" />\n' +
    '      <div class="pc-donation-imageAmt">{{donation.amount}}</div>\n' +
    '    </div>\n' +
    '    <div class="pc-donation-mainCol pc-donation-mainCol--recent">\n' +
    '      <div class="pc-donation-name">{{donation.name}}</div>\n' +
    '      <div class="pc-donation-amount" ng-bind-html="donationAmountHtml(donation.amount)"></div>\n' +
    '      <div class="pc-donation-info pc-donation-time">{{donation.timestamp}}</div>\n' +
    '      <div class="pc-donation-comment" ng-if="donation.comment">{{donation.comment}}</div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '<div class="pc-dashboard-section-footer">\n' +
    '  <a href="" class="view-donations" ui-sref="donations">{{::i18n.t(\'personal.fundraiser_dashboard.view_complete_donation_list\')}}</a>\n' +
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
  $templateCache.put('views/pc-todo-items.html',
    '<div class="pc-dashboard-section-header pc-dashboard-todoItems-header">\n' +
    '  <a href="{{urls.help_url}}" target="_new" class="visible-lg pc-dashboard-section-header-rtLink">{{::i18n.t(\'personal.fundraiser_dashboard.how_often_should_i_post\')}}</a>\n' +
    '  <div class="pc-dashboard-section-title pc-dashboard-todoItems-header-title">{{::i18n.t(\'personal.fundraiser_dashboard.promote_your_fundraiser\')}}</div>\n' +
    '</div>\n' +
    '\n' +
    '<div class="pc-dashboard-section-body pc-dashboard-todoItems-body">\n' +
    '  <div class="pc-dashboard-todoItem pc-dashboard-fb-todoItem">\n' +
    '    <span class="pc-dashboard-todoItem-statusIcon" ng-class="todoItems.facebook_share.completedRecently ? \'i-glyph-icon-30-check\' : \'i-glyph-icon-30-exclamation\'"></span>\n' +
    '    <div class="pc-dashboard-todoItem-content">\n' +
    '      <div class="pc-dashboard-todoItem-lastCompleted">{{todoItems.facebook_share.lastCompletedText}}</div>\n' +
    '      <div class="pc-dashboard-todoItem-title">{{::i18n.t(\'personal.fundraiser_dashboard.post_on_facebook\')}}</div>\n' +
    '      <div class="pc-dashboard-todoItem-description">{{::i18n.t(\'personal.fundraiser_dashboard.fundraisers_shared_on_facebook\')}}</div>\n' +
    '    </div>\n' +
    '    <button class="pc-cta pc-cta--todoItem pc-cta--facebook pc-dashboard-todoItem-cta" ng-click="clickFacebook()" event-on="click" event-name="click_facebook_todo_item" event-tags="{{eventTags()}}">\n' +
    '      <span class="i-glyph-icon-30-facebook i-icon"></span>\n' +
    '      {{::i18n.t(\'post\')}}\n' +
    '    </button>\n' +
    '  </div>\n' +
    '\n' +
    '  <div class="pc-dashboard-todoItem pc-dashboard-twitter-todoItem">\n' +
    '    <span class="pc-dashboard-todoItem-statusIcon" ng-class="todoItems.twitter_share.completedRecently ? \'i-glyph-icon-30-check\' : \'i-glyph-icon-30-exclamation\'"></span>\n' +
    '    <div class="pc-dashboard-todoItem-content">\n' +
    '      <div class="pc-dashboard-todoItem-lastCompleted">{{todoItems.twitter_share.lastCompletedText}}</div>\n' +
    '      <div class="pc-dashboard-todoItem-title">{{::i18n.t(\'personal.fundraiser_dashboard.share_on_twitter\')}}</div>\n' +
    '      <div class="pc-dashboard-todoItem-description" ng-bind-html="relevantHashtagHtml"></div>\n' +
    '      <a class="pc-cta pc-cta--todoItem pc-cta--twitter pc-dashboard-todoItem-cta" ng-href="{{urls.twitter_share_url}}" event-on="click" event-name="click_twitter_todo_item" event-tags="{{eventTags()}}">\n' +
    '        <span class="i-glyph-icon-30-twitter i-icon"></span>\n' +
    '        {{::i18n.t(\'share\')}}\n' +
    '      </a>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '\n' +
    '  <div class="pc-dashboard-todoItem pc-dashboard-email-todoItem">\n' +
    '    <span class="pc-dashboard-todoItem-statusIcon" ng-class="todoItems.email_share.completedRecently ? \'i-glyph-icon-30-check\' : \'i-glyph-icon-30-exclamation\'"></span>\n' +
    '    <div class="pc-dashboard-todoItem-content">\n' +
    '      <div class="pc-dashboard-todoItem-lastCompleted">{{todoItems.email_share.lastCompletedText}}</div>\n' +
    '      <div class="pc-dashboard-todoItem-title">{{::i18n.t(\'personal.fundraiser_dashboard.send_personal_messages\')}}</div>\n' +
    '      <div class="pc-dashboard-todoItem-description">{{::i18n.t(\'personal.fundraiser_dashboard.ask_close_friends_and_family\')}}</div>\n' +
    '    </div>\n' +
    '    <a href="{{urls.email_share_url}}" ng-click="completeEmailItemCallback()" target="_blank" class="pc-cta pc-cta--todoItem pc-cta--email pc-dashboard-todoItem-cta visible-xs"\n' +
    '       event-on="click" event-name="click_mobile_email_todo_item" event-tags="{{eventTags()}}">\n' +
    '      {{::i18n.t(\'email\')}}\n' +
    '    </a>\n' +
    '    <span class="hidden-xs" email-importer email-from="from_owner" post-email-callback="completeEmailItemCallback()">\n' +
    '      <button class="pc-cta pc-cta--todoItem pc-cta--email pc-dashboard-todoItem-cta" href=""\n' +
    '        event-on="click" event-name="click_email_todo_item" event-tags="{{eventTags()}}">\n' +
    '        <span class="i-glyph-icon-30-mail i-icon"></span>\n' +
    '        {{::i18n.t(\'email\')}}\n' +
    '      </button>\n' +
    '    </span>\n' +
    '  </div>\n' +
    '\n' +
    '  <div class="pc-dashboard-todoItems-additionalTips hidden-xs" ng-if="showTips">\n' +
    '    <div class="pc-dashboard-todoItem pc-dashboard-promotionProgram-todoItem" ng-if="showPromotionProgramTodoItem">\n' +
    '      <span class="pc-dashboard-todoItem-statusIcon" ng-class="todoItems.promotion_program.completedRecently ? \'i-glyph-icon-30-check\' : \'i-glyph-icon-30-exclamation\'"></span>\n' +
    '      <div class="pc-dashboard-todoItem-content">\n' +
    '        <div class="pc-dashboard-todoItem-title">{{::i18n.t(\'personal.fundraiser_dashboard.join_promotion_program\')}}</div>\n' +
    '        <div class="pc-dashboard-todoItem-description">{{::i18n.t(\'personal.fundraiser_dashboard.share_for_promotional_opportunities\')}}</div>\n' +
    '        <a class="pc-cta-basic pc-cta--todoItem pc-dashboard-todoItem-cta pc-cta--additionalItem" ng-click="completePromotionProgramCallback()" ng-href="{{urls.promotion_program_url}}" target="_blank">\n' +
    '          {{::i18n.t(\'join\')}}\n' +
    '        </a>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '\n' +
    '  <div class="pc-dashboard-todoItems-additionalTips hidden-xs" ng-if="showTips">\n' +
    '    <div class="pc-dashboard-todoItem pc-dashboard-offlineFundraiser-todoItem">\n' +
    '      <span class="pc-dashboard-todoItem-statusIcon" ng-class="todoItems.offline_fundraiser.completedRecently ? \'i-glyph-icon-30-check\' : \'i-glyph-icon-30-exclamation\'"></span>\n' +
    '      <div class="pc-dashboard-todoItem-content">\n' +
    '        <div class="pc-dashboard-todoItem-title">{{::i18n.t(\'personal.fundraiser_dashboard.run_an_offline_fundraiser\')}}</div>\n' +
    '        <div class="pc-dashboard-todoItem-description">{{::i18n.t(\'personal.fundraiser_dashboard.raise_more_funds_offline\')}}</div>\n' +
    '        <a class="pc-cta-basic pc-cta--todoItem pc-dashboard-todoItem-cta pc-cta--additionalItem" ng-click="clickOfflineFundraiser()">\n' +
    '          {{::i18n.t(\'learn_how\')}}\n' +
    '        </a>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '\n' +
    '<div class="pc-dashboard-section-showTips hidden-xs">\n' +
    '  <a href="" ng-click="toggleShowTips()">{{showTips ? i18n.t(\'personal.fundraiser_dashboard.hide_tips\') : i18n.t(\'personal.fundraiser_dashboard.show_tips\')}}</a>\n' +
    '</div>\n' +
    '<div pc-dashboard-mobile-fundraiser-link class="visible-xs pc-dashboard-section-body pc-dashboard-mobile-fundraiserLink"></div>\n' +
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
  $templateCache.put('views/pc-visit-stats.html',
    '<div class="visible-xs">\n' +
    '  <div class="pc-dashboard-visitStats-dropdownCol">\n' +
    '    <a href="" class="pc-dashboard-visitStats-dropdown">\n' +
    '      <span class="pc-dashboard-visitStats-dropdown-text">{{header(currentTab)}}</span>\n' +
    '      <span class="pc-dashboard-visitStats-dropdown-dropArrow i-icon i-glyph-icon-30-downcarrot visible-inline-xs"></span>\n' +
    '    </a>\n' +
    '    <div class="dropdown-menu i-linklist-dropdown pc-dashboard-visitStats-dropdownMenu">\n' +
    '      <a href="" ng-repeat="tab in tabs" ng-click="changeTab(tab)" class="pc-dashboard-visitStats-dropdownMenu-item" ng-class="{\'selected\': currentTab === tab}">{{header(tab)}}</a>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div class="pc-dashboard-visitStats-statCol">\n' +
    '    <div class="pc-dashboard-visitStats-stat">{{visits(currentTab)}}</div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '<div class="hidden-xs">\n' +
    '  <div class="pc-dashboard-visitStats-header">{{header(currentTab)}}</div>\n' +
    '  <div class="pc-dashboard-visitStats-stat">{{visits(currentTab)}}</div>\n' +
    '  <div class="pc-dashboard-visitStats-change">{{percentChange(currentTab)}}</div>\n' +
    '  <div class="i-float-tab-links pc-dashboard-visitStats-tabs">\n' +
    '    <a href="" ng-repeat="tab in tabs" ng-click="changeTab(tab)" class="i-tab pc-dashboard-visitStats-tab" ng-class="{\'i-selected\': currentTab === tab}"><span>{{::i18n.t(\'personal.dashboard.visits.tabs.\' + tab)}}</span></a>\n' +
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
  $templateCache.put('views/when-funds-modal.html',
    '<div class="modal modal--lifeDashboard">\n' +
    '  <div class="modal-dialog pc-modal-dialog">\n' +
    '    <a class="pc-modal-close" ng-click="$hide()">\n' +
    '      <span class="i-icon i-glyph-icon-30-close"></span>\n' +
    '    </a>\n' +
    '    <div class="pc-modal-content">\n' +
    '      <h2 class="pc-modal-miniheading pc-modal-miniheading--lifeDashboard">{{::i18n.t(\'personal.dashboard.funds.when_receive_funds\')}}</h2>\n' +
    '      <p>{{::i18n.t(\'personal.dashboard.funds.when_receive_funds_explanation\')}}</p>\n' +
    '    </div>\n' +
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
  $templateCache.put('views/campaign-embed-modal.html',
    '<div class="modal i-modal i-embed-lightbox">\n' +
    '  <div class="modal-dialog i-modal-wider">\n' +
    '    <div class="modal-content">\n' +
    '      <a class="close i-icon i-glyph-icon-30-close" ng-click="$hide()" aria-hidden="true"></a>\n' +
    '      <div class="row">\n' +
    '        <div class="col-sm-8">\n' +
    '          <h3>{{ i18n.t(\'widget_embed.embed_this_card_in_your_website_or_blog\') }}</h3>\n' +
    '\n' +
    '          <p>{{ i18n.t(\'widget_embed.copy_code_below\') }}</p>\n' +
    '          <textarea class="i-code-text" readonly="true" ng-click="selectTextarea()" rows="8">{{iframeString}}</textarea>\n' +
    '        </div>\n' +
    '        <div class="col-sm-4" ng-bind-html="projectCardHtml">\n' +
    '        </div>\n' +
    '      </div>\n' +
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
  $templateCache.put('views/campaign-share-links.html',
    '<div class="i-share">\n' +
    '  <div ng-if="fb_og_active">\n' +
    '    <div class="i-fb">\n' +
    '      <div>\n' +
    '        <div class="pluginCountBox">\n' +
    '          <div class="pluginCountBoxTextOnly">\n' +
    '            <span>{{fbTotalCount | abbrevNumFmt}}</span>\n' +
    '          </div>\n' +
    '        </div>\n' +
    '        <div class="pluginCountBoxNub">\n' +
    '          <s></s>\n' +
    '          <i></i>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '      <div ng-click="shareFacebook()">\n' +
    '        <div class="pluginButton">\n' +
    '          <div>\n' +
    '            <div class="pluginButtonContainer">\n' +
    '              <div class="pluginButtonImage">\n' +
    '                <button title="Share">\n' +
    '                  <i class="pluginButtonIcon sp_plugin-button-2x sx_plugin-button-2x_favblue"></i>\n' +
    '                </button>\n' +
    '              </div>\n' +
    '              <span class="pluginButtonLabel">Share</span>\n' +
    '            </div>\n' +
    '          </div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div ng-if="!fb_og_active">\n' +
    '    <div class="fb-share-button" data-href="{{share_info.canonical_fb_url}}" data-layout="box_count"\n' +
    '         data-ref="{{share_info.account_id}}"></div>\n' +
    '  </div>\n' +
    '  <a href="http://twitter.com/share" target="_blank" class="twitter-share-button"\n' +
    '     data-text="{{::i18n.t(\'help_make_it_happen_twitter_tooltip\', {project_title: share_info.project_title})}}"\n' +
    '     data-url="{{::share_info.twitter_url}}"\n' +
    '     data-count="vertical"\n' +
    '     data-counturl="{{::share_info.canonical_url}}"\n' +
    '     data-related="indiegogo:Indiegogo">Tweet</a>\n' +
    '\n' +
    '  <div class="i-google-button">\n' +
    '    <div class="g-plusone" data-href="{{::share_info.canonical_gp_url}}" data-size="tall"></div>\n' +
    '  </div>\n' +
    '\n' +
    '  <a href="" class="i-icon-link" email-importer>\n' +
    '    <span class=\'i-icon i-glyph-icon-30-mail\'></span>\n' +
    '    <span class=\'i-name\'>{{i18n.t(\'email\')}}</span>\n' +
    '  </a>\n' +
    '\n' +
    '  <a href="" ng-click="openEmbedModal()" class="i-icon-link" data-toggle="modal">\n' +
    '    <span class=\'i-icon i-glyph-icon-30-embed\'></span>\n' +
    '    <span class=\'i-name\'>{{i18n.t(\'embed\')}}</span>\n' +
    '  </a>\n' +
    '\n' +
    '  <a href="" class="i-icon-link" copy-url="{{shareLinkUrl}}">\n' +
    '    <span class=\'i-icon i-glyph-icon-30-link\'></span>\n' +
    '    <span class=\'i-name\'>{{i18n.t(\'link\')}}</span>\n' +
    '  </a>\n' +
    '\n' +
    '  <a href=""\n' +
    '     ng-click="toggleFollowing()" class="i-follow i-icon-link"\n' +
    '     ng-class="{\'i-following\' : isStartingToFollowProject}">\n' +
    '    <span class="i-icon i-glyph-icon-30-following" ng-class="{follow: isFollowingProject}"></span>\n' +
    '    <span class="i-name">{{isFollowingProject ? i18n.t(\'following\') : i18n.t(\'follow\')}}</span>\n' +
    '  </a>\n' +
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
  $templateCache.put('views/campaign-share-modal.html',
    '<div id="share_modal" class="modal i-modal i-share-modal">\n' +
    '  <div class="modal-dialog">\n' +
    '    <div class="modal-content">\n' +
    '      <a class="i-icon i-glyph-icon-30-close" ng-click="$hide()" aria-hidden="true"></a>\n' +
    '      <span class="i-green-check-icon"></span>\n' +
    '      <div class="i-green-check-title">{{::i18n.t(\'share_modal.your_campaign_is_live\')}}</div>\n' +
    '      <div class="i-start-sharing">\n' +
    '        <h3>{{::i18n.t(\'share_modal.get_on_your_way\')}}</h3>\n' +
    '        <div>{{::i18n.t(\'share_modal.start_sharing\')}}</div>\n' +
    '      </div>\n' +
    '\n' +
    '      <div class="i-social-promote">{{::i18n.t(\'share_modal.promote_social\')}}</div>\n' +
    '\n' +
    '      <div class="i-social-icons">\n' +
    '        <a href="" ng-click="openWindow(share_info.facebook_share_url)">\n' +
    '          <div class="i-icon i-facebook i-glyph-icon-30-facebook"></div>\n' +
    '        </a>\n' +
    '        <a ng-href="{{share_info.twitter_share_url}}">\n' +
    '          <div class="i-icon i-twitter i-glyph-icon-30-twitter"></div>\n' +
    '        </a>\n' +
    '        <a href="" ng-click="openWindow(share_info.google_plus_share_url)">\n' +
    '          <div class="i-icon i-gplus i-glyph-icon-30-gplus"></div>\n' +
    '        </a>\n' +
    '      </div>\n' +
    '\n' +
    '      <div class="i-email-promote">{{::i18n.t(\'share_modal.promote_email\')}}</div>\n' +
    '\n' +
    '      <a href="" class="i-email i-cta-1 i-cta-1-grey" email-importer email-importer-click="onEmailClick()">\n' +
    '        <span class="i-icon i-glyph-icon-30-mail"></span>{{::i18n.t(\'share_modal.connect_email\')}}\n' +
    '      </a>\n' +
    '\n' +
    '      <div class="i-link-promote">{{::i18n.t(\'share_modal.share_link\')}}</div>\n' +
    '\n' +
    '      <div class="i-link-url">\n' +
    '        <input type="text" class="i-text-field" value="{{share_info.sharing_url}}" />\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n' +
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
  $templateCache.put('views/desktop-approval-button-modal.html',
    '<div class="modal i-modal i-confirm-launch-modal">\n' +
    '  <div class="modal-dialog">\n' +
    '    <div class="modal-content">\n' +
    '      <a class="close i-icon i-glyph-icon-30-close" href="" ng-click="$hide()" aria-hidden="true"></a>\n' +
    '      <h2>{{ i18n.t("campaign_editor.confirm_publish.confirm_launch") }}</h2>\n' +
    '      <p>{{ i18n.t("campaign_editor.confirm_publish.are_you_sure_you_want_to_launch") }}</p>\n' +
    '      <div class="i-button-row">\n' +
    '        <a class="i-cta-1 i-cta-1-grey" href="" ng-click="$hide()">{{ i18n.t("cancel") }}</a>\n' +
    '        <a class="i-cta-1" href="" ng-click="publishAndRefresh()">{{ launchText }}</a>\n' +
    '      </div>\n' +
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
  $templateCache.put('views/desktop-comments.html',
    '<div class="i-musty-background i-tab-form">\n' +
    '  <h2>{{::i18n.t(\'post_a_comment\')}}</h2>\n' +
    '  <textarea id="comment_text" ng-model="newComment.comment_html" rows="10" cols="70" ng-change="updateCount()"></textarea>\n' +
    '\n' +
    '  <div class="i-button-row">\n' +
    '    <div class="pull-left i-counter">{{counterText(newComment.comment_html, 500)}}</div>\n' +
    '    <input type="checkbox" id="comment_appearance" ng-model="newComment.appearance" ng-click="appearanceClicked($event)" ng-true-value="\'STAP_PRVT\'" ng-false-value="\'STAP_VSBL\'" />\n' +
    '    <label for="comment_appearance">{{::i18n.t(\'keep_private_caps\')}}</label>\n' +
    '    <button class="i-cta-1 i-cta-1-grey" ng-click="postComment()">{{::i18n.t(\'post_comment\')}}</button>\n' +
    '  </div>\n' +
    '</div>\n' +
    '\n' +
    '<div class="i-comments">\n' +
    '  <div class="row" ng-repeat="comment in comments">\n' +
    '    <div class="col-sm-2">\n' +
    '      <img ng-src="{{comment.avatar_url}}" />\n' +
    '    </div>\n' +
    '    <div class="col-sm-10 i-lined-column">\n' +
    '      <div class="pull-right" ng-if="comment.delete_path">\n' +
    '        <a class="i-icon i-glyph-icon-30-close" href="" ng-click="deleteComment(comment)"></a>\n' +
    '      </div>\n' +
    '      <div class="pull-right" ng-if="gon.is_admin">\n' +
    '        <button ng-click="toggleSpam(comment)" id="toggle comment {{comment.id}}">{{comment.spam ? \'Unmark Spam\' : \'Mark as Spam\'}}</button>\n' +
    '      </div>\n' +
    '      <div class="i-centered-block">\n' +
    '        <div>\n' +
    '          <a class="i-name" ng-if="comment.profile_url" ng-href="{{comment.profile_url}}">{{comment.account_name}}</a>\n' +
    '          <span class="i-name" ng-if="!comment.profile_url">{{comment.account_name}}</span>\n' +
    '          <div class="i-time-ago">{{comment.timestamp}}</div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '      <div class="i-annotation-pill" ng-if="comment.private">{{::i18n.t(\'private_caps\')}}</div>\n' +
    '      <div class="i-annotation-pill i-pill-error" ng-if="comment.spam && gon.is_admin">{{::i18n.t(\'spam_caps\')}}</div>\n' +
    '      <div class="i-comment-description" ng-bind-html="comment.comment_html"></div>\n' +
    '    </div>\n' +
    '\n' +
    '    <div ng-if="gon.replies_split_test === \'replies\'">\n' +
    '      <!-- This is where the replies view code goes -->\n' +
    '      <ul>\n' +
    '        <li>Reply</li>\n' +
    '      </ul>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '\n' +
    '<div ng-if="pagination.next" class="pull-right i-show-more">\n' +
    '  <a href="" ng-click="showMore()">{{::i18n.t(\'show_more\')}}</a>\n' +
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
  $templateCache.put('views/desktop-funders.html',
    '<div ng-if="pledges.length === 0">{{::i18n.t(\'campaign_has_no_contributors\')}}</div>\n' +
    '<div ng-if="pledges.length > 0" class="row i-funder-row" ng-repeat="pledge in pledges">\n' +
    '  <div class="col-sm-2">\n' +
    '    <img ng-src="{{ pledge.pledger_image_url }}" />\n' +
    '  </div>\n' +
    '  <div class="col-sm-6 i-name-col">\n' +
    '    <div class="i-centered-block">\n' +
    '      <div class="i-name">\n' +
    '        <a ng-if="pledge.pledger_profile_url" href="{{ pledge.pledger_profile_url }}">{{pledge.pledger_display_name}}</a>\n' +
    '        <div ng-if="!pledge.pledger_profile_url">{{pledge.pledger_display_name}}</div>\n' +
    '      </div>\n' +
    '      <div class="i-note">{{pledge.time_ago}}</div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div class="col-sm-4 i-amount-col">\n' +
    '    <div ng-if="pledge.display_amount" class="i-centered-block"><span class="currency currency-small"><span>{{pledge.display_amount}}</span><em>{{pledge.display_amount_iso_code}}</em></span></div>\n' +
    '    <div ng-if="!pledge.display_amount" class="i-centered-block">{{::i18n.t(\'private_caps\')}}</div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '\n' +
    '<div ng-if="pagination.next" class="pull-right i-show-more">\n' +
    '  <a href="" ng-click="showMore()">{{::i18n.t(\'show_more\')}}</a>\n' +
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
  $templateCache.put('views/desktop-gallery.html',
    '<div class="i-gallerySection" ng-if="videos.length > 0">\n' +
    '  <div class="i-lined-header">\n' +
    '    <a class="pull-right i-edit" ng-if="editLink" ng-href="{{editLink}}">{{::i18n.t(\'edit\')}}</a>\n' +
    '    {{::i18n.t(\'video_gallery\')}}\n' +
    '  </div>\n' +
    '  <div class="i-player">\n' +
    '    <div ng-bind-html="currentVideoHtml"></div>\n' +
    '    <div class="caption_for_video">{{currentVideoDescription}}</div>\n' +
    '  </div>\n' +
    '  <div class="i-thumbnails">\n' +
    '    <a ng-repeat="video in videos" href="" ng-click="makeCurrentVideo(video)">\n' +
    '      <img height="45px" width="60px" ng-src="{{video.thumbnail_url}}" />\n' +
    '    </a>\n' +
    '  </div>\n' +
    '</div>\n' +
    '<div class="i-gallerySection" ng-if="images.length > 0">\n' +
    '  <div class="i-lined-header">\n' +
    '    <a class="pull-right i-edit" ng-if="editLink" ng-href="{{editLink}}">{{::i18n.t(\'edit\')}}</a>\n' +
    '    {{::i18n.t(\'image_gallery\')}}\n' +
    '  </div>\n' +
    '  <div class="i-player">\n' +
    '    <div class="i-gallery-image">\n' +
    '      <a href="" ng-click="nextImage()">\n' +
    '        <img ng-src="{{images[currentImageIndex].full_url}}" />\n' +
    '      </a>\n' +
    '    </div>\n' +
    '    <div class="caption">\n' +
    '      <p>{{images[currentImageIndex].title}}</p>\n' +
    '      <p>{{images[currentImageIndex].description}}</p>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div class="i-thumbnails">\n' +
    '    <a ng-repeat="image in images" class="thumb" href="" ng-click="selectImage($index)">\n' +
    '      <img ng-src="{{image.thumbnail_url}}" alt="{{image.title}}"/>\n' +
    '    </a>\n' +
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
  $templateCache.put('views/desktop-trust-passport.html',
    '<a href="" class="i-trustTeaser-contactLink" ng-if="loggedIn" ng-click="openModal(\'contact\')"\n' +
    '   ga-event-on="click" ga-event-category="Trust" ga-event-action="ContactTeaser">{{::i18n.t(\'contact\')}}</a>\n' +
    '<a href="" class="i-trustTeaser-contactLink" ng-if="!loggedIn" ng-href="{{loginUrl}}" >{{::i18n.t(\'contact\')}}</a>\n' +
    '\n' +
    '<span class="i-trustPassport-middot i-trustPassport-actionMiddot">&bullet;</span>\n' +
    '<a href="" class="i-trustTeaser-seeDetailsLink" ng-click="openModal(\'project\')"\n' +
    '  ga-event-on="click" ga-event-category="Trust" ga-event-action="Modal" event-on="click" event-name="click_open_trust_passport">\n' +
    '  {{::i18n.t(\'trust_passport.see_more_details\')}}\n' +
    '</a>\n' +
    '\n' +
    '<div class="modal i-trustPassport-modal">\n' +
    '  <div class="modal-dialog">\n' +
    '    <div class="modal-content i-trustPassport-modal-content">\n' +
    '      <div class="i-trustPassport-header i-musty-background">\n' +
    '        <div class="i-trustPassport-header-text" ng-show="currentView == \'project\'">\n' +
    '          <h2>{{i18n.t(\'trust_passport.about_something\', {something: project.title})}}</h2>\n' +
    '          <p>\n' +
    '            {{project.category}}\n' +
    '            <span class="i-trustPassport-middot">&bullet;</span>\n' +
    '            {{project.location}}\n' +
    '          </p>\n' +
    '        </div>\n' +
    '        <div class="i-trustPassport-header-text" ng-show="currentView == \'contact\' || currentView == \'message-sent\'">\n' +
    '          <h2>{{::i18n.t(\'contact\')}}</h2>\n' +
    '          <p>{{i18n.t(\'trust_passport.campaign_owner_will_be_able_to_reply_directly\', {owner: firstName})}}</p>\n' +
    '        </div>\n' +
    '        <div class="i-glyph-icon-30-close i-icon i-trustPassport-close" ng-click="closeModal()"></div>\n' +
    '      </div>\n' +
    '\n' +
    '      <div class="i-trustPassport-body">\n' +
    '        <div class="i-trustPassport-owner">\n' +
    '          <div class="i-trustPassport-owner-profile">\n' +
    '            <img class="i-trustPassport-avatar" ng-src="{{owner.avatar_url}}" />\n' +
    '            <div class="i-trustPassport-profileInfo">\n' +
    '              <h3 class="i-profileInfo-name">{{owner.name}}</h3>\n' +
    '              <div class="i-profileInfo-role">{{owner.role}}</div>\n' +
    '              <div class="i-profileInfo-links">\n' +
    '                <a href="" ng-click="setView(\'contact\')" ng-if="loggedIn" ga-event-on="click" ga-event-category="Trust" ga-event-action="ContactModal">\n' +
    '                  {{::i18n.t(\'contact\')}}\n' +
    '                </a>\n' +
    '                <a href="" ng-href="{{loginUrl}}" ng-if="!loggedIn">{{::i18n.t(\'contact\')}}</a>\n' +
    '                <span class="i-trustPassport-middot i-trustPassport-actionMiddot">&bullet;</span>\n' +
    '                <a target="blank" ng-href="{{owner.profile_url}}" ga-event-on="click" ga-event-category="Trust" ga-event-action="Profile">\n' +
    '                  {{::i18n.t(\'trust_passport.see_full_profile\')}}\n' +
    '                </a>\n' +
    '              </div>\n' +
    '            </div>\n' +
    '          </div>\n' +
    '          <div class="i-trustPassport-owner-about" ng-if="owner.description.length > 0">\n' +
    '            <h4>{{i18n.t(\'trust_passport.about_something\', {something: firstName})}}</h4>\n' +
    '            <div>{{owner.description}}</div>\n' +
    '          </div>\n' +
    '          <div class="i-trustPassport-owner-verifications" ng-if="hasVerifications">\n' +
    '            <h4>{{::i18n.t(\'verifications\')}}</h4>\n' +
    '            <div class="i-trustPassport-verifications-identity" ng-if="owner.admin_verified && idVerifiedEnabled">\n' +
    '              <span class="i-icon i-glyph-icon-30-check"></span>\n' +
    '              <span igg-popover placement="top" text="{{::i18n.t(\'trust_passport.identity_verified\')}}">\n' +
    '                {{::i18n.t(\'trust_passport.identity_popover\')}}\n' +
    '              </span>\n' +
    '            </div>\n' +
    '            <div class="i-trustPassport-verifications-email" ng-if="owner.email_verified">\n' +
    '              <span class="i-icon i-glyph-icon-30-mail"></span>\n' +
    '              {{::i18n.t(\'email_verified\')}}\n' +
    '            </div>\n' +
    '            <div class="i-trustPassport-verifications-facebook" ng-if="owner.facebook_friends_count">\n' +
    '              <span class="i-icon i-glyph-icon-30-facebook"></span>\n' +
    '              <a target="blank" ng-href="{{owner.facebook_profile_url}}" ng-if="owner.facebook_profile_url"\n' +
    '                 ga-event-on="click" ga-event-category="Trust" ga-event-action="FBProfile">\n' +
    '                {{i18n.t(\'facebook_friends\', {count: owner.facebook_friends_count})}}\n' +
    '              </a>\n' +
    '              <span ng-if="!owner.facebook_profile_url">\n' +
    '                {{i18n.t(\'facebook_friends\', {count: owner.facebook_friends_count})}}\n' +
    '              </span>\n' +
    '            </div>\n' +
    '            <div class="i-trustPassport-verifications-linkedin" ng-if="owner.linkedin_profile_url">\n' +
    '              <span class="i-icon i-glyph-icon-30-linkedin"></span>\n' +
    '              <a target="blank" ng-href="{{owner.linkedin_profile_url}}"\n' +
    '                 ga-event-on="click" ga-event-category="Trust" ga-event-action="LinkedInProfile">{{::i18n.t(\'linkedin_verified\')}}</a>\n' +
    '            </div>\n' +
    '          </div>\n' +
    '          <div class="i-trustPassport-owner-impact">\n' +
    '            <h4>{{::i18n.t(\'trust_passport.impact\')}}</h4>\n' +
    '            <div class="i-trustPassport-impact-campaigns" ng-if="owner.campaigns_count > 0">\n' +
    '              {{i18n.t(\'trust_passport.campaigns_created\', {count: owner.campaigns_count})}}\n' +
    '            </div>\n' +
    '            <div class="i-trustPassport-impact-contributions" ng-if="owner.contributions_count > 0">\n' +
    '              {{i18n.t(\'trust_passport.contributions_made\', {count: owner.contributions_count})}}\n' +
    '            </div>\n' +
    '            <div class="i-trustPassport-impact-comments" ng-if="owner.comments_count > 0">\n' +
    '              {{i18n.t(\'trust_passport.comments_made\', {count: owner.comments_count})}}\n' +
    '            </div>\n' +
    '          </div>\n' +
    '        </div>\n' +
    '        <div class="i-trustPassport-sideSection">\n' +
    '          <div class="i-trustPassport-contact" ng-show="currentView == \'contact\'">\n' +
    '            <div class="i-error-background" ng-if="messageFailed">\n' +
    '              <h3>{{::i18n.t(\'trust_passport.sorry_somethings_wrong_on_our_end\')}}</h3>\n' +
    '              {{::i18n.t(\'trust_passport.try_sending_your_message_in_a_few_minutes\')}}\n' +
    '            </div>\n' +
    '            <div class="i-trustPassport-contactMessage">\n' +
    '              <textarea ng-model="message.text" maxlength="500"></textarea>\n' +
    '              <div class="i-trustPassport-contact-charCounter">{{message.text | charCounter:500}}</div>\n' +
    '            </div>\n' +
    '            <button class="i-cta-1" ng-disabled="message.text.length == 0"\n' +
    '                    ng-click="sendMessage()" ga-event-on="click"\n' +
    '                    ga-event-category="Trust" ga-event-action="ContactSend">\n' +
    '              {{::i18n.t(\'send_message\')}}\n' +
    '            </button>\n' +
    '          </div>\n' +
    '          <div class="i-trustPassport-project" ng-show="currentView == \'project\'">\n' +
    '            <div class="i-trustPassport-project-activity">\n' +
    '              <span class="i-trustPassport-activity-icon i-glyph-icon-30-recent-activity"></span>\n' +
    '              <h4>{{::i18n.t(\'trust_passport.recent_activity\')}}</h4>\n' +
    '              {{project.activity}}\n' +
    '            </div>\n' +
    '            <div class="i-trustPassport-project-teamMembers">\n' +
    '              <h4>{{i18n.t(\'team_members\', {count: project.team_members.length}).toLowerCase()}}</h4>\n' +
    '              <div class="i-trustPassport-member" ng-repeat="member in project.team_members">\n' +
    '                <img class="i-trustPassport-member-avatar" ng-src="{{member.avatar_url}}" />\n' +
    '                <div class="i-trustPassport-profileInfo">\n' +
    '                  <h5>\n' +
    '                    <a class="i-trustPassport-member-name" ng-href="{{member.profile_url}}" target="_blank" ga-event-on="click" ga-event-category="Trust" ga-event-action="TeamProfile">\n' +
    '                      {{member.name}}\n' +
    '                    </a>\n' +
    '                    <span igg-popover class-icon="i-glyph-icon-30-id" placement="top" ng-if="member.hasVerification">\n' +
    '                      <p>{{::i18n.t(\'verifications\')}}</p>\n' +
    '                      <div class="i-trustPassport-member-verification-icons">\n' +
    '                        <span class="i-icon i-glyph-icon-30-check" ng-if="member.admin_verified && idVerifiedEnabled"></span>\n' +
    '                        <span class="i-icon i-glyph-icon-30-mail" ng-if="member.email_verified"></span>\n' +
    '                        <span class="i-icon i-glyph-icon-30-facebook" ng-if="member.facebook_verified"></span>\n' +
    '                        <span class="i-icon i-glyph-icon-30-linkedin" ng-if="member.linkedin_verified"></span>\n' +
    '                      </div>\n' +
    '                    </span>\n' +
    '                  </h5>\n' +
    '                  <div class="i-trustPassport-member-role">{{member.role}}</div>\n' +
    '                </div>\n' +
    '              </div>\n' +
    '            </div>\n' +
    '            <div class="i-trustPassport-project-websites" ng-if="hasWebsites">\n' +
    '              <h4>{{::i18n.t(\'websites\')}}</h4>\n' +
    '              <a target="blank" class="i-trustPassport-website" ng-repeat="website in websites"\n' +
    '                 ng-href="{{website.url}}" ga-event-on="click"\n' +
    '                 ga-event-category="Trust" ga-event-action="{{website.gaAction}}">\n' +
    '                {{website.text}}\n' +
    '              </a>\n' +
    '            </div>\n' +
    '            <div class="i-trustPassport-project-bankInfo" ng-if="project.bank_account_country">\n' +
    '              <h4>{{::i18n.t(\'bank_account_country\')}}</h4>\n' +
    '              <div class="i-trustPassport-bankCountry">{{project.bank_account_country}}</div>\n' +
    '            </div>\n' +
    '            <div class="i-trustPassport-project-helpCenter i-iceman-background">\n' +
    '              {{::i18n.t(\'trust_passport.help_center_text\')}}\n' +
    '              <a ng-href="{{helpCenterUrl}}" ga-event-on="click" ga-event-category="Trust"\n' +
    '                 ga-event-action="TrustHelp"> {{::i18n.t(\'learn_more\')}}</a>\n' +
    '            </div>\n' +
    '          </div>\n' +
    '          <div class="i-trustPassport-message-sent" ng-show="currentView == \'message-sent\'">\n' +
    '            <div class="i-iceman-background">\n' +
    '              <h3>{{::i18n.t(\'trust_passport.your_message_has_been_sent\')}}</h3>\n' +
    '              {{::i18n.t(\'trust_passport.the_campaign_owner_has_received_your_message\')}}\n' +
    '            </div>\n' +
    '          </div>\n' +
    '        </div>\n' +
    '      </div>\n' +
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
  $templateCache.put('views/desktop-updates.html',
    '<div ng-if="editable" class="i-musty-background i-tab-form">\n' +
    '  <h2>{{::i18n.t(\'post_a_new_update\')}}</h2>\n' +
    '\n' +
    '  <textarea rows="7" ng-trim="false" ng-model="newUpdate.bodyHtml" redactor redactor-minlength="2" redactor-maxlength="2500" redactor-buttons="bold italic deleted | image video link"></textarea>\n' +
    '\n' +
    '  <div class="i-button-row">\n' +
    '    <button class="i-cta-1 i-cta-1-grey i-cta1--postUpdate" ng-click="postUpdate()" ng-disabled="charLength > 2500 || charLength < 2">\n' +
    '      <span ng-if="showSpinner" class="fa fa-spinner fa-spin"></span>\n' +
    '      <span ng-if="!showSpinner">{{::i18n.t(\'post_update\')}}</span>\n' +
    '    </button>\n' +
    '  </div>\n' +
    '</div>\n' +
    '\n' +
    '<div ng-repeat="update in updates" class="i-activity-update">\n' +
    '  <a ng-if="editable" class="i-icon i-glyph-icon-30-close pull-right" ng-href="" ng-click="deleteUpdate(update)"></a>\n' +
    '  <h2>{{update.timestamp}}</h2>\n' +
    '  <div class="activity-content" ng-bind-html="update.body_html"></div>\n' +
    '  <div class="i-image-media i-profile-image-media">\n' +
    '    <img ng-src="{{update.account_avatar_url}}"/>\n' +
    '    <a ng-href="{{update.account_profile_url}}">{{update.account_name}}</a>\n' +
    '  </div>\n' +
    '</div>\n' +
    '\n' +
    '<div ng-if="pagination.next" class="pull-right i-show-more">\n' +
    '  <a href="" ng-click="showMore()">{{::i18n.t(\'show_more\')}}</a>\n' +
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
  $templateCache.put('views/early-contribute.html',
    '<div ng-form="nonperkForm">\n' +
    '  <div class="i-pre-nonperk-container">\n' +
    '    <hr class="i-nonperk-container-seperator">\n' +
    '    <div class="i-nonperk-title">{{::i18n.t(\'campaign_page_contribute.your_contribution\')}}</div>\n' +
    '  </div>\n' +
    '  <div class="i-nonperk-container">\n' +
    '    <div class="i-nonperk-custom">\n' +
    '      <input type="number" name="userAmountInput" ng-model="contribution.userAmount"\n' +
    '             ng-change="changeUserAmount()" min="1" max="1000000" pattern="^\\d*$"\n' +
    '             placeholder="{{placeholderText}}" class="i-text-field" />\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div class="i-nonperk-error" ng-if="nonperkForm.userAmountInput.$error.number">{{::i18n.t(\'campaign_page_contribute.nonperk_input_error\')}}</div>\n' +
    '  <div class="i-nonperk-error" ng-if="nonperkForm.userAmountInput.$error.min">{{::i18n.t(\'campaign_page_contribute.nonperk_input_error\')}}</div>\n' +
    '  <div class="i-nonperk-error" ng-if="nonperkForm.userAmountInput.$error.max">{{::i18n.t(\'campaign_page_contribute.nonperk_input_error\')}}</div>\n' +
    '  <div class="i-nonperk-error" ng-if="nonperkForm.userAmountInput.$error.pattern">{{::i18n.t(\'campaign_page_contribute.nonperk_input_error\')}}</div>\n' +
    '</div>\n' +
    '<a ng-href="{{contributeHref}}" class="i-cta-1 i-contribute-button"\n' +
    '   ng-class="{\'i-cta1--disabled\': !nonperkForm.$valid}"\n' +
    '   contribute-button-ga-tracking>{{contributeMessage}}</a>\n' +
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
  $templateCache.put('views/tags.html',
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
  $templateCache.put('views/video-overlay.html',
    '<div class="i-fade-layer js-fade-layer" ng-click="showVideo()">\n' +
    '  <div id="{{::playerId}}" ng-if="::mediaType === \'MDIA_YTPC\'"></div>\n' +
    '</div>\n' +
    '<a class="i-play-button" ng-show="!faded" ng-click="showVideo()"></a>\n' +
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
  $templateCache.put('views/pc-post-update.html',
    '<div class="pc-linedTop-title">{{::i18n.t("post_an_update")}}</div>\n' +
    '<form class="pc-spaceAbove" novalidate>\n' +
    '  <textarea rows="7" ng-model="newUpdate" redactor redactor-minlength="2" redactor-maxlength="1500" redactor-buttons="bold italic deleted | image video link"></textarea>\n' +
    '  <button class="i-cta-1 i-cta-1-grey pc-cta-postUpdate pc-spaceAbove" ng-click="postUpdate()" ng-disabled="charLength > 1500 || charLength < 2">\n' +
    '    <span ng-if="showSpinner" class="fa fa-spinner fa-spin"></span>\n' +
    '    <span ng-if="!showSpinner">{{::i18n.t(\'post_update\')}}</span>\n' +
    '  </button>\n' +
    '  <span class="pc-new-update-error" ng-if="charLength > 1500">{{::i18n.t("personal.dashboard.updates_must_be_less_than")}}</span>\n' +
    '  <span class="pc-new-update-error" ng-if="serverError">{{serverError}}</span>\n' +
    '</form>\n' +
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
  $templateCache.put('views/pc_contact.html',
    '<a href="" class="i-aqua-link" id="js-contact-owner" ng-click="contactOwner()">\n' +
    '  <span class="i-icon i-glyph-icon-30-mail"></span><span class="pc-text">{{ i18n.t("contact") }}</span>\n' +
    '</a>\n' +
    '\n' +
    '<div class="pc-contact-modal modal" pc-modal modal-id="pc-contact-modal">\n' +
    '  <p class="pc-modal-heading">{{ i18n.t("contact_campaign_owner", {campaign_owner: owner}) }}</p>\n' +
    '  <p class="pc-modal-subheading" ng-bind-html="$sce.trustAsHtml(i18n.t(\'personal.contact_modal_description\', {owner_name: owner}))"></p>\n' +
    '  <textarea class="pc-contact-modal-input" ng-model="message.text" maxlength="500"></textarea>\n' +
    '  <div class="pc-modal-footer">\n' +
    '    <span class="pc-char-counter">{{message.text | charCounter:500}}</span>\n' +
    '    <div class="pc-modal-btns">\n' +
    '      <button class="pc-cta pc-cta-grey" ng-click="closeModal()">{{ i18n.t("cancel") }}</button>\n' +
    '      <button class="pc-cta" ng-disabled="message.text.length === 0" ng-click="sendMessage(message.text)">{{ i18n.t("send_message") }}</button>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '  \n' +
    '<div class="modal" pc-modal modal-id="pc-plz-sign-in-modal">\n' +
    '  <h2 class="pc-modal-miniheading">{{ i18n.t("login_required") }}</h2>\n' +
    '\n' +
    '  <button class="pc-cta pc-cta-grey pc-cta-spaceAfter" ng-click="closeModal()">{{ i18n.t("cancel") }}</button><a ng-href="{{ loginPath }}" class="pc-cta">{{ i18n.t("personal.proceed_to_login") }}</a>\n' +
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
  $templateCache.put('views/pc_donations.html',
    '<h2 class="pc-linedTop-title" ng-click="toggleMobile()">\n' +
    '  <span class="i-icon visible-inline-xs" ng-class="{\'i-glyph-icon-30-frontarrow\': compressedMobile, \'i-glyph-icon-30-downcarrot\': !compressedMobile}"></span><!--\n' +
    '  --><span>{{::i18n.t("personal.donations")}}</span><span class="pc-linedTop-title-number">{{donationsCount | number}}</span>\n' +
    '</h2>\n' +
    '<div class="container-xs pc-donations-container" ng-class="{\'hidden-xs\': compressedMobile}">\n' +
    '  <div ng-repeat="donation in shownDonations" class="pc-donation">\n' +
    '    <img ng-src="{{donation.photo_url}}" class="pc-donation-photo" />\n' +
    '    <div class="pc-donation-amt">{{donation.amount}}</div>\n' +
    '    <div class="pc-donation-name">\n' +
    '      <span>{{donation.name}}</span>\n' +
    '    </div>\n' +
    '    <div class="pc-donation-timestamp">{{donation.timestamp}}</div>\n' +
    '    <div class="pc-donation-comment">{{donation.comment}}</div>\n' +
    '  </div>\n' +
    '  <a ng-if="shownDonations.length < donationsCount" href="" class="pc-linedTop-showMore" ng-click="showMore()">{{::i18n.t("show_more")}}</a>\n' +
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
  $templateCache.put('views/pc_fb_share.html',
    '<div ng-click="shareFacebook()">\n' +
    '  <span class="pc-social-icon i-icon i-glyph-icon-30-facebook"></span>\n' +
    '  <span class="pc-social-text">{{buttonText}}</span>\n' +
    '  <span class="pc-social-number" ng-if="fbTotalCount !== null">{{fbTotalCount | abbrevNumFmt}}</span>\n' +
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
  $templateCache.put('views/pc_story.html',
    '<div class="pc-story-body" ng-bind-html="campaignStoryHtml"></div>\n' +
    '<a class="pc-story-showMore" ng-if="truncated" href=\'\' ng-click="showMore()">{{::i18n.t("read_more")}}</a>\n' +
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
  $templateCache.put('views/pc_updates.html',
    '<h2 class="visible-xs pc-linedTop-title" ng-click="toggleMobile()">\n' +
    '  <span class="i-icon visible-inline-xs" ng-class="{\'i-glyph-icon-30-frontarrow\': compressedMobile, \'i-glyph-icon-30-downcarrot\': !compressedMobile}"></span><!--\n' +
    '  --><span>{{::i18n.t("personal.updates")}}</span><span class="pc-linedTop-title-number">{{count}}</span>\n' +
    '</h2>\n' +
    '\n' +
    '<div class="container-xs">\n' +
    '  <div class="pc-update" ng-class="{\'hidden-xs\': compressedMobile}" ng-repeat="update in visibleUpdates()">\n' +
    '    <div class="pc-update-timestamp"><span ng-if="update.delete_path"><a href="" class="pc-update-delete-link" ng-click="showDeleteConfirmation(update)">{{::i18n.t(\'delete_update\')}}</a> | </span>{{update.timestamp}}</div>\n' +
    '    <h2 class="pc-update-title">{{update.title}}</h2>\n' +
    '    <div class="pc-update-body" ng-bind-html="update.body_html"></div>\n' +
    '  </div>\n' +
    '\n' +
    '  <div ng-if="visibleUpdates().length < count" class="hidden-xs pc-update-between">\n' +
    '    <a ng-click="showMore()" class="i-aqua-link pc-seeAllUpdates">{{::i18n.t("personal.see_all_updates")}}</a>\n' +
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
  $templateCache.put('views/campaign-tags.html',
    '<div class="i-campaign-tagContainer">\n' +
    '  <a class="i-campaign-tagLink" ng-repeat="tag in campaign.tag_list" href="/tags/{{tag}}">#{{tag}}</a>\n' +
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
  $templateCache.put('views/campaign-basic-info.html',
    '<div class="row">\n' +
    '\n' +
    '  <div class="col-xs-10">\n' +
    '    <!-- Campaign Title -->\n' +
    '    <h1 class="i-campaign-basicInfo-title">{{campaign.title}}</h1>\n' +
    '\n' +
    '    <!-- Campaign Category -->\n' +
    '    <div class="i-campaign-basicInfo-meta" ng-if="campaign.category">\n' +
    '      <span class="i-icon i-category-icon i-glyph-icon-22-{{campaignCategory()}}"></span>\n' +
    '      <span class="i-category-text">{{campaign.category}}</span>\n' +
    '    </div>\n' +
    '\n' +
    '    <!-- Campaign location -->\n' +
    '    <div class="i-campaign-basicInfo-meta">\n' +
    '      <span class="i-icon i-glyph-icon-30-location"></span>\n' +
    '      <span class="i-project-location-text">{{campaign.city}}</span>\n' +
    '    </div>\n' +
    '\n' +
    '  </div>\n' +
    '\n' +
    '  <!-- Campaign Follow -->\n' +
    '  <div class="col-xs-2" style="position:relative;">\n' +
    '    <a\n' +
    '      ng-class="{\'i-active\': campaign.followed && campaign.state() !== campaign.states.draft, \'ng-hide-add\': loadingFollowAsync}"\n' +
    '      ng-click="campaign.state() !== campaign.states.draft && followToggle()"\n' +
    '      ng-disabled="campaign.state() === campaign.states.draft"\n' +
    '      ga-event-on="click"\n' +
    '      ga-event-category="Mobile Web Campaign Page"\n' +
    '      ga-event-action="Tap Follow Heart"\n' +
    '      ga-event-label="{{loggedIn ? \'Logged In\' : \'Logged Out\'}}"\n' +
    '      class="i-glyph-icon-30-following i-campaign-basicInfo-follow">\n' +
    '    </a>\n' +
    '    <div class="i-campaign-spinner" ng-class="{\'ng-show-add\': loadingFollowAsync}"></div>\n' +
    '  </div>\n' +
    '\n' +
    '</div>\n' +
    '\n' +
    '<div class="col-sm-1 col-md-8 col-lg-8">\n' +
    '\n' +
    '  <div class="clearfix"></div>\n' +
    '\n' +
    '  <!-- Campaign Tagline -->\n' +
    '  <p class="tagline i-campaign-basicInfo-tagline">{{campaign.tagline}}</p>\n' +
    '  <div class="i-campaign-basicInfo-tagList">\n' +
    '    <div campaign-tags></div>\n' +
    '  </div>\n' +
    '\n' +
    '  <a class="i-campaign-basicInfo-readStory" \n' +
    '     ui-sref="story"\n' +
    '     ga-event-on="click"\n' +
    '     ga-event-category="Mobile Web Campaign Page"\n' +
    '     ga-event-action="Tap Read Story">{{::i18n.t("read_story")}} <span class="i-icon i-glyph-icon-30-rightarrow"></span></a>\n' +
    '</div>\n' +
    '\n' +
    '<div class="i-login-modal-container i-hidden" path="{{campaignFbLoginFollowPath}}" campaign-login></div>\n' +
    '<div campaign-modal></div>\n' +
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
  $templateCache.put('views/campaign-contact.html',
    '<div class="i-campaignContact-ownerName">{{i18n.t(\'contact_campaign_owner\', {campaign_owner: owner.name})}}</div>\n' +
    '<div class="i-campaignContact-note">{{i18n.t(\'trust_passport.campaign_owner_will_be_able_to_reply_directly\', {owner: owner.name})}}</div>\n' +
    '<textarea class="i-campaignContact-message" ng-model="message.text" maxlength="500"></textarea>\n' +
    '<button class="i-cta-1" ng-disabled="message.text.length == 0" ng-click="sendMessage()">{{::i18n.t(\'send_message\')}}</button>\n' +
    '<button class="i-campaignContact-cancel" ui-sref="trust_passport">{{::i18n.t(\'cancel\')}}</button>\n' +
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
  $templateCache.put('views/campaign-funding-info.html',
    '<div\n' +
    '  ng-if="campaign.isInDemand()"\n' +
    '  class="i-indemand-label">\n' +
    '  {{::i18n.t(\'in_demand_label\')}}\n' +
    '</div>\n' +
    '\n' +
    '<div class="i-funds-raised-of-goal">\n' +
    '  <span\n' +
    '    class="i-funds-raised"\n' +
    '    ng-bind-html="campaign.forever_funding_combined_balance | iggCurrency : campaign.currency.iso_num : \'html\'">\n' +
    '  </span>\n' +
    '\n' +
    '  <span ng-switch="campaign.isInDemand()" class="i-goal">\n' +
    '    <span ng-switch-when="true">{{::i18n.t("total_funds_raised")}}</span>\n' +
    '    <span ng-switch-when="false">\n' +
    '      {{::i18n.t("raised_of")}}\n' +
    '      {{campaign.goal | iggCurrency : campaign.currency.iso_num : null}}\n' +
    '    </span>\n' +
    '  </span>\n' +
    '</div>\n' +
    '\n' +
    '<div ng-if="!campaign.isInDemand()">\n' +
    '  <div class="i-funding-progress-container">\n' +
    '    <div class="i-funding-progress-bar" style="width: {{progressBarWidth()}}%;"></div>\n' +
    '  </div>\n' +
    '\n' +
    '  <div class="i-time-left">\n' +
    '    <em>{{timeLeft().amount}}</em> {{timeLeft().unit}}\n' +
    '  </div>\n' +
    '\n' +
    '  <div class="i-funders">\n' +
    '    <em>{{campaign.contributions_count | number : 0}}</em> {{stringForNumberOfFunders()}}\n' +
    '  </div>\n' +
    '</div>\n' +
    '\n' +
    '<div class="clearfix"></div>\n' +
    '\n' +
    '<div\n' +
    '  ng-if="campaign.state() === campaign.states.draft"\n' +
    '  class="i-campaign-funding-call-to-action i-cta-1"\n' +
    '  disabled>\n' +
    '  {{ i18n.t(\'contribute_now\') }}\n' +
    '</div>\n' +
    '\n' +
    '<a\n' +
    '  ng-if="campaign.state() === campaign.states.published &&\n' +
    '         !campaign.funding_invalid_yet_live"\n' +
    '  class="i-campaign-funding-call-to-action i-cta-1"\n' +
    '  href="{{campaignContributionPath}}"\n' +
    '  ga-event-on="click"\n' +
    '  ga-event-category="Mobile Web Campaign Page"\n' +
    '  ga-event-action="Tap Contribute Now Button"\n' +
    '  ga-event-label="Campaign Page"\n' +
    '  ng-click="finished(\'responsive_campaign_page\')">\n' +
    '  {{ i18n.t(\'contribute_now\') }}\n' +
    '</a>\n' +
    '\n' +
    '<a\n' +
    '  ng-if="campaign.state() === campaign.states.inDemand &&\n' +
    '        !campaign.funding_invalid_yet_live"\n' +
    '  class="i-campaign-funding-call-to-action i-cta-1"\n' +
    '  href="{{campaignContributionPath}}"\n' +
    '  ga-event-on="click"\n' +
    '  ga-event-category="Mobile Web Campaign Page"\n' +
    '  ga-event-action="Tap Contribute Now Button"\n' +
    '  ga-event-label="Campaign Page"\n' +
    '  ng-click="finished(\'responsive_campaign_page\')">\n' +
    '  {{ inDemandCTA() }}\n' +
    '</a>\n' +
    '\n' +
    '<div\n' +
    '  ng-if="campaign.state() === campaign.states.ended"\n' +
    '  class="i-campaign-funding-ended">\n' +
    '  <span class="i-campaign-funding-ended-upper">{{::i18n.t("closed")}}</span>\n' +
    '  <span class="i-dont-break">\n' +
    '    {{ onDateText(campaign.funding_ends_at) }}\n' +
    '  </span>\n' +
    '</div>\n' +
    '\n' +
    '<div\n' +
    '  ng-if="campaign.state() === campaign.states.inDemandEnded"\n' +
    '  class="i-campaign-funding-ended">\n' +
    '  <span class="i-campaign-funding-ended-upper">{{::i18n.t("closed")}}</span>\n' +
    '  <span class="i-dont-break">\n' +
    '    {{ onDateText(campaign.forever_funding_ends_at) }}\n' +
    '  </span>\n' +
    '</div>\n' +
    '\n' +
    '<div\n' +
    '  ng-if="campaign.funding_invalid_yet_live &&\n' +
    '         (campaign.state() === campaign.states.published ||\n' +
    '         campaign.state() === campaign.states.inDemand)"\n' +
    '  class="i-campaign-funding-invalid">\n' +
    '  {{ i18n.t(\'contribute_now\') }}\n' +
    '</div>\n' +
    '\n' +
    '\n' +
    '<a\n' +
    '  ng-if="showMobileShareButton === \'experiment\'"\n' +
    '  class="shareButton i-campaign-funding-call-to-action"\n' +
    '  ng-click="shareFacebook()">\n' +
    '  <i class="shareButton-facebookImage i-glyph-icon-30-facebook"> </i>\n' +
    '  {{ i18n.t(\'mobile.share_this_campaign\') }}\n' +
    '</a>\n' +
    '\n' +
    '<div class="i-funding-type">\n' +
    '  <div ng-if="campaign.funding_invalid_yet_live" class="i-campaign-funding-invalid-blurb">\n' +
    '    {{::i18n.t(\'funding_options_invalid.mobile_contribute_subheader\')}}\n' +
    '  </div>\n' +
    '  <div ng-if="!campaign.funding_invalid_yet_live">\n' +
    '    <span ng-if="campaign.state() === campaign.states.draft ||\n' +
    '                 campaign.state() === campaign.states.published ||\n' +
    '                 campaign.state() === campaign.states.ended">\n' +
    '      <strong>{{fundingType()}}</strong>: {{fundingBlurb()}}\n' +
    '    </span>\n' +
    '    <div ng-if="campaign.isInDemand()" ng-class="{\'fundingInfo--externalCampaign\': campaign.is_external_campaign}">\n' +
    '      <div class="fundingInfo-nowOnIndiegogo" ng-if="campaign.is_external_campaign">{{::i18n.t("now_on_indiegogo")}} </div>\n' +
    '      {{foreverFundingBlurb()}}\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '\n' +
    '<div class="i-facebook-friend" ng-if="facebookFriendContributor()">\n' +
    '  <div class="i-facebook-avatar" style="background-image: url({{facebookFriendContributor().avatar_url}})"></div>\n' +
    '  <div class="i-facebook-name" ng-bind-html="facebookFriendContributor().nameWithCount"></div>\n' +
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
  $templateCache.put('views/campaign-login-modal.html',
    '<div class="i-login-modal">\n' +
    '  <a class="close-modal-btn" ng-click="hideModal()"><span class="i-icon i-glyph-icon-30-close">&nbsp;</span></a>\n' +
    '  <h3 class="facebook-login-title">{{::i18n.t("follow_this_campaign")}}</h3>\n' +
    '  <p class="facebook-login-subtitle">{{::i18n.t("mobile.keep_track_of_this_campaign")}}</p>\n' +
    '  <a href="{{path}}" \n' +
    '     class="facebook-login-btn ui-btn"\n' +
    '     ga-event-on="click"\n' +
    '     ga-event-category="Mobile Web Campaign Page"\n' +
    '     ga-event-action="Login from Follow Modal">\n' +
    '    <span class="i-icon i-glyph-icon-30-facebook"></span> <span>{{::i18n.t("log_in_with_facebook")}}</span>\n' +
    '  </a>\n' +
    '  <p class="facebook-login-permissions">{{::i18n.t("mobile.never_post_without_fb_permission")}}</p>\n' +
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
  $templateCache.put('views/campaign-modal.html',
    '<div class="i-flash-modal-container" ng-class="{\'i-visible\': modalVisible}" ng-click="hideModal()">\n' +
    '  <div class="i-flash-modal"><span class="i-icon i-glyph-icon-30-close close-modal-btn"></span><div class="i-flash-modal-content" ng-bind-html="trustedMessage"></div></div>\n' +
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
  $templateCache.put('views/campaign-perks.html',
    '<h2\n' +
    '  ng-if="perks.length > 0 &&\n' +
    '         !campaign.isInDemand()"\n' +
    '  class="i-perks-header i-campaign-section-header">\n' +
    '  {{::i18n.t(\'select_perk\')}}\n' +
    '</h2>\n' +
    '\n' +
    '<div\n' +
    '  ng-if="perks.length > 0 && campaign.isInDemand()"\n' +
    '  class="i-perks-header i-campaign-section-header i-campaign-section-header--slim">\n' +
    '</div>\n' +
    '\n' +
    '<div\n' +
    '  id="perk_id_{{perk.id}}"\n' +
    '  class="i-perk"\n' +
    '  ng-class="{\'i-sold-out\': perk.sold_out}"\n' +
    '  ng-repeat="perk in perks">\n' +
    '  <div class="i-perk-header"\n' +
    '       ng-click="perk.expanded = !perk.expanded"\n' +
    '       ga-event-on="click"\n' +
    '       ga-event-category="Mobile Web Campaign Page"\n' +
    '       ga-event-action="Expand Perk"\n' +
    '       ga-event-label="{{gaEventLabelForPerk(perk)}}">\n' +
    '    <div\n' +
    '      class="i-perk-expand-toggle i-icon pull-right"\n' +
    '      ng-class="{\'i-glyph-icon-30-downcarrot\': !perk.expanded, \'i-glyph-icon-30-upcarrot\': perk.expanded}">\n' +
    '    </div>\n' +
    '    <div class="i-perk-sold-out-label" ng-if="perk.sold_out">{{::i18n.t(\'sold_out\')}}</div>\n' +
    '    <div class="i-perk-featured" ng-if="perk.has_callout_label">{{::perk.callout_label}}</div>\n' +
    '    <div class="i-perk-money">\n' +
    '      <span class="i-perk-amount" ng-bind-html="perk.amount | iggCurrency : campaign.currency.iso_num : \'html\'"></span>\n' +
    '      <span class="i-perk-plusShipping"\n' +
    '            ng-if="perk.shipping_address_required && perk.shipping && !perk.shipping.is_free_everywhere">\n' +
    '        + {{::i18n.t(\'contribution_flow.shipping\')}}\n' +
    '      </span>\n' +
    '    </div>\n' +
    '    <div class="i-perk-label">{{perk.label}}</div>\n' +
    '\n' +
    '    <div class="i-perkBottom-label" ng-switch="perk.number_available">\n' +
    '      <span ng-switch-default ng-bind-html="i18n.t(\'x_out_of_y_claimed_html\', {x: capClaimedPerks(perk), y: perk.number_available })"></span>\n' +
    '      <span ng-switch-when="null" ng-bind-html="i18n.t(\'x_claimed_html\', {number_claimed: perk.number_claimed })"></span>\n' +
    '    </div>\n' +
    '\n' +
    '    <div ng-if="perk.estimated_delivery_date">\n' +
    '      <span class="i-perkBottom-label">{{i18n.t(\'contribution_flow.line_items.estimated_delivery\')}}</span>\n' +
    '      <span class="i-perkBottom-value">{{perk.estimated_delivery_date | date : \'MMMM yyyy\'}}</span>\n' +
    '    </div>\n' +
    '\n' +
    '    <ships-to-countries ng-if="perk.hasShippingObject()"\n' +
    '                        desktop-and-more="HOVER"\n' +
    '                        mobile-and-more="CLICK"\n' +
    '                        option-perk-id="perk.id">\n' +
    '    </ships-to-countries>\n' +
    '  </div>\n' +
    '\n' +
    '  <div class="i-perk-expanded-info" ng-show="perk.expanded">\n' +
    '    <div class="i-perk-description">{{perk.description}}</div>\n' +
    '    <div class="i-perk-cta-wrap">\n' +
    '      <a\n' +
    '        class="i-perk-cta i-cta-1"\n' +
    '        href="{{contributionFlowWithPerk(perk)}}"\n' +
    '        ng-if="!perk.sold_out &&\n' +
    '               !campaign.funding_invalid_yet_live &&\n' +
    '               (campaign.state() === campaign.states.published ||\n' +
    '               campaign.state() === campaign.states.inDemand)"\n' +
    '        ga-event-on="click"\n' +
    '        ga-event-category="Mobile Web Campaign Page"\n' +
    '        ga-event-action="Tap Get this Perk"\n' +
    '        ga-event-label="{{gaEventLabelForPerk(perk)}}"\n' +
    '        ng-click="finished(\'responsive_campaign_page\')">\n' +
    '        {{i18n.t(\'contribution_flow.get_this_perk\')}}\n' +
    '      </a>\n' +
    '\n' +
    '      <div\n' +
    '        class="i-perk-cta i-cta-1"\n' +
    '        ng-if="!perk.sold_out && campaign.state() === campaign.states.draft"\n' +
    '        disabled>\n' +
    '        {{i18n.t(\'contribution_flow.get_this_perk\')}}\n' +
    '      </div>\n' +
    '    </div>\n' +
    '\n' +
    '\n' +
    '  </div>\n' +
    '  <div class="i-perk-divider"></div>\n' +
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
  $templateCache.put('views/campaign-pitchmedia.html',
    '<div campaign-video\n' +
    '  type="{{campaign.main_video_info.type}}"\n' +
    '  id="{{campaign.main_video_info.id}}"\n' +
    '  overlay_url="{{campaign.video_overlay_url}}"\n' +
    '  class="i-campaign-video"\n' +
    '  ng-if="campaign.main_video_info.type"\n' +
    '  style="height: {{videoHeight}}">\n' +
    '</div>\n' +
    '\n' +
    '<img class="i-campaign-pitchMedia-image" ng-src="{{campaign_pitch_image}}" ng-if="!campaign.main_video_info.type && campaign_pitch_image">\n' +
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
  $templateCache.put('views/campaign-story.html',
    '<section class="i-campaignStory-header" \n' +
    '         ui-sref="main"\n' +
    '         ga-event-on="click"\n' +
    '         ga-event-category="Mobile Web Campaign Page"\n' +
    '         ga-event-action="Tap Story Back Button"\n' +
    '         ga-event-label="Top"\n' +
    '         style="background-image: url({{campaign.image_types.medium}})">\n' +
    '  <div class="i-campaignStory-headerOverlay">\n' +
    '    <span class="i-icon i-glyph-icon-30-backarrow" title="i-glyph-icon-30-backarrow"></span>\n' +
    '    <span>{{campaign.title}}</span>\n' +
    '  </div>\n' +
    '</section>\n' +
    '\n' +
    '<!-- don\'t show this section if it has nothing inside so things look nice -->\n' +
    '<!-- TODO: remove showContributeSection due to new styling -->\n' +
    '<section\n' +
    '  class="i-campaignStory-contributeSection"\n' +
    '  ng-if="showContributeSection()">\n' +
    '\n' +
    '  <collapsable title="{{i18n.t(\'verified_nonprofit\')}}" \n' +
    '               glyph-class="i-icon i-glyph-icon-30-charity"\n' +
    '               has-content="{{!!campaign.nonprofit_campaign_page_description}}"\n' +
    '               ng-if="campaign.nonprofit"\n' +
    '               ga-category="Mobile Web Campaign Page"\n' +
    '               ga-action="Expand Non-Profit">{{campaign.nonprofit_campaign_page_description}}</collapsable>\n' +
    '\n' +
    '  <collapsable title="{{campaign.partner_name}}" \n' +
    '               image-url="{{campaign.partner_image_url}}"\n' +
    '               has-content="{{!!campaign.partner_campaign_page_description}}"\n' +
    '               ng-if="campaign.partner_name"\n' +
    '               ga-category="Mobile Web Campaign Page"\n' +
    '               ga-action="Expand Sponsorship">{{campaign.partner_campaign_page_description}}</collapsable>\n' +
    '\n' +
    '  <div class="i-campaignStory-contributeButton-container"     ng-if="showContributeButton()">\n' +
    '    <a\n' +
    '      class="i-campaignStory-contributeButton i-cta-1"\n' +
    '      href="{{campaignContributionPath}}"\n' +
    '      ga-event-on="click"\n' +
    '      ga-event-category="Mobile Web Campaign Page"\n' +
    '      ga-event-action="Tap Contribute Now Button"\n' +
    '      ga-event-label="Read Story Top">\n' +
    '      {{i18n.t("contribute_now")}}\n' +
    '    </a>\n' +
    '  </div>\n' +
    '\n' +
    '  <div\n' +
    '    ng-if="campaign.state() === campaign.states.draft"\n' +
    '    class="i-campaignStory-contributeButton i-cta-1"\n' +
    '    disabled>\n' +
    '    {{::i18n.t("contribute_now")}}\n' +
    '  </div>\n' +
    '</section>\n' +
    '\n' +
    '<section class="i-campaign-webview">\n' +
    '  <div class="i-campaignStory-description i-campaign-description" ng-bind-html="campaign.description_html"></div>\n' +
    '</section>\n' +
    '\n' +
    '<hr class="i-separator--campaignPage">\n' +
    '\n' +
    '<section class="i-campaignStory-footer">\n' +
    '  <a class="i-campaignStory-footer-back"\n' +
    '     ui-sref="main"\n' +
    '     ga-event-on="click"\n' +
    '     ga-event-category="Mobile Web Campaign Page"\n' +
    '     ga-event-action="Tap Story Back Button"\n' +
    '     ga-event-label="Bottom">\n' +
    '    <span class="i-icon i-glyph-icon-30-backarrow i-campaignStory-footer-backArrow"></span>\n' +
    '    <span class="i-campaignStory-footer-title">{{campaign.title}}</span>\n' +
    '  </a>\n' +
    '\n' +
    '  <a\n' +
    '    ng-if="showContributeButton()"\n' +
    '    class="i-campaignStory-contributeButton i-cta-1"\n' +
    '    href="{{campaignContributionPath}}"\n' +
    '    ga-event-on="click"\n' +
    '    ga-event-category="Mobile Web Campaign Page"\n' +
    '    ga-event-action="Tap Contribute Now Button"\n' +
    '    ga-event-label="Read Story Bottom">\n' +
    '    {{::i18n.t("contribute_now")}}\n' +
    '  </a>\n' +
    '\n' +
    '  <div\n' +
    '    ng-if="campaign.state() === campaign.states.draft"\n' +
    '    class="i-campaignStory-contributeButton i-cta-1"\n' +
    '    disabled>\n' +
    '    {{::i18n.t("contribute_now")}}\n' +
    '  </div>\n' +
    '</section>\n' +
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
  $templateCache.put('views/campaign-team-members.html',
    '<h2 class="i-campaign-section-header">{{::i18n.t(\'campaign_editor.team.team_members\')}}</h2>\n' +
    '\n' +
    '<div class="i-team-member" ng-repeat="teamMember in campaign.team_members">\n' +
    '  <div class="i-team-member-header">\n' +
    '    <div class="i-team-member-avatar" style="background-image: url(\'{{$sce.trustAsUrl(teamMember.avatar_url)}}\')"></div>\n' +
    '\n' +
    '    <div class="i-team-member-text">\n' +
    '      <div class="i-team-member-name">{{teamMember.name}}</div>\n' +
    '      <div class="i-team-member-role">{{teamMember.role}}</div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n' +
    '\n' +
    '<div class="i-team-members-divider"></div>\n' +
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
  $templateCache.put('views/campaign-trust-passport.html',
    '<section class="i-campaignTrustPassport-header" ui-sref="main" style="background-image: url({{campaign.image_types.medium}})">\n' +
    '  <div class="i-campaignTrustPassport-headerOverlay">\n' +
    '    <span class="i-icon i-glyph-icon-30-backarrow" title="i-glyph-icon-30-backarrow"></span>\n' +
    '    <span>{{project.title}}</span>\n' +
    '  </div>\n' +
    '</section>\n' +
    '\n' +
    '<div class="i-campaignTrustPassport-aboutPage">\n' +
    '  <img class="i-campaignTrustPassport-ownerAvatar" ng-src="{{owner.avatar_url}}"/>\n' +
    '  <div class="i-campaignTrustPassport-ownerInfo">\n' +
    '    <div class="i-campaignTrustPassport-ownerName">{{owner.name}}</div>\n' +
    '    <div class="i-campaignTrustPassport-ownerRole">{{owner.role}}</div>\n' +
    '  </div>\n' +
    '\n' +
    '  <div class="i-campaignTrustPassport-aboutOwner" ng-if="owner.description.length > 0">\n' +
    '    <div class="i-campaignTrustPassport-aboutOwnerTitle">About {{owner.first_name}}</div>\n' +
    '    <div class="i-campaignTrustPassport-aboutOwnerText">{{owner.description}}</div>\n' +
    '  </div>\n' +
    '\n' +
    '  <div class="i-campaignTrustPassport-verifications" ng-if="hasVerifications">\n' +
    '    <div class="i-campaignTrustPassport-verificationsTitle">{{::i18n.t(\'verifications\')}}</div>\n' +
    '    <div class="i-campaignTrustPassport-identityVerification" ng-if="owner.admin_verified">\n' +
    '      <span class="i-icon i-glyph-icon-30-check"></span>\n' +
    '      {{::i18n.t(\'trust_passport.identity_verified\')}}\n' +
    '    </div>\n' +
    '    <div class="i-campaignTrustPassport-emailVerification" ng-if="owner.email_verified">\n' +
    '      <span class="i-icon i-glyph-icon-30-mail"></span>\n' +
    '      {{::i18n.t(\'email_verified\')}}\n' +
    '    </div>\n' +
    '    <div class="i-campaignTrustPassport-facebookVerification" ng-if="owner.facebook_friends_count">\n' +
    '      <span class="i-icon i-glyph-icon-30-facebook"></span>\n' +
    '      {{i18n.t(\'facebook_friends\', {count: owner.facebook_friends_count})}}\n' +
    '    <span ng-if="!owner.facebook_profile_url">\n' +
    '      {{i18n.t(\'facebook_friends\', {count: owner.facebook_friends_count})}}\n' +
    '    </span>\n' +
    '    </div>\n' +
    '    <div class="i-campaignTrustPassport-linkedinVerification" ng-if="owner.linkedin_profile_url">\n' +
    '      <span class="i-icon i-glyph-icon-30-linkedin"></span>\n' +
    '      <span>{{::i18n.t(\'linkedin_verified\')}}</span>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '\n' +
    '  <div class="i-campaignTrustPassport-impact">\n' +
    '    <div class="i-campaignTrustPassport-impactTitle">{{::i18n.t(\'trust_passport.impact\')}}</div>\n' +
    '    <div class="i-campaignTrustPassport-impactCampaigns">\n' +
    '      {{i18n.t(\'trust_passport.campaigns_created\', {count: owner.campaigns_count})}}\n' +
    '    </div>\n' +
    '    <div class="i-campaignTrustPassport-impactContributions" ng-if="owner.contributions_count">\n' +
    '      {{i18n.t(\'trust_passport.contributions_made\', {count: owner.contributions_count})}}\n' +
    '    </div>\n' +
    '    <div class="i-campaignTrustPassport-impactComments" ng-if="owner.comments_count">\n' +
    '      {{i18n.t(\'trust_passport.comments_made\', {count: owner.comments_count})}}\n' +
    '    </div>\n' +
    '  </div>\n' +
    '\n' +
    '  <a href="" class="i-campaignTrustPassport-contact" ng-click="contact()" ng-if="loggedIn">{{::i18n.t(\'contact\')}}</a>\n' +
    '  <a href="" class="i-campaignTrustPassport-contact" ng-href="{{loginUrl}}" ng-if="!loggedIn">{{::i18n.t(\'contact\')}}</a>\n' +
    '</div>\n' +
    '\n' +
    '<div class="i-campaignTrustPassport-detailsHeader">Details</div>\n' +
    '\n' +
    '<div class="i-campaignTrustPassport-details">\n' +
    '  <div>{{project.category}}</div>\n' +
    '  <div>{{project.location}}</div>\n' +
    '\n' +
    '  <div class="i-campaignTrustPassport-detailHeader">{{::i18n.t(\'trust_passport.recent_activity\')}}</div>\n' +
    '  <div>{{project.activity}}</div>\n' +
    '\n' +
    '  <div class="i-campaignTrustPassport-detailHeader" ng-if="websites.length > 0">{{::i18n.t(\'websites\')}}</div>\n' +
    '  <a target="blank" ng-repeat="website in websites" ng-href="{{website.url}}">{{website.text}}</a>\n' +
    '\n' +
    '  <div class="i-campaignTrustPassport-detailHeader" ng-if="project.bank_account_country">{{::i18n.t(\'bank_account_country\')}}</div>\n' +
    '  <div>{{project.bank_account_country}}</div>\n' +
    '\n' +
    '</div>\n' +
    '\n' +
    '<div class="i-campaignTrustPassport-teamHeader"></div>\n' +
    '\n' +
    '<div class="i-campaignTrustPassport-teamMemberCount">{{i18n.t(\'team_members_reversed\', {count: project.team_members.length})}}</div>\n' +
    '\n' +
    '<div class="i-campaignTrustPassport-teamMembers">\n' +
    '  <div ng-repeat="team_member in project.team_members">\n' +
    '    <img class="i-campaignTrustPassport-teamMemberAvatar" ng-src="{{team_member.avatar_url}}"/>\n' +
    '    <span class="i-icon i-glyph-icon-30-downcarrot" ng-if="team_member.description.trim().length > 0 && !teamMemberDetailsAreVisible(team_member.id)" ng-click="showTeamMemberDetails(team_member.id)"></span>\n' +
    '    <span class="i-icon i-glyph-icon-30-upcarrot" ng-if="teamMemberDetailsAreVisible(team_member.id)" ng-click="hideTeamMemberDetails(team_member.id)"></span>\n' +
    '    <div class="i-campaignTrustPassport-teamMemberInfo">\n' +
    '      <div class="i-campaignTrustPassport-teamMemberName">{{team_member.name}}</div>\n' +
    '      <div class="i-campaignTrustPassport-teamMemberRole">{{team_member.role}}</div>\n' +
    '      <div class="i-campaignTrustPassport-teamMemberVerifications">\n' +
    '        <span class="i-icon i-glyph-icon-30-check i-campaignTrustPassport-identityVerification" ng-if="team_member.admin_verified"></span>\n' +
    '        <span class="i-icon i-glyph-icon-30-mail i-campaignTrustPassport-emailVerification" ng-if="team_member.email_verified"></span>\n' +
    '        <span class="i-icon i-glyph-icon-30-facebook i-campaignTrustPassport-facebookVerification" ng-if="team_member.facebook_verified"></span>\n' +
    '        <span class="i-icon i-glyph-icon-30-linkedin i-campaignTrustPassport-linkedinVerification" ng-if="team_member.linkedin_verified"></span>\n' +
    '      </div>\n' +
    '      <div class="i-campaignTrustPassport-teamMemberDetails" ng-if="team_member.description.trim().length > 0 && teamMemberDetailsAreVisible(team_member.id)">\n' +
    '        {{team_member.description}}\n' +
    '      </div>\n' +
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
  $templateCache.put('views/campaign-trust-teaser.html',
    '<div class="i-campaignTrustTeaser-iconColumn">\n' +
    '  <img class="i-campaignTrustTeaser-avatar" ng-src="{{owner.avatar_url}}"/>\n' +
    '</div>\n' +
    '<div class="i-campaignTrustTeaser-detailsColumn">\n' +
    '  <div class="i-campaignTrustTeaser-detailsColumn-title">\n' +
    '    {{owner.name}}\n' +
    '  </div>\n' +
    '  <div ng-if="owner.admin_verified">\n' +
    '    {{::i18n.t(\'trust_passport.identity_verified\')}}\n' +
    '  </div>\n' +
    '  <div ng-if="owner.email_verified">\n' +
    '    {{::i18n.t("email_verified")}}\n' +
    '  </div>\n' +
    '  <div ng-if="owner.facebook_friends_count">\n' +
    '    {{i18n.t(\'facebook_friends\', {count: owner.facebook_friends_count})}}\n' +
    '  </div>\n' +
    '  <div ng-if="owner.linkedin_profile_url">\n' +
    '    {{::i18n.t("linkedin_verified")}}\n' +
    '  </div>\n' +
    '  <div>\n' +
    '    {{i18n.t(\'team_members\', {count: project.team_members.length}).toLowerCase()}}\n' +
    '  </div>\n' +
    '</div>\n' +
    '<a class="i-campaignTrustTeaser-seeMoreDetails" ng-click="seeMoreDetails()" href="">See more details</a>\n' +
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
  $templateCache.put('views/campaign-video.html',
    '<div class="i-campaign-video-overlay"\n' +
    '  ng-if="overlayUrl"\n' +
    '  style="background-image: url({{overlayUrl}}); height: {{videoHeight}}"\n' +
    '  ng-class="{\'i-hidden\': videoPlaying}"\n' +
    '  ng-click="playVideo()">\n' +
    '  <a class="i-campaign-video-playButton"></a>\n' +
    '</div>\n' +
    '\n' +
    '<!-- the YouTube API replaces the following div with an iframe -->\n' +
    '<div id="i-campaign-video-youtube" ng-if="type === \'youtube\'"></div>\n' +
    '\n' +
    '<iframe\n' +
    '  id="vimeoPlayer"\n' +
    '  src="{{vimeo_video_url}}"\n' +
    '  width="320"\n' +
    '  height="150"\n' +
    '  frameborder="0"\n' +
    '  webkitallowfullscreen\n' +
    '  mozallowfullscreen\n' +
    '  allowfullscreen\n' +
    '  ng-if="type === \'vimeo\'">\n' +
    '</iframe>\n' +
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
  $templateCache.put('views/collapsable.html',
    '<div class="i-collapsable">\n' +
    '  <div class="i-collapsable-sidebar" ng-if="imageUrl || glyphClass">\n' +
    '    <img class="i-collapsable-image" ng-src="{{imageUrl}}" ng-if="imageUrl">\n' +
    '    <div class="i-collapsable-glyph {{glyphClass}}" ng-if="glyphClass && !imageUrl"></div>\n' +
    '  </div>\n' +
    '  <div\n' +
    '    class="i-collapsable-carrot i-icon pull-right"\n' +
    '    ng-class="{\'i-glyph-icon-30-downcarrot\': !itemOpen, \'i-glyph-icon-30-upcarrot\': itemOpen}"\n' +
    '    ng-if="showCollapseControl" ng-click="toggleItemOpen()">\n' +
    '  </div>\n' +
    '  <div class="i-collapsable-content">\n' +
    '    <div class="i-collapsable-header" \n' +
    '         ng-click="toggleItemOpen()" \n' +
    '         ga-event-on="click"\n' +
    '         ga-event-category="gaCategory"\n' +
    '         ga-event-action="gaAction">\n' +
    '\n' +
    '      <div class="i-collapsable-title" ng-if="title">{{title}}</div>\n' +
    '      <div class="i-collapsable-subtitle" ng-if="subtitle">{{subtitle}}</div>\n' +
    '    </div>\n' +
    '\n' +
    '    <div\n' +
    '      class="i-collapsable-expanded"\n' +
    '      ng-if="hasExpandableContent"\n' +
    '      ng-show="itemOpen"\n' +
    '      ng-transclude>\n' +
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
  $templateCache.put('views/contact.html',
    '<div campaign-contact class="i-campaignContact"></div>\n' +
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
  $templateCache.put('views/main-dynamic.html',
    '<fb-tracking-pixel></fb-tracking-pixel>\n' +
    '<div class="i-campaign-pitchMedia" campaign-pitchmedia></div>\n' +
    '<div class="i-campaign-basicInfo" campaign-basic-info></div>\n' +
    '<div class="i-campaign-fundingInfo" campaign-funding-info></div>\n' +
    '<div class="i-campaignTrustTeaser" ng-if="mobileTrustPassport" campaign-trust-teaser></div>\n' +
    '<div class="i-campaign-perks" campaign-perks></div>\n' +
    '<div class="i-campaign-team-members" ng-if="!mobileTrustPassport" campaign-team-members></div>\n' +
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
  $templateCache.put('views/main.html',
    '<campaign-main class="i-campaign-main">\n' +
    '</campaign-main>\n' +
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
  $templateCache.put('views/story.html',
    '<div campaign-story class="i-campaign-story"></div>\n' +
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
  $templateCache.put('views/trust-passport.html',
    '<div campaign-trust-passport></div>\n' +
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
  $templateCache.put('views/us-nonprofit-modal.html',
    '<div class="modal fade i-pcModal">\n' +
    '  <div class="modal-dialog i-pcModalDialog i-nonprofitModalDialog">\n' +
    '    <div class="i-positioned">\n' +
    '      <a class="i-pcModal-close" href="" ng-click="closeModal()"><span class="i-icon i-glyph-icon-30-close"></span></a>\n' +
    '      <div class="i-nonprofitModalDialog-content">\n' +
    '        <div class="i-nonprofitModalDialog-header">{{::i18n.t(\'simple_preview.nonprofit_modal.title\')}}</div>\n' +
    '        <div class="i-nonprofitModalDialog-body" ng-bind-html="i18n.t(\'simple_preview.nonprofit_modal.body_html\')"></div>\n' +
    '        <div class="i-nonprofitModalDialog-buttonRow">\n' +
    '          <a class="i-cta-1 i-nonprofitModalDialog-cta" href="" ng-click="closeModal()">{{::i18n.t(\'simple_preview.nonprofit_modal.cta\')}}</a>\n' +
    '        </div>\n' +
    '      </div>\n' +
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
  $templateCache.put('views/email-importer-modal.html',
    '<div class="modal modal--emailImporter">\n' +
    '  <div class="modal-dialog modal-dialog--emailImporter">\n' +
    '    <a class="emailImporter-close" ng-click="$hide()" aria-hidden="true"><span class="i-icon i-glyph-icon-30-close"></span></a>\n' +
    '    <div class="modal-content--emailImporter">\n' +
    '      <h1 class="emailImporter-title">{{::i18n.pt(\'email_import.share_this_campaign\')}}</h1>\n' +
    '\n' +
    '      <div class="emailImporter-importView" ng-hide="isComposing">\n' +
    '        <div class="i-musty-background emailImporter-importContacts">\n' +
    '          <p class="emailImporter-importContacts-heading">{{::i18n.t(\'email_import.import_contacts\')}}</p>\n' +
    '          <p class="emailImporter-importContacts-subheading">{{::i18n.t(\'email_import.add_existing\')}}</p>\n' +
    '\n' +
    '          <div class="emailImporter-importContacts-emails">\n' +
    '            <div class="emailImporter-provider" ng-click="importGmailContacts()" ng-class="{imported: gmailImported}">\n' +
    '              <div class="emailImporter-provider-icon emailImporter-provider-icon--gmail"></div>\n' +
    '              <span class="emailImporter-provider-name">Gmail</span>\n' +
    '              <div ng-if="gmailImported" class="emailImporter-provider-checkmark"></div>\n' +
    '            </div>\n' +
    '            <div class="emailImporter-provider" ng-click="importYahooContacts()" ng-class="{imported: yahooImported}">\n' +
    '              <div class="emailImporter-provider-icon emailImporter-provider-icon--yahoo"></div>\n' +
    '              <span class="emailImporter-provider-name">Yahoo!</span>\n' +
    '              <div ng-if="yahooImported" class="emailImporter-provider-checkmark"></div>\n' +
    '            </div>\n' +
    '          </div>\n' +
    '        </div>\n' +
    '\n' +
    '        <div class="i-musty-background emailImporter-contactList">\n' +
    '          <form ng-submit="addContact()" class="emailImporter-addContact">\n' +
    '            <input type="text" class="i-text-field emailImporter-addContact-inputField" placeholder="Enter an email" ng-model="contact.email" ng-change="emailChanged()" />\n' +
    '            <input type="submit" class="i-cta-1 i-cta-1-grey emailImporter-addContact-button" ng-disabled="!validEmail()" value="{{::i18n.t(\'email_import.button_add\')}}" />\n' +
    '          </form>\n' +
    '\n' +
    '          <div class="emailImporter-importContacts-selectedMessage" ng-if="showSelectedContacts">\n' +
    '            {{i18n.t(\'email_import.selected_recipient_count\', {selected_count: totalSelected})}} — <a href="" ng-click="showAllContacts()">{{i18n.t(\'email_import.total_recipient_count\', {total_count: contactList.length})}}</a>\n' +
    '          </div>\n' +
    '\n' +
    '          <div class="emailImporter-importContacts-contactList" ng-style="{height: contactListHeight(), lineHeight: contactListHeight()}" ng-click="toggleSelection($event)">\n' +
    '            <div ng-if="contactList.length === 0" class="emailImporter-noContacts">{{::i18n.t(\'email_import.no_contacts\')}}</div>\n' +
    '            <ul>\n' +
    '              <li id="{{::\'email-contact-\' + contactItem.id}}" class="emailImporter-contactList-contact" ng-repeat="contactItem in contactList | orderBy:\'email\' track by contactItem.id"><span>{{::contactItem.email}}</span><div class="pull-right pc-unchecked-checkbox"></div></li>\n' +
    '            </ul>\n' +
    '          </div>\n' +
    '\n' +
    '          <div class="emailImporter-importContacts-recipients">\n' +
    '            {{::i18n.t(\'email_import.recipients\')}} (<a href="" ng-click="onlyShowSelectedContacts()">{{totalSelected}}</a>)\n' +
    '          </div>\n' +
    '          <div ng-if="!allContactsSelected()" class="emailImporter-importContacts-selectAll" ng-click="selectAllContacts(true)">\n' +
    '            <span>{{::i18n.t(\'email_import.select_all\')}}</span>\n' +
    '            <div class="pull-right pc-unchecked-checkbox"></div>\n' +
    '          </div>\n' +
    '          <div ng-if="allContactsSelected()" class="emailImporter-importContacts-selectAll" ng-click="selectAllContacts(false)">\n' +
    '            <span>{{::i18n.t(\'email_import.select_all\')}}</span>\n' +
    '            <div class="pull-right pc-checked-checkbox"></div>\n' +
    '          </div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '\n' +
    '      <div class="emailImporter-messageComposeView i-musty-background" ng-show="isComposing">\n' +
    '        <p class="emailImporter-composeLabel">{{::i18n.t(\'email_import.email_subject\')}}</p>\n' +
    '        <input type="text" class="i-text-field emailImporter-subjectField" ng-model="message.subject"/>\n' +
    '        <p class="emailImporter-composeLabel">{{::i18n.t(\'message_label\')}}</p>\n' +
    '        <textarea class="emailImporter-messageField" ng-model="message.body" ng-style="{height: messageFieldHeight()}"></textarea>\n' +
    '      </div>\n' +
    '\n' +
    '      <div class="emailImporter-actions" ng-if="!isComposing">\n' +
    '          <div class="emailImporter-actions-remainingArea">\n' +
    '            <div class="emailImporter-actions-remainingError" ng-if="remainingCount() <= 0">\n' +
    '              <span>{{::emailLimitReachedMsg}}</span>\n' +
    '            </div>\n' +
    '            <div class="emailImporter-actions-remainingWarning" ng-if="remainingCount() < 250 && remainingCount() > 0">{{remainingMessage()}}</div>\n' +
    '          </div>\n' +
    '        <button class="emailImporter-actions-button i-cta i-cta-1" ng-click="toggleCompose()" ng-disabled="!ableToCompose()">{{::i18n.t(\'email_import.button_compose\')}}</button>\n' +
    '      </div>\n' +
    '      <div class="emailImporter-actions" ng-if="isComposing">\n' +
    '        <button class="emailImporter-actions-button i-cta-1 emailImporter-sendMessagesBtn" ng-click="sendMessages(message)" ng-disabled="!message.subject || !message.body"\n' +
    '                event-on="click" event-name="click_send_email_importer">{{::i18n.t(\'email_import.button_send\')}}</button>\n' +
    '        <button class="emailImporter-actions-button i-cta-1 i-cta-1-grey emailImporter-backBtn" ng-click="toggleCompose()" >{{::i18n.t(\'email_import.button_back\')}}</button>\n' +
    '      </div>\n' +
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
  $templateCache.put('views/email-importer.html',
    '<a href="" ng-click="onImporterClick()" ng-transclude></a>\n' +
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
  $templateCache.put('views/share-email.html',
    '<div class="pc-shareWizard-container">\n' +
    '  <div class="pc-shareWizard-content container pc-shareWizard-email">\n' +
    '    <div class="pc-shareWizard-content-top">\n' +
    '      <img class="pc-shareWizard-content-top-image visible-xs" ng-src="{{urls.fundraiser_image_url}}">\n' +
    '      <div ng-if="twitterShared">\n' +
    '        <div class="pc-shareWizard-content-top-subtitle hidden-xs">{{i18n.pt(\'share_wizard.great_work_promote\')}}</div>\n' +
    '        <div class="pc-shareWizard-content-top-title">{{i18n.pt(\'share_wizard.next_reach_out\')}}</div>\n' +
    '      </div>\n' +
    '      <div ng-if="!twitterShared">\n' +
    '        <div class="pc-shareWizard-content-top-subtitle hidden-xs">{{i18n.pt(\'share_wizard.one_last_step\')}}</div>\n' +
    '        <div class="pc-shareWizard-content-top-title">{{i18n.pt(\'share_wizard.reach_out\')}}</div>\n' +
    '      </div>\n' +
    '      <a href="{{urls.email_share_url}}" target="_blank" class="i-cta-1 i-cta-1-email i-shareWizard-btn i-shareWizard-btn-iconed visible-xs"\n' +
    '          event-on="click" event-name="click_email_mailto" event-tags="{{eventTags()}}">\n' +
    '        {{::i18n.t(\'share_via_email\')}}\n' +
    '      </a>\n' +
    '      <div class="pc-shareWizard-skip hidden-xs" ng-click="goToPostShare()"\n' +
    '          event-on="click" event-name="share_wizard_skip" event-tags="{{eventTags()}}">\n' +
    '        {{i18n.pt(\'share_wizard.skip\')}}\n' +
    '      </div>\n' +
    '      <div class="pc-shareWizard-back hidden-xs" ng-click="goTo(\'twitter\')"\n' +
    '          event-on="click" event-name="share_wizard_back" event-tags="{{eventTags()}}">\n' +
    '        <span class="i-icon i-glyph-icon-30-leftarrow"></span>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '    <div class="pc-shareWizard-content-middle i-musty-background hidden-xs">\n' +
    '      <div class="pc-shareWizard-content-middle-container pc-shareWizard-content-middle-socialContainer pc-socialContainer-email" ng-click="openEmailImporter()">\n' +
    '        <div class="pc-socialContainer-shareSummary">\n' +
    '          <div class="pc-socialContainer-shareSummary-emailSubject">\n' +
    '            <span class="pc-emailSubject-tag">{{::i18n.t(\'email_import.email_subject\')}}: </span>\n' +
    '            {{i18n.pt(\'email_import.from_owner.email_subject\', {project_title: fundraiser.title})}}\n' +
    '          </div>\n' +
    '          <div class="pc-socialContainer-shareSummary-emailBody">\n' +
    '            <p>{{i18n.pt(\'share_wizard.email_mock.greeting\')}}</p>\n' +
    '            <p>\n' +
    '              {{i18n.pt(\'share_wizard.email_mock.reaching_out\', {fundraiser_title: fundraiser.title})}}\n' +
    '              <span ng-if="!!fundraiser.beneficiary">{{i18n.pt(\'share_wizard.email_mock.beneficiary\', {beneficiary_name: fundraiser.beneficiary})}}</span>\n' +
    '            </p>\n' +
    '            <p>{{i18n.pt(\'share_wizard.email_mock.ways_to_help\')}}</p>\n' +
    '          </div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '    <div class="pc-shareWizard-content-bottom">\n' +
    '      <div class="pc-shareWizard-content-bottom-left">\n' +
    '        <div class="pc-shareWizard-content-bottom-header">{{i18n.pt(\'share_wizard.did_you_know\')}}</div>\n' +
    '        <div>{{i18n.pt(\'share_wizard.fundraisers_shared_via_email\')}}</div>\n' +
    '      </div>\n' +
    '      <div class="pc-shareWizard-content-bottom-right hidden-xs" email-importer email-from="from_owner" post-email-callback="emailCallback()">\n' +
    '        <div class="i-cta-1 i-shareWizard-btn js-emailImporter"\n' +
    '             event-on="click" event-name="click_email_importer" event-tags="{{eventTags()}}">\n' +
    '          {{i18n.pt(\'share_wizard.choose_contacts\')}}\n' +
    '        </div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div class="pc-shareWizard-nav visible-xs">\n' +
    '    <div class="i-icon i-glyph-icon-30-leftarrow" ng-click="goTo(\'twitter\')"\n' +
    '         event-on="click" event-name="share_wizard_back" event-tags="{{eventTags()}}"></div>\n' +
    '    <div ng-click="goToPostShare()"\n' +
    '         event-on="click" event-name="share_wizard_skip" event-tags="{{eventTags()}}">\n' +
    '      {{i18n.pt(\'share_wizard.skip\')}}\n' +
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
  $templateCache.put('views/share-facebook-2.html',
    '<div class="pc-shareWizard-container">\n' +
    '  <div class="pc-shareWizard-content container pc-shareWizard-facebook">\n' +
    '    <div class="pc-shareWizard-content-top">\n' +
    '      <div class="pc-shareWizard-content-top-subtitle hidden-xs">{{i18n.pt(\'share_wizard.we_want_you_to_get_off_at_good_start\')}}</div>\n' +
    '      <div class="pc-shareWizard-content-top-title">{{i18n.pt(\'share_wizard.sharing_on_fb_is_important\')}}</div>\n' +
    '    </div>\n' +
    '    <div class="pc-shareWizard-content-middle i-musty-background">\n' +
    '      <div class="pc-content-middle-valueProp">\n' +
    '        <div class="pc-content-middle-valueProp-icon">\n' +
    '        </div>\n' +
    '        <div class="pc-content-middle-valueProp-content">\n' +
    '          <div class="pc-content-middle-valueProp-title">{{i18n.pt(\'share_wizard.facebook.value_prop_1.title\')}}</div>\n' +
    '          <div class="pc-content-middle-valueProp-subtitle">{{i18n.pt(\'share_wizard.facebook.value_prop_1.subtitle\')}}</div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '      <div class="pc-content-middle-valueProp">\n' +
    '        <div class="pc-content-middle-valueProp-icon">\n' +
    '        </div>\n' +
    '        <div class="pc-content-middle-valueProp-content">\n' +
    '          <div class="pc-content-middle-valueProp-title">{{i18n.pt(\'share_wizard.facebook.value_prop_2.title\')}}</div>\n' +
    '          <div class="pc-content-middle-valueProp-subtitle">{{i18n.pt(\'share_wizard.facebook.value_prop_2.subtitle\')}}</div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '      <div class="pc-content-middle-valueProp">\n' +
    '        <div class="pc-content-middle-valueProp-icon">\n' +
    '        </div>\n' +
    '        <div class="pc-content-middle-valueProp-content">\n' +
    '          <div class="pc-content-middle-valueProp-title">{{i18n.pt(\'share_wizard.facebook.value_prop_3.title\')}}</div>\n' +
    '          <div class="pc-content-middle-valueProp-subtitle">{{i18n.pt(\'share_wizard.facebook.value_prop_3.subtitle\')}}</div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '    <div class="pc-shareWizard-content-bottom">\n' +
    '      <div class="i-cta-1 i-shareWizard-btn i-shareWizard-btn-hollow" ng-click="goTo(\'twitter\')"\n' +
    '           event-on="click" event-name="share_wizard_skip" event-tags="{{eventTags()}}">\n' +
    '        {{i18n.pt(\'share_wizard.not_now\')}}\n' +
    '      </div>\n' +
    '      <div class="i-cta-1 i-cta-1-facebook i-shareWizard-btn i-shareWizard-btn-iconed" ng-click="shareFacebook()"\n' +
    '           event-on="click" event-name="click_fb_share" event-tags="{{eventTags()}}">\n' +
    '        {{::i18n.t(\'share_on_facebook\')}}\n' +
    '      </div>\n' +
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
  $templateCache.put('views/share-facebook.html',
    '<div class="pc-shareWizard-container">\n' +
    '  <div class="pc-shareWizard-content container">\n' +
    '    <div class="pc-shareWizard-content-top">\n' +
    '      <img class="pc-shareWizard-content-top-image visible-xs" ng-src="{{urls.fundraiser_image_url}}">\n' +
    '      <div class="pc-shareWizard-content-top-subtitle hidden-xs">{{i18n.pt(\'share_wizard.lets_work_on_your_first_donation\')}}</div>\n' +
    '      <div class="pc-shareWizard-content-top-title">{{i18n.pt(\'share_wizard.share_with_your_friends_on_facebook\')}}</div>\n' +
    '      <a href="" ng-click="shareFacebook()" class="i-cta-1 i-cta-1-facebook i-shareWizard-btn i-shareWizard-btn-iconed visible-xs"\n' +
    '          event-on="click" event-name="click_fb_share" event-tags="{{eventTags()}}" event-page-location="mobile_btn">\n' +
    '        {{::i18n.t(\'share_on_facebook\')}}\n' +
    '      </a>\n' +
    '      <div class="pc-shareWizard-skip hidden-xs" ng-click="goTo(\'facebook-2\')"\n' +
    '           event-on="click" event-name="share_wizard_skip" event-tags="{{eventTags()}}">\n' +
    '        {{i18n.pt(\'share_wizard.skip\')}}\n' +
    '      </div>\n' +
    '    </div>\n' +
    '    <div class="pc-shareWizard-content-middle i-musty-background hidden-xs">\n' +
    '      <div class="pc-shareWizard-content-middle-container">\n' +
    '        <div class="pc-shareWizard-content-middle-socialContainer" ng-click="shareFacebook()"\n' +
    '             event-on="click" event-name="click_fb_share" event-tags="{{eventTags()}}" event-page-location="mock_content">\n' +
    '          <div class="pc-socialContainer-textField">{{i18n.pt(\'share_wizard.say_something_about_this\')}}</div>\n' +
    '          <div class="pc-socialContainer-shareSummary">\n' +
    '            <img class="pc-socialContainer-shareSummary-image" ng-src="{{urls.fundraiser_image_url}}"/>\n' +
    '            <div class="pc-socialContainer-shareSummary-content">\n' +
    '              <div class="pc-shareSummary-content-title">{{fundraiser.title}}</div>\n' +
    '              <div class="pc-shareSummary-content-blurb">{{fundraiser.tagline}}</div>\n' +
    '              <div class="pc-shareSummary-content-link">\n' +
    '                <span class="i-icon i-glyph-icon-30-link"></span>\n' +
    '                <span>{{i18n.pt(\'share_wizard.url\')}}</span>\n' +
    '              </div>\n' +
    '            </div>\n' +
    '          </div>\n' +
    '        </div>\n' +
    '        <div class="pc-shareWizard-content-middle-autoFb" ng-if="subdomain === \'life\'">\n' +
    '          <div class="pc-shareWizard-autoFb-checkbox" ng-click="toggleAutoFbPost()">\n' +
    '            <div class="i-glyph-icon-30-check" ng-if="fbAutopost.postingActive"></div>\n' +
    '          </div>\n' +
    '          <div class="pc-shareWizard-autoFb-text">\n' +
    '            <span>{{i18n.pt(\'share_wizard.automatically_post_to_facebook\')}}</span>\n' +
    '            <span igg-popover placement="top">{{i18n.pt(\'share_wizard.auto_facebook_post_settings_change\')}}</span>\n' +
    '          </div>\n' +
    '        </div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '    <div class="pc-shareWizard-content-bottom">\n' +
    '      <div class="pc-shareWizard-content-bottom-left">\n' +
    '        <div class="pc-shareWizard-content-bottom-header">{{i18n.pt(\'share_wizard.did_you_know\')}}</div>\n' +
    '        <div>{{i18n.pt(\'share_wizard.facebook_stats\')}}</div>\n' +
    '      </div>\n' +
    '      <div class="pc-shareWizard-content-bottom-right hidden-xs">\n' +
    '        <div class="i-cta-1 i-cta-1-facebook i-shareWizard-btn i-shareWizard-btn-iconed" ng-click="shareFacebook()"\n' +
    '             event-on="click" event-name="click_fb_share" event-tags="{{eventTags()}}" event-page-location="bottom_btn">\n' +
    '          {{::i18n.t(\'share_on_facebook\')}}\n' +
    '        </div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div class="pc-shareWizard-nav visible-xs" ng-click="goTo(\'facebook-2\')">\n' +
    '    <div event-on="click" event-name="share_wizard_skip" event-tags="{{eventTags()}}">\n' +
    '      {{i18n.pt(\'share_wizard.skip\')}}\n' +
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
  $templateCache.put('views/share-twitter.html',
    '<div class="pc-shareWizard-container">\n' +
    '  <div class="pc-shareWizard-content container">\n' +
    '    <div class="pc-shareWizard-content-top">\n' +
    '      <img class="pc-shareWizard-content-top-image visible-xs" ng-src="{{urls.fundraiser_image_url}}">\n' +
    '      <div class="pc-shareWizard-content-top-subtitle hidden-xs" ng-if="facebookShared">{{i18n.pt(\'share_wizard.facebook_post_hard_at_work\')}}</div>\n' +
    '      <div class="pc-shareWizard-content-top-subtitle hidden-xs" ng-if="!facebookShared">{{i18n.pt(\'share_wizard.you_can_post_to_facebook_later\')}}</div>\n' +
    '      <div class="pc-shareWizard-content-top-title">{{i18n.pt(\'share_wizard.broaden_your_reach_on_twitter\')}}</div>\n' +
    '      <a ng-href="{{twitterShareUrl}}" class="i-cta-1 i-cta-1-twitter i-shareWizard-btn i-shareWizard-btn-iconed visible-xs"\n' +
    '          event-on="click" event-name="click_tw_share" event-tags="{{eventTags()}}" event-page-location="mobile_btn">\n' +
    '        {{::i18n.t(\'share_on_twitter\')}}\n' +
    '      </a>\n' +
    '      <div class="pc-shareWizard-skip hidden-xs" ng-click="goTo(\'email\')"\n' +
    '          event-on="click" event-name="share_wizard_skip" event-tags="{{eventTags()}}">\n' +
    '        {{i18n.pt(\'share_wizard.skip\')}}\n' +
    '      </div>\n' +
    '      <div class="pc-shareWizard-back hidden-xs" ng-click="goTo(\'facebook\')"\n' +
    '          event-on="click" event-name="share_wizard_back" event-tags="{{eventTags()}}">\n' +
    '        <span class="i-icon i-glyph-icon-30-leftarrow"></span>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '    <div class="pc-shareWizard-content-middle i-musty-background hidden-xs">\n' +
    '      <div class="pc-shareWizard-content-middle-container pc-shareWizard-content-middle-socialContainer pc-socialContainer-twitter">\n' +
    '        <a ng-href="{{twitterShareUrl}}" class="pc-socialContainer-shareSummary"\n' +
    '            event-on="click" event-name="click_tw_share" event-tags="{{eventTags()}}" event-page-location="mock_content">\n' +
    '          <img class="pc-socialContainer-shareSummary-image" ng-src="{{urls.fundraiser_image_url}}"/>\n' +
    '          <div class="pc-socialContainer-shareSummary-content">\n' +
    '            <div class="pc-shareSummary-content-blurb">{{i18n.pt("share_wizard.twitter_blurb", {fundraiser_url: urls.fundraiser_short_link, fundraiser_title: fundraiser.title})}}</div>\n' +
    '            <div class="pc-shareSummary-content-link">\n' +
    '              {{urls.fundraiser_short_link}}\n' +
    '            </div>\n' +
    '          </div>\n' +
    '        </a>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '    <div class="pc-shareWizard-content-bottom">\n' +
    '      <div class="pc-shareWizard-content-bottom-left">\n' +
    '        <div class="pc-shareWizard-content-bottom-header">{{i18n.pt(\'share_wizard.did_you_know\')}}</div>\n' +
    '        <div>{{i18n.pt(\'share_wizard.you_dont_need_a_lot_of_twitter\')}}</div>\n' +
    '      </div>\n' +
    '      <div class="pc-shareWizard-content-bottom-right hidden-xs">\n' +
    '        <a class="i-cta-1 i-cta-1-twitter i-shareWizard-btn i-shareWizard-btn-iconed" ng-href="{{twitterShareUrl}}"\n' +
    '            event-on="click" event-name="click_tw_share" event-tags="{{eventTags()}}" event-page-location="bottom_btn">\n' +
    '          {{::i18n.t(\'share_on_twitter\')}}\n' +
    '        </a>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div class="pc-shareWizard-nav visible-xs">\n' +
    '    <div class="i-icon i-glyph-icon-30-leftarrow" ng-click="goTo(\'facebook\')"\n' +
    '         event-on="click" event-name="share_wizard_back" event-tags="{{eventTags()}}"></div>\n' +
    '    <div ng-click="goTo(\'email\')"\n' +
    '         event-on="click" event-name="share_wizard_skip" event-tags="{{eventTags()}}">\n' +
    '      {{i18n.pt(\'share_wizard.skip\')}}\n' +
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
  $templateCache.put('views/share-wizard.html',
    '<div ui-view></div>\n' +
    '');
}]);
})();
