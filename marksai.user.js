// ==UserScript==
// @name         Set Marks AI
// @namespace    http://tampermonkey.net/
// @version      2025-09-24
// @description  try to take over the world!
// @author       You
// @match        https://nz.ua/journal/index?journal=*
// @match        https://nz.ua/hometask/view?schedule=*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nz.ua
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    $.noConflict();

    $('head').append(`
        <style>
            #studentsInput,#marksInput{height:200px !important} 
            .lbl:has(input:checked){text-decoration: line-through; opacity: 0.4}
            #preloader {
                display: none;
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.6);
                z-index: 10000;
                text-align: center;
                color: #fff;
                font-size: 24px;
                font-weight: bold;
            }
            #preloader span {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
            }
        </style>
    `);

    // Функція для витягування даних із .homework-row (дата та schedule)
    function extractHomeworkData() {
        let lessons = [];
        $('.homework-row').each(function () {
            let date = $(this).find('.homework__item').eq(1).text().trim();
            let scheduleLink = $(this).find('.modal-box').attr('href');
            if (scheduleLink) {
                let urlParams = new URLSearchParams(scheduleLink.split('?')[1]);
                let schedule = urlParams.get('schedule');
                if (schedule && date) {
                    lessons.push({ date, schedule });
                }
            }
        });
        return lessons;
    }

    // Функція для парсингу всіх учнів
    function extractStudentsData() {
        let students = [];
        $('td.pt-theme').each(function () {
            let studentId = $(this).attr('data-student-id');
            let studentName = $(this).find('a').text().trim();
            if (studentId && studentName) {
                students.push({ name: studentName, student_id: studentId });
            }
        });
        return students;
    }

    // Функція для створення та відображення модального вікна
    function showModal(lessons, students) {
        let studentsJSON = JSON.stringify(students, null, 2);
        let modal = `
            <div id="marksAiModal" style="position: fixed; top: 5%; left: 30%; width: 40%; background: white; padding: 20px; border: 2px solid black; z-index: 9999;">
                <h3>Marks AI</h3>
                оцінки з naurok
                <textarea name="input" id="marksInput" rows="5" style="width: 100%; margin-bottom: 10px;"></textarea>
                <label for="lessonSelect">Оберіть урок:</label>
                <select id="lessonSelect" style="width: 100%; margin-bottom: 10px;">
                    ${lessons.map(lesson => `<option value="${lesson.schedule}">${lesson.date}</option>`).join('')}
                </select>
                <label for="studentsInput">Список учнів (JSON):</label>
                <textarea name="students" id="studentsInput" rows="10" style="width: 100%; margin-bottom: 10px; height: 70px;">${studentsJSON}</textarea>
                <button id="submitMarks" style="margin-right: 10px;">Надіслати</button>
                <button id="closeModal">Закрити</button>
            </div>
        `;
        $('body').append(modal);

        $('#closeModal').on('click', function () {
            $('#marksAiModal').remove();
        });

        $('#submitMarks').on('click', function () {
            let selectedSchedule = $('#lessonSelect').val();
            let inputData = $('#marksInput').val();
            let studentsData = $('#studentsInput').val();

            $("#preloader").show();
            $('#marksAiModal').remove();

            let inputObject = JSON.parse(inputData);
            let errors = '';

            inputObject.sort((a, b) => a.name.localeCompare(b.name));

            $.ajax({
                url: 'https://api.dispate.com.ua/nz/marks-ai.php',
                method: 'POST',
                data: {
                    schedule: selectedSchedule,
                    input: inputData,
                    students: studentsData
                },
                success: function (response) {
                    let parsedResponse = JSON.parse(response);
                    let result = parsedResponse.result;
                    let errors = parsedResponse.errors;

                    setMarksInJournal(result, selectedSchedule);

                    let inputObject;
                    try {
                        inputObject = JSON.parse(inputData);
                    } catch (error) {
                        alert('Помилка: невірний формат JSON у полі оцінок (input)');
                    }

                    inputObject.sort((a, b) => a.name.localeCompare(b.name));
                    let formattedInputData = inputObject.map(item => {
                        return `${item.name}: ${item.grade}`;
                    }).join('\n<br/>');

                    $('body').append(`
                        <div id="marksResult" style="overflow: scroll; padding: 10px; width: 300px; height: 500px; border: 1px solid #000; background: #fff; position: fixed; top: 100px; right: 20px; ">
                            Помилки:\n${errors.map(error => `${error.name}: ${error.grade}`).join('\n<br/>')}
                            <button class="closeMarksResult">Закрити</button>
                            <h4>Всі оцінки</h4>
                            ${formattedInputData}
                        </div>
                    `);
                    $("#preloader").hide();
                },
                error: function () {
                    alert('Сталася помилка під час відправки даних!');
                    $("#preloader").hide();
                }
            });
        });
    }

    $('body').on('click', '.closeMarksResult', function () {
        $('#marksResult').remove();
    });

    // Функція для виставлення оцінок у журналі
    function setMarksInJournal(marksData, scheduleId) {
        marksData.forEach(markEntry => {
            let studentId = markEntry.student_id;
            let grade = markEntry.grade;
            let columnSelector = `col[data-lesson-id="${scheduleId}"]`;
            let columnIndex = $(`#journalList ${columnSelector}`).index() + 1;
            let inputField = $(`#journalList td[data-student-id="${studentId}"]`).siblings(`td:nth-child(${columnIndex})`).find('input.mark-cell');
            if (inputField.length > 0) {
                inputField.val(grade);
                inputField.trigger('change');
            }
        });
    }

    // Додавання кнопки "Marks AI" на панель
    function addMarksAiButton(lessons, students) {
        let button = $('<button>', {
            text: 'Marks AI',
            style: 'margin-left: 10px;',
            click: function () {
                showModal(lessons, students);
            }
        });

        if ($('.journal-scores-panel__box').length) {
            $('.journal-scores-panel__box').append(button);
        }
        if ($('.hometask-header').length) {
            $('.hometask-header').after(button);
        }
    }

    // Ініціалізація після завантаження сторінки
    $(document).ready(function () {
        if (!$('#preloader').length) {
            $('body').append('<div id="preloader"><span>Зачекайте...</span></div>');
        }

        let lessons = extractHomeworkData();
        let students = extractStudentsData();
        addMarksAiButton(lessons, students);
    });

})();
