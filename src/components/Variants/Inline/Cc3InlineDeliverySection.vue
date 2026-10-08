<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import Cc3Icon from '@/components/Icon/Cc3Icon.vue'
import { useAddressGuard } from '@/composables/useAddressGuard'
import { useCheckout } from '@/composables/useCheckout'
import {
  composeAddressExtras,
  joinAddressCard,
  selectedAddressCard,
} from '@/stand/config/addressLine'
import { useStand } from '@/stand/composables/useStand'

import type { DeliveryProfile } from '../Modal/deliveryProfile'
import Cc3InlineAddressBook from './Cc3InlineAddressBook.vue'
import Cc3InlineDeliveryForm from './Cc3InlineDeliveryForm.vue'
import Cc3InlinePickupDialog from './Cc3InlinePickupDialog.vue'

/**
 * Блок доставки инлайн-концепта — тот же набор состояний, что и в модальном
 * (пусто / заполнено / адресная книга / форма курьера / пункт самовывоза),
 * но адресная книга и форма курьера разворачиваются прямо в теле страницы,
 * а не попапом. Попапом остаётся только выбор пункта самовывоза — ему
 * нужна карта на весь экран (см. Cc3InlinePickupDialog).
 */
/**
 * Выбранный адрес нужен снаружи: блок вариантов доставки стоит в теле
 * чекаута и должен знать, выбран ли уже адрес и курьерский ли он — до
 * этого показывать сроки и цены не от чего.
 */
const emit = defineEmits<{ selected: [profile: DeliveryProfile | undefined] }>()

const { savedAddressBookEntries, formatMoneyRounded } = useCheckout()
const { country, user, t } = useStand()

function toProfiles(): DeliveryProfile[] {
  return savedAddressBookEntries.value.map((entry) => ({
    id: entry.id,
    method: entry.method,
    typeLabel:
      entry.method === 'courier' ? t('concept.delivery.method.label') : entry.methodLabel,
    fields: entry.fields,
    name: entry.fullName,
    // В книге адрес стоит одной строкой — список выбирают, а не читают как
    // конверт. Но квартира в нём должна быть: в США и Европе она часть
    // строки доставки, и книга собирает её из полей, чтобы не расходиться
    // с карточкой в чекауте. Прод-версия берёт ту же книгу и остаётся на
    // своей строке — контрольную версию правка не трогает.
    addressLine: joinAddressCard(
      selectedAddressCard(country.value, entry.fields, entry.addressLine, t),
    ),
    priceLabel: `${t('delivery.eta')}, ${
      entry.price > 0 ? formatMoneyRounded(entry.price) : t('delivery.free')
    }`,
    phone: entry.phone,
    email: entry.email,
  }))
}

const text = computed(() => ({
  change: t('common.change'),
  hours: t('pickup.hours'),
  hoursWeekday: t('pickup.hours.weekday'),
  hoursWeekend: t('pickup.hours.weekend'),
}))

const addressBookEntries = ref<DeliveryProfile[]>(toProfiles())

type Mode = 'summary' | 'book' | 'form'

function defaultSelectedId() {
  return addressBookEntries.value[0]?.id
}

const selectedEntryId = ref<string | undefined>(defaultSelectedId())
const editingEntryId = ref<string>()
const isPickupDialogOpen = ref(false)
const sectionRef = ref<HTMLElement>()

/**
 * Пустая книга — форма курьера разворачивается сразу, без промежуточной
 * кнопки «Добавить адрес» (в отличие от модального концепта): по макету
 * инлайна первый экран — это уже развёрнутая форма.
 */
const mode = ref<Mode>(selectedEntryId.value ? 'summary' : 'form')

watch([country, user], () => {
  addressBookEntries.value = toProfiles()
  selectedEntryId.value = defaultSelectedId()
  editingEntryId.value = undefined
  isPickupDialogOpen.value = false
  mode.value = selectedEntryId.value ? 'summary' : 'form'
})

const selectedEntry = computed(() =>
  addressBookEntries.value.find((entry) => entry.id === selectedEntryId.value),
)

/**
 * Цена показывается только у пункта выдачи. У курьера её показывает блок
 * вариантов ниже, и дублировать её в карточке значит называть цену до
 * того, как человек выбрал способ. У пункта выдачи такого блока нет: срок
 * и цена принадлежат самому пункту, и без них карточка остаётся вообще
 * без единственного числа на экране.
 */
const isPriceVisible = computed(() => selectedEntry.value?.method === 'pickup')

// Пока адрес выбирают или редактируют, снаружи он считается не выбранным:
// блок вариантов доставки в чекауте не должен висеть над открытой формой.
watch(
  [selectedEntry, mode],
  () => {
    emit('selected', mode.value === 'summary' ? selectedEntry.value : undefined)
  },
  { immediate: true },
)
/**
 * Открыта адресная книга, а адрес из неё не выбран — кнопки «Сохранить» на
 * экране нет, и возвращать человека сторожу некуда. Тогда прокручиваем к
 * самому блоку доставки: выбор адреса в этом состоянии и есть то действие,
 * которого от него ждут.
 */
const { registerBlockAnchor } = useAddressGuard()

onMounted(() => {
  registerBlockAnchor(() => {
    sectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
})

onBeforeUnmount(() => registerBlockAnchor(undefined))

/**
 * Адрес карточки: строка доставки и под ней город с индексом. Где адрес
 * пишется одной строкой (СНГ), вторая пустая и не рисуется.
 */
const addressCard = computed(() =>
  selectedAddressCard(
    country.value,
    selectedEntry.value?.fields,
    selectedEntry.value?.addressLine ?? '',
    t,
  ),
)

/**
 * Строка уточнений под адресом, как в карточке Озона: квартира, подъезд,
 * домофон, этаж. До этого в чекауте стояла одна улица, и всё, что человек
 * ввёл ниже по форме, на экран не возвращалось.
 */
const selectedExtras = computed(() =>
  composeAddressExtras(country.value, selectedEntry.value?.fields, t),
)

const selectedContact = computed(() => {
  const entry = selectedEntry.value

  if (!entry) {
    return ''
  }

  return [entry.name, entry.phone].filter(Boolean).join(', ')
})

const editingEntry = computed(() =>
  addressBookEntries.value.find((entry) => entry.id === editingEntryId.value),
)

/** Попап пункта самовывоза получает editProfile, только если это его профиль. */
const pickupEditProfile = computed(() =>
  editingEntry.value?.method === 'pickup' ? editingEntry.value : undefined,
)

function openBook() {
  mode.value = 'book'
}

function onCloseBook() {
  mode.value = 'summary'
}

function onAddNew() {
  editingEntryId.value = undefined
  mode.value = 'form'
}

function onEditEntry(id: string) {
  editingEntryId.value = id

  const entry = addressBookEntries.value.find((item) => item.id === id)

  if (entry?.method === 'pickup') {
    isPickupDialogOpen.value = true
  } else {
    mode.value = 'form'
  }
}

function onSelectEntry(id: string) {
  selectedEntryId.value = id
  mode.value = 'summary'
}

function onOpenPickup() {
  isPickupDialogOpen.value = true
}

function upsertProfile(profile: DeliveryProfile) {
  const index = addressBookEntries.value.findIndex((entry) => entry.id === profile.id)

  if (index === -1) {
    addressBookEntries.value = [profile, ...addressBookEntries.value]
  } else {
    addressBookEntries.value = addressBookEntries.value.map((entry) =>
      entry.id === profile.id ? profile : entry,
    )
  }

  selectedEntryId.value = profile.id
  editingEntryId.value = undefined
  isPickupDialogOpen.value = false
  mode.value = 'summary'

  // Форма курьера длиннее свёрнутой карточки: без этого после сохранения
  // страница остаётся проскроленной туда, где раньше были её нижние поля.
  void nextTick(() => sectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

function deleteEntry(id: string) {
  const wasSelected = selectedEntryId.value === id

  addressBookEntries.value = addressBookEntries.value.filter((entry) => entry.id !== id)
  editingEntryId.value = undefined
  isPickupDialogOpen.value = false

  if (wasSelected) {
    selectedEntryId.value = undefined
  }

  // Как и в модальном концепте: удалённый активный адрес не подменяем
  // молча следующим сохранённым — возвращаем в адресную книгу для явного
  // выбора. Если книга опустела совсем, показываем форму, как при первом входе.
  mode.value = addressBookEntries.value.length === 0 ? 'form' : 'book'
}
</script>

<template>
  <section ref="sectionRef" class="cc3-inline-delivery">
    <template v-if="mode === 'summary' && selectedEntry">
      <div class="cc3-inline-delivery__row">
        <span class="cc3-inline-delivery__method">{{ selectedEntry.typeLabel }}</span>
        <button type="button" class="cc3-inline-delivery__change" @click="openBook">
          <Cc3Icon name="edit-01" :size="16" />
          {{ text.change }}
        </button>
      </div>

      <div class="cc3-inline-delivery__info">
        <p class="cc3-inline-delivery__address">{{ addressCard.street }}</p>
        <p v-if="addressCard.locality" class="cc3-inline-delivery__address">
          {{ addressCard.locality }}
        </p>
        <p v-if="selectedExtras" class="cc3-inline-delivery__extras">{{ selectedExtras }}</p>
      </div>

      <p v-if="isPriceVisible" class="cc3-inline-delivery__price">
        {{ selectedEntry.priceLabel }}
      </p>

      <div v-if="selectedEntry.method === 'pickup'" class="cc3-inline-delivery__hours">
        <p class="cc3-inline-delivery__hours-title">{{ text.hours }}</p>
        <p class="cc3-inline-delivery__hours-text">
          {{ text.hoursWeekday }}
          <br />
          {{ text.hoursWeekend }}
        </p>
      </div>

      <p class="cc3-inline-delivery__name">{{ selectedContact }}</p>
    </template>

    <Cc3InlineAddressBook
      v-else-if="mode === 'book'"
      :entries="addressBookEntries"
      :selected-id="selectedEntryId"
      @select="onSelectEntry"
      @edit="onEditEntry"
      @add="onAddNew"
      @close="onCloseBook"
    />

    <Cc3InlineDeliveryForm
      v-else
      :edit-profile="editingEntry && editingEntry.method === 'courier' ? editingEntry : undefined"
      @confirm="upsertProfile"
      @delete="deleteEntry"
      @open-pickup="onOpenPickup"
    />

    <Cc3InlinePickupDialog
      v-if="isPickupDialogOpen"
      :edit-profile="pickupEditProfile"
      @close="isPickupDialogOpen = false"
      @confirm="upsertProfile"
      @delete="deleteEntry"
    />
  </section>
</template>

<style lang="scss">
.cc3-inline-delivery {
  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: var(--st-global-distance-space-inset-sm) var(--st-global-distance-space-inset-2xl);
  }

  &__method {
    @include font('heading-xxs');

    color: var(--st-content-foreground-color-neutral-primary);
  }

  &__change {
    display: inline-flex;
    align-items: center;
    gap: var(--st-global-distance-space-inline-xs);

    padding: var(--st-global-distance-space-inset-lg);

    @include font('label-sm');

    color: var(--st-action-foreground-color-positive-normal);
    background: none;
    border: none;
    cursor: pointer;
    transform: translateX(var(--st-global-distance-space-inset-md));
  }

  &__info {
    padding: 0 var(--st-global-distance-space-inset-2xl);
  }

  // Уточнения адреса тише самой улицы: это подробности для курьера,
  // а не то, по чему человек узнаёт карточку.
  &__extras {
    margin: var(--st-global-distance-space-inset-xs) 0 0;

    @include font('body-sm');

    color: var(--st-content-foreground-color-neutral-secondary);
  }

  &__name {
    margin: 0;
    padding: var(--st-global-distance-space-inset-md)
      var(--st-global-distance-space-inset-2xl) var(--st-global-distance-space-inset-2xl);

    @include font('body-md');
    font-weight: 700;

    color: var(--st-content-foreground-color-neutral-primary);
  }

  &__address {
    margin: 0;

    @include font('body-md');

    color: var(--st-content-foreground-color-neutral-primary);
  }

  &__price {
    margin: 0;
    padding: var(--st-global-distance-space-inset-xs) var(--st-global-distance-space-inset-2xl)
      var(--st-global-distance-space-inset-xl);

    @include font('body-md');
    font-weight: 700;

    color: var(--st-content-foreground-color-neutral-primary);
  }

  &__hours {
    padding: 0 var(--st-global-distance-space-inset-2xl);
  }

  &__hours-title {
    margin: 0 0 var(--st-global-distance-space-inset-xs);

    @include font('label-md');

    color: var(--st-content-foreground-color-neutral-primary);
  }

  &__hours-text {
    margin: 0;

    @include font('body-sm');

    color: var(--st-content-foreground-color-neutral-secondary);
  }
}
</style>
