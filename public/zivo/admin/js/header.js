/**
 * ZIVO Admin - Header Component
 * 모든 어드민 페이지에서 공통으로 사용하는 헤더
 */

(function() {
  // Page titles mapping
  const pageTitles = {
    'dashboard': '대시보드',
    'settings': '운영정보',
    'account-login': '계정/로그인',
    'user-management': '일반회원 관리',
    'user-detail': '회원 상세',
    'hospital-application': '입점신청 관리',
    'category-management': '카테고리 관리',
    'product-list': '상품 목록',
    'product-registration': '상품 등록',
    'review-management': '리뷰 관리',
    'chat-inquiry': '채팅 문의',
    'chat-detail': '채팅 상세',
    'booking-management': '예약 관리',
    'booking-detail': '예약 상세',
    // 2026-04-20: 구 택시 페이지 _concept-draft/admin-taxi-legacy/로 이동, 매핑 보류
    // 'taxi-settlement': '탑승 관리',
    // 'taxi-completed': '탑승 완료',
    // 'taxi-cancelled-before': '탑승전 취소',
    // 'taxi-settlement-history': '정산 관리',
    // 'taxi-ride-detail': '탑승 상세',
    'notice-user': '공지사항 (사용자)',
    'notice-partner': '공지사항 (파트너)',
    'inquiry-user': '1:1 문의',
    'pricing-plan': '비즈니스 관리',
    'pricing-settlement': '요금제 정산',
    'point-settlement': '포인트 정산',
  };

  function getHeaderHTML(pageTitle) {
    return `
      <header class="header main-header" id="mainHeader">
        <div class="header-left">
          <a href="dashboard.html" class="header-logo">
            <img src="assets/images/zivo-logo.svg" alt="ZIVO" class="header-logo-img">
            <span class="header-logo-divider"></span>
            <span class="header-logo-label">Partner Center</span>
          </a>
        </div>
        <div class="header-right">
          <button class="header-icon-btn">
            <span class="material-symbols-rounded">notifications</span>
            <span class="notification-dot"></span>
          </button>
          <div class="header-divider"></div>
          <div class="header-user">
            <div class="header-user-avatar">A</div>
            <div class="header-user-info">
              <span class="header-user-name">admin@zivo.com</span>
              <span class="header-user-role">슈퍼 관리자</span>
            </div>
            <span class="material-symbols-rounded header-user-arrow">expand_more</span>
          </div>
        </div>
      </header>
    `;
  }

  // Header CSS (notification dot, user info)
  const headerCSS = `
    .main-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .main-header.sidebar-collapsed {
      left: 0;
    }

    .header-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
    }

    .header-logo-img {
      height: 22px;
      width: auto;
    }

    .header-logo-divider {
      width: 1px;
      height: 20px;
      background-color: var(--gray-300);
    }

    .header-logo-label {
      font-size: var(--font-size-sm);
      font-weight: 700;
      color: var(--gray-900);
      white-space: nowrap;
    }

    .header-divider {
      width: 1px;
      height: 12px;
      background-color: var(--gray-200);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
      border-radius: var(--radius-md);
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color 0.2s;
    }

    .header-icon-btn:hover {
      background-color: var(--gray-100);
    }

    .header-icon-btn .material-symbols-rounded {
      font-size: 22px;
      color: var(--gray-600);
    }

    .notification-dot {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 8px;
      height: 8px;
      background-color: var(--error);
      border-radius: 50%;
      border: 2px solid var(--white);
    }

    .header-user {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: var(--radius-md);
      transition: background-color 0.2s;
    }

    .header-user:hover {
      background-color: var(--gray-100);
    }

    .header-user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: var(--primary-pale);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--font-size-sm);
      font-weight: 700;
      color: var(--primary-color);
    }

    .header-user-info {
      display: flex;
      flex-direction: column;
    }

    .header-user-name {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--gray-900);
      line-height: 1.2;
    }

    .header-user-role {
      font-size: 11px;
      color: var(--gray-500);
      line-height: 1.2;
    }

    .header-user-arrow {
      font-size: 18px;
      color: var(--gray-400);
    }

    .page-header {
      margin-bottom: 24px;
    }

    .page-title {
      font-size: 24px;
      font-weight: 600;
      color: var(--gray-900);
      margin: 0;
    }
  `;

  // Initialize
  document.addEventListener('DOMContentLoaded', function() {
    // Inject CSS
    const styleEl = document.createElement('style');
    styleEl.textContent = headerCSS;
    document.head.appendChild(styleEl);

    // Find container (app-layout or admin-container) - insert header before main-content
    const container = document.querySelector('.app-layout') || document.querySelector('.admin-container');
    const mainContent = document.querySelector('.main-content');
    if (!container) return;

    // Check if header already exists
    if (document.getElementById('mainHeader')) return;

    // Get current page
    const currentPage = document.body.dataset.page ||
      window.location.pathname.split('/').pop().replace('.html', '');

    // Get page title from data attribute or mapping
    const pageTitle = document.body.dataset.title ||
      pageTitles[currentPage] ||
      '관리자';

    // Insert header - before main-content if exists, otherwise at start of container
    if (mainContent) {
      mainContent.insertAdjacentHTML('beforebegin', getHeaderHTML(pageTitle));
    } else {
      container.insertAdjacentHTML('afterbegin', getHeaderHTML(pageTitle));
    }

    // Insert page title in content area (except for special pages)
    const skipTitlePages = ['chat-detail', 'product-list', 'product-display'];
    if (!skipTitlePages.includes(currentPage)) {
      const mainBody = document.querySelector('.main-body');
      const pageTitleHTML = `
        <div class="page-header">
          <h1 class="page-title">${pageTitle}</h1>
        </div>
      `;

      if (mainBody) {
        mainBody.insertAdjacentHTML('afterbegin', pageTitleHTML);
      } else if (mainContent) {
        mainContent.insertAdjacentHTML('afterbegin', pageTitleHTML);
      }
    }
  });
})();
