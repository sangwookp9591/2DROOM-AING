/**
 * ZIVO Admin - Notification Popup
 * 모든 어드민 페이지에서 공통으로 사용하는 알림 팝업
 */

(function() {
  // Notification Popup HTML Template
  const notificationPopupHTML = `
    <div class="notification-popup" id="notificationPopup">
      <div class="notification-popup-header">
        <div class="notification-popup-title">알림</div>
        <div class="notification-tabs">
          <button class="notification-tab active" data-filter="all">전체</button>
          <button class="notification-tab" data-filter="operation">운영</button>
          <button class="notification-tab" data-filter="chat">채팅</button>
          <button class="notification-tab" data-filter="booking">예약</button>
        </div>
      </div>
      <div class="notification-popup-body">
        <div class="notification-item" data-type="booking">
          <div class="notification-item-header">
            <span class="material-symbols-rounded notification-item-icon">chat_bubble_outline</span>
            <span class="notification-item-title">예약 신청</span>
          </div>
          <div class="notification-item-desc">
            일본 김사쿠라 고객님의 눈매교정 예약이 신청되었습니다. 상세 예약 확인 후 예약 일정을 잡아주세요.
          </div>
          <button class="notification-item-btn">확인하기</button>
        </div>
        <div class="notification-item" data-type="booking">
          <div class="notification-item-header">
            <span class="material-symbols-rounded notification-item-icon">event_available</span>
            <span class="notification-item-title">예약 확정</span>
          </div>
          <div class="notification-item-desc">
            미국 John Smith 고객님의 쌍꺼풀 수술 예약이 확정되었습니다.
          </div>
          <button class="notification-item-btn">확인하기</button>
        </div>
        <div class="notification-item" data-type="operation">
          <div class="notification-item-header">
            <span class="material-symbols-rounded notification-item-icon">rate_review</span>
            <span class="notification-item-title">새 리뷰</span>
          </div>
          <div class="notification-item-desc">
            새로운 리뷰가 등록되었습니다. 리뷰 관리에서 확인해주세요.
          </div>
          <button class="notification-item-btn">확인하기</button>
        </div>
        <div class="notification-empty" id="notificationEmpty">알림이 없습니다</div>
      </div>
    </div>
  `;

  // Notification Popup CSS (injected dynamically)
  const notificationPopupCSS = `
    /* Notification Popup Styles */
    .notification-wrapper {
      position: relative;
    }

    .notification-popup {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 400px;
      background: var(--white);
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      display: none;
      overflow: hidden;
    }

    .notification-popup.show {
      display: block;
    }

    .notification-popup-header {
      padding: 20px 24px 0;
    }

    .notification-popup-title {
      font-size: 20px;
      font-weight: 700;
      color: var(--gray-900);
      margin-bottom: 16px;
    }

    .notification-tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--gray-200);
      margin: 0 -24px;
      padding: 0 24px;
    }

    .notification-tab {
      flex: 1;
      padding: 12px 0;
      font-size: 14px;
      color: var(--gray-500);
      background: none;
      border: none;
      cursor: pointer;
      position: relative;
      transition: color 0.2s;
      text-align: center;
    }

    .notification-tab::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      right: 0;
      height: 2px;
      background: transparent;
      transition: background 0.2s;
    }

    .notification-tab:hover {
      color: var(--gray-700);
    }

    .notification-tab.active {
      color: var(--primary-color);
      font-weight: 600;
    }

    .notification-tab.active::after {
      background: var(--primary-color);
    }

    .notification-popup-body {
      max-height: 480px;
      overflow-y: auto;
    }

    .notification-item {
      padding: 20px 24px;
      border-bottom: 1px solid var(--gray-100);
      transition: background 0.2s;
      overflow: hidden;
    }

    .notification-item:hover {
      background: var(--gray-50);
    }

    .notification-item.hidden {
      display: none;
    }

    .notification-item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .notification-item-icon {
      font-size: 20px;
      color: var(--gray-700);
    }

    .notification-item-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--gray-900);
    }

    .notification-item-desc {
      font-size: 14px;
      color: var(--gray-600);
      line-height: 1.5;
      margin-bottom: 12px;
    }

    .notification-item-btn {
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      color: var(--white);
      background: var(--primary-color);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      float: right;
    }

    .notification-item-btn:hover {
      background: var(--primary-dark);
    }

    .notification-empty {
      padding: 100px 24px;
      text-align: center;
      color: var(--gray-400);
      font-size: 14px;
      display: none;
    }

    .notification-empty.show {
      display: block;
    }
  `;

  // Initialize when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    // Inject CSS
    const styleEl = document.createElement('style');
    styleEl.textContent = notificationPopupCSS;
    document.head.appendChild(styleEl);

    // Find notification button (bell icon)
    const notificationBtn = document.querySelector('.header-icon-btn .material-symbols-rounded');
    let targetBtn = null;

    document.querySelectorAll('.header-icon-btn').forEach(btn => {
      const icon = btn.querySelector('.material-symbols-rounded');
      if (icon && icon.textContent.trim() === 'notifications') {
        targetBtn = btn;
      }
    });

    if (!targetBtn) return;

    // Wrap button with notification-wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'notification-wrapper';
    targetBtn.parentNode.insertBefore(wrapper, targetBtn);
    wrapper.appendChild(targetBtn);

    // Inject popup HTML
    wrapper.insertAdjacentHTML('beforeend', notificationPopupHTML);

    // Get popup element
    const popup = document.getElementById('notificationPopup');

    // Toggle popup on button click
    targetBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      popup.classList.toggle('show');
    });

    // Close popup when clicking outside
    document.addEventListener('click', function(e) {
      if (!wrapper.contains(e.target)) {
        popup.classList.remove('show');
      }
    });

    // Tab switching
    const tabs = popup.querySelectorAll('.notification-tab');
    const items = popup.querySelectorAll('.notification-item');
    const emptyState = popup.querySelector('#notificationEmpty');

    const tabNames = {
      'all': '전체',
      'operation': '운영',
      'chat': '채팅',
      'booking': '예약'
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');

        // Filter items
        const filter = this.dataset.filter;
        let visibleCount = 0;

        items.forEach(item => {
          if (filter === 'all' || item.dataset.type === filter) {
            item.classList.remove('hidden');
            visibleCount++;
          } else {
            item.classList.add('hidden');
          }
        });

        // Show/hide empty state
        if (visibleCount === 0) {
          emptyState.textContent = `${tabNames[filter]} 알림이 없습니다`;
          emptyState.classList.add('show');
        } else {
          emptyState.classList.remove('show');
        }
      });
    });
  });
})();
