<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useAddressGuard } from '@/composables/useAddressGuard'
import { useCourierVariants } from '@/composables/useCourierVariants'
import Cc3StandField from '@/stand/components/Cc3StandField.vue'
import { composeAddressLine } from '@/stand/config/addressLine'
import { useStand } from '@/stand/composables/useStand'
import { useStandFields } from '@/stand/composables/useStandFields'
import { useStandProfile } from '@/stand/composables/useStandProfile'
import type { FieldKey } from '@/stand/config/types'
import { applySuggestion } from '@/stand/suggest'
import type { AddressSuggestion } from '@/stand/suggest'

import Cc3ModalConfirmDialog from '../Modal/Cc3ModalConfirmDialog.vue'
import type { DeliveryProfile } from '../Modal/deliveryProfile'

/**
 * Форма адреса курьера — разворачивается прямо в теле страницы, без
 * попапа и без карты (по макету инлайн-концепта, в отличие от модального).
 * Самовывоз в неё не заходит: клик по сегменту Pickup сразу открывает
 * Cc3InlinePickupDialog, у него своя карта и свой список пунктов.
 */
const props = defineProps<{
  editProfile?: DeliveryProfile
}>()

const emit = defineEmits<{
  confirm: [profile: DeliveryProfile]
  delete: [id: string]
  'open-pickup': []
}>()

const { t, country } = useStand()
const { courierVariants } = useCourierVariants()
const { recipientValues } = useStandProfile()

const text = computed(() => ({
  courier: t('concept.delivery.courier.title'),
  pickup: t('concept.delivery.pickup.action'),
  addressSection: t('address.title'),
  recipientSection: t('group.recipient.title'),
  save: t('common.save'),
  saveRequired: t('address.saveRequired'),
  remove: t('common.delete'),
}))

/**
 * Попытка оплатить с несохранённым адресом возвращает человека сюда:
 * предупреждение встаёт над кнопкой «Сохранить», а сама кнопка
 * прокручивается в видимую часть экрана.
 */
const { isWarningVisible, registerSaveAnchor } = useAddressGuard()
const actionsRef = ref<HTMLElement>()

onMounted(() => {
  registerSaveAnchor(() => {
    actionsRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
})

onBeforeUnmount(() => registerSaveAnchor(undefined))

/**
 * Способ доставки выбирается не здесь, а блоком в теле чекаута, поэтому
 * в карточку кладём подпись первого варианта. Для курьера она всё равно
 * не показывается — цену называет блок вариантов.
 */
const defaultCourierSummary = computed(() => courierVariants.value[0]?.summary ?? '')

const { fields: addressFields } = useStandFields('address')
const { fields: recipientFields } = useStandFields('recipient')

/**
 * У нас нет флоу с типами адреса «Дом / Работа / Своё название» — только
 * пометка «любимый» сердечком, которая потом показывается в адресной книге.
 * Поле есть в конфиге СНГ-рынков (src/stand/config/countries.ts), но в этой
 * форме не рендерится — состав и порядок остальных полей не трогаем.
 */
const renderedAddressFields = computed(() =>
  addressFields.value.filter((field) => field.key !== 'addressLabel'),
)

const values = ref<Partial<Record<FieldKey, string>>>({})

/**
 * Новый адрес открывается с получателем из профиля, сохранённый — со своими
 * данными. Пустой блок получателя человек читает как обязательный к
 * заполнению и вводит себя заново, хотя магазин его уже знает.
 */
function seedValues() {
  const profile = props.editProfile

  if (!profile) {
    values.value = { ...recipientValues.value }

    return
  }

  const [firstName = '', ...rest] = profile.name.trim().split(/\s+/)

  values.value = {
    ...profile.fields,
    street: profile.fields?.street ?? profile.addressLine,
    recipientName: profile.name,
    recipientFirstName: firstName,
    recipientLastName: rest.join(' '),
    recipientPhone: profile.phone,
    recipientEmail: profile.email,
  }
}

seedValues()

watch(country, seedValues)

function onSuggestionSelect(suggestion: AddressSuggestion) {
  values.value = applySuggestion(values.value, 'street', suggestion, addressFields.value, country.value)
}

const recipientDisplayName = computed(() =>
  values.value.recipientName?.trim() ||
  [values.value.recipientFirstName, values.value.recipientLastName].filter(Boolean).join(' '),
)

const isDeleteConfirmOpen = ref(false)

// Строка карточки собирается из полей формы по местному порядку —
// см. composeAddressLine. Одна улица без индекса и города читается как
// недозаполненный адрес.
const addressLine = computed(() => composeAddressLine(country.value, values.value, t))

const confirmedProfile = computed<DeliveryProfile>(() => {
  return {
    id: props.editProfile?.id ?? `profile-${Date.now()}`,
    method: 'courier',
    typeLabel: t('concept.delivery.method.label'),
    name: recipientDisplayName.value,
    addressLine: addressLine.value,
    priceLabel: defaultCourierSummary.value,
    phone: values.value.recipientPhone ?? '',
    email: values.value.recipientEmail ?? '',
    fields: values.value,
  }
})

function confirm() {
  emit('confirm', confirmedProfile.value)
}

function deleteProfile() {
  isDeleteConfirmOpen.value = false

  if (props.editProfile) {
    emit('delete', props.editProfile.id)
  }
}
</script>

<template>
  <div class="cc3-inline-delivery-form">
    <div class="cc3-inline-delivery-form__tabs">
      <button type="button" class="cc3-inline-delivery-form__tab cc3-inline-delivery-form__tab--active">
        {{ text.courier }}
      </button>
      <button
        type="button"
        class="cc3-inline-delivery-form__tab"
        @click="$emit('open-pickup')"
      >
        {{ text.pickup }}
      </button>
    </div>

    <h3 class="cc3-inline-delivery-form__section-title">{{ text.addressSection }}</h3>

    <div class="cc3-inline-delivery-form__fields">
      <Cc3StandField
        v-for="field in renderedAddressFields"
        :key="field.key"
        v-model="values[field.key]"
        :field="field"
        @select="onSuggestionSelect"
      />
    </div>

    <h3 class="cc3-inline-delivery-form__section-title">{{ text.recipientSection }}</h3>

    <div class="cc3-inline-delivery-form__fields">
      <Cc3StandField
        v-for="field in recipientFields"
        :key="field.key"
        v-model="values[field.key]"
        :field="field"
      />
    </div>

    <p v-if="isWarningVisible" class="cc3-inline-delivery-form__warning">
      {{ text.saveRequired }}
    </p>

    <div ref="actionsRef" class="cc3-inline-delivery-form__actions">
      <template v-if="editProfile">
        <button type="button" class="cc3-inline-delivery-form__continue" @click="confirm">
          {{ text.save }}
        </button>
        <button
          type="button"
          class="cc3-inline-delivery-form__delete"
          @click="isDeleteConfirmOpen = true"
        >
          {{ text.remove }}
        </button>
      </template>

      <button v-else type="button" class="cc3-inline-delivery-form__continue" @click="confirm">
        {{ text.save }}
      </button>
    </div>

    <Cc3ModalConfirmDialog
      v-if="isDeleteConfirmOpen"
      message="Do you want to delete this address?"
      @confirm="deleteProfile"
      @cancel="isDeleteConfirmOpen = false"
    />
  </div>
</template>

<style lang="scss">
.cc3-inline-delivery-form {
  display: flex;
  flex-direction: column;

  padding: 0 var(--st-global-distance-space-inset-2xl);

  &__tabs {
    display: flex;
    gap: var(--st-global-distance-space-inset-none);

    margin: var(--st-global-distance-space-inset-lg) 0 var(--st-global-distance-space-inset-xl);
    padding: var(--st-global-distance-space-inset-xs);

    background-color: var(--st-content-background-color-neutral-onsubtle);
    border-radius: var(--st-global-radius-xl);
  }

  &__tab {
    flex: 1;

    padding: var(--st-global-distance-space-inset-md) var(--st-global-distance-space-inset-2xl);

    @include font('body-sm');

    color: var(--st-content-foreground-color-neutral-primary);
    background: none;
    border: none;
    border-radius: var(--st-global-radius-md);
    cursor: pointer;

    &--active {
      background-color: var(--st-content-background-color-default-solid-normal);
      box-shadow:
        0 1px 4px 0 rgb(4 8 13 / 8%),
        0 1px 2px 0 rgb(4 8 13 / 8%);
    }
  }

  &__section-title {
    margin: 0;
    padding: var(--st-global-distance-space-inset-sm) 0;

    @include font('heading-xxs');

    color: var(--st-content-foreground-color-neutral-primary);
  }

  &__fields {
    display: flex;
    flex-wrap: wrap;
    gap: 0 var(--st-global-distance-space-inset-2xl);

    padding-bottom: var(--st-global-distance-space-inset-sm);

    // half — не своя модификация, а флаг из конфига страны (см. Cc3StandField):
    // поле встаёт в половину строки, а не на всю ширину.
    .cc3-stand-field--half {
      flex: 1 1 calc(50% - var(--st-global-distance-space-inset-2xl));
      min-width: 140px;
    }
  }

  // Предупреждение стоит вплотную над кнопкой, к которой оно относится:
  // человек прокручен именно сюда и читает строку и кнопку вместе.
  // Без рамки и подложки: в рамке со скруглением оно читается как ещё
  // одна кнопка над «Сохранить», а нажимать тут нечего.
  &__warning {
    margin: 0;

    @include font('body-sm');

    color: var(--st-content-foreground-color-negative-primary);
  }

  &__actions {
    display: flex;
    flex-direction: column;
    gap: var(--st-global-distance-space-inset-xl);

    padding: var(--st-global-distance-space-inset-xl) 0 var(--st-global-distance-space-inset-2xl);
  }

  &__continue,
  &__delete {
    display: flex;
    align-items: center;
    justify-content: center;

    padding: var(--st-global-distance-space-inset-lg);
    width: 100%;
    height: 44px;

    font-family: inherit;

    @include font('label-md');

    border: none;
    border-radius: var(--st-global-radius-md);
    cursor: pointer;
  }

  &__continue {
    color: var(--st-action-foreground-color-onprimary-normal);
    background-color: var(--st-action-background-color-positive-normal);
  }

  &__delete {
    color: var(--st-action-foreground-color-neutral-normal);
    background-color: var(--st-content-background-color-default-solid-normal);
    border: 1px solid var(--st-action-border-color-neutral-subtle-normal);
  }
}
</style>
