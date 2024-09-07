// ==UserScript==
// @name         NZ HELP
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Additional functional for NZ
// @author       Danylo Tkachuk
// @updateURL    https://raw.githubusercontent.com/derogit/nz-help/main/script.js
// @downloadUR   https://raw.githubusercontent.com/derogit/nz-help/main/script.js
// @match        https://nz.ua/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nz.ua
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js
// ==/UserScript==


(function() {
    'use strict';
    $.noConflict();

    // Preloader
    $('body').append('<div id="preloader" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:9999; color:white; font-size:24px; text-align:center; padding-top:200px;">Зачекайте, будь ласка...</div>');

    


})()