import { countries } from './countries'
import type { CountryCode, FieldKey } from './types'

type FieldValues = Partial<Record<FieldKey, string>>

type Translate = (key: string, params?: Record<string, string>) => string

/**
 * Адрес в карточке: строка доставки и строка населённого пункта.
 *
 * Две строки, а не одна: в США и Европе адрес так и пишется — улица с
 * квартирой, под ней город с индексом. Одна строка на узком экране
 * переносится там, где кончилось место, и индекс отрывается от города
 * («Los Angeles CA» / «90041»). Перенос по смыслу не умеет ехать не туда.
 *
 * В СНГ порядок другой — город открывает строку, — и там карточка остаётся
 * однострочной: `locality` пустая.
 */
export interface AddressCard {
  /** Улица, дом, квартира. */
  street: string
  /** Город, штат, индекс — то, что нельзя разрывать переносом. */
  locality: string
}

/** Поля-уточнения, которых нет в формах США и Европы. */
const DETAIL_KEYS: FieldKey[] = ['entrance', 'floor', 'intercom']

/**
 * Есть ли в форме страны подъезд, этаж и домофон.
 *
 * От этого зависит, куда идёт квартира. Там, где уточнений несколько
 * (СНГ), они живут отдельной строкой под адресом — как в карточке Озона.
 * Там, где квартира единственная (США, Европа), отдельная строка ради неё
 * не заводится: по USPS Publication 28 §213 номер квартиры стоит в конце
 * строки доставки, а под индексом он читается как примечание, а не как
 * часть адреса.
 */
function hasDetailFields(country: CountryCode): boolean {
  return countries[country].address.some((field) => DETAIL_KEYS.includes(field.key))
}

/**
 * Подпись к номеру квартиры зависит не от страны, а от того, что человек
 * ввёл. В СНГ поле так и называется «Квартира», и в него вводят одно число —
 * «45» без подписи в карточке не прочитать. В США и Европе поле описательное
 * («Apartment, suite, etc.», «Wohnung, Etage usw.»), и туда вводят готовую
 * формулировку: «Apt 21B», «3. OG», «byt 9» — подпись к ней дала бы
 * «byt byt 9».
 *
 * Но и там человек может ввести просто номер: в немецкой адресной книге
 * лежит «12», и в карточке оно стояло голым числом без всякого объяснения.
 * Поэтому правило по значению: номер без букв получает подпись, готовая
 * формулировка остаётся как есть.
 */
const BARE_NUMBER = /^\d+[\d\s./-]*$/

function formatApartment(value: string, translate: Translate): string {
  return BARE_NUMBER.test(value) ? translate('address.part.apartment', { value }) : value
}

/**
 * Адрес карточки из полей формы.
 *
 * Порядок частей — местный: в СНГ индекс в конце, в Европе перед городом,
 * в США после кода штата. Чужой формат собственного адреса читается как
 * ошибка ввода.
 *
 * Дом идёт сразу за улицей: там, где он вынесен отдельным полем, в самой
 * строке улицы его больше нет.
 *
 * Части, которых в форме этой страны нет или которые человек не заполнил,
 * выпадают. Часть, которая уже встречается в строке улицы, тоже выпадает:
 * подсказка адреса кладёт в поле улицы полную строку с городом, и повторять
 * его за ней незачем.
 */
export function composeAddressCard(
  country: CountryCode,
  values: FieldValues,
  translate: Translate,
): AddressCard {
  const street = values.street?.trim() ?? ''
  const house = values.house?.trim() ?? ''
  const apartment = values.apartment?.trim() ?? ''
  const city = values.city?.trim() ?? ''
  const region = values.region?.trim() ?? ''
  const postal = values.postal?.trim() ?? ''

  const isNew = (part: string) => part !== '' && !street.toLowerCase().includes(part.toLowerCase())

  // Дом вынесен отдельным полем там, где он есть в форме, — в строке улицы
  // его нет, и в карточку он возвращается здесь.
  const head = [street, house].filter(Boolean).join(', ')

  const unit = !hasDetailFields(country) && isNew(apartment)
    ? formatApartment(apartment, translate)
    : ''

  if (country === 'us') {
    const cityPart = isNew(city) ? city : ''
    const stateZip = [region, postal].filter(isNew).join(' ')

    return {
      street: [head, unit].filter(Boolean).join(', '),
      locality: [cityPart, stateZip].filter(Boolean).join(', '),
    }
  }

  if (country === 'de' || country === 'pl' || country === 'cz') {
    return {
      street: [head, unit].filter(Boolean).join(', '),
      locality: [postal, city].filter(isNew).join(' '),
    }
  }

  return {
    street: [head, isNew(city) ? city : '', isNew(postal) ? postal : '']
      .filter(Boolean)
      .join(', '),
    locality: '',
  }
}

/** Карточка одной строкой: адресная книга, поиск по ней, полезная нагрузка. */
export function joinAddressCard(card: AddressCard): string {
  return [card.street, card.locality].filter(Boolean).join(', ')
}

/**
 * Адрес одной строкой из полей формы.
 *
 * До этой функции в карточке оставалась одна улица: «350 5th Ave» вместо
 * «350 5th Ave, Apt 21B, New York, NY 10118». Респондент, проверяя себя
 * перед оплатой, видел адрес без индекса и возвращался в форму убедиться,
 * что его не потеряли.
 */
export function composeAddressLine(
  country: CountryCode,
  values: FieldValues,
  translate: Translate,
): string {
  return joinAddressCard(composeAddressCard(country, values, translate))
}

/**
 * Адрес выбранной карточки в чекауте.
 *
 * У США и Европы собирается из полей: только так квартира попадает внутрь
 * строки доставки, а город с индексом — на свою строку. У СНГ берётся
 * готовая строка — в книге она написана руками, и собранная из полей
 * встала бы в другом порядке («Москва, проспект Берёзовой Рощи, 12»
 * вместо «проспект Берёзовой Рощи, 12, Москва»).
 *
 * Пункт выдачи полей не имеет вовсе — у него есть только собственный адрес.
 */
export function selectedAddressCard(
  country: CountryCode,
  values: FieldValues | undefined,
  line: string,
  translate: Translate,
): AddressCard {
  if (!values || hasDetailFields(country)) {
    return { street: line, locality: '' }
  }

  return composeAddressCard(country, values, translate)
}

/**
 * Строка уточнений под адресом: квартира, подъезд, домофон, этаж.
 *
 * Человек вводит эти поля в форме, а в чекауте их не было вообще — карточка
 * показывала одну улицу. Респондент, который только что набрал код домофона,
 * не находил его на экране и возвращался в форму проверять, сохранилось ли.
 *
 * Порядок как в карточке Озона: квартира, подъезд, домофон, этаж. Поля,
 * которых в форме этой страны нет или которые человек не заполнил, выпадают;
 * пустая строка не рисуется вовсе.
 *
 * В США и Европе строки нет совсем: там из уточнений есть только квартира,
 * и она стоит внутри строки доставки.
 */
export function composeAddressExtras(
  country: CountryCode,
  values: FieldValues | undefined,
  translate: Translate,
): string {
  if (!values || !hasDetailFields(country)) {
    return ''
  }

  const parts: string[] = []

  const push = (key: FieldKey, labelKey: string) => {
    const value = values[key]?.trim()

    if (!value) {
      return
    }

    parts.push(key === 'apartment' ? formatApartment(value, translate) : translate(labelKey, { value }))
  }

  push('apartment', 'address.part.apartment')
  push('entrance', 'address.part.entrance')
  push('intercom', 'address.part.intercom')
  push('floor', 'address.part.floor')

  return parts.join(', ')
}
