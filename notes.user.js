// ==UserScript==
// @name         Notes with Tooltip
// @namespace    http://tampermonkey.net/
// @version      2024-04-08
// @description  Add notes functionality to homework rows with tooltip preview
// @author       You
// @match        https://nz.ua/journal/index?journal=*
// @match        https://nz.ua/hometask/view?schedule=*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nz.ua
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    $.noConflict();

    // Add styles
    $('head').append(`
        <style>
            .note-btn { margin-left: 5px; padding: 2px 8px; background: #f0f0f0; border: 1px solid #ccc; cursor: pointer; position: relative; }
            .note-btn.has-note { background: #ffff99; }
            #noteModal { position: fixed; top: 20%; left: 30%; width: 40%; background: white; padding: 20px; border: 2px solid black; z-index: 9999; }
            #noteInput { width: 100%; height: 150px; margin-bottom: 10px; }
            .loading { display: none; margin-left: 10px; }
            .success-message { display: none; color: green; margin-top: 10px; }
            .note-tooltip {
                display: none;
                position: absolute;
                top: -10%;
                left: 60%;
                transform: translateX(10%);
                background: #333;
                color: white;
                padding: 8px;
                border-radius: 4px;
                width: 200px;
                z-index: 10000;
                font-size: 12px;
                white-space: pre-wrap;
            }
            .note-btn:hover .note-tooltip { display: block; }
        </style>
    `);

    // Function to add note button to homework rows
    function addNoteButtons() {
        $('.homework-row').each(function() {
            const $homeworkItem = $(this).find('.homework__item').first();
            const modalLink = $homeworkItem.find('.modal-box').attr('href');

            if (modalLink) {
                const urlParams = new URLSearchParams(modalLink.split('?')[1]);
                const schedule = urlParams.get('schedule');

                if (schedule) {
                    const $noteBtn = $('<button>', {
                        class: 'note-btn',
                        text: '📝',
                        'data-schedule': schedule,
                        click: function() {
                            showNoteModal(schedule);
                        }
                    });

                    // Add tooltip element
                    const $tooltip = $('<div>', {
                        class: 'note-tooltip',
                        text: 'Loading...'
                    });
                    $noteBtn.append($tooltip);

                    $homeworkItem.find('.modal-box').after($noteBtn);

                    // Check if note exists and load tooltip content
                    checkNoteExists(schedule, $noteBtn, $tooltip);
                }
            }
        });
    }

    // Function to check if note exists and load tooltip content
    function checkNoteExists(schedule, $button, $tooltip) {
        $.ajax({
            url: 'https://api.dispate.com.ua/nz/api/get-note.php',
            method: 'POST',
            data: { schedule: schedule },
            success: function(response) {
                try {
                    const data = response;
                    if (data.note) {
                        $button.addClass('has-note');
                        $tooltip.text(data.note.substring(0, 200) + (data.note.length > 200 ? '...' : '')); // Limit tooltip length
                    } else {
                        $tooltip.text('No note available');
                    }
                } catch (e) {
                    console.error('Error parsing JSON:', e);
                    console.log('Raw response:', response);
                    $tooltip.text('Error loading note');
                }
            },
            error: function(xhr, status, error) {
                console.log('AJAX error:', status, error);
                console.log('Response:', xhr.responseText);
                $tooltip.text('Error loading note');
            }
        });
    }

    // Function to show note modal
    function showNoteModal(schedule) {
        // Create modal
        const $modal = $(`
            <div id="noteModal">
                <h3>Note for Schedule ${schedule}</h3>
                <textarea id="noteInput" placeholder="Enter your note here..."></textarea>
                <div>
                    <button id="saveNote">Save</button>
                    <span class="loading">Saving...</span>
                    <button id="closeNoteModal">Close</button>
                </div>
                <div class="success-message">Note saved successfully!</div>
            </div>
        `);

        $('body').append($modal);

        // Load existing note if any
        $.ajax({
            url: 'https://api.dispate.com.ua/nz/api/get-note.php',
            method: 'POST',
            data: { schedule: schedule },
            success: function(response) {
                try {
                    const data = response;
                    if (data.success && data.note) {
                        $('#noteInput').val(data.note);
                    }
                } catch (e) {
                    console.error('Error parsing JSON for modal:', e);
                    console.log('Raw response:', response);
                }
            },
            error: function(xhr, status, error) {
                console.log('AJAX error loading note:', status, error);
                console.log('Response:', xhr.responseText);
            }
        });

        // Save note
        $('#saveNote').on('click', function() {
            const noteText = $('#noteInput').val();
            const $loading = $modal.find('.loading');
            const $successMessage = $modal.find('.success-message');

            // Show loading indicator
            $loading.show();
            $successMessage.hide();

            $.ajax({
                url: 'https://api.dispate.com.ua/nz/api/save-note.php',
                method: 'POST',
                data: {
                    schedule: schedule,
                    note: noteText
                },
                success: function(response) {
                    try {
                        const data = response;
                        if (data.success) {
                            $loading.hide();
                            $successMessage.show();
                            const $button = $(`.note-btn[data-schedule="${schedule}"]`);
                            $button.addClass('has-note');
                            $button.find('.note-tooltip').text(noteText.substring(0, 200) + (noteText.length > 200 ? '...' : ''));

                            // Hide success message and close modal after 2 seconds
                            setTimeout(() => {
                                $modal.remove();
                            }, 2000);
                        }
                    } catch (e) {
                        $loading.hide();
                        console.error('Error parsing save response:', e);
                        console.log('Raw response:', response);
                        alert('Error processing save response');
                    }
                },
                error: function(xhr, status, error) {
                    $loading.hide();
                    console.log('AJAX error saving note:', status, error);
                    console.log('Response:', xhr.responseText);
                    alert('Error saving note');
                }
            });
        });

        // Close modal
        $('#closeNoteModal').on('click', function() {
            $modal.remove();
        });
    }

    // Initialize on page load
    $(document).ready(function() {
        addNoteButtons();
    });

})();
