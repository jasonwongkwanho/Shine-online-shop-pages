(function(window, document) {
  'use strict';

  var config = window.WS_SHOP_CONFIG || {};
  var bridgeFrame = null;
  var bridgeWindow = null;
  var bridgeTargetOrigin = '*';
  var bridgeReady = false;
  var bridgeReadyPromise = null;
  var pending = {};
  var nextRequestId = 1;

  function normalizeBaseUrl(url) {
    return String(url || '').trim().replace(/\?$/, '');
  }

  function isConfigured() {
    var url = normalizeBaseUrl(config.appsScriptWebAppUrl);
    return /^https:\/\/script\.google\.com\/macros\/s\//.test(url) && /\/exec$/.test(url);
  }

  function buildBridgeUrl() {
    var baseUrl = normalizeBaseUrl(config.appsScriptWebAppUrl);
    var separator = baseUrl.indexOf('?') === -1 ? '?' : '&';
    return baseUrl + separator + 'mode=bridge';
  }

  function isBridgeOrigin(origin) {
    return origin === 'https://script.google.com' ||
      /\.googleusercontent\.com$/.test(origin) ||
      /\.google\.com$/.test(origin);
  }

  function ensureBridge() {
    if (!isConfigured()) {
      return Promise.reject(new Error('未設定 Apps Script Web App URL。'));
    }

    if (bridgeReady) return Promise.resolve();
    if (bridgeReadyPromise) return bridgeReadyPromise;

    bridgeReadyPromise = new Promise(function(resolve, reject) {
      var timeoutMs = Number(config.requestTimeoutMs || 90000);
      var timer = window.setTimeout(function() {
        reject(new Error('連接網尚店後台逾時，請稍後再試。'));
      }, Math.min(timeoutMs, 30000));

      bridgeFrame = document.createElement('iframe');
      bridgeFrame.title = '網尚店後台連接';
      bridgeFrame.src = buildBridgeUrl();
      bridgeFrame.hidden = true;
      bridgeFrame.setAttribute('aria-hidden', 'true');
      bridgeFrame.style.display = 'none';
      document.body.appendChild(bridgeFrame);

      pending.__bridgeReady = {
        resolve: function() {
          window.clearTimeout(timer);
          bridgeReady = true;
          resolve();
        },
        reject: reject
      };
    });

    return bridgeReadyPromise;
  }

  function call(action, payload) {
    return ensureBridge().then(function() {
      return new Promise(function(resolve, reject) {
        var timeoutMs = Number(config.requestTimeoutMs || 90000);
        var requestId = 'req_' + Date.now() + '_' + nextRequestId;
        nextRequestId += 1;

        var timer = window.setTimeout(function() {
          delete pending[requestId];
          reject(new Error('後台未能在時限內回應，請不要重複提交，稍後再檢查訂單。'));
        }, timeoutMs);

        pending[requestId] = {
          resolve: resolve,
          reject: reject,
          timer: timer
        };

        (bridgeWindow || bridgeFrame.contentWindow).postMessage({
          source: 'ws-shop-pages',
          action: action,
          requestId: requestId,
          payload: payload || null
        }, bridgeTargetOrigin || '*');
      });
    });
  }

  window.addEventListener('message', function(event) {
    var data = event.data || {};
    if (!data || data.source !== 'ws-shop-bridge') return;
    if (!isBridgeOrigin(event.origin)) return;

    if (data.type === 'ready') {
      bridgeWindow = event.source || null;
      bridgeTargetOrigin = event.origin || '*';
      if (pending.__bridgeReady) {
        pending.__bridgeReady.resolve();
        delete pending.__bridgeReady;
      }
      return;
    }

    if (data.type !== 'response') return;

    var item = pending[data.requestId];
    if (!item) return;
    window.clearTimeout(item.timer);
    delete pending[data.requestId];

    if (data.success) {
      item.resolve(data.result);
    } else {
      item.reject(new Error(data.error || '後台處理失敗。'));
    }
  });

  window.ShopBackend = {
    isConfigured: isConfigured,
    getInitialData: function() {
      return call('getInitialData', null);
    },
    submitOrder: function(payload) {
      return call('submitOrder', payload);
    }
  };
})(window, document);
