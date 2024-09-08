// ==UserScript==
// @name         NZ HELP
// @namespace    http://tampermonkey.net/
// @version      1.3.1
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
    #phrases_list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    #phrases_list li {
      list-style: none;
      margin: 10px 0;
      display: block;
      display: flex;
    }
    #phrases_list li a.quick-phrase,
    #phrases_list li a.delete-phrase {
      display: inline-block;
      cursor: pointer;
      color: #000;
      border: 1px solid;
      padding: 7px 20px;
      border-radius: 20px 0 0 20px;
      transition: color .3s, background .3s;
    }
    #phrases_list li a.quick-phrase:hover {
      color: #fff;
      background: #000;
    }
    #phrases_list li a.delete-phrase {
      border-radius: 0 20px 20px 0;
      padding: 7px 14px;
    }
    #phrases_list li a.delete-phrase:hover {
      color: #fff !important;
      background: red;
    }
    #addPhrase{
      font-weight: 300;
      display: inline-block;
      cursor: pointer;
      padding: 2px;
      color: #000;
      font-size: 20px;
      border:1px solid;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      text-align: center;
      transition: color .3s, background .3s;
    }
    #addPhrase:hover{
      color: #fff;
      background: #000;
    }

    .nav-open:not(:checked) ~ .sidebar .sidebar-nav__label {
      max-width: unset !important;
    }
    .sidebar {
      max-width: unset !important;
    }
    .sidebar.collapsed span.sidebar-nav__info {
      transform: translateX(-30px) !important;
      font-size: 12px;
      padding: 2px 5px;
    }
    .sidebar:not(.collapsed) span.sidebar-nav__info {
      transform: translateX(0) !important;
      font-size: 12px;
      padding: 2px 5px;
    }
    a[href*="old.nz.ua"] {
      font-size: 8px;
      color: #fff;
      line-height: 150%;
      display: block;
    }
    .nav-open:not(:checked) ~ .sidebar .sidebar-support__label {
      max-width: unset;
    }

</style>`
  );

  function getUrlParameter(name) {
    // Створюємо регулярний вираз для пошуку параметра в URL
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)");

    // Виконуємо пошук у поточному URL
    var results = regex.exec(window.location.search);

    // Якщо параметр знайдено, повертаємо його значення, інакше - null
    return results === null ? null : decodeURIComponent(results[1].replace(/\+/g, " "));
  }

  // Функція для роботи з кукі
  function setCookie(name, value, days) {
    var expires = "";
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  }

  function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(";");
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) == " ") c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  const csrf_token = $('meta[name="csrf-token"]').attr("content");
  const curren_journal_id = $('input[name="journal"]').val();

  $(document).ready(function () {
    // Додаємо чекбокси в кожен елемент td, вибраний селектором
    if (getUrlParameter("journal") && !getUrlParameter("schedule")) {
      $("#journalList thead td.pt-point").each(function () {
        // Отримуємо поточне значення lesson-id із посилання всередині td
        var lessonId = $(this).find("a").attr("href").split("schedule=")[1];

        // Створюємо чекбокс і додаємо його перед посиланням
        var checkbox = `<input type="checkbox" class="lesson-checkbox" data-schedule-id="${lessonId}">`;
        $(this).prepend(checkbox);
      });
    }

    // Додаємо кнопку-посилання "Видалити відмічені" в .journal-scores-panel__box
    $(".journal-scores-panel__box").append('<a href="#" id="delete-selected" class="">X Видалити відзначені</a>');

    // Обробник кліка на кнопку-посилання "Видалити відмічені"
    $("#delete-selected").on("click", function (e) {
      e.preventDefault(); // запобігаємо переходу за посиланням

      // Збираємо всі відмічені чекбокси
      var selectedCheckboxes = $(".lesson-checkbox:checked");

      if (selectedCheckboxes.length === 0) {
        alert("Будь ласка, виберіть хоча б один урок для видалення.");
        return;
      }

      // Показ прелоадера
      $("#preloader").show();

      // Для кожного вибраного чекбокса відправляємо POST запит
      var totalRequests = selectedCheckboxes.length;
      var completedRequests = 0;

      selectedCheckboxes.each(function () {
        var scheduleId = $(this).data("schedule-id");

        $.post("https://nz.ua/journal/delete-lesson", { schedule_id: scheduleId })
          .done(function (response) {
            // Індикація успішного виконання
            completedRequests++;
            checkCompletion();
          })
          .fail(function (error) {
            // Індикація помилки
            alert("Помилка при видаленні уроку з ID " + scheduleId);
            completedRequests++;
            checkCompletion();
          });
      });

      // Функція перевірки завершення всіх запитів
      function checkCompletion() {
        if (completedRequests === totalRequests) {
          // Приховуємо прелоадер
          $("#preloader").hide();
          alert("Усі запити оброблено.");
          location.reload(); // Перезавантаження сторінки для оновлення даних
        }
      }
    });
  });

  // Додаємо кнопку в body
  if (getUrlParameter("journal") && getUrlParameter("schedule") == null) {
    $("body").append('<button id="openScheduler" style="position: absolute; top: 97px; right: 10px; z-index: 9999;">Додавання стовпчиків</button>');
  }

  $("head").append(`
    <style>
      #lessons_mapping_table td{
        border-bottom: 1px solid;
        padding: 10px 10px;
      }
    </style>
  `);

  let journalName = $(".journal-scores__title a").text();

  $("#openScheduler").on("click", function () {
    // Завантажуємо дані для селектів (уроки та кабінети) через AJAX
    $.get(`https://nz.ua/journal/add-edit-lesson?journal=${curren_journal_id}`, function (data) {
      const buzzerOptions = $(data).find("#osvitaschedulereal-buzzer_id option");
      const roomOptions = $(data).find("#osvitaschedulereal-room_id option");

      // Створюємо форму з динамічно підвантаженими селектами
      $("body").append(`
                  <div id="schedulerForm" style="position: absolute; top: 50px; right: 10px; z-index: 9999; background-color: white; padding: 20px; border: 1px solid black;">
                      <label for="journal_id">Журнал: ${journalName}</label>
                      <input type="hidden" name="journal_id" id="journal_id" value="${curren_journal_id}" />

                      <br/>

                      <label for="lesson_days"><b>Дати уроків</b> (кожен в новому рядку, <br/>формат: dd.mm.yyyy або dd.mm для поточного року):</label><br/>
                      <textarea id="lesson_days" rows="10" cols="30"></textarea><br/>

                    <table id="lessons_mapping_table" style="border-collapse: collapse">
                        <tr>
                            <td>Понеділок</td>
                            <td>
                                <select id="buzzer_id_mon">
                                    <option selected value="none">Немає уроку</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td>Вівторок</td>
                            <td>
                                <select id="buzzer_id_tue">
                                    <option selected value="none">Немає уроку</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td>Середа</td>
                            <td>
                                <select id="buzzer_id_wed">
                                    <option selected value="none">Немає уроку</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td>Четвер</td>
                            <td>
                                <select id="buzzer_id_thu">
                                    <option selected value="none">Немає уроку</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <td>Пʼятниця</td>
                            <td>
                                <select id="buzzer_id_fri">
                                    <option selected value="none">Немає уроку</option>
                                </select>
                            </td>
                        </tr>
                    </table>
                    <br/>

                      <label for="room_id">Оберіть кабінет:</label><br/>
                      <select id="room_id"></select><br/>
                      <br/>

                      <div id="results"></div>

                      <button id="submitForm" style="
                          background: #000;
                          color: #fff;
                          padding: 5px 30px;
                          border-radius: 20px;">Відправити</button>
                      <button id="closeForm" style="
                          float: right;
                          background: #000;
                          color: #fff;
                          padding: 5px 30px;
                          border-radius: 20px;">Закрити</button>
                  </div>
              `);

      // Наповнюємо селекти значеннями, отриманими через AJAX
      buzzerOptions.each(function () {
        let optionText = $(this)
          .text()
          .replace(/\s*\(.*?\)\s*/g, ""); // Видаляємо текст в дужках
        let optionValue = $(this).val();

        // Додаємо очищені опції в селект
        $("#buzzer_id_mon,#buzzer_id_tue,#buzzer_id_wed,#buzzer_id_thu,#buzzer_id_fri").append(
          $("<option>", {
            value: optionValue,
            text: optionText,
          })
        );
      });

      // Наповнюємо селект з кабінетами
      roomOptions.each(function () {
        $("#room_id").append($(this).clone());
      });

      // Встановлюємо збережений кабінет з кукі, якщо він є
      const savedRoomId = getCookie("selectedRoom");
      if (savedRoomId) {
        $("#room_id").val(savedRoomId);
      }

      // Закриття форми
      $("#closeForm").on("click", function () {
        $("#schedulerForm").remove();
      });

      // Обробка відправлення форми
      $("#submitForm").on("click", function () {
        $("#preloader").show(); // Показуємо прелоадер
        $("#results").empty(); // Очищаємо попередні результати
        const journal_id = $("#journal_id").val();
        const lesson_days = $("#lesson_days").val().trim().split("\n");

        // Отримуємо дані з селектів для днів тижня
        const lesson_mapping = {
          mon: $("#buzzer_id_mon").val(),
          tue: $("#buzzer_id_tue").val(),
          wed: $("#buzzer_id_wed").val(),
          thu: $("#buzzer_id_thu").val(),
          fri: $("#buzzer_id_fri").val(),
        };

        const room_id = $("#room_id").val(); // Отримуємо вибраний кабінет

        // Зберігаємо вибраний кабінет у кукі
        setCookie("selectedRoom", room_id, 7); // Термін дії кукі — 7 днів

        const lessons = [];
        lesson_days.forEach(function (day) {
          day = day.trim();
          if (!day) return;

          if (day.split(".").length < 3) {
            day += "." + new Date().getFullYear();
          }

          const date = new Date(day.split(".").reverse().join("-"));
          const day_of_week = date.toLocaleString("en-us", { weekday: "short" }).toLowerCase();

          if (lesson_mapping[day_of_week] && lesson_mapping[day_of_week] !== "none") {
            lessons.push({
              date: day,
              lesson_number: lesson_mapping[day_of_week],
            });
          }
        });

        let completedRequests = 0;

        lessons.forEach(function (lesson) {
          const lesson_date = lesson.date.split(".").reverse().join("-");
          const data = {
            _csrf: csrf_token,
            "OsvitaScheduleReal[lesson_type_id]": 110,
            lesson_date_alt: lesson.date,
            "OsvitaScheduleReal[lesson_date]": lesson_date,
            "OsvitaScheduleReal[repeate_type]": "not",
            "OsvitaScheduleReal[buzzer_id]": lesson.lesson_number, // Використовуємо вибраний урок
            "OsvitaScheduleReal[room_id]": room_id, // Використовуємо вибраний кабінет
          };

          $.post(`https://nz.ua/journal/add-edit-lesson?journal=${journal_id}`, data)
            .done(function (response) {
              response = JSON.parse(response);

              if (response.status === "success") {
                $("#results").append("<p>Урок додано: " + lesson_date + "</p>");
              } else if (response.status === "failure") {
                const errorDiv = $("<div>").html(response.html);
                const errorMessage = errorDiv.find(".errorSummary ul li").text();
                $("#results").append('<p style="color:red;">Помилка додавання: ' + lesson_date + " - " + errorMessage + "</p>");
              }
            })
            .fail(function () {
              $("#results").append('<p style="color:red;">Помилка додавання: ' + lesson_date + "</p>");
            })
            .always(function () {
              completedRequests++;
              if (completedRequests === lessons.length) {
                $("#preloader").hide(); // Ховаємо прелоадер після завершення всіх запитів
                $("#results").append("<p>Усі уроки оброблено.</p>");
              }
            });
        });
      });
    });
  });

  // Збереження списку фраз у кукі
  function savePhrasesToCookies(phrases) {
    setCookie("quick_responses", JSON.stringify(phrases), 7);
  }

  // Отримання списку фраз із кукі
  function getPhrasesFromCookies() {
    const cookieValue = getCookie("quick_responses");
    return cookieValue ? JSON.parse(cookieValue) : [];
  }

  // Виведення списку фраз
  function renderPhrases() {
    const phrases = getPhrasesFromCookies();
    const phrasesList = phrases
      .map(
        (phrase, index) => `
      <li>
        <a class="quick-phrase">${phrase}</a>
        <a class="delete-phrase" data-index="${index}" style="color: red;">Х</a>
      </li>
    `
      )
      .join("");

    $("#phrases_list").html(phrasesList);

    // Обробка кліку на фразу для вставки в поле відповіді
    $(".quick-phrase").on("click", function () {
      const text = $(this).text();
      $(".reply__text").val($(".reply__text").val() + text);
    });

    // Обробка видалення фраз
    $(".delete-phrase").on("click", function () {
      const index = $(this).data("index");
      const updatedPhrases = phrases.filter((_, i) => i !== index);
      savePhrasesToCookies(updatedPhrases);
      renderPhrases();
    });
  }

  // Додавання нової фрази
  function addNewPhrase() {
    const newPhrase = prompt("Введіть нову фразу:");
    if (newPhrase) {
      const phrases = getPhrasesFromCookies();
      phrases.push(newPhrase);
      savePhrasesToCookies(phrases);
      renderPhrases();
    }
  }

  // Перевірка наявності блоку .reply__text
  if ($(".reply__text").length) {
    // Додаємо кнопку "Керувати швидкими відповідями"
    //    $('.container_reply').append('<a id="manageQuickReplies" style="margin-top: 10px;">Керувати швидкими відповідями</a>');

    // Обробка додавання нової фрази
    $(document).on("click", "#addPhrase", function () {
      addNewPhrase();
    });

    // Додаємо відображення списку фраз перед блоком .reply__text
    $(".reply__text").before(`
      <h4>Швидка відповідь:             <a id="addPhrase" style="margin-top: 10px;">+</a></h4>
      <ul id="phrases_list">


            </ul>

    `);

    // Рендеримо список фраз
    renderPhrases();
  }
})();
