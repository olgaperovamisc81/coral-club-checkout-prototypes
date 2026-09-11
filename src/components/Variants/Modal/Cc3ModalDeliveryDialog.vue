<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import Cc3InputField from '@/components/Field/Cc3InputField.vue'
import Cc3Icon from '@/components/Icon/Cc3Icon.vue'
import Cc3Map from '@/components/Map/Cc3Map.vue'
import Cc3MapPin from '@/components/Map/Cc3MapPin.vue'
import type { MapPoint } from '@/components/Map/mapTypes'
import { useCheckout, type PickupProvider } from '@/composables/useCheckout'
import Cc3StandField from '@/stand/components/Cc3StandField.vue'
import { useStand } from '@/stand/composables/useStand'
import { useStandFields } from '@/stand/composables/useStandFields'
import { useStandProfile } from '@/stand/composables/useStandProfile'
import type { FieldKey } from '@/stand/config/types'
import { applySuggestion, reverseAddress } from '@/stand/suggest'
import type { AddressSuggestion } from '@/stand/suggest'
import { formatPriceRounded } from '@/utils/formatPrice'

import Cc3ModalConfirmDialog from './Cc3ModalConfirmDialog.vue'
import type { DeliveryProfile } from './deliveryProfile'

type Method = 'courier' | 'pickup'
type Step = 'search' | 'address-form' | 'pickup-detail'

const props = defineProps<{
  /**
   * Если передан — диалог открывается сразу на нужном шаге редактирования
   * этого профиля (адрес для courier, карточка пункта для pickup), а не
   * с поиска. Используется кнопкой-карандашом в адресной книге.
   */
  editProfile?: DeliveryProfile
}>()

const emit = defineEmits<{
  close: []
  confirm: [profile: DeliveryProfile]
  delete: [id: string]
}>()

const { pickupPointsFormat, pickupProviders, togglePickupProvider, mapCenter, pickupProviderLabels, formatMoneyRounded } =
  useCheckout()
const { t, country } = useStand()
const { recipientValues } = useStandProfile()

const text = computed(() => ({
  back: t('common.back'),
  close: t('common.close'),
  title: t('delivery.info.title'),
  courier: t('delivery.method.courier'),
  pickup: t('delivery.pickup.title'),
  findAddress: t('common.findAddress'),
  map: t('common.map'),
  list: t('common.list'),
  variantsTitle: t('delivery.variants'),
  variantsHint: t('delivery.variants.hint'),
  openUntil: t('pickup.openUntil'),
  pickupEmpty: t('pickup.empty'),
  addressSection: t('address.title'),
  addressPlaceholder: t('field.street.placeholder'),
  recipientSection: t('group.recipient.title'),
  favorite: t('address.favorite'),
  hours: t('pickup.hours'),
  hoursWeekday: t('pickup.hours.weekday'),
  hoursWeekend: t('pickup.hours.weekend'),
  directions: t('pickup.directions'),
  contacts: t('pickup.contacts'),
  continue: t('common.continue'),
  save: t('common.save'),
  remove: t('common.delete'),
  filterAll: t('common.all'),
}))

function initialStep(): Step {
  if (!props.editProfile) {
    return 'search'
  }

  return props.editProfile.method === 'courier' ? 'address-form' : 'pickup-detail'
}

const method = ref<Method>(props.editProfile?.method ?? 'courier')
const step = ref<Step>(initialStep())


// Варианты курьерской доставки — копия и цены из макета. Не то же самое,
// что Cc3CheckoutDeliveryVariant в проде: там другой текст и это
// самостоятельный сценарий, здесь — только визуальный прототип.
type CourierVariant = { id: string; title: string; caption?: string }

// Стоимость обычной доставки — демо-значение; форматируется в валюте страны.
const COURIER_PRICE = 149

const courierVariants = computed<CourierVariant[]>(() => [
  {
    id: 'standard',
    title: t('delivery.variant.standard', { price: formatMoneyRounded(COURIER_PRICE) }),
  },
  {
    id: 'express',
    title: t('delivery.variant.express'),
    caption: t('delivery.variant.expressNote'),
  },
])

const selectedCourierVariant = ref('standard')

// Службы разные в разных странах, поэтому фильтры строятся из пунктов
// текущей страны, а не задаются руками.
// Карта/Список — как в инлайн-концепте: чтобы место под картой не уходило
// сразу на список, а переключатель не отъедал отдельную строку, он лежит
// поверх карты (см. стили __view-toggle).
type PickupView = 'map' | 'list'

const view = ref<PickupView>('map')
const pointSearch = ref('')

const providerFilters = computed<{ id: PickupProvider | 'all'; label: string }[]>(() => [
  { id: 'all', label: t('common.all') },
  ...Object.entries(pickupProviderLabels.value).map(([id, label]) => ({
    id: id as PickupProvider,
    label,
  })),
])

function isProviderFilterActive(id: PickupProvider | 'all') {
  return id === 'all' ? pickupProviders.value.length === 0 : pickupProviders.value.includes(id)
}

function onProviderFilterClick(id: PickupProvider | 'all') {
  if (id === 'all') {
    pickupProviders.value = []
    return
  }

  togglePickupProvider(id)
}

const filteredPickupPoints = computed(() => {
  const query = pointSearch.value.trim().toLowerCase()

  return pickupPointsFormat.value.filter((point) => {
    const matchesProvider =
      pickupProviders.value.length === 0 || pickupProviders.value.includes(point.provider)

    const matchesQuery =
      query.length === 0 ||
      point.name.toLowerCase().includes(query) ||
      point.address.toLowerCase().includes(query)

    return matchesProvider && matchesQuery
  })
})

const selectedPickupPointId = ref(pickupPointsFormat.value[0]?.id)
const pointsListRef = ref<HTMLElement>()

/**
 * Клик по метке на карте выбирает пункт, но карточка в списке под картой
 * может быть в этот момент прокручена за пределы видимости (список — свой
 * скролл в 340px) — подскролливаем к ней, а не оставляем гадать, что выбралось.
 */
function selectPoint(id: string) {
  selectedPickupPointId.value = id

  void nextTick(() => {
    pointsListRef.value
      ?.querySelector(`[data-point-id="${id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

const activePickupPoint = computed(() =>
  pickupPointsFormat.value.find((point) => point.id === selectedPickupPointId.value),
)

/**
 * Выбранный пункт всегда должен быть виден в списке. Фильтр по службе
 * и смена страны меняют состав списка — если выбранный из него выпал,
 * выбор переезжает на первый доступный. Иначе внизу висит карточка
 * пункта, которого на карте уже нет.
 */
watch([filteredPickupPoints, country], () => {
  const visible = filteredPickupPoints.value

  if (!visible.some((point) => point.id === selectedPickupPointId.value)) {
    selectedPickupPointId.value = visible[0]?.id
  }
})


const activePickupPointPriceFormatRounded = computed(() =>
  activePickupPoint.value ? formatPriceRounded(activePickupPoint.value.price) : '',
)

type PickupDetailView = {
  title: string
  address: string
  priceLabel: string
  note?: string
  phone?: string
}

/**
 * Данные для шага pickup-detail. При редактировании профиля из адресной
 * книги (editProfile) берём их прямо из карточки — она может не совпадать
 * ни с одним реальным пунктом из pickupPointsFormat (id пункта в профиле
 * не хранится), поэтому часы работы и «как пройти» из фикстуры тут не
 * подходят и просто не показываются.
 */
const pickupDetailView = computed<PickupDetailView | undefined>(() => {
  if (props.editProfile && props.editProfile.method === 'pickup') {
    return {
      title: props.editProfile.typeLabel,
      address: props.editProfile.addressLine,
      priceLabel: props.editProfile.priceLabel,
    }
  }

  if (!activePickupPoint.value) {
    return undefined
  }

  return {
    title: pickupProviderLabels.value[activePickupPoint.value.provider],
    address: activePickupPoint.value.address,
    priceLabel: `${t('delivery.eta')}, ${activePickupPointPriceFormatRounded.value}`,
    note: activePickupPoint.value.note,
    phone: activePickupPoint.value.phone,
  }
})

// Короткая подпись внутри метки на карте — названия служб, не переводятся.
const pickupProviderPinLabel: Record<PickupProvider, string> = {
  office: 'CC',
  cdek: 'CDEK',
  fivepost: '5Post',
  kazpost: 'KZPost',
  dhl: 'DHL',
  inpost: 'InPost',
  zasilkovna: 'Zás.',
  usps: 'USPS',
}

const pickupMapMarkers = computed(() =>
  filteredPickupPoints.value.map((point) => ({
    id: point.id,
    lat: point.lat,
    lng: point.lng,
    // Свой вид метки нарисован только для офиса; остальные службы
    // показываются общим видом перевозчика.
    pinVariant: point.provider === 'office' ? ('office' as const) : ('cdek' as const),
    pinLabel: pickupProviderPinLabel[point.provider],
  })),
)

// Данные формы — демо, в общее состояние useCheckout не пишутся, чтобы
// не задевать прод (там свои recipient/deliveryAddress с другой формой).
//
// Состав полей задаёт страна, поэтому значения лежат в общем объекте по
// ключам полей, а не отдельными ref на каждое: набор ключей меняется от
// рынка к рынку. Пустое значение показывает плейсхолдер с местным
// примером — «Москва, ул. Москворечье, 43» или «350 5th Ave».
const values = ref<Partial<Record<FieldKey, string>>>({})

// Собственная вёрстка вместо Cc3StandFields (черновой заглушки ядра) —
// состав и порядок полей по-прежнему из конфига страны, а оформление,
// сетка в две колонки для half-полей и переходы между брейкпоинтами свои.
const { fields: addressFields } = useStandFields('address')
const { fields: recipientFields } = useStandFields('recipient')

/**
 * У нас нет флоу с типами адреса «Дом / Работа / Своё название» — только
 * пометка «любимый» сердечком, которая потом показывается в адресной книге.
 * Поле addressLabel есть в конфиге СНГ-рынков (src/stand/config/countries.ts),
 * но в этой форме не рендерится — состав и порядок остальных полей не трогаем.
 */
const renderedAddressFields = computed(() =>
  addressFields.value.filter((field) => field.key !== 'addressLabel'),
)

/** Точка выбранного адреса. Пока адрес не выбран, карта стоит на центре города. */
const addressPoint = ref<MapPoint>()

/**
 * Город из выбранной подсказки или из тычка в карту.
 *
 * Хранится отдельно от полей формы: в России отдельного поля города нет,
 * город живёт внутри строки адреса, а знать его всё равно нужно — от него
 * зависят доступные способы доставки.
 */
const resolvedCity = ref('')

/**
 * Способы доставки показываются только после того, как адрес определён.
 * Пока города нет, любой список сроков и цен — выдумка: они считаются
 * от города, и показывать их «на всякий случай» значит врать респонденту.
 */
const isAddressResolved = computed(() => resolvedCity.value.length > 0)

/**
 * Новый адрес открывается с получателем из профиля, сохранённый — со своими
 * данными. Пустой блок получателя человек читает как обязательный к
 * заполнению и вводит себя заново, хотя магазин его уже знает.
 */
function seedValues() {
  const profile = props.editProfile

  addressPoint.value = undefined
  resolvedCity.value = profile ? (profile.fields?.city ?? profile.addressLine) : ''

  if (!profile) {
    values.value = { ...recipientValues.value }

    return
  }

  const [firstName = '', ...rest] = profile.name.trim().split(/\s+/)

  values.value = {
    ...profile.fields,
    street: profile.fields?.street ?? (profile.method === 'courier' ? profile.addressLine : ''),
    recipientName: profile.name,
    recipientFirstName: firstName,
    recipientLastName: rest.join(' '),
    recipientPhone: profile.phone,
    recipientEmail: profile.email,
  }
}

seedValues()

// Смена страны — это другой набор полей и другой формат адреса.
// Значения предыдущей страны в новую форму не переносятся.
watch(country, seedValues)

/** Строка поиска на первом шаге — то же поле адреса, что и в форме. */
const addressSearch = computed({
  get: () => values.value.street ?? '',
  set: (value: string) => {
    values.value = { ...values.value, street: value }
  },
})

/**
 * Поиск на карте — то же поле, что и в форме, только названное по-другому.
 * Брать его из конфига важно: подсказки, клавиатура и разбор подсказки
 * должны вести себя одинаково на обоих шагах.
 */
const searchField = computed(() => {
  const field = addressFields.value.find((item) => item.key === 'street')

  return field ? { ...field, label: text.value.findAddress } : undefined
})

const courierCenter = computed<MapPoint>(() => addressPoint.value ?? mapCenter.value)

const courierMarkers = computed(() => [{ id: 'address', ...courierCenter.value }])

let reverseController: AbortController | undefined

function fillFromSuggestion(suggestion: AddressSuggestion) {
  values.value = applySuggestion(values.value, 'street', suggestion, addressFields.value)

  if (suggestion.city) {
    resolvedCity.value = suggestion.city
  }
}

/** Выбор подсказки — адрес в поля, метка на карту. */
function onSuggestionSelect(suggestion: AddressSuggestion) {
  fillFromSuggestion(suggestion)

  if (suggestion.lat !== undefined && suggestion.lng !== undefined) {
    addressPoint.value = { lat: suggestion.lat, lng: suggestion.lng }
  }
}

/**
 * Тычок в карту — обратное геокодирование. Метка встаёт сразу, адрес
 * подставляется, когда придёт ответ: ждать ответа, чтобы сдвинуть метку,
 * значит показать залипшую карту.
 */
async function onMapSelect(point: MapPoint) {
  addressPoint.value = point

  reverseController?.abort()
  reverseController = new AbortController()

  const suggestion = await reverseAddress(point, country.value, reverseController.signal)

  if (suggestion) {
    fillFromSuggestion(suggestion)
  }
}

const recipientDisplayName = computed(() =>
  values.value.recipientName?.trim() ||
  [values.value.recipientFirstName, values.value.recipientLastName].filter(Boolean).join(' '),
)
const isFavorite = ref(props.editProfile?.isFavorite ?? false)
const isDeleteConfirmOpen = ref(false)

function continueFromSearch() {
  step.value = method.value === 'courier' ? 'address-form' : 'pickup-detail'
}

function back() {
  step.value = 'search'
}

const confirmedProfile = computed<DeliveryProfile>(() => {
  const id = props.editProfile?.id ?? `profile-${Date.now()}`

  if (method.value === 'courier') {
    const variant = courierVariants.value.find((item) => item.id === selectedCourierVariant.value)

    return {
      id,
      method: 'courier',
      typeLabel: t('delivery.method.courier'),
      name: recipientDisplayName.value,
      addressLine: values.value.street ?? '',
      priceLabel: variant?.title ?? '',
      isFavorite: isFavorite.value,
      phone: values.value.recipientPhone ?? '',
      email: values.value.recipientEmail ?? '',
    }
  }

  return {
    id,
    method: 'pickup',
    typeLabel: pickupDetailView.value?.title ?? t('delivery.pickup.title'),
    name: recipientDisplayName.value,
    addressLine: pickupDetailView.value?.address ?? '',
    priceLabel: pickupDetailView.value?.priceLabel ?? '',
    isFavorite: isFavorite.value,
    phone: values.value.recipientPhone ?? '',
    email: values.value.recipientEmail ?? '',
  }
})

function confirm() {
  emit('confirm', confirmedProfile.value)
}

/**
 * Пока модалка открыта, страница под ней не прокручивается.
 * Без этого на телефоне палец, не попавший по содержимому модалки,
 * возит чекаут за ней — выглядит как сломанная вёрстка.
 */
let bodyOverflow = ''

onMounted(() => {
  bodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  document.body.style.overflow = bodyOverflow
})

function deleteProfile() {
  isDeleteConfirmOpen.value = false

  if (props.editProfile) {
    emit('delete', props.editProfile.id)
  }
}

function onOverlayKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      class="cc3-modal-delivery-dialog"
      role="dialog"
      aria-modal="true"
      @keydown="onOverlayKeydown"
    >
      <div class="cc3-modal-delivery-dialog__header">
          <button
            v-if="step !== 'search'"
            type="button"
            class="cc3-modal-delivery-dialog__back"
            :aria-label="text.back"
            @click="back"
          >
            <Cc3Icon name="chevron-down" :size="24" class="cc3-modal-delivery-dialog__back-icon" />
          </button>

          <div v-if="step === 'search'" class="cc3-modal-delivery-dialog__tabs">
            <button
              type="button"
              class="cc3-modal-delivery-dialog__tab"
              :class="{ 'cc3-modal-delivery-dialog__tab--active': method === 'courier' }"
              @click="method = 'courier'"
            >
              {{ text.courier }}
            </button>
            <button
              type="button"
              class="cc3-modal-delivery-dialog__tab"
              :class="{ 'cc3-modal-delivery-dialog__tab--active': method === 'pickup' }"
              @click="method = 'pickup'"
            >
              {{ text.pickup }}
            </button>
          </div>
          <h2 v-else class="cc3-modal-delivery-dialog__title">{{ text.title }}</h2>

          <button
            type="button"
            class="cc3-modal-delivery-dialog__close"
            :aria-label="text.close"
            @click="$emit('close')"
          >
            <Cc3Icon name="x-md" :size="24" />
          </button>
        </div>

        <div class="cc3-modal-delivery-dialog__body">
          <template v-if="step === 'search'">
            <div v-if="method === 'courier'" class="cc3-modal-delivery-dialog__map">
              <Cc3Map
                :center="courierCenter"
                :zoom="14"
                :markers="courierMarkers"
                :height="380"
                @select="onMapSelect"
              >
                <template #marker>
                  <Cc3MapPin variant="address" icon="delivery-truck" />
                </template>
              </Cc3Map>
            </div>

            <template v-if="method === 'courier'">
              <div class="cc3-modal-delivery-dialog__field">
                <Cc3StandField
                  v-if="searchField"
                  v-model="addressSearch"
                  :field="searchField"
                  @select="onSuggestionSelect"
                />
              </div>

              <h3 class="cc3-modal-delivery-dialog__section-title">{{ text.variantsTitle }}</h3>

              <p v-if="!isAddressResolved" class="cc3-modal-delivery-dialog__variants-hint">
                {{ text.variantsHint }}
              </p>

              <div v-else class="cc3-modal-delivery-dialog__variants">
                <label
                  v-for="variant in courierVariants"
                  :key="variant.id"
                  class="cc3-modal-delivery-dialog__cell"
                >
                  <span class="cc3-modal-delivery-dialog__cell-content">
                    <span class="cc3-modal-delivery-dialog__cell-title">{{ variant.title }}</span>
                    <span v-if="variant.caption" class="cc3-modal-delivery-dialog__cell-caption">
                      {{ variant.caption }}
                    </span>
                  </span>
                  <input
                    v-model="selectedCourierVariant"
                    type="radio"
                    name="courier-variant"
                    :value="variant.id"
                    class="cc3-modal-delivery-dialog__radio"
                  />
                </label>
              </div>
            </template>

            <template v-else>
              <div
                class="cc3-modal-delivery-dialog__pickup-map-area"
                :class="{ 'cc3-modal-delivery-dialog__pickup-map-area--map': view === 'map' }"
              >
                <!-- Кнопки не должны сдвигаться при переключении Карта/Список,
                     поэтому bleed-отступ карты — на самой карте, а не на общем
                     родителе: иначе он двигал бы и кнопки вместе с картой. -->
                <div class="cc3-modal-delivery-dialog__view-toggle">
                  <button
                    type="button"
                    class="cc3-modal-delivery-dialog__view-btn"
                    :class="{ 'cc3-modal-delivery-dialog__view-btn--active': view === 'map' }"
                    @click="view = 'map'"
                  >
                    <Cc3Icon name="location-map" :size="20" />
                    {{ text.map }}
                  </button>
                  <button
                    type="button"
                    class="cc3-modal-delivery-dialog__view-btn"
                    :class="{ 'cc3-modal-delivery-dialog__view-btn--active': view === 'list' }"
                    @click="view = 'list'"
                  >
                    <Cc3Icon name="layout-list" :size="20" />
                    {{ text.list }}
                  </button>
                </div>

                <Cc3Map
                  v-if="view === 'map'"
                  :center="mapCenter"
                  :zoom="9"
                  :markers="pickupMapMarkers"
                  :height="380"
                  class="cc3-modal-delivery-dialog__pickup-map-canvas"
                >
                  <template #marker="{ marker }">
                    <Cc3MapPin
                      :label="marker.pinLabel"
                      :variant="marker.pinVariant"
                      :selected="marker.id === selectedPickupPointId"
                      @click="selectPoint(marker.id)"
                    />
                  </template>
                </Cc3Map>
              </div>

              <div
                class="cc3-modal-delivery-dialog__pickup-panel"
                :class="{ 'cc3-modal-delivery-dialog__pickup-panel--capped': view === 'map' }"
              >
                <div class="cc3-modal-delivery-dialog__field">
                  <span class="cc3-modal-delivery-dialog__label">{{ text.findAddress }}</span>
                  <Cc3InputField v-model="pointSearch" type="text" placeholder="" />
                </div>

                <div class="cc3-modal-delivery-dialog__chips">
                  <button
                    v-for="filter in providerFilters"
                    :key="filter.id"
                    type="button"
                    class="cc3-modal-delivery-dialog__chip"
                    :class="{
                      'cc3-modal-delivery-dialog__chip--active': isProviderFilterActive(filter.id),
                    }"
                    @click="onProviderFilterClick(filter.id)"
                  >
                    {{ filter.label }}
                  </button>
                </div>

                <div
                  v-if="filteredPickupPoints.length"
                  ref="pointsListRef"
                  class="cc3-modal-delivery-dialog__points"
                >
                  <button
                    v-for="point in filteredPickupPoints"
                    :key="point.id"
                    type="button"
                    :data-point-id="point.id"
                    class="cc3-modal-delivery-dialog__point"
                    :class="{
                      'cc3-modal-delivery-dialog__point--selected':
                        point.id === selectedPickupPointId,
                    }"
                    @click="selectPoint(point.id)"
                  >
                    <span class="cc3-modal-delivery-dialog__point-name">{{ point.name }}</span>
                    <span class="cc3-modal-delivery-dialog__point-address">{{ point.address }}</span>
                    <span class="cc3-modal-delivery-dialog__point-meta">
                      {{ text.openUntil }} · {{ point.priceFormat }}
                    </span>
                  </button>
                </div>

                <p v-else class="cc3-modal-delivery-dialog__empty">{{ text.pickupEmpty }}</p>
              </div>
            </template>
          </template>

          <template v-else-if="step === 'address-form'">
            <h3 class="cc3-modal-delivery-dialog__section-title">{{ text.addressSection }}</h3>

            <div class="cc3-modal-delivery-dialog__fields">
              <Cc3StandField
                v-for="field in renderedAddressFields"
                :key="field.key"
                v-model="values[field.key]"
                :field="field"
                @select="onSuggestionSelect"
              />
            </div>

            <h3 class="cc3-modal-delivery-dialog__section-title">{{ text.recipientSection }}</h3>

            <div class="cc3-modal-delivery-dialog__fields">
              <Cc3StandField
                v-for="field in recipientFields"
                :key="field.key"
                v-model="values[field.key]"
                :field="field"
              />
            </div>

            <label class="cc3-modal-delivery-dialog__favorite">
              <span>{{ text.favorite }}</span>
              <input v-model="isFavorite" type="checkbox" class="cc3-modal-delivery-dialog__checkbox" />
            </label>
          </template>

          <template v-else-if="step === 'pickup-detail' && pickupDetailView">
            <h3 class="cc3-modal-delivery-dialog__section-title">{{ pickupDetailView.title }}</h3>

            <p class="cc3-modal-delivery-dialog__detail-address">
              {{ pickupDetailView.address }}
              <br />
              <strong>{{ pickupDetailView.priceLabel }}</strong>
            </p>

            <div class="cc3-modal-delivery-dialog__detail-block">
              <p class="cc3-modal-delivery-dialog__detail-title">{{ text.hours }}</p>
              <p class="cc3-modal-delivery-dialog__detail-text">
                {{ text.hoursWeekday }}
                <br />
                {{ text.hoursWeekend }}
              </p>
            </div>

            <div v-if="pickupDetailView.note" class="cc3-modal-delivery-dialog__detail-block">
              <p class="cc3-modal-delivery-dialog__detail-title">{{ text.directions }}</p>
              <p class="cc3-modal-delivery-dialog__detail-text">{{ pickupDetailView.note }}</p>
            </div>

            <div v-if="pickupDetailView.phone" class="cc3-modal-delivery-dialog__detail-block">
              <p class="cc3-modal-delivery-dialog__detail-title">{{ text.contacts }}</p>
              <p class="cc3-modal-delivery-dialog__detail-text">{{ pickupDetailView.phone }}</p>
            </div>

            <label class="cc3-modal-delivery-dialog__favorite">
              <span>{{ text.favorite }}</span>
              <input v-model="isFavorite" type="checkbox" class="cc3-modal-delivery-dialog__checkbox" />
            </label>

            <div class="cc3-modal-delivery-dialog__recipient">
              <h3 class="cc3-modal-delivery-dialog__section-title">{{ text.recipientSection }}</h3>

              <div class="cc3-modal-delivery-dialog__fields">
                <Cc3StandField
                  v-for="field in recipientFields"
                  :key="field.key"
                  v-model="values[field.key]"
                  :field="field"
                />
              </div>
            </div>
          </template>
        </div>

        <div class="cc3-modal-delivery-dialog__footer">
          <button
            v-if="step === 'search'"
            type="button"
            class="cc3-modal-delivery-dialog__continue"
            @click="continueFromSearch"
          >
            {{ text.continue }}
          </button>

          <template v-else-if="editProfile">
            <button type="button" class="cc3-modal-delivery-dialog__continue" @click="confirm">
              {{ text.save }}
            </button>
            <button
              type="button"
              class="cc3-modal-delivery-dialog__delete"
              @click="isDeleteConfirmOpen = true"
            >
              {{ text.remove }}
            </button>
          </template>

          <button v-else type="button" class="cc3-modal-delivery-dialog__continue" @click="confirm">
            {{ text.continue }}
          </button>
        </div>
      </div>
  </Teleport>

  <Cc3ModalConfirmDialog
    v-if="isDeleteConfirmOpen"
    message="Do you want to delete this address?"
    @confirm="deleteProfile"
    @cancel="isDeleteConfirmOpen = false"
  />
</template>

<style lang="scss">
// Во макете это не боттом-шит, а полноэкранная страница-модалка
// (Figma-фрейм "Mobile/popup" 375×812 — во весь мобильный вьюпорт,
// без затемнения и скруглений).
.cc3-modal-delivery-dialog {
  // Teleport выносит модалку в body, вне .cc3-modal-checkout — цветовая
  // схема и токены не наследуются, повторяем те же объявления.
  color-scheme: light;

  @include cc3-light-tokens;

  position: fixed;
  inset: 0;
  z-index: 100;

  display: flex;
  flex-direction: column;

  // Макет собран под 375px, но телефон бывает шире: на 390 по краям
  // оставалось по 8px фона, на 430 — по 28. Поэтому на телефоне блок
  // тянется во всю ширину, а рамка в 375px остаётся только на десктопе,
  // где стенд смотрят как превью мобильного экрана.
  width: 100%;

  @include mediaMinWidth('sm') {
    max-width: 375px;
  }

  // 100dvh, а не 100vh: на телефоне адресная строка сворачивается, и при
  // 100vh низ модалки с кнопкой уезжает под неё.
  height: 100dvh;
  margin: 0 auto;

  overflow-y: auto;

  // Прокрутка не «протекает» на страницу под модалкой и не тянет её за палец.
  overscroll-behavior: contain;

  background-color: var(--st-content-background-color-default-solid-normal);

  &__header {
    position: sticky;
    top: 0;
    z-index: 1;

    display: flex;
    align-items: center;
    justify-content: space-between;

    padding: var(--st-global-distance-space-inset-2xl) var(--st-global-distance-space-inset-2xl)
      var(--st-global-distance-space-inset-xl);

    background-color: var(--st-content-background-color-default-solid-normal);
  }

  &__back,
  &__close {
    display: flex;
    align-items: center;
    justify-content: center;

    padding: 0;

    color: var(--st-content-foreground-color-neutral-primary);
    background: none;
    border: none;
    cursor: pointer;
  }

  &__back-icon {
    transform: rotate(90deg);
  }

  &__title {
    margin: 0;

    @include font('label-md');

    color: var(--st-content-foreground-color-neutral-primary);
  }

  &__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--st-global-distance-space-inset-none);

    padding: 0 var(--st-global-distance-space-inset-2xl);
  }

  &__tabs {
    display: flex;
    flex: 1;
    gap: var(--st-global-distance-space-inset-none);

    height: 32px;
    padding: var(--st-global-distance-space-inset-xs);

    background-color: var(--st-content-background-color-neutral-onsubtle);
    border-radius: var(--st-global-radius-xl);
  }

  &__tab {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;

    padding: 0 var(--st-global-distance-space-inset-2xl);

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

  &__map {
    overflow: hidden;

    margin: 0 calc(var(--st-global-distance-space-inset-2xl) * -1)
      var(--st-global-distance-space-inset-xl);

    // Cc3Map — общий компонент (используется и в проде), по умолчанию
    // рисует карточку с рамкой и скруглением. В этой модалке карта — на
    // весь экран без отступов, поэтому убираем их только здесь.
    .cc3-map {
      border: none;
      border-radius: 0;
    }
  }

  // Самовывоз: переключатель Карта/Список лежит поверх карты (см. фигму),
  // а не отдельной строкой.
  &__pickup-map-area {
    position: relative;
  }

  // Bleed-margin — на самой карте, а не на &__pickup-map-area: если её
  // повесить на общего родителя, кнопки Карта/Список (тоже его дети)
  // сдвинутся вместе с ней и займут разное место в режимах карты и списка.
  &__pickup-map-canvas {
    margin: 0 calc(var(--st-global-distance-space-inset-2xl) * -1) var(--st-global-distance-space-inset-xl);

    // Составной селектор — не только для border/radius, но и чтобы
    // specificity надёжно перебивала .cc3-map { width: 100% }: сама карта
    // задаёт фиксированную ширину, отрицательные поля её лишь сдвигают,
    // а не растягивают, и без перебитого width справа остаётся щель.
    &.cc3-map {
      width: calc(100% + var(--st-global-distance-space-inset-2xl) * 2);
      border: none;
      border-radius: 0;
    }
  }

  // Sticky, а не absolute: кнопки должны оставаться на месте при прокрутке
  // диалога (__header — тоже sticky, top держит их сразу под ним, а не
  // друг на друге). 60px — текущая высота __header.
  &__view-toggle {
    position: sticky;
    top: 60px;
    z-index: 2;

    display: flex;
    gap: var(--st-global-distance-space-inset-sm);

    // Только верхний отступ: боковые уже даёт __body — свой лишний
    // левый/правый задваивал отступ и сдвигал кнопки правее свичера в хедере.
    padding-top: var(--st-global-distance-space-inset-md);
  }

  // Когда карта показана, переключатель должен лежать на ней, а не над ней:
  // тянем карту вверх под кнопки отрицательным отступом вместо того, чтобы
  // резервировать под них отдельное место. -44px — вся высота строки
  // переключателя (32px кнопка + 12px верхнего паддинга), а не примерно:
  // при недоборе карта на этой вкладке съезжает на пару пикселей ниже,
  // чем на вкладке курьера, и это заметно.
  &__pickup-map-area--map &__view-toggle {
    margin-bottom: -44px;
  }

  &__view-btn {
    display: flex;
    align-items: center;
    gap: var(--st-global-distance-space-inline-xs);

    padding: var(--st-global-distance-space-inset-md) var(--st-global-distance-space-inset-xl);

    @include font('label-sm');

    color: var(--st-content-foreground-color-neutral-primary);
    background-color: #eff3f7;
    border: none;
    border-radius: var(--st-global-radius-md);
    cursor: pointer;

    &--active {
      color: var(--st-action-foreground-color-onprimary-normal);
      background-color: var(--st-action-background-color-positive-normal);
    }
  }

  // Белый блок под картой — примерно на 3 карточки пунктов: список внутри
  // прокручивается сам, а строка поиска и чипсы фильтра остаются на месте.
  &__pickup-panel {
    display: flex;
    flex: 1;
    flex-direction: column;

    min-height: 0;

    &--capped {
      max-height: 340px;
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: var(--st-global-distance-space-inset-sm);

    padding: var(--st-global-distance-space-inset-xl) 0;
  }

  &__row {
    display: flex;
    gap: var(--st-global-distance-space-inset-2xl);

    .cc3-modal-delivery-dialog__field {
      flex: 1;
      min-width: 0;
    }
  }

  &__label {
    display: flex;
    align-items: center;
    gap: 2px;

    @include font('label-sm');

    color: var(--st-content-foreground-color-neutral-secondary);
  }

  &__required {
    @include font('label-xs');

    color: var(--st-content-foreground-color-negative-primary);
  }

  &__phone-prefix {
    @include font('body-md');

    color: var(--st-content-foreground-color-neutral-secondary);
  }

  &__variants-hint {
    margin: 0;
    padding: var(--st-global-distance-space-inset-xl) var(--st-global-distance-space-inset-3xl);

    @include font('label-sm');

    color: var(--st-content-foreground-color-neutral-tetriary);
    background-color: var(--st-content-background-color-neutral-subtle);
    border-radius: var(--st-global-radius-lg);
  }

  &__variants {
    display: flex;
    flex-direction: column;
  }

  &__cell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--st-global-distance-space-inset-xl);

    padding: var(--st-global-distance-space-inset-md) 0;

    cursor: pointer;
  }

  &__cell-content {
    display: flex;
    flex-direction: column;
  }

  &__cell-title {
    @include font('body-md');

    color: var(--st-content-foreground-color-neutral-primary);
  }

  &__cell-caption {
    @include font('body-sm');

    color: var(--st-content-foreground-color-neutral-secondary);
  }

  &__radio {
    @include cc3-modal-radio-control;
  }

  &__checkbox {
    @include cc3-modal-check-control;
  }

  &__chips {
    display: flex;
    flex-wrap: nowrap;
    gap: var(--st-global-distance-space-inset-md);

    padding-bottom: var(--st-global-distance-space-inset-xl);

    overflow-x: auto;
  }

  &__chip {
    flex-shrink: 0;

    padding: var(--st-global-distance-space-inset-sm) var(--st-global-distance-space-inset-xl);

    @include font('label-sm');

    color: var(--st-content-foreground-color-neutral-primary);
    background-color: var(--st-content-background-color-default-solid-normal);
    border: 1px solid var(--st-content-border-color-neutral-implicit);
    border-radius: var(--st-global-radius-pill);
    cursor: pointer;

    &--active {
      color: var(--st-action-foreground-color-positive-normal);
      border-color: var(--st-action-foreground-color-positive-normal);
    }
  }

  // Список пунктов внутри __pickup-panel прокручивается сам — либо в
  // пределах отведённых 340px (карта видна), либо во всю оставшуюся
  // высоту диалога (режим списка, карты нет).
  &__points {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--st-global-distance-space-inset-sm);

    padding-bottom: var(--st-global-distance-space-inset-2xl);
    min-height: 0;

    overflow-y: auto;
  }

  &__point {
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    gap: var(--st-global-distance-space-inset-xs);

    padding: var(--st-global-distance-space-inset-md);
    width: 100%;

    text-align: left;
    background-color: var(--st-content-background-color-default-solid-normal);
    border: 2px solid var(--st-content-border-color-neutral-implicit);
    border-radius: var(--st-global-radius-lg);
    cursor: pointer;

    &--selected {
      border-color: var(--st-action-foreground-color-positive-normal);
    }
  }

  &__point-meta {
    color: var(--st-content-foreground-color-neutral-tetriary);
  }

  &__empty {
    margin: 0;

    padding: var(--st-global-distance-space-inset-md) 0
      var(--st-global-distance-space-inset-2xl);

    color: var(--st-content-foreground-color-neutral-tetriary);
  }

  &__point-name {
    @include font('label-md');

    color: var(--st-content-foreground-color-neutral-primary);
  }

  &__point-address,
  &__point-hours {
    @include font('body-sm');

    color: var(--st-content-foreground-color-neutral-secondary);
  }

  &__section-title {
    margin: 0;
    padding: var(--st-global-distance-space-inset-sm) 0;

    @include font('heading-xxs');

    color: var(--st-content-foreground-color-neutral-primary);
  }

  &__detail-address {
    margin: 0;
    padding-bottom: var(--st-global-distance-space-inset-xl);

    @include font('body-md');

    color: var(--st-content-foreground-color-neutral-primary);
  }

  &__detail-block {
    padding-bottom: var(--st-global-distance-space-inset-xl);
  }

  &__detail-title {
    margin: 0 0 var(--st-global-distance-space-inset-xs);

    @include font('label-md');

    color: var(--st-content-foreground-color-neutral-primary);
  }

  &__detail-text {
    margin: 0;

    @include font('body-sm');

    color: var(--st-content-foreground-color-neutral-secondary);
  }

  &__favorite {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--st-global-distance-space-inset-xl);

    padding: var(--st-global-distance-space-inset-xl) 0;

    @include font('body-md');

    color: var(--st-content-foreground-color-neutral-primary);
    cursor: pointer;
  }

  &__recipient {
    padding-top: var(--st-global-distance-space-inset-md);
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

  &__footer {
    position: sticky;
    bottom: 0;

    display: flex;
    flex-direction: column;
    gap: var(--st-global-distance-space-inset-xl);

    padding: var(--st-global-distance-space-inset-2xl);

    background-color: var(--st-content-background-color-default-solid-normal);
  }

  &__continue {
    display: flex;
    align-items: center;
    justify-content: center;

    padding: var(--st-global-distance-space-inset-lg);
    width: 100%;
    height: 44px;

    font-family: inherit;

    @include font('label-md');

    color: var(--st-action-foreground-color-onprimary-normal);
    background-color: var(--st-action-background-color-positive-normal);
    border: none;
    border-radius: var(--st-global-radius-md);
    cursor: pointer;
  }

  &__delete {
    display: flex;
    align-items: center;
    justify-content: center;

    padding: var(--st-global-distance-space-inset-lg);
    width: 100%;
    height: 44px;

    font-family: inherit;

    @include font('label-md');

    color: var(--st-action-foreground-color-neutral-normal);
    background-color: var(--st-content-background-color-default-solid-normal);
    border: 1px solid var(--st-action-border-color-neutral-subtle-normal);
    border-radius: var(--st-global-radius-md);
    cursor: pointer;
  }
}
</style>
