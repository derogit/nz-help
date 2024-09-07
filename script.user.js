// ==UserScript==
// @name         NZ HELP
// @namespace    http://tampermonkey.net/
// @version      1.0.6
// @description  Additional functional for NZ
// @author       Danylo Tkachuk
// @updateURL    https://raw.githubusercontent.com/derogit/nz-help/main/script.user.js
// @downloadUR   https://raw.githubusercontent.com/derogit/nz-help/main/script.user.js
// @match        https://nz.ua/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nz.ua
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js
// ==/UserScript==

(function () {
  "use strict";
  $.noConflict();

  // Preloader
  $("body").append(
    '<div id="preloader" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; color:white; font-size:24px; text-align:center; padding-top:200px;">Зачекайте, будь ласка...</div>'
  );

  // Styles
  $(".sidebar").width(40).addClass("collapsed");
  $(".sidebar .logo").after('<button id="toggle_sidebar" style="display: block; margin: 0 0px 20px 12px; background: #191919; color: #fff; opacity: 0.8"> < > </button>');

  $(document).on("click", "#toggle_sidebar", function () {
    if ($(".sidebar").hasClass("collapsed")) {
      $(".sidebar").width(160).removeClass("collapsed");
    } else {
      $(".sidebar").width(40).addClass("collapsed");
    }
  });

  $(".homework-row--header .homework__item:nth-child(2)").text("№");
  $(".homework-row--header .homework__item:nth-child(3)").text("Дз");

  $("head").append(
    `
    <style>
    .dz-container li .rltv .dzc-dz.ecl-text-overflow span {
        display: block;
    }

    .dz-container li .rltv .dzc-dz.ecl-text-overflow {
        max-width: 195px
    }

    .scores-table__box {
        max-height: unset;
        overflow: hidden;
    }

    .journal-scores-panel {
        padding-bottom: 10px
    }

    .scores-table .point-table .dropdown .pop_toggle {
        display: none;
        border-width: 0 10px 10px 0;
    }

    .pt-point:hover .dropdown .pop_toggle {
        display: block;
    }

    .homework-table {
        overflow-x: unset;
    }

    .homework-container {
        grid-template-columns: 124px 60px 47px minmax(410px, 1fr) 125px minmax(240px, 1fr) 180px 45px;
    }

    .journal-choose tr {
        grid-template-columns: 0.4fr 1fr;
    }

    .journal-choose td a[href^="/journal/"] {
        background: #000;
        padding: 10px 20px
    }

    .scores-table tr {
        grid-template-rows: 25px;
        grid-template-columns: 40px 160px repeat(21, minmax(33px, 36px));
    }

    .sidebar-support__link {
        padding: 5px;
    }

    .sidebar-nav__box {
        overflow: hidden;
    }
</style>`
  );
})();
