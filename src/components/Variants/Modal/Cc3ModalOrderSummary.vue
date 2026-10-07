<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useSummarySticky } from '@/composables/useSummarySticky'
import { useStand } from '@/stand/composables/useStand'

import Cc3ModalOrderSummaryBody from './Cc3ModalOrderSummaryBody.vue'

/**
 * Блок сводки заказа в конце страницы.
 *
 * Пока его почти не видно, сумму несёт прилипшая шапка. Как только блок
 * показался на треть, шапка отлипает и закрывается: две одинаковые сводки
 * с двумя «Итого» на одном экране — это вопрос «а какая настоящая» прямо
 * внутри замера.
 */
const { t } = useStand()
const { trackSummaryBlock } = useSummarySticky()

const text = computed(() => ({
  title: t('summary.title'),
}))

const sectionRef = ref<HTMLElement>()
let stopTracking: (() => void) | undefined

onMounted(() => {
  if (sectionRef.value) {
    stopTracking = trackSummaryBlock(sectionRef.value)
  }
})

onBeforeUnmount(() => stopTracking?.())
</script>

<template>
  <section ref="sectionRef" class="cc3-modal-order-summary">
    <h2 class="cc3-modal-order-summary__title">{{ text.title }}</h2>

    <Cc3ModalOrderSummaryBody />
  </section>
</template>

<style lang="scss">
.cc3-modal-order-summary {
  &__title {
    margin: 0;
    padding: var(--st-global-distance-space-inset-sm) var(--st-global-distance-space-inset-2xl);

    @include font('heading-xxs');

    color: var(--st-content-foreground-color-neutral-primary);
  }
}
</style>
