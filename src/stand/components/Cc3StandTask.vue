<script setup lang="ts">
import { computed, onMounted } from 'vue'

import Cc3StandProfileForm from './Cc3StandProfileForm.vue'
import { useStand } from '../composables/useStand'
import { useStandProfile } from '../composables/useStandProfile'
import { useStandSession } from '../composables/useStandSession'
import { useStandTask } from '../composables/useStandTask'

/**
 * Первый экран сценария: #/{country}/{user}/test.
 *
 * Модератор отдаёт респонденту одну эту ссылку и дальше ничего не
 * переключает. Сначала человек называет себя, потом читает задание и
 * жмёт одну кнопку — какой концепт ему достанется, решает стенд.
 *
 * Раньше между профилем и заданием стояли два экрана выбора: тип
 * пользователя и версия чекаута. Респондент читал список незнакомых
 * названий и спрашивал модератора, что нажать, — лишняя минута и лишний
 * повод заговорить ровно перед замером.
 */
const { country, user } = useStand()
const { isProfileFilled } = useStandProfile()
const { startSession } = useStandSession()
const { taskTitle, taskText, taskHint, nextLabel, nextHref } = useStandTask()

// Сессия заводится при первом открытии экрана: она задаёт порядок концептов
// и живёт до конца теста. Повторный заход сюда порядок не перетасовывает.
onMounted(() => {
  startSession(country.value, user.value)
})

const isReady = computed(() => isProfileFilled.value)

function onProfileSubmit() {
  startSession(country.value, user.value)
}
</script>

<template>
  <div class="cc3-stand-task">
    <div class="cc3-stand-task__card">
      <template v-if="isReady">
        <h1 class="cc3-stand-task__title">{{ taskTitle }}</h1>
        <p class="cc3-stand-task__text">{{ taskText }}</p>
        <p v-if="taskHint" class="cc3-stand-task__hint">{{ taskHint }}</p>

        <a :href="nextHref" class="cc3-stand-task__button">{{ nextLabel }}</a>
      </template>

      <Cc3StandProfileForm v-else @submit="onProfileSubmit" />
    </div>
  </div>
</template>

<style lang="scss">
.cc3-stand-task {
  display: flex;
  justify-content: center;

  padding: var(--st-global-distance-space-inset-2xl)
    var(--st-global-distance-space-inset-xl);
  min-height: 100dvh;

  background-color: var(--st-content-background-color-neutral-subtle);

  &__card {
    display: flex;
    flex-direction: column;
    gap: var(--st-global-distance-space-stack-md);

    padding: var(--st-global-distance-space-inset-2xl);
    width: 100%;
    max-width: 560px;
    height: fit-content;

    background-color: var(--st-content-background-color-neutral-primary);
    border-radius: var(--st-global-radius-lg);
  }

  &__title {
    margin: 0;

    @include font('heading-xs');

    color: var(--st-content-foreground-color-neutral-primary);
  }

  // Задание набрано крупнее обычного текста: это единственное, что
  // респондент должен прочитать на этом экране.
  &__text {
    margin: 0;

    @include font('body-md');

    color: var(--st-content-foreground-color-neutral-primary);
  }

  // Приписка про адрес набрана тише задания: она снимает вопрос, но не
  // должна перетягивать внимание с самого задания.
  &__hint {
    margin: 0;

    @include font('body-sm');

    color: var(--st-content-foreground-color-neutral-secondary);
  }

  &__button {
    display: flex;
    align-items: center;
    justify-content: center;

    margin-top: var(--st-global-distance-space-stack-md);
    padding: var(--st-global-distance-space-inset-lg);
    width: 100%;
    height: 44px;

    @include font('label-md');

    color: var(--st-action-foreground-color-onprimary-normal);
    text-decoration: none;
    background-color: var(--st-action-background-color-positive-normal);
    border-radius: var(--st-global-radius-md);
  }
}
</style>
