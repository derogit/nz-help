// ==UserScript==
// @name         Preview homework
// @namespace    http://tampermonkey.net/
// @version      2026-03-13
// @description  try to take over the world!
// @author       You
// @match        https://nz.ua/hometask/view?*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nz.ua
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js
// ==/UserScript==
(function() {
    'use strict';
    $.noConflict();

    // ── style ──────────────────────────────────────────────
    const css = `
        #hw-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(10, 12, 20, 0.75);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            z-index: 999998;
            opacity: 0;
            transition: opacity .25s ease;
        }
        #hw-overlay.hw-visible { opacity: 1; }

        #hw-popup {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -46%) scale(.96);
            width: min(900px, 92vw);
            height: min(80vh, 700px);
            background: #fff;
            border-radius: 14px;
            box-shadow: 0 32px 80px rgba(0,0,0,.28), 0 0 0 1px rgba(0,0,0,.07);
            z-index: 999999;
            display: none;
            flex-direction: column;
            overflow: hidden;
            opacity: 0;
            transition: opacity .25s ease, transform .25s cubic-bezier(.34,1.4,.64,1);
        }
        #hw-popup.hw-visible {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }

        #hw-popup-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 20px;
            background: #f7f8fa;
            border-bottom: 1px solid #e8eaed;
            flex-shrink: 0;
            gap: 12px;
        }
        #hw-popup-title {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            font-weight: 600;
            color: #1a1d23;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        #hw-popup-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }
        #hw-open-tab {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 12px;
            font-weight: 500;
            color: #4a6cf7;
            background: #eef1ff;
            border: none;
            border-radius: 7px;
            padding: 5px 12px;
            cursor: pointer;
            text-decoration: none;
            transition: background .15s;
        }
        #hw-open-tab:hover { background: #dde3ff; }
        #hw-close-btn {
            width: 30px;
            height: 30px;
            border-radius: 8px;
            border: none;
            background: transparent;
            color: #6b7280;
            font-size: 18px;
            line-height: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background .15s, color .15s;
        }
        #hw-close-btn:hover { background: #fee2e2; color: #ef4444; }

        #hw-popup-body {
            flex: 1;
            position: relative;
            overflow: hidden;
        }
        #hw-iframe {
            width: 100%;
            height: 100%;
            border: none;
            display: block;
        }
        #hw-loader {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 14px;
            background: #fff;
        }
        .hw-spinner {
            width: 36px;
            height: 36px;
            border: 3px solid #e8eaed;
            border-top-color: #4a6cf7;
            border-radius: 50%;
            animation: hw-spin .7s linear infinite;
        }
        @keyframes hw-spin { to { transform: rotate(360deg); } }
        .hw-loader-text {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 13px;
            color: #9ca3af;
        }
        #hw-error {
            display: none;
            position: absolute;
            inset: 0;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 10px;
            background: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: #6b7280;
            font-size: 14px;
        }
        #hw-error-icon { font-size: 36px; }
    `;

    $('<style>').text(css).appendTo('head');

    // ── Разметка попапа ────────────────────────────────────────────────────
    const $overlay = $('<div id="hw-overlay">');
    const $popup   = $('<div id="hw-popup">');

    $popup.html(`
        <div id="hw-popup-header">
            <span id="hw-popup-title">Перегляд відповіді</span>
            <div id="hw-popup-actions">
                <a id="hw-open-tab" href="#" target="_blank">↗ Відкрити в новій вкладці</a>
                <button id="hw-close-btn" title="Закрити">✕</button>
            </div>
        </div>
        <div id="hw-popup-body">
            <div id="hw-loader">
                <div class="hw-spinner"></div>
                <span class="hw-loader-text">Завантаження...</span>
            </div>
            <div id="hw-error">
                <span id="hw-error-icon">⚠️</span>
                <span>Не вдалося завантажити сторінку</span>
                <a id="hw-fallback-link" href="#" target="_blank" style="color:#4a6cf7;font-size:13px;">Відкрити напряму</a>
            </div>
            <iframe id="hw-iframe" sandbox="allow-same-origin allow-scripts allow-forms"></iframe>
        </div>
    `);

    $('body').append($overlay, $popup);

    // ── Функції відкриття / закриття ───────────────────────────────────────
    function openPopup(url) {
        const $iframe   = $('#hw-iframe');
        const $loader   = $('#hw-loader');
        const $error    = $('#hw-error');

        // Скидаємо стан
        $iframe.attr('src', '').hide();
        $loader.show();
        $error.hide();

        // Оновлюємо посилання "відкрити в новій вкладці"
        $('#hw-open-tab').attr('href', url);
        $('#hw-fallback-link').attr('href', url);

        // Показуємо оверлей + попап
        $overlay.show();
        $popup.css('display', 'flex');
        requestAnimationFrame(() => {
            $overlay.addClass('hw-visible');
            $popup.addClass('hw-visible');
        });

        // Завантажуємо через iframe (той самий origin — cookie передаються автоматично)
        $iframe.on('load.hw', function() {
            $iframe.off('load.hw');
            try {
                // Перевіряємо, чи не редирект на сторінку логіну
                const loc = $iframe[0].contentWindow.location.href;
                if (loc.includes('login') || loc.includes('signin')) {
                    throw new Error('redirect to login');
                }

                // Скрываем .sidebar внутри загруженной страницы
                const iframeDoc = $iframe[0].contentDocument || $iframe[0].contentWindow.document;
                $(iframeDoc).find('.sidebar').hide();
                $(iframeDoc).find('.footer').hide();
                $(iframeDoc).find('.header').hide();



                $loader.hide();
                $iframe.show();
            } catch(e) {
                // cross-origin або помилка — показуємо повідомлення
                $loader.hide();
                $error.css('display', 'flex');
            }
        });

        $iframe.attr('src', url);
    }

    function closePopup() {
        $overlay.removeClass('hw-visible');
        $popup.removeClass('hw-visible');
        setTimeout(() => {
            $overlay.hide();
            $popup.hide();
            $('#hw-iframe').attr('src', '');
        }, 260);
    }

    // ── Перехоплення кліків ────────────────────────────────────────────────
    $(document).ready(function() {
        $('a[href*="/hometask/view-answer"]').each(function() {
            const $link = $(this);
            const url   = $link.attr('href');

            $link.on('click.hw', function(e) {
                e.preventDefault();
                openPopup(url.startsWith('http') ? url : window.location.origin + url);
            });
        });

        // Закриття
        $('#hw-close-btn, #hw-overlay').on('click', closePopup);
        $(document).on('keydown.hw', function(e) {
            if (e.key === 'Escape') closePopup();
        });
    });

})();
