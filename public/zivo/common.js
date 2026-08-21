// ============================================
// ZIVO Mobile App - Common JavaScript
// ============================================
// 170개+ HTML이 공유하는 단일 진실 공급원.
// 바텀 내비·헤더·유틸은 여기서 관리한다.

window.Zivo = window.Zivo || {};

// --------------------------------------------
// Tab switch with scroll position preservation
// --------------------------------------------
// 홈 탭 전환 시 스크롤 상태 유지
// switchTab('medical/05-hospital.html') → docked 상태면 ?docked=1 붙여서 이동
// 새 페이지에서 ?docked=1 감지 → 탭 위치까지 즉시 스크롤
Zivo.switchTab = function (href) {
  var tabNav = document.querySelector('.tab-navigation');
  var isDocked = tabNav && tabNav.classList.contains('docked');
  location.href = href + (isDocked ? '?docked=1' : '');
};

(function () {
  if (location.search.indexOf('docked=1') === -1) return;
  var tryScroll = function () {
    var tabNav = document.querySelector('.tab-navigation');
    if (!tabNav) return;
    var rect = tabNav.getBoundingClientRect();
    var headerH = 52;
    if (rect.top > headerH) {
      window.scrollTo(0, window.scrollY + rect.top - headerH);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryScroll);
  } else {
    tryScroll();
  }
})();

// --------------------------------------------
// Navigation utilities
// --------------------------------------------
// Zivo.back('medical/04-home.html') — history 있으면 back(), 없으면 fallback 페이지로 이동
// 딥링크/새로고침/QR 진입 시 "뒤로가기가 먹통" 버그 방지
Zivo.back = function (fallback) {
  if (window.history.length > 1 && document.referrer) {
    window.history.back();
  } else if (fallback) {
    window.location.href = fallback;
  } else {
    window.history.back();
  }
};

// --------------------------------------------
// Bottom Navigation (5 tabs)
// --------------------------------------------
// 사용법: 페이지에 <div id="bottom-nav-root"></div> 두고
//   Zivo.renderBottomNav('home', { labels: { home: '홈', ... } })
// labels 생략 시 영어 기본. basePath 지정 시 서브폴더에서도 동작.
(function () {
  const NAV_ITEMS = [
    { key: 'home',   href: 'medical/04-home.html',              icon: 'home',           label: 'Home' },
    { key: 'map',    href: 'map-v2/index.html',         icon: 'map',            label: 'Map' },
    { key: 'recent', href: '14-recent.html',            icon: 'history',        label: 'Recent' },
    { key: 'taxi',   href: 'taxi/passenger-zivo/01-main.html', icon: 'local_taxi', label: 'Taxi' },
    { key: 'my',     href: 'mypage/15-mypage.html',            icon: 'account_circle', label: 'My' }
  ];

  Zivo.renderBottomNav = function (activeKey, options) {
    options = options || {};
    const labels = options.labels || {};
    const basePath = options.basePath || '';
    const root = document.getElementById('bottom-nav-root');
    if (!root) return;

    const nav = document.createElement('nav');
    nav.className = 'bottom-nav';
    nav.innerHTML = NAV_ITEMS.map(function (item) {
      const isActive = item.key === activeKey;
      const iconSrc = basePath + 'images/icons/' + item.icon + (isActive ? '_ac' : '') + '.svg';
      const label = labels[item.key] || item.label;
      const activeClass = isActive ? ' active' : '';
      return '<a href="' + basePath + item.href + '" class="bottom-nav-item' + activeClass + '">'
        + '<img src="' + iconSrc + '" alt="" class="bottom-nav-icon">'
        + '<div class="bottom-nav-label">' + label + '</div>'
        + '</a>';
    }).join('');
    root.replaceWith(nav);
  };
})();

// --------------------------------------------
// Standard Header (back + title + optional right slot)
// --------------------------------------------
// 사용법: 페이지에 <div id="header-root"></div> 두고
//   Zivo.renderHeader({ title: '설정', back: true })
//   Zivo.renderHeader({ title: '리뷰', back: 'medical/07-hospital-detail.html' })
//   Zivo.renderHeader({ title: '예약', rightSlot: '<button ...>자동입력</button>' })
Zivo.renderHeader = function (config) {
  config = config || {};
  const root = document.getElementById('header-root');
  if (!root) return;

  const title = config.title || '';
  const titleId = config.titleId ? ' id="' + config.titleId + '"' : '';
  const back = config.back === undefined ? true : config.back;
  const home = config.home !== false;
  const rightSlot = config.rightSlot || '';
  const border = config.border === true;
  // 홈/뒤로 fallback 경로 — 하위 폴더 페이지는 homePath로 기준 경로를 넘겨 정상화 (미지정 시 기존 동작 유지)
  const homePath = config.homePath || 'medical/04-home.html';

  let backBtn = '';
  if (back) {
    const onclick = back === true
      ? "Zivo.back('" + homePath + "')"
      : "location.href='" + back + "'";
    backBtn = '<button class="back-btn icon-btn" onclick="' + onclick + '" aria-label="Back">'
      + '<span class="material-symbols-rounded">arrow_back</span>'
      + '</button>';
  } else {
    backBtn = '<div style="width: 36px;"></div>';
  }

  const homeBtn = home
    ? '<button class="header-icon-btn icon-btn icon-btn--narrow" onclick="location.href=\'' + homePath + '\'" aria-label="Home">'
      + '<span class="material-symbols-rounded">home</span>'
      + '</button>'
    : '';

  const rightContent = rightSlot + homeBtn;
  const rightHtml = rightContent || '<div style="width: 44px;"></div>';

  const header = document.createElement('header');
  header.className = 'header';
  if (border) header.style.borderBottom = '1px solid var(--gray-200)';
  header.innerHTML = backBtn
    + '<h1 class="header-title"' + titleId + '>' + title + '</h1>'
    + '<div class="header-right" style="display:flex;align-items:center;">' + rightHtml + '</div>';
  root.replaceWith(header);
};

// --------------------------------------------
// Search Header (검색 입력 헤더)
// --------------------------------------------
// 사용법: <div id="search-header-root"></div>
//   Zivo.renderSearchHeader({ placeholder: '병원 시술 검색', inputId: 'searchInput' })
Zivo.renderSearchHeader = function (config) {
  config = config || {};
  const root = document.getElementById('search-header-root');
  if (!root) return;

  const placeholder = config.placeholder || 'Search';
  const inputId = config.inputId || 'searchInput';
  const clearId = config.clearId || 'clearBtn';
  const clearOnclick = config.clearOnclick ? ' onclick="' + config.clearOnclick + '"' : '';
  const basePath = config.basePath || '';
  // 하위 폴더 페이지의 뒤로가기 fallback 경로 (미지정 시 기존 동작 유지)
  const homePath = config.homePath || 'medical/04-home.html';
  const inputOninput = config.oninput ? ' oninput="' + config.oninput + '"' : '';
  const clearIcon = config.clearIcon || 'close';

  const wrap = document.createElement('div');
  wrap.className = 'search-header';
  wrap.innerHTML =
      '<button class="back-btn icon-btn" onclick="Zivo.back(\'' + homePath + '\')" aria-label="Back">'
    + '<span class="material-symbols-rounded">arrow_back</span>'
    + '</button>'
    + '<div class="search-input-wrapper">'
    + '<img src="' + basePath + 'images/icons/search.svg" alt="" class="search-icon">'
    + '<input type="text" class="search-input" placeholder="' + placeholder + '" id="' + inputId + '" autofocus' + inputOninput + '>'
    + '<button class="clear-btn" id="' + clearId + '"' + clearOnclick + '>'
    + '<span class="material-symbols-rounded">' + clearIcon + '</span>'
    + '</button>'
    + '</div>';
  root.replaceWith(wrap);
};

// --------------------------------------------
// Chat Header (채팅방 헤더)
// --------------------------------------------
// 사용법: <div id="chat-header-root"></div>
//   Zivo.renderChatHeader({ hospitalName: '청담 스타의원', actionLabel: '예약요청하기', actionOnclick: 'createBookingRequest()' })
Zivo.renderChatHeader = function (config) {
  config = config || {};
  const root = document.getElementById('chat-header-root');
  if (!root) return;

  const name = config.hospitalName || '';
  const subtitle = config.subtitle || '';
  const avatarUrl = config.avatarUrl || '';
  const actionLabel = config.actionLabel || '';
  const actionOnclick = config.actionOnclick || '';
  const actionClass = config.actionClass || 'booking-btn';

  const wrap = document.createElement('div');
  wrap.className = 'chat-header';
  let actionBtn = '';
  if (actionLabel) {
    actionBtn = '<button class="' + actionClass + '"'
      + (actionOnclick ? ' onclick="' + actionOnclick + '"' : '')
      + '>' + actionLabel + '</button>';
  }
  let avatarHtml = '';
  if (avatarUrl) {
    avatarHtml = '<div class="chat-avatar"><img src="' + avatarUrl + '" alt="" onerror="this.outerHTML=&quot;<span class=\\&quot;material-symbols-rounded\\&quot;>local_hospital</span>&quot;"></div>';
  }
  let subtitleHtml = '';
  if (subtitle) {
    subtitleHtml = '<div class="hospital-subtitle">' + subtitle + '</div>';
  }
  wrap.innerHTML = '<div class="header-top">'
    + '<button class="back-btn icon-btn" onclick="Zivo.back(\'27-chat-list.html\')" aria-label="Back">'
    + '<span class="material-symbols-rounded">arrow_back</span>'
    + '</button>'
    + '<div class="hospital-info">' + avatarHtml + '<div class="hospital-details"><div class="hospital-name">' + name + '</div>' + subtitleHtml + '</div></div>'
    + actionBtn
    + '</div>';
  root.replaceWith(wrap);
};

// --------------------------------------------
// Scroll Shadow Effect for Headers and Tabs
// --------------------------------------------
(function() {
  window.addEventListener('DOMContentLoaded', function() {
    const stickyHeader = document.querySelector('.sticky-header');
    const header = document.querySelector('.header');
    const chatHeader = document.querySelector('.chat-header');
    const tabs = document.querySelector('.review-tabs, .booking-tabs, .header-tabs, .sheet-tabs, .tab-navigation, .tab-container[role="tablist"]');

    // Only add listener if any element exists
    if (stickyHeader || header || chatHeader || tabs) {
      window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        if (scrollTop > 0) {
          // Priority 1: If sticky-header exists, only add shadow to it
          if (stickyHeader) {
            stickyHeader.classList.add('scrolled');
          }
          // Priority 2: If chat-header exists, add shadow to it
          else if (chatHeader) {
            chatHeader.classList.add('scrolled');
          }
          // Priority 3: If both header and tabs exist, only add shadow to tabs (avoid double shadow)
          else if (header && tabs) {
            tabs.classList.add('scrolled');
          }
          // Priority 4: If only header exists, add shadow to header
          else if (header) {
            header.classList.add('scrolled');
          }
          // Priority 5: If only tabs exist, add shadow to tabs
          else if (tabs) {
            tabs.classList.add('scrolled');
          }
        } else {
          // Remove shadow when at top
          if (stickyHeader) stickyHeader.classList.remove('scrolled');
          if (chatHeader) chatHeader.classList.remove('scrolled');
          if (header) header.classList.remove('scrolled');
          if (tabs) tabs.classList.remove('scrolled');
        }
      });
    }
  });
})();

// --------------------------------------------
// Bottom Sheet Open/Close Helpers
// 사용법:
//   Zivo.openSheet('sortBottomSheet', 'sortOverlay')
//   Zivo.closeSheet('sortBottomSheet', 'sortOverlay')
//   Zivo.toggleSheet('sortBottomSheet', 'sortOverlay')
// --------------------------------------------
Zivo.openSheet = function (sheetId, overlayId) {
  const sheet = document.getElementById(sheetId);
  const overlay = overlayId ? document.getElementById(overlayId) : null;
  if (sheet) sheet.classList.add('show');
  if (overlay) overlay.classList.add('show');
};

Zivo.closeSheet = function (sheetId, overlayId) {
  const sheet = document.getElementById(sheetId);
  const overlay = overlayId ? document.getElementById(overlayId) : null;
  if (sheet) sheet.classList.remove('show');
  if (overlay) overlay.classList.remove('show');
};

Zivo.toggleSheet = function (sheetId, overlayId) {
  const sheet = document.getElementById(sheetId);
  if (!sheet) return;
  if (sheet.classList.contains('show')) {
    Zivo.closeSheet(sheetId, overlayId);
  } else {
    Zivo.openSheet(sheetId, overlayId);
  }
};

// --------------------------------------------
// Zivo.renderPaySheet — 공용 결제수단 선택 바텀시트
//   사용처: esim/hotel/qr-order 결제 화면 (이미지 경로는 각 페이지의 images/ 기준 상대경로)
//   결제하기 버튼:  onclick="Zivo.openPaySheet()"
//   페이지 스크립트: Zivo.renderPaySheet({ onConfirm: function (method) { ... } })
//     - card 이미지: images/credit-card.png, alipay+ : images/alipay-plus.png
//     - 월렛 로고:   images/wallets/*.png
// --------------------------------------------
(function () {
  var WALLETS = [
    ['alipay', 'Alipay'], ['gcash', 'GCash'], ['dana', 'DANA'], ['alipay-hk', 'AlipayHK'],
    ['boost', 'Boost'], ['rabbit-line-pay', 'Rabbit LINE Pay'], ['bpi', 'BPI'],
    ['billease', 'BillEase'], ['bluecode', 'Bluecode'], ['mpay', 'MPay'],
    ['kplus', 'KPlus'], ['kredivo', 'Kredivo'], ['tinaba', 'Tinaba']
  ];

  var paySheet, payBackdrop, payConfirmBtn, payOptions;
  var selectedMethod = null;
  var onConfirmCb = function () {};

  Zivo.renderPaySheet = function (config) {
    config = config || {};
    onConfirmCb = config.onConfirm || function () {};
    if (document.getElementById('paySheet')) return; // 중복 주입 방지

    var walletHtml = WALLETS.map(function (w) {
      return '<span class="pay-coverage-item"><img src="images/wallets/' + w[0] + '.png" alt="' + w[1] + '"></span>';
    }).join('');

    var html =
      '<div class="modal-backdrop" id="payBackdrop"></div>' +
      '<div class="bottom-sheet" id="paySheet" role="dialog" aria-modal="true" aria-label="결제수단 선택">' +
        '<div class="bottom-sheet-handle"></div>' +
        '<div class="bottom-sheet-title">결제수단 선택</div>' +
        '<div class="pay-sheet-body">' +
          '<div class="pay-method-list">' +
            '<div class="pay-option" data-method="card">' +
              '<div class="pay-method-row" role="button" tabindex="0" aria-pressed="false">' +
                '<div class="pay-radio"><div class="pay-radio-dot"></div></div>' +
                '<div class="pay-logo-box"><img src="images/credit-card.png" alt="신용/체크카드"></div>' +
                '<div class="pay-method-info"><div class="pay-method-name">신용 / 체크카드</div></div>' +
              '</div>' +
            '</div>' +
            '<div class="pay-option" data-method="alipay">' +
              '<div class="pay-method-row" role="button" tabindex="0" aria-pressed="false">' +
                '<div class="pay-radio"><div class="pay-radio-dot"></div></div>' +
                '<div class="pay-logo-box"><img src="images/alipay-plus.png" alt="Alipay+"></div>' +
                '<div class="pay-method-info"><div class="pay-method-name">알리페이+</div></div>' +
              '</div>' +
              '<div class="pay-coverage">' +
                '<div class="pay-coverage-note">아래 월렛으로 결제할 수 있어요</div>' +
                '<div class="pay-coverage-grid">' + walletHtml + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button class="btn btn-primary btn-lg pay-confirm-btn" id="payConfirmBtn" disabled>확인</button>' +
      '</div>';

    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

    paySheet = document.getElementById('paySheet');
    payBackdrop = document.getElementById('payBackdrop');
    payConfirmBtn = document.getElementById('payConfirmBtn');
    payOptions = document.querySelectorAll('.pay-option');

    payBackdrop.addEventListener('click', Zivo.closePaySheet);

    payOptions.forEach(function (opt) {
      var row = opt.querySelector('.pay-method-row');
      function select() {
        payOptions.forEach(function (o) {
          o.classList.remove('selected');
          o.querySelector('.pay-method-row').setAttribute('aria-pressed', 'false');
        });
        opt.classList.add('selected');
        row.setAttribute('aria-pressed', 'true');
        selectedMethod = opt.getAttribute('data-method');
        payConfirmBtn.disabled = false;
      }
      row.addEventListener('click', select);
      row.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
      });
    });

    payConfirmBtn.addEventListener('click', function () {
      if (!selectedMethod) return;
      onConfirmCb(selectedMethod);
    });
  };

  Zivo.openPaySheet = function () {
    if (payBackdrop) payBackdrop.classList.add('show');
    if (paySheet) paySheet.classList.add('show');
  };

  Zivo.closePaySheet = function () {
    if (payBackdrop) payBackdrop.classList.remove('show');
    if (paySheet) paySheet.classList.remove('show');
  };
})();
