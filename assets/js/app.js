var APP_DATA = {
      products: [],
      schoolPlaces: [],
      maxReceiptMb: 8,
      redirectUrl: '',
      frontendMaxQty: 20,
      paymentMethods: [],
      coupons: {}
    };
    var ACTIVE_CATEGORY = '';

    document.addEventListener('DOMContentLoaded', function() {
      applyDeviceMode();
      bindEvents();
      loadInitialData();
    });

    window.addEventListener('resize', applyDeviceMode);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', applyDeviceMode);
    }

    function applyDeviceMode() {
      var vvWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      var width = Math.min(window.innerWidth || 9999, vvWidth || 9999);
      var isTouchDevice = false;

      if (window.matchMedia) {
        isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
      }

      document.documentElement.classList.remove('device-desktop', 'device-phone');

      if (width >= 992 && !isTouchDevice) {
        document.documentElement.classList.add('device-desktop');
      } else {
        document.documentElement.classList.add('device-phone');
      }
    }

    function bindEvents() {
      document.querySelectorAll('input[name="deliveryMethod"]').forEach(function(el) {
        el.addEventListener('change', function() {
          updateDeliverySections();
          updatePaymentMethodUI();
          updateElectronicPaymentSection();
        });
      });

      document.querySelectorAll('input[name="paymentMethod"]').forEach(function(el) {
        el.addEventListener('change', function() {
          updateElectronicPaymentSection();
        });
      });

      document.querySelectorAll('input[name="pickupIsExternal"]').forEach(function(el) {
        el.addEventListener('change', updatePickupFields);
      });
    }

    function showOnlyScreen(screenId) {
      var ids = ['screenLoading', 'screenForm', 'screenProcessing', 'screenResult'];
      ids.forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        if (id === screenId) el.classList.remove('hidden');
        else el.classList.add('hidden');
      });

      if (screenId === 'screenForm') document.body.classList.remove('lock-scroll');
      else document.body.classList.add('lock-scroll');

      window.scrollTo(0, 0);
    }

    function setLoadingState(title, subtitle) {
      document.getElementById('loadingTitle').innerText = title || '資料載入中';
      document.getElementById('loadingSubtitle').innerText = subtitle || '系統正在整理最新產品與設定資料，請稍候…';
      showOnlyScreen('screenLoading');
    }

    function setProcessingState(title, subtitle) {
      document.getElementById('processingTitle').innerText = title || '訂單處理中';
      document.getElementById('processingSubtitle').innerText = subtitle || '系統正在提交資料，請稍候，請不要離開此頁面。';
      showOnlyScreen('screenProcessing');
    }

    function setResultState(mode, title, subtitle) {
      var icon = document.getElementById('resultIcon');
      var titleEl = document.getElementById('resultTitle');
      var subtitleEl = document.getElementById('resultSubtitle');
      var linkEl = document.getElementById('returnHomeLink');

      icon.className = 'state-icon ' + (mode === 'error' ? 'error' : 'success');
      icon.innerText = mode === 'error' ? '!' : '✓';
      titleEl.innerText = title || '';
      subtitleEl.innerText = subtitle || '';
      linkEl.href = APP_DATA.redirectUrl || '#';

      showOnlyScreen('screenResult');
    }

    var INITIAL_DATA_CACHE_KEY = 'ws-shop-initial-data-v1';
    var INITIAL_DATA_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

    function getDefaultInitialData() {
      return {
        products: [],
        schoolPlaces: [],
        maxReceiptMb: 8,
        redirectUrl: '',
        frontendMaxQty: 20,
        paymentMethods: [],
        coupons: {}
      };
    }

    function applyInitialData(data) {
      APP_DATA = data || getDefaultInitialData();

      document.getElementById('shopTitle').innerText = APP_DATA.shopName || '網尚店';
      document.getElementById('maxReceiptMb').innerText = APP_DATA.maxReceiptMb || 8;

      renderProducts(APP_DATA.products || []);
      renderSchoolPlaces(APP_DATA.schoolPlaces || []);
      renderPaymentProviders(APP_DATA.paymentMethods || []);

      updatePaymentMethodUI();
      updateElectronicPaymentSection();
      setMessage('', '');

      showOnlyScreen('screenForm');
    }

    function readCachedInitialData() {
      try {
        if (!window.localStorage) return null;
        var raw = window.localStorage.getItem(INITIAL_DATA_CACHE_KEY);
        if (!raw) return null;

        var cached = JSON.parse(raw);
        if (!cached || !cached.data || !cached.savedAt) return null;
        if (Date.now() - Number(cached.savedAt) > INITIAL_DATA_CACHE_MAX_AGE_MS) return null;
        if (!Array.isArray(cached.data.products)) return null;

        return cached.data;
      } catch (e) {
        return null;
      }
    }

    function writeCachedInitialData(data) {
      try {
        if (!window.localStorage) return;
        if (!data || !Array.isArray(data.products)) return;

        window.localStorage.setItem(INITIAL_DATA_CACHE_KEY, JSON.stringify({
          savedAt: Date.now(),
          data: data
        }));
      } catch (e) {
        // localStorage may be unavailable in some embedded browsers.
      }
    }

    
function loadInitialData() {
      setLoadingState('資料載入中', '系統正在整理最新產品與設定資料，請稍候…');

      if (!window.ShopBackend || !window.ShopBackend.isConfigured()) {
        setLoadingState('前台設定未完成', '❌ 請先在 site/assets/js/config.js 填入 Apps Script Web App URL。');
        return;
      }

      var cachedData = readCachedInitialData();
      var hasShownCachedData = false;
      if (cachedData) {
        try {
          applyInitialData(cachedData);
          hasShownCachedData = true;
          setMessage('正在更新最新產品資料…', 'muted');
        } catch (cachedErr) {
          console.error(cachedErr);
        }
      }

      window.ShopBackend.getInitialData()
        .then(function(data) {
          try {
            applyInitialData(data || getDefaultInitialData());
            writeCachedInitialData(APP_DATA);
          } catch (err) {
            console.error(err);
            setLoadingState('載入失敗', '❌ 前台顯示錯誤：' + (err && err.message ? err.message : err));
          }
        })
        .catch(function(err) {
          console.error(err);
          if (hasShownCachedData) {
            setMessage('暫時未能更新最新資料，已顯示上次載入資料。提交時仍會即時核對庫存。', 'error');
            return;
          }
          setLoadingState('載入失敗', '❌ 載入失敗：' + (err && err.message ? err.message : err));
        });
    }

    function getCategoryTheme(cat) {
      var map = {
        '植物選物': {
          titleBg: '#dff4e6',
          titleColor: '#205c38',
          cardBg: '#f3fbf6',
          cardBorder: '#b9e3c8'
        },
        '文創選物': {
          titleBg: '#efe5fb',
          titleColor: '#5d2f8e',
          cardBg: '#faf6ff',
          cardBorder: '#d7c3f3'
        },
        '生活護理': {
          titleBg: '#e3f0ff',
          titleColor: '#1c4f8d',
          cardBg: '#f5f9ff',
          cardBorder: '#bfd8f6'
        },
        '日常滋味': {
          titleBg: '#fff0df',
          titleColor: '#8a4f12',
          cardBg: '#fff9f2',
          cardBorder: '#f5d0a4'
        }
      };

      return map[cat] || {
        titleBg: '#eef2ff',
        titleColor: '#334155',
        cardBg: '#fafbff',
        cardBorder: '#dbe3f0'
      };
    }

    function renderProducts(products) {
      var container = document.getElementById('productContainer');
      if (!products || products.length === 0) {
        container.innerHTML = '<div class="empty">目前沒有可售產品。</div>';
        ACTIVE_CATEGORY = '';
        updateSummary();
        return;
      }

      var grouped = {};
      products.forEach(function(p) {
        var cat = p.category || '未分類';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
      });

      var categories = Object.keys(grouped);
      if (!ACTIVE_CATEGORY || !grouped[ACTIVE_CATEGORY]) {
        ACTIVE_CATEGORY = categories[0] || '';
      }
      var previewLimit = 8;

      var html = '';
      html += '<div class="product-category-tabs" role="tablist" aria-label="產品分類">';
      categories.forEach(function(cat) {
        var tabActive = cat === ACTIVE_CATEGORY;
        html += '<button type="button" class="category-tab' + (tabActive ? ' active' : '') + '" data-category="' + escapeHtml(cat) + '">'
          + escapeHtml(cat) + ' · ' + grouped[cat].length
          + '</button>';
      });
      html += '</div>';

      categories.forEach(function(cat) {
        var theme = getCategoryTheme(cat);
        var active = cat === ACTIVE_CATEGORY;

        html += '<div class="category-panel' + (active ? ' active' : '') + '" data-category-panel="' + escapeHtml(cat) + '">';
        html += '<div class="category-title" style="background:' + theme.titleBg + ';color:' + theme.titleColor + ';">' + escapeHtml(cat) + ' <span class="muted">(' + grouped[cat].length + ')</span></div>';
        html += '<div class="grid">';

        grouped[cat].forEach(function(p, idx) {
          var price = Number(p.price);
          if (!isFinite(price)) price = 0;

          var stock = Number(p.stock);
          if (!isFinite(stock)) stock = 0;

          var isPreorder = p && p.isPreorder === true;
          var usesCustomOrderLines = p && p.usesCustomOrderLines === true;

          html += ''
            + '<div class="product' + (idx >= previewLimit ? ' product-extra hidden' : '') + '" style="background:' + theme.cardBg + ';border-color:' + theme.cardBorder + ';">'
            +   '<div class="product-head">'
            +     '<div class="product-title">' + escapeHtml(p.name) + '</div>'
            +     '<div class="product-price">$' + price + '</div>'
            +   '</div>'
            +   '<div class="product-tags">'
            +     '<span class="tag">' + escapeHtml(p.code) + '</span>'
            +     (isPreorder ? '<span class="tag" style="background:#fff1df;color:#8a4f12;">只供預訂</span>' : '')
            +     (usesCustomOrderLines ? '<span class="tag" style="background:#e8f5ff;color:#135a8a;">填寫編號</span>' : '')
            +   '</div>'
            +   '<div class="product-detail-row">'
            +     (usesCustomOrderLines ? '<div class="inventory-text">請填寫編號及數量</div>' : '<div class="inventory-text">' + (isPreorder ? '需時製作，出貨時間會稍長' : '庫存量：' + stock) + '</div>')
            +   '</div>'
            +   (p.remark && !isPreorder ? '<div class="row muted">' + escapeHtml(p.remark) + '</div>' : '')
            +   (usesCustomOrderLines
                  ? '<div class="row qty-row">' + renderCustomOrderTable(p.code, p.name, price, isPreorder) + '</div>'
                  : '<div class="row qty-row"><label>數量</label>' + renderQtySelect(p.code, p.name, price, stock, isPreorder) + '</div>')
            + '</div>';
        });

        html += '</div>';
        if (grouped[cat].length > previewLimit) {
          html += '<button type="button" class="category-more-btn">顯示全部 ' + grouped[cat].length + ' 件</button>';
        }
        html += '</div>';
      });

      container.innerHTML = html;
      container.querySelectorAll('.category-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
          switchProductCategory(tab.getAttribute('data-category'));
        });
      });
      container.querySelectorAll('.category-more-btn').forEach(function(button) {
        button.addEventListener('click', function() {
          revealCategoryProducts(button);
        });
      });
      updateSummary();
    }

    function revealCategoryProducts(button) {
      var panel = button && button.closest ? button.closest('.category-panel') : null;
      if (!panel) return;

      panel.querySelectorAll('.product-extra').forEach(function(item) {
        item.classList.remove('hidden');
      });
      button.classList.add('hidden');
    }

    function switchProductCategory(category) {
      ACTIVE_CATEGORY = String(category || '').trim();

      document.querySelectorAll('.category-tab').forEach(function(tab) {
        var isActive = tab.getAttribute('data-category') === ACTIVE_CATEGORY;
        tab.classList.toggle('active', isActive);
      });

      document.querySelectorAll('.category-panel').forEach(function(panel) {
        var isActive = panel.getAttribute('data-category-panel') === ACTIVE_CATEGORY;
        panel.classList.toggle('active', isActive);
      });
    }

    function renderQtySelect(code, name, price, stock, isPreorder) {
      var frontendMaxQty = Number(APP_DATA.frontendMaxQty || 20);
      if (!isFinite(frontendMaxQty) || frontendMaxQty <= 0) frontendMaxQty = 20;

      var numericStock = Number(stock);
      if (!isFinite(numericStock) || numericStock < 0) numericStock = 0;

      var maxQty = isPreorder ? frontendMaxQty : Math.min(numericStock, frontendMaxQty);
      if (!isFinite(maxQty) || maxQty < 0) maxQty = 0;

      var html = '<select class="qty-select" data-code="' + escapeHtml(code) + '" data-name="' + escapeHtml(name) + '" data-price="' + price + '" data-is-preorder="' + (isPreorder ? 'true' : 'false') + '" onchange="updateSummary()">';
      for (var i = 0; i <= maxQty; i++) {
        html += '<option value="' + i + '">' + i + '</option>';
      }
      html += '</select>';
      return html;
    }

    function renderCustomOrderTable(code, name, price, isPreorder) {
      return ''
        + '<div class="custom-order-lines" data-code="' + escapeHtml(code) + '" data-name="' + escapeHtml(name) + '" data-price="' + price + '" data-is-preorder="' + (isPreorder ? 'true' : 'false') + '">'
        +   '<div class="custom-order-table">'
        +     '<div class="custom-order-row custom-order-head"><div>編號</div><div>數量</div><div></div></div>'
        +     '<div class="custom-order-body">'
        +       renderCustomOrderLineRow()
        +     '</div>'
        +   '</div>'
        +   '<button type="button" class="small-btn custom-add-line" onclick="addCustomOrderLine(this)">新增列</button>'
        + '</div>';
    }

    function renderCustomOrderLineRow() {
      return ''
        + '<div class="custom-order-row custom-order-input-row">'
        +   '<input type="text" class="custom-line-code" placeholder="編號" oninput="updateSummary()">'
        +   '<input type="number" class="custom-line-qty" min="0" step="1" inputmode="numeric" placeholder="0" oninput="updateSummary()">'
        +   '<button type="button" class="small-btn custom-remove-line" aria-label="刪除此列" onclick="removeCustomOrderLine(this)">×</button>'
        + '</div>';
    }

    function addCustomOrderLine(button) {
      var wrap = button && button.closest ? button.closest('.custom-order-lines') : null;
      if (!wrap) return;
      var body = wrap.querySelector('.custom-order-body');
      if (!body) return;
      body.insertAdjacentHTML('beforeend', renderCustomOrderLineRow());
      updateSummary();
    }

    function removeCustomOrderLine(button) {
      var row = button && button.closest ? button.closest('.custom-order-input-row') : null;
      var body = row && row.parentNode ? row.parentNode : null;
      if (!row || !body) return;

      if (body.querySelectorAll('.custom-order-input-row').length <= 1) {
        var codeInput = row.querySelector('.custom-line-code');
        var qtyInput = row.querySelector('.custom-line-qty');
        if (codeInput) codeInput.value = '';
        if (qtyInput) qtyInput.value = '';
      } else {
        row.parentNode.removeChild(row);
      }
      updateSummary();
    }

    function renderSchoolPlaces(places) {
      var select = document.getElementById('schoolPlace');
      select.innerHTML = '<option value="">請選擇</option>';
      (places || []).forEach(function(place) {
        var op = document.createElement('option');
        op.value = place;
        op.textContent = place;
        select.appendChild(op);
      });

      select.onchange = function() {
        var wrap = document.getElementById('schoolPlaceOtherWrap');
        if (select.value === '其他') {
          wrap.classList.remove('hidden');
        } else {
          wrap.classList.add('hidden');
          document.getElementById('schoolPlaceOther').value = '';
        }
      };
    }

    function renderPaymentProviders(methods) {
      var container = document.getElementById('paymentProviderContainer');

      if (!methods || methods.length === 0) {
        container.innerHTML = '<div class="empty">目前未設定任何可用的電子支付平台，請稍後再試或聯絡管理員。</div>';
        return;
      }

      var html = '';
      methods.forEach(function(item, idx) {
        html += ''
          + '<div class="payment-card" id="paymentCard_' + escapeHtml(item.code) + '">'
          +   '<label class="inline-item">'
          +     '<input type="radio" name="epayCode" value="' + escapeHtml(item.code) + '"' + (idx === 0 ? ' checked' : '') + ' onchange="updateSelectedPaymentInfo()">'
          +     '<span>' + escapeHtml(item.name) + '</span>'
          +   '</label>'
          + '</div>';
      });

      container.innerHTML = html;
      updateSelectedPaymentInfo();
    }

    function updateSelectedPaymentInfo() {
      var methods = APP_DATA.paymentMethods || [];
      var selectedCode = getSelectedValue('epayCode');
      var info = methods.find(function(m) { return m.code === selectedCode; }) || methods[0] || null;

      document.querySelectorAll('.payment-card').forEach(function(card) {
        card.classList.remove('active');
      });
      if (info) {
        var activeCard = document.getElementById('paymentCard_' + info.code);
        if (activeCard) activeCard.classList.add('active');
      }

      var infoBox = document.getElementById('selectedPaymentInfo');
      var nameEl = document.getElementById('selectedPaymentName');
      var noteEl = document.getElementById('selectedPaymentNote');
      var qrWrap = document.getElementById('selectedPaymentQrWrap');
      var qrImg = document.getElementById('selectedPaymentQr');

      if (!info) {
        infoBox.classList.add('hidden');
        return;
      }

      infoBox.classList.remove('hidden');
      nameEl.innerText = info.name || '';
      noteEl.innerText = info.note || '';

      if (info.qrImageUrl) {
        qrWrap.classList.remove('hidden');
        qrImg.src = info.qrImageUrl;
      } else {
        qrWrap.classList.add('hidden');
        qrImg.src = '';
      }
    }

    function updateDeliverySections() {
      var method = getSelectedValue('deliveryMethod');
      document.getElementById('sectionPickup').classList.add('hidden');
      document.getElementById('sectionSchool').classList.add('hidden');
      document.getElementById('sectionCourier').classList.add('hidden');

      if (method === '自取') {
        document.getElementById('sectionPickup').classList.remove('hidden');
      } else if (method === '校內送貨') {
        document.getElementById('sectionSchool').classList.remove('hidden');
      } else if (method === '快遞到付') {
        document.getElementById('sectionCourier').classList.remove('hidden');
      }
    }

    function updatePickupFields() {
      var isExternal = getSelectedValue('pickupIsExternal') === 'true';
      var box = document.getElementById('pickupExternalFields');
      if (isExternal) {
        box.classList.remove('hidden');
      } else {
        box.classList.add('hidden');
        document.getElementById('pickupPhone').value = '';
        document.getElementById('pickupEmail').value = '';
      }
    }

    function updatePaymentMethodUI() {
      var deliveryMethod = getSelectedValue('deliveryMethod');
      var wrap = document.getElementById('paymentMethodWrap');
      var hint = document.getElementById('courierPaymentHint');

      if (deliveryMethod === '快遞到付') {
        wrap.classList.add('hidden');
        hint.classList.remove('hidden');

        document.querySelectorAll('input[name="paymentMethod"]').forEach(function(el) {
          el.checked = (el.value === '電子支付');
        });
      } else {
        wrap.classList.remove('hidden');
        hint.classList.add('hidden');
      }
    }

    function updateElectronicPaymentSection() {
      var deliveryMethod = getSelectedValue('deliveryMethod');
      var paymentMethod = getSelectedValue('paymentMethod');

      if (deliveryMethod === '快遞到付') {
        paymentMethod = '電子支付';
      }

      var section = document.getElementById('sectionElectronicPayment');
      if (paymentMethod === '電子支付') {
        section.classList.remove('hidden');
        updateSelectedPaymentInfo();
      } else {
        section.classList.add('hidden');
        document.getElementById('receiptFile').value = '';
      }
    }

    function getCouponPreview_(subtotal) {
      var codeEl = document.getElementById('couponCode');
      var code = codeEl ? String(codeEl.value || '').trim().toUpperCase() : '';
      var amount = Math.round(Number(subtotal || 0));

      if (!code) {
        return {
          code: '',
          rate: '',
          originalAmount: amount,
          finalAmount: amount,
          discountAmount: 0,
          message: ''
        };
      }

      var coupons = APP_DATA.coupons || {};
      var rate = Number(coupons[code]);
      if (!isFinite(rate) || rate < 0 || rate > 1) {
        return {
          code: code,
          rate: '',
          originalAmount: amount,
          finalAmount: amount,
          discountAmount: 0,
          message: '優惠碼將於提交時核對；如無效，系統會拒絕提交。'
        };
      }

      var finalAmount = Math.round(amount * rate);
      return {
        code: code,
        rate: rate,
        originalAmount: amount,
        finalAmount: finalAmount,
        discountAmount: amount - finalAmount,
        message: '已套用優惠碼 ' + code + '：' + Math.round(rate * 100) + '%，折扣 $' + (amount - finalAmount)
      };
    }

    function updateSummary() {
      var inputs = document.querySelectorAll('.qty-select');
      var selectedItems = [];
      var total = 0;
      var hasPreorder = false;
      var itemCount = 0;

      inputs.forEach(function(input) {
        var qty = Number(input.value || 0);
        if (qty > 0) {
          var name = input.getAttribute('data-name');
          var price = Number(input.getAttribute('data-price') || 0);
          var isPreorder = input.getAttribute('data-is-preorder') === 'true';
          selectedItems.push({
            name: name,
            qty: qty,
            detailText: '',
            isPreorder: isPreorder
          });
          total += qty * price;
          itemCount += qty;
          if (isPreorder) hasPreorder = true;
        }
      });

      document.querySelectorAll('.custom-order-lines').forEach(function(group) {
        var name = group.getAttribute('data-name') || '';
        var price = Number(group.getAttribute('data-price') || 0);
        var isPreorder = group.getAttribute('data-is-preorder') === 'true';
        var lines = readCustomOrderRows(group, false);
        var qty = lines.reduce(function(sum, line) {
          return sum + line.qty;
        }, 0);

        if (qty > 0) {
          selectedItems.push({
            name: name,
            qty: qty,
            detailText: '編號/數量：' + formatCustomOrderRowsText(lines),
            isPreorder: isPreorder
          });
          total += qty * price;
          itemCount += qty;
          if (isPreorder) hasPreorder = true;
        }
      });

      var couponPreview = getCouponPreview_(total);

      document.getElementById('orderSummary').innerHTML = renderOrderSummaryHtml(selectedItems, itemCount, hasPreorder);
      document.getElementById('totalAmount').innerText = couponPreview.finalAmount;

      var hint = document.getElementById('couponHint');
      if (hint) hint.innerText = couponPreview.message || '';

      var submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.disabled = itemCount === 0;
      }
    }

    function renderOrderSummaryHtml(items, totalQty, hasPreorder) {
      if (!items || items.length === 0) {
        return '<div class="summary-empty">請先選擇產品</div>';
      }

      var html = ''
        + '<div class="summary-overview">'
        +   '<span class="summary-chip">已選 ' + items.length + ' 款</span>'
        +   '<span class="summary-chip">共 ' + totalQty + ' 件</span>'
        + '</div>'
        + '<div class="summary-lines">';

      items.forEach(function(item) {
        html += ''
          + '<div class="summary-line">'
          +   '<div>'
          +     '<div class="summary-line-name">' + escapeHtml(item.name) + '</div>'
          +     (item.detailText ? '<div class="summary-line-detail">' + escapeHtml(item.detailText) + '</div>' : '')
          +   '</div>'
          +   '<div class="summary-line-qty">× ' + item.qty + '</div>'
          + '</div>';
      });

      html += '</div>';
      if (hasPreorder) {
        html += '<div class="summary-note">本訂單含需時製作貨品</div>';
      }

      return html;
    }

    function readCustomOrderRows(group, strict) {
      var lines = [];
      group.querySelectorAll('.custom-order-input-row').forEach(function(row) {
        var codeInput = row.querySelector('.custom-line-code');
        var qtyInput = row.querySelector('.custom-line-qty');
        var customCode = codeInput ? String(codeInput.value || '').trim() : '';
        var rawQty = qtyInput ? String(qtyInput.value || '').trim() : '';
        var qty = Number(rawQty || 0);

        if (!customCode && !rawQty) return;

        if (strict && !customCode) {
          throw new Error('請填寫編號。');
        }

        if (!isFinite(qty) || qty <= 0 || Math.floor(qty) !== qty) {
          if (strict) {
            throw new Error('編號「' + (customCode || '未填寫') + '」的數量必須為正整數。');
          }
          return;
        }

        if (!customCode) return;

        lines.push({
          customCode: customCode,
          qty: qty
        });
      });
      return mergeCustomOrderRows(lines);
    }

    function mergeCustomOrderRows(lines) {
      var map = {};
      var order = [];
      (lines || []).forEach(function(line) {
        if (!map[line.customCode]) {
          map[line.customCode] = {
            customCode: line.customCode,
            qty: 0
          };
          order.push(line.customCode);
        }
        map[line.customCode].qty += line.qty;
      });
      return order.map(function(customCode) {
        return map[customCode];
      });
    }

    function formatCustomOrderRowsText(lines) {
      return (lines || []).map(function(line) {
        return line.customCode + ' × ' + line.qty;
      }).join('、');
    }

    function collectItems() {
      var items = [];
      document.querySelectorAll('.qty-select').forEach(function(input) {
        var qty = Number(input.value || 0);
        if (qty > 0) {
          items.push({
            code: input.getAttribute('data-code'),
            qty: qty
          });
        }
      });

      document.querySelectorAll('.custom-order-lines').forEach(function(group) {
        var lines = readCustomOrderRows(group, true);
        var qty = lines.reduce(function(sum, line) {
          return sum + line.qty;
        }, 0);

        if (qty > 0) {
          items.push({
            code: group.getAttribute('data-code'),
            qty: qty,
            detailLines: lines
          });
        }
      });

      return items;
    }

    function readFileAsDataUrl(file) {
      return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function(e) {
          resolve(e.target.result);
        };
        reader.onerror = function() {
          reject(new Error('讀取付款單據失敗'));
        };
        reader.readAsDataURL(file);
      });
    }

    async function submitOrderForm() {
      setMessage('', '');
      updateSummary();

      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }

      var deliveryMethod = getSelectedValue('deliveryMethod');
      var paymentMethod = getSelectedValue('paymentMethod');

      if (deliveryMethod === '快遞到付') {
        paymentMethod = '電子支付';
      }

      var payload = {
        deliveryMethod: deliveryMethod,
        paymentMethod: paymentMethod,

        pickupCustomerName: val('pickupCustomerName'),
        pickupIsExternal: getSelectedValue('pickupIsExternal') === 'true',
        pickupPhone: val('pickupPhone'),
        pickupEmail: val('pickupEmail'),

        schoolCustomerName: val('schoolCustomerName'),
        schoolPlace: val('schoolPlace'),
        schoolPlaceOther: val('schoolPlaceOther'),

        courierRecipientName: val('courierRecipientName'),
        courierPhone: val('courierPhone'),
        courierEmail: val('courierEmail'),
        courierAddress: val('courierAddress'),
        courierRemark: val('courierRemark'),
        customerNote: val('customerNote'),

        epayCode: getSelectedValue('epayCode'),
        couponCode: val('couponCode'),

        items: [],
        receiptName: '',
        receiptType: '',
        receiptData: ''
      };

      try {
        payload.items = collectItems();
      } catch (err) {
        setResultState('error', '提交失敗', err && err.message ? err.message : String(err));
        return;
      }

      document.getElementById('submitBtn').disabled = true;

      setTimeout(function() {
        setProcessingState('訂單處理中', '系統正在提交資料，請稍候，請不要離開此頁面。');
      }, 30);

      try {
        if (paymentMethod === '電子支付') {
          var fileInput = document.getElementById('receiptFile');
          var file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

          if (!file) {
            document.getElementById('submitBtn').disabled = false;
            setResultState('error', '提交失敗', '電子支付：必須先上載付款單據。');
            return;
          }

          var fileType = String(file.type || '').toLowerCase();
          var isAllowed = false;
          if (fileType.indexOf('image/') === 0) isAllowed = true;
          if (fileType === 'application/pdf') isAllowed = true;

          if (!isAllowed) {
            document.getElementById('submitBtn').disabled = false;
            setResultState('error', '提交失敗', '付款單據格式只支援圖片或 PDF。');
            return;
          }

          var maxMb = Number(APP_DATA.maxReceiptMb || 8);
          if (file.size > maxMb * 1024 * 1024) {
            document.getElementById('submitBtn').disabled = false;
            setResultState('error', '提交失敗', '付款單據檔案過大，請控制在 ' + maxMb + 'MB 內。');
            return;
          }

          payload.receiptName = file.name || 'receipt';
          payload.receiptType = file.type || 'image/png';
          payload.receiptData = await readFileAsDataUrl(file);
        }

        window.ShopBackend.submitOrder(payload)
          .then(function(res) {
            document.getElementById('submitBtn').disabled = false;

            if (res && res.success) {
              var resultText = '你的訂單已處理完成。訂單編號：' + res.orderNo + '，總金額：$' + res.totalAmount + '。';
              if (res.couponCode) {
                resultText += ' 已套用優惠碼：' + res.couponCode + '，折扣：$' + res.discountAmount + '。';
              }
              resultText += ' 請按下方按鈕返回主頁。';

              setResultState(
                'success',
                '訂單已成功提交',
                resultText
              );
            } else {
              setResultState(
                'error',
                '提交失敗',
                ((res && res.message) ? res.message : '系統未能完成提交，請稍後再試。') + ' 請按下方按鈕返回主頁。'
              );
            }
          })
          .catch(function(err) {
            document.getElementById('submitBtn').disabled = false;
            setResultState(
              'error',
              '提交失敗',
              '系統發生錯誤：' + (err && err.message ? err.message : err) + ' 請按下方按鈕返回主頁。'
            );
          });

      } catch (err) {
        document.getElementById('submitBtn').disabled = false;
        setResultState(
          'error',
          '提交失敗',
          '系統發生錯誤：' + (err && err.message ? err.message : err) + ' 請按下方按鈕返回主頁。'
        );
      }
    }

    function val(id) {
      var el = document.getElementById(id);
      return el ? String(el.value || '').trim() : '';
    }

    function getSelectedValue(name) {
      var checked = document.querySelector('input[name="' + name + '"]:checked');
      return checked ? checked.value : '';
    }

    function setMessage(text, cls) {
      var box = document.getElementById('msgBox');
      box.className = 'row ' + (cls || '');
      box.textContent = text || '';
    }

    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
