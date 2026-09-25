<script setup lang="ts">
import { computed } from 'vue'
import coralclubLogo from '@/assets/modal/coralclub-logo.svg'
import flagCz from '@/assets/modal/flag-cz.svg'
import flagDe from '@/assets/modal/flag-de.svg'
import flagKz from '@/assets/modal/flag-kz.svg'
import flagPl from '@/assets/modal/flag-pl.svg'
import flagRu from '@/assets/modal/flag-ru.svg'
import flagUs from '@/assets/modal/flag-us.svg'
import userPhoto from '@/assets/modal/user-photo.png'
import Cc3Icon from '@/components/Icon/Cc3Icon.vue'
import { useStand } from '@/stand/composables/useStand'

const { t, country } = useStand()

const flags = { ru: flagRu, kz: flagKz, de: flagDe, pl: flagPl, cz: flagCz, us: flagUs }

const text = computed(() => ({
  menu: t('common.menu'),
}))

const flagSrc = computed(() => flags[country.value])


defineProps<{ cartCount: number }>()
</script>

<template>
  <header class="cc3-modal-header">
    <div class="cc3-modal-header__left">
      <button type="button" class="cc3-modal-header__burger" :aria-label="text.menu">
        <Cc3Icon name="menu-01" :size="24" />
      </button>

      <img :src="coralclubLogo" alt="Coral Club" class="cc3-modal-header__logo" />
    </div>

    <div class="cc3-modal-header__right">
      <span class="cc3-modal-header__region">
        <img :src="flagSrc" alt="" class="cc3-modal-header__flag" />
      </span>

      <span class="cc3-modal-header__avatar">
        <img :src="userPhoto" alt="" class="cc3-modal-header__avatar-img" />
      </span>

      <span class="cc3-modal-header__cart">
        <Cc3Icon name="shopping-cart-01" :size="24" />
        <span v-if="cartCount > 0" class="cc3-modal-header__cart-badge">{{ cartCount }}</span>
      </span>
    </div>
  </header>
</template>

<style lang="scss">
.cc3-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: var(--st-global-distance-space-inset-md) var(--st-global-distance-space-inset-2xl);

  background-color: var(--st-content-background-color-default-solid-normal);
  border-bottom: 1px solid var(--st-content-border-color-neutral-onsubtle);

  &__left {
    display: flex;
    align-items: center;
    gap: var(--st-global-distance-space-inset-md);
  }

  &__burger {
    display: flex;
    align-items: center;
    justify-content: center;

    padding: var(--st-global-distance-space-inset-md);

    color: var(--st-content-foreground-color-neutral-primary);
    background: none;
    border: none;
    border-radius: var(--st-global-radius-md);
    cursor: pointer;
  }

  &__logo {
    height: 24px;
  }

  &__right {
    display: flex;
    align-items: center;
    gap: var(--st-global-distance-space-inset-xs);
  }

  &__region {
    display: flex;
    align-items: center;

    padding: var(--st-global-distance-space-inset-xl) 0;
  }

  &__flag {
    width: 20px;
    height: 20px;

    border-radius: var(--st-global-radius-pill);
  }

  &__avatar {
    position: relative;

    display: flex;

    padding: var(--st-global-distance-space-inset-lg);

    background-color: var(--st-content-background-color-default-subtle-normal);
    border-radius: var(--st-global-radius-xs);
  }

  &__avatar-img {
    width: 24px;
    height: 24px;

    background-color: var(--st-content-background-color-neutral-subtle);
    border-radius: var(--st-global-radius-pill);
    object-fit: cover;
  }

  &__cart {
    position: relative;

    display: flex;
    align-items: center;

    padding: var(--st-global-distance-space-inset-lg);

    color: var(--st-content-foreground-color-neutral-primary);
    background-color: var(--st-content-background-color-default-subtle-normal);
    border-radius: var(--st-global-radius-xs);
  }

  &__cart-badge {
    position: absolute;
    top: 3px;
    right: 3px;

    display: flex;
    align-items: center;
    justify-content: center;

    padding: 0 var(--st-global-distance-space-inset-sm);
    min-width: 16px;
    height: 16px;

    @include font('label-xxs');

    color: var(--st-action-foreground-color-onprimary-normal);
    background-color: var(--st-content-background-color-negative-explicit);
    border-radius: var(--st-global-radius-pill);
  }
}
</style>
