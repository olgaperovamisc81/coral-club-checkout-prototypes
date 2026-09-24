import { computed } from 'vue'
import { routeHref, useStand } from './useStand'
import { useStandSession } from './useStandSession'

/**
 * Экран задания: что показать респонденту прямо сейчас.
 *
 * Одна логика на два места — на сам экран задания в начале сценария и на
 * экран благодарности, где задание повторяется вместе с кнопкой к
 * следующему варианту. Держать её в двух компонентах нельзя: они разойдутся
 * на первом же изменении, и половина респондентов увидит другой сценарий.
 *
 * Текст задания один и тот же на всех прогонах. Это не оплошность: мы
 * сравниваем версии на одном задании, и менять формулировку между
 * вариантами значит менять и то, что измеряем.
 */
export function useStandTask() {
  const { country, user, t } = useStand()
  const { sessionFor, nextVariant } = useStandSession()

  const session = computed(() => sessionFor(country.value, user.value))

  /** Сценарий ведёт стенд — значит и дальше человека ведём мы, а не модератор. */
  const isSessionMode = computed(() => Boolean(session.value))

  const doneCount = computed(() => session.value?.completed.length ?? 0)

  const next = computed(() => nextVariant(country.value, user.value))

  /** Все запланированные прогоны пройдены — тест закончен. */
  const isSessionDone = computed(() => isSessionMode.value && !next.value)

  const taskText = computed(() => t(`task.${user.value}`))

  /**
   * Заголовок задания. Со второго прогона он с номером: задание то же
   * самое, и без номера экран читается как «вы вернулись туда же» —
   * человек начинает сомневаться, засчиталось ли предыдущее прохождение.
   */
  const taskTitle = computed(() =>
    doneCount.value === 0
      ? t('task.title')
      : t('task.title.next', { number: doneCount.value + 1 }),
  )

  /**
   * Приписка к заданию — своя у каждого типа пользователя.
   *
   * Новый вводит адрес руками и читает «доставку домой» буквально: это
   * чужой прототип, который он видит первый раз, а мы просим его настоящий
   * адрес. Часть людей на этом месте останавливается и спрашивает
   * модератора, остальные оставляют данные, которые нам не нужны и которые
   * потом вычищать из журнала. Приписка снимает вопрос заранее.
   *
   * Сохранённый ничего не вводит: у него в книге восемь адресов и задание
   * на самовывоз. Та же приписка ему не просто не нужна — она подсаживает
   * мысль, что настоящий адрес где-то могут спросить. Его вопрос другой:
   * чьи это адреса и можно ли их трогать, — на него и отвечаем.
   *
   * Показывается только на первом задании. Перед вторым прогоном человек
   * уже прошёл чекаут и на своём опыте знает, что от него хотят; повторять
   * приписку значит занимать строку текстом, который он пролистает.
   */
  const taskHint = computed(() =>
    doneCount.value === 0 ? t(`task.hint.${user.value}`) : '',
  )

  /**
   * Подпись кнопки меняется по шагу, а не по версии: респондент не должен
   * знать, какой концепт ему достался — иначе он начнёт сравнивать названия,
   * а не поведение.
   */
  const nextLabel = computed(() =>
    doneCount.value === 0 ? t('task.start') : t('task.another'),
  )

  const nextHref = computed(() =>
    next.value ? routeHref(country.value, user.value, next.value) : routeHref(),
  )

  return {
    session,
    isSessionMode,
    isSessionDone,
    doneCount,
    taskTitle,
    taskText,
    taskHint,
    nextLabel,
    nextHref,
  }
}
