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

function debounce(fn) {
  var timer = 0;
  return function debounceFn() {
    if (timer) { clearTimeout(timer); }
    timer = setTimeout(fn, 0);
  }
}



function bind(fn, ctx) {
  return function () {
    return fn.apply(ctx, arguments);
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

var fnCallRegex = /^[a-zA-Z$_]\w*\(\s*\)$/;
var fnCallParamsRegex = /^[a-zA-Z$_]\w*\(([^\)]+)\)$/;
var quoteRegx = /[\'\"]/g;
var watchStartRegex = /[a-zA-Z$_]/;
var validWatchChar = /[a-zA-Z0-9$\.]/;



var glob = {
  registeredTagsCount: 0,
  registeredTags: Object.create(null)
};
var testInterpolationRegex = /\{\{[^\}]+\}\}/;
var interpilationExprRegex = /\{\{([^\}]+)\}\}/g;
var spaceRegex = /\s+/;
var eventPrefix = '@';
var interceptArrayMethods = ['push', 'pop', 'unshift', 'shift', 'reverse', 'sort', 'splice'];

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

function setWatchValue(watch, value, model, linker) {
  if (linker) {
    var setter = linker._watchSetterCache[watch];
    if (!setter) {
      setter = linker._watchSetterCache[watch] = new Function('m', 'v', ("with(m){" + watch + "=v;}"));
    }
    setter(model, value);
  } else {
    (new Function('m', 'v', ("with(m){" + watch + "=v;}")))(model, value);
  }
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
        linker.watch(av, parentNotifyFnBuilder(prop, av, comModel, linker.model), true);
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

function bindHandler(linkContext, filter, interpilationText) {
  linkContext.el.textContent = evalBindExpr(linkContext, filter, interpilationText);
}

function classHandler(linkContext) {
  var exprVal = linkContext.exprVal;

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
  if (linkContext.exprVal) {
    linkContext.el.setAttribute("disabled", "disabled");
  }
  else {
    linkContext.el.removeAttribute("disabled");
  }
}

function modelHandler(linkContext) {
  var el = linkContext.el,
    exprVal = linkContext.exprVal;
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
  if (linkContext.exprVal) {
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
  var arr = linkContext.exprVal,
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
    linkContext.linker._children.length = 0;
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
    boolValue = !!linkContext.exprVal;
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

var LinkContext = function LinkContext(el, watch, directive, expr, linker) {
  this.el = el;
  this.prop = watch;
  this.directive = directive;
  this.expr = expr;
  this.linker = linker;
  this.filters = null;
  this.text = null;
  this._evalExprFn = new Function('m', ("with(m){return " + (directive !== 'x-repeat' ? expr : watch) + ";}"));
};

var prototypeAccessors = { watch: {},exprVal: {} };
LinkContext.create = function create (el, watch, directive, expr, linker) {
  var context, watchMap = linker._watchMap;
  if (!watchMap[watch]) {
    watchMap[watch] = [];
  }
  context = new LinkContext(el, watch, directive, expr, linker);
  watchMap[watch].push(context);
  return context;
};

prototypeAccessors.watch.set = function (v) {
  var model = this.linker.model,
    watch = this.prop;
  if (this.prop.indexOf('.') === -1) {
    model[watch] = v;
  } else {
    if (!this._setWatchFn) {
      this._setWatchFn = new Function('m', 'v', ("with(m){" + watch + "=v;}"));
    }
    this._setWatchFn(model, v);
  }
};

prototypeAccessors.exprVal.get = function () {
  return this._evalExprFn(this.linker.model);
};

LinkContext.prototype.update = function update (arrayOpInfo) {
  if (this.directive !== 'x-bind') {
    drm[this.directive](this, arrayOpInfo);
  } else {
    drm[this.directive](this, this.filters, this.text);
  }
};

Object.defineProperties( LinkContext.prototype, prototypeAccessors );
var EventLinkContext = function EventLinkContext(el, event, expr) {
  this.el = el;
  this.event = event;
  var right;
  if ((right = expr.indexOf(')')) > -1) {
    if (fnCallParamsRegex.test(expr)) {
      expr = expr.slice(0, right) + ',$event' + expr.slice(right);
    } else if (fnCallRegex.test(expr)) {
      expr = expr.slice(0, right) + '$event' + expr.slice(right);
    }
  }
  this.expr = expr;
};
EventLinkContext.create = function create (el, event, expr) {
  return new EventLinkContext(el, event, expr);
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
    linkContext.watch = el.value || '';
  }
  addEventListenerHandler(el, event, commonHandler, linkContext.linker._eventStore);
}

function checkboxReact(linkContext) {
  var el = linkContext.el;
  function checkboxHandler() {
    var value = el.value,
      checked = el.checked,
      propValue = linkContext.exprVal,
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
      linkContext.watch = checked;
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

function getLinkContextsFromInterpolation(linker, el, text) {
  var expr = ['"', text, '"'].join('').replace(/(\{\{)/g, '"+(').replace(/(\}\})/g, ')+"');
  var lexer = new Lexer(expr);
  lexer.run();
  if (lexer.watches) {
    each(lexer.watches, function (watch) {
      var linkContext = LinkContext.create(el, watch, 'x-bind', expr, linker);
      linkContext.text = text;
      linkContext.filters = lexer.filters;
    });
  }
}

function createLinkContextAndWatch(linker, el, watch, directive, expr) {
  var linkContext = LinkContext.create(el, watch, directive, expr, linker);
  if (directive === 'x-model') {
    modelReactDispatch(linkContext);
  }
}

function getEventLinkContext(linker, el, event, expr) {
  var eventLinkContext = EventLinkContext.create(el, event, expr);
  addEventListenerHandler(el, event, bind(new Function('$event', ("with(this){" + (eventLinkContext.expr) + "}")), linker.model), linker._eventStore);
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
    }
    else {
      lexer = new Lexer(subExpr);
      lexer.run();
      if (lexer.watches) {
        each(lexer.watches, function (w) {
          linkContext = LinkContext.create(el, w, directive, subExpr, linker);
          linkContext.className = className;
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
        linkContext.filters = lexer.filters;
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
        attrValue = attr.value.trim();
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
   each(interceptArrayMethods, function (fn) {
      arr[fn] = function () {
        var result = Array.prototype[fn].apply(arr, arguments);
        linker._notify(watch, { op: fn, args: arguments });
        linker._notify(watch + '.length');
        return result;
      };
    });
}

var WatchRunner = function WatchRunner(linker) {
  this.linker = linker;
  this.queue = [];
  this.waiting = false;
};
WatchRunner.prototype.push = function push (watch) {
  var $this = this;
  if (this.queue.indexOf(watch) === -1) {
    this.queue.push(watch);
    if (!this.waiting) {
      this.waiting = true;
      setTimeout(function () {
        $this.flush();
      }, 0);
    }
  }
};
WatchRunner.prototype.flush = function flush () {
  var linker = this.linker;
  each(this.queue, function (watch) {
    linker._notify(watch);
  });
  this.reset();
};
WatchRunner.prototype.reset = function reset () {
  this.waiting = false;
  this.queue.length = 0;
};

var push$1 = Array.prototype.push;

var Link = function Link(el, data, behaviors, routeConfig) {
  this.el = el;
  this.model = data;
  this._behaviors = behaviors;
  this._eventStore = [];
  this._watchFnMap = Object.create(null);
  this._watchMap = Object.create(null);
  this._routeEl = null;
  this._comCollection = [];
  this._unlinked = false;
  this._children = null; // store repeat linker 
  this._context = null; // linkContext for repeat child linker
  this._watchSetterCache = Object.create(null);
  this._runner = new WatchRunner(this);
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
  var $this = this, runner = this._runner;
  if (valIsArray) {
    interceptArray(value, watch, $this);
  }
  Object.defineProperty(model, prop, {
    get: function () {
      return value;
    },
    set: function (newVal) {
      if (newVal !== value) {
        if (!valIsArray) {
          value = newVal;
          $this._notify(watch);
        } else {
          value.length = 0;
          if (newVal.length) {
            push$1.apply(value, newVal);
          }
          $this._notify(watch + '.length');
          $this._notify(watch);
        }
        if ($this._context) {
          // nextTick(() => $this._context.linker._notify($this._context.prop, { op: 'mutate' }));
          $this._context.linker._notify($this._context.prop, { op: 'mutate' });
        }
        if ($this._children) {
          // nextTick(() => {
          // each($this._children, function (linker) {
          //   if (!linker._unlinked) {
          //     linker._runner.push(watch);
          //   }
          // });
          // });
          each($this._children, function (linker) {
              if (!linker._unlinked) {
                linker._runner.push(watch);
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

Link.prototype.watch = function watch (watch, handler, immediate) {
  if (isString(watch) && watch.trim() !== '' && isFunction(handler)) {
    var userMap = this._watchFnMap[watch];
    if (!userMap) {
      userMap = this._watchFnMap[watch] = [];
    }
    userMap.push(!immediate ? debounce(handler) : handler);
  }
};

Link.prototype._notify = function _notify (watch, arrayOpInfo) {
  if (!this._unlinked) {
    var linkContexts = this._watchMap[watch];
    if (linkContexts) {
      each(linkContexts, function (lc) {
        lc.update(arrayOpInfo);
      });
    }
    var fns = this._watchFnMap[watch];
    if (fns) {
      each(fns, function (fn) {
        fn();
      });
    }
  }
};

Link.prototype._compileDOM = function _compileDOM () {
  compile(this, this.el);
};

Link.prototype.unlink = function unlink () {
    var this$1 = this;

  this._behaviors = null;
  this._watchMap = null;
  this._watchFnMap = null;
  this._routeEl = null;
  this._comCollection.length = 0;
  this._routeTplStore = null;
  this._comTplStore = null;
  this._watchSetterCache = null;

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
      len = children.length, i = -1;
    while (++i < len) {
      if (children[i] === this$1) {
        children.splice(i, 1);
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
