// ==UserScript==
// @name         Copy results
// @namespace    http://tampermonkey.net/
// @version      2024-03-21
// @description  Extract names and grades and copy to clipboard!
// @author       You
// @match        https://naurok.com.ua/test/homework*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=naurok.com.ua
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function collectNames() {

        let names = [];

        $('.homework-session').each(function(){
            let name = $(this).find('.session-student-name').text().trim();
            let val = parseInt($(this).find('.col-md-1 .homework-session-number').text().trim());

            // Only add if the value is a valid number
            if (!isNaN(val)) {

                if(val > 0){
                    names.push(name);
                }
            }
        });

        return JSON.stringify(names, null, 2);  // Pretty print JSON
    }
    // Function to collect names and grades
    function collectResults() {
        let results = [];

        let names = [];

        $('.homework-session').each(function(){
            let name = $(this).find('.session-student-name').text().trim();
            let val = parseInt($(this).find('.col-md-1 .homework-session-number').text().trim());

            // Only add if the value is a valid number
            if (!isNaN(val)) {
                results.push({ name, grade: val });
                if(val > 0){
                    names.push(name);
                }
            }
        });

        return JSON.stringify(results, null, 2);  // Pretty print JSON
    }

    // Create a container for the text field and the button
    function createUI() {
        const contentBlock = $('.homework-stats .content-block');

        // Create the text area
        const textArea = $('<textarea>', {
            id: 'resultJSON',
            style: 'width: 100%; height: 150px; margin-top: 20px;'
        }).appendTo(contentBlock);

        const textArea2 = $('<textarea>', {
            id: 'names',
            style: 'width: 100%; height: 150px; margin-top: 20px;'
        }).appendTo(contentBlock);

        // Create the copy button
        const copyButton = $('<button>', {
            text: 'Copy JSON',
            style: 'margin-top: 10px;',
            click: function() {
                copyToClipboard($('#resultJSON').val(), $(this));
            }
        }).appendTo(contentBlock);

        // Fill the text area with the collected results
        textArea.val(collectResults());
                textArea2.val(collectNames());
    }

    // Function to copy the JSON to clipboard
    function copyToClipboard(text, el) {
        var copyTextArea = document.createElement("textarea");
        copyTextArea.value = text;
        document.body.appendChild(copyTextArea);
        copyTextArea.select();
        try {
            document.execCommand("copy");
//            alert("Copied!");
        } catch (err) {
            console.log("Oops, unable to copy");
        }
        document.body.removeChild(copyTextArea);
    }

    // Run the script after the DOM is ready
    $(document).ready(function() {
        createUI();
    });

})();
