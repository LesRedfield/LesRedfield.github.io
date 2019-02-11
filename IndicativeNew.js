/*
 * Copyright Indicative (C) 2014
 *
 * Indicative JavaScript library includes code from Google's json-sans-eval project
 * to decode a JSON string into a JavaScript object.
 * The json-sans-eval library is Copyright (C) 2008 Google Inc. and is available
 * at https://code.google.com/p/json-sans-eval/
 */
(function(root, factory) {
  if (typeof define === "function" && define.amd) {
    // AMD
    define(factory);
  } else {
    // Browser globals, Window
    root.Indicative = factory();
  }
})(window, function() {
  "use strict";


  var DEBUG = false;
  // var ENDPOINT = window.indicativeAPIEndpoint;

  var ENDPOINT = "//api.indicative.com/service";
  //for testing only!

  var EVENT_ENDPOINT_SUFFIX = "/event";
  var ALIAS_ENDPOINT_SUFFIX = "/alias";
  var SESSIONS = false;
  var SESSIONS_THRESHOLD = 30;
  var FORMS = false;
  var LINKS = false;
  var ONE_PAGE_VIEW_EVENT = false;
  var COOKIE_NAME;
  var COOKIES_ACROSS_SUBDOMAINS = false;


  var INITIALIZE_PARAM_KEYS = {
    cookiesOnMainDomain: 'cookiesOnMainDomain',
    recordSessions: 'recordSessions',
    sessionsThreshold: 'sessionsThreshold',
    forms: 'forms',
    links: 'links',
    onePageViewEvent: 'onePageViewEvent'
  };

  var json = {
    /**
     * Converts the given data structure to a JSON string.
     * Argument: arr - The data structure that must be converted to JSON
     * Example: var json_string = encode(['e', {pluribus: 'unum'}]);
     *          var json = encode({"success":"Sweet","failure":false,"empty_array":[],"numbers":[1,2,3],"info":{"name":"Binny","site":"http:\/\/www.openjs.com\/"}});
     * http://www.openjs.com/scripts/data/json_encode.php
     */
    encode: function(arr) {
      var parts = [];
      var isList = (Object.prototype.toString.apply(arr) === '[object Array]');

      for (var key in arr) {
        var value = arr[key];
        if (typeof value === "object") { //Custom handling for arrays
          if (isList) {
            parts.push(this.encode(value));
          }/* :RECURSION: */
          else {
            parts.push('"' + key + '":' + this.encode(value));
          }
          /* :RECURSION: */
          //else parts[key] = encode(value); /* :RECURSION: */

        } else {
          var str = "";
          var escapedKey = key.replace(/[\\"']/g, "\\$&");
          if (!isList) {
            str = '"' + escapedKey + '":';
          }

          //Custom handling for multiple data types
          if (typeof value === "number") {
            str += value;
          } else if (value === false) {
            str += 'false';
          } else if (value === true) {
            str += 'true';
          } else {
            var escapedValue = value.replace(/[\\"']/g, "\\$&");
            str += '"' + escapedValue + '"';
          }
          // :TODO: are there any more datatype we should be in the lookout for? (Functions?)

          parts.push(str);
        }
      }
      var json = parts.join(",");

      if (isList) {
        return '[' + json + ']';
      }//Return numerical JSON
      return '{' + json + '}';//Return associative JSON
    },
    decode: (function() {
      var number =
        '(?:-?\\b(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?\\b)';
      var oneChar = '(?:[^\\0-\\x08\\x0a-\\x1f\"\\\\]' +
                    '|\\\\(?:[\"/\\\\bfnrt]|u[0-9A-Fa-f]{4}))';
      var string = '(?:\"' + oneChar + '*\")';

      // Will match a value in a well-formed JSON file.
      // If the input is not well-formed, may match strangely, but not in an unsafe
      // way.
      // Since this only matches value tokens, it does not match whitespace, colons,
      // or commas.
      var jsonToken = new RegExp(
        '(?:false|true|null|[\\{\\}\\[\\]]' +
        '|' + number +
        '|' + string +
        ')', 'g');

      // Matches escape sequences in a string literal
      var escapeSequence = new RegExp('\\\\(?:([^u])|u(.{4}))', 'g');

      // Decodes escape sequences in object literals
      var escapes = {
        '"': '"',
        '/': '/',
        '\\': '\\',
        'b': '\b',
        'f': '\f',
        'n': '\n',
        'r': '\r',
        't': '\t'
      };

      function unescapeOne(_, ch, hex) {
        return ch ? escapes[ch] : String.fromCharCode(parseInt(hex, 16));
      }

      // A non-falsy value that coerces to the empty string when used as a key.
      var EMPTY_STRING = '';
      var SLASH = '\\';

      // Constructor to use based on an open token.
      var firstTokenCtors = { '{': Object, '[': Array };

      return function(json) {
        // Split into tokens
        var tokens = json.match(jsonToken);
        // Construct the object to return
        var result;
        var token = tokens[0];
        if (token === '{') {
          result = {};
        } else if (token === '[') {
          result = [];
        } else {
          throw new Error(token);
        }

        // If undefined, the key in an object key/value record to use for the next
        // value parsed.
        var key;
        // Loop over remaining tokens maintaining a stack of uncompleted objects and
        // arrays.
        var stack = [result];
        for (var i = 1, n = tokens.length; i < n; ++i) {
          token = tokens[i];

          var cont;
          switch (token.charCodeAt(0)) {
            default:  // sign or digit
              cont = stack[0];
              cont[key || cont.length] = +(token);
              key = void 0;
              break;
            case 0x22:  // '"'
              token = token.substring(1, token.length - 1);
              if (token.indexOf(SLASH) !== -1) {
                token = token.replace(escapeSequence, unescapeOne);
              }
              cont = stack[0];
              if (!key) {
                if (cont instanceof Array) {
                  key = cont.length;
                } else {
                  key = token || EMPTY_STRING;  // Use as key for next value seen.
                  break;
                }
              }
              cont[key] = token;
              key = void 0;
              break;
            case 0x5b:  // '['
              cont = stack[0];
              stack.unshift(cont[key || cont.length] = []);
              key = void 0;
              break;
            case 0x5d:  // ']'
              stack.shift();
              break;
            case 0x66:  // 'f'
              cont = stack[0];
              cont[key || cont.length] = false;
              key = void 0;
              break;
            case 0x6e:  // 'n'
              cont = stack[0];
              cont[key || cont.length] = null;
              key = void 0;
              break;
            case 0x74:  // 't'
              cont = stack[0];
              cont[key || cont.length] = true;
              key = void 0;
              break;
            case 0x7b:  // '{'
              cont = stack[0];
              stack.unshift(cont[key || cont.length] = {});
              key = void 0;
              break;
            case 0x7d:  // '}'
              stack.shift();
              break;
          }
        }
        // Fail if we've got an uncompleted object.
        if (stack.length) { throw new Error(); }
        return result;
      };
    })()
  };

  var browserConsole = window.console;
  var console = {
    log: function() {
      if (DEBUG && browserConsole) {
        try {
          browserConsole.log.apply(browserConsole, arguments);
        } catch (e) { }
      }
    },
    debug: function() {
      if (DEBUG && browserConsole) {
        try {
          browserConsole.debug.apply(browserConsole, arguments);
        } catch (e) { }
      }
    },
    info: function() {
      if (DEBUG && browserConsole) {
        try {
          browserConsole.info.apply(browserConsole, arguments);
        } catch (e) { }
      }
    },
    error: function() {
      if (DEBUG && browserConsole) {
        try {
          browserConsole.error.apply(browserConsole, arguments);
        } catch (e) { }
      }
    }
  };

  /**
   *  UTILITY METHODS:
   *  @private
   */
  var util = {

    /**
     *   simple is string method
     *   @param {any} obj: see if object is type string
     */
    isString: function(obj) {
      return typeof obj == "string";
    },

    isNumber: function(obj) {
      return typeof obj == "number";
    },

    isBoolean: function(obj) {
      return typeof obj == "boolean";
    },

    isObject: function(obj) {
      return typeof obj !== null && typeof obj === "object";
    },

    objectSize: function(obj) {
      var size = 0;
      var key;
      for (key in obj) {
        if (obj.hasOwnProperty(key)) {
          size++;
        }
      }
      return size;
    },

    contains: function(innerString, outerString) {
      return outerString.indexOf(innerString) >= 0;
    },

    /**
     *   Clones an object
     *   @param {obj} obj: for cloning
     *   @return {obj} clone of object
     */
    clone: function(obj) {
      if (obj == null || typeof obj !== "object") {
        return obj;
      }
      var copy = obj.constructor();
      for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) {
          copy[attr] = obj[attr];
        }
      }
      return copy;
    },

    trimString: function(input) {
      if (typeof String.prototype.trim === 'function') {
        return input.trim();
      }
      return input.replace(/^\s+|\s+$/g, '');
    },

    buildGetQuery: function(obj) {
      var parts = [];
      for (var key in obj) {
        if (this.isString(key) && this.isString(obj[key])) {
          parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(obj[key]));
        }
      }
      return '?' + parts.join('&');
    },

    buildPropertyQueryParams: function(obj) {
      var parts = [];
      for (var key in obj) {
        if (this.isString(key) && this.isString(obj[key])) {
          parts.push("propertyNames=" + encodeURIComponent(key));
          parts.push("propertyValues=" + encodeURIComponent(obj[key]));
        }
      }
      return '&' + parts.join('&');
    },

    /*
     *   Extends an object
     */
    extend: function(target, options) {
      var name;

      if (options != null) {
        for (name in options) {
          target[name] = options[name];
        }
      }

      return target;
    },

    getCookie: function() {
      if (document.cookie) {
        var cookies = document.cookie.split(';');

        for (var i = 0; i < cookies.length; i++) {
          var cookie = util.trimString(cookies[i]);
          if (!!cookie && cookie.indexOf(COOKIE_NAME) === 0) {
            var obj = json.decode(decodeURIComponent(cookie.substring(COOKIE_NAME.length + 2, cookie.length - 1))) || {};
            return obj || {};
          }
        }
      }

      return {};
    },

    _setCookie: function(cookieStr) {
      document.cookie = cookieStr;
    },

    setCookie: function(value) {
      if (!COOKIE_NAME) { return; }

      var expiration = new Date();
      expiration.setDate(expiration.getDate() + 365);
      //set date to utc string
      expiration = expiration.toUTCString();

      var cookieStrArr =
        [COOKIE_NAME,
         '="',
         encodeURIComponent(json.encode(value)),
         '";',
         ' path=/;',
         ' expires=',
         expiration];

      if (COOKIES_ACROSS_SUBDOMAINS) {
        var domainURL = this.getDomainName();

        //cookies don't accept anything with less than 2 '.'
        // so we're making sure that this is an acceptable cookie
        // ref: http://stackoverflow.com/a/1188145
        if (domainURL.indexOf('.') > -1) {
          cookieStrArr.push('; domain=');
          cookieStrArr.push(['.', this.getDomainName()].join(''));
        }
      }

      var cookieStr = cookieStrArr.join('');

      console.log('setting cookie to be : ', cookieStr);

      this._setCookie(cookieStr);
    },

    //borrowed from: http://jsfiddle.net/briguy37/2MVFd/
    generateUUID: function() {
      var d = new Date().getTime();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16);
      });
    },

    _getFullHostName: function() {
      return window.location.host;
    },
    /**
     * This method looks up the host (i.e. `app.indicative.com` or `indicative.com` or `blah.blah2.indicative.com`)
     * and returns the domain (i.e. `indicative.com` from all above's examples)
     *
     * Thanks stackoverflow for thinking for me!
     * http://stackoverflow.com/a/19937750
     *
     * Tests -- when exposing an option to set hostName
     * getDomainName('http://localhost:63342/Indicative/example/index.html');
     * "localhost"
     * getDomainName('www.indicative.com');
     * "indicative.com"
     * getDomainName('app.indicative.com');
     * "indicative.com"
     * getDomainName('app.indicative:123.com');
     * "indicative.com"
     *
     * @returns {string}
     */
    getDomainName: function() {
      var hostName = this._getFullHostName();
      var domain = hostName.substring(hostName.lastIndexOf(".", hostName.lastIndexOf(".") - 1) + 1);

      //check for port
      var domainArr = domain.split(':');
      if (domainArr.length > 1) {
        var start = domainArr[0];
        var end = '';

        var portArr = domainArr[1].split('.');
        if (portArr.length > 1) {
          end = ['.', portArr[1]].join('');
        }
        domain = [start, end].join('');
      }

      return domain;
    }
  };


  /**
   *   propertyManager helps add bulkProperties or a single property to a given property map
   *   @private
   */

  function IndicativePropertyManager(useCookie) {
    this.clearProperties();

    if (useCookie === undefined) {
      useCookie = true;
    }

    this._useCookie = useCookie;

    if (useCookie) {
      var cookie = util.getCookie();
      if (cookie && cookie.props) {
        this.properties = cookie.props;
        console.info('Loaded in properties from cookie!', this.properties);
      }
    }
  }

  IndicativePropertyManager.prototype._setPropertiesCookie = function() {
    if (this._useCookie) {
      var cookie = util.getCookie();
      cookie.props = this.properties;
      util.setCookie(cookie);
      console.info('saved cookie!', cookie);
    }
  };

  IndicativePropertyManager.prototype.getProperties = function() {
    return this.properties;
  };

  IndicativePropertyManager.prototype.addProperties = function(obj) {
    console.info('IndicativePropertyManager.addProperties()', this.properties);
    console.info("adding props", obj);
    //allowing [{name, val}, {name, val}]
    // or [[name, val], [name, val]]
    var key;

    if (obj instanceof Array) {
      //add each pair as a property
      for (var i = 0; i < obj.length; i++) {
        var inObj = obj[i];
        //adding if pair is an array: [name, val]
        if (inObj instanceof Array && inObj.length === 2) {
          this.addProperty(inObj[0], inObj[1], false);

          //adding if pair is an object: {name: val}
        } else if (inObj instanceof Object) {
          for (key in inObj) {
            this.addProperty(key, inObj[key], false);
          }
        }
      }
    }

    //allows {name: val, name: val}
    if (obj instanceof Object) {
      //adds each attribute as a property
      for (key in obj) {
        this.addProperty(key, obj[key], false);
      }
    }

    this._setPropertiesCookie();
  };

  IndicativePropertyManager.prototype.addProperty = function(name, val, addCookie) {
    addCookie = addCookie === undefined || false;

    if (!name || val === undefined) { return; }

    var isValString = util.isString(val);
    var validVal = isValString || util.isNumber(val) || util.isBoolean(val);

    console.info("adding property in manager");
    if (util.isString(name)) {
      if (validVal) {
        console.info("we can set the property here");
        //remove literal line breaks

        if (isValString) {
          //replace all /r linebreaks with a space
          val = val.replace(/(\r)/g, ' ');
          //replace all /n linebreaks with a space
          val = val.replace(/(\n)/g, ' ');

        }

        this.properties[name] = val;
        console.info(this.properties);
      } else if (util.isObject(val)) {
        for (var key in val) {
          var newName = name + "_" + key;
          this.addProperty(newName, val[key], addCookie);
        }
      }
    }

    if (addCookie) {
      console.info("Adding cookie");
      this._setPropertiesCookie();
    }
  };

  IndicativePropertyManager.prototype.incrementProperty = function(name, amountToIncrement) {
    if (!util.isString(name)) {
      console.warn("Cannot increment value for non string property key");
      return;
    }

    amountToIncrement = util.isNumber(amountToIncrement) ? amountToIncrement : 1;

    var existingValue = this.properties[name];
    if (util.isString(existingValue)) {
      try {
        var parsedInt = parseInt(existingValue);
        if (!isNaN(parsedInt)) {
          existingValue = parsedInt;
        }
      } catch (e) { }
    }

    if (util.isNumber(existingValue)) {
      var newValue = existingValue + amountToIncrement;
      this.addProperty(name, newValue);
    } else {
      this.addProperty(name, amountToIncrement);
    }
  };

  IndicativePropertyManager.prototype.removeProperty = function(name) {
    delete this.properties[name];
    this._setPropertiesCookie();
  };

  IndicativePropertyManager.prototype.clearProperties = function() {
    this.properties = {};
    this._setPropertiesCookie();
  };

  /**
   *   Indicative's object for creating your project's events
   *   Should not be implemented outside this file.
   *   @constructor
   */
  function Indicative() {
    this.initalized = false;
    this._util = util;
  }

  Indicative.prototype._resetUniqueIDToDefault = function(cookie, resetAutomaticID) {
    cookie = cookie || util.getCookie();
    if (!cookie.defaultUniqueID || resetAutomaticID) {
      console.info('Generating random uniqueness ID');
      this._createDefaultUniqueID(cookie);
    }

    this.uniqueID = cookie.defaultUniqueID;
  };

  Indicative.prototype._setUniqueIDCookie = function() {
    var cookie = util.getCookie();
    if (this.uniqueID) {
      cookie.uniqueID = this.uniqueID;
    } else {
      delete cookie.uniqueID;
    }
    util.setCookie(cookie);
  };

  Indicative.prototype._createDefaultUniqueID = function(cookie) {
    cookie = cookie || util.getCookie();
    cookie.defaultUniqueID = util.generateUUID();
    util.setCookie(cookie);
  };

  Indicative.prototype._handleInitParams = function(params) {
    if (params) {
      COOKIES_ACROSS_SUBDOMAINS = !!params[INITIALIZE_PARAM_KEYS.cookiesOnMainDomain];
      SESSIONS = !!params[INITIALIZE_PARAM_KEYS.recordSessions];

      var sessionsThresholdParam = params[INITIALIZE_PARAM_KEYS.sessionsThreshold];
      if (sessionsThresholdParam && util.isNumber(sessionsThresholdParam) && sessionsThresholdParam >= 1) {
        SESSIONS_THRESHOLD = sessionsThresholdParam;
      }

      FORMS = !!params[INITIALIZE_PARAM_KEYS.forms];;
      LINKS = !!params[INITIALIZE_PARAM_KEYS.links];;
      ONE_PAGE_VIEW_EVENT = !!params[INITIALIZE_PARAM_KEYS.onePageViewEvent];;
    }
  };

  /**
   * Only set once just after injecting our .js client.
   * @param {string} key: your api key
   */
  Indicative.prototype.initialize = function(apiKey, params) {

    if (this.initalized) { return; }

    this.initalized = true;
    COOKIE_NAME = 'Indicative_' + apiKey;

    this._handleInitParams(params);

    /** @const @private **/
    this.apiKey = apiKey;
    this.properties = new IndicativePropertyManager();

    var cookie = util.getCookie();
    if (cookie && cookie.uniqueID) {
      this.uniqueID = cookie.uniqueID;
      console.info('Loaded in uniqueID from cookie!', this.uniqueID);
    } else if (cookie) {
      this._resetUniqueIDToDefault(cookie);
    }

    console.info('What is uniqueID? ', this.uniqueID);

    if (FORMS) {
      this._trackForms();
    }
    if (LINKS) {
      this._trackLinks();
    }
  };

  /**
   * Set a project-wide uniqueID
   * to keep from setting on each event build
   * @param {string} id: uniqueID to be used for ALL events, unless otherwise overwritten via buildEvent
   * @param {boolean} sendAliasing: will send an aliasing call to link the old uniqueID with the new uniqueID (can only be done once)
   * @param {function} callbackFN: if set, this will allow a callback to be called after aliasing is set.
   */
  Indicative.prototype.setUniqueID = function(id, sendAliasing, callbackFN) {
    if (id) {
      this.uniqueID = id;
      this._setUniqueIDCookie();
      if (sendAliasing) {
        this.sendAlias(callbackFN);
      }
    } else {
      this.clearUniqueID();
    }
  };

  Indicative.prototype.clearUniqueID = function(resetAutomaticID) {
    delete this.uniqueID;
    this._setUniqueIDCookie();
    this._resetUniqueIDToDefault(null, resetAutomaticID);
  };

  /**
   *  Returns the default UUID generated if a unique ID was never set.
   *  Returns null if one doesn't exist
   */
  Indicative.prototype.getDefaultUniqueID = function() {
    var cookie = util.getCookie();
    return cookie.defaultUniqueID;
  };

  Indicative.prototype.getProperties = function() {
    if (!this.properties) {
      return;
    }

    return this.properties.getProperties();
  };

  /**
   *  Add a single property to the project-wide property map
   *   @param {string} name: the name of this property
   *   @param {string} val: the value of this property
   */
  Indicative.prototype.addProperty = function(name, val) {
    this.properties.addProperty(name, val);
  };

  /**
   *  Increment a the value of a property. If the property specified is not a number, set it to 1.
   *   @param {string} name: the name of the property to increment
   *   @param {number} value: the amount to increment by
   */
  Indicative.prototype.incrementProperty = function(name, value) {
    this.properties.incrementProperty(name, value || 1);
  };


  /**
   *   Add a bulk property map to the project-wide properties
   *   @param {object | array} obj: list of properties or map of properties to be added
   */
  Indicative.prototype.addProperties = function(obj) {
    this.properties.addProperties(obj);
  };

  /**
   *   Remove a property from the project-wide properties list
   *   @param {string} name: the name of the property to remove
   */
  Indicative.prototype.removeProperty = function(name) {
    this.properties.removeProperty(name);
  };

  /**
   *   Remove all property from the project-wide properties list
   */
  Indicative.prototype.clearProperties = function() {
    this.properties.clearProperties();
  };

  /**
   * Sends an alias connection to Indicative between a
   * set unique ID the default ID (UUID) generated by the client
   * @param callbackFN: a function to be invoked after the alias call has successfully finished
   */
  Indicative.prototype.sendAlias = function(callbackFN) {
    var cookie = util.getCookie();
    if (cookie) {
      var defaultUniqueID = cookie.defaultUniqueID;
      var uniqueID = cookie.uniqueID;

      if (!!defaultUniqueID && !!uniqueID) {
        var aliasObj = {
          apiKey: this.apiKey,
          previousId: defaultUniqueID,
          newId: uniqueID
        };
        this._sendAlias(aliasObj, callbackFN);
      }
    }
  };

  /**
   * Builds an event to be sent to Indicative's input server
   * Asynchronously sends event via AJAX call to Indicative's input server
   *
   * @param {string} eventName
   * @param {string | object | array} extraArgs: string to change uniqueID or obj or array for additional properties
   * @param {object | array} secondaryArgs: obj or array for additional properties
   * @param {bool} returnEvent: if true, returns the created event object instead of sending it. Used primarily for testing purposes
   * @param {bool} ignoreStaticProps: if true, does not add static properties to event. Used for testing purposes ONLY
   * @param {bool} ignoreSessionUpdate: if true, this will ignore the check to update the last session time (useful for an internal call and for calls that are automatic)
   * @return {bool} false: if unable to send event
   * @return (if returnEvent = true) returns the object that would have been sent to the server, and doesn't go through with AJAX call
   */
  Indicative.prototype.buildEvent = function(eventName, extraArgs, secondaryArgs, trinaryArgs, returnEvent, ignoreStaticProps, ignoreSessionUpdate) {
    console.info("Building event ", eventName, extraArgs, secondaryArgs, trinaryArgs);

    if (!this.apiKey) {
      console.info("missing something");
      console.error("Cannot send an event without an api key");
      return false;
    }

    if (!eventName) {
      console.info("missing something name ");
      console.error("Cannot send an event without an event name");
      return false;
    }

    if (!this.uniqueID) {
      console.info("missing uniqueID");
      console.error("Cannot send an event without a uniqueID");
      return false;
    }

    var uniqueID = this.uniqueID;
    var properties = util.clone(this.properties.getProperties());
    var eventProperties;
    var callback;

    function _eventPropsOrCallback(obj) {
      console.info("_eventPropsOrCallback this ", obj);
      if (!obj) { return; }
      if (typeof obj === 'function') {
        console.info("It's a callback!");
        callback = obj;
      } else if (typeof obj === 'object') {
        console.info("It's eventProperties!");
        eventProperties = obj;
      }
    }

    if (extraArgs) {
      if (util.isString(extraArgs)) {
        uniqueID = extraArgs;
        _eventPropsOrCallback(secondaryArgs);
        _eventPropsOrCallback(trinaryArgs);
      } else {
        _eventPropsOrCallback(extraArgs);
        _eventPropsOrCallback(secondaryArgs);
      }
    }

    if (eventProperties) {
      var eventPropManager = new IndicativePropertyManager(false);
      eventPropManager.addProperties(eventProperties);
      util.extend(properties, eventPropManager.getProperties());
    }

    if (!ignoreStaticProps) {
      util.extend(properties, this._buildStaticProps());
    }

    var sender = {
      apiKey: this.apiKey,
      eventName: eventName
    };

    if (uniqueID) {
      sender.eventUniqueId = uniqueID;
    }

    if (properties) {
      sender.properties = properties;
    }

    if (returnEvent) {
      console.info("returning event");
      return sender;
    }

    this._sendEvent(sender, callback, ignoreSessionUpdate);
  };

  Indicative.prototype.pageView = function() {
    var eventName = "Page View";
    var title = window.document.title;
    if (!ONE_PAGE_VIEW_EVENT && title) {
      eventName = eventName + " | " + title;
    }

    this.buildEvent(eventName);
  };

  Indicative.prototype.linkClick = function(event, linkName) {
    var url = event.target.getAttribute('href');
    var linkName = linkName || event.target.innerText || url;
    event.preventDefault();

    window.Indicative.buildEvent("Link Click", { Link_Name: linkName }, function () {
       if (url) {
         window.location = url;
       }
    });
  };

  Indicative.prototype.formSubmit = function(event) {
    var formProps = window.Indicative._buildFormProps(this);
    event.preventDefault();

    window.Indicative.buildEvent("Form Submit", formProps);
  };

  Indicative.prototype._trackLinks = function() {
    var links = document.getElementsByTagName("a");

    for (var idx = 0; idx < links.length; idx++) {
      links[idx].addEventListener("click", this.linkClick);
    }
  };

  Indicative.prototype._trackForms = function() {
    var forms = document.getElementsByTagName("form");

    for (var idx = 0; idx < forms.length; idx++) {
      forms[idx].addEventListener("submit", this.formSubmit);
    }
  };

  Indicative.prototype._buildFormProps = function(form) {
    var formProps = {
      form: {
        inputs: {}
      }
    };

    var formAttribs = ["id", "name"];

    formAttribs.forEach(function(attrib) {
      if (form[attrib]) {
        formProps.form[attrib] = form[attrib];
      }
    });

    var inputTags = ["input", "textarea", "select"];
    var inputs = [];

    inputTags.forEach(function(tag) {
      var inputList = form.getElementsByTagName(tag);
      Array.from(inputList).forEach(function(inputEl) {
        if (inputEl.type !== "submit") {
          inputs.push(inputEl);
        }
      });
    });

    var inputAttribs = ["name", "id", "value"];

    inputs.forEach(function(input, idx) {
      var inputObj = {};
      var inputKey = idx;

      if (input.type === "checkbox" || input.type === "radio") {
        if (input.value) {
          inputKey = input.value;
        } else if (input.id) {
          inputKey = input.id;
        }
        inputObj.checked = input.checked;
      } else if (input.name) {
        inputKey = input.name;
      } else if (input.id) {
        inputKey = input.id;
      }

      if (formProps.form.inputs[inputKey]) {
        //don't overwrite existing inputs
        inputKey = inputKey + "-" + idx;
      }

      if (input.type && input.nodeName.toUpperCase() === "INPUT") {
        inputObj.type = input.type;
      }

      inputAttribs.forEach(function(attrib) {
        if (input[attrib]) {
          inputObj[attrib] = input[attrib];
        }
      });

      formProps.form.inputs[inputKey] = inputObj;
    });

    return formProps;
  };

  Indicative.prototype._updateSession = function() {
    if (SESSIONS && SESSIONS_THRESHOLD >= 1) {
      var now = new Date().getTime();
      var cookie = util.getCookie();
      var lastSessionTime = cookie.lastSessionTime;

      if (!lastSessionTime || (lastSessionTime + SESSIONS_THRESHOLD * 60000) <= now) {
        this.buildEvent("Web Session (Automatic)", undefined, undefined, undefined, undefined, false, true);
      }

      cookie.lastSessionTime = now;
      util.setCookie(cookie);
    }
  };

  Indicative.prototype.buildAutomaticEvent = function(eventName) {
    var sender = this.buildEvent(eventName, undefined, undefined, undefined, true);
    sender.automatic = true;
    this._sendEvent(sender);
  };

  Indicative.prototype._sendEvent = function(sender, callback, ignoreSessionUpdate) {
    if (!ignoreSessionUpdate) { this._updateSession(); }
    this._postObjToEndpoint(sender, EVENT_ENDPOINT_SUFFIX, callback);
  };

  Indicative.prototype._sendAlias = function(sender, callback) {
    this._postObjToEndpoint(sender, ALIAS_ENDPOINT_SUFFIX, callback);
  };

  Indicative.prototype._postObjToEndpoint = function(postObj, endpointSuffix, callback) {
    console.info("Recording event ", postObj);
    console.info("Endpoint suffix ", endpointSuffix);
    var endpoint = ENDPOINT + endpointSuffix;
    var usingXMLHttp = false;

    if (window.XMLHttpRequest) {
      var xmlHttp = new XMLHttpRequest();

      if (xmlHttp.withCredentials !== undefined) {
        usingXMLHttp = true;

        xmlHttp.onreadystatechange = function() {
          if (xmlHttp.readyState == 4) {
            if (xmlHttp.status === 200) {
              console.info("Successful stat post!");
              console.info("What is callback? ", callback);
              if (callback) {
                callback();
              }
            } else {
              var error = "Error HTTP status: " + xmlHttp.status + " " + xmlHttp.statusText;
              console.error(error);
              if (xmlHttp.status === 422) {
                console.error("posting unprocessable object");
                return false;
              }
              if (callback) {
                callback();
              }
            }
          }
        };

        xmlHttp.open("POST", endpoint, true);

        xmlHttp.setRequestHeader('Content-Type', 'application/json');
        xmlHttp.setRequestHeader('Indicative-Client', 'javascript');

        try {
          xmlHttp.send(json.encode(postObj));
        } catch (e) {
          console.info("exception", e);
        }
      }
    }

    //if using an xml http request is impossible
    // insert a script tag to do the dirty work
    if (!usingXMLHttp) {
      //if (true){
      /* http://stackoverflow.com/questions/6285736/internet-explorer-forces-a-304-when-ajaxing-a-login-status-check */
      var getUrl;
      if (postObj.properties) {
        getUrl = [endpoint, util.buildGetQuery(postObj), util.buildPropertyQueryParams(postObj.properties), '&breakcache=' + Math.random()].join('');
      } else {
        getUrl = [endpoint, util.buildGetQuery(postObj), '&breakcache=' + Math.random()].join('');
      }
      console.info("what is url?");
      console.info(getUrl);

      setTimeout(function() {
        var ind = document.createElement('script');
        ind.setAttribute('src', getUrl);
        ind.setAttribute('type', 'application/json');
        ind.setAttribute('async', 'true');
        ind.setAttribute('defer', 'true');
        var callbackCalled = false;
        ind.onload = ind.onreadystatechange = function() {
          console.info('loaded!!!!');
          var rs = this.readyState;
          if (rs && rs != 'complete' && rs != 'loaded') {
            return;
          }
          if (!callbackCalled && callback) {
            callbackCalled = true;
            callback();
          }
        };

        var s = document.getElementsByTagName('script')[0];
        s.parentNode.insertBefore(ind, s);
      }, 100);
    }
  };

  var userAgentParse = {
    browser: function(user_agent) {
      if (window.opera) {
        if (util.contains("Opera Mini", user_agent)) {
          return "OperaMini";
        } else if (util.contains("Opera Mobi")) {
          return "OperaMobile";
        }
        return "Opera";
      } else if (util.contains("BlackBerry", user_agent)) {
        return "BlackBerry";
      } else if (util.contains("Blazer", user_agent)) {
        return "Blazer";
      } else if (util.contains("IEMobile", user_agent)) {
        return "IEMobile";
      } else if (util.contains("MSIE", user_agent)) {
        return "IE";
      } else if (util.contains("GoBrowser", user_agent)) {
        return "GoBrowser";
      } else if (util.contains("Chrome", user_agent)) {
        return "Chrome";
      } else if (util.contains("Apple", user_agent)) {
        if (util.contains("Mobile", user_agent)) {
          return "SafariMobile";
        }
        return "Safari";
      } else if (util.contains("Firefox", user_agent)) {
        return "Firefox";
      } else if (util.contains("Android", user_agent)) {
        return "Android";
      } else if (util.contains("Gecko", user_agent)) {
        return "Mozilla";
      }

      return null;
    },


    os: function(userAgent) {
      if (util.contains("Android", userAgent)) {
        return "Android";
      } else if (util.contains("iPhone", userAgent) || util.contains("iPad", userAgent) || util.contains("iPod", userAgent)) {
        return "iOS";
      } else if (util.contains("BlackBerry", userAgent)) {
        return "BlackBerry";
      } else if (util.contains("Mac", userAgent)) {
        return "MacOS";
      } else if (util.contains("Linux", userAgent)) {
        return "Linux";
      } else if (util.contains("Windows", userAgent)) {
        return "Windows";
      }

      return null;
    },

    device: function(userAgent) {
      if (util.contains("Android", userAgent) ||
          util.contains("webOS", userAgent) ||
          util.contains("iPhone", userAgent) ||
          util.contains("iPad", userAgent) ||
          util.contains("iPod", userAgent) ||
          util.contains("BlackBerry", userAgent) ||
          util.contains("Windows Phone", userAgent)) {
        return "Mobile";
      }

      return "Web";
    }
  };

  Indicative.prototype._mapSearchParams = function(locationSearch) {
    var queryMap = {};

    locationSearch = decodeURIComponent(locationSearch);

    var queryString = locationSearch.substring(1);
    var queryArr = queryString.split('&');

    for (var qp = 0; qp < queryArr.length; qp++) {
      var queryPair = queryArr[qp].split("=");

      var key = queryPair[0];
      var value = queryPair[1];

      //check to see if key is already in map
      //if key is already in map, need to list out parameters in string form
      if (queryMap[key]) {
        queryMap[key] = queryMap[key] + ',' + value;
      } else {
        queryMap[key] = value;
      }
    }

    return queryMap;
  };

  Indicative.prototype._utm_parse = function(searchParams) {
    return {
      source: searchParams.utm_source,
      medium: searchParams.utm_medium,
      term: searchParams.utm_term,
      content: searchParams.utm_content,
      campaign: searchParams.utm_campaign
    };
  };


  //full referrer
  //http://indocative.com/finddogs.html?hello=thisisdog
  //protocol : http://
  //domain: indogative
  //path : finddogs.html
  //query: hello=thisisdog

  Indicative.prototype._parse_referral = function(ref) {
    var refMap = {};

    var colonParse = ref.split('://');
    if (colonParse[0]) {
      refMap.protocol = colonParse[0];
    }

    if (colonParse[1]) {
      //this should now be of th form indogative.com/finddogs.html?hello=dogs
      var urlParse = colonParse[1].split('/');

      if (urlParse[0]) {
        refMap.domain = urlParse[0];
      }

      if (urlParse[1]) {
        //remove the domain and merge the rest of the string
        urlParse.shift();

        //now parse out path and query string
        var pathParse = urlParse.join('/').split('?');

        if (pathParse[0]) {
          refMap.path = pathParse[0];
        }

        if (pathParse[1]) {
          refMap.query = pathParse[1];
        }

      }
    }
    return refMap;
  };

  Indicative.prototype._buildStaticProps = function() {
    var staticProps = {};

    var userAgent = window.navigator.userAgent;
    var doc = window.document;

    //parsing user agent:
    var currentBrowser = userAgentParse.browser(userAgent);
    if (currentBrowser) {
      staticProps.browser = currentBrowser;
    }

    var currentOS = userAgentParse.os(userAgent);
    if (currentOS) {
      staticProps.browser_os = currentOS;
    }

    var currentDevice = userAgentParse.device(userAgent);
    if (currentDevice) {
      staticProps.browser_device = currentDevice;
    }

    var ref = doc.referrer;
    if (ref) {
      staticProps.browser_referrer = ref;

      //build browser referral properties
      var refProps = Indicative.prototype._parse_referral(ref);

      if (refProps.protocol) {
        staticProps.browser_referrer_protocol = refProps.protocol;
      }

      if (refProps.domain) {
        staticProps.browser_referrer_domain = refProps.domain;
      }

      if (refProps.path) {
        staticProps.browser_referrer_path = refProps.path;
      }

      if (refProps.query) {
        staticProps.browser_referrer_query = refProps.query;
      }

    }

    var language = window.navigator.userLanguage || window.navigator.language;
    if (language) {
      staticProps.browser_language = language;
    }

    var title = doc.title;
    if (title) {
      staticProps.page_title = title;
    }

    staticProps.page_url = location.href;

    if (staticProps.page_url.length > 255) { //we can't store more than that
      staticProps.page_url = staticProps.page_url.substring(0, 255);
    }


    //do utm stuff:
    var queryString = Indicative.prototype._mapSearchParams(doc.location.search);
    var utmMap = Indicative.prototype._utm_parse(queryString);

    if (utmMap.source) {
      staticProps.campaign_source = utmMap.source;
      staticProps['$indicative_utm_source'] = utmMap.source; //for special marketing properties
    }

    if (utmMap.medium) {
      staticProps.campaign_medium = utmMap.medium;
      staticProps['$indicative_utm_medium'] = utmMap.medium;
    }

    if (utmMap.term) {
      staticProps.campaign_term = utmMap.term;
      staticProps['$indicative_utm_term'] = utmMap.term;
    }

    if (utmMap.content) {
      staticProps.campaign_content = utmMap.content;
      staticProps['$indicative_utm_content'] = utmMap.content;
    }

    if (utmMap.campaign) {
      staticProps.campaign_name = utmMap.campaign;
      staticProps['$indicative_utm_campaign'] = utmMap.campaign;
    }

    return staticProps;

  };

  /**
   *  FOR TESTING ONLY
   *  @return {string} apiKey set
   */
  Indicative.prototype.getAPIKey = function() {
    return this.apiKey;
  };

  /**
   *  FOR TESTING ONLY
   *  @return {string} uniqueID set for entire project
   */
  Indicative.prototype.getUniqueID = function() {
    return this.uniqueID;
  };

  return new Indicative();
});
