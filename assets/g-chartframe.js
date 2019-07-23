(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(factory((global.gChartframe = global.gChartframe || {})));
}(this, function (exports) { 'use strict';

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var saveSvgAsPng = createCommonjsModule(function (module, exports) {
	(function() {
	  var out$ = 'object' != 'undefined' && exports || typeof undefined != 'undefined' && {} || this;

	  var doctype = '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" [<!ENTITY nbsp "&#160;">]>';

	  function isElement(obj) {
	    return obj instanceof HTMLElement || obj instanceof SVGElement;
	  }

	  function requireDomNode(el) {
	    if (!isElement(el)) {
	      throw new Error('an HTMLElement or SVGElement is required; got ' + el);
	    }
	  }

	  function isExternal(url) {
	    return url && url.lastIndexOf('http',0) == 0 && url.lastIndexOf(window.location.host) == -1;
	  }

	  function inlineImages(el, callback) {
	    requireDomNode(el);

	    var images = el.querySelectorAll('image'),
	        left = images.length,
	        checkDone = function() {
	          if (left === 0) {
	            callback();
	          }
	        };

	    checkDone();
	    for (var i = 0; i < images.length; i++) {
	      (function(image) {
	        var href = image.getAttributeNS("http://www.w3.org/1999/xlink", "href");
	        if (href) {
	          if (isExternal(href.value)) {
	            console.warn("Cannot render embedded images linking to external hosts: "+href.value);
	            return;
	          }
	        }
	        var canvas = document.createElement('canvas');
	        var ctx = canvas.getContext('2d');
	        var img = new Image();
	        img.crossOrigin="anonymous";
	        href = href || image.getAttribute('href');
	        if (href) {
	          img.src = href;
	          img.onload = function() {
	            canvas.width = img.width;
	            canvas.height = img.height;
	            ctx.drawImage(img, 0, 0);
	            image.setAttributeNS("http://www.w3.org/1999/xlink", "href", canvas.toDataURL('image/png'));
	            left--;
	            checkDone();
	          }
	          img.onerror = function() {
	            console.log("Could not load "+href);
	            left--;
	            checkDone();
	          }
	        } else {
	          left--;
	          checkDone();
	        }
	      })(images[i]);
	    }
	  }

	  function styles(el, options, cssLoadedCallback) {
	    var selectorRemap = options.selectorRemap;
	    var modifyStyle = options.modifyStyle;
	    var css = "";
	    // each font that has extranl link is saved into queue, and processed
	    // asynchronously
	    var fontsQueue = [];
	    var sheets = document.styleSheets;
	    for (var i = 0; i < sheets.length; i++) {
	      try {
	        var rules = sheets[i].cssRules;
	      } catch (e) {
	        console.warn("Stylesheet could not be loaded: "+sheets[i].href);
	        continue;
	      }

	      if (rules != null) {
	        for (var j = 0, match; j < rules.length; j++, match = null) {
	          var rule = rules[j];
	          if (typeof(rule.style) != "undefined") {
	            var selectorText;

	            try {
	              selectorText = rule.selectorText;
	            } catch(err) {
	              console.warn('The following CSS rule has an invalid selector: "' + rule + '"', err);
	            }

	            try {
	              if (selectorText) {
	                match = el.querySelector(selectorText) || el.parentNode.querySelector(selectorText);
	              }
	            } catch(err) {
	              console.warn('Invalid CSS selector "' + selectorText + '"', err);
	            }

	            if (match) {
	              var selector = selectorRemap ? selectorRemap(rule.selectorText) : rule.selectorText;
	              var cssText = modifyStyle ? modifyStyle(rule.style.cssText) : rule.style.cssText;
	              css += selector + " { " + cssText + " }\n";
	            } else if(rule.cssText.match(/^@font-face/)) {
	              // below we are trying to find matches to external link. E.g.
	              // @font-face {
	              //   // ...
	              //   src: local('Abel'), url(https://fonts.gstatic.com/s/abel/v6/UzN-iejR1VoXU2Oc-7LsbvesZW2xOQ-xsNqO47m55DA.woff2);
	              // }
	              //
	              // This regex will save extrnal link into first capture group
	              var fontUrlRegexp = /url\(["']?(.+?)["']?\)/;
	              // TODO: This needs to be changed to support multiple url declarations per font.
	              var fontUrlMatch = rule.cssText.match(fontUrlRegexp);

	              var externalFontUrl = (fontUrlMatch && fontUrlMatch[1]) || '';
	              var fontUrlIsDataURI = externalFontUrl.match(/^data:/);
	              if (fontUrlIsDataURI) {
	                // We should ignore data uri - they are already embedded
	                externalFontUrl = '';
	              }

	              if (externalFontUrl) {
	                // okay, we are lucky. We can fetch this font later

	                //handle url if relative
	                if (externalFontUrl.startsWith('../')) {
	                  externalFontUrl = sheets[i].href + '/../' + externalFontUrl
	                } else if (externalFontUrl.startsWith('./')) {
	                  externalFontUrl = sheets[i].href + '/.' + externalFontUrl
	                }

	                fontsQueue.push({
	                  text: rule.cssText,
	                  // Pass url regex, so that once font is downladed, we can run `replace()` on it
	                  fontUrlRegexp: fontUrlRegexp,
	                  format: getFontMimeTypeFromUrl(externalFontUrl),
	                  url: externalFontUrl
	                });
	              } else {
	                // otherwise, use previous logic
	                css += rule.cssText + '\n';
	              }
	            }
	          }
	        }
	      }
	    }

	    // Now all css is processed, it's time to handle scheduled fonts
	    processFontQueue(fontsQueue);

	    function getFontMimeTypeFromUrl(fontUrl) {
	      var supportedFormats = {
	        'woff2': 'font/woff2',
	        'woff': 'font/woff',
	        'otf': 'application/x-font-opentype',
	        'ttf': 'application/x-font-ttf',
	        'eot': 'application/vnd.ms-fontobject',
	        'sfnt': 'application/font-sfnt',
	        'svg': 'image/svg+xml'
	      };
	      var extensions = Object.keys(supportedFormats);
	      for (var i = 0; i < extensions.length; ++i) {
	        var extension = extensions[i];
	        // TODO: This is not bullet proof, it needs to handle edge cases...
	        if (fontUrl.indexOf('.' + extension) > 0) {
	          return supportedFormats[extension];
	        }
	      }

	      // If you see this error message, you probably need to update code above.
	      console.error('Unknown font format for ' + fontUrl+ '; Fonts may not be working correctly');
	      return 'application/octet-stream';
	    }

	    function processFontQueue(queue) {
	      if (queue.length > 0) {
	        // load fonts one by one until we have anything in the queue:
	        var font = queue.pop();
	        processNext(font);
	      } else {
	        // no more fonts to load.
	        cssLoadedCallback(css);
	      }

	      function processNext(font) {
	        // TODO: This could benefit from caching.
	        var oReq = new XMLHttpRequest();
	        oReq.addEventListener('load', fontLoaded);
	        oReq.addEventListener('error', transferFailed);
	        oReq.addEventListener('abort', transferFailed);
	        oReq.open('GET', font.url);
	        oReq.responseType = 'arraybuffer';
	        oReq.send();

	        function fontLoaded() {
	          // TODO: it may be also worth to wait until fonts are fully loaded before
	          // attempting to rasterize them. (e.g. use https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet )
	          var fontBits = oReq.response;
	          var fontInBase64 = arrayBufferToBase64(fontBits);
	          updateFontStyle(font, fontInBase64);
	        }

	        function transferFailed(e) {
	          console.warn('Failed to load font from: ' + font.url);
	          console.warn(e)
	          css += font.text + '\n';
	          processFontQueue();
	        }

	        function updateFontStyle(font, fontInBase64) {
	          var dataUrl = 'url("data:' + font.format + ';base64,' + fontInBase64 + '")';
	          css += font.text.replace(font.fontUrlRegexp, dataUrl) + '\n';

	          // schedule next font download on next tick.
	          setTimeout(function() {
	            processFontQueue(queue)
	          }, 0);
	        }

	      }
	    }

	    function arrayBufferToBase64(buffer) {
	      var binary = '';
	      var bytes = new Uint8Array(buffer);
	      var len = bytes.byteLength;

	      for (var i = 0; i < len; i++) {
	          binary += String.fromCharCode(bytes[i]);
	      }

	      return window.btoa(binary);
	    }
	  }

	  function getDimension(el, clone, dim) {
	    var v = (el.viewBox && el.viewBox.baseVal && el.viewBox.baseVal[dim]) ||
	      (clone.getAttribute(dim) !== null && !clone.getAttribute(dim).match(/%$/) && parseInt(clone.getAttribute(dim))) ||
	      el.getBoundingClientRect()[dim] ||
	      parseInt(clone.style[dim]) ||
	      parseInt(window.getComputedStyle(el).getPropertyValue(dim));
	    return (typeof v === 'undefined' || v === null || isNaN(parseFloat(v))) ? 0 : v;
	  }

	  function reEncode(data) {
	    data = encodeURIComponent(data);
	    data = data.replace(/%([0-9A-F]{2})/g, function(match, p1) {
	      var c = String.fromCharCode('0x'+p1);
	      return c === '%' ? '%25' : c;
	    });
	    return decodeURIComponent(data);
	  }

	  out$.prepareSvg = function(el, options, cb) {
	    requireDomNode(el);

	    options = options || {};
	    options.scale = options.scale || 1;
	    options.responsive = options.responsive || false;
	    var xmlns = "http://www.w3.org/2000/xmlns/";

	    inlineImages(el, function() {
	      var outer = document.createElement("div");
	      var clone = el.cloneNode(true);
	      var width, height;
	      if(el.tagName == 'svg') {
	        width = options.width || getDimension(el, clone, 'width');
	        height = options.height || getDimension(el, clone, 'height');
	      } else if(el.getBBox) {
	        var box = el.getBBox();
	        width = box.x + box.width;
	        height = box.y + box.height;
	        clone.setAttribute('transform', clone.getAttribute('transform').replace(/translate\(.*?\)/, ''));

	        var svg = document.createElementNS('http://www.w3.org/2000/svg','svg')
	        svg.appendChild(clone)
	        clone = svg;
	      } else {
	        console.error('Attempted to render non-SVG element', el);
	        return;
	      }

	      clone.setAttribute("version", "1.1");
	      if (!clone.getAttribute('xmlns')) {
	        clone.setAttributeNS(xmlns, "xmlns", "http://www.w3.org/2000/svg");
	      }
	      if (!clone.getAttribute('xmlns:xlink')) {
	        clone.setAttributeNS(xmlns, "xmlns:xlink", "http://www.w3.org/1999/xlink");
	      }

	      if (options.responsive) {
	        clone.removeAttribute('width');
	        clone.removeAttribute('height');
	        clone.setAttribute('preserveAspectRatio', 'xMinYMin meet');
	      } else {
	        clone.setAttribute("width", width * options.scale);
	        clone.setAttribute("height", height * options.scale);
	      }

	      clone.setAttribute("viewBox", [
	        options.left || 0,
	        options.top || 0,
	        width,
	        height
	      ].join(" "));

	      var fos = clone.querySelectorAll('foreignObject > *');
	      for (var i = 0; i < fos.length; i++) {
	        if (!fos[i].getAttribute('xmlns')) {
	          fos[i].setAttributeNS(xmlns, "xmlns", "http://www.w3.org/1999/xhtml");
	        }
	      }

	      outer.appendChild(clone);

	      // In case of custom fonts we need to fetch font first, and then inline
	      // its url into data-uri format (encode as base64). That's why style
	      // processing is done asynchonously. Once all inlining is finshed
	      // cssLoadedCallback() is called.
	      styles(el, options, cssLoadedCallback);

	      function cssLoadedCallback(css) {
	        // here all fonts are inlined, so that we can render them properly.
	        var s = document.createElement('style');
	        s.setAttribute('type', 'text/css');
	        s.innerHTML = "<![CDATA[\n" + css + "\n]]>";
	        var defs = document.createElement('defs');
	        defs.appendChild(s);
	        clone.insertBefore(defs, clone.firstChild);

	        if (cb) {
	          var outHtml = outer.innerHTML;
	          outHtml = outHtml.replace(/NS\d+:href/gi, 'xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href');
	          cb(outHtml, width, height);
	        }
	      }
	    });
	  }

	  out$.svgAsDataUri = function(el, options, cb) {
	    out$.prepareSvg(el, options, function(svg) {
	      var uri = 'data:image/svg+xml;base64,' + window.btoa(reEncode(doctype + svg));
	      if (cb) {
	        cb(uri);
	      }
	    });
	  }

	  out$.svgAsPngUri = function(el, options, cb) {
	    requireDomNode(el);

	    options = options || {};
	    options.encoderType = options.encoderType || 'image/png';
	    options.encoderOptions = options.encoderOptions || 0.8;

	    var convertToPng = function(src, w, h) {
	      var canvas = document.createElement('canvas');
	      var context = canvas.getContext('2d');
	      canvas.width = w;
	      canvas.height = h;

	      if(options.canvg) {
	        options.canvg(canvas, src);
	      } else {
	        context.drawImage(src, 0, 0);
	      }

	      if(options.backgroundColor){
	        context.globalCompositeOperation = 'destination-over';
	        context.fillStyle = options.backgroundColor;
	        context.fillRect(0, 0, canvas.width, canvas.height);
	      }

	      var png;
	      try {
	        png = canvas.toDataURL(options.encoderType, options.encoderOptions);
	      } catch (e) {
	        if ((typeof SecurityError !== 'undefined' && e instanceof SecurityError) || e.name == "SecurityError") {
	          console.error("Rendered SVG images cannot be downloaded in this browser.");
	          return;
	        } else {
	          throw e;
	        }
	      }
	      cb(png);
	    }

	    if(options.canvg) {
	      out$.prepareSvg(el, options, convertToPng);
	    } else {
	      out$.svgAsDataUri(el, options, function(uri) {
	        var image = new Image();

	        image.onload = function() {
	          convertToPng(image, image.width, image.height);
	        }

	        image.onerror = function() {
	          console.error(
	            'There was an error loading the data URI as an image on the following SVG\n',
	            window.atob(uri.slice(26)), '\n',
	            "Open the following link to see browser's diagnosis\n",
	            uri);
	        }

	        image.src = uri;
	      });
	    }
	  }

	  out$.download = function(name, uri) {
	    if (navigator.msSaveOrOpenBlob) {
	      navigator.msSaveOrOpenBlob(uriToBlob(uri), name);
	    } else {
	      var saveLink = document.createElement('a');
	      var downloadSupported = 'download' in saveLink;
	      if (downloadSupported) {
	        saveLink.download = name;
	        saveLink.style.display = 'none';
	        document.body.appendChild(saveLink);
	        try {
	          var blob = uriToBlob(uri);
	          var url = URL.createObjectURL(blob);
	          saveLink.href = url;
	          saveLink.onclick = function() {
	            requestAnimationFrame(function() {
	              URL.revokeObjectURL(url);
	            })
	          };
	        } catch (e) {
	          console.warn('This browser does not support object URLs. Falling back to string URL.');
	          saveLink.href = uri;
	        }
	        saveLink.click();
	        document.body.removeChild(saveLink);
	      }
	      else {
	        window.open(uri, '_temp', 'menubar=no,toolbar=no,status=no');
	      }
	    }
	  }

	  function uriToBlob(uri) {
	    var byteString = window.atob(uri.split(',')[1]);
	    var mimeString = uri.split(',')[0].split(':')[1].split(';')[0]
	    var buffer = new ArrayBuffer(byteString.length);
	    var intArray = new Uint8Array(buffer);
	    for (var i = 0; i < byteString.length; i++) {
	      intArray[i] = byteString.charCodeAt(i);
	    }
	    return new Blob([buffer], {type: mimeString});
	  }

	  out$.saveSvg = function(el, name, options) {
	    requireDomNode(el);

	    options = options || {};
	    out$.svgAsDataUri(el, options, function(uri) {
	      out$.download(name, uri);
	    });
	  }

	  out$.saveSvgAsPng = function(el, name, options) {
	    requireDomNode(el);

	    options = options || {};
	    out$.svgAsPngUri(el, options, function(uri) {
	      out$.download(name, uri);
	    });
	  }

	  // if define is defined create as an AMD module
	  if (typeof undefined !== 'undefined') {
	    undefined(function() {
	      return out$;
	    });
	  }

	})();
	});

	var saveSvgAsPng_1 = saveSvgAsPng.saveSvgAsPng;

	var xhtml = "http://www.w3.org/1999/xhtml";

	var namespaces = {
	  svg: "http://www.w3.org/2000/svg",
	  xhtml: xhtml,
	  xlink: "http://www.w3.org/1999/xlink",
	  xml: "http://www.w3.org/XML/1998/namespace",
	  xmlns: "http://www.w3.org/2000/xmlns/"
	};

	function namespace(name) {
	  var prefix = name += "", i = prefix.indexOf(":");
	  if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
	  return namespaces.hasOwnProperty(prefix) ? {space: namespaces[prefix], local: name} : name;
	}

	function creatorInherit(name) {
	  return function() {
	    var document = this.ownerDocument,
	        uri = this.namespaceURI;
	    return uri === xhtml && document.documentElement.namespaceURI === xhtml
	        ? document.createElement(name)
	        : document.createElementNS(uri, name);
	  };
	}

	function creatorFixed(fullname) {
	  return function() {
	    return this.ownerDocument.createElementNS(fullname.space, fullname.local);
	  };
	}

	function creator(name) {
	  var fullname = namespace(name);
	  return (fullname.local
	      ? creatorFixed
	      : creatorInherit)(fullname);
	}

	var matcher = function(selector) {
	  return function() {
	    return this.matches(selector);
	  };
	};

	if (typeof document !== "undefined") {
	  var element = document.documentElement;
	  if (!element.matches) {
	    var vendorMatches = element.webkitMatchesSelector
	        || element.msMatchesSelector
	        || element.mozMatchesSelector
	        || element.oMatchesSelector;
	    matcher = function(selector) {
	      return function() {
	        return vendorMatches.call(this, selector);
	      };
	    };
	  }
	}

	var matcher$1 = matcher;

	var filterEvents = {};

	var event = null;

	if (typeof document !== "undefined") {
	  var element$1 = document.documentElement;
	  if (!("onmouseenter" in element$1)) {
	    filterEvents = {mouseenter: "mouseover", mouseleave: "mouseout"};
	  }
	}

	function filterContextListener(listener, index, group) {
	  listener = contextListener(listener, index, group);
	  return function(event) {
	    var related = event.relatedTarget;
	    if (!related || (related !== this && !(related.compareDocumentPosition(this) & 8))) {
	      listener.call(this, event);
	    }
	  };
	}

	function contextListener(listener, index, group) {
	  return function(event1) {
	    var event0 = event; // Events can be reentrant (e.g., focus).
	    event = event1;
	    try {
	      listener.call(this, this.__data__, index, group);
	    } finally {
	      event = event0;
	    }
	  };
	}

	function parseTypenames(typenames) {
	  return typenames.trim().split(/^|\s+/).map(function(t) {
	    var name = "", i = t.indexOf(".");
	    if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
	    return {type: t, name: name};
	  });
	}

	function onRemove(typename) {
	  return function() {
	    var on = this.__on;
	    if (!on) return;
	    for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
	      if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
	        this.removeEventListener(o.type, o.listener, o.capture);
	      } else {
	        on[++i] = o;
	      }
	    }
	    if (++i) on.length = i;
	    else delete this.__on;
	  };
	}

	function onAdd(typename, value, capture) {
	  var wrap = filterEvents.hasOwnProperty(typename.type) ? filterContextListener : contextListener;
	  return function(d, i, group) {
	    var on = this.__on, o, listener = wrap(value, i, group);
	    if (on) for (var j = 0, m = on.length; j < m; ++j) {
	      if ((o = on[j]).type === typename.type && o.name === typename.name) {
	        this.removeEventListener(o.type, o.listener, o.capture);
	        this.addEventListener(o.type, o.listener = listener, o.capture = capture);
	        o.value = value;
	        return;
	      }
	    }
	    this.addEventListener(typename.type, listener, capture);
	    o = {type: typename.type, name: typename.name, value: value, listener: listener, capture: capture};
	    if (!on) this.__on = [o];
	    else on.push(o);
	  };
	}

	function selection_on(typename, value, capture) {
	  var typenames = parseTypenames(typename + ""), i, n = typenames.length, t;

	  if (arguments.length < 2) {
	    var on = this.node().__on;
	    if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
	      for (i = 0, o = on[j]; i < n; ++i) {
	        if ((t = typenames[i]).type === o.type && t.name === o.name) {
	          return o.value;
	        }
	      }
	    }
	    return;
	  }

	  on = value ? onAdd : onRemove;
	  if (capture == null) capture = false;
	  for (i = 0; i < n; ++i) this.each(on(typenames[i], value, capture));
	  return this;
	}

	function none() {}

	function selector(selector) {
	  return selector == null ? none : function() {
	    return this.querySelector(selector);
	  };
	}

	function selection_select(select) {
	  if (typeof select !== "function") select = selector(select);

	  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
	    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
	      if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
	        if ("__data__" in node) subnode.__data__ = node.__data__;
	        subgroup[i] = subnode;
	      }
	    }
	  }

	  return new Selection(subgroups, this._parents);
	}

	function empty() {
	  return [];
	}

	function selectorAll(selector) {
	  return selector == null ? empty : function() {
	    return this.querySelectorAll(selector);
	  };
	}

	function selection_selectAll(select) {
	  if (typeof select !== "function") select = selectorAll(select);

	  for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
	    for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
	      if (node = group[i]) {
	        subgroups.push(select.call(node, node.__data__, i, group));
	        parents.push(node);
	      }
	    }
	  }

	  return new Selection(subgroups, parents);
	}

	function selection_filter(match) {
	  if (typeof match !== "function") match = matcher$1(match);

	  for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
	    for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
	      if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
	        subgroup.push(node);
	      }
	    }
	  }

	  return new Selection(subgroups, this._parents);
	}

	function sparse(update) {
	  return new Array(update.length);
	}

	function selection_enter() {
	  return new Selection(this._enter || this._groups.map(sparse), this._parents);
	}

	function EnterNode(parent, datum) {
	  this.ownerDocument = parent.ownerDocument;
	  this.namespaceURI = parent.namespaceURI;
	  this._next = null;
	  this._parent = parent;
	  this.__data__ = datum;
	}

	EnterNode.prototype = {
	  constructor: EnterNode,
	  appendChild: function(child) { return this._parent.insertBefore(child, this._next); },
	  insertBefore: function(child, next) { return this._parent.insertBefore(child, next); },
	  querySelector: function(selector) { return this._parent.querySelector(selector); },
	  querySelectorAll: function(selector) { return this._parent.querySelectorAll(selector); }
	};

	function constant(x) {
	  return function() {
	    return x;
	  };
	}

	var keyPrefix = "$"; // Protect against keys like “__proto__”.

	function bindIndex(parent, group, enter, update, exit, data) {
	  var i = 0,
	      node,
	      groupLength = group.length,
	      dataLength = data.length;

	  // Put any non-null nodes that fit into update.
	  // Put any null nodes into enter.
	  // Put any remaining data into enter.
	  for (; i < dataLength; ++i) {
	    if (node = group[i]) {
	      node.__data__ = data[i];
	      update[i] = node;
	    } else {
	      enter[i] = new EnterNode(parent, data[i]);
	    }
	  }

	  // Put any non-null nodes that don’t fit into exit.
	  for (; i < groupLength; ++i) {
	    if (node = group[i]) {
	      exit[i] = node;
	    }
	  }
	}

	function bindKey(parent, group, enter, update, exit, data, key) {
	  var i,
	      node,
	      nodeByKeyValue = {},
	      groupLength = group.length,
	      dataLength = data.length,
	      keyValues = new Array(groupLength),
	      keyValue;

	  // Compute the key for each node.
	  // If multiple nodes have the same key, the duplicates are added to exit.
	  for (i = 0; i < groupLength; ++i) {
	    if (node = group[i]) {
	      keyValues[i] = keyValue = keyPrefix + key.call(node, node.__data__, i, group);
	      if (keyValue in nodeByKeyValue) {
	        exit[i] = node;
	      } else {
	        nodeByKeyValue[keyValue] = node;
	      }
	    }
	  }

	  // Compute the key for each datum.
	  // If there a node associated with this key, join and add it to update.
	  // If there is not (or the key is a duplicate), add it to enter.
	  for (i = 0; i < dataLength; ++i) {
	    keyValue = keyPrefix + key.call(parent, data[i], i, data);
	    if (node = nodeByKeyValue[keyValue]) {
	      update[i] = node;
	      node.__data__ = data[i];
	      nodeByKeyValue[keyValue] = null;
	    } else {
	      enter[i] = new EnterNode(parent, data[i]);
	    }
	  }

	  // Add any remaining nodes that were not bound to data to exit.
	  for (i = 0; i < groupLength; ++i) {
	    if ((node = group[i]) && (nodeByKeyValue[keyValues[i]] === node)) {
	      exit[i] = node;
	    }
	  }
	}

	function selection_data(value, key) {
	  if (!value) {
	    data = new Array(this.size()), j = -1;
	    this.each(function(d) { data[++j] = d; });
	    return data;
	  }

	  var bind = key ? bindKey : bindIndex,
	      parents = this._parents,
	      groups = this._groups;

	  if (typeof value !== "function") value = constant(value);

	  for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
	    var parent = parents[j],
	        group = groups[j],
	        groupLength = group.length,
	        data = value.call(parent, parent && parent.__data__, j, parents),
	        dataLength = data.length,
	        enterGroup = enter[j] = new Array(dataLength),
	        updateGroup = update[j] = new Array(dataLength),
	        exitGroup = exit[j] = new Array(groupLength);

	    bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);

	    // Now connect the enter nodes to their following update node, such that
	    // appendChild can insert the materialized enter node before this node,
	    // rather than at the end of the parent node.
	    for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
	      if (previous = enterGroup[i0]) {
	        if (i0 >= i1) i1 = i0 + 1;
	        while (!(next = updateGroup[i1]) && ++i1 < dataLength);
	        previous._next = next || null;
	      }
	    }
	  }

	  update = new Selection(update, parents);
	  update._enter = enter;
	  update._exit = exit;
	  return update;
	}

	function selection_exit() {
	  return new Selection(this._exit || this._groups.map(sparse), this._parents);
	}

	function selection_merge(selection) {

	  for (var groups0 = this._groups, groups1 = selection._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
	    for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
	      if (node = group0[i] || group1[i]) {
	        merge[i] = node;
	      }
	    }
	  }

	  for (; j < m0; ++j) {
	    merges[j] = groups0[j];
	  }

	  return new Selection(merges, this._parents);
	}

	function selection_order() {

	  for (var groups = this._groups, j = -1, m = groups.length; ++j < m;) {
	    for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0;) {
	      if (node = group[i]) {
	        if (next && next !== node.nextSibling) next.parentNode.insertBefore(node, next);
	        next = node;
	      }
	    }
	  }

	  return this;
	}

	function selection_sort(compare) {
	  if (!compare) compare = ascending;

	  function compareNode(a, b) {
	    return a && b ? compare(a.__data__, b.__data__) : !a - !b;
	  }

	  for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
	    for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
	      if (node = group[i]) {
	        sortgroup[i] = node;
	      }
	    }
	    sortgroup.sort(compareNode);
	  }

	  return new Selection(sortgroups, this._parents).order();
	}

	function ascending(a, b) {
	  return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
	}

	function selection_call() {
	  var callback = arguments[0];
	  arguments[0] = this;
	  callback.apply(null, arguments);
	  return this;
	}

	function selection_nodes() {
	  var nodes = new Array(this.size()), i = -1;
	  this.each(function() { nodes[++i] = this; });
	  return nodes;
	}

	function selection_node() {

	  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
	    for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
	      var node = group[i];
	      if (node) return node;
	    }
	  }

	  return null;
	}

	function selection_size() {
	  var size = 0;
	  this.each(function() { ++size; });
	  return size;
	}

	function selection_empty() {
	  return !this.node();
	}

	function selection_each(callback) {

	  for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
	    for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
	      if (node = group[i]) callback.call(node, node.__data__, i, group);
	    }
	  }

	  return this;
	}

	function attrRemove(name) {
	  return function() {
	    this.removeAttribute(name);
	  };
	}

	function attrRemoveNS(fullname) {
	  return function() {
	    this.removeAttributeNS(fullname.space, fullname.local);
	  };
	}

	function attrConstant(name, value) {
	  return function() {
	    this.setAttribute(name, value);
	  };
	}

	function attrConstantNS(fullname, value) {
	  return function() {
	    this.setAttributeNS(fullname.space, fullname.local, value);
	  };
	}

	function attrFunction(name, value) {
	  return function() {
	    var v = value.apply(this, arguments);
	    if (v == null) this.removeAttribute(name);
	    else this.setAttribute(name, v);
	  };
	}

	function attrFunctionNS(fullname, value) {
	  return function() {
	    var v = value.apply(this, arguments);
	    if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
	    else this.setAttributeNS(fullname.space, fullname.local, v);
	  };
	}

	function selection_attr(name, value) {
	  var fullname = namespace(name);

	  if (arguments.length < 2) {
	    var node = this.node();
	    return fullname.local
	        ? node.getAttributeNS(fullname.space, fullname.local)
	        : node.getAttribute(fullname);
	  }

	  return this.each((value == null
	      ? (fullname.local ? attrRemoveNS : attrRemove) : (typeof value === "function"
	      ? (fullname.local ? attrFunctionNS : attrFunction)
	      : (fullname.local ? attrConstantNS : attrConstant)))(fullname, value));
	}

	function defaultView(node) {
	  return (node.ownerDocument && node.ownerDocument.defaultView) // node is a Node
	      || (node.document && node) // node is a Window
	      || node.defaultView; // node is a Document
	}

	function styleRemove(name) {
	  return function() {
	    this.style.removeProperty(name);
	  };
	}

	function styleConstant(name, value, priority) {
	  return function() {
	    this.style.setProperty(name, value, priority);
	  };
	}

	function styleFunction(name, value, priority) {
	  return function() {
	    var v = value.apply(this, arguments);
	    if (v == null) this.style.removeProperty(name);
	    else this.style.setProperty(name, v, priority);
	  };
	}

	function selection_style(name, value, priority) {
	  return arguments.length > 1
	      ? this.each((value == null
	            ? styleRemove : typeof value === "function"
	            ? styleFunction
	            : styleConstant)(name, value, priority == null ? "" : priority))
	      : styleValue(this.node(), name);
	}

	function styleValue(node, name) {
	  return node.style.getPropertyValue(name)
	      || defaultView(node).getComputedStyle(node, null).getPropertyValue(name);
	}

	function propertyRemove(name) {
	  return function() {
	    delete this[name];
	  };
	}

	function propertyConstant(name, value) {
	  return function() {
	    this[name] = value;
	  };
	}

	function propertyFunction(name, value) {
	  return function() {
	    var v = value.apply(this, arguments);
	    if (v == null) delete this[name];
	    else this[name] = v;
	  };
	}

	function selection_property(name, value) {
	  return arguments.length > 1
	      ? this.each((value == null
	          ? propertyRemove : typeof value === "function"
	          ? propertyFunction
	          : propertyConstant)(name, value))
	      : this.node()[name];
	}

	function classArray(string) {
	  return string.trim().split(/^|\s+/);
	}

	function classList(node) {
	  return node.classList || new ClassList(node);
	}

	function ClassList(node) {
	  this._node = node;
	  this._names = classArray(node.getAttribute("class") || "");
	}

	ClassList.prototype = {
	  add: function(name) {
	    var i = this._names.indexOf(name);
	    if (i < 0) {
	      this._names.push(name);
	      this._node.setAttribute("class", this._names.join(" "));
	    }
	  },
	  remove: function(name) {
	    var i = this._names.indexOf(name);
	    if (i >= 0) {
	      this._names.splice(i, 1);
	      this._node.setAttribute("class", this._names.join(" "));
	    }
	  },
	  contains: function(name) {
	    return this._names.indexOf(name) >= 0;
	  }
	};

	function classedAdd(node, names) {
	  var list = classList(node), i = -1, n = names.length;
	  while (++i < n) list.add(names[i]);
	}

	function classedRemove(node, names) {
	  var list = classList(node), i = -1, n = names.length;
	  while (++i < n) list.remove(names[i]);
	}

	function classedTrue(names) {
	  return function() {
	    classedAdd(this, names);
	  };
	}

	function classedFalse(names) {
	  return function() {
	    classedRemove(this, names);
	  };
	}

	function classedFunction(names, value) {
	  return function() {
	    (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
	  };
	}

	function selection_classed(name, value) {
	  var names = classArray(name + "");

	  if (arguments.length < 2) {
	    var list = classList(this.node()), i = -1, n = names.length;
	    while (++i < n) if (!list.contains(names[i])) return false;
	    return true;
	  }

	  return this.each((typeof value === "function"
	      ? classedFunction : value
	      ? classedTrue
	      : classedFalse)(names, value));
	}

	function textRemove() {
	  this.textContent = "";
	}

	function textConstant(value) {
	  return function() {
	    this.textContent = value;
	  };
	}

	function textFunction(value) {
	  return function() {
	    var v = value.apply(this, arguments);
	    this.textContent = v == null ? "" : v;
	  };
	}

	function selection_text(value) {
	  return arguments.length
	      ? this.each(value == null
	          ? textRemove : (typeof value === "function"
	          ? textFunction
	          : textConstant)(value))
	      : this.node().textContent;
	}

	function htmlRemove() {
	  this.innerHTML = "";
	}

	function htmlConstant(value) {
	  return function() {
	    this.innerHTML = value;
	  };
	}

	function htmlFunction(value) {
	  return function() {
	    var v = value.apply(this, arguments);
	    this.innerHTML = v == null ? "" : v;
	  };
	}

	function selection_html(value) {
	  return arguments.length
	      ? this.each(value == null
	          ? htmlRemove : (typeof value === "function"
	          ? htmlFunction
	          : htmlConstant)(value))
	      : this.node().innerHTML;
	}

	function raise() {
	  if (this.nextSibling) this.parentNode.appendChild(this);
	}

	function selection_raise() {
	  return this.each(raise);
	}

	function lower() {
	  if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
	}

	function selection_lower() {
	  return this.each(lower);
	}

	function selection_append(name) {
	  var create = typeof name === "function" ? name : creator(name);
	  return this.select(function() {
	    return this.appendChild(create.apply(this, arguments));
	  });
	}

	function constantNull() {
	  return null;
	}

	function selection_insert(name, before) {
	  var create = typeof name === "function" ? name : creator(name),
	      select = before == null ? constantNull : typeof before === "function" ? before : selector(before);
	  return this.select(function() {
	    return this.insertBefore(create.apply(this, arguments), select.apply(this, arguments) || null);
	  });
	}

	function remove() {
	  var parent = this.parentNode;
	  if (parent) parent.removeChild(this);
	}

	function selection_remove() {
	  return this.each(remove);
	}

	function selection_datum(value) {
	  return arguments.length
	      ? this.property("__data__", value)
	      : this.node().__data__;
	}

	function dispatchEvent(node, type, params) {
	  var window = defaultView(node),
	      event = window.CustomEvent;

	  if (typeof event === "function") {
	    event = new event(type, params);
	  } else {
	    event = window.document.createEvent("Event");
	    if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
	    else event.initEvent(type, false, false);
	  }

	  node.dispatchEvent(event);
	}

	function dispatchConstant(type, params) {
	  return function() {
	    return dispatchEvent(this, type, params);
	  };
	}

	function dispatchFunction(type, params) {
	  return function() {
	    return dispatchEvent(this, type, params.apply(this, arguments));
	  };
	}

	function selection_dispatch(type, params) {
	  return this.each((typeof params === "function"
	      ? dispatchFunction
	      : dispatchConstant)(type, params));
	}

	var root = [null];

	function Selection(groups, parents) {
	  this._groups = groups;
	  this._parents = parents;
	}

	function selection() {
	  return new Selection([[document.documentElement]], root);
	}

	Selection.prototype = selection.prototype = {
	  constructor: Selection,
	  select: selection_select,
	  selectAll: selection_selectAll,
	  filter: selection_filter,
	  data: selection_data,
	  enter: selection_enter,
	  exit: selection_exit,
	  merge: selection_merge,
	  order: selection_order,
	  sort: selection_sort,
	  call: selection_call,
	  nodes: selection_nodes,
	  node: selection_node,
	  size: selection_size,
	  empty: selection_empty,
	  each: selection_each,
	  attr: selection_attr,
	  style: selection_style,
	  property: selection_property,
	  classed: selection_classed,
	  text: selection_text,
	  html: selection_html,
	  raise: selection_raise,
	  lower: selection_lower,
	  append: selection_append,
	  insert: selection_insert,
	  remove: selection_remove,
	  datum: selection_datum,
	  on: selection_on,
	  dispatch: selection_dispatch
	};

	function select(selector) {
	  return typeof selector === "string"
	      ? new Selection([[document.querySelector(selector)]], [document.documentElement])
	      : new Selection([[selector]], root);
	}

	function chartFrame(configObject) {
	  var autoPosition = false;
	  var a11yDesc = 'A graphic by the Financial Times';
	  var a11yPlotPresentation = true;
	  var a11yTitle = 'A chart';
	  var backgroundColour;
	  var containerClass = 'g-chartframe';
	  var copyright = '© FT';
	  var copyrightStyle = false;
	  var goalposts = false; // goalpost is the bit at the top and bottom of pritn charts

	  var blackbar = false; // blackbar the short black bar above web graphics

	  var whitebar = false; // whitebar the short white bar above social graphics

	  var fullYear = false;
	  var showDownloadPngButtons = false;
	  var graphicHeight = 400;
	  var graphicWidth = 500;
	  var plot;
	  var plotAdjuster = 0;
	  var rem = 18;
	  var subtitle = 'some supporting information, units perhaps';
	  var subtitleLineHeight = 20;
	  var subtitleStyle = {};
	  var source = 'Source: research';
	  var sourceLineHeight = 16;
	  var sourcePlotYOffset = 46;
	  var sourceStyle = {};
	  var title = 'Title: A description of the charts purpose';
	  var titleLineHeight = 32;
	  var titleStyle = {};
	  var watermarkLocation = 'icons.svg#ft-logo';
	  var watermarkMarkup = '';
	  var watermarkOffsetX = 40;
	  var watermarkOffsetY = 0;
	  var watermarkWidth = 124;
	  var watermarkHeight = 10;
	  var units = 'px';
	  var margin = {
	    top: 100,
	    left: 1,
	    bottom: 20,
	    right: 20
	  };
	  var subtitlePosition = {
	    x: 1,
	    y: 67
	  };
	  var sourcePosition = {
	    x: 1
	  };
	  var titlePosition = {
	    x: 1,
	    y: 30
	  };
	  var transition = 0.2;
	  var convertFrom = {
	    mm: function mm(x) {
	      return x * 2.83464480558843;
	    },
	    px: function px(x) {
	      return x;
	    }
	  };
	  var custom = {};

	  function attributeStyle(parent, style) {
	    Object.keys(style).forEach(function (attribute) {
	      parent.attr(attribute, style[attribute]);
	    });
	  }

	  function frame(p) {
	    // overall graphic properties
	    p.attr('class', containerClass).attr('font-family', 'MetricWeb,sans-serif');
	    p.attr('role', 'img');

	    if (p.node().nodeName.toLowerCase() === 'svg') {
	      p.transition(transition).attr('width', graphicWidth).attr('height', graphicHeight).attr('viewBox', ['0 0', graphicWidth, graphicHeight].join(' '));

	      if (a11yTitle !== false || title !== false) {
	        p.append('title').text(a11yTitle || title).attr('id', "".concat(containerClass, "__chart-a11y-title"));
	        p.attr('aria-labelledby', "".concat(containerClass, "__chart-a11y-title"));
	      }

	      if (a11yDesc !== false) {
	        p.append('desc').text(a11yDesc).attr('id', "".concat(containerClass, "__chart-a11y-desc"));
	        p.attr('aria-labelledby', "".concat(p.attr('aria-labelledby') ? "".concat(p.attr('aria-labelledby'), " ") : '').concat(containerClass, "__chart-a11y-desc"));
	      }
	    } // background


	    if (backgroundColour !== undefined) {
	      p.selectAll('rect.chart-background').data([backgroundColour]).enter().append('rect').attr('role', 'presentation').attr('id', 'chart-background').attr('class', 'chart-background');
	      p.selectAll('rect.chart-background').transition(transition).attr('x', 0).attr('y', 0).attr('width', graphicWidth).attr('height', graphicHeight).attr('fill', backgroundColour);
	    } // 'blackbar' (the short black bar above web graphics)


	    if (blackbar) {
	      p.append('rect').attr('width', 60).attr('height', 4).style('fill', blackbar);
	    }

	    if (whitebar) {
	      p.append('rect').attr('width', 60).attr('height', 4).style('fill', whitebar).attr('transform', "translate(".concat(margin.left, ",").concat(margin.left, ")"));
	    } // 'goalposts' (the bit at the top and the bottom of print charts)


	    if (goalposts) {
	      var goalpostPaths = ["M 0, ".concat(graphicHeight, " L ").concat(graphicWidth, ", ").concat(graphicHeight), "M 0, 15 L 0, 0 L ".concat(graphicWidth, ", 0 L ").concat(graphicWidth, ", 15")];
	      p.selectAll('path.chart-goalposts').data(goalpostPaths).enter().append('path').attr('class', 'chart-goalposts');
	      p.selectAll('path.chart-goalposts').transition(transition).attr('d', function (d) {
	        return d;
	      }).attr('stroke-width', 0.3).attr('fill', 'none').attr('stroke', goalposts);
	    }

	    var titleLineCount = title ? title.split('|').length : 0;
	    var subtitleLineCount = subtitle ? subtitle.split('|').length : 0;
	    var sourceLineCount = source ? source.split('|').length : 0; // title

	    if (title) {
	      p.selectAll('text.chart-title').data([title]).enter().append('text').attr('class', 'chart-title').attr('id', "".concat(containerClass, "title")).call(function (titleText) {
	        titleText.selectAll('tspan').data(title.split('|')).enter().append('tspan').html(function (d) {
	          return d;
	        }).attr('y', function (d, i) {
	          return titlePosition.y + i * titleLineHeight;
	        }).attr('x', titlePosition.x).call(attributeStyle, titleStyle);
	      });
	      p.selectAll('text.chart-title tspan').html(function (d) {
	        return d;
	      }).transition(transition).attr('y', function (d, i) {
	        return titlePosition.y + i * titleLineHeight;
	      }).attr('x', titlePosition.x).call(attributeStyle, titleStyle);
	    }

	    if (subtitle) {
	      // subtitle
	      p.selectAll('text.chart-subtitle').data([subtitle]).enter().append('text').attr('id', "".concat(containerClass, "subtitle")).attr('class', 'chart-subtitle').call(function (subtitleText) {
	        subtitleText.selectAll('tspan').data(subtitle.split('|')).enter().append('tspan').html(function (d) {
	          return d;
	        }).attr('id', "".concat(containerClass, "subtitle")).attr('y', function (d, i) {
	          if (titleLineCount > 1) {
	            return titlePosition.y + titleLineCount * titleLineHeight + subtitleLineHeight * i;
	          }

	          return subtitlePosition.y + i * subtitleLineHeight;
	        }).attr('x', subtitlePosition.x).call(attributeStyle, subtitleStyle);
	      });
	      p.selectAll('text.chart-subtitle tspan').html(function (d) {
	        return d;
	      }).transition(transition).attr('y', function (d, i) {
	        if (titleLineCount > 1) {
	          return titlePosition.y + titleLineCount * titleLineHeight + subtitleLineHeight * i;
	        }

	        return subtitlePosition.y + i * subtitleLineHeight;
	      }).attr('x', subtitlePosition.x).call(attributeStyle, subtitleStyle);
	    }

	    if (source) {
	      // source
	      p.selectAll('text.chart-source').data([source]).enter().append('text').attr('class', 'chart-source').attr('id', "".concat(containerClass, "source")).call(function (sourceText) {
	        sourceText.selectAll('tspan').data(source.split('|')).enter().append('tspan').html(function (d) {
	          return d;
	        }).attr('id', "".concat(containerClass, "source")).attr('y', function (d, i) {
	          if (sourcePosition.y) {
	            return sourcePosition.y + i * sourceLineHeight;
	          }

	          return graphicHeight - (margin.bottom - sourcePlotYOffset) + sourceLineHeight * 1.5 + i * sourceLineHeight;
	        }).attr('x', subtitlePosition.x).call(attributeStyle, subtitleStyle);
	      });
	      p.selectAll('text.chart-source tspan').html(function (d) {
	        return d;
	      }).transition(transition).attr('y', function (d, i) {
	        if (sourcePosition.y) {
	          return sourcePosition.y + i * sourceLineHeight;
	        }

	        return graphicHeight - (margin.bottom - sourcePlotYOffset) + sourceLineHeight * 1.5 + i * sourceLineHeight;
	      }).attr('x', sourcePosition.x).call(attributeStyle, sourceStyle);
	    } // copyright


	    if (copyrightStyle) {
	      p.selectAll('text.chart-copyright').data([copyright]).enter().append('text').attr('class', 'chart-copyright').append('tspan').html(function (d) {
	        return d;
	      }).attr('x', sourcePosition.x).attr('y', function () {
	        if (sourceLineCount > 1) {
	          return graphicHeight - (margin.bottom - sourcePlotYOffset) + sourceLineHeight * 1.125 + sourceLineCount * sourceLineHeight * 1.2;
	        }

	        return graphicHeight - (margin.bottom - sourcePlotYOffset) + sourceLineHeight * 2.5;
	      }).call(attributeStyle, copyrightStyle);
	    } // TODO figure out a way to improve this autoPosition stuff, needs ot be configurable so we don't have to reference specific classes


	    if (autoPosition && (containerClass === 'ft-printgraphic' || containerClass === 'ft-socialgraphic' || containerClass === 'ft-videographic')) {
	      margin.top = titlePosition.y + titleLineCount * titleLineHeight + subtitleLineCount * subtitleLineHeight + rem / 3;
	    } else if (autoPosition) {
	      margin.top = titlePosition.y + titleLineCount * titleLineHeight + subtitleLineCount * subtitleLineHeight + 28 - plotAdjuster;
	    } // watermark


	    p.selectAll('g.chart-watermark').data([0]).enter().append('g').attr('class', 'chart-watermark').html(watermarkMarkup).attr('role', 'presentation').attr('transform', "translate(".concat(graphicWidth - watermarkWidth - watermarkOffsetX, ",").concat(graphicHeight - watermarkHeight - watermarkOffsetY, ") scale(1) "));
	    p.selectAll('g.chart-watermark').html(watermarkMarkup).transition().attr('transform', "translate(".concat(graphicWidth - watermarkWidth - watermarkOffsetX, ",").concat(graphicHeight - watermarkHeight - watermarkOffsetY, ") scale(1) ")); // plot area (where you put the chart itself)

	    if (a11yPlotPresentation) {
	      p.selectAll('g.chart-plot').data([0]).enter().append('g').attr('class', 'chart-plot').attr('role', 'presentation') // include this extra role if a11yPlotPresentation
	      .attr('transform', "translate(".concat(margin.left, ",").concat(margin.top, ")"));
	    } else {
	      p.selectAll('g.chart-plot').data([0]).enter().append('g').attr('class', 'chart-plot').attr('transform', "translate(".concat(margin.left, ",").concat(margin.top, ")"));
	    }

	    plot = p.selectAll('g.chart-plot'); // I have no idea why this insanity even works. @TODO remove with extreme prejudice. -ae

	    plot.transition(transition).duration(0).attr('transform', "translate(".concat(margin.left, ",").concat(margin.top, ")"));

	    if (showDownloadPngButtons) {
	      var parent;

	      if (p.node().nodeName.toLowerCase() === 'svg') {
	        parent = select(p.node().parentNode);
	      } else {
	        parent = select(p.node());
	      } // Prevent this from being rendered twice


	      if (parent.selectAll('.button-holder').size() === 0) {
	        var holder = parent.append('div').attr('class', 'button-holder');
	        holder.append('button').attr('class', 'save-png-button save-png-button__1x').text('Save as .png').style('float', 'left').style('opacity', 0.6).on('click', function () {
	          return savePNG(p, 1);
	        });
	        holder.append('button').attr('class', 'save-png-button save-png-button__2x').style('float', 'left').style('opacity', 0.6).text('Save as double size .png').on('click', function () {
	          return savePNG(p, 2);
	        });
	      }
	    }
	  } // Setters and getters


	  frame.a11y = function () {
	    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
	        newTitle = _ref.title,
	        newDesc = _ref.desc;

	    if (newTitle !== undefined) a11yTitle = newTitle;
	    if (newDesc !== undefined) a11yDesc = newDesc;

	    if (newTitle === undefined && newDesc === undefined) {
	      return {
	        title: a11yTitle,
	        desc: a11yDesc
	      };
	    }

	    return frame;
	  };

	  frame.a11yDesc = function (x) {
	    if (x === undefined) return a11yDesc;
	    a11yDesc = x;
	    return frame;
	  };

	  frame.a11yPlotPresentation = function (x) {
	    if (x === undefined) return a11yPlotPresentation;
	    a11yPlotPresentation = x;
	    return frame;
	  };

	  frame.a11yTitle = function (x) {
	    if (x === undefined) return a11yTitle;
	    a11yTitle = x;
	    return frame;
	  };

	  frame.autoPosition = function (x) {
	    if (x === undefined) return autoPosition;
	    autoPosition = x;
	    return frame;
	  };

	  frame.backgroundColour = function (x) {
	    if (x === undefined) return backgroundColour;
	    backgroundColour = x;
	    return frame;
	  };

	  frame.blackbar = function (x) {
	    if (x === undefined) return blackbar;
	    blackbar = x;
	    return frame;
	  };

	  frame.containerClass = function (x) {
	    if (x === undefined) return containerClass;
	    containerClass = x;
	    return frame;
	  };

	  frame.copyright = function (x) {
	    if (x === undefined) return copyright;
	    copyright = x;
	    return frame;
	  };

	  frame.copyrightStyle = function (x) {
	    if (x === undefined) return copyrightStyle;
	    copyrightStyle = x;
	    return frame;
	  };

	  frame.dimension = function () {
	    return {
	      width: graphicWidth - (margin.left + margin.right),
	      height: graphicHeight - (margin.top + margin.bottom)
	    };
	  };

	  frame.extend = function (key, value) {
	    custom[key] = value;

	    frame[key] = function (d) {
	      if (d === undefined) return custom[key];
	      custom[key] = d;
	      return frame;
	    };

	    return frame;
	  };

	  frame.fullYear = function (x) {
	    if (x === undefined) return fullYear;
	    fullYear = x;
	    return frame;
	  };

	  frame.goalposts = function (x) {
	    if (x === undefined) return goalposts;
	    goalposts = x;
	    return frame;
	  };

	  frame.height = function (x) {
	    if (x === undefined) return graphicHeight;
	    graphicHeight = convertFrom[units](x);
	    return frame;
	  };

	  frame.margin = function (x) {
	    if (x === undefined) return margin;
	    Object.keys(x).forEach(function (k) {
	      margin[k] = x[k];
	    });
	    return frame;
	  };

	  frame.plot = function () {
	    return plot;
	  };

	  frame.plotAdjuster = function (x) {
	    if (x === undefined) return plotAdjuster;
	    plotAdjuster = x;
	    return frame;
	  };

	  frame.rem = function (x) {
	    if (x === undefined) return rem;
	    rem = x;
	    return frame;
	  };

	  frame.showDownloadPngButtons = function (d) {
	    if (typeof d === 'undefined') return showDownloadPngButtons;
	    showDownloadPngButtons = d;
	    return frame;
	  };

	  frame.source = function (x) {
	    if (x === undefined) return source;
	    source = x;
	    return frame;
	  };

	  frame.sourceLineHeight = function (x) {
	    if (x === undefined) return sourceLineHeight;
	    sourceLineHeight = x;
	    return frame;
	  };

	  frame.sourcePlotYOffset = function (x) {
	    if (x === undefined) return sourcePlotYOffset;
	    sourcePlotYOffset = x;
	    return frame;
	  };

	  frame.sourceStyle = function (x) {
	    if (x === undefined) return sourceStyle;
	    sourceStyle = x;
	    return frame;
	  };

	  frame.sourceX = function (x) {
	    if (x === undefined) return sourcePosition.x;
	    sourcePosition.x = x;
	    return frame;
	  };

	  frame.sourceY = function (x) {
	    if (x === undefined) return sourcePosition.y;
	    sourcePosition.y = x;
	    return frame;
	  };

	  frame.subtitle = function (x) {
	    if (x === undefined) return subtitle;
	    subtitle = x;
	    return frame;
	  };

	  frame.subtitleLineHeight = function (x) {
	    if (x === undefined) return subtitleLineHeight;
	    subtitleLineHeight = x;
	    return frame;
	  };

	  frame.subtitleStyle = function (x) {
	    if (x === undefined) return subtitleStyle;
	    subtitleStyle = x;
	    return frame;
	  };

	  frame.subtitleX = function (x) {
	    if (x === undefined) return subtitlePosition.x;
	    subtitlePosition.x = x;
	    return frame;
	  };

	  frame.subtitleY = function (x) {
	    if (x === undefined) return subtitlePosition.y;
	    subtitlePosition.y = x;
	    return frame;
	  };

	  frame.title = function (x) {
	    if (x === undefined) return title;
	    title = x;
	    return frame;
	  };

	  frame.titleStyle = function (x) {
	    if (x === undefined) return titleStyle;
	    titleStyle = x;
	    return frame;
	  };

	  frame.titleLineHeight = function (x) {
	    if (x === undefined) return titleLineHeight;
	    titleLineHeight = x;
	    return frame;
	  };

	  frame.titleX = function (x) {
	    if (x === undefined) return titlePosition.x;
	    titlePosition.x = x;
	    return frame;
	  };

	  frame.titleY = function (x) {
	    if (x === undefined) return titlePosition.y;
	    titlePosition.y = x;
	    return frame;
	  };

	  frame.units = function (x) {
	    if (x === undefined) return units;
	    units = x;
	    return frame;
	  };

	  frame.watermark = function (x) {
	    if (x === undefined) return watermarkMarkup;
	    watermarkLocation = '';
	    watermarkMarkup = x;
	    return frame;
	  };

	  frame.watermarkOffsetY = function (x) {
	    if (x === undefined) return watermarkOffsetY;
	    watermarkOffsetY = x;
	    return frame;
	  };

	  frame.watermarkOffsetX = function (x) {
	    if (x === undefined) return watermarkOffsetX;
	    watermarkOffsetX = x;
	    return frame;
	  };

	  frame.watermarkLocation = function (x) {
	    if (x === undefined) return watermarkLocation;
	    watermarkMarkup = '';
	    watermarkLocation = x;
	    return frame;
	  };

	  frame.watermarkWidth = function (x) {
	    if (x === undefined) return watermarkWidth;
	    watermarkWidth = x;
	    return frame;
	  };

	  frame.watermarkHeight = function (x) {
	    if (x === undefined) return watermarkHeight;
	    watermarkHeight = x;
	    return frame;
	  };

	  frame.whitebar = function (x) {
	    if (x === undefined) return whitebar;
	    whitebar = x;
	    return frame;
	  };

	  frame.width = function (x) {
	    if (!x) return graphicWidth;
	    graphicWidth = convertFrom[units](x);
	    return frame;
	  };

	  frame.attrs = function (x) {
	    if (x === undefined) {
	      return Object.assign({}, {
	        a11yDesc: a11yDesc,
	        a11yPlotPresentation: a11yPlotPresentation,
	        a11yTitle: a11yTitle,
	        autoPosition: autoPosition,
	        // axisAlign, // @FIX This is undef?
	        containerClass: containerClass,
	        copyright: copyright,
	        copyrightStyle: copyrightStyle,
	        blackbar: blackbar,
	        goalposts: goalposts,
	        graphicHeight: graphicHeight,
	        graphicWidth: graphicWidth,
	        margin: margin,
	        plot: plot,
	        plotAdjuster: plotAdjuster,
	        rem: rem,
	        subtitle: subtitle,
	        subtitleLineHeight: subtitleLineHeight,
	        subtitlePosition: subtitlePosition,
	        subtitleStyle: subtitleStyle,
	        source: source,
	        sourceLineHeight: sourceLineHeight,
	        sourcePosition: sourcePosition,
	        sourceStyle: sourceStyle,
	        title: title,
	        titleLineHeight: titleLineHeight,
	        titlePosition: titlePosition,
	        titleStyle: titleStyle,
	        watermarkLocation: watermarkLocation,
	        watermarkMarkup: watermarkMarkup,
	        watermarkOffsetX: watermarkOffsetX,
	        watermarkOffsetY: watermarkOffsetY,
	        watermarkHeight: watermarkHeight,
	        watermarkWidth: watermarkWidth,
	        whitebar: whitebar,
	        units: units
	      }, custom);
	    }

	    Object.keys(x).forEach(function (setterName) {
	      var value = x[setterName];

	      if (isFunction(frame[setterName])) {
	        frame[setterName](value);
	      }
	    });
	    return frame;
	  };

	  if (configObject !== undefined) {
	    frame.attrs(configObject);
	  }

	  return frame;
	}

	function isFunction(functionToCheck) {
	  var getType = {};
	  return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
	}

	var classes = ['.annotation', '.lines', '.highlights', '.axis path', '.axis text', '.axis line', '.axis', '.baseline', '.baseline line', '.legend', '.legend text', '.chart-goalposts', '.chart-title', '.chart-subtitle', '.chart-source', '.chart-copyright', '.chart-watermark', '.annotations-holder', '.lines highlighlines', '.highlights', '.annotation', '.annotations-holder line', '.annotations-holder text', '.line path', '.highlights rects'];

	function savePNG(svg, scaleFactor) {
	  svg.selectAll(classes.join(', ')).each(function inlineProps() {
	    var element = this;
	    var computedStyle = getComputedStyle(element, null); // loop through and compute inline svg styles

	    for (var i = 0; i < computedStyle.length; i += 1) {
	      var property = computedStyle.item(i);
	      var value = computedStyle.getPropertyValue(property);
	      element.style[property] = value;
	    }
	  });
	  saveSvgAsPng_1(svg.node(), "".concat(svg.select('title').text().replace(/\s/g, '-').toLowerCase(), ".png"), {
	    scale: scaleFactor
	  });
	}

	function webFrameS(configObject) {
	  var f = chartFrame().autoPosition(true).containerClass('ft-webgraphic-s').backgroundColour('#FFF1E0').blackbar('#000').width(300) // .watermark(watermarkPathDark)
	  // .watermarkSize(80)
	  // .watermarkOffset(-28)
	  .margin({
	    bottom: 90,
	    right: 5,
	    left: 15
	  }).rem(14).plotAdjuster(0).titleStyle({
	    'font-size': 20,
	    'font-family': 'MetricWeb,sans-serif',
	    'font-weight': 400,
	    fill: '#000'
	  }).titleY(32).titleLineHeight(24).subtitleLineHeight(20).subtitleStyle({
	    'font-size': 18,
	    'font-family': 'MetricWeb,sans-serif',
	    fill: '#66605C'
	  }).subtitleY(64).sourceLineHeight(12).sourcePlotYOffset(38).sourceStyle({
	    'font-size': '12px',
	    'font-family': 'MetricWeb,sans-serif',
	    fill: '#66605C'
	  }).copyrightStyle({
	    'font-size': '12px',
	    'font-style': 'italic',
	    'font-family': 'MetricWeb,sans-serif',
	    fill: '#66605C'
	  });
	  if (configObject !== undefined) f.attrs(configObject);
	  return f;
	}

	function webFrameM(configObject) {
	  var f = chartFrame().autoPosition(true).containerClass('ft-webgraphic-m').backgroundColour('#FFF1E0').blackbar('#000').width(700).height(500) // .watermark(watermarkPathDark)
	  // .watermarkSize(80)
	  // .watermarkOffset(-28)
	  .margin({
	    bottom: 104,
	    right: 5,
	    left: 20
	  }).rem(16).plotAdjuster(4).titleY(32).titleStyle({
	    'font-size': 24,
	    'font-family': 'MetricWeb,sans-serif',
	    'font-weight': 400,
	    fill: '#000'
	  }).titleLineHeight(28).subtitleLineHeight(20).subtitleStyle({
	    'font-size': 18,
	    'font-family': 'MetricWeb,sans-serif',
	    fill: '#66605C'
	  }).subtitleY(64).sourceLineHeight(16).sourcePlotYOffset(44).sourceStyle({
	    'font-size': '14px',
	    'font-family': 'MetricWeb,sans-serif',
	    fill: '#66605C'
	  }).copyrightStyle({
	    'font-size': '14px',
	    'font-style': 'italic',
	    'font-family': 'MetricWeb,sans-serif',
	    fill: '#66605C'
	  });
	  if (configObject !== undefined) f.attrs(configObject);
	  return f;
	}

	function webFrameMDefault(configObject) {
	  var f = chartFrame().autoPosition(true).containerClass('ft-webgraphic-m-default').backgroundColour('#FFF1E0').blackbar('#000').width(700).height(500) // .watermark(watermarkPathDark)
	  // .watermarkSize(80)
	  // .watermarkOffset(-28)
	  .margin({
	    bottom: 115,
	    right: 5,
	    left: 20
	  }).rem(20).plotAdjuster(8).titleY(32).titleStyle({
	    'font-size': 28,
	    'font-family': 'MetricWeb,sans-serif',
	    'font-weight': 400,
	    fill: '#000'
	  }).titleLineHeight(28).subtitleLineHeight(28).subtitleStyle({
	    'font-size': 24,
	    'font-family': 'MetricWeb,sans-serif',
	    fill: '#66605C'
	  }).subtitleY(68).sourceLineHeight(18).sourcePlotYOffset(34).sourceStyle({
	    'font-size': '16px',
	    'font-family': 'MetricWeb,sans-serif',
	    fill: '#66605C'
	  }).copyrightStyle({
	    'font-size': '14px',
	    'font-style': 'italic',
	    'font-family': 'MetricWeb,sans-serif',
	    fill: '#66605C'
	  });
	  if (configObject !== undefined) f.attrs(configObject);
	  return f;
	}

	function webFrameL(configObject) {
	  var f = chartFrame().autoPosition(true).containerClass('ft-webgraphic-l').backgroundColour('#FFF1E0').width(1180).height(700).blackbar('#000').fullYear(true) // .watermark(watermarkPathDark)
	  // .watermarkSize(80)
	  // .watermarkOffset(-28)
	  .margin({
	    bottom: 105,
	    right: 5,
	    left: 20
	  }).rem(18).plotAdjuster(8).titleY(32).titleStyle({
	    'font-size': 28,
	    'font-family': 'MetricWeb,sans-serif',
	    'font-weight': 400,
	    fill: '#000'
	  }).titleLineHeight(32).subtitleLineHeight(20).subtitleY(64).subtitleStyle({
	    'font-size': 18,
	    'font-family': 'MetricWeb,sans-serif',
	    fill: '#66605C'
	  }).sourceLineHeight(16).sourcePlotYOffset(44).sourceStyle({
	    'font-size': '16px',
	    'font-family': 'MetricWeb,sans-serif',
	    fill: '#66605C'
	  }).copyrightStyle({
	    'font-size': '16px',
	    'font-style': 'italic',
	    'font-family': 'MetricWeb,sans-serif',
	    fill: '#66605C'
	  });
	  if (configObject !== undefined) f.attrs(configObject);
	  return f;
	}

	function printFrame(configObject) {
	  var f = chartFrame().containerClass('ft-printgraphic').autoPosition(true).backgroundColour('#FFF').goalposts('#000').units('mm').width(112.25) // these are after the units are set so they are converted from mm to px
	  .height(68).margin({
	    top: 40,
	    left: 15,
	    bottom: 35,
	    right: 7
	  }).rem(9.6).titleStyle({
	    'font-size': '12px',
	    fill: '#000000',
	    'font-weight': '600',
	    'font-family': 'MetricWeb,sans-serif'
	  }).titleX(7).titleY(15).titleLineHeight(13).subtitleStyle({
	    fill: '#000000',
	    'font-size': '9.6px',
	    'font-weight': 400,
	    'font-family': 'MetricWeb,sans-serif'
	  }).subtitleLineHeight(10).subtitleX(7).subtitleY(27).sourceStyle({
	    fill: '#000000',
	    'font-size': '7.2px',
	    'font-weight': 400,
	    'font-family': 'MetricWeb,sans-serif'
	  }).sourceX(7).sourcePlotYOffset(18).sourceLineHeight(8);
	  if (configObject !== undefined) f.attrs(configObject);
	  return f;
	}

	var watermarkPathLight = '<path fill="#8e9095" id="logo" d="M3,8.5c0,0.7,0.2,0.9,1.5,0.9v0.4H0V9.4c0.9,0,1.2-0.1,1.2-0.8V1.4c0-0.8-0.3-0.8-1.2-0.8V0.2h6.1c0.8,0,1.1,0,1.4-0.1l0,2.7H7.2c-0.2-2-0.7-2.2-2.6-2.2H3v4h1.3c1.3,0,1.3-0.2,1.4-1.2h0.4v2.9H5.7c-0.1-1-0.2-1.2-1.4-1.2H3V8.5zM8.4,9.8V9.4c0.9,0,1.2-0.1,1.2-0.8V1.4c0-0.8-0.3-0.8-1.2-0.8V0.2h4.2v0.4c-0.9,0-1.2,0.1-1.2,0.8v7.1c0,0.8,0.3,0.8,1.2,0.8v0.4H8.4z M22,10l-6.6-8.2v6.7c0,0.8,0.5,0.9,1.5,0.9v0.4h-3.5V9.4c0.9,0,1.4-0.1,1.4-0.9V1.1c-0.4-0.4-0.7-0.5-1.4-0.5V0.2h3.1l5.1,6.5V1.5c0-0.8-0.5-0.9-1.5-0.9V0.2h3.5v0.4c-0.9,0-1.4,0.1-1.4,0.9V10H22z M26.7,9.8h-3.5V9.4c0.9,0,1.3-0.1,1.6-0.9L28,0.1h0.9l3.4,8.5c0.3,0.8,0.4,0.8,1.1,0.8v0.4h-4.1V9.4c1.2,0,1.4-0.1,1.1-0.8l-1-2.6h-3l-0.9,2.5c-0.3,0.8,0.2,0.9,1.2,0.9V9.8z M26.6,5.5h2.6L27.9,2L26.6,5.5z M42.6,10l-6.6-8.2v6.7c0,0.8,0.5,0.9,1.5,0.9v0.4H34V9.4c0.8,0,1.3-0.1,1.3-0.9V1.1c-0.5-0.4-0.8-0.5-1.6-0.5V0.2H37l5.1,6.5V1.5c0-0.8-0.5-0.9-1.5-0.9V0.2h3.5v0.4c-0.9,0-1.4,0.1-1.4,0.9V10H42.6z M52.4,0.1h0.2L52.7,3l-0.4,0c-0.2-1.7-1.1-2.5-2.7-2.5c-1.8,0-3.2,1.5-3.2,3.9c0,3,1.9,4.7,3.9,4.7c0.9,0,1.6-0.2,2.4-1.1L53,8.4c-0.6,0.9-1.8,1.6-3.5,1.6c-2.4,0-4.9-1.8-4.9-4.9c0-3,2.3-5.1,5-5.1c1.3,0,2,0.6,2.3,0.6C52.2,0.6,52.3,0.4,52.4,0.1z M53.8,9.8V9.4c0.9,0,1.2-0.1,1.2-0.8V1.4c0-0.8-0.3-0.8-1.2-0.8V0.2H58v0.4c-0.9,0-1.2,0.1-1.2,0.8v7.1c0,0.8,0.3,0.8,1.2,0.8v0.4H53.8z M61.9,9.8h-3.3V9.4c0.7,0,1.1-0.1,1.4-0.9l3.2-8.4h0.9l3.4,8.5c0.3,0.8,0.4,0.8,1.1,0.8v0.4h-4.1V9.4c1.2,0,1.4-0.1,1.1-0.8l-1-2.6h-3l-0.9,2.5c-0.3,0.8,0.2,0.9,1.2,0.9V9.8z M61.8,5.5h2.6L63,2L61.8,5.5z M69.3,9.8V9.4c0.9,0,1.2-0.1,1.2-0.8V1.4c0-0.8-0.3-0.8-1.2-0.8V0.2h4.1v0.4c-0.9,0-1.2,0.1-1.2,0.8v7.2c0,0.6,0.3,0.7,0.8,0.7h0.5c1.9,0,2.5-0.3,3-2.4L77,7l-0.3,2.9H69.3z M89.4,0.1l0,2.9h-0.4c-0.2-2.1-0.7-2.3-2.6-2.3H86v7.9c0,0.8,0.3,0.9,1.5,0.9v0.4h-4.8V9.4c1.2,0,1.5-0.1,1.5-0.9V0.6h-0.6c-1.9,0-2.3,0.3-2.6,2.3h-0.4l0-2.9c0.3,0,0.5,0.1,1.4,0.1h6C88.9,0.2,89.2,0.1,89.4,0.1z M90.4,9.8V9.4c0.9,0,1.2-0.1,1.2-0.8V1.4c0-0.8-0.3-0.8-1.2-0.8V0.2h4.2v0.4c-0.9,0-1.2,0.1-1.2,0.8v7.1c0,0.8,0.3,0.8,1.2,0.8v0.4H90.4z M107,0.2v0.4c-0.9,0-1.3,0-1.2,0.8l0.8,7.2c0.1,0.7,0.4,0.8,1.2,0.8v0.4h-4.1V9.4c0.9,0,1.2-0.1,1.1-0.8L104,1l-3.1,9h-0.1l-3-9l-0.7,7.5c-0.1,0.8,0.4,0.8,1.3,0.8v0.4h-3.2V9.4c0.9,0,1.2-0.1,1.2-0.8l0.7-7.2c0.1-0.8-0.3-0.8-1.2-0.8V0.2h3.4l2,6.6l2.2-6.6H107z M114.8,6.3h-0.4c-0.1-1-0.2-1.2-1.4-1.2h-1.5v3.5c0,0.6,0.3,0.7,0.8,0.7h0.8c1.9,0,2.5-0.3,3-2.4l0.4,0l-0.3,2.9h-7.6V9.4c0.9,0,1.2-0.1,1.2-0.8V1.4c0-0.8-0.3-0.8-1.2-0.8V0.2h7.3l0,2.4h-0.4c-0.2-1.7-0.7-1.9-2.6-1.9h-1.4v3.9h1.5c1.3,0,1.3-0.2,1.4-1.2h0.4V6.3z M122.5,7.8c0-0.9-0.6-1.3-1.5-1.9l-1.5-0.8c-1.2-0.6-1.8-1.3-1.8-2.5c0-1.5,1.3-2.7,3-2.7c1.2,0,1.8,0.6,2.1,0.6c0.2,0,0.3-0.1,0.4-0.4h0.3l0.1,2.7l-0.4,0c-0.2-1.3-1.1-2.3-2.5-2.3c-1,0-1.7,0.6-1.7,1.4c0,0.9,0.7,1.3,1.5,1.7l1.3,0.7c1.2,0.7,2.1,1.4,2.1,2.7c0,1.7-1.5,2.9-3.3,2.9c-1.3,0-1.9-0.6-2.3-0.6c-0.2,0-0.3,0.2-0.4,0.5h-0.3L117.4,7l0.4,0c0.3,1.8,1.5,2.5,2.8,2.5C121.6,9.5,122.5,9,122.5,7.8z"/>';
	var watermarkPath = {
	  light: watermarkPathLight
	};

	function socialFrame(configObject) {
	  var f = chartFrame().autoPosition(true).containerClass('ft-socialgraphic').backgroundColour('#262a33').whitebar('#fff').width(612).height(612).watermark(watermarkPath.light).watermarkOffsetX(40).watermarkOffsetY(40).margin({
	    left: 40,
	    right: 40,
	    bottom: 138,
	    top: 140
	  }).rem(24).titleX(40).titleY(80).titleLineHeight(32).titleStyle({
	    'font-size': '30px',
	    fill: '#ffffff',
	    'font-weight': 400,
	    'font-family': 'MetricWeb,sans-serif'
	  }).subtitleX(40).subtitleY(112).subtitleLineHeight(28).subtitleStyle({
	    'font-size': '24px',
	    fill: '#8e9095',
	    'font-weight': 400,
	    'font-family': 'MetricWeb,sans-serif'
	  }).sourceX(40).sourceLineHeight(20).sourcePlotYOffset(66).sourceStyle({
	    'font-size': '20px',
	    fill: '#8e9095',
	    'font-weight': 400,
	    'font-family': 'MetricWeb,sans-serif'
	  });
	  if (configObject !== undefined) f.attrs(configObject);
	  return f;
	}

	function videoFrame(configObject) {
	  var f = chartFrame().autoPosition(true).backgroundColour('#262a33').containerClass('ft-videographic').width(1920).height(1080).watermark('').margin({
	    left: 207,
	    right: 207,
	    bottom: 210,
	    top: 233
	  }).rem(48).titleX(207).titleY(130).titleLineHeight(68).titleStyle({
	    'font-size': '72px',
	    fill: '#ffffff',
	    'font-weight': 400,
	    'font-family': 'MetricWeb,sans-serif'
	  }).subtitleX(207).subtitleY(200).subtitleLineHeight(48).subtitleStyle({
	    'font-size': '48px',
	    fill: '#8e9095',
	    'font-weight': 400,
	    'font-family': 'MetricWeb,sans-serif'
	  }).sourceX(207).sourcePlotYOffset(60).sourceLineHeight(38).sourceStyle({
	    'font-size': '36px',
	    fill: '#8e9095',
	    'font-weight': 400,
	    'font-family': 'MetricWeb,sans-serif'
	  });
	  if (configObject !== undefined) f.attrs(configObject);
	  return f;
	}

	exports.frame = chartFrame;
	exports.webFrameS = webFrameS;
	exports.webFrameM = webFrameM;
	exports.webFrameMDefault = webFrameMDefault;
	exports.webFrameL = webFrameL;
	exports.printFrame = printFrame;
	exports.socialFrame = socialFrame;
	exports.videoFrame = videoFrame;

}));