<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import Cc3Icon from '@/components/Icon/Cc3Icon.vue'
import { useAddressGuard } from '@/composables/useAddressGuard'
import { useCheckout } from '@/composables/useCheckout'
import {
  composeAddressExtras,
  joinAddressCard,
  selectedAddressCard,
} from '@/stand/config/addressLine'
import { useStand } from '@/stand/composables/useStand'

import Cc3ModalAddressBook from './Cc3ModalAddressBook.vue'
import Cc3ModalDeliveryDialog from './Cc3ModalDeliveryDialog.vue'
import type { DeliveryProfile } from './deliveryProfile'

// Адресная книга приходит из ядра стенда: состав задаёт страна, наличие —
// тип пользователя. Оформление карточек по макету Figma (узел 2171:41208)
// не меняется, меняется только источник данных.
//
// Список остаётся ref, потому что диалог добавляет, правит и удаляет
// карточки по ходу сессии. При смене страны или типа пользователя он
// пересобирается заново — правки предыдущей конфигурации не протекают.
const { savedAddressBookEntries, formatMoneyRounded } = useCheckout()
const { country, user, t } = useStand()

const emit = defineEmits<{ selected: [profile: DeliveryProfile | undefined] }>()

/**
 * Выбранный вариант курьерской доставки. Живёт в чекауте: скорость
 * выбирается только там, как в инлайн-концепте. Диалогу он передаётся
 * лишь для того, чтобы подписать созданную карточку той же строкой.
 */
const courierVariant = defineModel<string>('courierVariant', { default: 'standard' })

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
  title: t('delivery.section.title'),
  addAddress: t('delivery.addAddress'),
  methodRequired: t('delivery.methodRequired'),
  change: t('common.change'),
  hours: t('pickup.hours'),
  hoursWeekday: t('pickup.hours.weekday'),
  hoursWeekend: t('pickup.hours.weekend'),
}))

const addressBookEntries = ref<DeliveryProfile[]>(toProfiles())

/**
 * У пользователя с сохранёнными адресами один из них выбран на старте —
 * иначе он встречает пустой экран «Добавить адрес» и сценарий выбора
 * из книги вообще не запускается.
 */
function defaultSelectedId() {
  return addressBookEntries.value[0]?.id
}

watch([country, user], () => {
  addressBookEntries.value = toProfiles()
  selectedEntryId.value = defaultSelectedId()
  editingEntryId.value = undefined
})

/**
 * Попытка оплатить без адреса возвращает человека сюда: страница
 * прокручивается к блоку доставки, над кнопкой «Добавить адрес» встаёт
 * строка с требованием.
 */
const { isWarningVisible, registerBlockAnchor } = useAddressGuard()
const sectionRef = ref<HTMLElement>()

onMounted(() => {
  registerBlockAnchor(() => {
    sectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
})

onBeforeUnmount(() => registerBlockAnchor(undefined))

const selectedEntryId = ref<string | undefined>(addressBookEntries.value[0]?.id)
const editingEntryId = ref<string>()
const isAddressBookOpen = ref(false)
const isDialogOpen = ref(false)
const isFilled = computed(() => selectedEntryId.value !== undefined)
const selectedEntry = computed(() =>
  addressBookEntries.value.find((entry) => entry.id === selectedEntryId.value),
)

/**
 * У курьера цена ушла из карточки адреса — её называет блок вариантов
 * доставки в теле чекаута. У пункта выдачи цена осталась: блока для него
 * нет, срок и цена принадлежат самому пункту.
 */
const isPriceVisible = computed(() => selectedEntry.value?.method === 'pickup')

// Пока открыт диалог адреса или адресная книга, снаружи адрес считается
// не выбранным: блок вариантов не должен висеть над открытой формой.
watch(
  [selectedEntry, isDialogOpen, isAddressBookOpen],
  () => {
    const isBusy = isDialogOpen.value || isAddressBookOpen.value

    emit('selected', isBusy ? undefined : selectedEntry.value)
  },
  { immediate: true },
)

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

function openAddressBook() {
  isAddressBookOpen.value = true
}

function openDialog() {
  editingEntryId.value = undefined
  isDialogOpen.value = true
}

function onSelectEntry(id: string) {
  selectedEntryId.value = id
  isAddressBookOpen.value = false
}

function onEditEntry(id: string) {
  editingEntryId.value = id
  isAddressBookOpen.value = false
  isDialogOpen.value = true
}

function onAddNew() {
  editingEntryId.value = undefined
  isAddressBookOpen.value = false
  isDialogOpen.value = true
}

function closeDialog() {
  editingEntryId.value = undefined
  isDialogOpen.value = false
}

function onDialogConfirm(profile: DeliveryProfile) {
  const index = addressBookEntries.value.findIndex((entry) => entry.id === profile.id)

  if (index === -1) {
    addressBookEntries.value = [profile, ...addressBookEntries.value]
  } else {
    addressBookEntries.value = addressBookEntries.value.map((entry) =>
      entry.id === profile.id ? profile : entry,
    )
  }

  selectedEntryId.value = profile.id
  closeDialog()
}

function onDialogDelete(id: string) {
  const wasSelected = selectedEntryId.value === id

  addressBookEntries.value = addressBookEntries.value.filter((entry) => entry.id !== id)

  if (wasSelected) {
    selectedEntryId.value = undefined
  }

  closeDialog()

  // Удалённый адрес был активным — не подставляем следующий сохранённый
  // молча (риск отправить заказ не туда), а возвращаем в адресную книгу
  // для явного выбора.
  if (wasSelected) {
    isAddressBookOpen.value = true
  }
}
</script>

<template>
  <section ref="sectionRef" class="cc3-modal-delivery">
    <h2 v-if="!isFilled" class="cc3-modal-delivery__title">{{ text.title }}</h2>

    <div v-if="!isFilled" class="cc3-modal-delivery__empty">
      <p v-if="isWarningVisible" class="cc3-modal-delivery__warning">
        {{ text.methodRequired }}
      </p>

      <button type="button" class="cc3-modal-delivery__add" @click="openDialog">
        <Cc3Icon name="plus-md" :size="24" />
        {{ text.addAddress }}
      </button>
    </div>

    <div v-else-if="selectedEntry" class="cc3-modal-delivery__filled">
      <div class="cc3-modal-delivery__row">
        <span class="cc3-modal-delivery__method">{{ selectedEntry.typeLabel }}</span>
        <button type="button" class="cc3-modal-delivery__change" @click="openAddressBook">
          <Cc3Icon name="edit-01" :size="16" />
          {{ text.change }}
        </button>
      </div>

      <div class="cc3-modal-delivery__info">
        <p class="cc3-modal-delivery__address">{{ addressCard.street }}</p>
        <p v-if="addressCard.locality" class="cc3-modal-delivery__address">
          {{ addressCard.locality }}
        </p>
        <p v-if="selectedExtras" class="cc3-modal-delivery__extras">{{ selectedExtras }}</p>
      </div>

      <p v-if="isPriceVisible" class="cc3-modal-delivery__price">
        {{ selectedEntry.priceLabel }}
      </p>

      <div v-if="selectedEntry.method === 'pickup'" class="cc3-modal-delivery__hours">
        <p class="cc3-modal-delivery__hours-title">{{ text.hours }}</p>
        <p class="cc3-modal-delivery__hours-text">
          {{ text.hoursWeekday }}
          <br />
          {{ text.hoursWeekend }}
        </p>
      </div>

      <p class="cc3-modal-delivery__name">{{ selectedContact }}</p>
    </div>

    <Cc3ModalAddressBook
      v-if="isAddressBookOpen"
      :entries="addressBookEntries"
      :selected-id="selectedEntryId"
      @close="isAddressBookOpen = false"
      @select="onSelectEntry"
      @edit="onEditEntry"
      @add="onAddNew"
    />

    <Cc3ModalDeliveryDialog
      v-if="isDialogOpen"
      :edit-profile="editingEntry"
      :variant-id="courierVariant"
      @close="closeDialog"
      @confirm="onDialogConfirm"
      @delete="onDialogDelete"
    />
  </section>
</template>

<style lang="scss">
.cc3-modal-delivery {
  &__title {
    margin: 0;
    padding: var(--st-global-distance-space-inset-sm) var(--st-global-distance-space-inset-2xl);

    @include font('heading-xxs');

    color: var(--st-content-foreground-color-neutral-primary);
  }

  &__empty {
    padding: var(--st-global-distance-space-inset-md) var(--st-global-distance-space-inset-2xl)
      var(--st-global-distance-space-inset-2xl);
  }

  // Без рамки и подложки: в рамке строка встаёт над кнопкой второй
  // кнопкой, а нажимать на неё нечего.
  &__warning {
    margin: 0 0 var(--st-global-distance-space-inset-md);

    @include font('body-sm');

    color: var(--st-content-foreground-color-negative-primary);
  }

  &__add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--st-global-distance-space-inline-sm);

    padding: var(--st-global-distance-space-inset-xl);
    width: 100%;

    @include font('label-md');

    color: var(--st-action-foreground-color-positive-normal);
    background-color: var(--st-action-background-color-positive-subtle-normal);
    border: none;
    border-radius: var(--st-global-radius-lg);
    cursor: pointer;
  }

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
    transform: translateX(var(--st-global-distance-space-inset-md));
    cursor: pointer;
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
