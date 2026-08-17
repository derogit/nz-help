/**
 * Module: fill topics and homework.
 *
 * Writes a list of topics (and, optionally, homework) into consecutive lessons
 * starting from the lesson the teacher picks, numbering them as it goes.
 */
(() => {
  'use strict';

  const NZ = globalThis.NZ;
  const { utils, net, ui } = NZ;

  const LESSON_LINK = 'a.modal-box[href*="add-edit-home-task"]';

  /** Collect the lessons visible in the homework table, in page order. */
  function collectLessons() {
    return utils
      .qsa('.homework-container .homework-row')
      .map((row) => {
        const link = row.querySelector(LESSON_LINK);
        if (!link) return null;

        const params = new URLSearchParams(link.getAttribute('href').split('?')[1]);
        const schedule = params.get('schedule');
        const journal = params.get('journal');
        if (!schedule || !journal) return null;

        const date = row.querySelectorAll('.homework__item')[1]?.textContent.trim() || `урок ${schedule}`;
        return { schedule, journal, date };
      })
      .filter(Boolean);
  }

  function openDialog(lessons) {
    const startSelect = ui.select(
      {},
      lessons.map((lesson, index) => ({ value: String(index), label: lesson.date }))
    );
    const startNumber = ui.input({ type: 'number', min: '1', value: '1', class: 'nz-input nz-input--narrow' });

    const topicsCounter = ui.lineCounter();
    const topics = ui.textarea({ rows: 7, placeholder: 'Тема 1\nТема 2\nТема 3' });
    topicsCounter.bind(topics);

    const homeworkCounter = ui.lineCounter();
    const homework = ui.textarea({ rows: 7, placeholder: 'ДЗ 1\nДЗ 2\nДЗ 3' });
    homeworkCounter.bind(homework);

    const log = ui.logList({ title: 'Заповнення уроків' });

    const submit = ui.button({ label: 'Заповнити уроки', variant: 'primary', onClick: () => run() });

    const dialog = ui.modal({
      eyebrow: `Доступно ${lessons.length} ${utils.plural(lessons.length, 'урок', 'уроки', 'уроків')}`,
      title: 'Заповнення тем і домашніх завдань',
      size: 'lg',
      body: [
        ui.el('div', { class: 'nz-row' }, [
          ui.field({ label: 'Почати з уроку', control: startSelect }),
          ui.field({ label: 'Номер за планом', control: startNumber }),
        ]),
        ui.el('div', { class: 'nz-row nz-row--equal' }, [
          ui.field({
            label: 'Теми уроків',
            hint: 'Один рядок — один урок.',
            control: topics,
            counter: topicsCounter.node,
          }),
          ui.field({
            label: 'Домашні завдання',
            hint: 'Можна залишити порожнім або заповнити частково.',
            control: homework,
            counter: homeworkCounter.node,
          }),
        ]),
        log.node,
      ],
      footer: [ui.button({ label: 'Закрити', onClick: () => dialog.close() }), submit],
    });

    async function run() {
      const csrf = net.csrfToken();
      if (!csrf) {
        ui.toast('Сторінка втратила токен безпеки. Оновіть її та повторіть.', { type: 'error' });
        return;
      }

      const topicList = utils.lines(topics.value);
      const homeworkList = utils.lines(homework.value);

      if (!topicList.length) {
        ui.toast('Додайте хоча б одну тему.', { type: 'info' });
        return;
      }

      let index = Number(startSelect.value) || 0;
      let lessonNumber = Number(startNumber.value) || 1;
      const available = lessons.length - index;

      dialog.setBusy(true);
      log.start(Math.min(topicList.length, available));

      if (topicList.length > available) {
        log.add(`У розкладі лишилося ${available} ${utils.plural(available, 'урок', 'уроки', 'уроків')}, а тем — ${topicList.length}. Заповнимо стільки, скільки є.`, 'info');
      }

      for (let i = 0; i < topicList.length; i += 1) {
        const lesson = lessons[index];
        if (!lesson) break;

        const topic = topicList[i];
        const task = homeworkList[i] || '';

        try {
          await net.postForm(`/journal/add-edit-home-task?schedule=${lesson.schedule}&journal=${lesson.journal}`, {
            _csrf: csrf,
            'OsvitaScheduleReal[lesson_topic]': topic,
            'OsvitaScheduleReal[lesson_number_in_plan]': lessonNumber,
            'OsvitaScheduleReal[hometask]': task,
            'OsvitaScheduleReal[hometask_to]': lesson.schedule,
            'OsvitaScheduleReal[second_personal_id]': '',
            'OsvitaScheduleReal[second_predmet_id]': '',
          });
          log.add(`${lesson.date} · №${lessonNumber} — ${topic}`, 'ok');
        } catch (error) {
          log.add(`${lesson.date} — не збереглося (${error.message})`, 'error');
        }

        index += 1;
        lessonNumber += 1;
      }

      dialog.setBusy(false);
      submit.textContent = 'Заповнити ще';

      if (log.failed) {
        ui.toast(`${log.failed} ${utils.plural(log.failed, 'урок', 'уроки', 'уроків')} не збереглося.`, { type: 'error' });
      } else {
        ui.toast('Теми та ДЗ збережено. Оновлюємо сторінку…', { type: 'success' });
        setTimeout(() => location.reload(), 1600);
      }
    }
  }

  NZ.registry.register({
    id: 'homework-fill',

    match: (page) => page.has(`.homework-container .homework-row ${LESSON_LINK}`),

    init() {
      const lessons = collectLessons();
      if (!lessons.length) return;

      ui.launcher.add({
        id: 'homework-fill',
        label: 'Заповнити теми і ДЗ',
        hint: `${lessons.length} ${utils.plural(lessons.length, 'урок у списку', 'уроки у списку', 'уроків у списку')}`,
        onClick: () => openDialog(lessons),
      });
    },
  });
})();
