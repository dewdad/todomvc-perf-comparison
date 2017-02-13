/*!
 * link.js v0.5.0
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
function trim(str) {
  if (typeof str === 'string') {
    return str.trim();
  }
  return str;
}
function each(arr, fn) {
  var len = arr.length,
    i = -1;
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
  } else {
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
    var dst = {},
      val;
    each(Object.keys(src), function (prop) {
      val = src[prop];
      if (Array.isArray(val)) {
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
var nextTick = window.requestAnimationFrame || window.setTimeout;
var cancelNextTick = window.cancelAnimationFrame || window.clearTimeout;
function debounce(fn) {
  var timer = 0;
  return function debounceFn() {
    if (timer) { cancelNextTick(timer); }
    timer = nextTick(fn);
  }
}
function getCacheFn(cache, key, gen) {
  return cache[key] || (cache[key] = gen());
}

var watchRegex = /^\$?\w+(\.?\w+)*$/;

var watchStartRegex = /[a-zA-Z$_]/;
var validWatchChar = /[a-zA-Z0-9$\.]/;



var push = Array.prototype.push;
var glob = {
  registeredTagsCount: 0,
  registeredTags: Object.create(null)
};
var testInterpolationRegex = /\{\{[^\}]+\}\}/;
var interpilationExprRegex = /\{\{([^\}]+)\}\}/g;
var spaceRegex = /\s+/;
var eventPrefix = '@';
var interceptArrayMethods = ['push', 'pop', 'unshift', 'shift', 'reverse', 'sort', 'splice'];
var filters = Object.create(null);

function $eval(expr, model) {
  return getCacheFn(model._newFnCache, expr, function () {
    return new Function('m', ("with(m){return " + expr + ";}"));
  })(model);
}
function evalBindExpr(linkContext) {
  var val,
    linkExpr = linkContext.expr,
    filter = linkContext.filters,
    text = linkContext.text,
    model = linkContext.model;
  if (!filter) {
    val = linkContext.exprVal;
  } else {
    if (!text) {
      val = execFilterExpr(linkExpr, model);
    } else {
      val = text.replace(interpilationExprRegex, function (m, e) {
        return execFilterExpr(e, model);
      });
    }
  }
  return val;
}
function execFilterExpr(expr, model) {
  var ar = expr.split('|'), filterFn;
  if (ar.length === 1) {
    return $eval(expr, model);
  }
  filterFn = filters[ar[1].trim()];
  return filterFn($eval(ar[0], model));
}
function setWatchValue(watch, value, model) {
  return getCacheFn(model._newFnCache, 'set' + watch, function () {
    return new Function('m', 'v', ("with(m){" + watch + "=v;}"))
  })(model, value);
}

function registerComponent(config) {
  var tag = config.tag;
  if (!tag) {
    throw new Error('tag is required for a component!');
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
      loadTemplate(linker._comTplStore, config.templateUrl, function(tpl) {
        linkCom(linker, el, config, tpl);
      });
    }
  } else {
    linkCom(linker, el, config, template);
  }
}
function parentNotifyFnBuilder(prop, pprop, comModel, parentModel) {
  return function() {
    setWatchValue(prop, $eval(pprop, parentModel), comModel);
  };
}
function linkCom(linker, el, config, tpl) {
  var comModel = copy(config.model);
  var comMethods = config.methods || {};
  if (Array.isArray(config.props)) {
    var av;
    each(config.props, function(prop) {
      av = trim(el.getAttribute(prop));
      if (isFunction(linker.model[av])) {
        comMethods[prop] = linker.model[av];
      } else {
        linker.watch(av, parentNotifyFnBuilder(prop, av, comModel, linker.model), true);
        var pValue = $eval(av, linker.model);
        if (pValue !== comModel[prop]) {
          comModel[prop] = pValue;
        }
      }
    });
  }
  el.innerHTML = tpl;
  if (el.children.length > 1) { throw new Error('component can only have one root element'); }
  var comLinker = link({
    el: el.children[0],
    model: comModel,
    methods: comMethods
  });
  if (isFunction(config.postLink)) {
    config.postLink.call(comLinker.model, el, comLinker, config);
  }
}

function hash(path) {
  if (typeof path === 'undefined') {
    var href = location.href,
      index = href.indexOf('#');
    return index === -1 ? '' : href.slice(index + 1);
  } else {
    location.hash = path;
  }
}
function replaceHash(path) {
  var href = location.href,
    index = href.indexOf('#');
  if (index > -1) {
    location.replace(href.slice(0, index) + '#' + path);
  } else {
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
        loadTemplate(linker._routeTplStore, route.templateUrl, function(tpl) {
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
    route.lastLinker.unlink();
  }
  if (isFunction(route.preLink)) {
    preLinkReturn = route.preLink.call(route, linker);
  }
  if (preLinkReturn && isFunction(preLinkReturn.then)) {
    preLinkReturn.then(traceLink);
  } else {
    if (preLinkReturn === false) { return; }
    traceLink();
  }
  function traceLink() {
    if (!linker._routeEl) { return; }
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

function bindHandler(linkContext) {
  linkContext.el.textContent = evalBindExpr(linkContext);
}

function classHandler(linkContext) {
  var exprVal = linkContext.exprVal;
  if (linkContext.jsonClass) {
    if (exprVal) {
      addClass(linkContext.el, linkContext.className);
    } else {
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
  } else {
    linkContext.el.removeAttribute("disabled");
  }
}

function modelHandler(linkContext) {
  var el = linkContext.el,
    exprVal = linkContext.exprVal;
  if (el.type === 'radio') {
    var checked = (el.value === exprVal);
    if (el.checked != checked) {
      el.checked = checked;
    }
  } else if (el.type === 'checkbox') {
    if (Array.isArray(exprVal)) {
      el.checked = exprVal.indexOf(el.value) > -1;
    } else if (isBoolean(exprVal)) {
      if (el.checked !== exprVal) {
        el.checked = exprVal;
      }
    } else {
      throw Error('checkbox should bind with array or a boolean value');
    }
  } else {
    if (el.value != exprVal) {
      el.value = exprVal;
    }
  }
}

function readonlyHandler(linkContext) {
  if (linkContext.exprVal) {
    linkContext.el.setAttribute("readonly", "readonly");
  } else {
    linkContext.el.removeAttribute("readonly");
  }
}

function makeRepeatLinker(linkContext, itemData, itemIndex) {
  var cloneEl = linkContext.el.cloneNode(true),
    model = linkContext.model,
    linker,
    props = Object.create(null);
  props.$index = { value: itemIndex, enumerable: true, configurable: true, writable: true };
  props[linkContext.var] = { value: itemData, enumerable: true, configurable: true, writable: true };
  linker = new Link(cloneEl, Object.create(model, props));
  linker.$parent=linkContext.linker;
  linker.$watch=linkContext.prop;
  linkContext.linker._children.push(linker);
  return { el: cloneEl, linker: linker };
}
function repeatHandler(linkContext, arrayOpInfo) {
  var arr = linkContext.watchVal,
    el = linkContext.el,
    comment = linkContext.comment,
    repeaterItem,
    lastLinks = linkContext.lastLinks;
  if (!lastLinks) {
    lastLinks = linkContext.lastLinks = [];
    comment = linkContext.comment = document.createComment(("repeat end of " + (linkContext.prop)));
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
      repeaterItem = makeRepeatLinker(linkContext, itemData, index);
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
        repeaterItem = makeRepeatLinker(linkContext, itemData, index);
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
        each(lastLinks, function (linker, index) {
          linker.model.$index = index;
        });
        break;
      }
      case 'unshift': {
        var firstLinkerEl = lastLinks[0].el;
        itemData = arr[0];
        repeaterItem = makeRepeatLinker(linkContext, itemData, 0);
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
    el.style.display='';
  } else {
    addClass(el, 'x-hide');
    el.style.display='none';
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

function commonReact(linkContext, event) {
  var el = linkContext.el;
  function commonHandler() {
    linkContext.setWatch(el.value);
  }
  addEventListenerHandler(el, event, commonHandler, linkContext.linker._eventStore);
}

function checkboxReact(linkContext) {
  var el = linkContext.el;
  function checkboxHandler() {
    var value = el.value,
      checked = el.checked,
      watchVal = linkContext.watchVal,
      valIndex;
    if (isBoolean(watchVal)) {
      linkContext.setWatch(checked);
    } else if (Array.isArray(watchVal)) {
      valIndex = watchVal.indexOf(value);
      if (!checked && valIndex > -1) {
        watchVal.splice(valIndex, 1);
      } else {
        watchVal.push(value);
      }
    } else {
      throw new Error('checkbox should bind with array or a boolean value');
    }
  }
  addEventListenerHandler(el, 'click', checkboxHandler, linkContext.linker._eventStore);
}

function setModelReact(linkContext) {
  var el = linkContext.el,
    nodeName = el.nodeName,
    type = el.type;
  if (nodeName === 'INPUT') {
    switch (type) {
      case 'text':
      case 'password': {
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
      default: {
        commonReact(linkContext, 'keyup');
        break;
      }
    }
  } else if (nodeName === 'SELECT') {
    commonReact(linkContext, 'change');
  } else {
    commonReact(linkContext, 'keyup');
  }
}

var LinkContext = function LinkContext(el, watch, directive, expr, linker) {
  this.el = el;
  this.prop = watch;
  this.directive = directive;
  this.expr = expr;
  this.linker = linker;
  this.filters = null;
  this.text = null;
  this.watchVal = null;
  this.model = linker.model;
  this.watchSetterFnKey = null;
  if (directive === 'x-model') {
    this.watchSetterFnKey = 'set' + this.prop;
    setModelReact(this);
  }
};
var prototypeAccessors = { exprVal: {} };
LinkContext.create = function create (el, watch, directive, expr, linker) {
  var lcs = linker._watchMap[watch] || (linker._watchMap[watch] = []);
  var context = new LinkContext(el, watch, directive, expr, linker);
  lcs.push(context);
  return context;
};
LinkContext.prototype.setWatch = function setWatch (v) {
  var $this = this;
  var setter = getCacheFn(this.model._newFnCache, this.watchSetterFnKey, function () {
    return new Function('m', 'v', ("with(m){ " + ($this.prop) + "=v;}"));
  });
  setter(this.model, v);
};
prototypeAccessors.exprVal.get = function () {
  var $this = this;
  var getter = getCacheFn(this.model._newFnCache, this.expr, function () {
    return new Function('m', ("with(m){return " + ($this.expr) + ";}"))
  });
  return getter(this.model);
};
LinkContext.prototype.update = function update (watchVal, arrayOpInfo) {
  this.watchVal = watchVal;
  drm[this.directive](this, arrayOpInfo);
};
Object.defineProperties( LinkContext.prototype, prototypeAccessors );

var Lexer = function Lexer(text) {
  this.text = text;
  this.index = 0;
  this.len = text.length;
  this.watches = null;
  this.filters = null;
  this._run();
};
Lexer.prototype._run = function _run () {
    var this$1 = this;
  while (this.index < this.len) {
    var ch = this$1.text[this$1.index];
    if (watchStartRegex.test(ch)) {
      if (!this$1.watches) {
        this$1.watches = [];
      }
      this$1._getWatch(ch);
    } else if (ch === '"' || ch === "'") {
      while (this._peek() !== ch && this.index < this.len) {
        this$1.index++;
      }
      if (this$1.index + 1 < this$1.len) {
        this$1.index += 2;
      } else {
        throw new Error('unclosed string in expr');
      }
    } else if (ch === '|') {
      if (this$1._peek() !== '|') {
        if (!this$1.filters) {
          this$1.filters = [];
        }
        this$1.index++;
        if (this$1.watches.length < this$1.filters.length) { throw new Error('bad expr'); }
        this$1._getFilter();
      } else {
        this$1.index += 2;
      }
    } else {
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
    } else {
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

function getLinkContextsFromInterpolation(linker, el, text) {
  var expr = ['"', text, '"'].join('').replace(/(\{\{)/g, '"+(').replace(/(\}\})/g, ')+"');
  var lexer = new Lexer(expr);
  if (lexer.watches) {
    each(lexer.watches, function (watch) {
      var linkContext = LinkContext.create(el, watch, 'x-bind', expr, linker);
      linkContext.text = text;
      linkContext.filters = lexer.filters;
    });
  }
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
    className = spliter[0].trim();
    subExpr = spliter[1].trim();
    if (watchRegex.test(subExpr)) {
      linkContext = LinkContext.create(el, subExpr, directive, subExpr, linker);
      linkContext.className = className;
      linkContext.jsonClass = true;
    } else {
      lexer = new Lexer(subExpr);
      if (lexer.watches) {
        each(lexer.watches, function (w) {
          linkContext = LinkContext.create(el, w, directive, subExpr, linker);
          linkContext.className = className;
          linkContext.jsonClass = true;
        });
      }
    }
  });
}
function getLinkContext(linker, el, directive, expr) {
  var linkContext;
  if (watchRegex.test(expr)) {
    linkContext = LinkContext.create(el, expr, directive, expr, linker);
  } else if (isLikeJson(expr)) {
    getClassLinkContext(linker, el, directive, expr);
  } else {
    var lexer = new Lexer(expr);
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
    lc,
    hasAttributes,
    attrName,
    attrValue,
    nodeType = el.nodeType;
  if (nodeType === 1) {
    hasAttributes = el.hasAttributes();
    if (hasAttributes) {
      if (el.hasAttribute('x-repeat')) {
        expr = trim(el.getAttribute('x-repeat'));
        w = expr.split(spaceRegex);
        if (w.length !== 3) { throw new Error('repeat only support expr like: var in array.'); }
        lc = LinkContext.create(el, w[2], 'x-repeat', expr, linker);
        lc.var = w[0];
        el.removeAttribute('x-repeat');
        linker._children = linker._children || [];
        return;
      }
      if (el.hasAttribute('x-view')) {
        if (linker._routeEl) { throw new Error('a link context can only have on more than one x-view'); }
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
          addEventListenerHandler(el, attrName.slice(1), genEventFn(attrValue, linker.model), linker._eventStore);
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
    expr = el.textContent;
    if (expr.indexOf('{') > -1 && testInterpolationRegex.test(expr)) {
      getLinkContextsFromInterpolation(linker, el, trim(expr));
    }
  } else if (nodeType === 9) {
    each(el.childNodes, function (node) {
      compile(linker, node);
    });
  }
}
function genEventFn(expr, model) {
  var fn = getCacheFn(model._newFnCache, expr, function () {
    return new Function('m', '$event', ("with(m){" + expr + "}"));
  });
  return function (ev) {
    fn(model, ev);
  }
}

function interceptArray(arr, watch, linker) {
  each(interceptArrayMethods, function(fn) {
    arr[fn] = function() {
      var result = Array.prototype[fn].apply(arr, arguments);
      linker._notify(watch, arr, {
        op: fn,
        args: arguments
      });
      linker._notify(watch + '.length', arr.length);
      return result;
    };
  });
}

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
  this._children = null;
  this._context = null;
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
  if(!this.model._newFnCache){
    Object.defineProperty(this.model,'_newFnCache',{
      value:Object.create(null)
    });
  }
  this._compileDOM();
  this._walk(this.model, []);
  this._addBehaviors();
};
Link.prototype._walk = function _walk (model, propStack) {
  var value,
    valIsArray,
    watch,
    $this = this;
  each(Object.keys(model), function (prop) {
    value = model[prop];
    valIsArray = Array.isArray(value);
    if (isObject(value) && !valIsArray) {
      propStack.push(prop);
      $this._walk(value, propStack);
      propStack.pop();
    } else {
      watch = propStack.concat(prop).join('.');
      if (valIsArray) {
        interceptArray(value, watch, $this);
        $this._notify(watch + '.length', value.length);
      }
      $this._defineObserver(model, prop, value, watch, valIsArray);
      $this._notify(watch, value);
    }
  });
};
Link.prototype._defineObserver = function _defineObserver (model, prop, value, watch, valIsArray) {
  var $this = this;
  Object.defineProperty(model, prop, {
    get: function () {
      return value;
    },
    set: function (newVal) {
      if (newVal !== value) {
        if (!valIsArray) {
          value = newVal;
          $this._notify(watch, value);
        } else {
          value.length = 0;
          if (newVal.length) {
            push.apply(value, newVal);
          }
          $this._notify(watch + '.length', value.length);
          $this._notify(watch, value);
        }
        if ($this.$parent) {
          $this.$parent._notify($this.$watch,value,{op:'mutate'});
        }
        if ($this._children) {
          each($this._children, function (linker) {
            if (!linker._unlinked) {
              linker._notify(watch, value);
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
          throw new Error('{0} is defined in the data model,please change the function/method name of "{0}"', fn);
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
Link.prototype._notify = function _notify (watch, newVal, arrayOpInfo) {
  var linkContexts = this._watchMap[watch];
  if (linkContexts) {
    each(linkContexts, function (lc) {
      lc.update(newVal, arrayOpInfo);
    });
  }
  var fns = this._watchFnMap[watch];
  if (fns) {
    each(fns, function (fn) {
      fn();
    });
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
  if (this.$parent) {
    var children = this.$parent._children,
      len = children.length,
      i = -1;
    while (++i < len) {
      if (children[i] === this$1) {
        children.splice(i, 1);
        break;
      }
    }
    this.$parent = null;
    this.el.parentNode.removeChild(this.el);
    this.el = null;
  }else{
    this._evFnCache=null;
  }
  this.model = null;
  this._unlinked = true;
};

function link(config) {
  config = extend({
    el: window.document,
    model: {},
    methods: null,
    routes: null
  }, config);
  return new Link(config.el, config.model, config.methods, config.routes);
}
link.filter = function(name, fn) {
  if (!filters[name] && isFunction(fn)) {
    filters[name] = fn;
  }
};
link.com = registerComponent;

return link;

})));
