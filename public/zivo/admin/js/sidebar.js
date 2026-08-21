/**
 * ZIVO Admin - Sidebar Component
 * 모든 어드민 페이지에서 공통으로 사용하는 사이드바
 */

(function() {
  // Sidebar CSS (injected dynamically)
  const sidebarCSS = `
    #sidebar {
      width: 220px;
      background-color: var(--gray-900);
      position: fixed;
      top: 56px;
      left: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      z-index: 90;
      transition: width 0.3s ease;
    }

    #sidebar.collapsed {
      width: 64px !important;
      opacity: 1 !important;
      visibility: visible !important;
      transform: none !important;
    }

    /* 접힌 상태: 아이콘만 표시 */
    #sidebar.collapsed .nav-link {
      justify-content: center;
      padding: 12px;
    }

    #sidebar.collapsed .nav-item > .nav-link > span:not(.material-symbols-rounded),
    #sidebar.collapsed .nav-item > .submenu-toggle > span:not(.material-symbols-rounded) {
      display: none !important;
    }

    #sidebar.collapsed .nav-arrow {
      display: none !important;
    }

    #sidebar.collapsed .nav-submenu {
      display: none !important;
    }

    #sidebar.collapsed .has-submenu > .submenu-toggle {
      justify-content: center;
      padding: 12px;
    }

    #sidebar.collapsed .sidebar-footer {
      padding: 12px;
      background-color: var(--gray-900);
    }

    #sidebar.collapsed .sidebar-toggle-btn {
      justify-content: center;
      padding: 12px;
    }

    #sidebar.collapsed .sidebar-toggle-btn span:not(.material-symbols-rounded) {
      display: none !important;
    }

    #sidebar .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 12px 0;
    }

    #sidebar.collapsed .sidebar-nav {
      overflow: visible;
    }

    #sidebar .nav-item {
      margin-bottom: 0;
    }

    #sidebar .nav-link {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      margin: 0 8px;
      border-radius: var(--radius-md);
      color: var(--gray-400);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    #sidebar .nav-link:hover {
      background-color: var(--gray-800);
      color: var(--white);
    }

    #sidebar .nav-link.active {
      background-color: var(--primary-color);
      color: var(--white);
    }

    #sidebar .nav-link .material-symbols-rounded {
      font-size: 20px;
    }

    #sidebar .nav-arrow {
      margin-left: auto;
      transition: transform 0.3s;
    }

    #sidebar .nav-item.open > .nav-link .nav-arrow,
    #sidebar .nav-item.open > .submenu-toggle .nav-arrow {
      transform: rotate(180deg);
    }

    #sidebar .nav-submenu {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease;
    }

    #sidebar .nav-item.open > .nav-submenu {
      max-height: 500px;
    }

    #sidebar .nav-submenu .nav-link {
      padding: 8px 16px 8px 46px;
      font-size: 13px;
      color: var(--gray-500);
    }

    #sidebar .nav-submenu .nav-link.active {
      background-color: var(--primary-color);
      color: var(--white);
    }

    /* 2단계 서브메뉴 */
    #sidebar .nav-submenu .nav-item {
      margin-bottom: 0;
    }

    #sidebar .nav-submenu .nav-item > .nav-link {
      padding-left: 46px;
    }

    #sidebar .nav-submenu .nav-submenu .nav-link {
      padding: 7px 16px 7px 56px;
      font-size: 13px;
    }

    #sidebar .sidebar-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--gray-800);
      transition: padding 0.3s ease;
    }

    #sidebar .sidebar-toggle-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 0;
      background: none;
      border: none;
      color: var(--gray-400);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    #sidebar .sidebar-toggle-btn:hover {
      color: var(--white);
    }

    #sidebar .sidebar-toggle-btn .material-symbols-rounded {
      font-size: 20px;
    }
  `;

  const sidebarHTML = `
    <aside class="sidebar" id="sidebar">
      <nav class="sidebar-nav">
        <!-- 홈 -->
        <div class="nav-item">
          <a href="dashboard.html" class="nav-link" data-page="dashboard">
            <span class="material-symbols-rounded">home</span>
            <span>홈</span>
          </a>
        </div>

        <!-- 마이페이지 -->
        <div class="nav-item has-submenu">
          <div class="nav-link submenu-toggle">
            <span class="material-symbols-rounded">person</span>
            <span>마이페이지</span>
            <span class="material-symbols-rounded nav-arrow">expand_more</span>
          </div>
          <div class="nav-submenu">
            <a href="settings.html" class="nav-link" data-page="settings">운영정보</a>
            <a href="account-login.html" class="nav-link" data-page="account-login">계정/로그인</a>
          </div>
        </div>

        <!-- 고객 -->
        <div class="nav-item has-submenu">
          <div class="nav-link submenu-toggle">
            <span class="material-symbols-rounded">groups</span>
            <span>고객</span>
            <span class="material-symbols-rounded nav-arrow">expand_more</span>
          </div>
          <div class="nav-submenu">
            <div class="nav-item has-submenu">
              <div class="nav-link submenu-toggle">
                <span>일반회원</span>
                <span class="material-symbols-rounded nav-arrow">expand_more</span>
              </div>
              <div class="nav-submenu">
                <a href="user-management.html" class="nav-link" data-page="user-management">일반회원 관리</a>
              </div>
            </div>
            <div class="nav-item has-submenu">
              <div class="nav-link submenu-toggle">
                <span>입점회원</span>
                <span class="material-symbols-rounded nav-arrow">expand_more</span>
              </div>
              <div class="nav-submenu">
                <a href="hospital-application.html" class="nav-link" data-page="hospital-application">입점신청관리</a>
              </div>
            </div>
          </div>
        </div>

        <!-- 상품 -->
        <div class="nav-item has-submenu">
          <div class="nav-link submenu-toggle">
            <span class="material-symbols-rounded">shopping_bag</span>
            <span>상품</span>
            <span class="material-symbols-rounded nav-arrow">expand_more</span>
          </div>
          <div class="nav-submenu">
            <div class="nav-item has-submenu">
              <div class="nav-link submenu-toggle">
                <span>카테고리</span>
                <span class="material-symbols-rounded nav-arrow">expand_more</span>
              </div>
              <div class="nav-submenu">
                <a href="category-management.html" class="nav-link" data-page="category-management">카테고리 관리</a>
                <a href="#" class="nav-link">기획전 카테고리 관리</a>
              </div>
            </div>
            <div class="nav-item has-submenu">
              <div class="nav-link submenu-toggle">
                <span>상품관리</span>
                <span class="material-symbols-rounded nav-arrow">expand_more</span>
              </div>
              <div class="nav-submenu">
                <a href="product-list.html" class="nav-link" data-page="product-list">상품목록</a>
                <a href="product-registration.html" class="nav-link" data-page="product-registration">상품등록</a>
                <a href="product-display.html" class="nav-link" data-page="product-display">상품진열</a>
              </div>
            </div>
          </div>
        </div>

        <!-- 리뷰 -->
        <div class="nav-item">
          <a href="review-management.html" class="nav-link" data-page="review-management">
            <span class="material-symbols-rounded">star</span>
            <span>리뷰</span>
          </a>
        </div>

        <!-- 채팅 -->
        <div class="nav-item has-submenu">
          <div class="nav-link submenu-toggle">
            <span class="material-symbols-rounded">chat_bubble_outline</span>
            <span>채팅</span>
            <span class="material-symbols-rounded nav-arrow">expand_more</span>
          </div>
          <div class="nav-submenu">
            <a href="chat-inquiry.html" class="nav-link" data-page="chat-inquiry">채팅 문의</a>
            <a href="#" class="nav-link">자동 답변</a>
          </div>
        </div>

        <!-- 예약 -->
        <div class="nav-item has-submenu">
          <div class="nav-link submenu-toggle">
            <span class="material-symbols-rounded">event</span>
            <span>예약</span>
            <span class="material-symbols-rounded nav-arrow">expand_more</span>
          </div>
          <div class="nav-submenu">
            <a href="booking-management.html" class="nav-link" data-page="booking-management">예약관리</a>
          </div>
        </div>

        <!-- 비즈니스 센터 -->
        <div class="nav-item has-submenu">
          <div class="nav-link submenu-toggle">
            <span class="material-symbols-rounded">account_balance</span>
            <span>비즈니스 센터</span>
            <span class="material-symbols-rounded nav-arrow">expand_more</span>
          </div>
          <div class="nav-submenu">
            <a href="pricing-plan.html" class="nav-link" data-page="pricing-plan">비즈니스 관리</a>
            <a href="pricing-settlement.html" class="nav-link" data-page="pricing-settlement">요금제 정산</a>
            <a href="point-settlement.html" class="nav-link" data-page="point-settlement">포인트 정산</a>
          </div>
        </div>

        <!-- 택시 (2026-04-20: 구 페이지들은 _concept-draft/admin-taxi-legacy/로 이동.
             신 어드민 admin/taxi/와 통합 방향은 추후 결정 — 그때까지 메뉴 숨김) -->
        <!--
        <div class="nav-item has-submenu">
          <div class="nav-link submenu-toggle">
            <span class="material-symbols-rounded">local_taxi</span>
            <span>택시</span>
            <span class="material-symbols-rounded nav-arrow">expand_more</span>
          </div>
          <div class="nav-submenu">
            <a href="taxi-settlement.html" class="nav-link" data-page="taxi-settlement">탑승관리</a>
            <a href="taxi-completed.html" class="nav-link" data-page="taxi-completed">탑승완료</a>
            <a href="taxi-cancelled-before.html" class="nav-link" data-page="taxi-cancelled-before">탑승전 취소</a>
            <a href="taxi-settlement-history.html" class="nav-link" data-page="taxi-settlement-history">정산관리</a>
          </div>
        </div>
        -->
        <!-- /택시 -->

        <!-- 게시판 -->
        <div class="nav-item has-submenu">
          <div class="nav-link submenu-toggle">
            <span class="material-symbols-rounded">article</span>
            <span>게시판</span>
            <span class="material-symbols-rounded nav-arrow">expand_more</span>
          </div>
          <div class="nav-submenu">
            <a href="notice-user.html" class="nav-link" data-page="notice-user">공지사항(사용자)</a>
            <a href="notice-partner.html" class="nav-link" data-page="notice-partner">공지사항(파트너)</a>
            <a href="inquiry-user.html" class="nav-link" data-page="inquiry-user">1:1 문의</a>
          </div>
        </div>
      </nav>
      <div class="sidebar-footer">
        <button class="sidebar-toggle-btn" id="sidebarToggle" onclick="toggleSidebar()">
          <span class="material-symbols-rounded">left_panel_close</span>
          <span>사이드바 접기</span>
        </button>
      </div>
    </aside>
  `;

  // Toggle sidebar function (global)
  window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const header = document.querySelector('.header') || document.querySelector('.main-header');
    const mainContent = document.querySelector('.main-content');
    const footer = document.querySelector('.footer');
    const toggleBtn = document.getElementById('sidebarToggle');
    const toggleIcon = toggleBtn ? toggleBtn.querySelector('.material-symbols-rounded') : null;
    const toggleText = toggleBtn ? toggleBtn.querySelector('span:last-child') : null;

    sidebar.classList.toggle('collapsed');
    if (header) header.classList.toggle('sidebar-collapsed');
    if (mainContent) mainContent.classList.toggle('sidebar-collapsed');
    if (footer) footer.classList.toggle('sidebar-collapsed');

    // Toggle icon and text
    if (toggleIcon && toggleText) {
      if (sidebar.classList.contains('collapsed')) {
        toggleIcon.textContent = 'left_panel_open';
        toggleText.textContent = '사이드바 펼치기';
      } else {
        toggleIcon.textContent = 'left_panel_close';
        toggleText.textContent = '사이드바 접기';
      }
    }
  };

  // Initialize
  document.addEventListener('DOMContentLoaded', function() {
    // Find container (admin-container or app-layout)
    const adminContainer = document.querySelector('.admin-container') || document.querySelector('.app-layout');
    if (!adminContainer) return;

    // Check if sidebar already exists
    if (document.getElementById('sidebar')) return;

    // Inject CSS
    const styleEl = document.createElement('style');
    styleEl.textContent = sidebarCSS;
    document.head.appendChild(styleEl);

    // Insert sidebar at the beginning of admin-container
    adminContainer.insertAdjacentHTML('afterbegin', sidebarHTML);

    // Event delegation for submenu toggles
    const sidebar = document.getElementById('sidebar');

    sidebar.addEventListener('click', function(e) {
      const toggle = e.target.closest('.submenu-toggle');
      if (toggle) {
        e.preventDefault();
        const navItem = toggle.closest('.nav-item');
        if (navItem) {
          navItem.classList.toggle('open');
        }
      }
    });

    // Get current page from body data attribute or filename
    const currentPage = document.body.dataset.page ||
      window.location.pathname.split('/').pop().replace('.html', '');

    // Set active state
    let targetPage = currentPage;

    // Handle detail pages (user-detail, chat-detail, booking-detail)
    const detailPageMappings = {
      'user-detail': 'user-management',
      'chat-detail': 'chat-inquiry',
      'booking-detail': 'booking-management'
      // 'taxi-ride-detail': 'taxi-settlement'  — 택시 메뉴 보류(2026-04-20)
    };

    if (detailPageMappings[currentPage]) {
      targetPage = detailPageMappings[currentPage];
    }

    const activeLink = document.querySelector(`.nav-link[data-page="${targetPage}"]`);
    if (activeLink) {
      activeLink.classList.add('active');

      // Auto-expand parent nav-items
      let navItem = activeLink.closest('.nav-item');
      while (navItem) {
        navItem.classList.add('open');
        navItem = navItem.parentElement.closest('.nav-item');
      }
    }
  });
})();
