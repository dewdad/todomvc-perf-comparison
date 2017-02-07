/*!
 * link.js v0.4.0
 * (c) 2016.10-2017 leonwgc
 * Released under the MIT License.
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.link = factory());
}(this, (function () { 'use strict';

function isObject(obj) {
  return !!obj && typeof obj === 'object';
}

function isFunction(func) {
  return (typeof func === 'function');
}

var isArray = Array.isArray;

function isPrimitive(o) {
  return ['string', 'number', 'boolean', 'null', 'undefined'].indexOf(typeof o) > -1;
}

function isString(str) {
  return typeof str === 'string';
}

function isBoolean(v) {
  return typeof v === 'boolean';
}

function isLikeJson(str) {
  return isString(str) && str[0] === '{' && str.slice(-1) === '}';
}

function addClass(el, className) {
  if (el.className.indexOf(className) === -1) {
    el.className = trim(el.className) + ' ' + className;
  }
}

function removeClass(el, className) {
  if (el.className.indexOf(className) > -1) {
    el.className = el.className.replace(new RegExp(className, 'g'), '');
  }
}

function formatString() {
  if (arguments.length < 2) { return arguments[0]; }
  var str = arguments[0],
    args = Array.prototype.slice.call(arguments, 1);

  return str.replace(/\{(\d+)\}/g, function (match, n) {
    return args[n];
  });
}

function trim(str) {
  if (typeof str === 'string') {
    return str.trim();
  }
  return str;
}

function each(arr, fn) {
  var len = arr.length, i = -1;
  while (++i < len) {
    fn(arr[i], i, arr);
  }
}

function extend(target, src) {
  each(Object.keys(src), function (prop) {
    target[prop] = src[prop];
  });
  return target;
}

function addEventListenerHandler(el, event, func, store) {
  if (el.addEventListener) {
    el.addEventListener(event, func, false);
    store.push({
      el: el,
      event: event,
      handler: func
    });
  }
}

function removeEventListenerHandler(el, event, func) {
  if (el.removeEventListener) {
    el.removeEventListener(event, func, false);
  }
}

function loadTemplate(templateStore, url, cb) {
  var tpl = templateStore[url];
  if (tpl) {
    cb(tpl);
  }
  else {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          templateStore[url] = trim(xhr.responseText);
          cb(xhr.responseText);
        }
      }
    };
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'text/html');
    xhr.send(null);
  }
}

function copy(src) {
  if (isObject(src)) {
    var dst = {}, val;
    each(Object.keys(src), function (prop) {
      val = src[prop];
      if (isArray(val)) {
        dst[prop] = [];
        each(val, function (item) {
          dst[prop].push(copy(item));
        });
      } else if (isObject(val)) {
        dst[prop] = copy(val);
      } else {
        dst[prop] = val;
      }
    });
    return dst;
  } else {
    return src;
  }
}

function hash(path) {
  if (typeof path === 'undefined') {
    var href = location.href,
      index = href.indexOf('#');
    return index === -1 ? '' : href.slice(index + 1);
  }
  else {
    location.hash = path;
  }
}

function replaceHash(path) {
  var href = location.href,
    index = href.indexOf('#');
  if (index > -1) {
    location.replace(href.slice(0, index) + '#' + path);
  }
  else {
    location.replace(href + '#' + path);
  }
}

function configRoutes(linker, routes, defaultPath) {
  addEventListenerHandler(window, 'hashchange', renderRouter, linker._eventStore);
  renderRouter();
  function renderRouter() {
    var route = routes[hash()];
    if (!route) {
      replaceHash(defaultPath);
      return;
    }
    if (!route.model || !isObject(route.model)) {
      route.model = {};
    }
    var template = trim(route.template);
    if (!template) {
      if (route.templateUrl) {
        loadTemplate(linker._routeTplStore, route.templateUrl, function (tpl) {
          linkRoute(linker, route, tpl);
        });
      } else {
        linkRoute(linker, route, '');
      }
    } else {
      linkRoute(linker, route, template);
    }
  }
}
function linkRoute(linker, route, tpl) {
  var preLinkReturn;
  if (linker._routeEl) {
    linker._routeEl.innerHTML = tpl;
  }
  if (route.lastLinker) {
    route.lastLinker.unlink(); // destroy link
  }
  if (isFunction(route.preLink)) {
    preLinkReturn = route.preLink.call(route, linker);
  }
  if (preLinkReturn && isFunction(preLinkReturn.then)) {
    preLinkReturn.then(traceLink);
  } else {
    if (preLinkReturn === false) { return; }// skip link
    traceLink();
  }

  function traceLink() {
    if (!linker._routeEl) { return; } // no x-view , no route link 
    route.lastLinker = link({
      el: linker._routeEl,
      model: route.model,
      methods: route.methods
    });
    if (isFunction(route.postLink)) {
      route.postLink.call(route, route.lastLinker);
    }
  }
}

var watchRegex = /^\$?\w+(\.?\w+)*$/;
var fnRegex = /^[a-zA-Z$_]\w*$/;
var fnCallRegex = /^[a-zA-Z$_]\w*\(\s*\)$/;
var fnCallParamsRegex = /^[a-zA-Z$_]\w*\(([^\)]+)\)$/;
var quoteRegx = /[\'\"]/g;
var watchStartRegex = /[a-zA-Z$_]/;
var validWatchChar = /[a-zA-Z0-9$\.]/;


var unshift = Array.prototype.unshift;
var glob = {
  registeredTagsCount: 0,
  registeredTags: Object.create(null)
};
var testInterpolationRegex = /\{\{[^\}]+\}\}/;
var interpilationExprRegex = /\{\{([^\}]+)\}\}/g;
var spaceRegex = /\s+/;
var eventPrefix = '@';

function linkError() {
  var error = formatString.apply(null, arguments);
  return new Error(error);
}

function moneyFilter(str) {
  if (!Number(str)) { return str; }
  str = str + '';
  var digit = [],
    decimals = '',
    pointIndex = -1,
    groups = [],
    sep = ',';
  if ((pointIndex = str.indexOf('.')) > -1) {
    digit = str.slice(0, pointIndex).split('');
    decimals = str.slice(pointIndex);
  }
  else {
    digit = str.split('');
  }
  do {
    groups.unshift(digit.splice(-3).join(''));
  } while (digit.length > 0);

  return groups.join(sep) + decimals;
}

function phoneFilter(str) {
  // the middle 4 digit replace with *
  if (isString(str) && str.length === 11) {
    return str.slice(0, 3) + '****' + str.slice(-4);
  }

  return str;
}

var filters = {
  uppercase: function (str) {
    if (isString(str)) {
      return str.toUpperCase();
    }
    return str;
  },
  lowercase: function (str) {
    if (isString(str)) {
      return str.toLowerCase();
    }
    return str;
  },
  money: moneyFilter,
  phone: phoneFilter
};

function $eval(expr, $this) {
  return (new Function('$this', 'with($this){return ' + expr + ';}'))($this);
}

function evalBindExpr(linkContext, filter, interpilationText) {
  var val,
    linkExpr = linkContext.expr,
    model = linkContext.linker.model;
  if (!interpilationText) {
    if (!filter) {
      val = $eval(linkExpr, model);
    } else {
      val = execFilterExpr(linkExpr, model);
    }
  } else {
    if (!filter) {
      val = $eval(linkExpr, model);
    } else {
      val = interpilationText.replace(interpilationExprRegex, function (m, e) {
        return execFilterExpr(e, model);
      });
    }
  }
  return val;
}

function execFilterExpr(expr, model) {
  var ar = expr.split('|');
  if (ar.length === 1) {
    return $eval(expr, model);
  }
  var filterFn = filters[trim(ar[1])];
  return filterFn($eval(trim(ar[0]), model));
}

function evalLinkContext(linkContext) {
  return $eval(linkContext.expr, linkContext.linker.model);
}

function setWatchValue(watch, value, model) {
  if (value === null) {
    value = 'null';
  }
  else if (typeof (value) === 'undefined') {
    value = 'undefined';
  }
  var expr = '';
  if (isString(value)) {
    expr = [watch, '=', "'", value, "'"].join('');
  }
  else if (isPrimitive(value)) {
    expr = [watch, '=', value].join('');
  }
  else {
    throw linkError('value should be a primitive type for setWatchValue');
  }

  $eval(expr, model);
}

function registerComponent(config) {
  var tag = config.tag;
  if (!tag) {
    throw linkError('tag is required for a component!');
  }
  tag = tag.toUpperCase();
  if (!glob.registeredTags[tag]) {
    glob.registeredTags[tag] = config;
    ++glob.registeredTagsCount;
  }
}

function renderComponent(linker, com) {
  var config = com.config,
    template = trim(config.template),
    el = com.el;
  if (!template) {
    if (config.templateUrl) {
      loadTemplate(linker._comTplStore, config.templateUrl, function (tpl) {
        linkCom(linker, el, config, tpl);
      });
    }
  } else {
    linkCom(linker, el, config, template);
  }
}

function parentNotifyFnBuilder(prop, pprop, comModel, parentModel) {
  return function () {
    setWatchValue(prop, $eval(pprop, parentModel), comModel);
  };
}

function linkCom(linker, el, config, tpl) {
  var comModel = copy(config.model);
  var comMethods = config.methods || {};

  if (isArray(config.props)) {
    var av;
    each(config.props, function (prop) {
      av = trim(el.getAttribute(prop));
      if (isFunction(linker.model[av])) {
        comMethods[prop] = linker.model[av];
      }
      else {
        linker.watch(av, parentNotifyFnBuilder(prop, av, comModel, linker.model));
        var pValue = $eval(av, linker.model);
        if (pValue !== comModel[prop]) {
          comModel[prop] = pValue;
        }
      }
    });
  }

  el.innerHTML = tpl;
  if (el.children.length > 1) { throw linkError('component can only have one root element'); }
  var comLinker = link({ el: el.children[0], model: comModel, methods: comMethods });

  if (isFunction(config.postLink)) {
    config.postLink.call(comLinker.model, el, comLinker, config);
  }
}

var LinkContext = function LinkContext(el, watch, directive, expr, linker) {
  this.el = el;
  this.prop = watch;
  this.directive = directive;
  this.expr = expr;
  this.linker = linker;
};
LinkContext.create = function create (el, watch, directive, expr, linker) {
  if (!linker._watchMap[watch]) {
    linker._watchMap[watch] = [];
  }
  return new LinkContext(el, watch, directive, expr, linker);
};
var EventLinkContext = function EventLinkContext(el, event, fn, args) {
  this.el = el;
  this.event = event;
  this.fn = fn; // fn name
  this.args = args; // arguments pass by event directive
};
EventLinkContext.create = function create (el, event, fn, args) {
  return new EventLinkContext(el, event, fn, args);
};

var Lexer = function Lexer(text) {
  this.text = text;
  this.index = 0;
  this.len = text.length;
  this.watches = null;
  this.filters = null;
};

Lexer.prototype.run = function run () {
    var this$1 = this;

  while (this.index < this.len) {
    var ch = this$1.text[this$1.index];
    if (watchStartRegex.test(ch)) {
      if (!this$1.watches) {
        this$1.watches = [];
      }
      this$1._getWatch(ch);
    }
    else if (ch === '"' || ch === "'") {
      while (this._peek() !== ch && this.index < this.len) {
        this$1.index++;
      }
      if (this$1.index + 1 < this$1.len) {
        this$1.index += 2;
      } else {
        throw new Error('unclosed string in expr');
      }
    }
    else if (ch === '|') {
      if (this$1._peek() !== '|') {
        if (!this$1.filters) {
          this$1.filters = [];
        }
        this$1.index++;
        if (this$1.watches.length < this$1.filters.length) { throw new Error('bad expr'); }
        this$1._getFilter();
      }
      else {
        // || 
        this$1.index += 2;
      }
    }
    else {
      this$1.index++;
    }
  }
};

Lexer.prototype._getFilter = function _getFilter () {
    var this$1 = this;

  var filter = [this.text[this.index]];
  while (this.index < this.len) {
    if (validWatchChar.test(this$1._peek())) {
      filter.push(this$1.text[++this$1.index]);
    }
    else {
      this$1.index++;
      break;
    }
  }
  this.filters.push(trim(filter.join('')));
};

Lexer.prototype._getWatch = function _getWatch (ch) {
    var this$1 = this;

  var watch = [ch];
  while (this.index < this.len) {
    if (validWatchChar.test(this$1._peek())) {
      watch.push(this$1.text[++this$1.index]);
    } else {
      this$1.index++;
      break;
    }
  }
  this.watches.push(watch.join(''));
};

Lexer.prototype._peek = function _peek (i) {
  i = i || 1;
  return (this.index + i < this.len) ? this.text[this.index + 1] : false;
};

function commonReact(linkContext, event) {
  var el = linkContext.el;
  function commonHandler() {
    setWatchValue(linkContext.prop, el.value || '', linkContext.linker.model);
  }
  addEventListenerHandler(el, event, commonHandler, linkContext.linker._eventStore);
}

function checkboxReact(linkContext) {
  var el = linkContext.el;
  function checkboxHandler() {
    var value = el.value,
      checked = el.checked,
      propValue = evalLinkContext(linkContext),
      valIndex;

    if (!(isBoolean(propValue) || isArray(propValue))) {
      throw linkError('checkbox should bind with array or a boolean value');
    }

    if (isArray(propValue)) {
      valIndex = propValue.indexOf(value);
      if (!checked && valIndex > -1) {
        propValue.splice(valIndex, 1);
      }
      else {
        propValue.push(value);
      }
    }
    else {
      setWatchValue(linkContext.prop, checked, linkContext.linker.model);
    }
  }
  addEventListenerHandler(el, 'click', checkboxHandler, linkContext.linker._eventStore);
}

function modelReactDispatch(linkContext) {
  var el = linkContext.el,
    nodeName = el.nodeName,
    type = el.type;
  switch (nodeName) {
    case 'INPUT': {
      switch (type) {
        case 'text':
        case 'email':
        case 'password':
        case 'url': {
          commonReact(linkContext, 'keyup');
          break;
        }
        case 'radio': {
          commonReact(linkContext, 'click');
          break;
        }
        case 'checkbox': {
          checkboxReact(linkContext);
          break;
        }
      }
      break;
    }
    case 'SELECT': {
      commonReact(linkContext, 'change');
      break;
    }
    default: {
      commonReact(linkContext, 'keyup');
      break;
    }
  }
}

function bindHandler(linkContext, filter, interpilationText) {
  linkContext.el.textContent = evalBindExpr(linkContext, filter, interpilationText);
}

function classHandler(linkContext) {
  var exprVal = evalLinkContext(linkContext);

  if (linkContext.className) {
    // json 
    if (exprVal) {
      addClass(linkContext.el, linkContext.className);
    }
    else {
      removeClass(linkContext.el, linkContext.className);
    }
  } else {
    if (exprVal) {
      addClass(linkContext.el, exprVal);
    }
  }
}

function disabledHandler(linkContext) {
  if (evalLinkContext(linkContext)) {
    linkContext.el.setAttribute("disabled", "disabled");
  }
  else {
    linkContext.el.removeAttribute("disabled");
  }
}

function modelHandler(linkContext) {
  var el = linkContext.el,
    exprVal = evalLinkContext(linkContext);
  if (el.type === 'radio') {
    el.checked = (el.value === exprVal);
  }
  else if (el.type === 'checkbox') {
    if (isArray(exprVal)) {
      el.checked = exprVal.indexOf(el.value) > -1;
    } else if (isBoolean(exprVal)) {
      el.checked = exprVal;
    } else {
      throw linkError('checkbox should bind with array or a boolean value');
    }
  }
  else {
    el.value != exprVal && (el.value = exprVal);
  }
}

function readonlyHandler(linkContext) {
  if (evalLinkContext(linkContext)) {
    linkContext.el.setAttribute("readonly", "readonly");
  }
  else {
    linkContext.el.removeAttribute("readonly");
  }
}

function makeRepeatLinker(linkContext, itemData, itemIndex, refVar) {
  var cloneEl = linkContext.el.cloneNode(true),
    model = linkContext.linker.model,
    linker,
    props = Object.create(null);
  props.$index = { value: itemIndex, enumerable: true, configurable: true, writable: true };
  props[refVar] = { value: itemData, enumerable: true, configurable: true, writable: true };
  linker = new Link(cloneEl, Object.create(model, props));
  linker._context = linkContext;
  linkContext.linker._children.push(linker);
  return { el: cloneEl, linker: linker };
}

function repeatHandler(linkContext, arrayOpInfo) {
  var arr = $eval(linkContext.prop, linkContext.linker.model),
    el = linkContext.el,
    comment = linkContext.comment,
    repeaterItem,
    lastLinks = linkContext.lastLinks,
    refVar = linkContext.expr.split(spaceRegex)[0];

  if (!lastLinks) {
    lastLinks = linkContext.lastLinks = [];
    comment = linkContext.comment = document.createComment('repeat end for ' + linkContext.prop);
    el.parentNode.insertBefore(linkContext.comment, el);
    el.parentNode.removeChild(el);
  }

  function rebuild() {
    var docFragment = document.createDocumentFragment();
    each(lastLinks, function (link) {
      link.unlink();
    });

    lastLinks.length = 0;
    each(arr, function (itemData, index) {
      repeaterItem = makeRepeatLinker(linkContext, itemData, index, refVar);
      lastLinks.push(repeaterItem.linker);
      docFragment.appendChild(repeaterItem.el);
    });

    comment.parentNode.insertBefore(docFragment, comment);
  }

  if (arrayOpInfo) {
    var fn = arrayOpInfo.op,
      itemData,
      index,
      _linker;
    switch (fn) {
      case 'mutate': break;
      case 'push': {
        index = arr.length - 1;
        itemData = arr[index];
        repeaterItem = makeRepeatLinker(linkContext, itemData, index, refVar);
        lastLinks.push(repeaterItem.linker);
        comment.parentNode.insertBefore(repeaterItem.el, comment);
        break;
      }
      case 'pop': {
        _linker = lastLinks.pop();
        _linker.unlink();
        break;
      }
      case 'splice': {
        _linker = Array.prototype.splice.apply(lastLinks, arrayOpInfo.args);
        each(_linker, function (_lk) {
          _lk.unlink();
        });
        // refresh $index 
        each(lastLinks, function (linker, index) {
          linker.model.$index = index;
        });
        break;
      }
      case 'unshift': {
        var firstLinkerEl = lastLinks[0].el;
        itemData = arr[0];
        repeaterItem = makeRepeatLinker(linkContext, itemData, 0, refVar);
        lastLinks.unshift(repeaterItem.linker);
        firstLinkerEl.parentNode.insertBefore(repeaterItem.el, firstLinkerEl);
        break;
      }
      case 'shift': {
        _linker = lastLinks.shift();
        _linker.unlink();
        break;
      }
      default: rebuild();
    }
  } else {
    rebuild();
  }
}

function showHideHandler(linkContext) {
  var el = linkContext.el,
    directive = linkContext.directive,
    boolValue = !!evalLinkContext(linkContext);
  if (directive === 'x-show' && boolValue || directive === 'x-hide' && !boolValue) {
    removeClass(el, 'x-hide');
  }
  else {
    addClass(el, 'x-hide');
  }
}

var drm = {
  'x-show': showHideHandler,
  'x-hide': showHideHandler,
  'x-bind': bindHandler,
  'x-disabled': disabledHandler,
  'x-repeat': repeatHandler,
  'x-class': classHandler,
  'x-model': modelHandler,
  'x-readonly': readonlyHandler
};

function addWatchNotify(linkContext) {
  linkContext.linker._watchMap[linkContext.prop].push(watchNotifyFactory(linkContext));
}

function addWatchNotifyForBind(linkContext, filter, isInterpilationExpr) {
  linkContext.linker._watchMap[linkContext.prop].push(watchNotifyFactoryForBind(linkContext, filter, isInterpilationExpr));
}

function watchNotifyFactory(linkContext) {
  return function watchChangeHanlder(arrayOpInfo) {
    drm[linkContext.directive](linkContext, arrayOpInfo);
  };
}

function watchNotifyFactoryForBind(linkContext, filter, isInterpilationExpr) {
  return function () {
    drm[linkContext.directive](linkContext, filter, isInterpilationExpr);
  };
}

function addWatchHanlder(linker, watch, handler) {
  var watchFns = linker._watchMap[watch];
  if (!watch || !isFunction(handler)) { return; }
  if (!watchFns) {
    watchFns = linker._watchMap[watch] = [];
  }
  watchFns.push(handler);
}

function eventHanlderFactory(linker, context) {
  return function eventHanlder(ev) {
    var el = context.el,
      fn = context.fn,
      args = context.args; // when fn is null, args is expr to eval.

    if (fn === null) {
      // expr 
      $eval(args, linker.model);
    } else if (linker.model[fn]) {
      if (!isArray(args)) {
        linker.model[fn].apply(linker.model, [ev, el]);
      }
      else {
        var eargs = [ev, el];
        var evaledArgs = [];
        each(args, function (arg) {
          arg = trim(arg);
          if (arg.charAt(0) === "'" || arg.charAt(0) === '"') {
            evaledArgs.push(arg.replace(quoteRegx, ''));
          } else {
            evaledArgs.push($eval(arg, linker.model));
          }
        });
        unshift.apply(eargs, evaledArgs);
        linker.model[fn].apply(linker.model, eargs);
      }
    }
  };
}

function getLinkContextsFromInterpolation(linker, el, text) {
  var expr = ['"', text, '"'].join('').replace(/(\{\{)/g, '"+(').replace(/(\}\})/g, ')+"');
  var lexer = new Lexer(expr);
  lexer.run();
  if (lexer.watches) {
    each(lexer.watches, function (watch) {
      var linkContext = LinkContext.create(el, watch, 'x-bind', expr, linker);
      linker._linkContextCollection.push(linkContext);
      addWatchNotifyForBind(linkContext, lexer.filters, text);
    });
  }
}

function createLinkContextAndWatch(linker, el, watch, directive, expr) {
  var linkContext = LinkContext.create(el, watch, directive, expr, linker);
  pushLinkContextAndWatch(linker, linkContext);
}

function pushLinkContextAndWatch(linker, linkContext) {
  linker._linkContextCollection.push(linkContext);
  addWatchNotify(linkContext);
  if (linkContext.directive === 'x-model') {
    modelReactDispatch(linkContext);
  }
}

function getEventLinkContext(linker, el, event, fn) {
  var eventLinkContext, leftBracketIndex, args;
  // fn could be fnc, fnc(), fnc(args..) and null(with expr)
  if (fnRegex.test(fn)) {
    // fn
    eventLinkContext = EventLinkContext.create(el, event, fn);
  }
  else if (fnCallRegex.test(fn)) {
    // fn()
    leftBracketIndex = fn.indexOf('(');
    eventLinkContext = EventLinkContext.create(el, event, fn.slice(0, leftBracketIndex));
  }
  else if (fnCallParamsRegex.test(fn)) {
    // fn(a,b,c)
    args = fn.match(fnCallParamsRegex)[1].split(',');
    leftBracketIndex = fn.indexOf('(');
    eventLinkContext = EventLinkContext.create(el, event, fn.slice(0, leftBracketIndex), args);
  }
  else {
    // expr
    eventLinkContext = EventLinkContext.create(el, event, null, fn);
  }
  addEventListenerHandler(el, event, eventHanlderFactory(linker, eventLinkContext), linker._eventStore);
}

function getClassLinkContext(linker, el, directive, expr) {
  var
    kvPairs = expr.slice(1, -1).split(','),
    className,
    subExpr,
    spliter,
    lexer,
    linkContext;

  each(kvPairs, function (kv) {
    spliter = kv.split(':');
    className = spliter[0].replace(quoteRegx, '').trim();
    subExpr = spliter[1].trim();

    if (watchRegex.test(subExpr)) {
      linkContext = LinkContext.create(el, subExpr, directive, subExpr, linker);
      linkContext.className = className;
      pushLinkContextAndWatch(linker, linkContext);
    }
    else {
      lexer = new Lexer(subExpr);
      lexer.run();
      if (lexer.watches) {
        each(lexer.watches, function (w) {
          linkContext = LinkContext.create(el, w, directive, subExpr, linker);
          linkContext.className = className;
          pushLinkContextAndWatch(linker, linkContext);
        });
      }
    }
  });
}

function getLinkContext(linker, el, directive, expr) {
  var linkContext;
  if (watchRegex.test(expr)) {
    createLinkContextAndWatch(linker, el, expr, directive, expr);
  }
  else if (isLikeJson(expr)) {
    getClassLinkContext(linker, el, directive, expr);
  }
  else {
    var lexer = new Lexer(expr);
    lexer.run();
    if (lexer.watches) {
      each(lexer.watches, function (watch) {
        linkContext = LinkContext.create(el, watch, directive, expr, linker);
        linker._linkContextCollection.push(linkContext);
        addWatchNotifyForBind(linkContext, lexer.filters);
      });
    }
  }
}

function compile(linker, el) {
  var tag,
    expr,
    w,
    hasAttributes,
    attrName,
    attrValue,
    nodeType = el.nodeType;

  if (nodeType === 1) {
    hasAttributes = el.hasAttributes();

    if (hasAttributes) {
      if (el.hasAttribute('x-repeat')) {
        expr = trim(el.getAttribute('x-repeat')); // var in watch
        w = expr.split(spaceRegex);
        if (w.length !== 3) { throw linkError('repeat only support expr like: var in array.'); }
        createLinkContextAndWatch(linker, el, w[2], 'x-repeat', expr);
        el.removeAttribute('x-repeat');
        linker._children = [];
        return;
      }

      if (el.hasAttribute('x-view')) {
        if (linker._routeEl) { throw linkError('a link context can only have on more than one x-view'); }
        el.removeAttribute('x-view');
        linker._routeEl = el;
        return;
      }

      each(el.attributes, function (attr) {
        attrName = attr.name;
        attrValue = trim(attr.value);
        if (attrName[0] === 'x' && attrName[1] === '-') {
          getLinkContext(linker, el, attrName, attrValue);
        } else if (attrName[0] === eventPrefix) {
          getEventLinkContext(linker, el, attrName.slice(1), attrValue);
        }
      });
    }

    if (glob.registeredTagsCount > 0) {
      tag = el.tagName.toUpperCase();
      if (glob.registeredTags[tag]) {
        linker._comCollection.push({
          el: el,
          config: glob.registeredTags[tag]
        });
        return;
      }
    }

    each(el.childNodes, function (node) {
      compile(linker, node);
    });

  } else if (nodeType === 3) {
    expr = trim(el.textContent);
    if (expr && testInterpolationRegex.test(expr)) {
      getLinkContextsFromInterpolation(linker, el, expr);
    }
  } else if (nodeType === 9) {
    each(el.childNodes, function (node) {
      compile(linker, node);
    });
  }
}

function interceptArray(arr, watch, linker) {
  each(['push', 'pop', 'unshift', 'shift', 'reverse', 'sort', 'splice'], function (fn) {
    arr[fn] = function () {
      var result = Array.prototype[fn].apply(arr, arguments);
      linker._notify(watch, { op: fn, args: arguments });
      linker._notify(watch + '.length');
      return result;
    };
  });
}

var Link = function Link(el, data, behaviors, routeConfig) {
  this.el = el;
  this.model = data;
  this._behaviors = behaviors;
  this._eventStore = [];
  this._linkContextCollection = [];
  this._watchMap = Object.create(null);
  this._routeEl = null;
  this._comCollection = [];
  this._unlinked = false;
  this._children = null; // store repeat linker 
  this._context = null; // linkContext for repeat child linker
  this._bootstrap();

  if (routeConfig) {
    this._routeTplStore = Object.create(null);
    configRoutes(this, routeConfig.routes, routeConfig.defaultPath);
  }
  if (glob.registeredTagsCount > 0 && this._comCollection.length > 0) {
    this._comTplStore = Object.create(null);
    this._renderComponent();
  }
};

Link.prototype._bootstrap = function _bootstrap () {
  var $this = this;
  this._compileDOM();
  this._walk(this.model, []);
  each(Object.keys(this._watchMap), function (watch) {
    $this._notify(watch);
  });
  this._addBehaviors();
};

Link.prototype._walk = function _walk (model, propStack) {
  var value,
    valIsArray,
    watch,
    $this = this;
  each(Object.keys(model), function (prop) {
    value = model[prop];
    valIsArray = isArray(value);
    if (isObject(value) && !valIsArray) {
      propStack.push(prop);
      $this._walk(value, propStack);
      propStack.pop();
    }
    else {
      watch = propStack.concat(prop).join('.');
      $this._defineObserver(model, prop, value, watch, valIsArray);
    }
  });
};

Link.prototype._defineObserver = function _defineObserver (model, prop, value, watch, valIsArray) {
  var $this = this;
  if (valIsArray) {
    interceptArray(value, watch, $this);
  }
  Object.defineProperty(model, prop, {
    get: function () {
      return value;
    },
    set: function (newVal) {
      if (newVal !== value) {
        value = newVal;
        if ($this._unlinked) { return; }
        if (valIsArray) {
          interceptArray(value, watch, $this);
          $this._notify(watch + '.length');
        }
        $this._notify(watch);
        if ($this._context) {
          $this._context.linker._notify($this._context.prop, { op: 'mutate' });
        }
        if ($this._children) {
          each($this._children, function (linker) {
            if (!linker._unlinked) {
              linker._notify(watch);
            }
          });
        }
      }
    }
  });
};

Link.prototype._addBehaviors = function _addBehaviors () {
  var linker = this;
  if (isObject(this._behaviors)) {
    var methods = Object.keys(this._behaviors);
    each(methods, function (fn) {
      if (isFunction(linker._behaviors[fn])) {
        if ((fn in linker.model) && !isFunction(linker.model[fn])) {
          throw linkError('{0} is defined in the data model,please change the function/method name of "{0}"', fn);
        }
        if (!linker.model[fn]) {
          linker.model[fn] = linker._behaviors[fn];
        }
      }
    });
  }
};
Link.prototype._renderComponent = function _renderComponent () {
  var linker = this;
  each(this._comCollection, function (com) {
    renderComponent(linker, com);
  });
};

Link.prototype.watch = function watch (watch, handler) {
  addWatchHanlder(this, watch, handler);
};

Link.prototype._notify = function _notify (watch, arrayOpInfo) {
  var updates = this._watchMap[watch];
  if (updates) {
    each(updates, function (update) {
      update(arrayOpInfo);
    });
  }
};

Link.prototype._compileDOM = function _compileDOM () {
  compile(this, this.el);
};

Link.prototype.unlink = function unlink () {
    var this$1 = this;

  this._behaviors = null;
  this._linkContextCollection.length = 0;
  this._watchMap = null;
  this._routeEl = null;
  this._comCollection.length = 0;
  this._routeTplStore = null;
  this._comTplStore = null;

  each(this._eventStore, function (event) {
    removeEventListenerHandler(event.el, event.event, event.handler);
  });
  this._eventStore.length = 0;

  if (this._children) {
    each(this._children, function (linker) {
      if (!linker._unlinked) {
        linker.unlink();
      }
    });
    this._children.length = 0;
  }

  if (this._context) {
    var children = this._context.linker._children,
      len = children.length;
    while (len--) {
      if (children[len] === this$1) {
        children.splice(len, 1);
        break;
      }
    }
    this._context = null;
    this.el.parentNode.removeChild(this.el);
    this.el = null;
  }

  this.model = null;
  this._unlinked = true;
};

function link(config) {
  config = extend({ el: window.document, model: {}, methods: null, routes: null }, config);
  return new Link(config.el, config.model, config.methods, config.routes);
}

link.helper = {
  addClass: addClass,
  removeClass: removeClass,
  formatString: formatString,
  trim: trim,
  each: each,
  hash: hash
};

link.filter = function (name, fn) {
  if (!filters[name] && isFunction(fn)) {
    filters[name] = fn;
  }
};

link.com = registerComponent;

var style = document.createElement('style');
style.type = 'text/css';
style.textContent = '.x-hide{display:none !important;}';
document.head.insertAdjacentElement('afterBegin', style);

return link;

})));
